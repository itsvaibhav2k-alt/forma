export type DeepReadonly<T> = T extends readonly unknown[]
  ? { readonly [Index in keyof T]: DeepReadonly<T[Index]> }
  : T extends object
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
    : T;

/** Clone and freeze plain data contracts. Do not pass functions, Maps, Sets, or DOM objects. */
export function snapshot<T>(value: T): DeepReadonly<T> {
  const copy: unknown = structuredClone(value);
  function freeze(item: unknown): void {
    if (item === null || typeof item !== 'object' || Object.isFrozen(item)) return;
    Object.freeze(item);
    for (const child of Object.values(item)) freeze(child);
  }
  freeze(copy);
  return copy as DeepReadonly<T>;
}
