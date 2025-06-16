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

  protected async recache(key: string): Promise<CacheData<Awaited<ReturnType<G>>>|undefined> {
    if (!this.parameters.has(key)) {
      return
    }
    if (!this.caches.has(key) || this.updateRequirements.has(key)) {
      await this.resolve(key, ...this.parameters.get(key)!)
    }
    return this.caches.get(key)!
  }

  protected async resolve(key: string, ...parameter: CacheGetterParams<G>): Promise<CacheData<Awaited<ReturnType<G>>>> {
    const resolved: DependencyCacheData<D> = {} as any
    const dependencyKey = this.dependencyKey(key)
    await this.beforeUpdateHook(key, dependencyKey, ...parameter)
    for (let i = 0, len = this.dependencyProperties.length; i < len; i++) {
      const name = this.dependencyProperties[i]
      const dependency = this.dependencies[name] as unknown as CacheEntanglementAsync<any, any>
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
      const dependencyValue = await dependency.recache(key) ?? await dependency.recache(dependencyKey)
      resolved[name as keyof D] = dependencyValue as any
    }
    const value = new CacheData(await this.creation(key, resolved, ...parameter))
    this.updateRequirements.delete(key)
    this.parameters.set(key, parameter)
    this.caches.set(key, value)
    return value
  }

  async get(key: string): Promise<CacheData<Awaited<ReturnType<G>>>> {
    if (!this.parameters.has(key)) {
      throw new Error(`Cache value not found: ${key}`)
    }
    return this.cache(key, ...this.parameters.get(key)!)
  }

  async cache(key: string, ...parameter: CacheGetterParams<G>): Promise<CacheData<Awaited<ReturnType<G>>>> {
    if (!this.caches.has(key) || this.updateRequirements.has(key)) {
      await this.update(key, ...parameter)
    }
    else {
      this.caches.extendExpire(key)
    }
    return this.caches.get(key)!
  }

  async update(key: string, ...parameter: CacheGetterParams<G>): Promise<CacheData<Awaited<ReturnType<G>>>> {
    this.bubbleUpdateSignal(key)
    await this.resolve(key, ...parameter)
    return this.caches.get(key)!
  }
}
