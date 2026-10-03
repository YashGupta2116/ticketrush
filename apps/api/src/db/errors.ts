// Drizzle wraps driver errors, so the Postgres code may live on `cause`.
const pgCode = (err: unknown) => {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.cause?.code ?? e?.code;
};

export const isUniqueViolation = (err: unknown) => pgCode(err) === '23505';
export const isForeignKeyViolation = (err: unknown) => pgCode(err) === '23503';
