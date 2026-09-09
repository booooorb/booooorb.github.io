import { renderDither } from "./dither.js";

let source;
let width;
let height;

self.onmessage = ({ data }) => {
  if (data.type === "init") {
    source = new Uint8ClampedArray(data.buffer);
    width = data.width;
    height = data.height;
    return;
  }
  try {
    const pixels = renderDither(source, width, height, data.settings);
    self.postMessage({ type: data.type, id: data.id, buffer: pixels.buffer }, [pixels.buffer]);
  } catch (error) {
    self.postMessage({ type: "error", message: error.message });
  }
};
