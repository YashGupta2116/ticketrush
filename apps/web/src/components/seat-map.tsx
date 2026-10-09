import { formatMoney } from '@/lib/format';
import type { Seat, Tier } from '@/lib/types';

const tierTint: Record<Tier, string> = {
  standard: 'bg-tier-standard',
  premium: 'bg-tier-premium',
  vip: 'bg-tier-vip',
};

type Props = {
  seats: Seat[];
  selected: Set<string>;
  locked: boolean;
  onToggle: (seat: Seat) => void;
};

const seatClass = (seat: Seat, isSelected: boolean) => {
  if (isSelected) return 'border-accent bg-accent text-white';
  if (seat.status !== 'available') return 'seat-taken border-transparent text-transparent';
  return `${tierTint[seat.tier]} border-ink/25 hover:border-ink`;
};

export const SeatMap = ({ seats, selected, locked, onToggle }: Props) => {
  // section -> row -> seats (the API already sorts by section, row, number)
  const sections = new Map<string, Map<string, Seat[]>>();
  for (const seat of seats) {
    const rows = sections.get(seat.section) ?? new Map<string, Seat[]>();
    rows.set(seat.row, [...(rows.get(seat.row) ?? []), seat]);
    sections.set(seat.section, rows);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-card px-6 py-8">
      <div className="mx-auto mb-10 w-3/5 min-w-48 rounded-b-[50%] border border-t-0 border-ink/30 pb-3 pt-2 text-center text-[10px] font-medium uppercase tracking-[0.4em] text-muted">
        Stage
      </div>
      <div className="flex flex-col items-center gap-9">
        {[...sections].map(([name, rows]) => (
          <section key={name} aria-label={name}>
            <h3 className="mb-3 text-center text-xs font-medium uppercase tracking-[0.18em] text-muted">
              {name}
            </h3>
            <div className="flex flex-col gap-1.5">
              {[...rows].map(([row, rowSeats]) => (
                <div key={row} className="flex items-center gap-1.5">
                  <span className="w-5 text-right font-mono text-[10px] text-muted">{row}</span>
                  {rowSeats.map((seat) => {
                    const isSelected = selected.has(seat.id);
                    const clickable = !locked && (seat.status === 'available' || isSelected);
                    return (
                      <button
                        key={seat.id}
                        type="button"
                        disabled={!clickable}
                        aria-pressed={isSelected}
                        aria-label={`${name} ${row}${seat.number}, ${formatMoney(seat.priceCents)}, ${isSelected ? 'selected' : seat.status}`}
                        onClick={() => onToggle(seat)}
                        className={`h-6 w-6 rounded-t-md rounded-b-[3px] border font-mono text-[9px] transition disabled:cursor-not-allowed ${seatClass(seat, isSelected)}`}
                      >
                        {seat.number}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export const Legend = ({ pricing }: { pricing: Record<Tier, number> }) => (
  <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
    {(Object.keys(pricing) as Tier[]).map((tier) => (
      <li key={tier} className="flex items-center gap-2">
        <span
          className={`h-3.5 w-3.5 rounded-t-md rounded-b-[2px] border border-ink/25 ${tierTint[tier]}`}
        />
        <span className="capitalize">{tier}</span>
        <span className="font-mono text-ink">{formatMoney(pricing[tier])}</span>
      </li>
    ))}
    <li className="flex items-center gap-2">
      <span className="h-3.5 w-3.5 rounded-t-md rounded-b-[2px] border border-accent bg-accent" />
      Yours
    </li>
    <li className="flex items-center gap-2">
      <span className="seat-taken h-3.5 w-3.5 rounded-t-md rounded-b-[2px]" />
      Taken
    </li>
  </ul>
);
