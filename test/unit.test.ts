import { CacheEntanglementAsync } from '..'

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
})
