interface InvertedWeakMapConstructorArguments {
  lifespan: number
}

type Timeouts = NodeJS.Timeout|number

export class InvertedWeakMap<K extends string|number|symbol, V extends WeakKey> {
  private readonly _map: Map<K, WeakRef<V>>
  private readonly _keepAlive: Map<K, V>
  private readonly _timeouts: Map<K, Timeouts>
  private readonly _registry: FinalizationRegistry<K>
  private readonly _lifespan: number

  constructor(option: InvertedWeakMapConstructorArguments) {
    const { lifespan } = option
    this._lifespan = lifespan
    this._map = new Map()
    this._keepAlive = new Map()
    this._timeouts = new Map()
    this._registry = new FinalizationRegistry((key) => {
      this._stopExpire(key, true)
      this._map.delete(key)
    })
  }

  clear(): void {
    this._keepAlive.clear()
    this._map.clear()
  }

  delete(key: K): boolean {
    const ref = this._map.get(key)
    if (ref) {
      const raw = ref.deref()
      if (raw !== undefined) {
        this._registry.unregister(raw)
      }
    }
    this._stopExpire(key, true)
    this._keepAlive.delete(key)
    return this._map.delete(key)
  }

  get(key: K): V|undefined {
    return this._map.get(key)?.deref()
  }

  has(key: K): boolean {
    return this._map.has(key) && this.get(key) !== undefined
  }

  set(key: K, value: V): this {
    this._map.set(key, new WeakRef(value))
    this._registry.register(value, key)
    if (this._lifespan > 0) {
      this._stopExpire(key, true)
      this._startExpire(key, value)
    }
    return this
  }

  extendExpire(key: K): void {
    if (!(this._lifespan > 0)) {
      return
    }
    if (!this._keepAlive.has(key)) {
      return
    }
    this._stopExpire(key, false)
    this._startExpire(key, this._keepAlive.get(key)!)
  }

  private _startExpire(key: K, value: V): void {
    this._keepAlive.set(key, value)
    this._timeouts.set(key, setTimeout(() => {
      this._keepAlive.delete(key)
    }, this._lifespan))
  }

  private _stopExpire(key: K, removeKeepAlive: boolean): void {
    if (!this._timeouts.has(key)) {
      return
    }
    const timeout = this._timeouts.get(key)!
    this._timeouts.delete(key)
    clearTimeout(timeout)
    if (removeKeepAlive) {
      this._keepAlive.delete(key)
    }
  }

  get size(): number {
    return this._map.size
  }

  keys(): IterableIterator<K> {
    return this._map.keys()
  }
}
