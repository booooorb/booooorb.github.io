  function bounds() {
    const side = Math.min(88, Math.max(52, state.width * 0.08));
    const top = Math.min(154, Math.max(92, state.height * 0.15));
    const bottom = Math.min(96, Math.max(74, state.height * 0.11));
    return {
      left: side,
      right: Math.max(side, state.width - side),
      top,
      bottom: Math.max(top, state.height - bottom),
    };
  }

  function extendedBounds() {
    return {
      left: -120,
      right: state.width + 120,
      top: -120,
      bottom: state.height + 120,
    };
  }

  function clampPoint(target) {
    const b = bounds();
    return pt(
      clamp(target.x, b.left, b.right),
      clamp(target.y, b.top, b.bottom)
    );
  }

  function clampExtendedPoint(target) {
    const b = extendedBounds();
    return pt(
      clamp(target.x, b.left, b.right),
      clamp(target.y, b.top, b.bottom)
    );
  }

  function randomPoint() {
    const b = bounds();
    return pt(rand(b.left, b.right), rand(b.top, b.bottom));
  }

  function spreadPoint(index, count) {
    const b = bounds();
    const width = b.right - b.left;
    const height = b.bottom - b.top;
    const aspect = width / Math.max(height, 1);
    const columns = Math.max(1, Math.ceil(Math.sqrt(count * aspect)));
    const rows = Math.max(1, Math.ceil(count / columns));
    const cellW = width / columns;
    const cellH = height / rows;
    const col = index % columns;
    const row = Math.floor(index / columns);
    return clampPoint(pt(
      b.left + cellW * (col + 0.5) + rand(-cellW * 0.28, cellW * 0.28),
      b.top + cellH * (row + 0.5) + rand(-cellH * 0.28, cellH * 0.28)
    ));
  }

  function createAudioPool(sources, copiesPerSource) {
    if (!state.sounds.enabled) {
      return [];
    }

    const pool = [];
    for (const src of sources) {
      for (let i = 0; i < copiesPerSource; i += 1) {
        const audio = new Audio(src);
        audio.preload = "auto";
        pool.push(audio);
      }
    }
    return pool;
  }

  function effectTier() {
    const gooseCount = state.geese.length;
    const cargoCount = state.cargoes.length;
    const combined = gooseCount + cargoCount;

    if (gooseCount >= 68 || cargoCount >= 65 || combined >= 122) {
      return 2;
    }
    if (gooseCount >= 52 || cargoCount >= 40 || combined >= 92) {
      return 1;
    }
    return 0;
  }

  function dustParticleBudget() {
    const tier = effectTier();
    if (tier === 2) return 240;
    if (tier === 1) return 360;
    return 520;
  }

  function separationSampleInterval() {
    const tier = effectTier();
    if (tier === 2) return 0.09;
    if (tier === 1) return 0.055;
    return 0.03;
  }

  function honkBubbleLimit() {
    const tier = effectTier();
    if (tier === 2) return 4;
    if (tier === 1) return 8;
    return 16;
  }

  function ensureAudioPool() {
    if (!state.sounds.enabled || state.sounds.initialized) {
      return;
    }

    state.sounds.honkPool = createAudioPool(SOUND_PATHS.honks, 2);
    state.sounds.initialized = true;
  }

  function markAudioInteraction() {
    if (!state.sounds.enabled) {
      return;
    }

    ensureAudioPool();
    state.sounds.userInteracted = true;

    const sample = state.sounds.honkPool[0];
    if (!sample || sample.dataset?.primed === "true") {
      return;
    }

    try {
      sample.volume = 0.001;
      const played = sample.play();
      if (played && typeof played.then === "function") {
        played.then(() => {
          sample.pause();
          sample.currentTime = 0;
          if (sample.dataset) {
            sample.dataset.primed = "true";
          }
        }).catch(() => {});
      }
    } catch (error) {
      void error;
    }
  }

  function playFromPool(pool, volume, playbackRate) {
    if (!state.sounds.enabled || !state.sounds.userInteracted || !pool.length) {
      return;
    }

    const audio = pool.find((item) => item.paused || item.ended) || pool[randInt(0, pool.length - 1)];
    if (!audio) {
      return;
    }

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = volume;
      audio.playbackRate = playbackRate;
      const played = audio.play();
      if (played && typeof played.catch === "function") {
        played.catch(() => {});
      }
    } catch (error) {
      void error;
    }
  }

  function scheduleHonkBurst(goose) {
    const burstCount = goose.sprinting ? randInt(2, 4) : randInt(2, 3);
    for (let i = 0; i < burstCount; i += 1) {
      const delay = i * rand(90, 180);
      globalThis.setTimeout(() => {
        playFromPool(
          state.sounds.honkPool,
          HONK_VOLUME * rand(0.68, 0.96),
          rand(1.32, 1.55)
        );
      }, delay);
    }
  }

  function territoryPoint(goose, roamScale = 1) {
    if (!goose?.home) {
      return randomPoint();
    }

    const b = bounds();
    const roamX = Math.max(110, (b.right - b.left) * 0.15 * roamScale);
    const roamY = Math.max(86, (b.bottom - b.top) * 0.17 * roamScale);
    return clampPoint(pt(
      goose.home.x + rand(-roamX, roamX),
      goose.home.y + rand(-roamY, roamY)
    ));
  }

  function chooseTarget(goose, minDistance = 90, roamScale = 1) {
    let target = Math.random() < 0.14 ? randomPoint() : territoryPoint(goose, roamScale);
    let tries = 0;
    while (dist(goose.pos, target) < minDistance && tries < 20) {
      target = Math.random() < 0.14 ? randomPoint() : territoryPoint(goose, roamScale);
      tries += 1;
    }
    goose.target = target;
  }

  function createFoot() {
    return {
      pos: pt(),
      from: pt(),
      to: pt(),
      moveDir: pt(),
      dur: 0.2,
      t: 1,
      moving: false,
    };
  }

  function randomMemeAsset() {
    if (!state.memeImages.length) {
      return null;
    }
    return state.memeImages[randInt(0, state.memeImages.length - 1)];
  }

  function createCargo() {
    const isMeme = state.memeImages.length > 0 && Math.random() < 0.5;
    const lines = TAB_LINES[randInt(0, TAB_LINES.length - 1)];
    const memeAsset = isMeme ? randomMemeAsset() : null;
    return {
      id: state.nextCargoId++,
      kind: memeAsset ? "meme" : "sticky",
      title: memeAsset
        ? MEME_TAB_TITLES[randInt(0, MEME_TAB_TITLES.length - 1)]
        : TAB_TITLES[randInt(0, TAB_TITLES.length - 1)],
      lines: memeAsset ? [] : lines,
      imageAsset: memeAsset,
      width: memeAsset ? rand(226, 286) : rand(206, 244),
      height: memeAsset ? rand(176, 232) : rand(118, 154),
      bar: `hsl(${randInt(190, 220)} 88% ${randInt(74, 84)}%)`,
      pos: pt(-999, -999),
      visible: false,
      grabbed: false,
      ownerId: null,
      integrity: 1,
      heat: 0,
      fireLevel: 0,
      burnSeed: rand(0, TAU),
      burnSide: null,
      burnProgress: 0,
      secondaryBurnSide: null,
      secondaryBurnCharge: 0,
      secondaryBurnProgress: 0,
      burnContour: Array.from({ length: 11 }, () => rand(-0.09, 0.09)),
      nextSmokeAt: 0,
      nextEmberAt: 0,
      vacuumProgress: 0,
      dusting: false,
      dustStartAt: 0,
      dustDuration: 0,
      dustNextAt: 0,
      dustSeed: rand(0, 1000),
      rewarded: false,
      removed: false,
    };
  }

  function createGoose(index) {
    const start = spreadPoint(index, GOOSE_COUNT);
    const goose = {
      id: index + 1,
      size: rand(0.94, 1.1),
      home: start,
      pos: start,
      vel: pt(),
      target: start,
      angle: rand(-Math.PI, Math.PI),
      walkSpeed: rand(76, 92),
      runSpeed: rand(186, 224),
      acceleration: rand(1180, 1360),
      runAcceleration: rand(1860, 2320),
      task: TASKS.WANDER,
      taskData: null,
      nextMayhemTime: rand(0.8, 4.2),
      pauseUntil: rand(0, 1.4),
      poseClock: rand(0, TAU),
      gait: 0,
      sprinting: false,
      cargoId: null,
      honkText: "",
      honkUntil: 0,
      nextHonkTime: rand(1.4, 8.2),
      separationCache: pt(),
      nextSeparationSampleAt: rand(0, 0.05),
      spatialCellX: 0,
      spatialCellY: 0,
      spatialCellKey: null,
      spatialBucketIndex: -1,
      rig: {
        neckLerpPercent: 0,
        underbodyCenter: pt(),
        bodyCenter: pt(),
        neckBase: pt(),
        neckHeadPoint: pt(),
        head1EndPoint: pt(),
        head2EndPoint: pt(),
      },
      feet: {
        l: createFoot(),
        r: createFoot(),
      },
    };
    chooseTarget(goose, 60);
    updateRig(goose);
    return goose;
  }

  function populateGeese() {
    state.geese = [];
    for (let i = 0; i < GOOSE_COUNT; i += 1) {
      state.geese.push(createGoose(i));
    }
  }

  function updateRig(goose) {
    const s = goose.size;
    const base = pt(Math.round(goose.pos.x), Math.round(goose.pos.y));
    const fwd = angleVec(goose.angle);
    const neckHeight = Math.round(lerp(20, 10, goose.rig.neckLerpPercent) * s);
    const neckForward = Math.round(lerp(3, 16, goose.rig.neckLerpPercent) * s);

    goose.rig.underbodyCenter = add(base, mul(SCREEN_UP, 9 * s));
    goose.rig.bodyCenter = add(base, mul(SCREEN_UP, 14 * s));
    goose.rig.neckBase = add(goose.rig.bodyCenter, mul(fwd, 15 * s));
    goose.rig.neckHeadPoint = add(
      goose.rig.neckBase,
      add(mul(fwd, neckForward), mul(SCREEN_UP, neckHeight))
    );
    goose.rig.head1EndPoint = add(
      goose.rig.neckHeadPoint,
      add(mul(fwd, 3 * s), mul(SCREEN_UP, -1 * s))
    );
    goose.rig.head2EndPoint = add(goose.rig.head1EndPoint, mul(fwd, 5 * s));
  }

  function beakPoint(goose) {
    const fwd = angleVec(goose.angle);
    return add(goose.rig.head2EndPoint, mul(fwd, 3 * goose.size));
  }

  function footHome(goose, sideKey) {
    const side = angleVec(goose.angle + Math.PI / 2);
    return add(goose.pos, mul(side, (sideKey === "r" ? 6 : -6) * goose.size));
  }

  function startStep(foot, home, size, duration) {
    foot.from = pt(foot.pos.x, foot.pos.y);
    foot.moveDir = norm(sub(home, foot.pos));
    foot.to = add(home, mul(foot.moveDir, 2 * size));
    foot.dur = duration;
    foot.t = 0;
    foot.moving = true;
  }

  function updateFoot(foot, dt, target) {
    if (!foot.moving) return false;
    foot.t = Math.min(1, foot.t + dt / foot.dur);
    foot.pos = lerpPt(foot.from, target, cubicEaseInOut(foot.t));
    if (foot.t >= 1) {
      foot.pos = pt(target.x, target.y);
      foot.moving = false;
      return true;
    }
    return false;
  }

  function updateFeet(goose, dt) {
    const homeL = footHome(goose, "l");
    const homeR = footHome(goose, "r");
    const left = goose.feet.l;
    const right = goose.feet.r;
    const leftTarget = add(homeL, mul(left.moveDir, 2 * goose.size));
    const rightTarget = add(homeR, mul(right.moveDir, 2 * goose.size));
    const stepDuration = goose.sprinting ? 0.12 : 0.2;

    if (!left.pos.x && !left.pos.y && !right.pos.x && !right.pos.y) {
      left.pos = homeL;
      right.pos = homeR;
    }

    if (!left.moving && !right.moving) {
      if (dist(left.pos, homeL) > 5 * goose.size) {
        startStep(left, homeL, goose.size, stepDuration);
        return;
      }
      if (dist(right.pos, homeR) > 5 * goose.size) {
        startStep(right, homeR, goose.size, stepDuration);
      }
      return;
    }

    if (left.moving) {
      updateFoot(left, dt, leftTarget);
      return;
    }

    if (right.moving) {
      updateFoot(right, dt, rightTarget);
    }
  }

  function findCargoIndexById(cargoId) {
    for (let i = 0; i < state.cargoes.length; i += 1) {
      if (state.cargoes[i].id === cargoId) {
        return i;
      }
    }
    return -1;
  }

  function findCargoById(cargoId) {
    const index = findCargoIndexById(cargoId);
    return index >= 0 ? state.cargoes[index] : null;
  }

  function findGooseById(gooseId) {
    for (const goose of state.geese) {
      if (goose.id === gooseId) {
        return goose;
      }
    }
    return null;
  }

  function visibleCargoCount() {
    let count = 0;
    for (const cargo of state.cargoes) {
      if (cargo.visible && !cargo.dusting) {
        count += 1;
      }
    }
    return count;
  }

  function latestVisibleCargoes(limit = Infinity) {
    const cargoes = [];
    for (let i = state.cargoes.length - 1; i >= 0 && cargoes.length < limit; i -= 1) {
      const cargo = state.cargoes[i];
      if (cargo.visible && !cargo.dusting) {
        cargoes.push(cargo);
      }
    }
    return cargoes;
  }

  function currentCargo(goose) {
    if (!goose.cargoId) return null;
    return findCargoById(goose.cargoId);
  }

  function hasTabCapacity(excludeCargoId = null) {
    let tabCount = 0;
    for (const cargo of state.cargoes) {
      if (cargo.id === excludeCargoId) continue;
      tabCount += 1;
      if (tabCount >= MAX_TABS) {
        return false;
      }
    }
    return true;
  }

  function releaseCargoOwner(cargo) {
    if (!cargo?.ownerId) {
      return;
    }
    const owner = findGooseById(cargo.ownerId);
    cargo.grabbed = false;
    cargo.ownerId = null;
    if (owner && owner.cargoId === cargo.id) {
      owner.cargoId = null;
      gooseTaskRegistry.enter(owner, TASKS.WANDER, {
        pauseRange: [0.16, 0.44],
        mayhemRange: [1.2, 4.2],
        minDistance: 90,
        roamScale: 1,
      });
    }
  }

  function removeCargo(cargoId) {
    const cargoIndex = findCargoIndexById(cargoId);
    if (cargoIndex < 0) {
      return;
    }
    const cargo = state.cargoes[cargoIndex];
    if (cargo.removed) {
      return;
    }
    if (cargo.visible && !cargo.rewarded) {
      cargo.rewarded = true;
      earnCurrency(
        CURRENCY_PER_TAB,
        pt(cargo.pos.x + cargo.width / 2, cargo.pos.y + cargo.height / 2)
      );
    }
    cargo.removed = true;
    releaseCargoOwner(cargo);
    state.cargoes.splice(cargoIndex, 1);
  }

  function earnCurrency(amount, point) {
    if (!amount) {
      return;
    }
    state.currency += amount;
    const coinCount = clamp(Math.round(amount * 5), 4, 14);
    for (let i = 0; i < coinCount; i += 1) {
      const launchAngle = rand(-2.55, -0.6);
      const speed = rand(120, 250);
      state.currencyBursts.push({
        pos: pt(
          point.x + rand(-10, 10),
          point.y + rand(-8, 8)
        ),
        vel: pt(
          Math.cos(launchAngle) * speed * rand(0.45, 1),
          Math.sin(launchAngle) * speed
        ),
        age: 0,
        duration: rand(1.45, 1.95),
        radius: rand(8, 12),
        spin: rand(-8.6, 8.6),
        angle: rand(0, TAU),
        wobble: rand(0.55, 1),
      });
    }
    if (state.currencyBursts.length > 56) {
      state.currencyBursts.splice(0, state.currencyBursts.length - 56);
    }
    syncToolUi();
  }

  function cargoCloseRect(cargo) {
    return {
      x: cargo.pos.x + cargo.width - CLOSE_BUTTON_SIZE - 5,
      y: cargo.pos.y + 4,
      width: CLOSE_BUTTON_SIZE,
      height: CLOSE_BUTTON_SIZE,
    };
  }

  function pointInRect(point, rect) {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  function orientation(a, b, c) {
    return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  }

  function onSegment(a, b, c) {
    return (
      b.x <= Math.max(a.x, c.x) + 0.01 &&
      b.x >= Math.min(a.x, c.x) - 0.01 &&
      b.y <= Math.max(a.y, c.y) + 0.01 &&
      b.y >= Math.min(a.y, c.y) - 0.01
    );
  }

  function segmentsIntersect(a1, a2, b1, b2) {
    const o1 = orientation(a1, a2, b1);
    const o2 = orientation(a1, a2, b2);
    const o3 = orientation(b1, b2, a1);
    const o4 = orientation(b1, b2, a2);

    if (o1 * o2 < 0 && o3 * o4 < 0) {
      return true;
    }
    if (Math.abs(o1) < 0.001 && onSegment(a1, b1, a2)) return true;
    if (Math.abs(o2) < 0.001 && onSegment(a1, b2, a2)) return true;
    if (Math.abs(o3) < 0.001 && onSegment(b1, a1, b2)) return true;
    if (Math.abs(o4) < 0.001 && onSegment(b1, a2, b2)) return true;
    return false;
  }

  function segmentIntersectsRect(a, b, rect) {
    if (pointInRect(a, rect) || pointInRect(b, rect)) {
      return true;
    }
    const topLeft = pt(rect.x, rect.y);
    const topRight = pt(rect.x + rect.width, rect.y);
    const bottomLeft = pt(rect.x, rect.y + rect.height);
    const bottomRight = pt(rect.x + rect.width, rect.y + rect.height);
    return (
      segmentsIntersect(a, b, topLeft, topRight) ||
      segmentsIntersect(a, b, topRight, bottomRight) ||
      segmentsIntersect(a, b, bottomRight, bottomLeft) ||
      segmentsIntersect(a, b, bottomLeft, topLeft)
    );
  }

  function cargoRect(cargo) {
    return {
      x: cargo.pos.x,
      y: cargo.pos.y,
      width: cargo.width,
      height: cargo.height,
    };
  }

  function cargoSnapshot(cargo) {
    return {
      kind: cargo.kind,
      title: cargo.title,
      lines: [...cargo.lines],
      imageAsset: cargo.imageAsset,
      width: cargo.width,
      height: cargo.height,
      bar: cargo.bar,
    };
  }

  function drawCargoSnapshotFace(cargo, options = {}) {
    const showClose = options.showClose !== false;
    const showFrame = options.showFrame !== false;
    const hovered = !!options.hovered;
    const titleBarHeight = 25;

    ctx.fillStyle = "#ece9d8";
    ctx.fillRect(0, 0, cargo.width, cargo.height);

    const titleGradient = ctx.createLinearGradient(0, 0, cargo.width, 0);
    titleGradient.addColorStop(0, "#0a246a");
    titleGradient.addColorStop(0.58, "#2f6fd1");
    titleGradient.addColorStop(1, "#75a7ef");
    ctx.fillStyle = titleGradient;
    ctx.fillRect(2, 2, cargo.width - 4, titleBarHeight - 3);

    if (showFrame) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, cargo.width - 1, cargo.height - 1);
      ctx.strokeStyle = "#7f9db9";
      ctx.strokeRect(1.5, 1.5, cargo.width - 3, cargo.height - 3);
      ctx.strokeStyle = "#404040";
      ctx.strokeRect(0.5, 0.5, cargo.width - 1, cargo.height - 1);
    }

    const titleX = 8;
    if (showClose) {
      const closeX = cargo.width - CLOSE_BUTTON_SIZE - 5;
      const closeY = 4;
      const closeGradient = ctx.createLinearGradient(closeX, closeY, closeX, closeY + CLOSE_BUTTON_SIZE);
      closeGradient.addColorStop(0, hovered ? "#ffb19d" : "#f6b7a7");
      closeGradient.addColorStop(0.45, hovered ? "#f26348" : "#df5c45");
      closeGradient.addColorStop(1, hovered ? "#a92214" : "#8f1f12");
      ctx.fillStyle = closeGradient;
      ctx.fillRect(closeX, closeY, CLOSE_BUTTON_SIZE, CLOSE_BUTTON_SIZE);
      ctx.strokeStyle = "#ffffff";
      ctx.strokeRect(closeX + 0.5, closeY + 0.5, CLOSE_BUTTON_SIZE - 1, CLOSE_BUTTON_SIZE - 1);
      ctx.strokeStyle = "#7a150d";
      ctx.strokeRect(closeX, closeY, CLOSE_BUTTON_SIZE, CLOSE_BUTTON_SIZE);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(closeX + 5, closeY + 5);
      ctx.lineTo(closeX + CLOSE_BUTTON_SIZE - 5, closeY + CLOSE_BUTTON_SIZE - 5);
      ctx.moveTo(closeX + CLOSE_BUTTON_SIZE - 5, closeY + 5);
      ctx.lineTo(closeX + 5, closeY + CLOSE_BUTTON_SIZE - 5);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = `700 12px ${DESKTOP_FONT}`;
    ctx.fillText(cargo.title, titleX, 18);

    if (cargo.kind === "meme" && cargo.imageAsset?.image) {
      const contentX = 10;
      const contentY = 34;
      const contentWidth = cargo.width - 20;
      const contentHeight = cargo.height - 44;
      const image = cargo.imageAsset.image;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(contentX, contentY, contentWidth, contentHeight);
      ctx.strokeStyle = "#808080";
      ctx.strokeRect(contentX - 0.5, contentY - 0.5, contentWidth + 1, contentHeight + 1);
      ctx.strokeStyle = "#ffffff";
      ctx.strokeRect(contentX + 0.5, contentY + 0.5, contentWidth - 1, contentHeight - 1);

      if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
        const scale = Math.min(contentWidth / image.naturalWidth, contentHeight / image.naturalHeight);
        const drawWidth = image.naturalWidth * scale;
        const drawHeight = image.naturalHeight * scale;
        const drawX = contentX + (contentWidth - drawWidth) / 2;
        const drawY = contentY + (contentHeight - drawHeight) / 2;
        ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
      } else {
        ctx.fillStyle = "#1f1f1f";
        ctx.font = `12px ${DESKTOP_FONT}`;
        ctx.fillText("goose meme loading", contentX + 12, contentY + contentHeight / 2);
      }
      return;
    }

    const textX = 12;
    const textY = 36;
    const textWidth = cargo.width - 24;
    const textHeight = cargo.height - 47;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(textX - 4, textY - 4, textWidth, textHeight);
    ctx.strokeStyle = "#808080";
    ctx.strokeRect(textX - 4.5, textY - 4.5, textWidth + 1, textHeight + 1);
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(textX - 3.5, textY - 3.5, textWidth - 1, textHeight - 1);

    ctx.font = `12px ${DESKTOP_FONT}`;
    ctx.fillStyle = "#1f1f1f";
    for (let i = 0; i < cargo.lines.length; i += 1) {
      ctx.fillText(cargo.lines[i], textX, 50 + i * 22);
    }
  }

  function findCloseableCargo(point) {
    for (let i = state.cargoes.length - 1; i >= 0; i -= 1) {
      const cargo = state.cargoes[i];
      if (!cargo.visible || cargo.dusting) continue;
      if (pointInRect(point, cargoCloseRect(cargo))) {
        return cargo;
      }
    }
    return null;
  }

  function findTopCargoAtPoint(point) {
    for (let i = state.cargoes.length - 1; i >= 0; i -= 1) {
      const cargo = state.cargoes[i];
      if (!cargo.visible || cargo.dusting) {
        continue;
      }
      if (pointInRect(point, cargoRect(cargo))) {
        return cargo;
      }
    }
    return null;
  }

  function roundedRectPath(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

