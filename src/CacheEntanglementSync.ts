import {
  BeforeUpdateHookSync,
  CacheEntanglement,
  CacheEntanglementConstructorOption,
  CacheGetter,
  CacheGetterParams,
  DependencyCacheData,
  DependencyMap,
} from './CacheEntanglement'
import { CacheData } from './CacheData'

export class CacheEntanglementSync<
  D extends DependencyMap,
  G extends CacheGetter<DependencyCacheData<D>>
> extends CacheEntanglement<D, G> {
  declare protected readonly beforeUpdateHook: BeforeUpdateHookSync<D, G>

  constructor(
    creation: G,
    option?: CacheEntanglementConstructorOption<D, G>
  ) {
    super(creation, option)
  }

  protected resolve(key: string, ...parameter: CacheGetterParams<G>): CacheData<Awaited<ReturnType<G>>> {
    const resolved: DependencyCacheData<D> = {} as any
    const dependencyKey = this.dependencyKey(key)
    this.beforeUpdateHook(key, dependencyKey, ...parameter)
    for (let i = 0, len = this.dependencyProperties.length; i < len; i++) {
      const name = this.dependencyProperties[i]
      const dependency = this.dependencies[name] as unknown as CacheEntanglementSync<any, any>
      if (
        !dependency.caches.has(key) &&
        !dependency.caches.has(dependencyKey)
      ) {
        throw new Error(`The key '${key}' or '${dependencyKey}' has not been assigned yet in dependency '${name.toString()}'.`, {
          cause: {
            from: this
          }
        })
      }
      const dependencyValue = dependency.caches.get(key) ?? dependency.caches.get(dependencyKey)
      resolved[name as keyof D] = dependencyValue as any
    }
    this.parameters[key] = parameter
    const value = new CacheData(this.creation(key, resolved, ...parameter))
    this.caches.set(key, value)
    return value
  }

  cache(key: string, ...parameter: CacheGetterParams<G>): CacheData<Awaited<ReturnType<G>>> {
    if (!this.caches.has(key)) {
      this.update(key, ...parameter)
    }
    else {
      this.caches.extendExpire(key)
    }
    return this.caches.get(key)!
  }

  update(key: string, ...parameter: CacheGetterParams<G>): CacheData<Awaited<ReturnType<G>>> {
    this.resolve(key, ...parameter)
    for (let i = 0, len = this.assignments.length; i < len; i++) {
      const t = this.assignments[i]
      const instance = t as CacheEntanglementSync<any, any>
      for (const cacheKey of instance.caches.keys()) {
        if (
          cacheKey === key ||
          cacheKey.startsWith(`${key}/`)
        ) {
          instance.update(cacheKey, ...instance.parameters[cacheKey])
        }
      }
    }
    return this.caches.get(key)!
  }

  delete(key: string): void {
    this.caches.delete(key)
    for (let i = 0, len = this.assignments.length; i < len; i++) {
      const t = this.assignments[i]
      const instance = t as CacheEntanglementSync<any, any>
      for (const cacheKey of instance.caches.keys()) {
        if (
          cacheKey === key ||
          cacheKey.startsWith(`${key}/`)
        ) {
          instance.delete(cacheKey)
        }
      }
    }
  }
}
