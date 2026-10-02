import { z } from 'zod';
import { email } from '@/lib/schemas';

export const registerSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, 'name must be at least 2 characters')
      .max(130, 'name is too long'),
    email,
    password: z.string().min(8, 'password too short').max(128, 'password too long'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email,
    password: z.string().min(1, 'password cannot be empty').max(128, 'password too long'),
  }),
});
