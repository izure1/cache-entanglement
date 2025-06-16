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
   * Lifespan of a cache entry, in milliseconds (number) or a string (e.g., '5m', parsed by `ms`).
   *
   * - Positive value: Guarantees the entry is not GC'd for this duration.
   *   The lifespan is reset and calculated from the last `cache()` or `update()` call on the entry.
   * - `0` (default) or negative: Timed lifespan protection is disabled.
   *   Entries are held by `WeakRef`s and subject to standard JavaScript GC,
   *   with no minimum lifetime enforced by the library.
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
  protected readonly parameters: Map<string, CacheGetterParams<G>>
  protected readonly assignments: CacheEntanglement<any, any>[]
  protected readonly dependencyProperties: (keyof D)[]
  protected readonly updateRequirements: Set<string>

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
    this.parameters = new Map()
    this.dependencies = (dependencies ?? {}) as D
    this.dependencyProperties = Object.keys(this.dependencies) as (keyof D)[]
    this.updateRequirements = new Set()

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
  
  protected abstract recache(key: string): Deferred<CacheData<Awaited<ReturnType<G>>>|undefined>

  protected abstract resolve(
    key: string,
    ...parameter: CacheGetterParams<G>
  ): Deferred<CacheData<Awaited<ReturnType<G>>>>

  protected bubbleUpdateSignal(key: string): void {
    this.updateRequirements.add(key)
    for (let i = 0, len = this.assignments.length; i < len; i++) {
      const t = this.assignments[i]
      const instance = t as CacheEntanglement<any, any>
      for (const cacheKey of instance.caches.keys()) {
        if (
          cacheKey === key ||
          cacheKey.startsWith(`${key}/`)
        ) {
          instance.bubbleUpdateSignal(cacheKey)
        }
      }
    }
  }

  protected dependencyKey(key: string): string {
    const i = key.lastIndexOf('/')
    if (i === -1) {
      return key
    }
    return key.substring(0, i)
  }

  /**
   * Returns all keys stored in the instance.
   */
  keys(): IterableIterator<string> {
    return this.parameters.keys()
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
    return this.parameters.has(key)
  }

  /**
   * Checks if there is a cache value stored in the key within the instance.
   * This method is an alias for `exists`.
   * @param key The key to search.
   */
  has(key: string): boolean {
    return this.exists(key)
  }

  /**
   * Deletes the cache value stored in the key within the instance.
   * @param key The key to delete.
   */
  delete(key: string): void {
    this.caches.delete(key)
    this.parameters.delete(key)
    this.updateRequirements.delete(key)
    for (let i = 0, len = this.assignments.length; i < len; i++) {
      const t = this.assignments[i]
      const instance = t as CacheEntanglement<any, any>
      for (const cacheKey of instance.keys()) {
        if (
          cacheKey === key ||
          cacheKey.startsWith(`${key}/`)
        ) {
          instance.delete(cacheKey)
        }
      }
    }
  }

  /**
   * Returns the cache value stored in the key within the instance. If the cached value is not present, an error is thrown.
   * @param key The key to search.
   */
  abstract get(key: string): Deferred<CacheData<Awaited<ReturnType<G>>>>

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
