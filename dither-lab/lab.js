import { resamplePixels } from "../assets/dither/resample.js";

const BASE = { algorithm: "diffusion", grain: 1, strength: 100, color: 0, contrast: 100, brightness: 0, levels: 2 };
const PRESETS = [
  { name: "Newsprint · fine", note: "Fine stipple", settings: { ...BASE } },
  { name: "Newsprint · ordered", note: "Ordered screen", settings: { ...BASE, algorithm: "ordered" } },
  { name: "A trace of color", note: "12% color wash", settings: { ...BASE, color: 12 } },
  { name: "Soft color", note: "24% color wash", settings: { ...BASE, color: 24 } },
  { name: "Washed color", note: "38% color wash", settings: { ...BASE, color: 38 } },
  { name: "Deepest color wash", note: "55% color wash", settings: { ...BASE, color: 55 } },
];
const STORAGE_KEY = "jy-dither-lab-v1";
const $ = (selector) => document.querySelector(selector);
const form = $("#controls");
const fieldset = $("#settings");
const canvas = $("#live-preview");
const original = $("#original-image");
const editor = $("#editor");
const compare = $("#show-original");
const download = $("#download-png");
const loadStatus = $("#load-status");
// Keep a native-resolution master for every print. Visible canvases are
// resampled by pixel-area coverage at their display size to avoid moiré
// from the browser's CSS canvas scaling of one-pixel ink patterns.
const masters = new Map();
const masterPixels = new WeakMap();
const resizeObserver = new ResizeObserver((entries) => {
  for (const { target } of entries) paintPreview(target);
});
let selected = 0;
let settings = { ...BASE };
let worker;
let width;
let height;
let revision = 0;
let renderedRevision = -1;
let liveBusy = false;
let frame;
let ready = false;
let completedPresets = 0;
let drafts = {};

function paintPreview(target) {
  const master = masters.get(target);
  if (!master || !target.clientWidth) return;
  const displayWidth = Math.min(master.width, Math.round(target.clientWidth * devicePixelRatio));
  const displayHeight = Math.round(displayWidth * master.height / master.width);
  if (target.width !== displayWidth) target.width = displayWidth;
  if (target.height !== displayHeight) target.height = displayHeight;
  const context = target.getContext("2d");
  if (displayWidth === master.width && displayHeight === master.height) {
    context.drawImage(master, 0, 0);
    return;
  }
  const pixels = resamplePixels(masterPixels.get(master).data, master.width, master.height, displayWidth, displayHeight);
  const result = new ImageData(pixels, displayWidth, displayHeight);
  context.putImageData(result, 0, 0);
}

function setMaster(target, pixels) {
  let master = masters.get(target);
  if (!master) {
    master = document.createElement("canvas");
    master.width = width;
    master.height = height;
    masters.set(target, master);
    resizeObserver.observe(target);
  }
  master.getContext("2d").putImageData(pixels, 0, 0);
  masterPixels.set(master, pixels);
  paintPreview(target);
}

function validateSettings(value) {
  if (!value || !["diffusion", "ordered"].includes(value.algorithm)) return null;
  const ranges = { grain: [1, 3], strength: [0, 100], color: [0, 65], contrast: [70, 140], brightness: [-20, 20], levels: [2, 4] };
  const valid = { algorithm: value.algorithm };
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (!Number.isInteger(value[key]) || value[key] < min || value[key] > max) return null;
    valid[key] = value[key];
  }
  return valid;
}

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved && Number.isInteger(saved.selected) && PRESETS[saved.selected]) {
    selected = saved.selected;
    for (let i = 0; i < PRESETS.length; i++) {
      const draft = validateSettings(saved.drafts?.[i]);
      if (draft) drafts[i] = draft;
    }
    settings = { ...(drafts[selected] || PRESETS[selected].settings) };
  }
} catch { /* Local storage is optional, including in private browsing. */ }

function save() {
  drafts[selected] = { ...settings };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ selected, drafts }));
    $("#saved-note").textContent = "Your adjustments are saved in this browser, separately for each preset.";
  } catch {
    $("#saved-note").textContent = "Storage is unavailable. Adjustments will last for this visit.";
  }
}

const presetButtons = PRESETS.map((preset, index) => {
  const button = document.createElement("button");
  button.className = "preset";
  button.type = "button";
  button.disabled = true;
  button.dataset.preset = index;
  button.setAttribute("aria-controls", "editor");
  button.setAttribute("aria-label", `Adjust preset ${index + 1}: ${preset.name}, ${preset.settings.color}% color`);
  const art = document.createElement("span");
  art.className = "preset-art";
  const preview = document.createElement("canvas");
  preview.width = 800;
  preview.height = 608;
  preview.setAttribute("aria-hidden", "true");
  const number = document.createElement("span");
  number.className = "preset-number";
  number.textContent = String(index + 1).padStart(2, "0");
  art.append(preview, number);
  const titleRow = document.createElement("span");
  titleRow.className = "preset-title-row";
  const title = document.createElement("span");
  title.className = "preset-title";
  title.textContent = preset.name;
  const action = document.createElement("span");
  action.className = "preset-action";
  action.textContent = "Adjust ↓";
  titleRow.append(title, action);
  const meta = document.createElement("span");
  meta.className = "preset-meta";
  meta.textContent = `${index < 2 ? "Grayscale · " + preset.note.toLowerCase() : preset.note} · 1 px`;
  button.append(art, titleRow, meta);
  button.addEventListener("click", () => {
    selected = index;
    settings = { ...(drafts[index] || preset.settings) };
    compare.checked = false;
    syncControls();
    save();
    requestRender();
    $("#editor-title").focus({ preventScroll: true });
    editor.scrollIntoView({ behavior: "instant", block: "start" });
  });
  $("#preset-grid").append(button);
  return button;
});

function syncControls() {
  for (const [name, value] of Object.entries(settings)) {
    form.elements.namedItem(name).value = value;
    const output = $(`#${name}-output`);
    if (output) {
      const label = name === "grain" ? `${value} px` : name === "brightness" ? `${value > 0 ? "+" : ""}${value}` : `${value}%`;
      output.textContent = label;
      form.elements.namedItem(name).setAttribute("aria-valuetext", label);
    }
  }
  const modified = Object.keys(BASE).some((key) => settings[key] !== PRESETS[selected].settings[key]);
  const name = `${String(selected + 1).padStart(2, "0")} / ${PRESETS[selected].name}${modified ? " · adjusted" : ""}`;
  $("#selection-name").textContent = name;
  canvas.setAttribute("aria-label", `Desktop Goose dither preview: ${settings.color}% color, ${settings.grain} pixel grain, ${settings.strength}% dither strength`);
  presetButtons.forEach((button, index) => {
    button.setAttribute("aria-pressed", String(index === selected));
    button.querySelector(".preset-action").textContent = index === selected ? "Selected ↓" : "Adjust ↓";
  });
  updateComparison();
}

function updateComparison() {
  canvas.hidden = compare.checked || renderedRevision < 0;
  if (!canvas.hidden) paintPreview(canvas);
  $("#preview-label").textContent = compare.checked ? "Original / no processing" : "Dithered preview";
}

function sendLiveRender() {
  if (!ready || liveBusy) return;
  liveBusy = true;
  worker.postMessage({ type: "live", id: revision, settings: { ...settings } });
}

function requestRender() {
  revision++;
  editor.setAttribute("aria-busy", "true");
  download.disabled = true;
  $("#render-status").textContent = "Rendering…";
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(sendLiveRender);
}

form.addEventListener("submit", (event) => event.preventDefault());
form.addEventListener("input", (event) => {
  const name = event.target.name;
  if (!(name in BASE)) return;
  settings[name] = name === "algorithm" ? event.target.value : Number(event.target.value);
  syncControls();
  save();
  requestRender();
});
compare.addEventListener("change", updateComparison);
$("#reset-preset").addEventListener("click", () => {
  settings = { ...PRESETS[selected].settings };
  compare.checked = false;
  syncControls();
  save();
  requestRender();
});
for (const [id, actual] of [["fit-view", false], ["actual-view", true]]) {
  $(`#${id}`).addEventListener("click", () => {
    $("#preview-viewport").classList.toggle("actual-size", actual);
    $("#fit-view").setAttribute("aria-pressed", String(!actual));
    $("#actual-view").setAttribute("aria-pressed", String(actual));
  });
}
download.addEventListener("click", () => {
  if (renderedRevision !== revision) return;
  const presetNumber = String(selected + 1).padStart(2, "0");
  masters.get(canvas).toBlob((blob) => {
    if (!blob) {
      $("#render-status").textContent = "Export failed. Please try again.";
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `desktop-goose-dither-${presetNumber}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }, "image/png");
});

function fail(error) {
  console.error("Dither lab:", error);
  ready = false;
  worker?.terminate();
  fieldset.disabled = true;
  presetButtons.forEach((button) => { button.disabled = true; });
  editor.setAttribute("aria-busy", "false");
  loadStatus.hidden = false;
  loadStatus.classList.add("error-message");
  loadStatus.textContent = "The dither previews could not load. Reload this page to try again.";
  $("#render-status").textContent = "Preview unavailable";
}

async function init() {
  syncControls();
  await original.decode();
  width = original.naturalWidth;
  height = original.naturalHeight;
  $("#source-size").textContent = `${width} × ${height} / original resolution`;
  $("#preview-stage").style.setProperty("--source-width", `${width}px`);
  canvas.width = width;
  canvas.height = height;
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(original, 0, 0);
  const source = context.getImageData(0, 0, width, height);
  worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  worker.onerror = fail;
  worker.onmessage = ({ data }) => {
    if (data.type === "error") { fail(data.message); return; }
    const pixels = new ImageData(new Uint8ClampedArray(data.buffer), width, height);
    if (data.type === "preset") {
      const preview = presetButtons[data.id].querySelector("canvas");
      setMaster(preview, pixels);
      completedPresets++;
      if (completedPresets === PRESETS.length) {
        loadStatus.hidden = true;
        presetButtons.forEach((button) => { button.disabled = false; });
      }
      return;
    }
    if (data.type === "live") {
      liveBusy = false;
      if (data.id !== revision) { sendLiveRender(); return; }
      setMaster(canvas, pixels);
      renderedRevision = data.id;
      editor.setAttribute("aria-busy", "false");
      $("#render-status").textContent = `${width} × ${height} · ready`;
      download.disabled = false;
      updateComparison();
    }
  };
  worker.postMessage({ type: "init", width, height, buffer: source.data.buffer }, [source.data.buffer]);
  ready = true;
  fieldset.disabled = false;
  requestRender();
  PRESETS.forEach((preset, id) => worker.postMessage({ type: "preset", id, settings: preset.settings }));
}

init().catch(fail);
