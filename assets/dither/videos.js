import { resamplePixels } from "./resample.js";

// One player per project is moved between its card and dialog. Keeping the
// element preserves both the playback position and the browser's decoded frame.
export function installVideoPreviews(dither) {
  const dialog = document.querySelector("#info-dialog");
  const states = new Map();
  const surfaces = new WeakMap();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const hoverInput = matchMedia("(hover: hover)");
  let dialogState;

  function fade(state, target, initial) {
    const from = initial ?? Number(getComputedStyle(state.canvas).opacity);
    state.fade?.cancel();
    state.canvas.style.opacity = String(target);
    const duration = parseFloat(getComputedStyle(state.surface).getPropertyValue("--preview-reveal-duration"));
    if (!reducedMotion.matches && from !== target) {
      state.fade = state.canvas.animate([{ opacity: from }, { opacity: target }], {
        duration: duration * Math.abs(target - from), easing: "linear",
      });
    }
  }

  function renderFrame(state) {
    const { master, surface, canvas } = state;
    if (!master || !surface.clientWidth || !surface.clientHeight) return;
    const fit = getComputedStyle(state.video).objectFit;
    const scaleX = surface.clientWidth / master.width;
    const scaleY = surface.clientHeight / master.height;
    const zoom = Number(surface.style.getPropertyValue("--preview-zoom")) || 1;
    const scale = (fit === "cover" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY)) * zoom;
    const ratio = devicePixelRatio || 1;
    const width = Math.max(1, Math.min(master.width, Math.round(master.width * scale * ratio)));
    const height = Math.max(1, Math.min(master.height, Math.round(master.height * scale * ratio)));
    if (state.paintedMaster !== master || canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      const pixels = resamplePixels(master.pixels, master.width, master.height, width, height);
      canvas.getContext("2d").putImageData(new ImageData(pixels, width, height), 0, 0);
      state.paintedMaster = master;
    }
    if (state.ready) surface.classList.add("is-ready");
  }

  function fitPreview(state) {
    const { video, surface } = state;
    // Fill the frame for landscape clips; preserve the full portrait/square image.
    const landscape = video.videoWidth > video.videoHeight;
    const fit = landscape ? "cover" : "contain";
    const zoom = landscape ? Math.max(1, Number(state.card.dataset.videoZoom) || 1) : 1;
    surface.style.setProperty("--preview-object-fit", fit);
    surface.style.setProperty("--preview-zoom", String(zoom));
    renderFrame(state);
  }

  const resizeObserver = new ResizeObserver((entries) => {
    for (const { target } of entries) renderFrame(surfaces.get(target));
  });

  async function prepareFrame(state) {
    const version = state.version;
    if (state.preparing === version || state.video.readyState < 2) return;
    state.preparing = version;
    try {
      // Capture immediately, then process only this still in the shared worker.
      // Video playback itself never runs through a per-frame CPU dither loop.
      const master = await dither.processFrame(state.video, 1280);
      if (state.version !== version) return;
      state.master = master;
      const poster = state.surface.parentElement.querySelector(".preview-dither");
      const initial = state.ready ? 0 : poster ? Number(getComputedStyle(poster).opacity) : 1;
      // First paint is already fully dithered. Only returning from playback
      // fades the paused frame back in; startup must never reveal raw video.
      fade(state, state.active ? 0 : 1, state.active ? initial : state.ready ? 0 : 1);
      state.ready = true;
      renderFrame(state);
    } catch {
      if (state.version !== version) return;
      // A failed filter must never hide a playable clip or its last frame.
      state.ready = true;
      state.surface.classList.add("is-ready");
      fade(state, 0, 0);
    }
  }

  function createPlayer(state) {
    const surface = document.createElement("div");
    surface.className = "preview-video-surface";
    surface.setAttribute("aria-hidden", "true");
    const video = document.createElement("video");
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.disablePictureInPicture = true;
    video.tabIndex = -1;
    if (new URL(state.card.dataset.video, document.baseURI).origin !== location.origin) video.crossOrigin = "anonymous";
    const source = document.createElement("source");
    source.type = "video/mp4";
    source.src = state.card.dataset.video;
    video.append(source);
    const canvas = document.createElement("canvas");
    canvas.className = "preview-video-dither";
    surface.append(video, canvas);
    Object.assign(state, { surface, video, canvas });
    surfaces.set(surface, state);
    resizeObserver.observe(surface);
    video.addEventListener("loadedmetadata", () => fitPreview(state));
    video.addEventListener("loadeddata", () => {
      if (!state.ready) prepareFrame(state);
    });
    video.addEventListener("playing", () => {
      if (!state.active) video.pause();
      else if (!state.ready) prepareFrame(state);
    });
    const unavailable = () => {
      state.failed = true;
      state.active = false;
      state.version += 1;
      video.pause();
      state.fade?.cancel();
      surface.remove();
      resizeObserver.unobserve(surface);
    };
    video.addEventListener("error", unavailable);
    source.addEventListener("error", unavailable);
  }

  function attach(state, host) {
    if (!state.video) createPlayer(state);
    if (state.failed) return;
    host.append(state.surface);
    fitPreview(state);
  }

  function play(state) {
    if (state.failed) return;
    state.active = true;
    state.version += 1;
    if (!state.video) attach(state, state.media);
    if (state.ready) fade(state, 0);
    else prepareFrame(state);
    const version = state.version;
    state.video.play().catch(() => {
      // Autoplay can be blocked by device settings. Keep the still and allow
      // another attempt on the next explicit hover or dialog opening.
      if (state.version === version && !state.failed) freeze(state);
    });
  }

  function freeze(state) {
    state.active = false;
    state.version += 1;
    if (!state.video || state.failed) return;
    state.video.pause();
    // Discard any overlay from an older pause before filtering the new frame.
    fade(state, 0, 0);
    prepareFrame(state);
  }

  function update(state) {
    const active = !document.hidden && (state === dialogState
      ? dialog.open
      : !dialog.open && state.visible && !state.suppressed && !reducedMotion.matches && (state.hovered || state.focused));
    if (active === state.active) return;
    if (active) play(state);
    else freeze(state);
  }

  const visibilityObserver = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      const state = states.get(target);
      state.visible = isIntersecting;
      if (!isIntersecting) state.hovered = false;
      update(state);
    }
  });

  for (const card of document.querySelectorAll(".project-card[data-video]:not([data-video=''])")) {
    const state = {
      card, media: card.querySelector(".project-media"), version: 0, active: false, visible: true,
      hovered: hoverInput.matches && card.matches(":hover"), focused: card.matches(":focus-visible"),
    };
    states.set(card, state);
    attach(state, state.media);
    state.video.load();
    visibilityObserver.observe(card);
    card.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch") return;
      state.hovered = true;
      state.suppressed = false;
      update(state);
    });
    card.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "touch") return;
      state.hovered = false;
      update(state);
    });
    card.addEventListener("focusin", () => {
      state.focused = card.matches(":focus-visible");
      state.suppressed = false;
      update(state);
    });
    card.addEventListener("focusout", () => {
      state.focused = false;
      update(state);
    });
  }

  function returnToCard(state) {
    freeze(state);
    state.suppressed = true;
    state.hovered = false;
    if (state.video && !state.failed) attach(state, state.media);
  }

  function openPreview(target, card) {
    const next = states.get(card);
    if (dialogState && dialogState !== next) returnToCard(dialogState);
    dialogState = next;
    for (const state of states.values()) {
      if (state !== next && state.active) freeze(state);
    }
    if (!next || next.failed) return;
    attach(next, target.querySelector(".project-media") || target);
    if (!document.hidden) play(next);
  }
  document.addEventListener("preview:open", ({ target, detail }) => openPreview(target, detail.card));
  // An overview may have opened while this module was still downloading.
  if (dialog.open) {
    const card = [...states.keys()].find((card) => card.getAttribute("href") === dialog.dataset.project);
    openPreview(document.querySelector("#dialog-preview"), card);
  }
  dialog.addEventListener("close", () => {
    if (dialogState) returnToCard(dialogState);
    dialogState = undefined;
  });
  document.addEventListener("visibilitychange", () => states.forEach(update));
  reducedMotion.addEventListener("change", () => {
    for (const state of states.values()) {
      state.fade?.finish();
      update(state);
    }
  });
  window.addEventListener("pagehide", () => states.forEach(freeze));
}
