// Average the area covered by each output pixel. Bilinear downsampling can
// skip alternating ink dots, creating bands instead of fine newspaper grain.
export function resamplePixels(input, width, height, outputWidth, outputHeight) {
  if (outputWidth === width && outputHeight === height) return input;
  const result = new Uint8ClampedArray(outputWidth * outputHeight * 4);
  const scaleX = width / outputWidth;
  const scaleY = height / outputHeight;
  const area = scaleX * scaleY;
  for (let y = 0; y < outputHeight; y++) {
    const top = y * scaleY;
    const bottom = (y + 1) * scaleY;
    for (let x = 0; x < outputWidth; x++) {
      const left = x * scaleX;
      const right = (x + 1) * scaleX;
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = Math.floor(top); sy < Math.ceil(bottom) && sy < height; sy++) {
        const overlapY = Math.min(bottom, sy + 1) - Math.max(top, sy);
        for (let sx = Math.floor(left); sx < Math.ceil(right) && sx < width; sx++) {
          const weight = overlapY * (Math.min(right, sx + 1) - Math.max(left, sx));
          const i = (sy * width + sx) * 4;
          r += input[i] * weight;
          g += input[i + 1] * weight;
          b += input[i + 2] * weight;
          a += input[i + 3] * weight;
        }
      }
      const i = (y * outputWidth + x) * 4;
      result[i] = r / area;
      result[i + 1] = g / area;
      result[i + 2] = b / area;
      result[i + 3] = a / area;
    }
  }
  return result;
}
