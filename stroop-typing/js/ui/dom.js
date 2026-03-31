export function getElements() {
  const answer = document.getElementById("answer");

  return {
    app: document.querySelector(".app"),
    stimulus: document.getElementById("stimulus"),
    answer,
    typedOverlay: document.getElementById("typedOverlay"),
    mini: document.getElementById("mini"),
    timeLeft: document.getElementById("timeLeft"),
    wpm: document.getElementById("wpm"),
    statusPill: document.getElementById("statusPill"),
    modeCongruent: document.getElementById("modeCongruent"),
    modeIncongruent: document.getElementById("modeIncongruent"),
    skipWarmup: document.getElementById("skipWarmup"),
    restart: document.getElementById("restart"),
    arena: document.getElementById("stroopArena"),
    inputWrap: answer?.parentElement ?? null,
  };
}
