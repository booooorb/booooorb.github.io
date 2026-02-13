(() => {
  const bank = window.STROOP_BANK;

  // DOM
  const stimulusEl = document.getElementById("stimulus");
  const answerEl = document.getElementById("answer");
  const miniEl = document.getElementById("mini");
  const overlayEl = document.getElementById("typedOverlay");

  const timeLeftEl = document.getElementById("timeLeft");
  const wpmEl = document.getElementById("wpm");

  const modeCongruentBtn = document.getElementById("modeCongruent");
  const modeIncongruentBtn = document.getElementById("modeIncongruent");
  const restartBtn = document.getElementById("restart");

  const inputWrapEl = answerEl.parentElement; // .inputWrap

  const DURATION_SEC = 30;

  let mode = "congruent"; // congruent | incongruent
  let running = false;

  let startMs = 0;
  let tickId = null;

  let current = null; // { word: string, ink: {name,hex,...} }

  let correctCharCount = 0; 
  let correctWords = 0;
  let totalWords = 0;

  // Helpers
  function setMode(next) {
    if (running) return; // lock during run
    mode = next;

    modeCongruentBtn.classList.toggle("active", mode === "congruent");
    modeIncongruentBtn.classList.toggle("active", mode === "incongruent");

    miniEl.textContent = mode === "congruent"
      ? "Mode: word == color (type ink color)"
      : "Mode: word ≠ color (type ink color)";
  }

  function pickPrompt() {
    const word = bank.rand(bank.WORDS);        // "RED"
    const wordName = word.toLowerCase();       // "red"

    let ink;
    if (mode === "congruent") {
      ink = bank.COLORS.find(c => c.name === wordName) || bank.rand(bank.COLORS);
    } else {
      ink = bank.randDifferentColor(wordName);
    }
    return { word, ink };
  }

  function renderPrompt(p) {
    stimulusEl.textContent = p.word;
    stimulusEl.style.color = p.ink.hex;
  }

  function resetHUD() {
    timeLeftEl.textContent = String(DURATION_SEC);
    wpmEl.textContent = "0";
  }

  function elapsedSec() {
    if (!running) return 0;
    return Math.max(0, (Date.now() - startMs) / 1000);
  }

  function timeLeft() {
    if (!running) return DURATION_SEC;
    const spent = Math.floor(elapsedSec());
    return Math.max(0, DURATION_SEC - spent);
  }

  function calcWPM() {
    const e = elapsedSec();
    if (e <= 0.2) return 0;
    const minutes = e / 60;
    const words = (correctCharCount / 5);
    return Math.round(words / minutes);
  }

  function updateHUD() {
    timeLeftEl.textContent = String(timeLeft());
    wpmEl.textContent = String(calcWPM());
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function updateOverlay() {
    const typed = answerEl.value;
    const expected = (running && current) ? current.ink.name : "";

    const typedLower = typed.toLowerCase();
    const expectedLower = expected.toLowerCase();

    let html = "";
    let hasError = false;

    for (let i = 0; i < typed.length; i++) {
      const ch = typed[i];
      const ok = i < expectedLower.length && typedLower[i] === expectedLower[i];

      if (ok) {
        html += `<span class="c-ok">${escapeHtml(ch)}</span>`;
      } else {
        hasError = typed.trim().length > 0;
        html += `<span class="c-bad">${escapeHtml(ch)}</span>`;
      }
    }

    overlayEl.innerHTML = html;
    inputWrapEl.classList.toggle("hasError", hasError);
  }

  function nextWord({ clearInput = true } = {}) {
    current = pickPrompt();
    renderPrompt(current);

    if (clearInput) answerEl.value = "";
    updateOverlay();
  }

  function stopGame(finalMsg) {
    running = false;
    if (tickId) clearInterval(tickId);
    tickId = null;

    answerEl.value = "";
    updateOverlay();
    answerEl.blur();

    stimulusEl.style.color = "";
    stimulusEl.textContent = finalMsg || "done";

    wpmEl.textContent = String(calcWPM());
  }

  function startGame({ preserveInput = false } = {}) {
    correctCharCount = 0;
    correctWords = 0;
    totalWords = 0;

    window.StroopAnim?.reset();
    startMs = Date.now();
    running = true;

    answerEl.focus();

    nextWord({ clearInput: !preserveInput });
    updateHUD();

    if (tickId) clearInterval(tickId);
    tickId = setInterval(() => {
      updateHUD();
      if (timeLeft() <= 0) {
        const finalWpm = calcWPM();
        stopGame(`time! wpm: ${finalWpm}`);
      }
    }, 100);
  }

  function restart() {
    running = false;
    if (tickId) clearInterval(tickId);
    tickId = null;

    resetHUD();
    miniEl.textContent = mode === "congruent"
      ? "Mode: word == color (type ink color)"
      : "Mode: word ≠ color (type ink color)";

    stimulusEl.textContent = "start typing…";
    stimulusEl.style.color = "";

    answerEl.value = "";
    updateOverlay();
    answerEl.focus();
  }

  // Auto-advance ONLY when correct
  function tryAutoAdvance() {
    if (!running || !current) return;

    const expected = current.ink.name.toLowerCase();
    const typed = answerEl.value.trim().toLowerCase();

    if (typed === expected) {
      totalWords += 1;
      correctWords += 1;
      correctCharCount += expected.length + 1;

      miniEl.textContent = `✓ ${current.ink.name}`;
      answerEl.value = "";
      updateOverlay();

      window.StroopAnim?.spawnBall(current.ink.hex);
      nextWord({ clearInput: true });
      updateHUD();
    }
  }

  // Events
  modeCongruentBtn.addEventListener("click", () => setMode("congruent"));
  modeIncongruentBtn.addEventListener("click", () => setMode("incongruent"));
  restartBtn.addEventListener("click", restart);


  answerEl.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      restart();
      return;
    }

    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      return;
    }

    if (!running) {
      const isChar = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (isChar) startGame({ preserveInput: true });
    }
  });

  answerEl.addEventListener("input", () => {
    // If user pastes to start, start the game
    if (!running && answerEl.value.trim().length > 0) {
      startGame({ preserveInput: true });
    }

    updateOverlay();
    tryAutoAdvance();
  });

  // Init
  resetHUD();
  setMode("congruent");
  restart();
})();

