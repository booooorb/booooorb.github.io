import { DURATION_SEC, MODES } from "../config.js";
import { COLORS, isCorrectAnswer, normalizeAnswer, pickAssociatedWord, randomColor, randomDifferentColor } from "../data/wordbank.js";
import {
  renderIdleState,
  renderMode,
  renderOverlay,
  renderPrompt,
  renderResult,
  renderWarmupState,
  resetHud,
  updateHud,
} from "../ui/render.js";

const WARMUP_STORAGE_KEY = "strooptype-warmup-complete";
const WARMUP_PROMPTS = [
  { word: "RED", inkName: "red" },
  { word: "BLUE", inkName: "green" },
  { word: "YELLOW", inkName: "blue" },
].map(({ word, inkName }) => ({
  word,
  ink: COLORS.find((color) => color.name === inkName),
}));

function pickPrompt(mode) {
  const ink = randomColor();
  const word =
    mode === MODES.congruent.key
      ? pickAssociatedWord(ink.name)
      : randomDifferentColor(ink.name).name.toUpperCase();

  return { word, ink };
}

function hasCompletedWarmup() {
  try {
    return window.localStorage.getItem(WARMUP_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistWarmupCompletion() {
  try {
    window.localStorage.setItem(WARMUP_STORAGE_KEY, "1");
  } catch {
    // Ignore storage failures and keep the app usable.
  }
}

export function createGameController(elements, arena, sound) {
  const state = {
    mode: MODES.congruent.key,
    running: false,
    warmupActive: !hasCompletedWarmup(),
    warmupIndex: 0,
    startedAt: 0,
    finishedAt: 0,
    tickId: null,
    currentPrompt: null,
    correctCharCount: 0,
  };

  function clearTick() {
    if (!state.tickId) return;
    clearInterval(state.tickId);
    state.tickId = null;
  }

  function focusAnswer() {
    elements.answer.focus({ preventScroll: true });
  }

  function elapsedSeconds() {
    if (!state.startedAt) return 0;
    const endTime = state.running ? Date.now() : state.finishedAt || Date.now();
    return Math.max(0, (endTime - state.startedAt) / 1000);
  }

  function getTimeLeft() {
    if (!state.running) return DURATION_SEC;
    return Math.max(0, DURATION_SEC - Math.floor(elapsedSeconds()));
  }

  function getWpm() {
    const elapsed = elapsedSeconds();
    if (elapsed <= 0.2) return 0;
    return Math.round(state.correctCharCount / 5 / (elapsed / 60));
  }

  function syncHud() {
    updateHud(elements, getTimeLeft(), getWpm());
  }

  function syncOverlay() {
    const expected =
      (state.running || state.warmupActive) && state.currentPrompt ? state.currentPrompt.ink.name : "";
    renderOverlay(elements, elements.answer.value, expected);
  }

  function showPrompt(prompt, { clearInput = true } = {}) {
    state.currentPrompt = prompt;
    renderPrompt(elements.stimulus, state.currentPrompt);

    if (clearInput) {
      elements.answer.value = "";
    }

    syncOverlay();
  }

  function showWarmupPrompt({ clearInput = true } = {}) {
    showPrompt(WARMUP_PROMPTS[state.warmupIndex], { clearInput });
    renderWarmupState(elements, state.mode, state.warmupIndex + 1, WARMUP_PROMPTS.length);
  }

  function stopGame(message) {
    state.finishedAt = Date.now();
    state.running = false;
    clearTick();
    arena.breakArena();
    renderResult(elements, message, getWpm());
  }

  function nextPrompt({ clearInput = true } = {}) {
    showPrompt(pickPrompt(state.mode), { clearInput });
  }

  function startGame({ preserveInput = false } = {}) {
    state.correctCharCount = 0;
    state.startedAt = Date.now();
    state.finishedAt = 0;
    state.running = true;
    state.warmupActive = false;

    arena.reset();
    sound.resetSequence();
    focusAnswer();

    nextPrompt({ clearInput: !preserveInput });
    syncHud();
    clearTick();

    state.tickId = setInterval(() => {
      syncHud();
      if (getTimeLeft() <= 0) {
        stopGame(`time! wpm: ${getWpm()}`);
      }
    }, 100);
  }

  function startWarmup() {
    state.running = false;
    state.warmupActive = true;
    state.warmupIndex = 0;
    state.startedAt = 0;
    state.finishedAt = 0;
    state.correctCharCount = 0;

    clearTick();
    resetHud(elements);
    arena.reset();
    sound.resetSequence();
    focusAnswer();
    showWarmupPrompt();
  }

  function restart() {
    state.running = false;
    state.startedAt = 0;
    state.finishedAt = 0;
    state.correctCharCount = 0;
    clearTick();

    if (state.warmupActive) {
      startWarmup();
      return;
    }

    state.currentPrompt = null;
    resetHud(elements);
    arena.reset();
    sound.resetSequence();
    renderIdleState(elements, state.mode);
    focusAnswer();
  }

  function completeWarmup() {
    state.warmupActive = false;
    state.warmupIndex = 0;
    state.currentPrompt = null;
    persistWarmupCompletion();
    restart();
  }

  function setMode(nextMode) {
    if (state.running || !MODES[nextMode]) return;
    state.mode = nextMode;

    if (state.warmupActive) {
      renderWarmupState(elements, state.mode, state.warmupIndex + 1, WARMUP_PROMPTS.length);
      return;
    }

    renderMode(elements, state.mode);
  }

  function maybeAdvance() {
    if ((!state.running && !state.warmupActive) || !state.currentPrompt) return;

    const answer = normalizeAnswer(elements.answer.value);
    if (!isCorrectAnswer(answer, state.currentPrompt.ink)) return;

    arena.spawnBall(state.currentPrompt.ink.hex);

    if (state.warmupActive) {
      state.warmupIndex += 1;
      if (state.warmupIndex >= WARMUP_PROMPTS.length) {
        completeWarmup();
        return;
      }

      showWarmupPrompt({ clearInput: true });
      return;
    }

    state.correctCharCount += state.currentPrompt.ink.name.length + 1;
    elements.mini.textContent = `correct: ${state.currentPrompt.ink.name}`;

    elements.answer.value = "";
    syncOverlay();
    nextPrompt({ clearInput: true });
    syncHud();
  }

  function bindEvents() {
    elements.modeCongruent.addEventListener("click", () => setMode(MODES.congruent.key));
    elements.modeIncongruent.addEventListener("click", () => setMode(MODES.incongruent.key));
    elements.skipWarmup.addEventListener("click", completeWarmup);
    elements.restart.addEventListener("click", restart);

    document.addEventListener("pointerdown", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        focusAnswer();
        return;
      }

      if (target.closest("button")) return;
      focusAnswer();
    });

    elements.answer.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        restart();
        return;
      }

      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        return;
      }

      if (state.running || state.warmupActive) return;

      const isCharacter = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
      if (isCharacter) {
        startGame({ preserveInput: true });
      }
    });

    elements.answer.addEventListener("input", () => {
      if (!state.running && !state.warmupActive && elements.answer.value.trim().length > 0) {
        startGame({ preserveInput: true });
      }

      syncOverlay();
      maybeAdvance();
    });
  }

  function init() {
    sound.arm();
    resetHud(elements);
    renderMode(elements, state.mode);
    bindEvents();

    if (state.warmupActive) {
      startWarmup();
      return;
    }

    restart();
  }

  return {
    init,
  };
}
