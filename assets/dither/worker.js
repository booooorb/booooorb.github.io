import { renderDither } from "./dither.js";

self.onmessage = ({ data }) => {
  const { id, width, height, settings, buffer } = data;
  try {
    const pixels = renderDither(new Uint8ClampedArray(buffer), width, height, settings);
    self.postMessage({ id, width, height, buffer: pixels.buffer }, [pixels.buffer]);
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
