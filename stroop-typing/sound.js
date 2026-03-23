(() => {
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  // Do Re Mi Fa So La Ti Do (major) semitone offsets from root
  const SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11, 12];

  // Root "Do"
  const ROOT_HZ = 261.63; // C4
  const MASTER_VOL = 0.3;

  let idx = 0;        
  let dir = +1;       // +1 going up, -1 going down

  function midiFromHz(hz) {
    return 69 + 12 * Math.log2(hz / 440);
  }
  function hzFromMidi(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  function nextNoteHz() {
    const rootMidi = Math.round(midiFromHz(ROOT_HZ));
    const offset = SCALE_STEPS[idx];

    idx += dir;

    if (idx >= SCALE_STEPS.length) {
      dir = -1;
      idx = SCALE_STEPS.length - 2; // start coming down 
    } else if (idx < 0) {
      dir = +1;
      idx = 1; // start going up 
    }

    return hzFromMidi(rootMidi + offset);
  }

  function play(freq, velocity = 0.35) {
    ensureAudio();
    const t0 = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t0);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, t0);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, velocity), t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(t0);
    osc.stop(t0 + 0.3);
  }

  function wallBounce({ impact } = {}) {
    ensureAudio();

    const freq = nextNoteHz();

    const impactVel = Math.max(0.03, Math.min(0.12, (impact || 200) / 4000));
    const velocity = impactVel * MASTER_VOL;

    play(freq, velocity);
  }

  function resetSequence() {
    idx = 0;
    dir = +1;
  }

  function arm() {
    const unlock = () => ensureAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  }

  window.StroopSound = { wallBounce, arm, resetSequence };
})();

