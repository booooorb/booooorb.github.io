  function drawNukeShape(center, scale = 1, pulse = 0, armed = false) {
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(-0.18);

    ctx.fillStyle = "rgba(33, 41, 49, 0.16)";
    ctx.beginPath();
    ctx.ellipse(0, 18 * scale, 25 * scale, 9 * scale, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = COLORS.nukeFin;
    ctx.beginPath();
    ctx.moveTo(-26 * scale, -8 * scale);
    ctx.lineTo(-42 * scale, -22 * scale);
    ctx.lineTo(-40 * scale, 6 * scale);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-22 * scale, 8 * scale);
    ctx.lineTo(-38 * scale, 24 * scale);
    ctx.lineTo(-34 * scale, 6 * scale);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = COLORS.nukeBody;
    ctx.beginPath();
    ctx.ellipse(0, 0, 28 * scale, 18 * scale, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = COLORS.nukeMetal;
    ctx.beginPath();
    ctx.ellipse(8 * scale, -1 * scale, 16 * scale, 12 * scale, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = COLORS.nukeStripe;
    ctx.fillRect(-6 * scale, -14 * scale, 8 * scale, 28 * scale);
    ctx.fillRect(10 * scale, -14 * scale, 8 * scale, 28 * scale);

    ctx.fillStyle = COLORS.nukeWarning;
    ctx.beginPath();
    ctx.arc(0, 0, 6.5 * scale, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = COLORS.nukeStripe;
    ctx.lineWidth = 1.6 * scale;
    for (let i = 0; i < 3; i += 1) {
      const angle = i * (TAU / 3) + pulse * 0.06;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 2 * scale, Math.sin(angle) * 2 * scale);
      ctx.lineTo(Math.cos(angle) * 6 * scale, Math.sin(angle) * 6 * scale);
      ctx.stroke();
    }

    ctx.fillStyle = armed
      ? `rgba(255, 112, 88, ${0.58 + pulse * 0.2})`
      : "rgba(255, 192, 122, 0.78)";
    ctx.beginPath();
    ctx.arc(22 * scale, -10 * scale, 4.2 * scale, 0, TAU);
    ctx.fill();

    if (armed) {
      ctx.strokeStyle = `rgba(255, 222, 154, ${0.48 + pulse * 0.24})`;
      ctx.lineWidth = 1.8 * scale;
      for (let i = 0; i < 4; i += 1) {
        const sparkAngle = -0.8 + i * 0.45 + pulse * 0.08;
        ctx.beginPath();
        ctx.moveTo(22 * scale, -10 * scale);
        ctx.lineTo(
          22 * scale + Math.cos(sparkAngle) * (8 + i * 2) * scale,
          -10 * scale + Math.sin(sparkAngle) * (8 + i * 2) * scale
        );
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawDroppedNuke() {
    if (!state.nuke.dropping && !state.nuke.armed) {
      return;
    }

    const pulse = Math.sin(state.nuke.pulse * 1.5) * 0.5 + 0.5;
    if (state.nuke.dropping) {
      const shadowSpread = clamp((state.nuke.targetPos.y - state.nuke.pos.y) / 220, 0, 1);
      ctx.save();
      ctx.fillStyle = `rgba(39, 26, 18, ${0.1 + (1 - shadowSpread) * 0.18})`;
      ctx.beginPath();
      ctx.ellipse(
        state.nuke.targetPos.x,
        state.nuke.targetPos.y + 16,
        lerp(30, 16, shadowSpread),
        lerp(10, 5, shadowSpread),
        0,
        0,
        TAU
      );
      ctx.fill();

      ctx.strokeStyle = `rgba(255, 188, 112, ${0.14 + pulse * 0.12})`;
      ctx.lineWidth = 2.6;
      ctx.setLineDash([8, 7]);
      ctx.beginPath();
      ctx.moveTo(state.nuke.targetPos.x, state.nuke.pos.y + 24);
      ctx.lineTo(state.nuke.targetPos.x, state.nuke.targetPos.y + 10);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      drawNukeShape(state.nuke.pos, 0.96, pulse, true);
      return;
    }

    const progress = clamp((state.time - state.nuke.droppedAt) / Math.max(NUKE_FUSE, 0.001), 0, 1);
    const radius = 18 + progress * 60;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(255, 166, 92, ${0.12 + pulse * 0.16})`;
    ctx.lineWidth = 4 + pulse * 2;
    ctx.beginPath();
    ctx.arc(state.nuke.pos.x, state.nuke.pos.y + 6, radius, 0, TAU);
    ctx.stroke();
    ctx.restore();

    drawNukeShape(state.nuke.pos, 0.96, pulse, true);

    const timeLeft = Math.max(0, state.nuke.detonateAt - state.time);
    const countdown = timeLeft > 0.67 ? "3" : timeLeft > 0.34 ? "2" : "1";
    ctx.save();
    ctx.font = `700 16px ${PLAYFUL_FONT}`;
    ctx.textAlign = "center";
    ctx.fillStyle = `rgba(255, 247, 228, ${0.74 + pulse * 0.2})`;
    ctx.fillText(countdown, state.nuke.pos.x, state.nuke.pos.y - 30);
    ctx.restore();
  }

  function drawNukeCursor() {
    if (!state.nuke.active || !state.pointer.inside) {
      return;
    }

    const pulse = Math.sin(state.nuke.pulse * 1.2) * 0.5 + 0.5;
    drawNukeShape(state.pointer.pos, 0.88, pulse, false);
  }

  function drawMushroomCloud() {
    const cloudState = state.nuke.cloud;
    const cloud = mushroomCloudMetrics(cloudState);
    if (!cloud || cloud.alpha <= 0.01) {
      return;
    }

    const pulse = Math.sin(cloudState.phase * 0.9) * 0.5 + 0.5;
    const earlyBlastBoost = 0.88 + clamp(state.nuke.flash, 0, 1.2) * 0.24;
    const smokeAlpha = clamp(cloud.alpha * earlyBlastBoost, 0, 1);
    const heatAlpha = smokeAlpha * clamp(1 - cloud.lifeT * 0.78, 0, 1);
    const capPuffs = [
      { x: -0.82, y: 0.18, w: 0.34, h: 0.5, heat: 0.1 },
      { x: -0.58, y: 0.04, w: 0.46, h: 0.66, heat: 0.14 },
      { x: -0.34, y: -0.16, w: 0.58, h: 0.78, heat: 0.2 },
      { x: -0.06, y: -0.3, w: 0.78, h: 0.94, heat: 0.26 },
      { x: 0.24, y: -0.24, w: 0.68, h: 0.88, heat: 0.22 },
      { x: 0.54, y: -0.04, w: 0.46, h: 0.66, heat: 0.16 },
      { x: 0.82, y: 0.16, w: 0.34, h: 0.5, heat: 0.1 },
      { x: 0, y: 0.22, w: 1.08, h: 0.44, heat: 0.12 },
      { x: -0.28, y: 0.18, w: 0.62, h: 0.48, heat: 0.1 },
      { x: 0.3, y: 0.16, w: 0.58, h: 0.46, heat: 0.1 },
    ];

    ctx.save();
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    const baseShadow = ctx.createRadialGradient(
      cloud.headX,
      cloud.baseY + 8,
      0,
      cloud.headX,
      cloud.baseY + 8,
      cloud.capWidth * 1.1
    );
    baseShadow.addColorStop(0, `rgba(74, 50, 34, ${smokeAlpha * 0.22})`);
    baseShadow.addColorStop(1, "rgba(74, 50, 34, 0)");
    ctx.fillStyle = baseShadow;
    ctx.beginPath();
    ctx.ellipse(cloud.headX, cloud.baseY + 8, cloud.capWidth * 0.96, cloud.capHeight * 0.46, 0, 0, TAU);
    ctx.fill();

    for (let i = 0; i < 5; i += 1) {
      const t = i / 4;
      const y = lerp(cloud.baseY, cloud.headY + cloud.capHeight * 0.3, t);
      const stemW = lerp(cloud.stemWidth * 1.08, cloud.stemWidth * 0.6, t) * (0.96 + Math.sin(cloudState.phase + i) * 0.04);
      const stemH = lerp(cloud.capHeight * 0.44, cloud.capHeight * 0.28, t);
      ctx.fillStyle = `rgba(154, 112, 76, ${smokeAlpha * (0.12 + (1 - t) * 0.08)})`;
      ctx.beginPath();
      ctx.ellipse(cloud.headX, y, stemW, stemH, 0, 0, TAU);
      ctx.fill();

      ctx.fillStyle = `rgba(108, 72, 48, ${smokeAlpha * (0.26 + (1 - t) * 0.14)})`;
      ctx.beginPath();
      ctx.ellipse(cloud.headX, y - stemH * 0.08, stemW * 0.88, stemH * 0.78, 0, 0, TAU);
      ctx.fill();
    }

    const collarGlow = ctx.createRadialGradient(
      cloud.headX,
      cloud.headY + cloud.capHeight * 0.32,
      cloud.collarWidth * 0.08,
      cloud.headX,
      cloud.headY + cloud.capHeight * 0.32,
      cloud.collarWidth
    );
    collarGlow.addColorStop(0, `rgba(255, 242, 224, ${heatAlpha * 0.26})`);
    collarGlow.addColorStop(0.2, `rgba(255, 188, 150, ${heatAlpha * 0.24})`);
    collarGlow.addColorStop(0.46, `rgba(255, 104, 88, ${heatAlpha * 0.18})`);
    collarGlow.addColorStop(1, "rgba(255, 104, 88, 0)");
    ctx.fillStyle = collarGlow;
    ctx.beginPath();
    ctx.ellipse(cloud.headX, cloud.headY + cloud.capHeight * 0.34, cloud.collarWidth, cloud.collarHeight, 0, 0, TAU);
    ctx.fill();

    const underCap = ctx.createRadialGradient(
      cloud.headX,
      cloud.headY + cloud.capHeight * 0.16,
      cloud.capWidth * 0.08,
      cloud.headX,
      cloud.headY + cloud.capHeight * 0.16,
      cloud.capWidth * 0.86
    );
    underCap.addColorStop(0, `rgba(255, 228, 208, ${heatAlpha * 0.3})`);
    underCap.addColorStop(0.22, `rgba(255, 142, 120, ${heatAlpha * 0.28})`);
    underCap.addColorStop(0.48, `rgba(182, 112, 74, ${smokeAlpha * 0.2})`);
    underCap.addColorStop(1, "rgba(88, 58, 40, 0)");
    ctx.fillStyle = underCap;
    ctx.beginPath();
    ctx.ellipse(cloud.headX, cloud.headY + cloud.capHeight * 0.2, cloud.capWidth * 0.88, cloud.capHeight * 0.52, 0, 0, TAU);
    ctx.fill();

    for (const puff of capPuffs) {
      ctx.fillStyle = `rgba(208, 170, 126, ${smokeAlpha * (0.1 + puff.heat * 0.42)})`;
      ctx.beginPath();
      ctx.ellipse(
        cloud.headX + puff.x * cloud.capWidth,
        cloud.headY + puff.y * cloud.capHeight,
        cloud.capWidth * puff.w * 1.04,
        cloud.capHeight * puff.h * 1.02,
        0,
        0,
        TAU
      );
      ctx.fill();

      ctx.fillStyle = `rgba(118, 82, 58, ${smokeAlpha * (0.24 + (0.12 - puff.y * 0.08))})`;
      ctx.beginPath();
      ctx.ellipse(
        cloud.headX + puff.x * cloud.capWidth,
        cloud.headY + puff.y * cloud.capHeight,
        cloud.capWidth * puff.w,
        cloud.capHeight * puff.h,
        0,
        0,
        TAU
      );
      ctx.fill();
    }

    ctx.globalCompositeOperation = "lighter";
    const crownGlow = ctx.createRadialGradient(
      cloud.headX,
      cloud.headY + cloud.capHeight * 0.08,
      cloud.capWidth * 0.1,
      cloud.headX,
      cloud.headY + cloud.capHeight * 0.08,
      cloud.capWidth * 0.9
    );
    crownGlow.addColorStop(0, `rgba(255, 250, 246, ${heatAlpha * (0.24 + pulse * 0.05)})`);
    crownGlow.addColorStop(0.16, `rgba(255, 214, 196, ${heatAlpha * 0.26})`);
    crownGlow.addColorStop(0.34, `rgba(255, 126, 116, ${heatAlpha * 0.22})`);
    crownGlow.addColorStop(0.66, `rgba(202, 132, 92, ${heatAlpha * 0.1})`);
    crownGlow.addColorStop(1, "rgba(202, 132, 92, 0)");
    ctx.fillStyle = crownGlow;
    ctx.beginPath();
    ctx.ellipse(cloud.headX, cloud.headY + cloud.capHeight * 0.08, cloud.capWidth * 0.92, cloud.capHeight * 0.7, 0, 0, TAU);
    ctx.fill();

    const coreGlow = ctx.createRadialGradient(
      cloud.headX,
      cloud.baseY - cloud.stemHeight * 0.14,
      0,
      cloud.headX,
      cloud.baseY - cloud.stemHeight * 0.14,
      cloud.capWidth * 0.4
    );
    coreGlow.addColorStop(0, `rgba(255, 252, 248, ${heatAlpha * 0.26})`);
    coreGlow.addColorStop(0.22, `rgba(255, 224, 210, ${heatAlpha * 0.24})`);
    coreGlow.addColorStop(0.44, `rgba(255, 118, 110, ${heatAlpha * 0.22})`);
    coreGlow.addColorStop(0.72, `rgba(188, 122, 84, ${heatAlpha * 0.12})`);
    coreGlow.addColorStop(1, "rgba(188, 122, 84, 0)");
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.ellipse(cloud.headX, cloud.baseY - cloud.stemHeight * 0.14, cloud.stemWidth * 1.8, cloud.stemHeight * 0.5, 0, 0, TAU);
    ctx.fill();

    for (let i = 0; i < 4; i += 1) {
      const tongueX = cloud.headX + (i - 1.5) * cloud.capWidth * 0.16;
      const tongueY = cloud.baseY - cloud.stemHeight * (0.08 + i * 0.03);
      ctx.fillStyle = `rgba(255, 114, 104, ${heatAlpha * (0.18 + pulse * 0.03)})`;
      ctx.beginPath();
      ctx.ellipse(tongueX, tongueY, cloud.stemWidth * (0.28 + i * 0.04), cloud.stemHeight * (0.12 + i * 0.02), 0, 0, TAU);
      ctx.fill();
    }

    const topHaze = ctx.createRadialGradient(
      cloud.headX,
      cloud.headY - cloud.capHeight * 0.06,
      cloud.capWidth * 0.06,
      cloud.headX,
      cloud.headY - cloud.capHeight * 0.06,
      cloud.capWidth * 1.12
    );
    topHaze.addColorStop(0, `rgba(250, 232, 220, ${heatAlpha * 0.12})`);
    topHaze.addColorStop(0.26, `rgba(255, 158, 142, ${heatAlpha * 0.14})`);
    topHaze.addColorStop(0.52, `rgba(186, 132, 96, ${smokeAlpha * 0.12})`);
    topHaze.addColorStop(1, "rgba(186, 132, 96, 0)");
    ctx.fillStyle = topHaze;
    ctx.beginPath();
    ctx.ellipse(cloud.headX, cloud.headY - cloud.capHeight * 0.04, cloud.capWidth, cloud.capHeight * 0.76, 0, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  function drawNukeEffects() {
    const blastProgress = state.nuke.blastAge >= 0
      ? clamp(state.nuke.blastAge / NUKE_BLAST_DURATION, 0, 1)
      : -1;
    const center = state.nuke.blastPos;

    if (blastProgress >= 0) {
      const maxRadius = Math.hypot(state.width, state.height) * 0.95;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const waveOffsets = [0, 0.12, 0.25];
      for (let i = 0; i < waveOffsets.length; i += 1) {
        const waveT = clamp((blastProgress - waveOffsets[i]) / (1 - waveOffsets[i]), 0, 1);
        if (waveT <= 0) {
          continue;
        }
        const ringAlpha = Math.pow(1 - waveT, 1.18) * (0.7 - i * 0.14);
        const shockRadius = lerp(36 + i * 18, maxRadius * (0.82 + i * 0.08), waveT);
        ctx.strokeStyle = `rgba(255, 224, 178, ${ringAlpha})`;
        ctx.lineWidth = lerp(44 - i * 8, 11 - i * 1.6, waveT);
        ctx.beginPath();
        ctx.arc(center.x, center.y, shockRadius, 0, TAU);
        ctx.stroke();

        ctx.strokeStyle = `rgba(255, 130, 68, ${ringAlpha * 0.72})`;
        ctx.lineWidth = lerp(20 - i * 3, 6.5, waveT);
        ctx.beginPath();
        ctx.arc(center.x, center.y, shockRadius * 0.87, 0, TAU);
        ctx.stroke();
      }

      const bloomRadius = lerp(80, maxRadius * 0.8, blastProgress);
      const bloom = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, bloomRadius);
      bloom.addColorStop(0, `rgba(255, 247, 210, ${0.48 * (1 - blastProgress)})`);
      bloom.addColorStop(0.2, `rgba(255, 188, 104, ${0.28 * (1 - blastProgress)})`);
      bloom.addColorStop(0.46, `rgba(255, 108, 54, ${0.16 * (1 - blastProgress)})`);
      bloom.addColorStop(1, "rgba(255, 174, 88, 0)");
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(center.x, center.y, bloomRadius, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    if (state.nuke.particles.length) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const particle of state.nuke.particles) {
        const alpha = clamp(particle.life / particle.maxLife, 0, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.pos.x, particle.pos.y, particle.size, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    if (state.nuke.debris.length) {
      ctx.save();
      for (const piece of state.nuke.debris) {
        const alpha = clamp(piece.life / piece.maxLife, 0, 1);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(piece.pos.x, piece.pos.y);
        ctx.rotate(piece.angle);
        ctx.fillStyle = COLORS.nukeDebris;
        ctx.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
        ctx.restore();
      }
      ctx.restore();
    }

    if (state.nuke.flash > 0) {
      const alpha = clamp(Math.pow(state.nuke.flash, 0.62) * 0.98, 0, 0.98);
      ctx.save();
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      ctx.fillStyle = `rgba(255, 249, 235, ${alpha})`;
      ctx.fillRect(0, 0, state.width, state.height);
      const flash = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, Math.hypot(state.width, state.height) * 0.82);
      flash.addColorStop(0, `rgba(255, 255, 245, ${alpha})`);
      flash.addColorStop(0.22, `rgba(255, 244, 220, ${alpha * 0.86})`);
      flash.addColorStop(0.5, `rgba(255, 214, 156, ${alpha * 0.7})`);
      flash.addColorStop(1, "rgba(255, 232, 188, 0)");
      ctx.fillStyle = flash;
      ctx.fillRect(0, 0, state.width, state.height);
      ctx.restore();
    }

    if (state.nuke.scorch > 0) {
      const alpha = state.nuke.scorch;
      const recoveryAlpha = Math.pow(alpha, 0.86);
      const heatAlpha = Math.pow(alpha, 1.08);
      ctx.save();
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

      ctx.fillStyle = `rgba(24, 17, 13, ${recoveryAlpha * 0.3})`;
      ctx.fillRect(0, 0, state.width, state.height);

      const heatBloom = ctx.createRadialGradient(
        center.x,
        center.y,
        0,
        center.x,
        center.y,
        Math.hypot(state.width, state.height) * 0.88
      );
      heatBloom.addColorStop(0, `rgba(122, 52, 18, ${heatAlpha * 0.2})`);
      heatBloom.addColorStop(0.22, `rgba(54, 24, 12, ${heatAlpha * 0.26})`);
      heatBloom.addColorStop(0.58, `rgba(16, 12, 10, ${heatAlpha * 0.32})`);
      heatBloom.addColorStop(1, `rgba(6, 6, 7, ${recoveryAlpha * 0.4})`);
      ctx.fillStyle = heatBloom;
      ctx.fillRect(0, 0, state.width, state.height);

      const groundGlow = ctx.createRadialGradient(
        center.x,
        center.y + 24,
        0,
        center.x,
        center.y + 24,
        Math.min(state.width, state.height) * 0.62
      );
      groundGlow.addColorStop(0, `rgba(255, 132, 62, ${heatAlpha * 0.18})`);
      groundGlow.addColorStop(0.34, `rgba(255, 95, 34, ${heatAlpha * 0.13})`);
      groundGlow.addColorStop(0.68, `rgba(255, 88, 28, ${recoveryAlpha * 0.06})`);
      groundGlow.addColorStop(1, "rgba(255, 95, 34, 0)");
      ctx.fillStyle = groundGlow;
      ctx.fillRect(0, 0, state.width, state.height);

      for (const fire of state.nuke.aftermathFires) {
        const fireAlpha = recoveryAlpha * clamp(fire.life / fire.maxLife, 0, 1);
        const flicker = 0.72 + 0.28 * Math.sin(fire.phase);
        const plumeW = fire.size * (0.74 + flicker * 0.34);
        const plumeH = fire.size * (1.1 + flicker * 0.5);
        ctx.save();
        ctx.translate(fire.pos.x, fire.pos.y + 12);
        ctx.fillStyle = `rgba(12, 9, 8, ${fireAlpha * 0.42})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, plumeW * 0.95, plumeW * 0.34, 0, 0, TAU);
        ctx.fill();

        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `rgba(255, 103, 40, ${fireAlpha * 0.36})`;
        ctx.beginPath();
        ctx.ellipse(0, -2, plumeW * 1.05, plumeW * 0.42, 0, 0, TAU);
        ctx.fill();

        for (let i = 0; i < 3; i += 1) {
          const offsetX = (i - 1) * fire.size * 0.26;
          const phase = fire.phase + i * 1.2;
          const flameH = plumeH * (0.72 + 0.28 * Math.sin(phase));
          const flameW = plumeW * (0.4 + 0.08 * i);

          ctx.fillStyle = `rgba(255, 102, 46, ${fireAlpha * 0.46})`;
          ctx.beginPath();
          ctx.ellipse(offsetX, -flameH * 0.42, flameW, flameH, 0, 0, TAU);
          ctx.fill();

          ctx.fillStyle = `rgba(255, 180, 78, ${fireAlpha * 0.42})`;
          ctx.beginPath();
          ctx.ellipse(offsetX, -flameH * 0.36, flameW * 0.62, flameH * 0.62, 0, 0, TAU);
          ctx.fill();

          ctx.fillStyle = `rgba(255, 238, 176, ${fireAlpha * 0.28})`;
          ctx.beginPath();
          ctx.ellipse(offsetX, -flameH * 0.28, flameW * 0.28, flameH * 0.28, 0, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }

      const vignette = ctx.createRadialGradient(
        state.width / 2,
        state.height / 2,
        Math.min(state.width, state.height) * 0.18,
        state.width / 2,
        state.height / 2,
        Math.hypot(state.width, state.height) * 0.72
      );
      vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
      vignette.addColorStop(1, `rgba(0, 0, 0, ${recoveryAlpha * 0.46})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, state.width, state.height);
      ctx.restore();
    }

    drawMushroomCloud();
  }
