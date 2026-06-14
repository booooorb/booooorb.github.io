  function drawInternetExplorerSpecks(center, singularity) {
    const explorer = state.internetExplorer;
    if (!explorer.specks.length || singularity?.phase === "expand" || singularity?.phase === "collapse" || singularity?.phase === "blackout") {
      return;
    }

    const convergeT = singularity?.phase === "converge"
      ? cubicEaseInOut(clamp(singularity.age / INTERNET_EXPLORER_CONVERGE_DURATION, 0, 1))
      : 0;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const speck of explorer.specks) {
      const orbitPoint = internetExplorerOrbitPoint(center, speck.phase, speck.radiusScale);
      const point = convergeT > 0
        ? lerpPt(orbitPoint, singularity.center, convergeT)
        : orbitPoint;
      const twinkle = Math.sin(state.time * 8.5 + speck.seed) * 0.5 + 0.5;
      const depthScale = lerp(0.72, 1.18, speck.depth || 0);
      const pullGlow = 1 + convergeT * 1.8;
      ctx.shadowColor = "rgba(255, 255, 255, 0.72)";
      ctx.shadowBlur = (2 + twinkle * 3) * pullGlow;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.72 + twinkle * 0.24})`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, (speck.size * depthScale + twinkle * 0.22) * pullGlow, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawInternetExplorerSingularity() {
    const singularity = state.internetExplorer.singularity;
    if (!singularity || singularity.phase === "blackout") {
      return;
    }

    const center = singularity.center;
    let radius = 0;
    let alpha = 0.94;
    let ringAlpha = 0.38;

    if (singularity.phase === "converge") {
      const t = cubicEaseInOut(clamp(singularity.age / INTERNET_EXPLORER_CONVERGE_DURATION, 0, 1));
      radius = lerp(4, 24, t);
      alpha = lerp(0.12, 0.86, t);
      ringAlpha = lerp(0.14, 0.54, t);
    } else if (singularity.phase === "expand") {
      const t = 1 - Math.pow(1 - clamp(singularity.age / INTERNET_EXPLORER_EXPAND_DURATION, 0, 1), 3);
      radius = lerp(26, singularity.maxRadius, t);
      alpha = lerp(0.98, 0.86, t);
      ringAlpha = lerp(0.62, 0.2, t);
    } else if (singularity.phase === "collapse") {
      const t = cubicEaseInOut(clamp(singularity.age / INTERNET_EXPLORER_COLLAPSE_DURATION, 0, 1));
      radius = lerp(singularity.maxRadius, 2.2, t);
      alpha = lerp(0.82, 0.98, t);
      ringAlpha = lerp(0.28, 0.76, t);
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = "rgba(255, 255, 255, 0.95)";
    ctx.shadowBlur = Math.max(18, radius * 0.08);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, TAU);
    ctx.fill();

    ctx.lineCap = "round";
    for (let i = 0; i < 4; i += 1) {
      const phase = state.time * 6 + i * 1.3 + singularity.seed;
      const localRadius = Math.max(2, radius * (0.18 + i * 0.2) + Math.sin(phase) * 5);
      ctx.strokeStyle = `rgba(255, 255, 255, ${ringAlpha * (1 - i * 0.12)})`;
      ctx.lineWidth = lerp(6, 1.2, i / 3);
      ctx.beginPath();
      ctx.arc(center.x, center.y, localRadius, phase, phase + Math.PI * 1.35);
      ctx.stroke();
    }

    if (singularity.phase === "collapse") {
      const collapseT = clamp(singularity.age / INTERNET_EXPLORER_COLLAPSE_DURATION, 0, 1);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.22 + collapseT * 0.42})`;
      ctx.lineWidth = 1.4 + collapseT * 2.4;
      for (let i = 0; i < 18; i += 1) {
        const angle = singularity.seed + i * (TAU / 18) + state.time * 1.8;
        const from = pt(
          center.x + Math.cos(angle) * radius * lerp(0.18, 0.72, collapseT),
          center.y + Math.sin(angle) * radius * lerp(0.18, 0.72, collapseT)
        );
        const to = pt(
          center.x + Math.cos(angle + 0.28) * Math.max(2, radius * 0.06),
          center.y + Math.sin(angle + 0.28) * Math.max(2, radius * 0.06)
        );
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawInternetExplorerHalo() {
    const explorer = state.internetExplorer;
    if (!explorer.active || !state.desktopApps.internetExplorer?.owned) {
      return;
    }

    const center = internetExplorerCenter();
    const pulse = Math.sin(explorer.pulse * 1.3) * 0.5 + 0.5;

    drawInternetExplorerSpecks(center, explorer.singularity);
    drawInternetExplorerSingularity();

    if (internetExplorerIconHidden()) {
      return;
    }

    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(explorer.haloAngle);
    ctx.globalCompositeOperation = "lighter";

    ctx.strokeStyle = `rgba(244, 198, 55, ${0.22 + pulse * 0.14})`;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.ellipse(0, 0, 108, 52, 0, 0, TAU);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 240, 142, ${0.28 + pulse * 0.2})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 104, 50, 0, 0, TAU);
    ctx.stroke();

    ctx.strokeStyle = `rgba(65, 174, 238, ${0.1 + pulse * 0.12})`;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.ellipse(0, 0, 118, 58, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.font = `700 10px ${DESKTOP_FONT}`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
    ctx.shadowColor = "rgba(7, 42, 92, 0.9)";
    ctx.shadowBlur = 3;
    ctx.fillText(`orbits ${explorer.orbitCount}`, center.x + 82, center.y - 44);
    ctx.restore();
  }

  function drawInternetExplorerBlackoutFlash() {
    const singularity = state.internetExplorer.singularity;
    if (singularity?.phase !== "blackout" || singularity.age > 0.48) {
      return;
    }

    const t = clamp(singularity.age / 0.48, 0, 1);
    const flash = 1 - cubicEaseInOut(t);
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.92})`;
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(255, 255, 255, ${flash * 0.42})`;
    ctx.lineWidth = 2 + flash * 7;
    const center = internetExplorerBlackHoleCenter();
    const radius = lerp(Math.hypot(state.width, state.height) * 0.42, 22, cubicEaseInOut(t));
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawInternetExplorerReturnTransition() {
    const transition = state.internetExplorer.returnTransition;
    if (!transition) {
      return;
    }

    const t = clamp(transition.age / Math.max(transition.duration, 0.001), 0, 1);
    const fade = 1 - cubicEaseInOut(t);
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(0, 0, 0, ${fade * 0.92})`;
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(255, 255, 255, ${fade * 0.28})`;
    ctx.lineWidth = 2 + fade * 5;
    const radius = lerp(28, Math.hypot(state.width, state.height) * 0.38, cubicEaseInOut(t));
    ctx.beginPath();
    ctx.arc(transition.center.x, transition.center.y, radius, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
