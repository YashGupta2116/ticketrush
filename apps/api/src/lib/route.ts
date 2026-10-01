import type { Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { Errors } from './errors';

type RequestSchema = z.ZodType<{ body?: unknown; query?: unknown; params?: unknown }>;
type Ctx = { req: Request; res: Response };

/**
 * Validates `{ body, query, params }` against `schema`, runs `handler` with typed input,
 * and responds with `{ data }`. If the handler already responded (e.g. SSE), it does nothing.
 */
export const route =
  <S extends RequestSchema>(
    schema: S,
    handler: (input: z.output<S>, ctx: Ctx) => unknown,
    { status = 200 } = {},
  ): RequestHandler =>
  async (req, res) => {
    const parsed = schema.safeParse({ body: req.body, query: req.query, params: req.params });
    if (!parsed.success) {
      throw Errors.validation(
        undefined,
        parsed.error.issues.map(({ path, message }) => ({
          path: path.map(String).join('.'),
          message,
        })),
      );
    }
    const data = await handler(parsed.data, { req, res });
    if (!res.headersSent) res.status(status).json({ data });
  };
