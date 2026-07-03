import { describe, expect, it } from 'vitest'
import { createId, createObservationId, createRunId } from '../../src/utils/id.js'

describe('createId', () => {
  it('生成带前缀和 3 位补零编号的 id', () => {
    expect(createId('x')).toMatch(/^x_\d{3}$/)
  })

  it('连续调用编号递增', () => {
    const a = createId('t')
    const b = createId('t')
    const na = Number(a.split('_')[1])
    const nb = Number(b.split('_')[1])
    expect(nb).toBe(na + 1)
  })
})

describe('便捷工厂', () => {
  it('createObservationId 使用 obs 前缀', () => {
    expect(createObservationId()).toMatch(/^obs_\d{3}$/)
  })
  it('createRunId 使用 run 前缀', () => {
    expect(createRunId()).toMatch(/^run_\d{3}$/)
  })
})
