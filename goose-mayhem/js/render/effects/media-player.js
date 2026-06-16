  function drawMediaPlayerShockwave() {
    const wave = state.mediaPlayer.shockwave;
    if (!wave) {
      return;
    }

    const t = clamp(wave.age / wave.duration, 0, 1);
    const outPhase = t <= 0.55;
    const outT = clamp(t / 0.55, 0, 1);
    const inT = clamp((t - 0.55) / 0.45, 0, 1);
    const outEase = 1 - Math.pow(1 - outT, 3);
    const inEase = inT * inT * (3 - 2 * inT);
    const radius = outPhase
      ? lerp(18, wave.maxRadius, outEase)
      : lerp(wave.maxRadius, 18, inEase);
    const phasePulse = outPhase ? outT : 1 - inT;
    const pulseAlpha = outPhase
      ? clamp(1 - t * 0.12, 0.82, 1)
      : clamp(0.9 - inT * 0.18, 0.68, 0.9);
    const flashAlpha = Math.max(0, 1 - t * 4.2);

    ctx.save();
    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.62 * flashAlpha})`;
      ctx.fillRect(0, 0, state.width, state.height);
    }

    ctx.translate(wave.origin.x, wave.origin.y);
    ctx.globalCompositeOperation = "lighter";

    const glow = ctx.createRadialGradient(0, 0, Math.max(4, radius * 0.18), 0, 0, radius * 1.08);
    glow.addColorStop(0, `rgba(255, 255, 255, ${outPhase ? 0.36 * (1 - outT) : 0.24 * inT})`);
    glow.addColorStop(0.45, `rgba(86, 215, 255, ${0.18 * pulseAlpha})`);
    glow.addColorStop(0.7, `rgba(255, 70, 120, ${0.16 * pulseAlpha})`);
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.08, 0, TAU);
    ctx.fill();

    const chroma = [
      { offset: -18, color: `rgba(255, 28, 78, ${0.78 * pulseAlpha})` },
      { offset: 0, color: `rgba(255, 255, 255, ${0.96 * pulseAlpha})` },
      { offset: 18, color: `rgba(10, 238, 255, ${0.78 * pulseAlpha})` },
      { offset: Math.sin(wave.seed + t * TAU) * 30, color: `rgba(180, 76, 255, ${0.52 * pulseAlpha})` },
    ];

    for (const ring of chroma) {
      const r = Math.max(4, radius + ring.offset);
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = lerp(48, 14, t);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
    }

    for (let i = 0; i < 18; i += 1) {
      const angle = wave.seed + (TAU / 18) * i + Math.sin(t * TAU + i) * 0.04;
      const spokeNoise = fract(Math.sin((i + 1) * 12.9898 + wave.seed * 78.233) * 43758.5453);
      const length = radius * lerp(0.74, 1.08, spokeNoise);
      ctx.strokeStyle = `hsla(${(i * 31 + t * 220) % 360}, 100%, 72%, ${0.34 * pulseAlpha})`;
      ctx.lineWidth = outPhase ? lerp(10, 5, outT) : lerp(5, 9, inT);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * Math.max(10, radius * 0.24), Math.sin(angle) * Math.max(10, radius * 0.24));
      ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
      ctx.stroke();
    }

    for (let i = 0; i < 6; i += 1) {
      const local = outPhase
        ? clamp((outT - i * 0.055) / 0.78, 0, 1)
        : clamp((1 - inT - i * 0.055) / 0.78, 0, 1);
      if (local <= 0 || local >= 1) {
        continue;
      }
      const localEase = 1 - Math.pow(1 - local, 2);
      const bandRadius = outPhase
        ? lerp(32, wave.maxRadius * 0.98, localEase)
        : lerp(wave.maxRadius * 0.98, 32, localEase);
      ctx.strokeStyle = `hsla(${(wave.seed * 90 + i * 58 + t * 260) % 360}, 100%, 70%, ${0.5 * (1 - local) * (0.55 + phasePulse * 0.45)})`;
      ctx.lineWidth = 18 * (1 - local) + 2;
      ctx.beginPath();
      ctx.arc(0, 0, bandRadius, 0, TAU);
      ctx.stroke();
    }

    if (!outPhase) {
      const collapseGlow = Math.sin(inT * Math.PI);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.54 * collapseGlow})`;
      ctx.beginPath();
      ctx.arc(0, 0, lerp(86, 18, inEase), 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawMediaPlayerResumeIndicator() {
    const wave = state.mediaPlayer.resumeWave;
    if (!wave) {
      return;
    }

    const t = clamp(wave.age / wave.duration, 0, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    const radius = lerp(34, wave.maxRadius, ease);
    const alpha = 1 - t;
    const ringCount = 4;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255, 255, 255, ${0.24 * Math.sin(Math.PI * t)})`;
    ctx.fillRect(0, 0, state.width, state.height);

    ctx.translate(wave.origin.x, wave.origin.y);
    for (let i = 0; i < ringCount; i += 1) {
      const local = clamp((t - i * 0.08) / 0.82, 0, 1);
      if (local <= 0) {
        continue;
      }
      const localRadius = lerp(22, wave.maxRadius, 1 - Math.pow(1 - local, 2));
      ctx.strokeStyle = `rgba(${i === 1 ? 255 : 80}, ${i === 0 ? 255 : 230}, 255, ${0.64 * (1 - local)})`;
      ctx.lineWidth = lerp(34, 5, local);
      ctx.beginPath();
      ctx.arc(0, 0, localRadius, 0, TAU);
      ctx.stroke();
    }

    for (let i = 0; i < 12; i += 1) {
      const angle = wave.seed + (TAU / 12) * i + t * 0.18;
      const inner = radius * 0.16;
      const outer = radius * lerp(0.34, 0.86, fract(Math.sin((i + 3) * 19.17) * 9182.28));
      ctx.strokeStyle = `rgba(126, 255, 232, ${0.36 * alpha})`;
      ctx.lineWidth = lerp(7, 2, t);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = "screen";
    const wash = Math.sin(Math.PI * t);
    ctx.fillStyle = `rgba(136, 236, 255, ${0.16 * wash})`;
    ctx.fillRect(-wave.origin.x, -wave.origin.y, state.width, state.height);
    ctx.restore();
  }

  function drawMediaPlayerEffects() {
    drawMediaPlayerShockwave();
    drawMediaPlayerResumeIndicator();
  }
