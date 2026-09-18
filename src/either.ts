export type Either<E, A> =
  | { readonly ok: true; readonly value: A }
  | { readonly ok: false; readonly error: E };

export const right = <A, E = string>(value: A): Either<E, A> => ({ ok: true, value });
export const left = <E, A = never>(error: E): Either<E, A> => ({ ok: false, error });

export function unwrap<A>(e: Either<string, A>): A {
  if (!e.ok) {
    throw new Error(e.error);
  }
  return e.value;
}

export function andThen<E, A, B>(e: Either<E, A>, f: (value: A) => Either<E, B>): Either<E, B> {
  return e.ok ? f(e.value) : e;
}
