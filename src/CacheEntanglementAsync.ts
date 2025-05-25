import {
  BeforeUpdateHookAsync,
  CacheEntanglement,
  CacheEntanglementConstructorOption,
  CacheGetter,
  CacheGetterParams,
  DependencyCacheData,
  DependencyMap,
} from './CacheEntanglement'
import { CacheData } from './CacheData'

export class CacheEntanglementAsync<
  D extends DependencyMap,
  G extends CacheGetter<DependencyCacheData<D>>
> extends CacheEntanglement<D, G> {
  declare protected readonly beforeUpdateHook: BeforeUpdateHookAsync<D, G>

  constructor(
    creation: G,
    option?: CacheEntanglementConstructorOption<D, G>
  ) {
    super(creation, option)
  }

  protected async resolve(key: string, ...parameter: CacheGetterParams<G>): Promise<CacheData<Awaited<ReturnType<G>>>> {
    const resolved: DependencyCacheData<D> = {} as any
    const dependencyKey = this.dependencyKey(key)
    await this.beforeUpdateHook(key, dependencyKey, ...parameter)
    for (const name in this.dependencies) {
      const dependency = this.dependencies[name] as unknown as CacheEntanglementAsync<any, any>
      if (
        !dependency.caches.has(key) &&
        !dependency.caches.has(dependencyKey)
      ) {
        throw new Error(`The key '${key}' or '${dependencyKey}' has not been assigned yet in dependency '${name}'.`, {
          cause: {
            from: this
          }
        })
      }
      const dependencyValue = dependency.caches.get(key) ?? dependency.caches.get(dependencyKey)
      resolved[name as keyof D] = dependencyValue as any
    }
    this.parameters[key] = parameter
    const value = new CacheData(await this.creation(key, resolved, ...parameter))
    this.caches.set(key, value)
    return value
  }

  async cache(key: string, ...parameter: CacheGetterParams<G>): Promise<CacheData<Awaited<ReturnType<G>>>> {
    if (!this.caches.has(key)) {
      await this.resolve(key, ...parameter)
    }
    return this.caches.get(key)!
  }

  async update(key: string, ...parameter: CacheGetterParams<G>): Promise<CacheData<Awaited<ReturnType<G>>>> {
    await this.resolve(key, ...parameter)
    for (const t of this.assignments) {
      const instance = t as CacheEntanglementAsync<any, any>
      for (const cacheKey of instance.caches.keys()) {
        if (
          cacheKey === key ||
          cacheKey.startsWith(`${key}/`)
        ) {
          await instance.update(cacheKey, ...instance.parameters[cacheKey])
        }
      }
    }
    return this.caches.get(key)!
  }
}
