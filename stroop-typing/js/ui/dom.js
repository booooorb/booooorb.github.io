export function getElements() {
  const answer = document.getElementById("answer");

  return {
    app: document.querySelector(".app"),
    stimulus: document.getElementById("stimulus"),
    answer,
    typedOverlay: document.getElementById("typedOverlay"),
    mini: document.getElementById("mini"),
    guidance: document.getElementById("guidance"),
    tutorialActions: document.getElementById("tutorialActions"),
    tutorialProgress: document.getElementById("tutorialProgress"),
    inputHint: document.getElementById("inputHint"),
    howToPlay: document.getElementById("howToPlay"),
    helpDialog: document.getElementById("helpDialog"),
    closeHelp: document.getElementById("closeHelp"),
    practiceAgain: document.getElementById("practiceAgain"),
    helpExample: document.querySelector(".exampleWord"),
    timeLeft: document.getElementById("timeLeft"),
    wpm: document.getElementById("wpm"),
    modeCongruent: document.getElementById("modeCongruent"),
    modeIncongruent: document.getElementById("modeIncongruent"),
    skipWarmup: document.getElementById("skipWarmup"),
    restart: document.getElementById("restart"),
    restartHome: document.querySelector(".bar"),
    resultActions: document.getElementById("resultActions"),
    inputRow: document.querySelector(".inputRow"),
    arena: document.getElementById("stroopArena"),
    arenaAnchor: document.querySelector(".anim"),
    inputWrap: answer?.parentElement ?? null,
  };
}
