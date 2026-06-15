  const chromeDroidElements = new Map();

  function clearChromeDroidElements() {
    for (const element of chromeDroidElements.values()) {
      element.remove();
    }
    chromeDroidElements.clear();
  }

  function syncChromeDroidElements() {
    if (!stage) {
      return;
    }

    const liveIds = new Set();
    for (const droid of state.chrome.droids) {
      liveIds.add(droid.id);
      let element = chromeDroidElements.get(droid.id);
      if (!element) {
        element = document.createElement("img");
        element.className = "chrome-droid-gif";
        element.src = CHROME_DROID_EFFECT_PATH;
        element.alt = "";
        element.setAttribute("aria-hidden", "true");
        stage.append(element);
        chromeDroidElements.set(droid.id, element);
      }

      const bob = Math.sin(state.time * 4.4 + droid.seed) * 3.4;
      const size = droid.size * (1 + Math.sin(state.time * 6.2 + droid.seed) * 0.035);
      const angle = droid.banking + Math.sin(state.time * 2.1 + droid.seed) * 0.08;
      const facing = Math.abs(droid.vel.x) > 10
        ? (droid.vel.x > 0 ? 1 : -1)
        : (droid.facing || 1);
      const flip = facing > 0 ? -1 : 1;

      element.style.width = `${size}px`;
      element.style.height = `${size}px`;
      element.style.opacity = internetExplorerBlackoutActive() ? "0" : "1";
      element.style.transform = `translate(${droid.pos.x - size / 2}px, ${droid.pos.y + bob - size / 2}px) rotate(${angle}rad) scaleX(${flip})`;
    }

    for (const [id, element] of chromeDroidElements) {
      if (liveIds.has(id)) {
        continue;
      }
      element.remove();
      chromeDroidElements.delete(id);
    }
  }

  function drawChromeLaserPaths() {
    if (!state.chrome.paths.length) {
      return;
    }

    ctx.save();
    for (const path of state.chrome.paths) {
      const t = clamp(path.age / path.duration, 0, 1);
      const alpha = 1 - Math.pow(t, 1.8);
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.translate(path.end.x, path.end.y);
      ctx.rotate(Math.atan2(path.direction.y, path.direction.x));
      ctx.fillStyle = `rgba(7, 5, 4, ${0.5 * alpha})`;
      for (let i = 0; i < 6; i += 1) {
        const noise = fract(Math.sin(path.seed * 97.31 + i * 18.17) * 43758.5453);
        const lane = (i - 2.5) / 2.5;
        const dabX = lane * path.radius * 0.34 + (noise - 0.5) * 5;
        const dabY = (fract(noise * 13.7) - 0.5) * path.radius * 0.26;
        const dabW = path.radius * (0.58 + noise * 0.34) * (1 + t * 0.18);
        const dabH = path.radius * (0.24 + noise * 0.16);
        ctx.beginPath();
        ctx.ellipse(dabX, dabY, dabW, dabH, (noise - 0.5) * 0.5, 0, TAU);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(255, 66, 32, ${0.13 * alpha})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, path.radius * 0.78, path.radius * 0.32, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawChromeActiveBeams() {
    if (!state.chrome.droids.some((droid) => droid.laser)) {
      return;
    }

    ctx.save();
    ctx.lineCap = "round";
    ctx.globalCompositeOperation = "lighter";
    for (const droid of state.chrome.droids) {
      const beam = droid.laser;
      if (!beam) {
        continue;
      }
      const t = clamp(beam.age / beam.duration, 0, 1);
      const fadeIn = clamp(beam.age / 0.08, 0, 1);
      const fadeOut = clamp((beam.duration - beam.age) / 0.12, 0, 1);
      const alpha = Math.min(fadeIn, fadeOut);
      const jitter = Math.sin(state.time * 92 + beam.seed) * 1.1;
      const offset = mul(perp(norm(sub(beam.end, beam.start))), jitter);

      ctx.shadowColor = `rgba(255, 15, 12, ${alpha * 0.88})`;
      ctx.shadowBlur = 18 * alpha;
      ctx.strokeStyle = `rgba(255, 14, 12, ${alpha * 0.42})`;
      ctx.lineWidth = beam.width * 2.2;
      ctx.beginPath();
      ctx.moveTo(beam.start.x + offset.x, beam.start.y + offset.y);
      ctx.lineTo(beam.end.x - offset.x, beam.end.y - offset.y);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 40, 30, ${alpha * 0.88})`;
      ctx.lineWidth = beam.width * 0.92;
      ctx.beginPath();
      ctx.moveTo(beam.start.x - offset.x * 0.35, beam.start.y - offset.y * 0.35);
      ctx.lineTo(beam.end.x + offset.x * 0.35, beam.end.y + offset.y * 0.35);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 235, 205, ${alpha * 0.96})`;
      ctx.lineWidth = Math.max(1.1, beam.width * 0.2);
      ctx.beginPath();
      ctx.moveTo(beam.start.x, beam.start.y);
      ctx.lineTo(beam.end.x, beam.end.y);
      ctx.stroke();

      const firePulse = Math.sin(state.time * 24 + beam.seed) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(255, 61, 35, ${alpha * (0.5 + firePulse * 0.16)})`;
      ctx.beginPath();
      ctx.arc(beam.end.x, beam.end.y, 4 + alpha * 5, 0, TAU);
      ctx.fill();

      ctx.fillStyle = `rgba(255, 190, 82, ${alpha * (0.52 + firePulse * 0.22)})`;
      for (let i = 0; i < 4; i += 1) {
        const flameAngle = -Math.PI / 2 + (i - 1.5) * 0.32 + Math.sin(state.time * 18 + beam.seed + i) * 0.18;
        const flameLength = 8 + firePulse * 6 + i * 1.2;
        const flameWidth = 2.4 + firePulse * 1.7;
        ctx.save();
        ctx.translate(beam.end.x, beam.end.y);
        ctx.rotate(flameAngle);
        ctx.beginPath();
        ctx.ellipse(0, -flameLength * 0.45, flameWidth, flameLength, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawChromeDroids() {
    syncChromeDroidElements();
    ctx.save();
    for (const droid of state.chrome.droids) {
      const charge = droid.laser
        ? 1
        : Math.max(0, 1 - Math.abs(droid.nextFireAt - droid.age) / 0.22);
      if (charge > 0) {
        const facing = Math.abs(droid.vel.x) > 10
          ? (droid.vel.x > 0 ? 1 : -1)
          : (droid.facing || 1);
        const eye = pt(
          droid.pos.x,
          droid.pos.y + Math.sin(state.time * 4.4 + droid.seed) * 3.4
        );
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `rgba(255, 40, 34, ${charge * 0.42})`;
        ctx.beginPath();
        ctx.arc(eye.x, eye.y, droid.size * (0.16 + charge * 0.07), 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
    }
    ctx.restore();
  }

  function drawChromeExplosions() {
    if (!state.chrome.explosions.length) {
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const explosion of state.chrome.explosions) {
      const t = clamp(explosion.age / explosion.duration, 0, 1);
      const alpha = 1 - cubicEaseInOut(t);
      const radius = lerp(explosion.radius * 0.35, explosion.radius * 1.75, cubicEaseInOut(t));

      ctx.fillStyle = `rgba(255, 244, 204, ${alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(explosion.pos.x, explosion.pos.y, radius * 0.44, 0, TAU);
      ctx.fill();

      ctx.strokeStyle = `rgba(255, 42, 28, ${alpha * 0.72})`;
      ctx.lineWidth = 3 + alpha * 4;
      ctx.beginPath();
      ctx.arc(explosion.pos.x, explosion.pos.y, radius, 0, TAU);
      ctx.stroke();

      ctx.fillStyle = `rgba(255, 118, 46, ${alpha * 0.68})`;
      for (let i = 0; i < 7; i += 1) {
        const angle = explosion.seed + i * (TAU / 7) + t * 0.8;
        const point = add(explosion.pos, mul(angleVec(angle), radius * lerp(0.38, 1.08, t)));
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2 + alpha * 4, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawChromeBeams() {
    drawChromeLaserPaths();
    drawChromeActiveBeams();
    drawChromeDroids();
    drawChromeExplosions();
  }

  function drawChromeCursor() {}
