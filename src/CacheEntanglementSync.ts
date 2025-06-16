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

  protected recache(key: string): CacheData<Awaited<ReturnType<G>>>|undefined {
    if (!this.parameters.has(key)) {
      return
    }
    if (!this.caches.has(key) || this.updateRequirements.has(key)) {
      this.resolve(key, ...this.parameters.get(key)!)
    }
    return this.caches.get(key)!
  }

  protected resolve(key: string, ...parameter: CacheGetterParams<G>): CacheData<Awaited<ReturnType<G>>> {
    const resolved: DependencyCacheData<D> = {} as any
    const dependencyKey = this.dependencyKey(key)
    this.beforeUpdateHook(key, dependencyKey, ...parameter)
    for (let i = 0, len = this.dependencyProperties.length; i < len; i++) {
      const name = this.dependencyProperties[i]
      const dependency = this.dependencies[name] as unknown as CacheEntanglementSync<any, any>
      if (
        !dependency.exists(key) &&
        !dependency.exists(dependencyKey)
      ) {
        throw new Error(`The key '${key}' or '${dependencyKey}' has not been assigned yet in dependency '${name.toString()}'.`, {
          cause: {
            from: this
          }
        })
      }
      const dependencyValue = dependency.recache(key) ?? dependency.recache(dependencyKey)
      resolved[name as keyof D] = dependencyValue as any
    }
    const value = new CacheData(this.creation(key, resolved, ...parameter))
    this.updateRequirements.delete(key)
    this.parameters.set(key, parameter)
    this.caches.set(key, value)
    return value
  }

  get(key: string): CacheData<Awaited<ReturnType<G>>> {
    if (!this.parameters.has(key)) {
      throw new Error(`Cache value not found: ${key}`)
    }
    return this.cache(key, ...this.parameters.get(key)!)
  }

  cache(key: string, ...parameter: CacheGetterParams<G>): CacheData<Awaited<ReturnType<G>>> {
    if (!this.caches.has(key) || this.updateRequirements.has(key)) {
      this.resolve(key, ...parameter)
    }
    else {
      this.caches.extendExpire(key)
    }
    return this.caches.get(key)!
  }

  update(key: string, ...parameter: CacheGetterParams<G>): CacheData<Awaited<ReturnType<G>>> {
    this.bubbleUpdateSignal(key)
    this.resolve(key, ...parameter)
    return this.caches.get(key)!
  }
}
