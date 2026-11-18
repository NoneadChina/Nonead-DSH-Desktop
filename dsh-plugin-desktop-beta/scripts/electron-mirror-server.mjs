// Serves a local mirror of the Electron release assets for @electron/get.
// Usage: node scripts/electron-mirror-server.mjs <root> <port>
// The root directory must contain <tag>/<file> entries (e.g. v44.0.0/electron-v44.0.0-win32-x64.zip
// and v44.0.0/SHASUMS256.txt), so ELECTRON_MIRROR=http://127.0.0.1:<port>/ resolves.
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

const [rootArg, portArg] = process.argv.slice(2)
const root = resolve(rootArg ?? '.')
const port = Number(portArg ?? 8791)
const types = {
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
  const relative = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '')
  const file = join(root, relative)
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end('not found')
    return
  }
  const { size } = statSync(file)
  res.writeHead(200, {
    'content-type': types[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': String(size),
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  createReadStream(file).pipe(res)
}).listen(port, '127.0.0.1', () => {
  console.log(`electron mirror serving ${root} at http://127.0.0.1:${port}/`)
})
