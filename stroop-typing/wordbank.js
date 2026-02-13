(() => {
  const COLORS = [
    { name: "red",    hex: "#e53935", aliases: ["red"] },
    { name: "blue",   hex: "#1e88e5", aliases: ["blue"] },
    { name: "green",  hex: "#43a047", aliases: ["green"] },
    { name: "yellow", hex: "#f9a825", aliases: ["yellow"] },
    { name: "purple", hex: "#8700ac", aliases: ["purple", "violet"] },
    { name: "orange", hex: "#df7a00", aliases: ["orange"] },
    { name: "pink",   hex: "#fc66ff", aliases: ["pink"] },
    { name: "brown",  hex: "#6d4c41", aliases: ["brown"] },
  ];

  const WORDS = COLORS.map(c => c.name.toUpperCase());

  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const randDifferentColor = (exceptName) => {
    let c = rand(COLORS);
    while (c.name === exceptName) c = rand(COLORS);
    return c;
  };

  const normalize = (s) =>
    String(s ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  const matchesColor = (answer, colorObj) => {
    const a = normalize(answer);
    if (!a) return false;
    if (a === colorObj.name) return true;
    return (colorObj.aliases || []).some(x => a === x);
  };

  window.STROOP_BANK = { COLORS, WORDS, rand, randDifferentColor, normalize, matchesColor };
})();
