import ms from 'ms'
import type { StringValue } from './types/index'
import type { CacheData } from './CacheData'
import { InvertedWeakMap } from './utils/InvertedWeakMap'

type Deferred<T> = T|Promise<T>
type ValueRecord<T> = { [key: string]: T }

export type CacheGetter<R extends ValueRecord<any>> = (key: string, cache: R, ...initialParameter: any) => any

export type CacheGetterParams<
  C extends CacheGetter<any>
> = C extends (key: string, cache: any, ...parameter: infer P) => any ? P : never

export type DependencyMap = ValueRecord<CacheEntanglement<DependencyMap, CacheGetter<any>>>

export type DependencyCacheData<T extends (DependencyMap|ValueRecord<any>)> = {
  [K in keyof T]: T[K] extends CacheEntanglement<any, infer R> ? CacheData<Awaited<ReturnType<R>>> : CacheData<T[K]>
}

export type BeforeUpdateHookSync<
  D extends DependencyMap,
  G extends CacheGetter<DependencyCacheData<D>>
> = (key: string, dependencyKey: string, ...initialParameter: CacheGetterParams<G>) => void

export type BeforeUpdateHookAsync<
  D extends DependencyMap,
  G extends CacheGetter<DependencyCacheData<D>>
> = (key: string, dependencyKey: string, ...initialParameter: CacheGetterParams<G>) => Promise<void>

export type BeforeUpdateHook<
  D extends DependencyMap,
  G extends CacheGetter<DependencyCacheData<D>>
> = BeforeUpdateHookSync<D, G>|BeforeUpdateHookAsync<D, G>

export interface CacheEntanglementConstructorOption<
  D extends DependencyMap,
  G extends CacheGetter<DependencyCacheData<D>>
> {
  /**
   * The dependencies of the cache value.
   * The key of the object is the name of the dependency, and the value is the CacheEntanglement instance.
   * The dependency cache value is passed to the creation function as the second parameter.
   */
  dependencies?: D
  /**
   * A hook that is called before the cache value is updated.
   * This hook is called before the creation function is called.
   * You can use this hook to update the dependency cache values before the creation function is called.
   * @param key The key of the cache value to be updated.
   * @param dependencyKey The key of the dependency cache value to be updated.
   * @param initialParameter The parameter of the cache creation function passed when creating the instance.
   */
  beforeUpdateHook?: BeforeUpdateHook<D, G>
  /**
   * The lifespan of the cache value.
   * The cache guarantees a lifespan of at least this time and is not collected by garbage collection. It may live longer depending on the environment.
   * If the value is a number, it is treated as milliseconds.
   * If the value is a string, it is parsed by the `ms` library.
   * If the value is `0`, the cache value will not expire.
   * The default value is `0`.
   */
  lifespan?: StringValue|number
}

export abstract class CacheEntanglement<
  D extends DependencyMap,
  G extends CacheGetter<DependencyCacheData<D>>
> {
  protected readonly creation: G
  protected readonly beforeUpdateHook: BeforeUpdateHook<D, G>
  protected readonly lifespan: number
  protected readonly dependencies: D
  protected readonly caches: InvertedWeakMap<string, CacheData<Awaited<ReturnType<G>>>>
  protected readonly assignments: CacheEntanglement<any, any>[]
  protected readonly parameters: ValueRecord<CacheGetterParams<G>>

  constructor(
    creation: G,
    option?: CacheEntanglementConstructorOption<D, G>
  ) {
    option = option ?? {}
    const {
      dependencies,
      lifespan,
      beforeUpdateHook,
    } = option
    this.creation = creation
    this.beforeUpdateHook = (beforeUpdateHook ?? (() => {})) as BeforeUpdateHook<D, G>
    this.lifespan = this._normalizeMs(lifespan ?? 0)
    this.assignments = []
    this.caches = new InvertedWeakMap({ lifespan: this.lifespan })
    this.dependencies = (dependencies ?? {}) as D
    this.parameters = {} as unknown as ValueRecord<CacheGetterParams<G>>

    for (const name in this.dependencies) {
      const dependency = this.dependencies[name]
      if (!dependency.assignments.includes(this)) {
        dependency.assignments.push(this)
      }
    }
  }

  private _normalizeMs(time: StringValue|number): number {
    if (typeof time === 'string') {
      return ms(time)
    }
    return time
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
    return this.caches.keys()
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
    return this.caches.has(key)
  }

  /**
   * Returns the cache value stored in the key within the instance. If the cached value is not present, an error is thrown.
   * @param key The key to search.
   */
  get(key: string): CacheData<Awaited<ReturnType<G>>> {
    if (!this.caches.has(key)) {
      throw new Error(`Cache value not found: ${key}`)
    }
    return this.caches.get(key)!
  }

  /**
   * Deletes the cache value stored in the key within the instance.
   * @param key The key to delete.
   */
  delete(key: string): void {
    this.caches.delete(key)
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
