const COLORS = [
  { name: "red", hex: "#f13f36", aliases: ["red"] },
  { name: "blue", hex: "#2979ed", aliases: ["blue"] },
  { name: "green", hex: "#29ad4a", aliases: ["green"] },
  { name: "yellow", hex: "#f2d600", aliases: ["yellow"] },
  { name: "purple", hex: "#9751e8", aliases: ["purple", "violet"] },
  { name: "orange", hex: "#ff961f", aliases: ["orange"] },
  { name: "pink", hex: "#ff80b7", aliases: ["pink"] },
  { name: "brown", hex: "#a16d48", aliases: ["brown"] },
];

const ASSOCIATED = {
  red: ["APPLE", "FIRE", "TOMATO", "CHERRY"],
  blue: ["SKY", "OCEAN", "SAPPHIRE", "WATER"],
  green: ["GRASS", "LEAF", "FROG", "EMERALD"],
  yellow: ["CHEESE", "BANANA", "LEMON", "EGG"],
  purple: ["GRAPE", "HIPPO", "AMETHYST", "LAVENDER"],
  orange: ["CARROT", "PUMPKIN", "TIGER", "SUNSET"],
  pink: ["FLAMINGO", "BLOSSOM", "CANDY", "PIG"],
  brown: ["COFFEE", "WOOD", "CHOCOLATE", "DIRT"],
};

const randomItem = (items) => items[Math.floor(Math.random() * items.length)];

export function randomColor() {
  return randomItem(COLORS);
}

export function randomDifferentColor(exceptName) {
  let color = randomColor();
  while (color.name === exceptName) {
    color = randomColor();
  }
  return color;
}

export function pickAssociatedWord(colorName) {
  const list = ASSOCIATED[colorName] || [];
  return list.length ? randomItem(list) : "WORD";
}

export function normalizeAnswer(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function isCorrectAnswer(answer, color) {
  const normalized = normalizeAnswer(answer);
  if (!normalized) return false;
  return normalized === color.name;
}

export { COLORS, ASSOCIATED };
