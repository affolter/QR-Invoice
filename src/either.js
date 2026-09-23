/**
 * Tagged Either. Kolibri-style types via JsDoc; Left is always a string here.
 * @template _E_
 * @template _A_
 * @typedef { { ok: true, value: _A_ } | { ok: false, error: _E_ } } EitherType
 */

/**
 * @template _A_
 * @param   { _A_ } value
 * @returns { EitherType<string, _A_> }
 * @pure
 */
export const right = value => ({ ok: true, value });

/**
 * @template _A_
 * @param   { string } error
 * @returns { EitherType<string, _A_> }
 * @pure
 */
export const left = error => ({ ok: false, error });

/**
 * Tests only. Production code stays on the tagged union.
 * @template _A_
 * @param   { EitherType<string, _A_> } e
 * @returns { _A_ }
 */
export const unwrap = e => {
  if (!e.ok) throw new Error(e.error);
  return e.value;
};

/**
 * @template _A_
 * @template _B_
 * @param   { EitherType<string, _A_> }                e
 * @param   { function(_A_): EitherType<string, _B_> } f
 * @returns { EitherType<string, _B_> }
 * @pure
 */
export const andThen = (e, f) => (e.ok ? f(e.value) : e);
