/* Local, synthesized ambient textures; playback follows timer start/pause. */
(function (root) {
  'use strict';
  // Each layer: noise color, low-pass cutoff, level, slow swell speed, stereo position.
  const profiles = Object.freeze({
    tomato: {name:'Garden breeze',layers:[['pink',1600,.45,.09,-.4],['brown',450,.5,.045,.4]]},
    sundial: {name:'Desert wind',layers:[['brown',700,.75,.035,-.3],['pink',2400,.22,.07,.5]]},
    zen: {name:'Gentle stream',layers:[['pink',3200,.55,.12,-.5],['white',5500,.15,.19,.5]]},
    astronomical: {name:'Deep space noise',layers:[['brown',280,.8,.025,0],['pink',900,.2,.04,.4]]},
    rolex: {name:'Quiet cabin',layers:[['brown',550,.65,.055,-.3],['pink',1800,.2,.085,.3]]},
    hourglass: {name:'Shifting sand',layers:[['pink',2600,.45,.065,-.5],['white',4200,.12,.11,.5]]},
    retro: {name:'Soft static',layers:[['pink',3600,.4,.025,0],['brown',800,.4,.05,.3]]},
    rainy: {name:'Steady rainfall',layers:[['white',6500,.32,.13,-.55],['pink',3500,.55,.07,.55],['brown',400,.22,.035,0]]},
    night: {name:'Night breeze',layers:[['brown',650,.6,.035,-.4],['pink',2100,.25,.075,.5]]},
    forest: {name:'Rustling leaves',layers:[['pink',4000,.45,.17,-.6],['brown',1000,.55,.08,.6]]},
    winter: {name:'Snowy wind',layers:[['pink',2000,.4,.045,-.5],['brown',480,.65,.025,.5]]}
  });

  function createPlayer(context) {
    const buffers = new Map();
    let current = null, volume = .35;
    function noise(color) {
      if (buffers.has(color)) return buffers.get(color);
      const buffer = context.createBuffer(1,context.sampleRate * 12,context.sampleRate);
      const data = buffer.getChannelData(0);
      let low = 0, mid = 0;
      for (let i=0;i<data.length;i++) {
        const white = Math.random()*2-1;
        low = (low + .02*white)/1.02;
        mid = .97*mid + .03*white;
        data[i] = color === 'brown' ? low*3.5 : color === 'pink' ? mid*2.5 : white*.5;
      }
      // Match the loop boundary with a short blend rather than an audible click.
      const blend = Math.floor(context.sampleRate*.1);
      for (let i=0;i<blend;i++) {
        const mix = i/blend;
        data[data.length-blend+i] = data[data.length-blend+i]*(1-mix)+data[i]*mix;
      }
      buffers.set(color,buffer);
      return buffer;
    }
    function retire(graph) {
      if (!graph) return;
      const now = context.currentTime;
      graph.master.gain.cancelScheduledValues(now);
      graph.master.gain.setTargetAtTime(0,now,.12);
      graph.sources.forEach(source=>source.stop(now+.8));
      root.setTimeout(()=>graph.nodes.forEach(node=>node.disconnect()),900);
    }
    return {
      play(theme) {
        retire(current);
        const profile = profiles[theme] || profiles.tomato;
        const master = context.createGain();
        master.gain.setValueAtTime(0,context.currentTime);
        master.gain.setTargetAtTime(volume,context.currentTime,.25);
        master.connect(context.destination);
        const graph = {master,nodes:[master],sources:[]};
        for (const [color,cutoff,level,speed,pan] of profile.layers) {
          const source = context.createBufferSource();
          source.buffer = noise(color); source.loop = true; source.loopStart = .1;
          const filter = context.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=cutoff; filter.Q.value=.5;
          const gain = context.createGain(); gain.gain.value=level*.72;
          const panner = context.createStereoPanner(); panner.pan.value=pan;
          const swell = context.createOscillator(); swell.frequency.value=speed;
          const depth = context.createGain(); depth.gain.value=level*.22;
          swell.connect(depth); depth.connect(gain.gain);
          source.connect(filter); filter.connect(gain); gain.connect(panner); panner.connect(master);
          source.start(0,Math.random()*6); swell.start();
          graph.sources.push(source,swell); graph.nodes.push(source,filter,gain,panner,swell,depth);
        }
        current=graph;
      },
      pause() {retire(current);current=null;},
      setVolume(value) {
        volume = Math.max(0,Math.min(1,Number(value)||0));
        current?.master.gain.setTargetAtTime(volume,context.currentTime,.05);
      }
    };
  }
  root.TomodoSoundscapes = {profiles,createPlayer};
  if (typeof module !== 'undefined') module.exports = {profiles,createPlayer};
  if (!root.document) return;
  const button = document.getElementById('soundscapeBtn');
  if (!button) return;
  const status = document.getElementById('soundscapeStatus');
  const description = document.getElementById('soundscapeDescription');
  const slider = document.getElementById('soundscapeVolume');
  let context, player, playing=false, pending=false, theme='tomato', operation=0;
  let savedVolume;
  try {savedVolume=root.localStorage.getItem('tomodo_soundscape_volume');} catch {}
  slider.value=savedVolume === null || savedVolume === undefined ? 35 : Math.max(0,Math.min(100,Number(savedVolume)||0));
  function render(message) {
    button.setAttribute('aria-pressed',String(playing));
    button.disabled=pending || !(root.AudioContext || root.webkitAudioContext);
    status.textContent=!(root.AudioContext || root.webkitAudioContext) ? 'Unavailable' : pending ? 'Starting…' : playing ? 'Pause' : 'Play';
    description.textContent=message || `${(profiles[theme] || profiles.tomato).name} · follows your timer and theme`;
    slider.setAttribute('aria-valuetext',`${slider.value}%`);
  }
  function pause() {operation++;pending=false;playing=false;player?.pause();render();}
  async function play() {
    if (playing || pending) return;
    const request=++operation;
    pending=true;render();
    try {
      if (!context) {
        context=new (root.AudioContext || root.webkitAudioContext)();
        player=createPlayer(context);
        context.addEventListener('statechange',()=>{
          if (playing && context.state!=='running') {playing=false;player.pause();render('Audio paused. Press Play to resume.');}
        });
      }
      await context.resume();
      if (request!==operation) return;
      if (context.state!=='running') throw new Error('Audio unavailable');
      player.setVolume(slider.value/100);player.play(theme);playing=true;pending=false;render();
    } catch {if(request!==operation)return;pending=false;playing=false;player?.pause();render('Audio unavailable. Try Play again.');}
  }
  root.TomodoSoundscapes.play=play;
  root.TomodoSoundscapes.pause=pause;
  button.addEventListener('click',()=>playing ? pause() : play());
  slider.addEventListener('input',()=>{
    player?.setVolume(slider.value/100);
    try {root.localStorage.setItem('tomodo_soundscape_volume',slider.value);} catch {}
    render();
  });
  root.TomodoSoundscapes.setTheme=value=>{
    if (!Object.hasOwn(profiles,value) || theme===value) return;
    theme=value;if (playing) player.play(theme);render();
  };
  root.addEventListener('pagehide',pause);
  render();
})(globalThis);
