import { z } from 'zod';

export const noInput = z.object({});

/** Normalize first, then validate: `z.email().trim()` would validate the untrimmed value. */
export const email = z.string().trim().toLowerCase().pipe(z.email());

export const idParams = z.object({ params: z.object({ id: z.uuid() }) });
