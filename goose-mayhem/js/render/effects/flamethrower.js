  function drawFlamethrowerRig() {
    if (!state.flamethrower.active || !state.pointer.inside) {
      return;
    }

    const direction = state.flamethrower.aimDir;
    const { base, nozzle } = flamethrowerRigGeometry();
    const pulse = Math.sin(state.flamethrower.pulse * 1.8) * 0.5 + 0.5;
    const interactive = state.flamethrower.grabbed;
    const glow = state.flamethrower.firing
      ? 0.34 + pulse * 0.18
      : 0.18 + pulse * 0.08;
    const effectImage = state.flamethrower.effectImage;

    ctx.save();
    if (effectImage?.complete && effectImage.naturalWidth > 0) {
      const center = lerpPt(base, nozzle, 0.48);
      const width = interactive ? 142 + pulse * 10 : 126 + pulse * 8;
      const height = width * 0.78;
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.shadowColor = `rgba(255, 126, 48, ${glow})`;
      ctx.shadowBlur = state.flamethrower.firing ? 20 : 10;
      ctx.drawImage(effectImage, -width * 0.5, -height * 0.5, width, height);
      ctx.restore();
    } else {
      if (glow > 0) {
        ctx.strokeStyle = `rgba(255, 198, 116, ${glow})`;
        ctx.lineWidth = interactive ? 34 : 28;
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(nozzle.x, nozzle.y);
        ctx.stroke();
      }

      ctx.lineCap = "round";
      ctx.strokeStyle = interactive ? "rgba(92, 99, 109, 0.96)" : "rgba(83, 90, 99, 0.94)";
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(nozzle.x, nozzle.y);
      ctx.stroke();

      ctx.strokeStyle = "rgba(185, 194, 204, 0.82)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(add(base, mul(perp(direction), -2.5)).x, add(base, mul(perp(direction), -2.5)).y);
      ctx.lineTo(add(nozzle, mul(perp(direction), -1.2)).x, add(nozzle, mul(perp(direction), -1.2)).y);
      ctx.stroke();

      ctx.fillStyle = state.flamethrower.firing
        ? `rgba(255, 150, 80, ${0.42 + pulse * 0.24})`
        : interactive
          ? "rgba(108, 114, 124, 0.96)"
          : "rgba(73, 79, 88, 0.88)";
      ctx.beginPath();
      ctx.arc(nozzle.x, nozzle.y, 10, 0, TAU);
      ctx.fill();
    }

    if (state.flamethrower.firing) {
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 4; i += 1) {
        const bloomOffset = add(
          mul(direction, 8 + i * 8),
          mul(perp(direction), Math.sin(state.time * 18 + i) * (4 + i * 1.6))
        );
        const bloomCenter = add(nozzle, bloomOffset);
        ctx.fillStyle = i === 0 ? COLORS.flameCore : i < 3 ? COLORS.flameMid : COLORS.flameEdge;
        ctx.globalAlpha = 0.8 - i * 0.14;
        ctx.beginPath();
        ctx.ellipse(
          bloomCenter.x,
          bloomCenter.y,
          11 + i * 6,
          6 + i * 2.4,
          Math.atan2(direction.y, direction.x),
          0,
          TAU
        );
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawFlameJet() {
    if (!state.flamethrower.active || !state.flamethrower.firing || !state.pointer.inside) {
      return;
    }

    const origin = flamethrowerEmissionPoint();
    const direction = state.flamethrower.aimDir;
    const side = perp(direction);
    const pulse = Math.sin(state.flamethrower.pulse * 1.9) * 0.5 + 0.5;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (let i = 0; i < 11; i += 1) {
      const bloomCenter = add(
        origin,
        add(
          mul(direction, 10 + i * 14),
          mul(side, Math.sin(state.time * 17 + i * 1.4) * (18 + i * 5))
        )
      );
      ctx.globalAlpha = 0.26 + i * 0.05;
      ctx.fillStyle = i < 3 ? COLORS.flameCore : i < 6 ? COLORS.flameMid : COLORS.flameEdge;
      ctx.beginPath();
      ctx.ellipse(
        bloomCenter.x,
        bloomCenter.y,
        22 + i * 8,
        14 + i * 4.6,
        Math.atan2(direction.y, direction.x) + Math.sin(state.time * 11 + i) * 0.08,
        0,
        TAU
      );
      ctx.fill();
    }

    for (let i = 0; i < 12; i += 1) {
      const sprayDir = norm(add(direction, mul(side, Math.sin(state.time * 12 + i * 0.8) * 0.52 + lerp(-0.62, 0.34, i / 11))));
      const splashCenter = add(
        origin,
        add(
          mul(sprayDir, 34 + i * 16 + pulse * 16),
          mul(side, Math.cos(state.time * 15 + i) * (12 + i * 3.6))
        )
      );
      ctx.save();
      ctx.translate(splashCenter.x, splashCenter.y);
      ctx.rotate(Math.atan2(sprayDir.y, sprayDir.x));
      ctx.globalAlpha = 0.2 + pulse * 0.14;
      ctx.fillStyle = i < 2 ? COLORS.flameCore : i < 5 ? COLORS.flameMid : COLORS.flameEdge;
      ctx.beginPath();
      ctx.ellipse(
        24 + i * 4,
        0,
        38 + i * 8,
        10 + Math.sin(state.time * 22 + i) * 4,
        0,
        0,
        TAU
      );
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawSmokeParticles() {
    for (const particle of state.flamethrower.smokeParticles) {
      const life = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = (1 - life) * 0.38;
      ctx.fillStyle = COLORS.smoke;
      ctx.beginPath();
      ctx.arc(particle.pos.x, particle.pos.y, particle.size * (1.04 - life * 0.24), 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawEmberParticles() {
    for (const particle of state.flamethrower.emberParticles) {
      const life = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.save();
      ctx.translate(particle.pos.x, particle.pos.y);
      ctx.rotate(particle.angle);
      ctx.globalAlpha = life * 0.95;
      ctx.fillStyle = COLORS.ember;
      ctx.fillRect(-particle.size * 0.6, -particle.size * 0.6, particle.size * 1.2, particle.size * 1.2);
      ctx.restore();
    }
  }

  function drawFlameParticles() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const particle of state.flamethrower.flameParticles) {
      const life = clamp(particle.life / particle.maxLife, 0, 1);
      const velocityDir = mag(particle.vel) > 1 ? norm(particle.vel) : state.flamethrower.aimDir;
      const angle = Math.atan2(velocityDir.y, velocityDir.x);
      const stretch = 0.6 + life * 1.3;
      ctx.save();
      ctx.translate(particle.pos.x, particle.pos.y);
      ctx.rotate(angle);
      ctx.globalAlpha = life * 0.36;
      ctx.fillStyle = COLORS.flameEdge;
      ctx.beginPath();
      ctx.ellipse(0, 0, particle.size * stretch, particle.size * 0.42, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = life * 0.52;
      ctx.fillStyle = COLORS.flameMid;
      ctx.beginPath();
      ctx.ellipse(0, 0, particle.size * stretch * 0.68, particle.size * 0.26, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = life * 0.62;
      ctx.fillStyle = COLORS.flameCore;
      ctx.beginPath();
      ctx.ellipse(0, 0, particle.size * stretch * 0.34, particle.size * 0.14, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawFlamethrowerReticle() {
    return;
  }
