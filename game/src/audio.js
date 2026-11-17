// Sound made from nothing: an oscillator and a noise buffer, both generated when the game starts.
// There is no audio file in the repository, so the entry stays a folder of plain scripts. The
// AudioContext is only created after a real key or click, because browsers refuse to start one
// before that.

const NOTES = {
  soul: [880, 1320],
  drink: [520, 660, 780],
  bite: [140, 92],
  flare: [1240, 620],
  night: [392, 523, 659],
  over: [220, 165, 110],
  win: [523, 659, 784, 1046],
  ui: [660],
  deny: [180],
};

export function createAudio() {
  let ctx = null;
  let master = null;
  let noise = null;
  let muted = false;

  function ensure() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch (error) {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);

    // Half a second of noise, reused for every percussive sound.
    const length = Math.floor(ctx.sampleRate * 0.5);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    }
    return ctx;
  }

  function tone(freq, duration, options = {}) {
    if (!ctx || muted) return;
    const { type = 'sine', volume = 0.5, delay = 0, slideTo = null } = options;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  function hiss(duration, options = {}) {
    if (!ctx || muted || !noise) return;
    const { volume = 0.35, delay = 0, cutoff = 1800 } = options;
    const start = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, start);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
    source.stop(start + duration);
  }

  function play(name) {
    if (!ensure() || muted) return;
    const notes = NOTES[name];
    if (!notes) return;
    if (name === 'bite') {
      hiss(0.22, { volume: 0.5, cutoff: 900 });
      tone(notes[0], 0.26, { type: 'sawtooth', volume: 0.32, slideTo: notes[1] });
      return;
    }
    if (name === 'flare') {
      hiss(0.35, { volume: 0.45, cutoff: 3200 });
      tone(notes[0], 0.3, { type: 'triangle', volume: 0.28, slideTo: notes[1] });
      return;
    }
    if (name === 'drink') {
      hiss(0.12, { volume: 0.12, cutoff: 1200 });
    }
    notes.forEach((freq, index) => {
      const type = name === 'over' ? 'sawtooth' : 'sine';
      tone(freq, name === 'win' ? 0.34 : 0.2, { type, volume: 0.3, delay: index * 0.075 });
    });
  }

  function unlock() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.16;
    return muted;
  }

  return {
    play, unlock, toggleMute, get muted() { return muted; },
  };
}
