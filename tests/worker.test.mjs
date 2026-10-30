import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.mjs';
import { readFile } from 'node:fs/promises';
test('www redirects to the canonical origin before assets, preserving path and query',async()=>{
  const response=await worker.fetch(new Request('https://www.tomodo.app/?checkout=success'),{});
  assert.equal(response.status,308);
  assert.equal(response.headers.get('location'),'https://tomodo.app/?checkout=success');
  const config=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  assert.equal(config.assets.run_worker_first,true);
});
test('canonical requests serve assets and API requests reach the backend',async()=>{
  const env={ASSETS:{fetch:async()=>new Response('asset')}};
  assert.equal(await (await worker.fetch(new Request('https://tomodo.app/'),env)).text(),'asset');
  const response=await worker.fetch(new Request('https://tomodo.app/api/config'),env);
  assert.equal(response.status,200);
  assert.equal((await response.json()).accountsEnabled,false);
});
