export interface CacheNode<K, V> {
  key: K
  value: V
  prev: CacheNode<K, V> | null
  next: CacheNode<K, V> | null
}

export class LRUMap<K, V> {
  private capacity: number
  private map: Map<K, CacheNode<K, V>>
  private head: CacheNode<K, V> | null = null
  private tail: CacheNode<K, V> | null = null

  constructor(capacity: number) {
    this.capacity = capacity
    this.map = new Map<K, CacheNode<K, V>>()
  }

  // 내부 유틸리티: 노드를 헤드로 이동 (가장 최근 사용됨 표시)
  private promote(node: CacheNode<K, V>) {
    this.extract(node)
    this.prepend(node)
  }

  // 내부 유틸리티: 리스트에서 노드 연결 끊기
  private extract(node: CacheNode<K, V>) {
    if (node.prev) node.prev.next = node.next
    else this.head = node.next

    if (node.next) node.next.prev = node.prev
    else this.tail = node.prev

    node.prev = null
    node.next = null
  }

  // 내부 유틸리티: 리스트 맨 앞에 노드 삽입
  private prepend(node: CacheNode<K, V>) {
    node.next = this.head
    if (this.head) this.head.prev = node
    this.head = node
    if (!this.tail) this.tail = node
  }

  /**
   * 데이터를 저장하거나 업데이트합니다.
   * 용량 초과 시 가장 오래된 항목(tail)을 제거합니다.
   */
  set(key: K, value: V): void {
    const existing = this.map.get(key)

    if (existing) {
      // 기존 값이 있으면 업데이트하고 위치 갱신
      existing.value = value
      this.promote(existing)
      return
    }

    // 새 노드 생성
    const newNode: CacheNode<K, V> = { key, value, prev: null, next: null }
    this.map.set(key, newNode)
    this.prepend(newNode)

    // 용량 확인 및 제거
    if (this.map.size > this.capacity && this.tail) {
      this.map.delete(this.tail.key)
      this.extract(this.tail)
    }
  }

  /**
   * 데이터를 가져옵니다. 접근한 데이터는 "최근 사용됨"으로 갱신됩니다.
   */
  get(key: K): V | undefined {
    const node = this.map.get(key)
    if (!node) return undefined

    this.promote(node)
    return node.value
  }

  /**
   * 키의 존재 여부를 확인합니다. (순서는 변경하지 않는 것이 일반적입니다)
   */
  has(key: K): boolean {
    return this.map.has(key)
  }

  /**
   * 특정 키와 데이터를 캐시에서 완전히 제거합니다.
   */
  delete(key: K): boolean {
    const node = this.map.get(key)
    if (!node) return false

    this.extract(node)
    this.map.delete(key)
    return true
  }

  /**
   * 현재 캐시된 키들을 최근 사용된 순서대로 반환합니다.
   */
  *keys(): IterableIterator<K> {
    let current = this.head
    while (current) {
      yield current.key
      current = current.next
    }
  }

  /**
   * 현재 캐시된 아이템의 개수를 반환합니다.
   */
  get size(): number {
    return this.map.size
  }

  /**
   * 캐시를 완전히 비웁니다.
   */
  clear(): void {
    this.map.clear()
    this.head = null
    this.tail = null
  }
}
