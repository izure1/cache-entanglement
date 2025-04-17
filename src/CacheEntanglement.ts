import type { CacheData } from './CacheData'
import { InvertedWeakMap } from './utils/InvertedWeakMap'

type Deferred<T> = T|Promise<T>
type ValueRecord<T> = { [key: string]: T }

export type CacheGetter<R extends ValueRecord<any>> = (key: string, cache: R, ...initialParameter: any) => any

export type CacheGetterParams<
  C extends CacheGetter<any>
> = C extends (key: string, cache: any, ...parameter: infer P) => any ? P : never

export type DependencyMap = ValueRecord<CacheEntanglement<CacheGetter<any>, DependencyMap>>

export type DependencyCacheData<T extends (DependencyMap|ValueRecord<any>)> = {
  [K in keyof T]: T[K] extends CacheEntanglement<infer R, any> ? CacheData<Awaited<ReturnType<R>>> : CacheData<T[K]>
}

export type BeforeUpdateHookSync<
  G extends CacheGetter<DependencyCacheData<D>>,
  D extends DependencyMap
> = (key: string, dependencyKey: string, ...initialParameter: CacheGetterParams<G>) => void

export type BeforeUpdateHookAsync<
  G extends CacheGetter<DependencyCacheData<D>>,
  D extends DependencyMap
> = (key: string, dependencyKey: string, ...initialParameter: CacheGetterParams<G>) => Promise<void>

export type BeforeUpdateHook<
  G extends CacheGetter<DependencyCacheData<D>>,
  D extends DependencyMap
> = BeforeUpdateHookSync<G, D>|BeforeUpdateHookAsync<G, D>

export abstract class CacheEntanglement<
  G extends CacheGetter<DependencyCacheData<D>>,
  D extends DependencyMap
> {
  protected readonly creation: G
  protected readonly beforeUpdateHook: BeforeUpdateHook<G, D>
  protected readonly dependencyMap: D
  protected readonly cacheMap: InvertedWeakMap<string, CacheData<Awaited<ReturnType<G>>>>
  protected readonly assignments: CacheEntanglement<any, any>[]
  protected readonly parameterMap: ValueRecord<CacheGetterParams<G>>

  constructor(
    creation: G,
    dependencyMap?: D,
    beforeUpdateHook?: BeforeUpdateHook<G, D>
  ) {
    this.creation = creation
    this.assignments = []
    this.cacheMap = new InvertedWeakMap()
    this.dependencyMap = (dependencyMap ?? {}) as D
    this.parameterMap = {} as unknown as ValueRecord<CacheGetterParams<G>>
    this.beforeUpdateHook = (beforeUpdateHook ?? (() => {})) as BeforeUpdateHook<G, D>

    for (const name in this.dependencyMap) {
      const dependency = this.dependencyMap[name]
      if (!dependency.assignments.includes(this)) {
        dependency.assignments.push(this)
      }
    }
  }

  protected abstract resolve(
    key: string,
    ...parameter: CacheGetterParams<G>
  ): Deferred<CacheData<Awaited<ReturnType<G>>>>

  protected dependencyKey(key: string): string {
    const tokens = key.split('/')
    tokens.pop()
    return tokens.join('/')
  }

  /**
   * Returns all keys stored in the instance.
   */
  keys(): IterableIterator<string> {
    return this.cacheMap.keys()
  }

  /**
   * Deletes all cache values stored in the instance.
   */
  clear(): void {
    for (const key of this.keys()) {
      this.delete(key)
    }
  }

  /**
   * Checks if there is a cache value stored in the key within the instance.
   * @param key The key to search.
   */
  exists(key: string): boolean {
    return this.cacheMap.has(key)
  }

  /**
   * Returns the cache value stored in the key within the instance. If the cached value is not present, an error is thrown.
   * @param key The key to search.
   */
  get(key: string): CacheData<Awaited<ReturnType<G>>> {
    if (!this.cacheMap.has(key)) {
      throw new Error(`Cache value not found: ${key}`)
    }
    return this.cacheMap.get(key)!
  }

  /**
   * Deletes the cache value stored in the key within the instance.
   * @param key The key to delete.
   */
  delete(key: string): void {
    this.cacheMap.delete(key)
  }

  /**
   * Returns the cache value of the key assigned to the instance.
   * If the cached value is not present, the creation function is called, and the returned value is cached.
   * And this value is returned.
   * @param key The key value of the cache value. This value must be unique within the instance.
   * @param parameter The parameter of the cache creation function passed when creating the instance.
   */
  abstract cache(key: string, ...parameter: CacheGetterParams<G>): Deferred<CacheData<Awaited<ReturnType<G>>>>

  /**
   * Re-calls the creation function passed when creating the instance and stores the returned value in the cache again.
   * And this value is returned. This is used to forcefully update the value.
   * @param key The key value of the cache value. This value must be unique within the instance.
   * @param parameter The parameter of the cache creation function passed when creating the instance.
   */
  abstract update(key: string, ...parameter: CacheGetterParams<G>): Deferred<CacheData<Awaited<ReturnType<G>>>>
}
