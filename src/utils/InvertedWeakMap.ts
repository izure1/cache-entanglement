/**
 * A Map that holds weak references to its values.
 * Unlike a standard WeakMap where the keys are weak, this implementation makes the values weak.
 * It uses `WeakRef` to store values and `FinalizationRegistry` to clean up the map when values are garbage collected.
 * @template K Type of the key (primitive or symbol).
 * @template V Type of the value (must be an object/WeakKey).
 */
export class InvertedWeakMap<K extends string | number | symbol, V extends WeakKey> {
  private readonly map: Map<K, WeakRef<V>>
  private readonly registry: FinalizationRegistry<K>

  /**
   * Creates an instance of InvertedWeakMap.
   */
  constructor() {
    this.map = new Map()
    this.registry = new FinalizationRegistry((key) => {
      this.map.delete(key)
    })
  }

  /**
   * Clears all entries from the map.
   */
  clear(): void {
    this.map.clear()
  }

  /**
   * Removes an entry from the map by key.
   * Also unregisters the value from the finalization registry if it still exists.
   * @param key The key to remove.
   * @returns True if the entry was removed, false otherwise.
   */
  delete(key: K): boolean {
    const ref = this.map.get(key)
    if (ref) {
      const raw = ref.deref()
      if (raw !== undefined) {
        this.registry.unregister(raw)
      }
    }
    return this.map.delete(key)
  }

  /**
   * Retrieves a value by key.
   * @param key The key to look for.
   * @returns The value if it exists and hasn't been garbage collected, otherwise undefined.
   */
  get(key: K): V | undefined {
    return this.map.get(key)?.deref()
  }

  /**
   * Checks if a key exists in the map and its value hasn't been garbage collected.
   * @param key The key to check.
   * @returns True if the key exists and the value is still alive.
   */
  has(key: K): boolean {
    return this.map.has(key) && this.get(key) !== undefined
  }

  /**
   * Sets a value for the given key using a weak reference.
   * Registers the value in the finalization registry to automatically remove the key when the value is GC'd.
   * @param key The key to associate with the value.
   * @param value The value to store weakly.
   * @returns This InvertedWeakMap instance.
   */
  set(key: K, value: V): this {
    this.map.set(key, new WeakRef(value))
    this.registry.register(value, key)
    return this
  }

  /**
   * Returns the number of entries currently in the map.
   * Note: This may include entries whose values have been GC'd but not yet cleaned up by the registry.
   */
  get size(): number {
    return this.map.size
  }

  /**
   * Returns an iterator of keys in the map.
   * @returns An iterable iterator of keys.
   */
  keys(): IterableIterator<K> {
    return this.map.keys()
  }
}
