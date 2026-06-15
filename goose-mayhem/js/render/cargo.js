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

  function drawCargoPaintLayer(cargo) {
    if (!cargo.paintStrokes?.length) {
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cargo.width, cargo.height);
    ctx.clip();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "rgba(220, 18, 18, 0.96)";
    ctx.strokeStyle = "rgba(146, 0, 0, 0.24)";
    ctx.lineWidth = 1;
    for (const stroke of cargo.paintStrokes) {
      const wobble = Math.sin(state.time * 1.8 + stroke.wobble) * 0.08;
      ctx.save();
      ctx.translate(stroke.x, stroke.y);
      ctx.rotate(wobble);
      ctx.beginPath();
      ctx.ellipse(0, 0, stroke.radius * 1.08, stroke.radius * 0.82, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawCargoChromeLaserMark(cargo) {
    const mark = cargo.chromeLaserMark;
    if (!mark) {
      return;
    }

    const progress = clamp(mark.age / mark.duration, 0, 1);
    const burnT = cubicEaseInOut(progress);
    const point = mark.local || pt(cargo.width / 2, cargo.height / 2);
    const direction = mark.direction || norm(pt(1, 1));
    const tangent = norm(pt(direction.y, -direction.x));
    const maxLength = Math.hypot(cargo.width, cargo.height) * 0.62;
    const length = lerp(10, maxLength, burnT);
    const crackStart = add(point, mul(tangent, -length * 0.5));
    const crackEnd = add(point, mul(tangent, length * 0.5));
    const pulse = Math.sin(state.time * 18 + mark.seed) * 0.5 + 0.5;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cargo.width, cargo.height);
    ctx.clip();

    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = `rgba(42, 21, 14, ${0.56 + burnT * 0.28})`;
    ctx.lineWidth = lerp(5, 9, burnT);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(crackStart.x, crackStart.y);
    ctx.lineTo(crackEnd.x, crackEnd.y);
    ctx.stroke();

    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(255, 52, 36, ${0.28 + burnT * 0.28 + pulse * 0.08})`;
    ctx.lineWidth = lerp(1.5, 3.2, burnT);
    ctx.beginPath();
    ctx.moveTo(crackStart.x, crackStart.y);
    ctx.lineTo(crackEnd.x, crackEnd.y);
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 235, 184, ${0.36 + pulse * 0.28})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, lerp(4, 8, burnT), 0, TAU);
    ctx.fill();
    ctx.restore();
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
    const capturedFraction = clamp(progress * 1.24, 0.001, 1);
    const pinch = clamp(Math.pow(progress, 0.92), 0, 1);
    const collapse = clamp(Math.pow(progress, 2.15), 0, 1);
    const mouthLocal = pt(
      clamp(mouth.x - cargo.pos.x, cargo.width * 0.05, cargo.width * 0.95),
      clamp(mouth.y - cargo.pos.y, cargo.height * 0.08, cargo.height * 0.92)
    );

    if (horizontal) {
      const sliceCount = 32;
      const sourceWidth = cargo.width / sliceCount;
      for (let i = 0; i < sliceCount; i += 1) {
        const sourceX = i * sourceWidth;
        const sliceWidth = i === sliceCount - 1 ? cargo.width - sourceX : sourceWidth;
        const t = (sourceX + sliceWidth * 0.5) / cargo.width;
        const edgeT = towardPositive ? t : 1 - t;
        const capturedT = clamp((edgeT - (1 - capturedFraction)) / capturedFraction, 0, 1);
        const localPinch = clamp(Math.max(Math.pow(capturedT, 0.62) * pinch, collapse * 0.92), 0, 1);
        const centerX = lerp(sourceX + sliceWidth * 0.5, mouthLocal.x, localPinch * 0.44 + collapse * 0.16);
        const wobble = Math.sin(edgeT * TAU * 1.2 + state.time * 8.4 + cargo.id) * localPinch * progress * 4.8;
        const centerY = lerp(cargo.height * 0.5, mouthLocal.y, localPinch * 0.84) + wobble;
        const destWidth = Math.max(1.2, sliceWidth * lerp(1, 0.54, localPinch));
        const destHeight = Math.max(3.5, cargo.height * lerp(1, 0.075, localPinch));
        drawCargoSurfaceRegion(
          cargo,
          hovered,
          burning,
          malwareGlow,
          dustProgress,
          { x: sourceX, y: 0, width: sliceWidth, height: cargo.height },
          { x: centerX - destWidth * 0.5, y: centerY - destHeight * 0.5, width: destWidth, height: destHeight }
        );
      }
      return;
    }

    const sliceCount = 26;
    const sourceHeight = cargo.height / sliceCount;
    for (let i = 0; i < sliceCount; i += 1) {
      const sourceY = i * sourceHeight;
      const sliceHeight = i === sliceCount - 1 ? cargo.height - sourceY : sourceHeight;
      const t = (sourceY + sliceHeight * 0.5) / cargo.height;
      const edgeT = towardPositive ? t : 1 - t;
      const capturedT = clamp((edgeT - (1 - capturedFraction)) / capturedFraction, 0, 1);
      const localPinch = clamp(Math.max(Math.pow(capturedT, 0.62) * pinch, collapse * 0.92), 0, 1);
      const wobble = Math.sin(edgeT * TAU * 1.15 + state.time * 8.4 + cargo.id) * localPinch * progress * 4.8;
      const centerX = lerp(cargo.width * 0.5, mouthLocal.x, localPinch * 0.84) + wobble;
      const centerY = lerp(sourceY + sliceHeight * 0.5, mouthLocal.y, localPinch * 0.44 + collapse * 0.16);
      const destWidth = Math.max(3.5, cargo.width * lerp(1, 0.075, localPinch));
      const destHeight = Math.max(1.2, sliceHeight * lerp(1, 0.54, localPinch));
      drawCargoSurfaceRegion(
        cargo,
        hovered,
        burning,
        malwareGlow,
        dustProgress,
        { x: 0, y: sourceY, width: cargo.width, height: sliceHeight },
        { x: centerX - destWidth * 0.5, y: centerY - destHeight * 0.5, width: destWidth, height: destHeight }
      );
    }
  }

  function drawCargo(cargo) {
    if (!cargo.visible) return;

    const damage = 1 - cargo.integrity;
    const burning = cargo.fireLevel > 0.05 || damage > 0.03;
    const dustProgress = cargoDustProgress(cargo);
    const vacuumProgress = cargo.vacuumProgress || 0;
    const blackHoleProgress = cargo.blackHoleProgress || 0;
    const skypeCellProgress = cargo.skypeCellProgress || 0;
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
    if (cargo.internetExplorerOrbit && (cargo.internetExplorerScale || 1) < 0.98) {
      const scale = cargo.internetExplorerScale || 1;
      const speckStartScale = 0.075;
      const speckOnlyScale = 0.04;
      const speckProgress = cubicEaseInOut(clamp(
        (speckStartScale - scale) / (speckStartScale - speckOnlyScale),
        0,
        1
      ));
      if (speckProgress > 0) {
        const twinkle = Math.sin(state.time * 10 + cargo.id) * 0.5 + 0.5;
        ctx.save();
        ctx.globalAlpha *= speckProgress;
        ctx.shadowColor = "rgba(255, 255, 255, 0.68)";
        ctx.shadowBlur = 2 + speckProgress * 3 + twinkle * 1.6;
        ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
        ctx.beginPath();
        ctx.arc(
          cargo.width * 0.5,
          cargo.height * 0.5,
          lerp(0.9, 1.55, speckProgress) + twinkle * 0.25,
          0,
          TAU
        );
        ctx.fill();
        ctx.restore();
      }
      if (scale <= speckOnlyScale) {
        ctx.restore();
        return;
      }
      if (speckProgress > 0) {
        ctx.globalAlpha *= 1 - speckProgress * 0.72;
      }
      ctx.translate(cargo.width * 0.5, cargo.height * 0.5);
      ctx.scale(scale, scale);
      ctx.translate(-cargo.width * 0.5, -cargo.height * 0.5);
    }
    if (blackHoleProgress > 0) {
      const pullT = cubicEaseInOut(clamp(blackHoleProgress, 0, 1));
      ctx.globalAlpha *= Math.max(0.12, 1 - pullT * 0.82);
      ctx.translate(cargo.width * 0.5, cargo.height * 0.5);
      ctx.rotate((cargo.blackHoleSpin || 0) * pullT);
      const scale = Math.max(0.035, 1 - pullT * 0.965);
      ctx.scale(scale, scale);
      ctx.translate(-cargo.width * 0.5, -cargo.height * 0.5);
    }
    if (skypeCellProgress > 0) {
      const consumeT = cubicEaseInOut(clamp(skypeCellProgress, 0, 1));
      ctx.globalAlpha *= Math.max(0.78, 1 - consumeT * 0.12);
      ctx.translate(cargo.width * 0.5, cargo.height * 0.5);
      ctx.rotate(Math.sin(state.time * 6.5 + cargo.id) * consumeT * 0.08);
      const scale = lerp(1, 0.14, consumeT);
      ctx.scale(scale, scale);
      ctx.translate(-cargo.width * 0.5, -cargo.height * 0.5);
    }
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

    drawCargoPaintLayer(cargo);
    drawCargoChromeLaserMark(cargo);

    if (skypeCellProgress > 0) {
      const sheen = Math.sin(state.time * 9 + cargo.id) * 0.5 + 0.5;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = `rgba(126, 226, 255, ${0.08 + sheen * 0.035})`;
      ctx.fillRect(0, 0, cargo.width, cargo.height);
      ctx.strokeStyle = `rgba(235, 252, 255, ${0.16 + sheen * 0.08})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, cargo.width - 2, cargo.height - 2);
      ctx.restore();
    }

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

      const burned = !!piece.burned;
      const burnPulse = burned ? (Math.sin(state.time * 14 + piece.burnSeed) * 0.5 + 0.5) : 0;
      ctx.strokeStyle = burned ? "rgba(48, 24, 15, 0.82)" : "rgba(255, 255, 255, 0.68)";
      ctx.lineWidth = burned ? 7 : 1.5;
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
      if (burned) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(255, 71, 38, ${0.34 + burnPulse * 0.18})`;
        ctx.lineWidth = 2.6;
        if (piece.axis === "vertical") {
          const seamX = cargo.width * 0.5;
          ctx.beginPath();
          ctx.moveTo(seamX, 7);
          ctx.lineTo(seamX, cargo.height - 7);
          ctx.stroke();
        } else {
          const seamY = cargo.height * 0.5;
          ctx.beginPath();
          ctx.moveTo(7, seamY);
          ctx.lineTo(cargo.width - 7, seamY);
          ctx.stroke();
        }
        ctx.restore();
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
    const effectImage = state.katana.effectImage;

    ctx.save();
    ctx.translate(state.pointer.pos.x, state.pointer.pos.y);
    ctx.rotate(angle);

    if (effectImage?.complete && effectImage.naturalWidth > 0) {
      const size = 78 + pulse * 9;
      const snipperBladeOffset = -Math.PI * 0.75;
      ctx.save();
      ctx.rotate(snipperBladeOffset);
      ctx.shadowColor = `rgba(126, 214, 255, ${0.18 + pulse * 0.18})`;
      ctx.shadowBlur = state.katana.slicing ? 14 : 7;
      ctx.drawImage(effectImage, -size * 0.5, -size * 0.5, size, size);
      ctx.restore();

      if (state.katana.slicing) {
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(160, 228, 255, ${0.24 + pulse * 0.2})`;
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.lineTo(56, 0);
        ctx.stroke();

        ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + pulse * 0.22})`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(50, 0);
        ctx.stroke();
      }

      ctx.restore();
      return;
    }

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

