import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { isProd } from '@/config/env';
import { runShutdownTasks } from '@/lib/lifecycle';
import { register } from '@/modules/auth/auth.service';
import { createEvent } from '@/modules/events/events.service';
import { createShow } from '@/modules/shows/shows.service';
import { createVenue } from '@/modules/venues/venues.service';

const DAY = 86_400_000;
const ADMIN = { name: 'Admin', email: 'admin@ticketrush.dev', password: 'Admin123!' };

if (isProd)
  throw new Error('Refusing to seed demo data (with a known admin password) in production');

// Idempotent: running the seed twice must not create duplicate demo data.
if (await db.query.users.findFirst({ where: eq(users.email, ADMIN.email) })) {
  console.log(
    'Already seeded. To start over: docker compose down -v && pnpm infra:up && pnpm --filter api db:migrate && pnpm --filter api db:seed',
  );
  await runShutdownTasks();
  process.exit(0);
}

const { user: admin } = await register(ADMIN);
await db.update(users).set({ role: 'admin' }).where(eq(users.id, admin.id));

const venue = await createVenue({
  name: 'JLN Arena',
  city: 'Delhi',
  sections: [
    { name: 'Floor', rows: 5, seatsPerRow: 20, tier: 'vip' },
    { name: 'Lower', rows: 10, seatsPerRow: 25, tier: 'premium' },
    { name: 'Upper', rows: 10, seatsPerRow: 30, tier: 'standard' },
  ],
});

const event = await createEvent({
  title: 'Arijit Live',
  description: 'An evening of music with one of the most loved voices in Indian cinema.',
  durationMinutes: 180,
});

for (const [i, isHighDemand] of [false, false, true].entries()) {
  await createShow({
    eventId: event.id,
    venueId: venue.id,
    startsAt: new Date(Date.now() + (i + 7) * DAY),
    salesOpenAt: new Date(),
    pricing: { standard: 99_900, premium: 249_900, vip: 499_900 },
    isHighDemand,
  });
}

console.log(`Seeded: ${ADMIN.email} / ${ADMIN.password} (${venue.seatCount} seats × 3 shows)`);
await runShutdownTasks();
