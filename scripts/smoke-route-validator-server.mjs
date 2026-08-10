/**
 * Local production-equivalent smoke harness for Live Route Validator.
 * Serves static site + POST /api/route-validator using the built handler.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const port = Number(process.env.SMOKE_PORT || 4173);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const handlerMod = await import(pathToFileURL(path.join(root, 'api/route-validator/index.js')).href);
const routeHandler = handlerMod.default;

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function createRes(nodeRes) {
  let statusCode = 200;
  const headers = {};
  return {
    status(code) {
      statusCode = code;
      return this;
    },
    setHeader(k, v) {
      headers[k] = v;
    },
    json(body) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json; charset=utf-8';
      send(nodeRes, statusCode, JSON.stringify(body), headers);
    },
    end() {
      send(nodeRes, statusCode, '', headers);
    },
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/api/route-validator') {
    const body = await readBody(req);
    await routeHandler(
      {
        method: req.method,
        headers: req.headers,
        body,
        socket: { remoteAddress: req.socket.remoteAddress },
      },
      createRes(res),
    );
    return;
  }

  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const filePath = path.join(root, rel);
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    send(res, 404, 'Not found');
    return;
  }
  const ext = path.extname(filePath);
  send(res, 200, fs.readFileSync(filePath), {
    'Content-Type': mime[ext] || 'application/octet-stream',
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`SMOKE_SERVER_READY http://127.0.0.1:${port}`);
});
