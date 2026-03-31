import { DURATION_SEC, MODES } from "../config.js";

function clearNode(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function setStimulusState(stimulusEl, text, { color = "", compact = false } = {}) {
  stimulusEl.textContent = text;
  stimulusEl.style.color = color;
  stimulusEl.classList.toggle("is-idle", compact);
}

function syncModeButtons(elements, mode) {
  elements.modeCongruent.classList.toggle("active", mode === MODES.congruent.key);
  elements.modeIncongruent.classList.toggle("active", mode === MODES.incongruent.key);
}

export function flashStimulus(stimulusEl) {
  stimulusEl.classList.remove("quick-fade-in");
  requestAnimationFrame(() => {
    stimulusEl.classList.add("quick-fade-in");
  });
}

export function renderPrompt(stimulusEl, prompt) {
  setStimulusState(stimulusEl, prompt.word, { color: prompt.ink.hex, compact: false });
  flashStimulus(stimulusEl);
}

export function renderMode(elements, mode) {
  syncModeButtons(elements, mode);
  elements.statusPill.textContent = MODES[mode].label;
  elements.mini.textContent = MODES[mode].helper;
  elements.skipWarmup.hidden = true;
}

export function renderWarmupState(elements, mode, step, total) {
  syncModeButtons(elements, mode);
  elements.statusPill.textContent = "warm up";
  elements.mini.textContent = `tutorial ${step}/${total} - type the ink color, not the word`;
  elements.skipWarmup.hidden = false;
}

export function renderIdleState(elements, mode) {
  renderMode(elements, mode);
  setStimulusState(elements.stimulus, "type to begin", { compact: true });
  elements.answer.value = "";
  renderOverlay(elements, "", "");
}

export function resetHud(elements) {
  elements.timeLeft.textContent = String(DURATION_SEC);
  elements.wpm.textContent = "0";
}

export function updateHud(elements, nextTimeLeft, nextWpm) {
  elements.timeLeft.textContent = String(nextTimeLeft);
  elements.wpm.textContent = String(nextWpm);
}

export function renderOverlay(elements, typed, expected) {
  clearNode(elements.typedOverlay);

  const typedLower = String(typed).toLowerCase();
  const expectedLower = String(expected).toLowerCase();
  let hasError = false;

  for (let index = 0; index < typed.length; index += 1) {
    const char = typed[index];
    const span = document.createElement("span");
    const matches = index < expectedLower.length && typedLower[index] === expectedLower[index];

    span.className = matches ? "c-ok" : "c-bad";
    span.textContent = char;

    if (!matches && typed.trim().length > 0) {
      hasError = true;
    }

    elements.typedOverlay.appendChild(span);
  }

  elements.inputWrap.classList.toggle("hasError", hasError);
}

export function renderResult(elements, message, wpm) {
  elements.answer.value = "";
  renderOverlay(elements, "", "");
  elements.answer.blur();
  setStimulusState(elements.stimulus, message || "finished", { compact: false });
  elements.wpm.textContent = String(wpm);
  elements.skipWarmup.hidden = true;
  flashStimulus(elements.stimulus);
}
