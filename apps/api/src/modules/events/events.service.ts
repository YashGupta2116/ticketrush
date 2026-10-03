import type { z } from 'zod';
import { db } from '@/db';
import { events } from '@/db/schema';
import { Errors } from '@/lib/errors';
import { eq } from 'drizzle-orm';
import type { createEventSchema } from './events.schema';

export const createEvent = async ({
  title,
  description,
  durationMinutes,
}: z.infer<typeof createEventSchema>['body']) => {
  const [event] = await db
    .insert(events)
    .values({ title, description, durationMinutes })
    .returning();

  return event!;
};

export const getEvent = async (id: string) => {
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });

  if (!event) throw Errors.notFound('No such event found');

  return event;
};
