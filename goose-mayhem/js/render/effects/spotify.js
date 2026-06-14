  function drawSpotifyWaves() {
    const waves = state.spotify.waves;
    if (!waves.length) {
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const wave of waves) {
      if (wave.age < 0) {
        continue;
      }
      const t = clamp(wave.age / wave.duration, 0, 1);
      const radius = wave.radius * cubicEaseInOut(t);
      const fade = 1 - clamp((t - 0.34) / 0.66, 0, 1);
      const alpha = clamp(t / 0.16, 0, 1) * fade;

      ctx.strokeStyle = `rgba(52, 255, 104, ${alpha * 0.74})`;
      ctx.lineWidth = 7 + alpha * 5;
      ctx.beginPath();
      ctx.arc(wave.origin.x, wave.origin.y, radius, 0, TAU);
      ctx.stroke();

      ctx.strokeStyle = `rgba(172, 255, 190, ${alpha * 0.48})`;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(wave.origin.x, wave.origin.y, Math.max(0, radius - 24), 0, TAU);
      ctx.stroke();

      const glow = ctx.createRadialGradient(
        wave.origin.x, wave.origin.y, 0,
        wave.origin.x, wave.origin.y, Math.max(wave.directRadius, radius * 0.5)
      );
      glow.addColorStop(0, `rgba(30, 215, 96, ${alpha * 0.3})`);
      glow.addColorStop(0.34, `rgba(30, 215, 96, ${alpha * 0.14})`);
      glow.addColorStop(1, "rgba(30, 215, 96, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(wave.origin.x, wave.origin.y, Math.max(wave.directRadius, radius * 0.5), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
