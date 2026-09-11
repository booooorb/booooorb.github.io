import { resamplePixels } from "./resample.js";

// Apply one shared preset to existing and subsequently inserted preview images.
// Image sources are never replaced, so opening a cloned thumbnail cannot
// accidentally apply the dither a second time.
export function installPreviewDither(settings) {
  const selector = ".project-media img, .dialog-preview img";
  const records = new Map();
  const cache = new Map();
  const preloads = new Map();
  const requests = new Map();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let requestId = 0;
  let worker;
  let frame;
  let stopped = false;

  function getWorker() {
    if (worker) return worker;
    worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      const pending = requests.get(data.id);
      if (!pending) return;
      requests.delete(data.id);
      if (data.error) pending.reject(new Error(data.error));
      else pending.resolve({ width: data.width, height: data.height, pixels: new Uint8ClampedArray(data.buffer) });
    };
    worker.onerror = () => {
      for (const pending of requests.values()) pending.reject(new Error("Preview worker unavailable"));
      requests.clear();
      stopped = true;
      worker.terminate();
      document.documentElement.classList.remove("previews-enhanced");
      // Restore originals if processing is unsupported or fails to initialize.
      for (const [image, record] of records) {
        image.classList.remove("dither-ready", "dither-pending");
        record.reveal?.cancel();
        record.canvas?.remove();
      }
    };
    return worker;
  }

  function processFrame(source, maxDimension = Infinity) {
    return new Promise((resolve, reject) => {
      if (stopped) throw new Error("Preview worker unavailable");
      const sourceWidth = source.videoWidth || source.naturalWidth;
      const sourceHeight = source.videoHeight || source.naturalHeight;
      if (!sourceWidth || !sourceHeight) throw new Error("Preview frame unavailable");
      const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      const scratch = document.createElement("canvas");
      scratch.width = width;
      scratch.height = height;
      const context = scratch.getContext("2d", { willReadFrequently: true });
      context.drawImage(source, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height);
      const activeWorker = getWorker();
      const id = ++requestId;
      requests.set(id, { resolve, reject });
      activeWorker.postMessage({ id, width, height, settings, buffer: pixels.data.buffer }, [pixels.data.buffer]);
    });
  }

  function processSource(image, source) {
    if (cache.has(source)) {
      const cached = cache.get(source);
      cache.delete(source);
      cache.set(source, cached);
      return cached.promise;
    }
    const entry = {};
    const promise = processFrame(image).then((master) => {
      entry.master = master;
      return master;
    });
    entry.promise = promise;
    cache.set(source, entry);
    // Bound retained masters while allowing a thumbnail and its dialog to share.
    if (cache.size > 16) cache.delete(cache.keys().next().value);
    promise.catch(() => cache.delete(source));
    return promise;
  }

  function preload(source) {
    if (!source || stopped) return;
    const url = new URL(source, document.baseURI).href;
    if (preloads.has(url)) return preloads.get(url);
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    const ready = image.decode().then(() => processSource(image, url)).catch(() => {
      // The visible image handles its own fallback if this optional warmup fails.
      preloads.delete(url);
    });
    preloads.set(url, ready);
    return ready;
  }

  function paint(image, record) {
    if (stopped || !record.master || !image.isConnected || !image.clientWidth || !image.clientHeight) return;
    const { width, height, pixels } = record.master;
    const style = getComputedStyle(image);
    const fit = style.objectFit;
    const scaleX = image.clientWidth / width;
    const scaleY = image.clientHeight / height;
    const scale = fit === "cover" ? Math.max(scaleX, scaleY) : fit === "none" ? 1 : Math.min(scaleX, scaleY, fit === "scale-down" ? 1 : Infinity);
    const pixelRatio = window.devicePixelRatio || 1;
    const outputWidth = Math.max(1, Math.min(width, Math.round(width * (fit === "fill" ? scaleX : scale) * pixelRatio)));
    const outputHeight = Math.max(1, Math.min(height, Math.round(height * (fit === "fill" ? scaleY : scale) * pixelRatio)));
    const firstPaint = !record.canvas;
    if (firstPaint) {
      record.canvas = document.createElement("canvas");
      record.canvas.className = "preview-dither";
      record.canvas.setAttribute("aria-hidden", "true");
      image.after(record.canvas);
    }
    const canvas = record.canvas;
    Object.assign(canvas.style, {
      left: `${image.offsetLeft}px`, top: `${image.offsetTop}px`,
      width: `${image.clientWidth}px`, height: `${image.clientHeight}px`,
      objectFit: fit, objectPosition: style.objectPosition, filter: style.filter,
    });
    if (firstPaint || record.paintedMaster !== record.master || canvas.width !== outputWidth || canvas.height !== outputHeight) {
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const resized = resamplePixels(pixels, width, height, outputWidth, outputHeight);
      canvas.getContext("2d").putImageData(new ImageData(resized, outputWidth, outputHeight), 0, 0);
      record.paintedMaster = record.master;
    }
    image.classList.add("dither-ready");
    image.classList.remove("dither-pending");
    if (firstPaint && image.closest(".dialog-preview") && !reducedMotion.matches) {
      // Keep the same fade speed when moving from a thumbnail into its dialog.
      const start = record.revealStart ?? 1;
      const duration = parseFloat(getComputedStyle(canvas).getPropertyValue("--preview-reveal-duration"));
      if (start > 0) record.reveal = canvas.animate([{ opacity: start }, { opacity: 0 }], {
        duration: duration * start,
        easing: "linear",
      });
    }
  }

  const resizeObserver = new ResizeObserver((entries) => {
    for (const { target } of entries) {
      const record = records.get(target);
      if (record) paint(target, record);
    }
  });

  async function update(image, inherited) {
    if (stopped || !image.matches(selector)) return;
    let record = records.get(image);
    if (!record) {
      // cloneNode copies classes and empty canvases, but not canvas pixels.
      image.classList.remove("dither-ready", "dither-pending", "dither-fallback");
      if (image.nextElementSibling?.classList.contains("preview-dither")) image.nextElementSibling.remove();
      record = { version: 0, revealStart: inherited?.opacity ?? 1 };
      const source = image.currentSrc || image.src;
      const master = inherited?.source === source ? inherited.master : cache.get(source)?.master;
      if (master) {
        record.master = master;
        record.source = source;
      }
      records.set(image, record);
      resizeObserver.observe(image);
      paint(image, record);
    }
    const version = ++record.version;
    try {
      await image.decode();
      if (records.get(image) !== record || record.version !== version || !image.isConnected || stopped) return;
      const source = image.currentSrc || image.src;
      if (record.source !== source) {
        image.classList.remove("dither-ready");
        if (record.canvas) record.revealStart = Number(getComputedStyle(record.canvas).opacity);
        record.reveal?.cancel();
        record.canvas?.remove();
        record.canvas = null;
        record.master = null;
      }
      const master = await processSource(image, source);
      if (records.get(image) !== record || record.version !== version || !image.isConnected || stopped) return;
      record.source = source;
      record.master = master;
      paint(image, record);
    } catch (error) {
      if (records.get(image) !== record || record.version !== version) return;
      record.master = null;
      record.reveal?.cancel();
      record.canvas?.remove();
      record.canvas = null;
      image.classList.remove("dither-ready", "dither-pending");
      image.classList.add("dither-fallback");
      console.warn("Could not dither this preview; showing its original image.", error.message);
    }
  }

  const observer = new MutationObserver((mutations) => {
    const changed = new Set();
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.target.matches(selector)) {
        mutation.target.classList.remove("dither-ready", "dither-fallback");
        changed.add(mutation.target);
      }
      if (mutation.attributeName === "data-preview") preload(mutation.target.dataset.preview);
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches(selector)) changed.add(node);
        node.querySelectorAll(selector).forEach((image) => changed.add(image));
        if (node.matches("[data-preview]")) preload(node.dataset.preview);
        node.querySelectorAll("[data-preview]").forEach((item) => preload(item.dataset.preview));
      }
    }
    for (const [image, record] of records) {
      if (image.isConnected && image.matches(selector)) continue;
      resizeObserver.unobserve(image);
      image.classList.remove("dither-ready", "dither-pending");
      record.reveal?.cancel();
      record.canvas?.remove();
      records.delete(image);
    }
    changed.forEach((image) => update(image));
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["src", "srcset", "sizes", "data-preview"] });
  document.addEventListener("preview:open", ({ target, detail }) => {
    const sourceImage = detail.source?.querySelector("img");
    const sourceRecord = records.get(sourceImage);
    const inherited = {
      source: sourceRecord?.source,
      master: sourceRecord?.master,
      opacity: sourceRecord?.canvas ? Number(getComputedStyle(sourceRecord.canvas).opacity) : 1,
    };
    target.querySelectorAll("img").forEach((image) => update(image, inherited));
  });
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) for (const record of records.values()) record.reveal?.finish();
  });
  document.addEventListener("load", (event) => {
    if (event.target instanceof HTMLImageElement && event.target.matches(selector)) update(event.target);
  }, true);
  window.addEventListener("resize", () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      for (const [image, record] of records) paint(image, record);
    });
  });
  // Start the worker download alongside image/video fetches, not after decode.
  try { getWorker(); } catch {
    stopped = true;
    document.documentElement.classList.remove("previews-enhanced");
  }
  document.querySelectorAll(selector).forEach((image) => update(image));
  document.querySelectorAll("[data-preview]").forEach((item) => preload(item.dataset.preview));
  return { processFrame };
}
