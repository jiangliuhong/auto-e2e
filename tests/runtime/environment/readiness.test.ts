import { describe, expect, it, vi, afterEach } from 'vitest'
import { probeOnce, waitForReady } from '../../../src/runtime/environment/readiness.js'

// mock 全局 fetch
const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

afterEach(() => {
  fetchMock.mockReset()
})

describe('probeOnce', () => {
  it('HTTP 200 视为就绪', async () => {
    fetchMock.mockResolvedValueOnce({ status: 200 })
    const r = await probeOnce('http://localhost:3000')
    expect(r.ok).toBe(true)
    expect(r.status).toBe(200)
    expect(r.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('HTTP 503 视为未就绪', async () => {
    fetchMock.mockResolvedValueOnce({ status: 503 })
    const r = await probeOnce('http://localhost:3000')
    expect(r.ok).toBe(false)
    expect(r.status).toBe(503)
  })

  it('fetch 抛错时返回 ok:false', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const r = await probeOnce('http://localhost:3000')
    expect(r.ok).toBe(false)
    expect(r.message).toContain('ECONNREFUSED')
  })
})

describe('waitForReady', () => {
  it('立即就绪时返回 ok', async () => {
    fetchMock.mockResolvedValue({ status: 200 })
    const r = await waitForReady('http://localhost:3000', { timeoutMs: 1000, intervalMs: 50 })
    expect(r.ok).toBe(true)
  })

  it('超时后返回 env_not_ready 错误(可恢复)', async () => {
    fetchMock.mockResolvedValue({ status: 503 })
    const r = await waitForReady('http://localhost:3000', { timeoutMs: 200, intervalMs: 50 })
    expect(r.ok).toBe(false)
    expect(r.error?.code).toBe('env_not_ready')
    expect(r.error?.recoverable).toBe(true)
  })

  it('前两次失败、第三次成功 → ok', async () => {
    fetchMock
      .mockResolvedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ status: 200 })
    const r = await waitForReady('http://localhost:3000', { timeoutMs: 2000, intervalMs: 10 })
    expect(r.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
