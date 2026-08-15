'use strict';

const http = require('node:http');

function readJson(req, limitBytes = 32 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (err) { reject(Object.assign(new Error('Invalid JSON'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': data.length,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Cache-Control': 'no-store'
  });
  res.end(data);
}

class BridgeServer {
  constructor({ host = '127.0.0.1', port = 17841, onImport, onStatus, getConfig, getExtensionInfo }) {
    this.host = host;
    this.port = port;
    this.onImport = onImport;
    this.onStatus = onStatus;
    this.getConfig = getConfig;
    this.getExtensionInfo = getExtensionInfo;
    this.server = null;
    this.inflight = new Map();
  }

  async start() {
    if (this.server) return;
    this.server = http.createServer(async (req, res) => {
      try {
        if (req.method === 'OPTIONS') return sendJson(res, 204, {});
        const url = new URL(req.url, `http://${this.host}:${this.port}`);

        if (req.method === 'GET' && url.pathname === '/api/ping') {
          return sendJson(res, 200, { ok: true, app: 'Trading Journal Desktop', bridge: 1 });
        }
        if (req.method === 'GET' && url.pathname === '/api/config') {
          const config = await this.getConfig?.();
          return sendJson(res, 200, { ok: true, ...(config || {}) });
        }
        if (req.method === 'GET' && url.pathname === '/api/extension-version') {
          const info = await this.getExtensionInfo?.();
          return sendJson(res, 200, { ok: true, ...(info || {}) });
        }
        if (req.method === 'POST' && url.pathname === '/api/status') {
          const status = await readJson(req, 2 * 1024 * 1024);
          await this.onStatus?.(status);
          return sendJson(res, 200, { ok: true });
        }
        if (req.method === 'POST' && url.pathname === '/api/import') {
          const payload = await readJson(req);
          const item = payload.item || payload;
          if (!item || !item.id) return sendJson(res, 400, { ok: false, error: 'Import item missing id' });

          let p = this.inflight.get(item.id);
          if (!p) {
            p = Promise.resolve(this.onImport?.(item)).finally(() => this.inflight.delete(item.id));
            this.inflight.set(item.id, p);
          }
          const result = await p;
          return sendJson(res, result?.ok === false ? 422 : 200, result || { ok: true });
        }

        return sendJson(res, 404, { ok: false, error: 'Not found' });
      } catch (err) {
        return sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
      }
    });

    await new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.port, this.host, resolve);
    });
  }

  async stop() {
    if (!this.server) return;
    const srv = this.server;
    this.server = null;
    await new Promise(resolve => srv.close(resolve));
  }
}

module.exports = { BridgeServer };
