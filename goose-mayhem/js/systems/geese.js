  function sendGooseBackToWander(goose, roamScale = 0.95) {
    gooseTaskRegistry.enter(goose, TASKS.WANDER, {
      roamScale,
    });
  }

  function beginCursorChase(goose, triggerPoint) {
    gooseTaskRegistry.enter(goose, TASKS.CHASE_CURSOR, triggerPoint);
  }

  function triggerNearbyCursorChase(triggerPoint) {
    for (const goose of state.geese) {
      if (goose.task === TASKS.DRAG_TAB && goose.cargoId) {
        continue;
      }
      if (dist(goose.pos, triggerPoint) > CURSOR_CHASE_TRIGGER_RADIUS) {
        continue;
      }
      beginCursorChase(goose, triggerPoint);
    }
  }

  function breadChaseRange() {
    return Math.hypot(state.width + 160, state.height + 160);
  }

  function dropGooseCargo(goose) {
    const cargo = currentCargo(goose);
    if (!cargo) {
      goose.cargoId = null;
      return null;
    }

    if (!cargo.visible) {
      removeCargo(cargo.id);
      goose.cargoId = null;
      return null;
    }

    cargo.visible = true;
    cargo.grabbed = false;
    cargo.ownerId = null;
    goose.cargoId = null;
    return cargo;
  }

  function beginBreadChase(goose) {
    gooseTaskRegistry.enter(goose, TASKS.BREAD_CHASE);
  }

  function breadLureApplies(goose) {
    if (!state.bread.active || !state.pointer.inside) {
      if (goose.task === TASKS.BREAD_CHASE) {
        sendGooseBackToWander(goose, 0.88);
      }
      return false;
    }

    if (dist(goose.pos, state.pointer.pos) > breadChaseRange()) {
      if (goose.task === TASKS.BREAD_CHASE) {
        sendGooseBackToWander(goose, 0.88);
      }
      return false;
    }

    if (goose.task !== TASKS.BREAD_CHASE) {
      beginBreadChase(goose);
    }

    return true;
  }

  function triggerHonk(goose, honkText = null) {
    goose.honkText = honkText || HONK_TEXTS[randInt(0, HONK_TEXTS.length - 1)];
    goose.honkUntil = state.time + rand(0.72, 1.28);
    goose.nextHonkTime = state.time + rand(goose.sprinting ? 3.2 : 4.8, goose.sprinting ? 6 : 9.2);
    scheduleHonkBurst(goose);
  }

  function updateHonk(goose) {
    if (goose.honkText && state.time >= goose.honkUntil) {
      goose.honkText = "";
    }

    if (!goose.honkText && state.time >= goose.nextHonkTime) {
      triggerHonk(goose);
    }
  }

  function gooseSpatialCellX(x) {
    return Math.floor(x / state.gooseSpatialIndex.cellSize);
  }

  function gooseSpatialCellY(y) {
    return Math.floor(y / state.gooseSpatialIndex.cellSize);
  }

  function gooseSpatialKey(cellX, cellY) {
    return (
      (cellX + GOOSE_SPATIAL_KEY_BIAS) * GOOSE_SPATIAL_KEY_STRIDE
      + cellY
      + GOOSE_SPATIAL_KEY_BIAS
    );
  }

  function attachGooseToSpatialIndex(goose, cellX = gooseSpatialCellX(goose.pos.x), cellY = gooseSpatialCellY(goose.pos.y)) {
    const buckets = state.gooseSpatialIndex.buckets;
    const key = gooseSpatialKey(cellX, cellY);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    goose.spatialCellX = cellX;
    goose.spatialCellY = cellY;
    goose.spatialCellKey = key;
    goose.spatialBucketIndex = bucket.length;
    bucket.push(goose);
  }

  function detachGooseFromSpatialIndex(goose) {
    if (goose.spatialCellKey == null) {
      return;
    }

    const buckets = state.gooseSpatialIndex.buckets;
    const bucket = buckets.get(goose.spatialCellKey);
    if (!bucket) {
      goose.spatialCellKey = null;
      goose.spatialBucketIndex = -1;
      return;
    }

    const index = goose.spatialBucketIndex;
    const last = bucket.pop();
    if (last && last !== goose) {
      bucket[index] = last;
      last.spatialBucketIndex = index;
    }
    if (!bucket.length) {
      buckets.delete(goose.spatialCellKey);
    }

    goose.spatialCellKey = null;
    goose.spatialBucketIndex = -1;
  }

  function rebuildGooseSpatialIndex() {
    state.gooseSpatialIndex.buckets.clear();
    for (const goose of state.geese) {
      attachGooseToSpatialIndex(goose);
    }
  }

  function refreshGooseSpatialMembership(goose) {
    const cellX = gooseSpatialCellX(goose.pos.x);
    const cellY = gooseSpatialCellY(goose.pos.y);
    if (cellX === goose.spatialCellX && cellY === goose.spatialCellY) {
      return;
    }
    detachGooseFromSpatialIndex(goose);
    attachGooseToSpatialIndex(goose, cellX, cellY);
  }

  function computeSeparationVector(goose) {
    let total = pt();
    let neighbors = 0;

    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        const bucket = state.gooseSpatialIndex.buckets.get(
          gooseSpatialKey(goose.spatialCellX + offsetX, goose.spatialCellY + offsetY)
        );
        if (!bucket) {
          continue;
        }

        for (let i = 0; i < bucket.length; i += 1) {
          const other = bucket[i];
          if (other.id === goose.id) continue;
          const dx = goose.pos.x - other.pos.x;
          const dy = goose.pos.y - other.pos.y;
          if (Math.abs(dx) >= SEPARATION_RADIUS || Math.abs(dy) >= SEPARATION_RADIUS) {
            continue;
          }
          const distance = Math.hypot(dx, dy);
          if (!distance || distance >= SEPARATION_RADIUS) continue;
          const strength = (SEPARATION_RADIUS - distance) / SEPARATION_RADIUS;
          total = add(total, mul(pt(dx / distance, dy / distance), strength));
          neighbors += 1;
        }
      }
    }

    return neighbors ? mul(total, 1 / neighbors) : pt();
  }

  function getSeparationVector(goose) {
    if (state.time < goose.nextSeparationSampleAt) {
      return goose.separationCache;
    }

    goose.separationCache = computeSeparationVector(goose);
    goose.nextSeparationSampleAt = state.time + separationSampleInterval() + (goose.id % 4) * 0.004;
    return goose.separationCache;
  }

  function setTargetOffscreen(goose, canExitTop = true) {
    let nearestSide = goose.pos.x;
    let direction = SCREEN_DIRECTION.LEFT;
    goose.target = pt(-72, lerp(goose.pos.y, state.height / 2, 0.4));

    if (nearestSide > state.width / 2) {
      nearestSide = state.width - goose.pos.x;
      direction = SCREEN_DIRECTION.RIGHT;
      goose.target = pt(state.width + 72, lerp(goose.pos.y, state.height / 2, 0.4));
    }

    if (canExitTop && nearestSide > goose.pos.y) {
      direction = SCREEN_DIRECTION.TOP;
      goose.target = pt(lerp(goose.pos.x, state.width / 2, 0.4), -72);
    }

    return direction;
  }

  function cargoOffset(cargo, direction) {
    if (direction === SCREEN_DIRECTION.LEFT) return pt(cargo.width, cargo.height / 2);
    if (direction === SCREEN_DIRECTION.TOP) return pt(cargo.width / 2, cargo.height);
    return pt(0, cargo.height / 2);
  }

  function dragDropPoint(cargo, direction) {
    const b = bounds();
    const screenCenter = pt(state.width / 2, state.height / 2);
    const safeRadius = Math.max(
      24,
      Math.min(
        screenCenter.x - (b.left + cargo.width / 2),
        (b.right - cargo.width / 2) - screenCenter.x,
        screenCenter.y - (b.top + cargo.height / 2),
        (b.bottom - cargo.height / 2) - screenCenter.y
      ) * 0.9
    );
    const angle = rand(0, TAU);
    const radius = Math.sqrt(Math.random()) * safeRadius;
    const cargoCenter = pt(
      screenCenter.x + Math.cos(angle) * radius,
      screenCenter.y + Math.sin(angle) * radius
    );
    const cargoTopLeft = pt(
      cargoCenter.x - cargo.width / 2,
      cargoCenter.y - cargo.height / 2
    );
    const offset = cargoOffset(cargo, direction);

    return pt(cargoTopLeft.x + offset.x, cargoTopLeft.y + offset.y);
  }

  function flameExposureAtPoint(point, origin, direction, reach, radius = 0) {
    const rel = sub(point, origin);
    const distance = mag(rel);
    if (!distance) {
      return 0;
    }

    const along = dot(rel, direction);
    if (along <= 0 || along >= reach + radius * 2) {
      return 0;
    }

    const alignment = along / distance;
    if (alignment < FLAME_MIN_ALIGNMENT) {
      return 0;
    }

    const lateral = Math.abs(rel.x * direction.y - rel.y * direction.x);
    const coneRadius = lerp(64, 248, clamp(along / Math.max(reach, 1), 0, 1));
    const widthFactor = clamp(1 - lateral / (coneRadius + radius), 0, 1);
    const alignmentFactor = clamp(
      (alignment - FLAME_MIN_ALIGNMENT) / (1 - FLAME_MIN_ALIGNMENT),
      0,
      1
    );
    const distanceFactor = clamp(1 - along / Math.max(reach * 1.06, 1), 0.06, 1);

    return widthFactor * alignmentFactor * distanceFactor;
  }

  function flameExposureForCargo(cargo, origin, direction, reach) {
    if (!cargo.visible) {
      return 0;
    }

    const center = pt(cargo.pos.x + cargo.width / 2, cargo.pos.y + cargo.height / 2);
    const cargoRadius = Math.hypot(cargo.width, cargo.height) * 0.28;
    return flameExposureAtPoint(center, origin, direction, reach, cargoRadius);
  }

  function burnSideFromDirection(direction) {
    if (Math.abs(direction.x) >= Math.abs(direction.y)) {
      return direction.x >= 0 ? "left" : "right";
    }
    return direction.y >= 0 ? "top" : "bottom";
  }

  function oppositeBurnSide(side) {
    if (side === "left") return "right";
    if (side === "right") return "left";
    if (side === "top") return "bottom";
    if (side === "bottom") return "top";
    return null;
  }

  function burnInwardVector(side) {
    if (side === "left") return pt(1, 0);
    if (side === "right") return pt(-1, 0);
    if (side === "top") return pt(0, 1);
    return pt(0, -1);
  }

  function burnTangentVector(side) {
    if (side === "left" || side === "right") {
      return pt(0, 1);
    }
    return pt(1, 0);
  }

  function ensureCargoBurnSide(cargo, direction) {
    if (!cargo.burnSide) {
      cargo.burnSide = burnSideFromDirection(direction);
    }
  }

  function buildBurnGeometry(cargo, side, progress, contourSeedShift = 0, contourFlip = false) {
    if (!side || progress <= 0) {
      return null;
    }

    const points = [];
    const inward = burnInwardVector(side);
    const tangent = burnTangentVector(side);
    const contourCount = Math.max(2, cargo.burnContour?.length || 0);
    const flickerStrength = clamp(cargo.heat * 0.06 + progress * 0.03, 0, 0.08);

    for (let i = 0; i < contourCount; i += 1) {
      const lane = contourCount === 1 ? 0 : i / (contourCount - 1);
      const cornerBias = Math.pow(Math.abs(lane - 0.5) * 2, 1.4);
      const cornerLead = progress * lerp(0.14, 1, cornerBias);
      const centerCatchUp = Math.pow(progress, 2.1) * (1 - cornerBias) * 0.95;
      const contourIndex = contourFlip ? contourCount - 1 - i : i;
      const baseContour = cargo.burnContour?.[contourIndex] || 0;
      const flicker = Math.sin(state.time * 12 + cargo.burnSeed + contourSeedShift + lane * 6.8) * flickerStrength;
      const front = clamp(cornerLead + centerCatchUp + baseContour + flicker, 0, 1.12);

      if (side === "left") {
        points.push(pt(front * cargo.width, lane * cargo.height));
      } else if (side === "right") {
        points.push(pt(cargo.width - front * cargo.width, lane * cargo.height));
      } else if (side === "top") {
        points.push(pt(lane * cargo.width, front * cargo.height));
      } else {
        points.push(pt(lane * cargo.width, cargo.height - front * cargo.height));
      }
    }

    return {
      side,
      inward,
      tangent,
      points,
    };
  }

  function cargoBurnGeometry(cargo) {
    return buildBurnGeometry(cargo, cargo.burnSide, cargo.burnProgress);
  }

  function cargoSecondaryBurnGeometry(cargo) {
    return buildBurnGeometry(
      cargo,
      cargo.secondaryBurnSide,
      cargo.secondaryBurnProgress,
      Math.PI * 0.6,
      true
    );
  }

  function traceBurnedRegionPath(cargo, burnGeometry) {
    const points = burnGeometry.points;
    if (!points.length) {
      return;
    }

    ctx.beginPath();
    if (burnGeometry.side === "left") {
      ctx.moveTo(0, 0);
      ctx.lineTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.lineTo(0, cargo.height);
    } else if (burnGeometry.side === "right") {
      ctx.moveTo(cargo.width, 0);
      ctx.lineTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.lineTo(cargo.width, cargo.height);
    } else if (burnGeometry.side === "top") {
      ctx.moveTo(0, 0);
      ctx.lineTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.lineTo(cargo.width, 0);
    } else {
      ctx.moveTo(0, cargo.height);
      ctx.lineTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.lineTo(cargo.width, cargo.height);
    }
    ctx.closePath();
  }

  function traceBurnFrontPath(burnGeometry) {
    const points = burnGeometry.points;
    if (!points.length) {
      return;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y);
    }
  }

  function traceRemainingRegionPath(cargo, burnGeometry, secondaryGeometry = null) {
    if (!burnGeometry) {
      ctx.beginPath();
      ctx.rect(0, 0, cargo.width, cargo.height);
      return;
    }

    const primaryPoints = burnGeometry.points;
    if (!secondaryGeometry) {
      ctx.beginPath();
      if (burnGeometry.side === "left") {
        ctx.moveTo(primaryPoints[0].x, primaryPoints[0].y);
        for (let i = 1; i < primaryPoints.length; i += 1) {
          ctx.lineTo(primaryPoints[i].x, primaryPoints[i].y);
        }
        ctx.lineTo(cargo.width, cargo.height);
        ctx.lineTo(cargo.width, 0);
      } else if (burnGeometry.side === "right") {
        ctx.moveTo(primaryPoints[0].x, primaryPoints[0].y);
        for (let i = 1; i < primaryPoints.length; i += 1) {
          ctx.lineTo(primaryPoints[i].x, primaryPoints[i].y);
        }
        ctx.lineTo(0, cargo.height);
        ctx.lineTo(0, 0);
      } else if (burnGeometry.side === "top") {
        ctx.moveTo(primaryPoints[0].x, primaryPoints[0].y);
        for (let i = 1; i < primaryPoints.length; i += 1) {
          ctx.lineTo(primaryPoints[i].x, primaryPoints[i].y);
        }
        ctx.lineTo(cargo.width, cargo.height);
        ctx.lineTo(0, cargo.height);
      } else {
        ctx.moveTo(primaryPoints[0].x, primaryPoints[0].y);
        for (let i = 1; i < primaryPoints.length; i += 1) {
          ctx.lineTo(primaryPoints[i].x, primaryPoints[i].y);
        }
        ctx.lineTo(cargo.width, 0);
        ctx.lineTo(0, 0);
      }
      ctx.closePath();
      return;
    }

    const secondaryPoints = secondaryGeometry.points;
    ctx.beginPath();
    if (
      (burnGeometry.side === "left" && secondaryGeometry.side === "right") ||
      (burnGeometry.side === "right" && secondaryGeometry.side === "left")
    ) {
      const leftPoints = burnGeometry.side === "left" ? primaryPoints : secondaryPoints;
      const rightPoints = burnGeometry.side === "right" ? primaryPoints : secondaryPoints;
      ctx.moveTo(leftPoints[0].x, leftPoints[0].y);
      for (let i = 1; i < leftPoints.length; i += 1) {
        ctx.lineTo(leftPoints[i].x, leftPoints[i].y);
      }
      for (let i = rightPoints.length - 1; i >= 0; i -= 1) {
        ctx.lineTo(rightPoints[i].x, rightPoints[i].y);
      }
      ctx.closePath();
      return;
    }

    if (
      (burnGeometry.side === "top" && secondaryGeometry.side === "bottom") ||
      (burnGeometry.side === "bottom" && secondaryGeometry.side === "top")
    ) {
      const topPoints = burnGeometry.side === "top" ? primaryPoints : secondaryPoints;
      const bottomPoints = burnGeometry.side === "bottom" ? primaryPoints : secondaryPoints;
      ctx.moveTo(topPoints[0].x, topPoints[0].y);
      for (let i = 1; i < topPoints.length; i += 1) {
        ctx.lineTo(topPoints[i].x, topPoints[i].y);
      }
      for (let i = bottomPoints.length - 1; i >= 0; i -= 1) {
        ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
      }
      ctx.closePath();
      return;
    }

    traceRemainingRegionPath(cargo, burnGeometry, null);
  }

  function cargoBurnFrontSample(cargo, inset = 0, burnGeometry = null) {
    burnGeometry = burnGeometry || cargoBurnGeometry(cargo);
    if (!burnGeometry || !burnGeometry.points.length) {
      return pt(
        cargo.pos.x + cargo.width / 2,
        cargo.pos.y + cargo.height / 2
      );
    }

    const index = randInt(0, burnGeometry.points.length - 1);
    const pointOnFront = burnGeometry.points[index];
    const along = mul(burnGeometry.tangent, rand(-10, 10));
    return pt(
      cargo.pos.x + pointOnFront.x + burnGeometry.inward.x * inset + along.x,
      cargo.pos.y + pointOnFront.y + burnGeometry.inward.y * inset + along.y
    );
  }

  function spawnFlameParticles() {
    const origin = flamethrowerEmissionPoint();
    const direction = state.flamethrower.aimDir;
    const side = perp(direction);

    for (let i = 0; i < flameSpawnCount(); i += 1) {
      const sprayedDirection = norm(add(direction, mul(side, rand(-1.05, 0.82))));
      const lifetime = rand(0.16, 0.38);
      pushTrimmed(state.flamethrower.flameParticles, {
        pos: add(
          origin,
          add(mul(direction, rand(4, 36)), mul(side, rand(-32, 34)))
        ),
        vel: add(
          mul(sprayedDirection, rand(220, 700)),
          add(mul(side, rand(-88, 96)), pt(rand(-18, 18), rand(-34, 24)))
        ),
        size: rand(16, 42),
        phase: rand(0, TAU),
        life: lifetime,
        maxLife: lifetime,
      }, flameParticleBudget());
    }

    for (let i = 0; i < 3; i += 1) {
      spawnSmoke(
        add(origin, add(mul(direction, rand(6, 34)), mul(side, rand(-24, 24)))),
        add(direction, mul(side, rand(-0.36, 0.28))),
        rand(0.72, 1.08),
        18
      );
    }

    for (let i = 0; i < 4; i += 1) {
      spawnEmber(
        add(origin, add(mul(direction, rand(12, 40)), mul(side, rand(-20, 20)))),
        add(direction, mul(side, rand(-0.44, 0.34))),
        rand(0.82, 1.16),
        18
      );
    }
  }

  function spawnBurnBurst(center) {
    for (let i = 0; i < 7; i += 1) {
      spawnSmoke(center, pt(rand(-0.18, 0.18), -1), 1.12, 20);
    }
    for (let i = 0; i < 18; i += 1) {
      const burstDirection = angleVec(rand(-Math.PI * 0.95, Math.PI * 0.08));
      spawnEmber(center, burstDirection, 1.14, 20);
    }
  }

  function destroyCargoByFire(cargo) {
    const center = pt(cargo.pos.x + cargo.width / 2, cargo.pos.y + cargo.height / 2);
    spawnBurnBurst(center);
    removeCargo(cargo.id);
  }

  function updateCargoCombustion(cargo, dt, directExposure, direction, origin = null, reach = 0) {
    const activelySprayed = directExposure > 0.01;
    if (activelySprayed) {
      ensureCargoBurnSide(cargo, direction);
    }

    let secondaryExposure = 0;
    if (origin && reach && cargo.burnSide) {
      const opposite = oppositeBurnSide(cargo.burnSide);
      if (opposite === "left" || opposite === "right") {
        const edgePoint = opposite === "left"
          ? pt(cargo.pos.x, cargo.pos.y + cargo.height / 2)
          : pt(cargo.pos.x + cargo.width, cargo.pos.y + cargo.height / 2);
        secondaryExposure = flameExposureAtPoint(edgePoint, origin, direction, reach, 10);
      } else if (opposite === "top" || opposite === "bottom") {
        const edgePoint = opposite === "top"
          ? pt(cargo.pos.x + cargo.width / 2, cargo.pos.y)
          : pt(cargo.pos.x + cargo.width / 2, cargo.pos.y + cargo.height);
        secondaryExposure = flameExposureAtPoint(edgePoint, origin, direction, reach, 10);
      }

      if (!cargo.secondaryBurnSide) {
        const chargeDelta = secondaryExposure > 0.28
          ? secondaryExposure * dt
          : -dt * 0.42;
        cargo.secondaryBurnCharge = clamp(cargo.secondaryBurnCharge + chargeDelta, 0, 1);
      }

      if (cargo.secondaryBurnCharge > 0.24 && !cargo.secondaryBurnSide) {
        cargo.secondaryBurnSide = opposite;
        cargo.secondaryBurnCharge = 0;
      }
    }

    const cooling = activelySprayed
      ? 0.08
      : cargo.burnProgress > 0.05
        ? 0.11
        : 0.24;

    cargo.fireLevel = clamp(
      cargo.fireLevel + directExposure * dt * 3.6 + cargo.heat * dt * 0.12 - cooling * dt,
      0,
      1
    );

    cargo.heat = clamp(
      cargo.heat + directExposure * dt * 5.2 + cargo.fireLevel * dt * 0.42 - dt * 0.15,
      0,
      1
    );

    const selfFeed = cargo.fireLevel * lerp(0.18, 0.68, clamp(cargo.burnProgress, 0, 1));
    const burnRate = activelySprayed
      ? directExposure * (0.9 + cargo.fireLevel * 0.55 + cargo.heat * 0.24)
      : selfFeed + cargo.heat * 0.08;

    if (burnRate > 0.01 && cargo.burnProgress < 1.02) {
      cargo.burnProgress = clamp(
        cargo.burnProgress + burnRate * FLAME_DAMAGE * dt,
        0,
        1.14
      );
    }

    if (cargo.secondaryBurnSide) {
      const secondaryRate = activelySprayed
        ? Math.max(secondaryExposure * 0.94, directExposure * 0.08) + cargo.fireLevel * 0.08
        : cargo.fireLevel * 0.2 + cargo.heat * 0.03;
      cargo.secondaryBurnProgress = clamp(
        cargo.secondaryBurnProgress + secondaryRate * FLAME_DAMAGE * dt,
        0,
        1.12
      );
    }

    cargo.integrity = clamp(1 - cargo.burnProgress - cargo.secondaryBurnProgress * 0.72, 0, 1);

    const primaryGeometry = cargoBurnGeometry(cargo);
    const secondaryGeometry = cargoSecondaryBurnGeometry(cargo);
    if ((activelySprayed || cargo.fireLevel > 0.16) && state.time >= cargo.nextSmokeAt) {
      const smokeGeometry = secondaryGeometry && Math.random() < 0.42 ? secondaryGeometry : primaryGeometry;
      spawnSmoke(
        cargoBurnFrontSample(cargo, rand(3, 10), smokeGeometry),
        add(direction, pt(rand(-0.12, 0.12), rand(-0.14, 0.04))),
        clamp(0.78 + directExposure * 0.46 + cargo.fireLevel * 0.35, 0.72, 1.4),
        14
      );
      cargo.nextSmokeAt = state.time + rand(0.03, activelySprayed ? 0.08 : 0.12);
    }

    if ((activelySprayed || cargo.fireLevel > 0.2) && state.time >= cargo.nextEmberAt) {
      const emberGeometry = secondaryGeometry && Math.random() < 0.45 ? secondaryGeometry : primaryGeometry;
      spawnEmber(
        cargoBurnFrontSample(cargo, rand(1, 7), emberGeometry),
        add(direction, pt(rand(-0.1, 0.1), rand(-0.08, 0.06))),
        clamp(0.62 + directExposure * 0.4 + cargo.fireLevel * 0.42, 0.58, 1.3),
        12
      );
      cargo.nextEmberAt = state.time + rand(0.02, activelySprayed ? 0.055 : 0.09);
    }
  }

  function updateFlamethrower(dt) {
    const flame = state.flamethrower;
    flame.pulse += dt * (flame.firing ? 10.5 : 3.8);

    if (state.pointer.inside) {
      updateFlamethrowerAim(state.pointer.pos);
    }

    const burning = flame.active && flame.grabbed && flame.firing && state.pointer.inside;
    const burnQueue = [];

    if (burning) {
      spawnFlameParticles();
      const origin = flamethrowerEmissionPoint();
      const direction = flame.aimDir;
      const reach = flamethrowerRange();

      for (const cargo of state.cargoes) {
        const exposure = flameExposureForCargo(cargo, origin, direction, reach);
        updateCargoCombustion(cargo, dt, exposure, direction, origin, reach);

        if (cargo.burnProgress >= 1.02 || cargo.integrity <= 0) {
          burnQueue.push(cargo);
        }
      }
    } else {
      for (const cargo of state.cargoes) {
        updateCargoCombustion(cargo, dt, 0, flame.aimDir, null, 0);
        if (cargo.burnProgress >= 1.02 || cargo.integrity <= 0) {
          burnQueue.push(cargo);
        }
      }
    }

    for (const cargo of burnQueue) {
      if (!cargo.removed) {
        destroyCargoByFire(cargo);
      }
    }

    compactInPlace(flame.flameParticles, (particle) => {
      particle.life -= dt;
      particle.pos = add(particle.pos, mul(particle.vel, dt));
      const velocityDir = mag(particle.vel) > 1 ? norm(particle.vel) : flame.aimDir;
      const side = perp(velocityDir);
      const swirl = Math.sin(state.time * 18 + particle.phase) * 44 * dt;
      particle.vel = add(
        mul(particle.vel, 0.92),
        add(mul(side, swirl), pt(0, -38 * dt))
      );
      particle.size *= 0.992;
      return particle.life > 0 && particle.size > 0.8;
    });

    compactInPlace(flame.smokeParticles, (particle) => {
      particle.life -= dt;
      particle.pos = add(particle.pos, mul(particle.vel, dt));
      particle.vel = add(mul(particle.vel, 0.968), pt(0, -10 * dt));
      particle.size += dt * 22;
      return particle.life > 0;
    });

    compactInPlace(flame.emberParticles, (particle) => {
      particle.life -= dt;
      particle.pos = add(particle.pos, mul(particle.vel, dt));
      particle.vel = add(mul(particle.vel, 0.95), pt(0, 36 * dt));
      particle.angle += particle.spin * dt;
      return particle.life > 0 && particle.size > 0.25;
    });
  }

  function maybeStartMayhem(goose) {
    if (state.time < goose.nextMayhemTime || goose.task !== TASKS.WANDER) {
      return;
    }

    const nextTask = MAYHEM_WEIGHTED[randInt(0, MAYHEM_WEIGHTED.length - 1)];
    if (nextTask === TASKS.DRAG_TAB) {
      if (!hasTabCapacity()) {
        gooseTaskRegistry.enter(goose, TASKS.TRACK_MUD, {
          honkText: "hjonk",
        });
        return;
      }

      const cargo = createCargo();
      state.cargoes.push(cargo);
      gooseTaskRegistry.enter(goose, TASKS.DRAG_TAB, cargo);
      return;
    }

    gooseTaskRegistry.enter(goose, TASKS.TRACK_MUD, {
      honkText: "HRONK",
    });
  }

  function updateGooseTask(goose) {
    if (breadLureApplies(goose)) {
      gooseTaskRegistry.update(goose);
      return;
    }

    maybeStartMayhem(goose);
    gooseTaskRegistry.update(goose);
  }

  function updateMovement(goose, dt) {
    const haulingCargo = goose.task === TASKS.DRAG_TAB && goose.taskData?.stage === DRAG_STAGE.DRAGGING;
    const topSpeed = haulingCargo
      ? goose.walkSpeed * 0.78
      : goose.sprinting ? goose.runSpeed : goose.walkSpeed;
    const acceleration = haulingCargo
      ? goose.acceleration * 0.82
      : goose.sprinting ? goose.runAcceleration : goose.acceleration;
    const targetDirection = norm(sub(goose.target, goose.pos));
    const flockSeparation = getSeparationVector(goose);
    const steeringDirection = norm(add(
      targetDirection,
      mul(flockSeparation, haulingCargo ? 0.35 : goose.sprinting ? 0.75 : 1.4)
    ));

    if (mag(steeringDirection)) {
      goose.vel = add(goose.vel, mul(steeringDirection, acceleration * dt));
    } else if (mag(goose.vel)) {
      const slow = Math.min(mag(goose.vel), acceleration * 0.9 * dt);
      goose.vel = sub(goose.vel, mul(norm(goose.vel), slow));
    }

    if (mag(goose.vel) > topSpeed) {
      goose.vel = mul(norm(goose.vel), topSpeed);
    }

    const lookDirection = mag(goose.vel) > 4 ? norm(goose.vel) : steeringDirection;
    if (mag(lookDirection)) {
      const blended = lerpPt(angleVec(goose.angle), lookDirection, 0.22);
      goose.angle = Math.atan2(blended.y, blended.x);
    }

    const nextPos = add(goose.pos, mul(goose.vel, dt));
    goose.pos = goose.task === TASKS.DRAG_TAB
      ? clampExtendedPoint(nextPos)
      : clampPoint(nextPos);
    refreshGooseSpatialMembership(goose);

    goose.poseClock += dt * (haulingCargo ? 3.4 : goose.sprinting ? 6.8 : mag(goose.vel) > 8 ? 4.2 : 1.1);
    goose.gait = mag(goose.vel) > 8 ? Math.sin(goose.poseClock * TAU) : 0;
    goose.rig.neckLerpPercent = lerp(
      goose.rig.neckLerpPercent,
      goose.task === TASKS.DRAG_TAB ? 1 : goose.sprinting ? 0.65 : 0,
      0.12
    );

    updateRig(goose);
    updateFeet(goose, dt);
  }

  function updateCargoes() {
    for (const cargo of state.cargoes) {
      if (cargo.grabbed && cargo.ownerId) {
        const owner = findGooseById(cargo.ownerId);
        if (!owner) {
          cargo.grabbed = false;
          cargo.ownerId = null;
          continue;
        }
        const beak = beakPoint(owner);
        const direction = owner.taskData?.screenDirection || SCREEN_DIRECTION.LEFT;
        const offset = cargoOffset(cargo, direction);
        cargo.pos = pt(beak.x - offset.x, beak.y - offset.y);
        cargo.visible = true;
      }
    }
  }

