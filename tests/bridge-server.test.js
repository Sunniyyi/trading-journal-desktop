'use strict';
const assert = require('node:assert/strict');
const { BridgeServer } = require('../src/bridge-server');

(async () => {
  const seen = { status: null, item: null };
  const port = 17849;
  const server = new BridgeServer({
    port,
    getConfig: async () => ({ pages: [{ id: 'p1', title: 'XAUUSD' }], targetPageId: 'p1', version: 'v206' }),
    onStatus: async s => { seen.status = s; },
    onImport: async item => { seen.item = item; return { ok: true, sourceId: 's1' }; }
  });
  await server.start();
  try {
    let r = await fetch(`http://127.0.0.1:${port}/api/ping`); assert.equal((await r.json()).ok, true);
    r = await fetch(`http://127.0.0.1:${port}/api/config`); const cfg = await r.json(); assert.equal(cfg.targetPageId, 'p1');
    r = await fetch(`http://127.0.0.1:${port}/api/status`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({pending:2}) }); assert.equal((await r.json()).ok,true); assert.equal(seen.status.pending,2);
    r = await fetch(`http://127.0.0.1:${port}/api/import`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({item:{id:'q1',trade:{asset:'XAUUSD'}}}) }); const imp=await r.json(); assert.equal(imp.ok,true); assert.equal(seen.item.id,'q1');
    console.log('bridge-server.test.js: OK');
  } finally { await server.stop(); }
})().catch(err => { console.error(err); process.exit(1); });
