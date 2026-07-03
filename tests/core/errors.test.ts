import { describe, expect, it } from 'vitest'
import { notImplementedError, runtimeError } from '../../src/core/errors.js'

describe('runtimeError', () => {
  it('构造包含必需字段的错误', () => {
    const err = runtimeError({ code: 'env_not_ready', message: 'not ready' })
    expect(err).toEqual({ code: 'env_not_ready', message: 'not ready', recoverable: false })
  })

  it('默认 recoverable 为 false,显式传入时生效', () => {
    expect(runtimeError({ code: 'x', message: 'm', recoverable: true }).recoverable).toBe(true)
  })

  it('可选字段仅在提供时出现(exact optional)', () => {
    const withDetails = runtimeError({ code: 'x', message: 'm', details: { a: 1 }, cause: 'root' })
    expect(withDetails.details).toEqual({ a: 1 })
    expect(withDetails.cause).toBe('root')
  })
})

describe('notImplementedError', () => {
  it('携带固定 code 与 capability', () => {
    const err = notImplementedError('observer')
    expect(err.code).toBe('not_implemented')
    expect(err.recoverable).toBe(false)
    expect(err.details).toEqual({ capability: 'observer' })
  })
})
