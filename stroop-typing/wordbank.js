(() => {
  const COLORS = [
    { name: "red",    hex: "#e53935", aliases: ["red"] },
    { name: "blue",   hex: "#1e88e5", aliases: ["blue"] },
    { name: "green",  hex: "#43a047", aliases: ["green"] },
    { name: "yellow", hex: "#bbc800", aliases: ["yellow"] },
    { name: "purple", hex: "#8700ac", aliases: ["purple", "violet"] },
    { name: "orange", hex: "#ff8c00", aliases: ["orange"] },
    { name: "pink",   hex: "#fc66ff", aliases: ["pink"] },
    { name: "brown",  hex: "#6d4c41", aliases: ["brown"] },
  ];

  const ASSOCIATED = {
    red:    ["APPLE", "FIRE", "TOMATO", "CHERRY"],
    blue:   ["SKY", "OCEAN", "SAPPHIRE", "WATER"],
    green:  ["GRASS", "LEAF", "FROG", "EMERALD"],
    yellow: ["CHEESE", "BANANA", "LEMON", "EGG"],
    purple: ["GRAPE", "HIPPO", "AMETHYST", "LAVENDER"],
    orange: ["CARROT", "PUMPKIN", "TIGER", "SUNSET"],
    pink:   ["FLAMINGO", "BLOSSOM", "COTTONCANDY", "PIG"],
    brown:  ["COFFEE", "WOOD", "CHOCOLATE", "DIRT"],
  };

  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function randDifferentColor(exceptName) {
    let c = rand(COLORS);
    while (c.name === exceptName) c = rand(COLORS);
    return c;
  }

  const normalize = (s) =>
    String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

  const matchesColor = (answer, colorObj) => {
    const a = normalize(answer);
    if (!a) return false;
    if (a === colorObj.name) return true;
    return (colorObj.aliases || []).some(x => a === x);
  };

  function pickAssociatedWord(colorName) {
    const list = ASSOCIATED[colorName] || [];
    return list.length ? rand(list) : "WORD";
  }

  window.STROOP_BANK = {
    COLORS,
    ASSOCIATED,
    rand,
    randDifferentColor,
    normalize,
    matchesColor,
    pickAssociatedWord,
  };
})();

