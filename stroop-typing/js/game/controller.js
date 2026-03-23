import { DURATION_SEC, MODES } from "../config.js";
import {
  isCorrectAnswer,
  normalizeAnswer,
  pickAssociatedWord,
  randomColor,
  randomDifferentColor,
} from "../data/wordbank.js";
import {
  renderIdleState,
  renderMode,
  renderOverlay,
  renderPrompt,
  renderResult,
  resetHud,
  updateHud,
} from "../ui/render.js";

function pickPrompt(mode) {
  const ink = randomColor();
  const word =
    mode === MODES.congruent.key
      ? pickAssociatedWord(ink.name)
      : randomDifferentColor(ink.name).name.toUpperCase();

  return { word, ink };
}

export function createGameController(elements, arena, sound) {
  const state = {
    mode: MODES.congruent.key,
    running: false,
    startedAt: 0,
    finishedAt: 0,
    tickId: null,
    currentPrompt: null,
    correctCharCount: 0,
  };

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
    const expected = state.running && state.currentPrompt ? state.currentPrompt.ink.name : "";
    renderOverlay(elements, elements.answer.value, expected);
  }

  function stopGame(message) {
    state.finishedAt = Date.now();
    state.running = false;

    if (state.tickId) {
      clearInterval(state.tickId);
      state.tickId = null;
    }

    renderResult(elements, message, getWpm());
  }

  function nextPrompt({ clearInput = true } = {}) {
    state.currentPrompt = pickPrompt(state.mode);
    renderPrompt(elements.stimulus, state.currentPrompt);

    if (clearInput) {
      elements.answer.value = "";
    }

    syncOverlay();
  }

  function startGame({ preserveInput = false } = {}) {
    state.correctCharCount = 0;
    state.startedAt = Date.now();
    state.finishedAt = 0;
    state.running = true;

    arena.reset();
    sound.resetSequence();
    elements.answer.focus();

    nextPrompt({ clearInput: !preserveInput });
    syncHud();

    if (state.tickId) {
      clearInterval(state.tickId);
    }

    state.tickId = setInterval(() => {
      syncHud();
      if (getTimeLeft() <= 0) {
        stopGame(`time! wpm: ${getWpm()}`);
      }
    }, 100);
  }

  function restart() {
    state.running = false;
    state.startedAt = 0;
    state.finishedAt = 0;
    state.currentPrompt = null;
    state.correctCharCount = 0;

    if (state.tickId) {
      clearInterval(state.tickId);
      state.tickId = null;
    }

    resetHud(elements);
    renderIdleState(elements, state.mode);
    elements.answer.focus();
  }

  function setMode(nextMode) {
    if (state.running || !MODES[nextMode]) return;
    state.mode = nextMode;
    renderMode(elements, state.mode);
  }

  function maybeAdvance() {
    if (!state.running || !state.currentPrompt) return;

    const answer = normalizeAnswer(elements.answer.value);
    if (!isCorrectAnswer(answer, state.currentPrompt.ink)) return;

    state.correctCharCount += state.currentPrompt.ink.name.length + 1;
    elements.mini.textContent = `Correct: ${state.currentPrompt.ink.name}`;
    arena.spawnBall(state.currentPrompt.ink.hex);

    elements.answer.value = "";
    syncOverlay();
    nextPrompt({ clearInput: true });
    syncHud();
  }

  function bindEvents() {
    elements.modeCongruent.addEventListener("click", () => setMode(MODES.congruent.key));
    elements.modeIncongruent.addEventListener("click", () => setMode(MODES.incongruent.key));
    elements.restart.addEventListener("click", restart);

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

      if (state.running) return;

      const isCharacter = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
      if (isCharacter) {
        startGame({ preserveInput: true });
      }
    });

    elements.answer.addEventListener("input", () => {
      if (!state.running && elements.answer.value.trim().length > 0) {
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
    restart();
  }

  return {
    init,
  };
}
