import {
  BeforeUpdateHookSync,
  CacheEntanglement,
  CacheGetter,
  CacheGetterParams,
  DependencyCacheData,
  DependencyMap,
} from './CacheEntanglement'
import { CacheData } from './CacheData'

export class CacheEntanglementSync<
  G extends CacheGetter<DependencyCacheData<D>>,
  D extends DependencyMap
> extends CacheEntanglement<G, D> {
  declare protected readonly beforeUpdateHook: BeforeUpdateHookSync<G, D>

  constructor(
    creation: G,
    dependencyMap?: D,
    beforeUpdateHook?: BeforeUpdateHookSync<G, D>
  ) {
    super(creation, dependencyMap, beforeUpdateHook)
  }

  protected resolve(key: string, ...parameter: CacheGetterParams<G>): CacheData<Awaited<ReturnType<G>>> {
    const resolved: DependencyCacheData<D> = {} as any
    const dependencyKey = this.dependencyKey(key)
    this.beforeUpdateHook(key, dependencyKey, ...parameter)
    for (const name in this.dependencyMap) {
      const dependency = this.dependencyMap[name] as unknown as CacheEntanglementSync<any, any>
      if (
        !dependency.cacheMap.has(key) &&
        !dependency.cacheMap.has(dependencyKey)
      ) {
        throw new Error(`The key '${key}' or '${dependencyKey}' has not been assigned yet in dependency '${name}'.`, {
          cause: {
            from: this
          }
        })
      }
      const dependencyValue = dependency.cacheMap.get(key) ?? dependency.cacheMap.get(dependencyKey)
      resolved[name as keyof D] = dependencyValue as any
    }
    this.parameterMap[key] = parameter
    const value = new CacheData(this.creation(key, resolved, ...parameter))
    this.cacheMap.set(key, value)
    return value
  }

  cache(key: string, ...parameter: CacheGetterParams<G>): CacheData<Awaited<ReturnType<G>>> {
    if (!this.cacheMap.has(key)) {
      this.resolve(key, ...parameter)
    }
    return this.cacheMap.get(key)!
  }

  update(key: string, ...parameter: CacheGetterParams<G>): CacheData<Awaited<ReturnType<G>>> {
    this.resolve(key, ...parameter)
    for (const t of this.assignments) {
      const instance = t as CacheEntanglementSync<any, any>
      for (const cacheKey of instance.cacheMap.keys()) {
        if (
          cacheKey === key ||
          cacheKey.startsWith(`${key}/`)
        ) {
          instance.update(cacheKey, ...instance.parameterMap[cacheKey])
        }
      }
    }
    return this.cacheMap.get(key)!
  }
}
