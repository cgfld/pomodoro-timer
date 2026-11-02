import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const source=await readFile(new URL('../soundscapes.js',import.meta.url),'utf8');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
function setup({rejectResume=false}={}) {
  const dom=new JSDOM(html,{url:'https://tomodo.app',runScripts:'outside-only'});
  const contexts=[];
  class Context {
    constructor(){this.currentTime=0;this.sampleRate=100;this.state='suspended';this.destination={};this.sources=[];contexts.push(this);}
    createGain(){return this.node();}
    node(){const param=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}});return {gain:param(),frequency:param(),pan:param(),Q:param(),connect(){},disconnect(){},start(){},stop(){this.stopped=true;}};}
    createBufferSource(){const n=this.node();this.sources.push(n);return n;}
    createBiquadFilter(){return this.node();}
    createStereoPanner(){return this.node();}
    createOscillator(){const n=this.node();this.sources.push(n);return n;}
    createBuffer(channels,length){const data=new Float32Array(length);return {getChannelData:()=>data};}
    addEventListener(){}
    async resume(){if(rejectResume)throw new Error('blocked');this.state='running';}
  }
  dom.window.AudioContext=Context;
  dom.window.setTimeout=fn=>{fn();return 0;};
  vm.runInContext(source,dom.getInternalVMContext());
  return {dom,w:dom.window,contexts,button:dom.window.document.getElementById('soundscapeBtn')};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('ambience is opt-in, changes all themes, and stops old audio on switches and pause',async()=>{
  const {dom,w,contexts,button}=setup();
  try {
    assert.equal(contexts.length,0,'page load must not create an audio context');
    button.click();await flush();
    assert.equal(button.getAttribute('aria-pressed'),'true');
    const first=contexts[0].sources.slice();
    w.TomodoSoundscapes.setTheme('rainy');
    assert(first.every(s=>s.stopped),'theme switch retires every previous source');
    assert.match(w.document.getElementById('soundscapeDescription').textContent,/Steady rainfall/);
    for(const theme of Object.keys(w.TomodoSoundscapes.profiles))w.TomodoSoundscapes.setTheme(theme);
    button.click();
    assert(contexts[0].sources.every(s=>s.stopped),'pause stops every sound and modulation source');
    assert.equal(button.getAttribute('aria-pressed'),'false');
    const slider=w.document.getElementById('soundscapeVolume');slider.value='18';slider.dispatchEvent(new w.Event('input'));
    assert.equal(w.localStorage.getItem('tomodo_soundscape_volume'),'18');
    assert.equal(slider.getAttribute('aria-valuetext'),'18%');
  } finally {dom.window.close();}
});
test('rejected browser playback leaves controls ready to retry',async()=>{
  const {dom,w,button}=setup({rejectResume:true});
  try {button.click();await flush();assert.equal(button.getAttribute('aria-pressed'),'false');assert.equal(button.disabled,false);assert.match(w.document.getElementById('soundscapeDescription').textContent,/Try Play again/);}finally{dom.window.close();}
});
