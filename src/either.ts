export type Either<E, A> = { ok: true; value: A } | { ok: false; error: E };

export const right = <A>(value: A): Either<string, A> => ({ ok: true, value });
export const left = <A = never>(error: string): Either<string, A> => ({ ok: false, error });

export function unwrap<A>(e: Either<string, A>): A {
  if (!e.ok) throw new Error(e.error);
  return e.value;
}

export function andThen<A, B>(e: Either<string, A>, f: (value: A) => Either<string, B>): Either<string, B> {
  return e.ok ? f(e.value) : e;
}
