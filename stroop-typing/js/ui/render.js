import { DURATION_SEC, MODES } from "../config.js";

function renderMiniText(elements, text, { tutorial = false } = {}) {
  elements.guidance.classList.toggle("is-tutorial", tutorial);
  elements.tutorialActions.hidden = !tutorial;
  elements.skipWarmup.hidden = !tutorial;
  elements.mini.replaceChildren();
  const message = document.createElement("span");
  message.className = "miniMessage";
  message.textContent = text;
  elements.mini.append(message);
}

function setStimulusState(stimulusEl, text, { color = "", compact = false } = {}) {
  stimulusEl.textContent = text;
  stimulusEl.style.color = color;
  stimulusEl.classList.toggle("is-idle", compact);
  stimulusEl.classList.remove("is-result");
}

function syncModeButtons(elements, mode) {
  for (const [button, key] of [[elements.modeCongruent, MODES.congruent.key], [elements.modeIncongruent, MODES.incongruent.key]]) {
    button.classList.toggle("active", mode === key);
    button.setAttribute("aria-pressed", String(mode === key));
  }
}

export function setRoundState(elements, state) {
  elements.app.dataset.state = state;
  const completed = state === "result";
  elements.answer.disabled = completed;
  elements.inputRow.hidden = completed;
  elements.resultActions.hidden = !completed;
  const restartContainer = completed ? elements.resultActions : elements.restartHome;
  if (elements.restart.parentElement !== restartContainer) restartContainer.append(elements.restart);
}

export function flashStimulus(stimulusEl) {
  stimulusEl.classList.remove("quick-fade-in");
  requestAnimationFrame(() => stimulusEl.classList.add("quick-fade-in"));
}

export function renderPrompt(stimulusEl, prompt) {
  setStimulusState(stimulusEl, prompt.word, { color: prompt.ink.hex });
  flashStimulus(stimulusEl);
}

export function renderMode(elements, mode) {
  syncModeButtons(elements, mode);
  elements.inputHint.textContent = MODES[mode].helper;
  renderMiniText(elements, "");
}

export function renderWarmupState(elements, mode, step, total) {
  setRoundState(elements, "tutorial");
  syncModeButtons(elements, mode);
  const instructions = [
    "Type red.",
    "Type green, not blue.",
    "Type blue, not yellow.",
  ];
  renderMiniText(elements, instructions[step - 1], { tutorial: true });
  elements.tutorialProgress.textContent = `${step} of ${total}`;
  elements.inputHint.textContent = "Take your time. The warm-up is untimed.";
}

export function renderIdleState(elements, mode) {
  setRoundState(elements, "idle");
  renderMode(elements, mode);
  setStimulusState(elements.stimulus, "Type to begin.", { compact: true });
  elements.answer.placeholder = "Type the ink color";
  elements.answer.value = "";
  elements.inputHint.textContent = "Your first keystroke starts the clock";
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
  elements.typedOverlay.replaceChildren();
  const typedLower = String(typed).toLowerCase();
  const expectedLower = String(expected).toLowerCase();
  let hasError = false;
  for (let index = 0; index < typed.length; index += 1) {
    const span = document.createElement("span");
    const matches = index < expectedLower.length && typedLower[index] === expectedLower[index];
    span.className = matches ? "c-ok" : "c-bad";
    span.textContent = typed[index];
    if (!matches && typed.trim().length > 0) hasError = true;
    elements.typedOverlay.appendChild(span);
  }
  elements.inputWrap.classList.toggle("hasError", hasError);
  elements.answer.setAttribute("aria-invalid", String(hasError));
  // Native input scrolling takes place after the input event is dispatched.
  requestAnimationFrame(() => { elements.typedOverlay.scrollLeft = elements.answer.scrollLeft; });
}

export function renderResult(elements, message, wpm) {
  setRoundState(elements, "result");
  elements.answer.value = "";
  renderOverlay(elements, "", "");
  elements.answer.blur();
  elements.stimulus.style.color = "";
  elements.stimulus.classList.remove("is-idle");
  elements.stimulus.classList.add("is-result");
  elements.stimulus.innerHTML = `<span class="resultLead">Time.</span><span class="resultValue">${wpm}</span><span class="resultMeta">WPM</span>`;
  elements.wpm.textContent = String(wpm);
  elements.inputHint.textContent = "Select Restart to play again";
  renderMiniText(elements, "Round complete.");
  flashStimulus(elements.stimulus);
  elements.restart.focus({ preventScroll: true });
  requestAnimationFrame(() => elements.restart.scrollIntoView({ block: "nearest", behavior: "instant" }));
}
