/**
 * @template _T_
 * @typedef { {
 *   getValue: function(): _T_,
 *   setValue: function(_T_): void,
 *   onChange: function(function(_T_): void): function(): void,
 * } } ObservableType
 */

/**
 * Kolibri-style Observable. `onChange` notifies immediately with the current value.
 *
 * @template _T_
 * @param   { _T_ } value
 * @returns { ObservableType<_T_> }
 */
export function Observable(value) {
  /** @type { Set<function(_T_): void> } */
  const listeners = new Set();
  return {
    getValue: () => value,
    setValue: next => {
      if (Object.is(value, next)) return;
      value = next;
      for (const listener of listeners) listener(value);
    },
    onChange: listener => {
      listeners.add(listener);
      listener(value);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
