import { useState, useEffect, useCallback, useRef } from "react";

export const useLocalStorage = (key, initialValue) => {
  // Keep the initial render identical between the static export and browser.
  const [storedValue, setStoredValue] = useState(() =>
    initialValue instanceof Function
      ? initialValue()
      : initialValue
  );
  const [isHydrated, setIsHydrated] = useState(false);

  /*
   * Keep a ref containing the latest value.
   *
   * This is important for streaming because Electron can deliver many
   * chunks very quickly. We must never calculate an update from an
   * outdated closure value.
   */
  const storedValueRef = useRef(storedValue);

  useEffect(() => {
    storedValueRef.current = storedValue;
  }, [storedValue]);

  /*
   * Keep the localStorage write operation centralized.
   */
  const persistValue = useCallback(
    (value) => {
      if (typeof window === "undefined") {
        return;
      }

      try {
        let valueToStore = value;

        /*
         * Keep the same 1000-session protection as the original hook.
         */
        if (
          Array.isArray(valueToStore) &&
          valueToStore.length > 1000
        ) {
          valueToStore = valueToStore.slice(0, 1000);
        }

        window.localStorage.setItem(
          key,
          JSON.stringify(valueToStore)
        );
      } catch (error) {
        /*
         * localStorage can fail because of quota/security restrictions.
         * This must never break the React state update itself.
         */
        console.error(
          `Error writing localStorage key "${key}":`,
          error
        );
      }
    },
    [key]
  );

  /*
   * IMPORTANT:
   *
   * We intentionally use React's functional setState here.
   *
   * This guarantees:
   *
   * setValue(prev => ...)
   *
   * receives the actual latest React state rather than the `storedValue`
   * captured by an older render.
   */
  const setValue = useCallback(
    (value) => {
      setStoredValue((previousValue) => {
        let nextValue;

        try {
          nextValue =
            value instanceof Function
              ? value(previousValue)
              : value;
        } catch (error) {
          console.error(
            `Error calculating localStorage value for "${key}":`,
            error
          );

          /*
           * Preserve the existing state if the updater itself fails.
           */
          return previousValue;
        }

        /*
         * Keep the ref synchronized immediately.
         *
         * This is useful when several streaming callbacks arrive before
         * React has committed a render.
         */
        storedValueRef.current = nextValue;

        /*
         * Persist exactly the state that React is accepting.
         *
         * Do not use `storedValue` from the surrounding closure.
         */
        persistValue(nextValue);

        return nextValue;
      });
    },
    [key, persistValue]
  );

  /*
   * Handle changes to the key.
   *
   * This preserves the original hook's behavior while avoiding an
   * unnecessary read on every render.
   */
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const item = window.localStorage.getItem(key);

      if (item !== null) {
        const parsedValue = JSON.parse(item);

        storedValueRef.current = parsedValue;
        setStoredValue(parsedValue);
      }
    } catch (error) {
      console.error(
        `Error reading localStorage key "${key}":`,
        error
      );
    } finally {
      setIsHydrated(true);
    }
  }, [key]);

  return [storedValue, setValue, isHydrated];
};