import type { CacheData } from './CacheData'

type Deferred<T> = T|Promise<T>

export type CacheGetter<
  R extends CacheValue<any>
> = (key: string, state: R, ...initialParameter: any) => any

export type CacheGetterParams<
  C extends CacheGetter<any>
> = C extends (key: string, state: any, ...parameter: infer P) => any ? P : never

export interface DependencyMap {
  [key: string]: CacheEntanglement<CacheGetter<any>, DependencyMap>
}

export interface CacheValue<T> {
  [key: string]: T
}

export type CacheState<T extends DependencyMap> = {
  [K in keyof T]: T[K] extends CacheEntanglement<infer R, any> ? CacheData<Awaited<ReturnType<R>>> : never
}

export abstract class CacheEntanglement<
  G extends CacheGetter<CacheState<D>>,
  D extends DependencyMap
> {
  protected readonly creation: G
  protected readonly dependencyMap: D
  protected readonly cacheMap: CacheValue<CacheData<Awaited<ReturnType<G>>>> = {}
  protected readonly assignments: CacheEntanglement<any, any>[]

  constructor(creation: G, dependencyMap: D) {
    this.creation = creation
    this.dependencyMap = dependencyMap
    this.assignments = []

    for (const name in dependencyMap) {
      const dependency = dependencyMap[name]
      if (!dependency.assignments.includes(this)) {
        dependency.assignments.push(this)
      }
    }
  }

  protected abstract resolve(key: string, ...parameter: CacheGetterParams<G>): Deferred<CacheData<Awaited<ReturnType<G>>>>

  /**
   * Checks if there is a cache value stored in the key within the instance.
   * @param key The key to search.
   */
  exists(key: string): boolean {
    return Object.hasOwn(this.cacheMap, key)
  }

  /**
   * Returns the cache value stored in the key within the instance. If the cached value is not present, an error is thrown.
   * @param key The key to search.
   */
  get(key: string): CacheData<Awaited<ReturnType<G>>> {
    if (!this.exists(key)) {
      throw new Error(`Cache value not found: ${key}`)
    }
    return this.cacheMap[key]
  }

  /**
   * Deletes the cache value stored in the key within the instance.
   * @param key The key to delete.
   */
  delete(key: string): void {
    delete this.cacheMap[key]
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
