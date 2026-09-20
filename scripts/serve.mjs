import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8088;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';

    const filePath = path.resolve(root, '.' + pathname);
    if (!filePath.startsWith(root + '/') && filePath !== root) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      res.writeHead(302, {Location: pathname + '/index.html'});
      return res.end();
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});
      res.end('404 Not Found');
    } else {
      res.writeHead(500, {'Content-Type': 'text/plain; charset=utf-8'});
      res.end('500 Internal Server Error: ' + err.message);
    }
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🏀 aiBA 本地预览服务器已就绪:`);
  console.log(`   > 本地访问: http://localhost:${PORT}/`);
  console.log(`   > 网络访问: http://127.0.0.1:${PORT}/\n`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
