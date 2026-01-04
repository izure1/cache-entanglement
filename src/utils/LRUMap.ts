/**
 * Represents a node in the LRU cache's doubly linked list.
 * @template K Type of the key.
 * @template V Type of the value.
 */
export interface CacheNode<K, V> {
  key: K
  value: V
  prev: CacheNode<K, V> | null
  next: CacheNode<K, V> | null
}

/**
 * A Map-like data structure that implements the Least Recently Used (LRU) eviction policy.
 * Once the capacity is reached, the least recently accessed item is removed.
 * @template K Type of the key.
 * @template V Type of the value.
 */
export class LRUMap<K, V> {
  private capacity: number
  private map: Map<K, CacheNode<K, V>>
  private head: CacheNode<K, V> | null = null
  private tail: CacheNode<K, V> | null = null

  /**
   * Creates an instance of LRUMap.
   * @param capacity The maximum number of items the cache can hold.
   */
  constructor(capacity: number) {
    this.capacity = capacity
    this.map = new Map<K, CacheNode<K, V>>()
  }

  /**
   * Promotes a node to the head of the linked list (marks as most recently used).
   * @param node The node to promote.
   */
  private promote(node: CacheNode<K, V>) {
    this.extract(node)
    this.prepend(node)
  }

  /**
   * Disconnects a node from the doubly linked list.
   * @param node The node to extract.
   */
  private extract(node: CacheNode<K, V>) {
    if (node.prev) node.prev.next = node.next
    else this.head = node.next

    if (node.next) node.next.prev = node.prev
    else this.tail = node.prev

    node.prev = null
    node.next = null
  }

  /**
   * Inserts a node at the head of the doubly linked list.
   * @param node The node to prepend.
   */
  private prepend(node: CacheNode<K, V>) {
    node.next = this.head
    if (this.head) this.head.prev = node
    this.head = node
    if (!this.tail) this.tail = node
  }

  /**
   * Stores or updates a value by key.
   * If the capacity is exceeded, the least recently used item (tail) is removed.
   * @param key The key to store.
   * @param value The value to store.
   */
  set(key: K, value: V): void {
    const existing = this.map.get(key)

    if (existing) {
      existing.value = value
      this.promote(existing)
      return
    }

    const newNode: CacheNode<K, V> = { key, value, prev: null, next: null }
    this.map.set(key, newNode)
    this.prepend(newNode)

    if (this.map.size > this.capacity && this.tail) {
      this.map.delete(this.tail.key)
      this.extract(this.tail)
    }
  }

  /**
   * Retrieves a value by key.
   * Accessing the item moves it to the "most recently used" position.
   * @param key The key to look for.
   * @returns The value associated with the key, or undefined if not found.
   */
  get(key: K): V | undefined {
    const node = this.map.get(key)
    if (!node) return undefined

    this.promote(node)
    return node.value
  }

  /**
   * Checks if a key exists in the cache without changing its access order.
   * @param key The key to check.
   * @returns True if the key exists, false otherwise.
   */
  has(key: K): boolean {
    return this.map.has(key)
  }

  /**
   * Removes a key and its associated value from the cache.
   * @param key The key to remove.
   * @returns True if the key was found and removed, false otherwise.
   */
  delete(key: K): boolean {
    const node = this.map.get(key)
    if (!node) return false

    this.extract(node)
    this.map.delete(key)
    return true
  }

  /**
   * Returns an iterator of keys in the order of most recently used to least recently used.
   * @returns An iterable iterator of keys.
   */
  *keys(): IterableIterator<K> {
    let current = this.head
    while (current) {
      yield current.key
      current = current.next
    }
  }

  /**
   * Returns the current number of items in the cache.
   */
  get size(): number {
    return this.map.size
  }

  /**
   * Clears all items from the cache.
   */
  clear(): void {
    this.map.clear()
    this.head = null
    this.tail = null
  }
}
