# cache-entanglement

[![](https://data.jsdelivr.com/v1/package/npm/cache-entanglement/badge)](https://www.jsdelivr.com/package/npm/cache-entanglement)
![Node.js workflow](https://github.com/izure1/cache-entanglement/actions/workflows/node.js.yml/badge.svg)

Manage caches that are dependent on each other efficiently.

```typescript
import { CacheEntanglementSync } from 'cache-entanglement'

const name = new CacheEntanglementSync((key, state, value: string) => {
  return value
})

const age = new CacheEntanglementSync((key, state, value: number) => {
  return value
})

const user = new CacheEntanglementSync((key, state) => {
  const { name, age } = state
  return {
    name: name.raw,
    age: age.raw,
  }
}, {
  dependencies: {
    name,
    age,
  }
})

name.cache('john', 'John')
age.cache('john', 20)
user.cache('john/user')


user.get('john/user').raw // { name: "John", age: 20 }
age.update('john', 21)
user.get('john/user').raw // { name: "John", age: 21 }
```

## Why do you use **cache-entanglement**?

Managing caches is not an easy task in complex applications. And caches often have dependencies where one cache references another cache. In this case, the logic to update all caches referencing a cache when that cache is updated is more complex than you might think.

The **cache-entanglement** library is designed to solve this problem.

## Installation

### Node.js

```bash
npm i cache-entanglement
```

```typescript
const {
  CacheEntanglementSync,
  CacheEntanglementAsync
} = require('cache-entanglement')
// or
import {
  CacheEntanglementSync,
  CacheEntanglementAsync
} from 'cache-entanglement'
```

### Browser (esm)

```typescript
import {
  CacheEntanglementSync,
  CacheEntanglementAsync
} 'https://cdn.jsdelivr.net/npm/cache-entanglement@1.x.x/+esm'
```

## Conceptualization

The **cache-entanglement** library is quite different from the usage of other cache libraries. It is designed to solve dependency problems between caches.

I will explain some of the features of this library in detail.

### Cache key naming convention

If the cache is dependent on another cache, the naming convention of the key must be followed to ensure correct operation.

For example, let's say you have caches that contain **company** and **employee** information, respectively.
**Employee** depends on the cache information of the **company** they belong to.

```typescript
const company = new CacheEntanglementSync((key, state, companyName: string) => {
  return companyName
})

const employee = new CacheEntanglementSync((key, { company }, name: string) => {
  ...
  const companyName = company.raw
  return {
    name,
    companyName,
  }
}, {
  dependencies: {
    company
  }
})
```

If the **company** name is **github**, the employee's name should have the structure **github/your-name**. Here's an example:

```typescript
company.cache('github', 'Github')

employee.cache('github/john', 'john')
employee.cache('github/lee', 'lee')

employee.get('github/lee') // { name: "lee", companyName: "Github" }
```

#### Why name it like this?

This is the process of letting the library know that the **github/lee** cache from the **employee** variable depends on the **github** cache from the **company** variable.

By creating it this way, when the github cache of the **company** instance is updated, all **employee** cache values that belong to **github/*** are updated.

If there is another cache instance that depends on the **employee**, append **/** after it.

```typescript
const card = new CacheEntanglementSync((key, { employee }, tel: string) => {
  return {
    ...employee.clone(),
    tel,
  }
}, {
  dependencies: {
    employee
  }
})

const johnCard = card.cache('github/john/card', 'xxx-xxxx-xxxx')
```

### Cache creation function

Most general cache libraries directly assign cache values to instances. However, this library does not directly enter values, but uses a cache creation function to generate cache values. It can be used as follows:

```typescript
class FileManager {
  constructor() {
    this.content = new CacheEntanglementAsync(async (key, state, path: string) => {
      return await fs.readFile(path)
    })
  }

  async getContent(path: string): Promise<string> {
    return await this.content.cache(`key:${path}`, path)
  }
}
```

When used this way, the first time the **getContent** method is called, the cache instance checks if there is a cache corresponding to the key and calls the creation function to cache the value if it does not exist.

After that, when the **getContent** method is called again, the value is already there, so it does not call the function again and returns the stored value.

### Dependency

Often, caches have dependencies on other caches that refer to them. When a cache that has a dependency on another cache is updated, the cache that refers to it should also be updated. In this library, the dependency of a cache can be expressed as follows:

```typescript
const articleComments = new CacheEntanglementSync((key, state, comments: string[]) => {
  return comments
}, {})

const articleContent = new CacheEntanglementSync((key, state, content: string) => {
  return content
}, {})

const article = new CacheEntanglementSync((key, {
  articleComments,
  articleContent,
}) => {
  return {
    articleComments: articleComments.raw,
    articleContent: articleContent.raw,
  }
}, {
  dependencies: {
    articleComments,
    articleContent,
  }
})

function postArticle(content: string) {
  const id = uuid()

  // Caches with dependencies should be updated first.
  articleComments.cache(id, [])
  articleContent.cache(id, content)
  
  article.cache(id)
}

function addComment(id: string, comment: string) {
  if (!articleComments.exists(id)) {
    throw new Error(`article '${id}' is not existing.`)
  }

  const comments = articleComments.get(id).clone('array-shallow-copy')
  comments.push(comment)
  articleComments.update(id, comments)
}
```

### Cache Lifespan

Caches are stored in the computer's memory. They persist until they are explicitly removed using the `instance.clear()` or `instance.delete(key)` methods, or until they are garbage collected by the JavaScript engine once they are no longer referenced. Therefore, you generally don't need to worry about memory leaks.

Even if a cache entry is removed (either manually or through garbage collection), it will be automatically regenerated the next time `instance.cache(key, ...params)` is called for that specific key. This ensures that accessing the cache via the `.cache()` method is effectively "null safe", as it will always return a valid cache entry (either existing or newly created).

#### About lifespan option

You can set the cache lifespan using the `lifespan` option in the constructor. The lifespan can be specified in milliseconds (e.g., `1000 * 60 * 5`) or as a duration string (e.g., `'5m'`, `'1s'`).

The `lifespan` option provides a guarantee that a cache entry will **not** be eligible for garbage collection for the specified duration, calculated from its last access via `cache`. This means the library actively protects the cache entry from being removed by the JavaScript engine's garbage collector during this period.

Furthermore, if you call `cache()` or `update()` on an existing cache entry, its lifespan is reset and extended from that point of interaction. When the guaranteed lifespan expires, the cache entry is **not** automatically deleted by the library. Instead, it simply means the library no longer actively prevents it from being garbage collected. The actual removal then depends on the JavaScript environment's garbage collection cycles and memory pressure. Consequently, a cache entry might persist in memory for longer than its specified lifespan if it's still referenced or if the garbage collector doesn't reclaim it immediately.

If a cache entry's lifespan has passed and it has been garbage collected (or if it was never created), the next time `instance.cache(key, ...params)` is called for that key, the cache creation function will be invoked to (re)generate the entry.

Here's how you can use it:

```typescript
const myCache = new CacheEntanglementSync((key, state, value: string) => {
  return value
}, {
  lifespan: 1000 * 60 * 5 // or '5m'
})

myCache.cache('my-key', 'my-value')

// For the next 5 minutes, 'my-key' is guaranteed not to be garbage collected.
// After 5 minutes, it becomes eligible for garbage collection if not otherwise referenced,
// but its actual removal time depends on the GC.
```

The following example illustrates the behavior when a cache entry is accessed after its guaranteed lifespan might have allowed it to be garbage collected:

```typescript
const myCache = new CacheEntanglementSync((key, state, value: string) => {
  console.log('creating cache for', key)
  return value
}, {
  lifespan: 1000 // or '1s'
})

myCache.cache('my-key', 'my-value') // logs "creating cache for my-key"

setTimeout(() => {
  myCache.cache('my-key') // Access within 1s: Cache is still protected, no re-creation log.
}, 500)

setTimeout(() => {
  // Access after 1.5s: The 1-second guaranteed lifespan has passed.
  // The cache entry for 'my-key' might have been garbage collected.
  // If so, cache() will trigger re-creation.
  myCache.cache('my-key') // Assuming re-creation: logs "creating cache for my-key" again
}, 1500)
```

## Using beforeUpdateHook

This can be used in the constructor function, and it is called when the cache is created or updated. For example, when the following code is executed, the console output will appear in the following order.

```typescript
const myCache = new CacheEntanglementSync((key, state, myArg) => {
  console.log('created!')
}, {
  // Use beforeUpdateHook option
  beforeUpdateHook: (key, dependencyKey, myArg) => {
    console.log('key', key)
    console.log('dependency key', dependencyKey)
    console.log('my argument', myArg)
  }
})

myCache.cache('my/test', 123)
```

```bash
log: "key" "my/test"
log: "dependency key" "my"
log: "my argument" 123
log: "created!"
```

Such update hooks can be used to "safely assign" dependent caches in a bottom-up reverse order. See the following example.

```typescript
const name = new CacheEntanglementSync((key, state, name: string) => {
  return name
})

const age = new CacheEntanglementSync((key, state, age: number) => {
  return age
})

const user = new CacheEntanglementSync((key, state, _name: string, _age: number) => {
  const name = state.name.clone()
  const age = state.age.clone()
  return {
    name,
    age,
  }
}, {
  dependencies: {
    name,
    age,
  },
  beforeUpdateHook: (key, dependencyKey, _name, _age) => {
    name.cache(key, _name)
    age.cache(key, _age)
  },
})

user.cache('john', 'john', 20)
```

This example demonstrates how to create the **user** cache without first generating the dependent caches, **name** and **age**. The **beforeUpdateHook** function attempts to create the dependent caches first, and if they already exist, they won't be created again.

Note: Do not use the cache's **update** method inside the **beforeUpdateHook** function, as it may cause recursion and break your application.

## With TypeScript

```typescript
import { CacheEntanglementSync } from 'cache-entanglement'

class MyClass {
  private readonly _myCache: ReturnType<MyClass['_createMyCache']>

  constructor() {
    this._myCache = this._createMyCache()
  }

  private _createMyCache() {
    return new CacheEntanglementSync((key, state) => {
      ...
    })
  }
}
```

## License

MIT LICENSE
