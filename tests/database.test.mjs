import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
let db;
const userA='00000000-0000-4000-8000-000000000001';
const userB='00000000-0000-4000-8000-000000000002';
const source='10000000-0000-4000-8000-000000000001';
before(async()=>{
  db=new PGlite();
  await db.exec(`create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role; insert into auth.users values ('${userA}'),('${userB}');`);
  await db.exec(await readFile(new URL('../supabase/migrations/202610290001_accounts.sql',import.meta.url),'utf8'));
});
after(async()=>{await db.close();});
test('anonymous and authenticated browser roles cannot read/write application tables or invoke privileged RPCs', async()=>{
  for(const role of ['anon','authenticated']){
    await db.exec(`set role ${role}`);
    for(const table of ['account_preferences','activity_sources','billing_customers','billing_events']){
      await assert.rejects(()=>db.query(`select * from public.${table}`),/permission denied/);
    }
    await assert.rejects(()=>db.query('select public.claim_checkout($1,$2)',[userA,source]),/permission denied/);
    await db.exec('reset role');
  }
});
test('source snapshot retries and older revisions never duplicate or roll back recorded work',async()=>{
  await db.exec('set role service_role');
  const row = revision=>({day:'2026-10-29',revision,work_seconds:revision*60,rest_seconds:0,work_completed:0,breaks_completed:0,cycles_completed:0});
  const sync=async r=>db.query('select public.sync_activity($1,$2,$3::jsonb)',[userA,source,JSON.stringify([r])]);
  await sync(row(1)); await sync(row(1)); await sync(row(3)); await sync(row(2));
  const {rows}=await db.query('select revision,work_seconds from public.activity_sources where user_id=$1',[userA]);
  assert.equal(rows.length,1); assert.equal(Number(rows[0].revision),3); assert.equal(Number(rows[0].work_seconds),180);
  const b=await db.query('select * from public.activity_sources where user_id=$1',[userB]);assert.equal(b.rows.length,0);
  await db.exec('reset role');
});
test('new reset revisions replace a source total instead of adding or erasing other sources',async()=>{
  await db.exec('set role service_role');
  const row={day:'2026-10-29',revision:4,work_seconds:0,rest_seconds:0,work_completed:0,breaks_completed:0,cycles_completed:0};
  await db.query('select public.sync_activity($1,$2,$3::jsonb)',[userA,source,JSON.stringify([row])]);
  const {rows}=await db.query('select work_seconds from public.activity_sources where user_id=$1',[userA]);assert.equal(Number(rows[0].work_seconds),0);
  await db.exec('reset role');
});
test('billing retries are idempotent and older reconciliations cannot restore canceled access',async()=>{
  await db.exec('set role service_role');
  await db.query('insert into public.billing_customers(user_id,stripe_customer_id) values ($1,$2)',[userA,'cus_a']);
  const apply=(event,status,started)=>db.query('select public.apply_billing_event($1,$2,$3,$4,$5,$6)',[event,'cus_a','sub_a',status,status==='active'?'2030-01-01T00:00:00Z':null,started]);
  await apply('evt_new','active','2026-10-29T10:00:00Z');
  await apply('evt_cancel','free','2026-10-29T10:01:00Z');
  await apply('evt_old','active','2026-10-29T09:59:00Z');
  await apply('evt_new','active','2026-10-29T10:02:00Z');
  const {rows}=await db.query('select status,access_until from public.billing_customers where user_id=$1',[userA]);
  assert.equal(rows[0].status,'free');assert.equal(rows[0].access_until,null);
  const ledger=await db.query('select count(*) from public.billing_events');assert.equal(Number(ledger.rows[0].count),3);
  await db.exec('reset role');
});
test('only the holder of a Checkout lease can release it',async()=>{
  await db.exec('set role service_role');
  const claim=async id=>(await db.query('select public.claim_checkout($1,$2) as claimed',[userA,id])).rows[0].claimed;
  assert.equal(await claim(source),true);
  assert.equal(await claim(userB),false);
  await db.query('select public.release_checkout($1,$2)',[userA,userB]);assert.equal(await claim(userB),false);
  await db.query('select public.release_checkout($1,$2)',[userA,source]);assert.equal(await claim(userB),true);
  await db.exec('reset role');
});
