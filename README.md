# cache-entanglement

[![](https://data.jsdelivr.com/v1/package/npm/cache-entanglement/badge)](https://www.jsdelivr.com/package/npm/cache-entanglement)
![Node.js workflow](https://github.com/izure1/cache-entanglement/actions/workflows/node.js.yml/badge.svg)

Manage caches that are dependent on each other efficiently.

```typescript
import { CacheEntanglementSync } from 'cache-entanglement'

const name = new CacheEntanglementSync((key, state, value: string) => {
  return value
}, {})

const age = new CacheEntanglementSync((key, state, value: number) => {
  return value
}, {})

const user = new CacheEntanglementSync((key, { name, age }, nameValue: string, ageValue: number) => {
  return {
    name: name.cache(key, nameValue),
    age: age.cache(key, ageValue),
  }
}, {
  name,
  age,
})
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

### Same cache key

Caches that are dependent on each other must have the same key. For example, let's say you have a **user** cache instance that caches user information, and this instance is dependent on a **name** cache instance that contains the user's name information. Here's what it looks like in code:

```typescript
const name = new CacheEntanglementSync((key) => {
  ...
}, {})

const user = new CacheEntanglementSync((key, { name }) => {
  ...
}, {
  name
})
```

In this case, if you want to cache the information of a user named **John**, both the **name** and **user** cache instances must use the same key. This allows the **user** instance, which depends on the **name** instance, to automatically update the same key value when the key value of the **name** instance is updated with a new value.

### Cache creation function

Most general cache libraries directly assign cache values to instances. However, this library does not directly enter values, but uses a cache creation function to generate cache values. It can be used as follows:

```typescript
class FileManager {
  constructor() {
    this.content = new CacheEntanglementAsync(async (key, state, path: string) => {
      return await fs.readFile(path)
    }, {})
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
    articleComments,
    articleContent,
  }
}, {
  articleComments,
  articleContent,
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

  const comments = articleComments.get(id)
  comments.push(comment)
  articleComments.update(id, comments)
}
```

## License

MIT LICENSE
