  function drawThunderStrikePath(path) {
    if (!path?.length) {
      return;
    }

    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i += 1) {
      ctx.lineTo(path[i].x, path[i].y);
    }
  }

  function drawWeatherRain() {
    const thunder = state.thunder;
    if (!thunder.rainDrops.length && !thunder.active) {
      return;
    }

    if (thunder.active) {
      ctx.save();
      ctx.fillStyle = motionQuery.matches
        ? "rgba(50, 86, 128, 0.045)"
        : "rgba(38, 73, 116, 0.075)";
      ctx.fillRect(0, 0, state.width, state.height);
      ctx.restore();
    }

    if (!thunder.rainDrops.length) {
      return;
    }

    ctx.save();
    ctx.lineCap = "round";
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = motionQuery.matches ? 1.05 : 1.35;
    for (const drop of thunder.rainDrops) {
      const life = clamp(drop.life / drop.maxLife, 0, 1);
      const fadeIn = clamp((drop.maxLife - drop.life) / 0.14, 0, 1);
      const alpha = drop.alpha * Math.min(life * 1.7, fadeIn);
      const direction = norm(drop.vel);
      const tail = mul(direction, -drop.length);
      ctx.strokeStyle = `rgba(188, 225, 255, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(drop.pos.x, drop.pos.y);
      ctx.lineTo(drop.pos.x + tail.x, drop.pos.y + tail.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawThunderEffects() {
    drawWeatherRain();

    const thunder = state.thunder;
    const active = thunder.strikes.length
      || thunder.scorches.length
      || thunder.sparks.length
      || thunder.vaporizing.length
      || thunder.flash > 0;
    if (!active) {
      return;
    }

    if (thunder.flash > 0) {
      const alpha = clamp(Math.pow(thunder.flash, 0.72) * 0.78, 0, 0.78);
      ctx.save();
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      ctx.fillStyle = `rgba(222, 240, 255, ${alpha})`;
      ctx.fillRect(0, 0, state.width, state.height);
      ctx.restore();
    }

    for (const victim of thunder.vaporizing) {
      const t = clamp(victim.age / victim.duration, 0, 1);
      const fade = 1 - t;
      ctx.save();
      ctx.translate(victim.pos.x, victim.pos.y);
      ctx.globalAlpha = fade;
      drawCargoSnapshotFace(victim.cargo, { showClose: false });

      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(176, 224, 255, ${0.16 + fade * 0.24})`;
      ctx.fillRect(-8, -8, victim.cargo.width + 16, victim.cargo.height + 16);

      ctx.strokeStyle = `rgba(236, 248, 255, ${0.24 + fade * 0.5})`;
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 6; i += 1) {
        const x = (victim.cargo.width / 5) * i + Math.sin(victim.seed + state.time * 26 + i) * 6;
        ctx.beginPath();
        ctx.moveTo(x, 4);
        ctx.lineTo(x + Math.sin(victim.seed + i * 0.7 + state.time * 30) * 10, victim.cargo.height - 4);
        ctx.stroke();
      }

      ctx.globalCompositeOperation = "destination-out";
      for (let i = 0; i < 9; i += 1) {
        const biteT = clamp((t - i * 0.06) / 0.46, 0, 1);
        if (biteT <= 0) continue;
        const x = victim.cargo.width * (0.1 + i * 0.09) + Math.sin(victim.seed + i * 1.6) * 10;
        const y = victim.cargo.height * (0.16 + (i % 4) * 0.18);
        const radius = lerp(6, 30, biteT);
        ctx.beginPath();
        ctx.ellipse(x, y, radius, radius * 0.6, state.time * 3 + i, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    if (thunder.scorches.length) {
      ctx.save();
      for (const scorch of thunder.scorches) {
        const life = clamp(1 - scorch.age / scorch.duration, 0, 1);
        const darkAlpha = 0.16 + life * 0.26;
        const heatAlpha = life * 0.24;

        ctx.save();
        ctx.translate(scorch.point.x, scorch.point.y);
        ctx.rotate(scorch.angle);

        const heatRing = ctx.createRadialGradient(
          0, 0, scorch.radiusY * 0.2,
          0, 0, scorch.radiusX * 1.4
        );
        heatRing.addColorStop(0, `rgba(255, 228, 118, ${heatAlpha})`);
        heatRing.addColorStop(0.32, `rgba(255, 193, 74, ${heatAlpha * 0.9})`);
        heatRing.addColorStop(1, "rgba(255, 193, 74, 0)");
        ctx.fillStyle = heatRing;
        ctx.beginPath();
        ctx.ellipse(0, 0, scorch.radiusX * 1.26, scorch.radiusY * 1.6, 0, 0, TAU);
        ctx.fill();

        ctx.fillStyle = `rgba(39, 25, 16, ${darkAlpha})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, scorch.radiusX, scorch.radiusY, 0, 0, TAU);
        ctx.fill();

        ctx.fillStyle = `rgba(18, 12, 9, ${darkAlpha * 0.72})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, scorch.radiusX * 0.62, scorch.radiusY * 0.48, 0, 0, TAU);
        ctx.fill();

        ctx.restore();
      }
      ctx.restore();
    }

    if (thunder.strikes.length) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation = "lighter";
      for (const strike of thunder.strikes) {
        const t = clamp(strike.age / strike.duration, 0, 1);
        const fade = t <= 0.24 ? 1 : clamp(1 - (t - 0.24) / 0.76, 0, 1);

        ctx.strokeStyle = `rgba(255, 196, 72, ${0.22 + fade * 0.28})`;
        ctx.lineWidth = 58 * fade + 26;
        drawThunderStrikePath(strike.path);
        ctx.stroke();

        ctx.strokeStyle = `rgba(255, 218, 108, ${0.34 + fade * 0.32})`;
        ctx.lineWidth = 38 * fade + 14;
        drawThunderStrikePath(strike.path);
        ctx.stroke();

        ctx.strokeStyle = `rgba(255, 238, 176, ${0.54 + fade * 0.28})`;
        ctx.lineWidth = 22 * fade + 7.5;
        drawThunderStrikePath(strike.path);
        ctx.stroke();

        ctx.strokeStyle = `rgba(249, 252, 255, ${0.74 + fade * 0.18})`;
        ctx.lineWidth = 10 * fade + 4;
        drawThunderStrikePath(strike.path);
        ctx.stroke();

        for (const branchPath of strike.branches) {
          ctx.strokeStyle = `rgba(255, 232, 158, ${fade * 0.5})`;
          ctx.lineWidth = 4.8 + fade * 3.6;
          drawThunderStrikePath(branchPath);
          ctx.stroke();
        }

        const impact = ctx.createRadialGradient(
          strike.point.x, strike.point.y, 0,
          strike.point.x, strike.point.y, 176
        );
        impact.addColorStop(0, `rgba(255, 248, 214, ${fade * 0.78})`);
        impact.addColorStop(0.16, `rgba(255, 218, 110, ${fade * 0.48})`);
        impact.addColorStop(0.42, `rgba(255, 184, 72, ${fade * 0.2})`);
        impact.addColorStop(1, "rgba(255, 184, 72, 0)");
        ctx.fillStyle = impact;
        ctx.beginPath();
        ctx.arc(strike.point.x, strike.point.y, 176, 0, TAU);
        ctx.fill();

        const halo = ctx.createRadialGradient(
          strike.point.x, strike.point.y, 0,
          strike.point.x, strike.point.y, 260
        );
        halo.addColorStop(0, `rgba(255, 232, 164, ${fade * 0.22})`);
        halo.addColorStop(0.34, `rgba(255, 204, 92, ${fade * 0.14})`);
        halo.addColorStop(1, "rgba(255, 204, 92, 0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(strike.point.x, strike.point.y, 260, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    if (thunder.sparks.length) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const spark of thunder.sparks) {
        const alpha = clamp(spark.life / spark.maxLife, 0, 1);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(spark.pos.x, spark.pos.y);
        ctx.rotate(spark.angle);
        ctx.fillStyle = COLORS.thunderSpark;
        ctx.fillRect(-spark.size * 0.6, -spark.size * 0.2, spark.size * 1.2, spark.size * 0.4);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  function drawThunderCursor() {
    if (!state.thunder.active || !state.pointer.inside) {
      return;
    }

    const point = state.pointer.pos;
    const pulse = Math.sin(state.thunder.pulse * 1.8) * 0.5 + 0.5;
    const jitter = Math.sin(state.thunder.cursorJitter) * 1.8;

    ctx.save();
    ctx.translate(point.x + jitter, point.y);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(158, 214, 255, ${0.26 + pulse * 0.18})`;
    ctx.beginPath();
    ctx.arc(0, 0, 22 + pulse * 6, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "rgba(232, 247, 255, 0.98)";
    ctx.beginPath();
    ctx.moveTo(-4, -28);
    ctx.lineTo(10, -6);
    ctx.lineTo(0, -6);
    ctx.lineTo(10, 18);
    ctx.lineTo(-12, -2);
    ctx.lineTo(-1, -2);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `rgba(194, 232, 255, ${0.42 + pulse * 0.34})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, 17 + pulse * 4, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
