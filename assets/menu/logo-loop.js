// Horizontal React Bits LogoLoop behavior adapted to this site's plain HTML.
(() => {
  "use strict";
  const loop = document.querySelector(".logoloop");
  if (!loop) return;

  const track = loop.querySelector(".logoloop__track");
  const sequence = track.querySelector(".logoloop__list");
  const desktop = matchMedia("(min-width: 701px)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const speed = Number(loop.dataset.speed) || 60;
  const smoothTau = 0.25;
  let sequenceWidth = 0;
  let offset = 0;
  let velocity = 0;
  let lastTimestamp = null;
  let frame = null;

  function stop() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    lastTimestamp = null;
  }

  function animate(timestamp) {
    const delta = lastTimestamp === null ? 0 : Math.min((timestamp - lastTimestamp) / 1000, 0.1);
    lastTimestamp = timestamp;
    const paused = loop.matches(":hover, :focus-within");
    const target = paused ? 0 : speed;
    velocity += (target - velocity) * (1 - Math.exp(-delta / smoothTau));
    offset = (offset + velocity * delta) % sequenceWidth;
    track.style.transform = `translate3d(${-offset}px, 0, 0)`;

    if (paused && velocity < 0.1) {
      velocity = 0;
      stop();
      return;
    }
    frame = requestAnimationFrame(animate);
  }

  function updateAnimation() {
    if (!desktop.matches || reducedMotion.matches || document.hidden || !sequenceWidth) {
      stop();
      velocity = 0;
      return;
    }
    if (frame === null) frame = requestAnimationFrame(animate);
  }

  function updateDimensions() {
    if (!desktop.matches || reducedMotion.matches) {
      updateAnimation();
      return;
    }
    sequenceWidth = sequence.getBoundingClientRect().width;
    if (sequenceWidth > 0) {
      const copiesNeeded = Math.max(2, Math.ceil(loop.clientWidth / sequenceWidth) + 2);
      while (track.children.length < copiesNeeded) {
        const copy = sequence.cloneNode(true);
        copy.setAttribute("aria-hidden", "true");
        // Keep future real links in repeated sequences out of keyboard navigation.
        copy.querySelectorAll("a").forEach((link) => link.setAttribute("tabindex", "-1"));
        track.append(copy);
      }
      while (track.children.length > copiesNeeded) track.lastElementChild.remove();
      offset %= sequenceWidth;
      track.style.transform = `translate3d(${-offset}px, 0, 0)`;
    }
    updateAnimation();
  }

  loop.addEventListener("mouseenter", updateAnimation);
  loop.addEventListener("mouseleave", updateAnimation);
  loop.addEventListener("focusin", updateAnimation);
  loop.addEventListener("focusout", updateAnimation);
  desktop.addEventListener("change", updateDimensions);
  reducedMotion.addEventListener("change", updateDimensions);
  document.addEventListener("visibilitychange", updateAnimation);
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(loop);
    observer.observe(sequence);
  } else {
    window.addEventListener("resize", updateDimensions);
  }
  updateDimensions();
})();
