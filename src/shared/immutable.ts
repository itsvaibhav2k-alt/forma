/** Plain, structured-cloneable data only. No Date, Map, Set or typed-array inputs. */
export type DeepReadonly<T> = T extends readonly (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : T extends object ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> } : T;

export function immutableCopy<T>(value: T): DeepReadonly<T> {
  const copy = structuredClone(value);
  const freeze = (item: unknown): void => {
    if (item !== null && typeof item === 'object' && !Object.isFrozen(item)) {
      Object.freeze(item);
      for (const child of Object.values(item)) freeze(child);
    }
  };
  freeze(copy);
  return copy as DeepReadonly<T>;
}
