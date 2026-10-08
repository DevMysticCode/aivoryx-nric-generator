import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { createServer } from 'node:http'

const root = process.cwd()
const port = Number(process.env.PORT || 5174)

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

const send = (response, status, body, type = 'text/plain; charset=utf-8') => {
  response.writeHead(status, {
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  })
  response.end(body)
}

createServer((request, response) => {
  const rawPath = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname)
  const cleanPath = rawPath === '/' ? '/index.html' : rawPath
  const filePath = normalize(join(root, cleanPath))

  if (!filePath.startsWith(root)) {
    send(response, 403, 'Forbidden')
    return
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    send(response, 404, 'Not found')
    return
  }

  const finalPath = filePath
  const type = types[extname(finalPath)] || 'application/octet-stream'

  response.writeHead(200, {
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cache-Control': finalPath.endsWith('index.html') ? 'no-store' : 'no-cache',
  })
  createReadStream(finalPath).pipe(response)
}).listen(port, '0.0.0.0', () => {
  console.log(`NRIC/FIN Generator running at http://localhost:${port}`)
})
