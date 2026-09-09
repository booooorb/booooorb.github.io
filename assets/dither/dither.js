// Process the original raster; output dimensions never change. Grain only
// changes the sampling footprint, from one to at most three source pixels.
const BAYER_8 = [
  0, 48, 12, 60, 3, 51, 15, 63,
  32, 16, 44, 28, 35, 19, 47, 31,
  8, 56, 4, 52, 11, 59, 7, 55,
  40, 24, 36, 20, 43, 27, 39, 23,
  2, 50, 14, 62, 1, 49, 13, 61,
  34, 18, 46, 30, 33, 17, 45, 29,
  10, 58, 6, 54, 9, 57, 5, 53,
  42, 26, 38, 22, 41, 25, 37, 21,
];
const clamp = (value) => Math.max(0, Math.min(255, value));
const luminance = (r, g, b) => .2126 * r + .7152 * g + .0722 * b;

export function renderDither(source, width, height, settings) {
  const grain = settings.grain;
  const columns = Math.ceil(width / grain);
  const rows = Math.ceil(height / grain);
  const tones = new Float32Array(columns * rows);
  const contrast = settings.contrast / 100;
  const brightness = settings.brightness * 2.55;
  const adjust = (value) => clamp((value - 127.5) * contrast + 127.5 + brightness);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = 0; dy < grain && y * grain + dy < height; dy++) {
        for (let dx = 0; dx < grain && x * grain + dx < width; dx++) {
          const i = ((y * grain + dy) * width + x * grain + dx) * 4;
          sum += luminance(source[i], source[i + 1], source[i + 2]);
          count++;
        }
      }
      tones[y * columns + x] = adjust(sum / count);
    }
  }

  const dots = new Uint8ClampedArray(tones.length);
  const step = 255 / (settings.levels - 1);
  for (let y = 0; y < rows; y++) {
    // Serpentine Floyd–Steinberg distributes error in both directions,
    // avoiding the diagonal streaks of a one-direction pass.
    const direction = y % 2 === 0 ? 1 : -1;
    for (let j = 0; j < columns; j++) {
      const x = direction === 1 ? j : columns - 1 - j;
      const i = y * columns + x;
      if (settings.algorithm === "ordered") {
        const threshold = (BAYER_8[(y % 8) * 8 + x % 8] + .5) / 64 - .5;
        dots[i] = clamp(Math.round(tones[i] / step + threshold) * step);
      } else {
        const old = tones[i];
        const next = Math.round(clamp(old) / step) * step;
        dots[i] = next;
        const error = old - next;
        if (x + direction >= 0 && x + direction < columns) tones[i + direction] += error * 7 / 16;
        if (y + 1 < rows) {
          if (x - direction >= 0 && x - direction < columns) tones[i + columns - direction] += error * 3 / 16;
          tones[i + columns] += error * 5 / 16;
          if (x + direction >= 0 && x + direction < columns) tones[i + columns + direction] += error / 16;
        }
      }
    }
  }

  const output = new Uint8ClampedArray(source.length);
  const strength = settings.strength / 100;
  const wash = settings.color / 100;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const gray = luminance(source[i], source[i + 1], source[i + 2]);
      const tone = adjust(gray);
      const dot = dots[Math.floor(y / grain) * columns + Math.floor(x / grain)];
      const ink = tone + (dot - tone) * strength;
      // A translucent wash of the original over the grayscale ink preserves
      // image structure while restoring more color with each successive preset.
      for (let c = 0; c < 3; c++) output[i + c] = ink * (1 - wash) + adjust(source[i + c]) * wash;
      output[i + 3] = source[i + 3];
    }
  }
  return output;
}
