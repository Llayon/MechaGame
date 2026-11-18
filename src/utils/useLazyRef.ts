import { useRef, type RefObject } from 'react';

/** Retain a mutable object without constructing a discarded copy on every render. */
export function useLazyRef<T extends object>(initialize: () => T): RefObject<T> {
  const ref = useRef<T | null>(null);
  if (ref.current === null) ref.current = initialize();
  return ref as RefObject<T>;
}
