// Times the built SSR handler in Node (Workers freeze clocks during CPU work,
// so in-Worker timing cannot see render cost). Usage:
//   node scripts/profile-ssr.mjs [path] [iterations]
import { handleRequest } from '../dist/server/server.js'

const path = process.argv[2] ?? '/?q=sunbeam'
const iterations = Number(process.argv[3] ?? 200)

const once = async () => {
  const start = performance.now()
  const response = await handleRequest(new Request(`http://localhost${path}`, { headers: { accept: 'text/html' } }))
  const reader = response.body.getReader()
  let firstChunk
  let bytes = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    firstChunk ??= performance.now() - start
    bytes += value.length
  }
  return { firstChunk, total: performance.now() - start, bytes }
}

for (let i = 0; i < 30; i++) await once() // warm the JIT, like a warm isolate
const runs = []
for (let i = 0; i < iterations; i++) runs.push(await once())
const median = key => runs.map(r => r[key]).sort((a, b) => a - b)[Math.floor(runs.length / 2)]
console.log(path, { firstChunkMs: +median('firstChunk').toFixed(2), totalMs: +median('total').toFixed(2), bytes: median('bytes') })
