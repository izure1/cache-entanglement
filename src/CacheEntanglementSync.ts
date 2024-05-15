import {
  CacheEntanglement,
  CacheGetter,
  CacheGetterParams,
  CacheState,
  DependencyMap,
} from './CacheEntanglement'
import { CacheData } from './CacheData'

export class CacheEntanglementSync<
  G extends CacheGetter<CacheState<D>>,
  D extends DependencyMap
> extends CacheEntanglement<G, D> {
  protected resolve(key: string, ...parameter: CacheGetterParams<G>): CacheData<Awaited<ReturnType<G>>> {
    const resolved: CacheState<D> = {} as any
    const dependencyKey = this.dependencyKey(key)
    for (const name in this.dependencyMap) {
      const dependency = this.dependencyMap[name] as unknown as CacheEntanglementSync<any, any>
      if (
        !Object.hasOwn(dependency.cacheMap, key) &&
        !Object.hasOwn(dependency.cacheMap, dependencyKey)
      ) {
        throw new Error(`The key '${key}' or '${dependencyKey}' has not been assigned yet in dependency '${name}'.`, {
          cause: {
            from: this
          }
        })
      }
      const dependencyValue = dependency.cacheMap[key] ?? dependency.cacheMap[dependencyKey]
      resolved[name as keyof D] = dependencyValue as any
    }
    this.parameterMap[key] = parameter
    const value = new CacheData(this.creation(key, resolved, ...parameter))
    this.cacheMap[key] = value
    return value
  }

  cache(key: string, ...parameter: CacheGetterParams<G>): CacheData<Awaited<ReturnType<G>>> {
    if (!Object.hasOwn(this.cacheMap, key)) {
      this.resolve(key, ...parameter)
    }
    return this.cacheMap[key]
  }

  update(key: string, ...parameter: CacheGetterParams<G>): CacheData<Awaited<ReturnType<G>>> {
    this.resolve(key, ...parameter)
    for (const t of this.assignments) {
      const instance = t as CacheEntanglementSync<any, any>
      for (const cacheKey in instance.cacheMap) {
        if (
          cacheKey === key ||
          cacheKey.startsWith(`${key}/`)
        ) {
          instance.update(cacheKey, ...instance.parameterMap[cacheKey])
        }
      }
    }
    return this.cacheMap[key]
  }
}
