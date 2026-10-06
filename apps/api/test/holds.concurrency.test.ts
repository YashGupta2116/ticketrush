import { describe, expect, it } from 'vitest';
import { redis } from '@/lib/redis';
import { metaKey, seatKey, userKey } from '@/modules/holds/holds.keys';
import { api, createOnSaleShow, createUser } from './helpers';

type Auth = Record<string, string>;
type Player = Awaited<ReturnType<typeof createUser>>;

const hold = (auth: Auth, showId: string, showSeatIds: string[]) =>
  api.post(`/api/v1/shows/${showId}/holds`).set(auth).send({ showSeatIds });

const setup = async (players: number) => {
  const { auth: admin } = await createUser({ role: 'admin' });
  const { show, seatIds } = await createOnSaleShow(admin);
  const users = await Promise.all(Array.from({ length: players }, () => createUser()));
  return { show, seatIds, users };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('hold concurrency', () => {
  it('lets exactly one of 50 users win the same seat', async () => {
    const { show, seatIds, users } = await setup(50);

    const results = await Promise.all(users.map((u) => hold(u.auth, show.id, [seatIds[0]!])));

    const winners = results.filter((r) => r.status === 201);
    const losers = results.filter((r) => r.status === 409);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(49);
    expect(losers.every((r) => r.body.error.code === 'SEATS_UNAVAILABLE')).toBe(true);

    // The seat belongs to the winner, and the 49 losers hold nothing.
    expect(await redis.get(seatKey(show.id, seatIds[0]!))).toBe(winners[0]!.body.data.holdId);
    const userKeys = await Promise.all(users.map((u) => redis.exists(userKey(show.id, u.user.id))));
    expect(userKeys.reduce((sum, n) => sum + n, 0)).toBe(1);
  });

  it('never lets overlapping selections both succeed, and the loser holds nothing', async () => {
    // 6 independent rounds on fresh seat triples, so many different interleavings are tried.
    const rounds = 6;
    const { show, seatIds, users } = await setup(rounds * 2);

    for (let round = 0; round < rounds; round++) {
      const [a, b] = [users[round * 2]!, users[round * 2 + 1]!];
      const [s1, s2, s3] = seatIds.slice(round * 3, round * 3 + 3) as [string, string, string];

      // A wants [s1, s2] and B wants [s2, s3]: they fight over s2.
      const [resA, resB] = await Promise.all([
        hold(a.auth, show.id, [s1, s2]),
        hold(b.auth, show.id, [s2, s3]),
      ]);

      expect([resA.status, resB.status].sort()).toEqual([201, 409]); // exactly one winner
      const [winner, loser, winnerSeats, loserSeats] =
        resA.status === 201 ? [a, b, [s1, s2], [s3]] : [b, a, [s2, s3], [s1]];

      for (const id of winnerSeats) {
        expect(await redis.get(seatKey(show.id, id))).not.toBeNull();
      }
      // All-or-nothing: the loser's one free seat was NOT held, and the loser has no hold at all.
      for (const id of loserSeats) expect(await redis.exists(seatKey(show.id, id))).toBe(0);
      expect(await redis.exists(userKey(show.id, loser.user.id))).toBe(0);
      expect(await redis.exists(userKey(show.id, winner.user.id))).toBe(1);
    }
  });

  it('frees a seat for the next user once the hold expires', async () => {
    const { show, seatIds, users } = await setup(2);
    const [alice, bob] = users as [Player, Player];
    const { holdId } = (await hold(alice.auth, show.id, [seatIds[0]!])).body.data;
    expect((await hold(bob.auth, show.id, [seatIds[0]!])).status).toBe(409);

    // Shrink the real TTL on every key of the hold, as if 5 minutes had passed.
    const keys = [
      seatKey(show.id, seatIds[0]!),
      metaKey(show.id, holdId),
      userKey(show.id, alice.user.id),
    ];
    await Promise.all(keys.map((key) => redis.pexpire(key, 50)));
    await sleep(150);

    expect(await redis.exists(...keys)).toBe(0); // Redis expired them by itself
    expect((await hold(bob.auth, show.id, [seatIds[0]!])).status).toBe(201);
    expect((await hold(alice.auth, show.id, [seatIds[1]!])).status).toBe(201); // Alice can hold again too
  });

  it('keeps every invariant under a randomized stampede of overlapping selections', async () => {
    const players = 40;
    const { show, seatIds, users } = await setup(players);
    const contested = seatIds.slice(0, 8); // 40 users fighting over 8 seats

    // Deterministic pseudo-random picks (a tiny LCG) so a failure is reproducible.
    let state = 12345;
    // Use the HIGH bits: the low bits of an LCG cycle with a tiny period and would loop forever.
    const next = () => {
      state = (state * 1103515245 + 12345) % 2 ** 31;
      return Math.floor(state / 2 ** 16);
    };
    const picks = users.map(() => {
      const size = 1 + (next() % 3);
      const chosen = new Set<string>();
      while (chosen.size < size) chosen.add(contested[next() % contested.length]!);
      return [...chosen];
    });

    const results = await Promise.all(users.map((u, i) => hold(u.auth, show.id, picks[i]!)));

    const winners = results
      .map((r, i) => ({ res: r, seats: picks[i]!, user: users[i]! }))
      .filter((w) => w.res.status === 201);
    expect(winners.length).toBeGreaterThan(0);
    expect(results.every((r) => r.status === 201 || r.status === 409)).toBe(true); // no 500s

    // 1. No seat appears in two winning holds.
    const heldSeats = winners.flatMap((w) => w.seats);
    expect(new Set(heldSeats).size).toBe(heldSeats.length);

    // 2. Each seat key points at exactly its winner's hold id.
    for (const w of winners) {
      for (const id of w.seats) {
        expect(await redis.get(seatKey(show.id, id))).toBe(w.res.body.data.holdId);
      }
    }

    // 3. Nothing leaked: Redis holds exactly the winners' seats and no losing partial hold.
    const seatKeys = await redis.keys(`hold:{${show.id}}:seat:*`);
    expect(seatKeys).toHaveLength(heldSeats.length);
    const userKeys = await redis.keys(`hold:{${show.id}}:user:*`);
    expect(userKeys).toHaveLength(winners.length);

    // 4. The seat map agrees: held seats are exactly the winners' seats.
    const map: { id: string; status: string }[] = (await api.get(`/api/v1/shows/${show.id}/seats`))
      .body.data;
    expect(
      map
        .filter((s) => s.status === 'held')
        .map((s) => s.id)
        .sort(),
    ).toEqual([...heldSeats].sort());
  });
});
