import { DURATION_SEC, MODES } from "../config.js";

function clearNode(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

export function flashStimulus(stimulusEl) {
  stimulusEl.classList.remove("quick-fade-in");
  requestAnimationFrame(() => {
    stimulusEl.classList.add("quick-fade-in");
  });
}

export function renderPrompt(stimulusEl, prompt) {
  stimulusEl.textContent = prompt.word;
  stimulusEl.style.color = prompt.ink.hex;
  flashStimulus(stimulusEl);
}

export function renderMode(elements, mode) {
  elements.modeCongruent.classList.toggle("active", mode === MODES.congruent.key);
  elements.modeIncongruent.classList.toggle("active", mode === MODES.incongruent.key);
  elements.statusPill.textContent = MODES[mode].label;
  elements.mini.textContent = MODES[mode].helper;
}

export function renderIdleState(elements, mode) {
  renderMode(elements, mode);
  elements.stimulus.textContent = "start typing...";
  elements.stimulus.style.color = "";
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
  elements.stimulus.style.color = "";
  elements.stimulus.textContent = message || "done";
  elements.wpm.textContent = String(wpm);
  flashStimulus(elements.stimulus);
}
