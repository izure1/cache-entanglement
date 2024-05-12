import {
  CacheEntanglement,
  CacheGetter,
  CacheGetterParams,
  CacheState,
  DependencyMap,
} from './CacheEntanglement'

export class CacheEntanglementAsync<
  G extends CacheGetter<CacheState<D>>,
  D extends DependencyMap
> extends CacheEntanglement<G, D> {
  protected async resolve(key: string, ...parameter: CacheGetterParams<G>): Promise<Awaited<ReturnType<G>>> {
    const resolved: CacheState<D> = {} as any
    for (const name in this.dependencyMap) {
      const dependency = this.dependencyMap[name] as unknown as CacheEntanglementAsync<any, any>
      if (!Object.hasOwn(dependency.cacheMap, key)) {
        throw new Error(`The key '${key}' has not been assigned yet in dependency '${name}'.`, {
          cause: {
            from: this
          }
        })
      }
      const dependencyValue = dependency.cacheMap[key]
      resolved[name as keyof D] = dependencyValue
    }
    const value = await this.creation(key, resolved, ...parameter)
    this.cacheMap[key] = value
    return value
  }

  async cache(key: string, ...parameter: CacheGetterParams<G>): Promise<Awaited<ReturnType<G>>> {
    if (!Object.hasOwn(this.cacheMap, key)) {
      await this.resolve(key, ...parameter)
    }
    return this.cacheMap[key]
  }

  async update(key: string, ...parameter: CacheGetterParams<G>): Promise<Awaited<ReturnType<G>>> {
    await this.resolve(key, ...parameter)
    for (const instance of this.assignments.values()) {
      await instance.update(key, this.creation)
    }
    return this.cacheMap[key]
  }
}
