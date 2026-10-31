/**
 * Demo knobs for the simulated network, adjusted from the Inspector and sent
 * with each search so the backend can delay or fail on request. Off by
 * default, like the reference's backend: only real network time is paid.
 */
export const networkSettings = {
  minLatencyMs: 0,
  maxLatencyMs: 0,
  failureRate: 0,
}

export type NetworkSettings = typeof networkSettings

export const abortableSleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const id = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(id)
        reject(signal.reason)
      },
      { once: true },
    )
  })
