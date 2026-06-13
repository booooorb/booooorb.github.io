  function drawCargoBurnFlames(cargo, burnGeometry, intensity) {
    const points = burnGeometry.points;
    if (!points.length || intensity <= 0.04) {
      return;
    }

    const inward = burnGeometry.inward;
    const upwardBias = pt(0, -0.42);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (let i = 0; i < points.length; i += 2) {
      const pointOnFront = points[i];
      const flicker = 0.72 + 0.28 * Math.sin(state.time * 18 + cargo.burnSeed + i * 0.8);
      const flameDirection = norm(add(inward, add(upwardBias, mul(burnGeometry.tangent, rand(-0.08, 0.08)))));
      const angle = Math.atan2(flameDirection.y, flameDirection.x);
      const length = (10 + intensity * 17) * flicker;
      const width = 3.8 + intensity * 4.4;

      ctx.save();
      ctx.translate(pointOnFront.x, pointOnFront.y);
      ctx.rotate(angle);

      ctx.fillStyle = COLORS.flameEdge;
      ctx.beginPath();
      ctx.ellipse(length * 0.52, 0, length, width, 0, 0, TAU);
      ctx.fill();

      ctx.fillStyle = COLORS.flameMid;
      ctx.beginPath();
      ctx.ellipse(length * 0.48, 0, length * 0.72, width * 0.72, 0, 0, TAU);
      ctx.fill();

      ctx.fillStyle = COLORS.flameCore;
      ctx.beginPath();
      ctx.ellipse(length * 0.44, 0, length * 0.42, width * 0.45, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  function applyCargoDustMask(cargo, progress) {
    if (progress <= 0) {
      return;
    }

    const crumbleFront = cargo.width * clamp(progress * 1.08, 0, 1);
    const frontX = cargo.width - crumbleFront;
    const biteCount = cargo.kind === "meme" ? 5 : 4;
    const radiusBase = lerp(8, 18, progress);

    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    for (let i = 0; i < biteCount; i += 1) {
      const lane = biteCount === 1 ? 0.5 : i / (biteCount - 1);
      const noise = fract(Math.sin(cargo.dustSeed + i * 41.73) * 43758.5453);
      const centerX = frontX + Math.sin(state.time * 1.9 + cargo.dustSeed + i * 0.9) * 5;
      const centerY = cargo.height * lane + Math.cos(state.time * 2.3 + i * 0.8) * 5;
      const radius = radiusBase * (0.68 + noise * 0.58);
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radius, radius * (0.54 + noise * 0.24), noise * 0.8, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCargoSurfaceLayer(cargo, hovered, burning, malwareGlow, dustProgress) {
    drawCargoSnapshotFace(cargo, { hovered, showFrame: !burning });
    if (malwareGlow > 0) {
      const stripeDrift = (state.time * 180) % (cargo.height + 36);
      ctx.fillStyle = `rgba(78, 235, 129, ${0.08 + malwareGlow * 0.2})`;
      ctx.fillRect(0, 0, cargo.width, cargo.height);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = `rgba(178, 255, 205, ${0.12 + malwareGlow * 0.18})`;
      for (let i = -2; i < 6; i += 1) {
        const y = (stripeDrift + i * 26) % (cargo.height + 32) - 16;
        ctx.fillRect(0, y, cargo.width, 10);
      }
      ctx.restore();
    }
    if (dustProgress > 0) {
      applyCargoDustMask(cargo, dustProgress);
    }
  }

  function drawCargoSurfaceRegion(cargo, hovered, burning, malwareGlow, dustProgress, sourceRect, destRect) {
    if (sourceRect.width <= 0.5 || sourceRect.height <= 0.5 || destRect.width <= 0.5 || destRect.height <= 0.5) {
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(destRect.x, destRect.y, destRect.width, destRect.height);
    ctx.clip();
    ctx.translate(
      destRect.x - sourceRect.x * (destRect.width / sourceRect.width),
      destRect.y - sourceRect.y * (destRect.height / sourceRect.height)
    );
    ctx.scale(destRect.width / sourceRect.width, destRect.height / sourceRect.height);
    drawCargoSurfaceLayer(cargo, hovered, burning, malwareGlow, dustProgress);
    ctx.restore();
  }

  function drawVacuumedCargoSurface(cargo, hovered, burning, malwareGlow, dustProgress, progress) {
    const mouth = recycleBinMouthPoint();
    const cargoCenter = pt(cargo.pos.x + cargo.width / 2, cargo.pos.y + cargo.height / 2);
    const offset = sub(mouth, cargoCenter);
    const horizontal = Math.abs(offset.x) >= Math.abs(offset.y);
    const towardPositive = horizontal ? offset.x >= 0 : offset.y >= 0;
    const capturedFraction = clamp(progress * 1.08, 0, 1);
    const pinch = clamp(Math.pow(progress, 1.18), 0, 1);

    if (horizontal) {
      const suckedSourceWidth = cargo.width * capturedFraction;
      const bodySourceWidth = Math.max(0, cargo.width - suckedSourceWidth);
      const suckedDestWidth = Math.max(5, lerp(suckedSourceWidth, cargo.width * 0.07, pinch));
      const bodyDestWidth = Math.max(0, cargo.width - suckedSourceWidth);
      const suckedDestHeight = cargo.height * lerp(1, 0.18, pinch);
      const suckedDestY = (cargo.height - suckedDestHeight) * 0.5;

      if (towardPositive) {
        drawCargoSurfaceRegion(
          cargo,
          hovered,
          burning,
          malwareGlow,
          dustProgress,
          { x: 0, y: 0, width: bodySourceWidth, height: cargo.height },
          { x: 0, y: 0, width: bodyDestWidth, height: cargo.height }
        );
        drawCargoSurfaceRegion(
          cargo,
          hovered,
          burning,
          malwareGlow,
          dustProgress,
          { x: bodySourceWidth, y: 0, width: suckedSourceWidth, height: cargo.height },
          { x: bodyDestWidth, y: suckedDestY, width: suckedDestWidth, height: suckedDestHeight }
        );
      } else {
        drawCargoSurfaceRegion(
          cargo,
          hovered,
          burning,
          malwareGlow,
          dustProgress,
          { x: suckedSourceWidth, y: 0, width: bodySourceWidth, height: cargo.height },
          { x: suckedDestWidth, y: 0, width: bodyDestWidth, height: cargo.height }
        );
        drawCargoSurfaceRegion(
          cargo,
          hovered,
          burning,
          malwareGlow,
          dustProgress,
          { x: 0, y: 0, width: suckedSourceWidth, height: cargo.height },
          { x: 0, y: suckedDestY, width: suckedDestWidth, height: suckedDestHeight }
        );
      }
      return;
    }

    const suckedSourceHeight = cargo.height * capturedFraction;
    const bodySourceHeight = Math.max(0, cargo.height - suckedSourceHeight);
    const suckedDestHeight = Math.max(5, lerp(suckedSourceHeight, cargo.height * 0.07, pinch));
    const bodyDestHeight = Math.max(0, cargo.height - suckedSourceHeight);
    const suckedDestWidth = cargo.width * lerp(1, 0.18, pinch);
    const suckedDestX = (cargo.width - suckedDestWidth) * 0.5;

    if (towardPositive) {
      drawCargoSurfaceRegion(
        cargo,
        hovered,
        burning,
        malwareGlow,
        dustProgress,
        { x: 0, y: 0, width: cargo.width, height: bodySourceHeight },
        { x: 0, y: 0, width: cargo.width, height: bodyDestHeight }
      );
      drawCargoSurfaceRegion(
        cargo,
        hovered,
        burning,
        malwareGlow,
        dustProgress,
        { x: 0, y: bodySourceHeight, width: cargo.width, height: suckedSourceHeight },
        { x: suckedDestX, y: bodyDestHeight, width: suckedDestWidth, height: suckedDestHeight }
      );
    } else {
      drawCargoSurfaceRegion(
        cargo,
        hovered,
        burning,
        malwareGlow,
        dustProgress,
        { x: 0, y: suckedSourceHeight, width: cargo.width, height: bodySourceHeight },
        { x: 0, y: suckedDestHeight, width: cargo.width, height: bodyDestHeight }
      );
      drawCargoSurfaceRegion(
        cargo,
        hovered,
        burning,
        malwareGlow,
        dustProgress,
        { x: 0, y: 0, width: cargo.width, height: suckedSourceHeight },
        { x: suckedDestX, y: 0, width: suckedDestWidth, height: suckedDestHeight }
      );
    }
  }

  function drawCargo(cargo) {
    if (!cargo.visible) return;

    const damage = 1 - cargo.integrity;
    const burning = cargo.fireLevel > 0.05 || damage > 0.03;
    const dustProgress = cargoDustProgress(cargo);
    const vacuumProgress = cargo.vacuumProgress || 0;
    const malwareProgress = antiMalwareConnectionProgress(cargo.id);
    const malwareGlow = malwareProgress > 0
      ? clamp(0.12 + Math.pow(malwareProgress, 1.35) * 0.88, 0, 1)
      : 0;
    const burnShake = (cargo.heat * cargo.heat + damage * 0.25) * 3;
    const shakeX = burnShake ? Math.sin(state.time * 44 + cargo.burnSeed) * burnShake : 0;
    const shakeY = burnShake ? Math.cos(state.time * 38 + cargo.burnSeed * 0.8) * burnShake * 0.55 : 0;
    const burnGeometry = cargoBurnGeometry(cargo);
    const secondaryGeometry = cargoSecondaryBurnGeometry(cargo);

    ctx.save();
    ctx.translate(
      cargo.pos.x + shakeX + dustProgress * 14 + vacuumProgress * 10,
      cargo.pos.y + shakeY - dustProgress * 5 - vacuumProgress * 4
    );
    if (dustProgress > 0) {
      ctx.globalAlpha *= Math.max(0.04, 1 - Math.pow(dustProgress, 0.82) * 0.96);
    }
    if (vacuumProgress > 0) {
      ctx.globalAlpha *= 1 - vacuumProgress * 0.18;
      const mouth = recycleBinMouthPoint();
      const cargoCenter = pt(cargo.pos.x + cargo.width / 2, cargo.pos.y + cargo.height / 2);
      const toMouth = sub(mouth, cargoCenter);
      const spinSign = toMouth.x >= 0 ? 1 : -1;
      const swirlAngle = Math.sin(state.time * 10 + cargo.id * 0.8) * vacuumProgress * 0.16 + spinSign * vacuumProgress * 0.2;
      const swirlShift = perp(norm(toMouth));
      const shiftAmount = Math.sin(state.time * 12 + cargo.id * 1.3) * vacuumProgress * 14;
      ctx.translate(cargo.width * 0.5, cargo.height * 0.5);
      ctx.rotate(swirlAngle);
      ctx.translate(swirlShift.x * shiftAmount, swirlShift.y * shiftAmount);
      ctx.translate(-cargo.width * 0.5, -cargo.height * 0.5);
    }
    if (malwareGlow > 0) {
      const glowPulse = 0.62 + 0.38 * Math.sin(state.antiMalware.pulse * 4.2);
      const surge = malwareGlow * (0.8 + glowPulse * 0.65);
      const contactGlobal = antiMalwareCargoAnchor(cargo);
      const contactLocal = pt(contactGlobal.x - cargo.pos.x, contactGlobal.y - cargo.pos.y);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = `rgba(124, 255, 154, ${0.38 + surge * 0.34})`;
      ctx.shadowBlur = 26 + surge * 42;
      ctx.fillStyle = `rgba(76, 235, 129, ${0.1 + surge * 0.18})`;
      ctx.fillRect(-10, -10, cargo.width + 20, cargo.height + 20);
      ctx.strokeStyle = `rgba(188, 255, 210, ${0.28 + surge * 0.36})`;
      ctx.lineWidth = 1.2 + surge * 2.4;
      ctx.strokeRect(-3, -3, cargo.width + 6, cargo.height + 6);
      ctx.strokeStyle = `rgba(102, 255, 153, ${0.12 + surge * 0.2})`;
      ctx.lineWidth = 6 + surge * 5;
      ctx.strokeRect(-8, -8, cargo.width + 16, cargo.height + 16);

      ctx.fillStyle = `rgba(129, 255, 172, ${0.18 + surge * 0.22})`;
      ctx.beginPath();
      ctx.ellipse(
        contactLocal.x,
        contactLocal.y,
        18 + surge * 20,
        14 + surge * 16,
        Math.sin(state.antiMalware.pulse * 0.6) * 0.22,
        0,
        TAU
      );
      ctx.fill();

      ctx.strokeStyle = `rgba(166, 255, 201, ${0.3 + surge * 0.28})`;
      ctx.lineWidth = 1.4 + surge * 1.8;
      for (let i = 0; i < 7; i += 1) {
        const angle = -Math.PI * 0.78 + (i / 6) * Math.PI * 1.56 + Math.sin(state.time * 4 + i) * 0.12;
        const ray = angleVec(angle);
        const from = add(contactLocal, mul(ray, 5 + surge * 5));
        const to = add(contactLocal, mul(ray, 18 + surge * 18));
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (!burning && vacuumProgress < 0.02) {
      ctx.fillStyle = COLORS.cargoShadow;
      ctx.fillRect(6, 8, cargo.width, cargo.height);
    }
    ctx.save();
    if (dustProgress > 0) {
      const remainingWidth = Math.max(0, cargo.width * (1 - clamp(dustProgress * 1.05, 0, 1)));
      ctx.beginPath();
      ctx.rect(0, 0, remainingWidth, cargo.height);
      ctx.clip();
    }
    if (burnGeometry) {
      traceRemainingRegionPath(cargo, burnGeometry, secondaryGeometry);
      ctx.clip();
    }
    const hovered = state.hoveredCargoId === cargo.id;
    if (vacuumProgress > 0.02) {
      drawVacuumedCargoSurface(cargo, hovered, burning, malwareGlow, dustProgress, vacuumProgress);
    } else {
      drawCargoSurfaceLayer(cargo, hovered, burning, malwareGlow, dustProgress);
    }
    ctx.restore();

    if (burnGeometry && vacuumProgress < 0.02) {
      const emberGlow = clamp(cargo.fireLevel * 0.92 + cargo.heat * 0.64 + damage * 0.26, 0, 1);

      ctx.save();
      ctx.strokeStyle = `rgba(36, 20, 10, ${0.62 + damage * 0.18})`;
      ctx.lineWidth = 5.5;
      traceBurnFrontPath(burnGeometry);
      ctx.stroke();
      if (secondaryGeometry) {
        traceBurnFrontPath(secondaryGeometry);
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = `rgba(255, 158, 78, ${0.18 + emberGlow * 0.46})`;
      ctx.lineWidth = 2.2 + emberGlow * 1.8;
      traceBurnFrontPath(burnGeometry);
      ctx.stroke();
      if (secondaryGeometry) {
        traceBurnFrontPath(secondaryGeometry);
        ctx.stroke();
      }
      ctx.restore();

      drawCargoBurnFlames(cargo, burnGeometry, clamp(emberGlow + cargo.fireLevel * 0.24, 0, 1));
      if (secondaryGeometry) {
        drawCargoBurnFlames(cargo, secondaryGeometry, clamp(emberGlow + cargo.fireLevel * 0.18, 0, 1));
      }
    }

    ctx.restore();
  }

  function drawKatanaSplitPieces() {
    if (!state.katana.splitPieces.length) {
      return;
    }

    for (const piece of state.katana.splitPieces) {
      const cargo = piece.cargo;
      ctx.save();
      ctx.translate(piece.pos.x + cargo.width / 2, piece.pos.y + cargo.height / 2);
      ctx.rotate(piece.angle);
      ctx.translate(-cargo.width / 2, -cargo.height / 2);

      ctx.save();
      ctx.beginPath();
      if (piece.axis === "vertical") {
        const clipX = piece.side === 0 ? 0 : cargo.width * 0.5 - 1;
        ctx.rect(clipX, 0, cargo.width * 0.5 + 2, cargo.height);
      } else {
        const clipY = piece.side === 0 ? 0 : cargo.height * 0.5 - 1;
        ctx.rect(0, clipY, cargo.width, cargo.height * 0.5 + 2);
      }
      ctx.clip();
      ctx.fillStyle = "rgba(20, 27, 34, 0.12)";
      ctx.fillRect(6, 8, cargo.width, cargo.height);
      drawCargoSnapshotFace(cargo, { showClose: false });
      ctx.restore();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.68)";
      ctx.lineWidth = 1.5;
      if (piece.axis === "vertical") {
        const seamX = cargo.width * 0.5;
        ctx.beginPath();
        ctx.moveTo(seamX, 6);
        ctx.lineTo(seamX, cargo.height - 6);
        ctx.stroke();
      } else {
        const seamY = cargo.height * 0.5;
        ctx.beginPath();
        ctx.moveTo(6, seamY);
        ctx.lineTo(cargo.width - 6, seamY);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawKatanaTrail() {
    const trail = state.katana.slashTrail;
    if (trail.length < 2) {
      return;
    }

    ctx.save();
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "lighter";
    for (let i = 1; i < trail.length; i += 1) {
      const previous = trail[i - 1];
      const current = trail[i];
      if (dist(previous.pos, current.pos) < 1.5) {
        continue;
      }
      const age = Math.max(previous.age, current.age);
      const alpha = clamp(1 - age / 0.28, 0, 1);
      if (alpha <= 0.02) {
        continue;
      }

      const trailT = i / (trail.length - 1 || 1);
      ctx.strokeStyle = `rgba(126, 214, 255, ${alpha * 0.2})`;
      ctx.lineWidth = lerp(30, 10, trailT);
      ctx.beginPath();
      ctx.moveTo(previous.pos.x, previous.pos.y);
      ctx.lineTo(current.pos.x, current.pos.y);
      ctx.stroke();

      ctx.strokeStyle = `rgba(232, 245, 255, ${alpha * 0.78})`;
      ctx.lineWidth = lerp(20, 6.5, trailT);
      ctx.beginPath();
      ctx.moveTo(previous.pos.x, previous.pos.y);
      ctx.lineTo(current.pos.x, current.pos.y);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = Math.max(1.8, lerp(8, 2.6, trailT));
      ctx.beginPath();
      ctx.moveTo(previous.pos.x, previous.pos.y);
      ctx.lineTo(current.pos.x, current.pos.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawKatanaCursor() {
    if (!state.katana.active || !state.pointer.inside) {
      return;
    }

    const dir = mag(state.katana.aimDir) ? state.katana.aimDir : norm(pt(-1, -0.45));
    const angle = Math.atan2(dir.y, dir.x);
    const pulse = state.katana.slicing ? 1 : 0.7;

    ctx.save();
    ctx.translate(state.pointer.pos.x, state.pointer.pos.y);
    ctx.rotate(angle);

    ctx.fillStyle = `rgba(20, 27, 34, ${0.12 + pulse * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(-6, 18, 34, 8, 0, 0, TAU);
    ctx.fill();

    const bladeGradient = ctx.createLinearGradient(-18, 0, 70, 0);
    bladeGradient.addColorStop(0, "rgba(224, 231, 242, 0.95)");
    bladeGradient.addColorStop(0.45, COLORS.katanaBlade);
    bladeGradient.addColorStop(1, "rgba(165, 182, 210, 0.95)");

    ctx.fillStyle = bladeGradient;
    ctx.beginPath();
    ctx.moveTo(-8, -3.5);
    ctx.lineTo(62, -5.5);
    ctx.quadraticCurveTo(74, -1.5, 78, 0);
    ctx.quadraticCurveTo(73, 3.5, 62, 6);
    ctx.lineTo(-8, 4);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = COLORS.katanaBladeEdge;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-6, 3.4);
    ctx.lineTo(72, 1.4);
    ctx.stroke();

    ctx.fillStyle = COLORS.katanaHandle;
    ctx.fillRect(-34, -7, 22, 14);
    ctx.fillStyle = COLORS.katanaWrap;
    for (let i = 0; i < 4; i += 1) {
      ctx.fillRect(-31 + i * 5, -7, 2, 14);
    }
    ctx.fillStyle = "#a78b56";
    ctx.fillRect(-12, -8, 4, 16);
    ctx.fillStyle = "#242831";
    ctx.beginPath();
    ctx.arc(-37, 0, 3.5, 0, TAU);
    ctx.fill();

    if (state.katana.slicing) {
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(160, 228, 255, ${0.3 + pulse * 0.24})`;
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(64, 0);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 255, 255, ${0.36 + pulse * 0.3})`;
      ctx.lineWidth = 9.5;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(58, 0);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawGauntletDust() {
    const particles = state.gauntlet.dustParticles;
    if (!particles.length) {
      return;
    }

    ctx.save();
    for (const particle of particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.save();
      ctx.translate(particle.pos.x, particle.pos.y);
      ctx.rotate(particle.angle);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.fillRect(-particle.size * 0.6, -particle.size * 0.35, particle.size * 1.2, particle.size * 0.7);
      ctx.restore();
    }
    ctx.restore();
  }

