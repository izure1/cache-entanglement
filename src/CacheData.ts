import ungapStructuredClone from '@ungap/structured-clone'

type CacheDataCloneStrategy = 'array-shallow-copy'|'object-shallow-copy'|'deep-copy'
type CacheDataCopy<T> = (raw: T) => T

export class CacheData<T> {
  protected static readonly StructuredClone = globalThis.structuredClone ?
    globalThis.structuredClone.bind(globalThis) : 
    ungapStructuredClone.bind(globalThis)
  
  private readonly _value: T
  
  constructor(value: T) {
    this._value = value
  }

  /**
   * This is cached data.
   * It was generated at the time of caching, so there is a risk of modification if it's an object due to shallow copying.
   * Therefore, if it's not a primitive type, please avoid using this value directly and use the `clone` method to use a copied version of the data.
   */
  get raw(): T {
    return this._value
  }

  /**
   * The method returns a copied value of the cached data.
   * You can pass a function as a parameter to copy the value. This parameter function should return the copied value.
   * 
   * If no parameter is passed, it defaults to using Javascript's or \@ungap/structured-clone's `structuredClone` function to copy the value.
   * If you prefer shallow copying instead of deep copying,
   * you can use the default options `array-shallow-copy`, `object-shallow-copy` and `deep-copy`,
   * which are replaced with functions to shallow copy arrays and objects, respectively. This is a syntactic sugar.
   * @param strategy The function that returns the copied value.
   * If you want to perform a shallow copy, simply pass the strings `array-shallow-copy` or `object-shallow-copy` for easy use.
   * The default is `structuredClone`.
   */
  clone(strategy: CacheDataCloneStrategy|CacheDataCopy<T> = 'deep-copy'): T {
    if (strategy && typeof strategy !== 'string') {
      return strategy(this.raw)
    }
    switch (strategy) {
      case 'array-shallow-copy':
        return <T>[].concat(this.raw as any)
      case 'object-shallow-copy':
        return Object.assign({}, this.raw)
      case 'deep-copy':
      default:
        return CacheData.StructuredClone(this.raw)
    }
  }
}
