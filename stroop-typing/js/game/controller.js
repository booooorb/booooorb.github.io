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
  setRoundState,
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
    pausedAt: 0,
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
    if (!window.matchMedia("(pointer: fine)").matches || elements.helpDialog.open) return;
    elements.answer.focus({ preventScroll: true });
  }

  function elapsedSeconds() {
    if (!state.startedAt) return 0;
    const endTime = state.pausedAt || (state.running ? Date.now() : state.finishedAt || Date.now());
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
    state.pausedAt = 0;
    setRoundState(elements, "running");
    elements.inputHint.textContent = "Answers advance automatically";

    arena.reset();
    sound.resetSequence();
    focusAnswer();

    nextPrompt({ clearInput: !preserveInput });
    syncHud();
    clearTick();

    state.tickId = setInterval(() => {
      if (state.pausedAt) return;
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
    state.pausedAt = 0;
    elements.answer.disabled = false;
    elements.answer.placeholder = "Type the ink color";

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
    state.pausedAt = 0;
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
    if (!MODES[nextMode] || nextMode === state.mode) return;
    state.mode = nextMode;

    if (state.running) {
      restart();
      return;
    }

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
    elements.mini.textContent = `Correct — ${state.currentPrompt.ink.name}. Keep going.`;

    elements.answer.value = "";
    syncOverlay();
    nextPrompt({ clearInput: true });
    syncHud();
  }

  function bindEvents() {
    elements.modeCongruent.addEventListener("click", () => {
      setMode(MODES.congruent.key);
      focusAnswer();
    });
    elements.modeIncongruent.addEventListener("click", () => {
      setMode(MODES.incongruent.key);
      focusAnswer();
    });
    elements.skipWarmup.addEventListener("click", completeWarmup);
    elements.restart.addEventListener("click", restart);

    elements.howToPlay.addEventListener("click", () => {
      if (state.running) state.pausedAt = Date.now();
      elements.helpDialog.showModal();
    });
    elements.closeHelp.addEventListener("click", () => elements.helpDialog.close());
    elements.helpDialog.addEventListener("close", () => {
      if (state.pausedAt) {
        state.startedAt += Date.now() - state.pausedAt;
        state.pausedAt = 0;
        focusAnswer();
      }
    });
    elements.practiceAgain.addEventListener("click", () => {
      state.pausedAt = 0;
      elements.helpDialog.close();
      startWarmup();
    });

    document.addEventListener("pointerdown", (event) => {
      const target = event.target;
      if (elements.helpDialog.open || (target instanceof Element && target.closest("button, a, dialog"))) {
        return;
      }

      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) {
        focusAnswer();
        return;
      }

      const handledByArena = arena.handlePointerDown(event);
      if (handledByArena) {
        event.preventDefault();
        return;
      }
      if (target instanceof Element && target.closest(".stage")) focusAnswer();
    });

    window.addEventListener("pointermove", (event) => {
      const handledByArena = arena.handlePointerMove(event);
      if (handledByArena) {
        event.preventDefault();
      }
    });

    window.addEventListener("pointerup", (event) => {
      const handledByArena = arena.handlePointerUp(event);
      if (handledByArena) {
        event.preventDefault();
        focusAnswer();
      }
    });

    window.addEventListener("pointercancel", (event) => {
      const handledByArena = arena.handlePointerCancel(event);
      if (handledByArena) {
        focusAnswer();
      }
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

    elements.answer.addEventListener("scroll", () => {
      elements.typedOverlay.scrollLeft = elements.answer.scrollLeft;
    });

    // On touch devices, leave room for the prompt and guidance above the keyboard.
    window.visualViewport?.addEventListener("resize", () => {
      if (!window.matchMedia("(pointer: coarse)").matches || document.activeElement !== elements.answer) return;
      if (window.visualViewport.height >= 560) return;
      requestAnimationFrame(() => {
        const promptTop = elements.stimulus.parentElement.getBoundingClientRect().top;
        window.scrollBy({ top: promptTop - 12, behavior: "instant" });
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !elements.helpDialog.open && event.target !== elements.answer) {
        event.preventDefault();
        restart();
      }
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
