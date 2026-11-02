import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source=(await readFile(new URL('../src/native-runtime.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
function boot() {
  const calls=[];
  const window={dispatchEvent:()=>{}};
  vm.runInNewContext(source,{window,URL,Headers,Event,
    invoke:async(...args)=>{calls.push(['invoke',...args]);return null;},
    nativeFetch:async(...args)=>{calls.push(['fetch',...args]);return {ok:true};},
    openUrl:async()=>{},getCurrent:async()=>['tomodo://auth/callback?code=cold'],
    onOpenUrl:async cb=>{calls.push(['listen',cb]);},
    isPermissionGranted:async()=>false,requestPermission:async()=> 'granted',
    sendNotification:options=>calls.push(['notify',options])});
  return {runtime:window.TomodoNative,calls};
}
test('native API networking preserves bearer headers and sends the canonical origin',async()=>{
  const {runtime,calls}=boot();
  await runtime.fetch('/api/activity',{method:'POST',headers:{Authorization:'Bearer test-token'},body:'{}'});
  const [,url,options]=calls[0];
  assert.equal(url,'https://tomodo.app/api/activity');
  assert.equal(options.headers.get('origin'),'https://tomodo.app');
  assert.equal(options.headers.get('authorization'),'Bearer test-token');
  assert.equal(options.method,'POST');
  await runtime.fetch('https://example.supabase.co/auth/v1/token',{method:'POST'});
  assert.equal(calls[1][2].headers.has('origin'),false);
});
test('native session storage uses Keychain commands and supports cold and warm callbacks',async()=>{
  const {runtime,calls}=boot();
  await runtime.storage.setItem('sb-project-auth-token','session');
  await runtime.storage.getItem('sb-project-auth-token');
  await runtime.storage.removeItem('sb-project-auth-token');
  assert.deepEqual(calls.slice(0,3).map(c=>c[1]),['auth_write','auth_read','auth_remove']);
  const urls=[];
  await runtime.listenForAuth(url=>urls.push(url));
  calls.find(c=>c[0]==='listen')[1](['tomodo://auth/callback?code=warm']);
  assert.deepEqual(urls,['tomodo://auth/callback?code=cold','tomodo://auth/callback?code=warm']);
});
