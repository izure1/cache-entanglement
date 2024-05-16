import {
  CacheEntanglementAsync,
  CacheEntanglementSync
} from '..'

function delay(duration: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration)
  })
}

describe('unit', () => {
  const init = () => {
    const nickname = new CacheEntanglementAsync(async (key) => {
      return `user:${key}`
    }, {})
    const index = new CacheEntanglementAsync(async (key, {}, i: number) => {
      return i
    }, {})
    const user = new CacheEntanglementAsync(async (key, { nickname, index }) => {
      return {
        key,
        nickname: nickname.raw,
        index: index.raw,
      }
    }, {
      nickname,
      index,
    })
    return {
      nickname,
      index,
      user,
    }
  }

  test('total', async () => {
    const { nickname, index, user } = init()
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
  })

  test('exists', async () => {
    const { index } = init()
    expect(index.exists('test')).toBeFalsy()
    await index.cache('test', 1)
    expect(index.exists('test')).toBeTruthy()
  })

  test('delete', async () => {
    const { index } = init()
    expect(index.exists('test')).toBeFalsy()
    await index.cache('test', 1)
    expect(index.exists('test')).toBeTruthy()
    index.delete('test')
    expect(index.exists('test')).toBeFalsy()
  })

  test('1:n update', async () => {
    const header = new CacheEntanglementAsync(async (key, state, value: string) => {
      return value
    })
    const body = new CacheEntanglementAsync(async (key, { header }, content: string) => {
      return {
        header: header.raw,
        content
      }
    }, {
      header
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
  })

  test('deep', () => {
    interface Employee {
      name: string
      companyName: string
    }

    const company = new CacheEntanglementSync((key, state, companyName: string) => {
      return companyName
    })
    
    const employee = new CacheEntanglementSync((key, { company }, name: string) => {
      const companyName = company.raw
      return {
        name,
        companyName,
      }
    }, {
      company
    })

    const card = new CacheEntanglementSync((key, { employee }, tel: string) => {
      return {
        ...employee.clone(),
        tel,
      }
    }, {
      employee
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
  })

  test('before update', () => {
    const header = new CacheEntanglementSync((key, state, value: string) => {
      return value
    })

    const body = new CacheEntanglementSync((key, { header }, headerContent: string, bodyContent: string) => {
      return {
        header: header.raw,
        content: bodyContent
      }
    }, {
      header
    }, (key, dependencyKey, headerContent) => {
      header.cache(dependencyKey, headerContent)
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
  })
})
