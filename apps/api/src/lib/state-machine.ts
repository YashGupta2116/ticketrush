import { Errors } from './errors';

export const createStateMachine = <S extends string>(
  name: string,
  transitions: Record<S, readonly S[]>,
) => {
  const can = (from: S, to: S) => transitions[from].includes(to);
  const assert = (from: S, to: S) => {
    if (!can(from, to)) throw Errors.conflict(`Invalid ${name} transition: ${from} → ${to}`);
  };
  return { can, assert };
};
