const SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11, 12];
const ROOT_HZ = 261.63;
const MASTER_VOL = 0.3;

function midiFromHz(hz) {
  return 69 + 12 * Math.log2(hz / 440);
}

function hzFromMidi(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function createSoundController() {
  let audioContext = null;
  let noteIndex = 0;
  let direction = 1;

  function ensureAudio() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
  }

  function nextNoteHz() {
    const rootMidi = Math.round(midiFromHz(ROOT_HZ));
    const offset = SCALE_STEPS[noteIndex];

    noteIndex += direction;
    if (noteIndex >= SCALE_STEPS.length) {
      direction = -1;
      noteIndex = SCALE_STEPS.length - 2;
    } else if (noteIndex < 0) {
      direction = 1;
      noteIndex = 1;
    }

    return hzFromMidi(rootMidi + offset);
  }

  function play(freq, velocity = 0.35) {
    ensureAudio();
    const now = audioContext.currentTime;

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(freq, now);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, velocity), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.3);
  }

  return {
    arm() {
      const unlock = () => ensureAudio();
      window.addEventListener("pointerdown", unlock, { once: true });
      window.addEventListener("keydown", unlock, { once: true });
    },
    resetSequence() {
      noteIndex = 0;
      direction = 1;
    },
    wallBounce({ impact } = {}) {
      ensureAudio();
      const freq = nextNoteHz();
      const impactVelocity = Math.max(0.03, Math.min(0.12, (impact || 200) / 4000));
      const velocity = impactVelocity * MASTER_VOL;
      play(freq, velocity);
    },
  };
}
