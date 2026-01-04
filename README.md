# cache-entanglement

[![](https://data.jsdelivr.com/v1/package/npm/cache-entanglement/badge)](https://www.jsdelivr.com/package/npm/cache-entanglement)
![Node.js workflow](https://github.com/izure1/cache-entanglement/actions/workflows/node.js.yml/badge.svg)

Efficiently manage interconnected caches with automatic dependency tracking and updates.

## ✨ Features

* Declare dependencies between caches
* Automatic invalidation and updates
* Sync and async cache creation functions
* Key-based namespace resolution
* Cache capacity and LRU (Least Recently Used) management

## 🚀 Quick Start

```typescript
import { CacheEntanglementSync } from 'cache-entanglement'

const name = new CacheEntanglementSync((key, state, value: string) => value)
const age = new CacheEntanglementSync((key, state, value: number) => value)

const user = new CacheEntanglementSync((key, state) => {
  const { name, age } = state
  return { name: name.raw, age: age.raw }
}, {
  dependencies: { name, age },
})

name.cache('john', 'John')
age.cache('john', 20)
user.cache('john/user')

user.get('john/user').raw // { name: 'John', age: 20 }
age.update('john', 21)
user.get('john/user').raw // { name: 'John', age: 21 }
```

## 📦 Installation

### Node.js

```bash
npm i cache-entanglement
```

```typescript
// CommonJS
const { CacheEntanglementSync, CacheEntanglementAsync } = require('cache-entanglement')

// ESM
import { CacheEntanglementSync, CacheEntanglementAsync } from 'cache-entanglement'
```

### Browser (ESM)

```typescript
import { CacheEntanglementSync, CacheEntanglementAsync } from 'https://cdn.jsdelivr.net/npm/cache-entanglement@1.x.x/+esm'
```

## 📚 How It Works

### Key Naming Convention for Dependencies

Keys must reflect their dependency path. For example:

```typescript
const company = new CacheEntanglementSync((key, state, name: string) => name)

const employee = new CacheEntanglementSync((key, { company }, name: string) => {
  return { name, companyName: company.raw }
}, {
  dependencies: { company },
})

company.cache('github', 'GitHub')
employee.cache('github/john', 'John')
```

By naming the employee key as `github/john`, it indicates dependency on the `github` key from the `company` cache. Updates to `company:github` automatically propagate.

You can continue chaining dependencies:

```typescript
const card = new CacheEntanglementSync((key, { employee }, tel: string) => ({
  ...employee.clone(),
  tel,
}), {
  dependencies: { employee },
})

card.cache('github/john/card', 'xxx-xxxx-xxxx')
```

### Async Cache Example

```typescript
class FileManager {
  constructor() {
    this.content = new CacheEntanglementAsync(async (key, state, path: string) => {
      return await fs.readFile(path)
    })
  }

  async getContent(path: string) {
    return await this.content.cache(`key:${path}`, path)
  }
}
```

## 🔁 Handling Dependencies

```typescript
const articleComments = new CacheEntanglementSync((key, state, comments: string[]) => comments)
const articleContent = new CacheEntanglementSync((key, state, content: string) => content)

const article = new CacheEntanglementSync((key, state) => {
  return {
    articleComments: state.articleComments.raw,
    articleContent: state.articleContent.raw,
  }
}, {
  dependencies: { articleComments, articleContent },
})

function postArticle(content: string) {
  const id = uuid()
  articleComments.cache(id, [])
  articleContent.cache(id, content)
  article.cache(id)
}

function addComment(id: string, comment: string) {
  if (!articleComments.exists(id)) throw new Error(`Missing article: ${id}`)
  const comments = articleComments.get(id).clone('array-shallow-copy')
  comments.push(comment)
  articleComments.update(id, comments)
}
```

## 🧠 Cache Capacity & LRU (Least Recently Used)

Instances manage cache values using a **Least Recently Used (LRU)** strategy. If the number of cached items exceeds the `capacity`, the oldest accessed entries are automatically removed.

```typescript
const cache = new CacheEntanglementSync((key, state, value: string) => value, {
  capacity: 500 // Limit to 500 entries (Default: 100)
})

cache.cache('my-key', 'hello')
```

This approach ensures stable memory usage and prevents the "infinite growth" problem, providing a better runtime experience than time-based expiration.

## 🚀 Migration Guide (lifespan → capacity)

The `lifespan` option has been removed to improve reliability and prevent unexpected process hangs caused by `setTimeout`.

### Before
```typescript
const cache = new CacheEntanglementSync(getter, { lifespan: '5m' })
```

### After
Use the `capacity` option to limit memory usage based on the number of entries.
```typescript
const cache = new CacheEntanglementSync(getter, { capacity: 100 })
```

> [!IMPORTANT]
> Since entries no longer "expire" based on time, they will remain in memory until the `capacity` is reached or they are manually deleted.

## 🪝 beforeUpdateHook

A hook you can use to pre-assign dependencies from within the parent:

```typescript
const user = new CacheEntanglementSync((key, state, _name, _age) => {
  return {
    name: state.name.clone(),
    age: state.age.clone(),
  }
}, {
  dependencies: { name, age },
  beforeUpdateHook: (key, dependencyKey, _name, _age) => {
    name.cache(key, _name)
    age.cache(key, _age)
  }
})

user.cache('john', 'John', 20)
```

⚠️ Avoid using `.update()` within `beforeUpdateHook` to prevent recursion.

## 🧩 TypeScript Usage

```typescript
import { CacheEntanglementSync } from 'cache-entanglement'

class MyClass {
  private readonly _myCache = new CacheEntanglementSync((key, state) => {
    // your logic
  })
}
```

## License

MIT
