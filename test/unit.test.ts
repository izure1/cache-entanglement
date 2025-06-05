import {
  CacheEntanglementAsync,
  CacheEntanglementSync
} from 'cache-entanglement'

function delay(duration: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration)
  })
}

describe('unit', () => {
  const init = () => {
    const nickname = new CacheEntanglementAsync(async (key) => {
      return `user:${key}`
    }, {
      lifespan: '1m'
    })
    const index = new CacheEntanglementAsync(async (key, {}, i: number) => {
      return i
    }, {
      lifespan: '1m'
    })
    const user = new CacheEntanglementAsync(async (key, { nickname, index }) => {
      return {
        key,
        nickname: nickname.raw,
        index: index.raw,
      }
    }, {
      lifespan: '1m',
      dependencies: {
        nickname,
        index,
      },
    })
    const clear = () => {
      nickname.clear()
      index.clear()
      user.clear()
    }
    return {
      nickname,
      index,
      user,
      clear
    }
  }

  test('total', async () => {
    const { nickname, index, user, clear } = init()
    const key = 'izure'
    let i = 0

    await nickname.cache(key)
    await index.cache(key, i)

    expect((await user.cache(key)).raw).toEqual({
      key,
      nickname: 'user:izure',
      index: 0,
    })

    i++
    await delay(100)
    await index.update(key, i)

    expect(user.get(key).raw).toEqual({
      key,
      nickname: 'user:izure',
      index: 1,
    })

    clear()
  })

  test('exists', async () => {
    const { index, clear } = init()
    expect(index.exists('test')).toBeFalsy()
    await index.cache('test', 1)
    expect(index.exists('test')).toBeTruthy()
    clear()
  })

  test('delete', async () => {
    const { index, user, clear } = init()
    expect(index.exists('test')).toBeFalsy()
    await index.cache('test', 1)
    expect(index.exists('test')).toBeTruthy()
    index.delete('test')
    expect(index.exists('test')).toBeFalsy()
    expect(user.exists('test')).toBeFalsy()
    clear()
  })

  test('1:n update', async () => {
    const header = new CacheEntanglementAsync(async (key, state, value: string) => {
      return value
    }, {
      lifespan: '1m'
    })
    const body = new CacheEntanglementAsync(async (key, { header }, content: string) => {
      return {
        header: header.raw,
        content
      }
    }, {
      lifespan: '1m',
      dependencies: {
        header
      },
    })

    const prefix = 'user:john'
    await header.cache(`${prefix}`, 'john header')
    await body.cache(`${prefix}/1`, 'john content 1')
    await body.cache(`${prefix}/2`, 'john content 2')

    expect(body.get(`${prefix}/1`).raw).toEqual({
      header: 'john header',
      content: 'john content 1'
    })
    expect(body.get(`${prefix}/2`).raw).toEqual({
      header: 'john header',
      content: 'john content 2'
    })

    await header.update(`${prefix}`, 'lee header')
    expect(body.get(`${prefix}/1`).raw).toEqual({
      header: 'lee header',
      content: 'john content 1'
    })
    
    await body.update(`${prefix}/2`, 'john content 3')
    expect(body.get(`${prefix}/2`).raw).toEqual({
      header: 'lee header',
      content: 'john content 3'
    })
    
    await header.update(`${prefix}`, 'lee header 2')
    expect(body.get(`${prefix}/2`).raw).toEqual({
      header: 'lee header 2',
      content: 'john content 3'
    })

    header.clear()
    body.clear()
  })

  test('deep', () => {
    interface Employee {
      name: string
      companyName: string
    }

    const company = new CacheEntanglementSync((key, state, companyName: string) => {
      return companyName
    }, {
      lifespan: '1m'
    })
    
    const employee = new CacheEntanglementSync((key, { company }, name: string) => {
      const companyName = company.raw
      return {
        name,
        companyName,
      }
    }, {
      lifespan: '1m',
      dependencies: {
        company
      },
    })

    const card = new CacheEntanglementSync((key, { employee }, tel: string) => {
      return {
        ...employee.clone(),
        tel,
      }
    }, {
      lifespan: '1m',
      dependencies: {
        employee
      },
    })

    company.cache('github', 'Github')

    employee.cache('github/john', 'john')
    employee.cache('github/lee', 'lee')

    expect(employee.get('github/lee').raw).toEqual({
      name: 'lee',
      companyName: 'Github'
    })
    
    card.cache('github/john/card', 'xxx-xxxx-xxxx')

    expect(card.get('github/john/card').raw).toEqual({
      tel: 'xxx-xxxx-xxxx',
      name: 'john',
      companyName: 'Github'
    })

    company.update('github', 'Github.com')

    expect(card.get('github/john/card').raw).toEqual({
      tel: 'xxx-xxxx-xxxx',
      name: 'john',
      companyName: 'Github.com'
    })

    company.clear()
    employee.clear()
    card.clear()
  })

  test('before update', () => {
    const header = new CacheEntanglementSync((key, state, value: string) => {
      return value
    }, {
      lifespan: '1m'
    })

    const body = new CacheEntanglementSync((key, { header }, headerContent: string, bodyContent: string) => {
      return {
        header: header.raw,
        content: bodyContent
      }
    }, {
      lifespan: '1m',
      dependencies: {
        header
      },
      beforeUpdateHook: (key, dependencyKey, headerContent) => {
        header.cache(dependencyKey, headerContent)
      },
    })

    body.cache('content/1', 'article header', 'article content')
    expect(body.get('content/1').raw).toEqual({
      header: 'article header',
      content: 'article content'
    })

    body.update('content/1', 'article header after', 'article content after')
    expect(body.get('content/1').raw).toEqual({
      header: 'article header',
      content: 'article content after'
    })

    header.clear()
    body.clear()
  })
})
