// Counts the application code of each implementation the same way, for the
// Code table on /compare: non-blank lines under src/, split into app code
// (TS/TSX) and style code, excluding tests, fixtures, Story files, the shared
// 556-entry TLD list, and generated files.
//
//   node scripts/count-lines.mjs [solid-dir] [foldkit-dir] [plus-dir]
//
// solid-dir defaults to this repository. foldkit-dir is a checkout of
// https://github.com/foldkit/foldkit-domains; plus-dir is
// examples/foldkit/domains-plus in https://github.com/doeixd/foldkit-plus.
// Either may be left out.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const [solidDir = fileURLToPath(new URL('..', import.meta.url)), foldkitDir, plusDir] = process.argv.slice(2)

const excluded = path =>
  /\.(test|spec|fixture)\.tsx?$/.test(path) ||
  /\.story\./.test(path) ||
  path.split('/').includes('story') ||
  /(^|\/)tld\.ts$/.test(path) ||
  /(^|\/)vitest-setup\.ts$/.test(path)

// Per app: files that are not application code of the kind compared.
const extra = {
  // The comparison page itself; the Foldkit apps have no equivalent of it.
  solid: path => /(^|\/)(Compare\.tsx|comparison\.ts|compare\.css)$/.test(path),
  foldkit: () => false,
  // Lucide's paths, written from icons.json by `pnpm icons`.
  plus: path => /(^|\/)iconData\.ts$/.test(path),
}

// Foldkit Plus has no CSS file: its look is style.ts, foldkit-mixins Style
// code, which is TypeScript and counted as style code.
const kindOf = path =>
  /\.css$/.test(path) ? 'style' : /(^|\/)style\.ts$/.test(path) ? 'style' : /\.tsx?$/.test(path) ? 'app' : null

const walk = dir =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  )

const nonBlank = file => readFileSync(file, 'utf8').split(/\r?\n/).filter(line => line.trim() !== '').length

const count = (name, dir) => {
  const totals = { app: 0, style: 0 }
  const files = []
  for (const file of walk(join(dir, 'src'))) {
    const path = relative(dir, file).split(sep).join('/')
    const kind = kindOf(path)
    if (!kind || excluded(path) || extra[name](path)) continue
    const lines = nonBlank(file)
    totals[kind] += lines
    files.push({ path, kind, lines })
  }
  return { totals, files }
}

const apps = { solid: solidDir, foldkit: foldkitDir, plus: plusDir }
for (const [name, dir] of Object.entries(apps)) {
  if (!dir) continue
  const { totals, files } = count(name, dir)
  console.log(`\n${name}: ${totals.app} app lines, ${totals.style} style lines (${dir})`)
  if (process.env.VERBOSE) for (const f of files) console.log(`  ${String(f.lines).padStart(5)} ${f.kind.padEnd(5)} ${f.path}`)
}
