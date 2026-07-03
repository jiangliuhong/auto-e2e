import { describe, expect, it } from 'vitest'
import { toRuntimeError } from '../../src/utils/errors.js'

describe('toRuntimeError', () => {
  it('转换 Error 实例,提取 message 与 cause', () => {
    const err = toRuntimeError(new Error('boom'), { code: 'x' })
    expect(err.code).toBe('x')
    expect(err.message).toBe('boom')
    expect(err.cause).toBe('boom')
  })

  it('转换字符串错误', () => {
    const err = toRuntimeError('fail', { code: 'y' })
    expect(err.message).toBe('fail')
    expect(err.cause).toBe('fail')
  })

  it('转换对象错误(JSON 序列化)', () => {
    const err = toRuntimeError({ weird: true }, {})
    expect(err.message).toBe('{"weird":true}')
    // 非 string/Error 不写 cause
    expect(err.cause).toBeUndefined()
  })

  it('透传 recoverable 与 details', () => {
    const err = toRuntimeError(new Error('e'), { recoverable: true, details: { k: 1 } })
    expect(err.recoverable).toBe(true)
    expect(err.details).toEqual({ k: 1 })
  })

  it('使用自定义 message 覆盖原始 message', () => {
    const err = toRuntimeError(new Error('inner'), { message: 'outer' })
    expect(err.message).toBe('outer')
    expect(err.cause).toBe('inner')
  })
})
