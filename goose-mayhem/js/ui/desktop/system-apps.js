  function antiMalwareTargetCargo() {
    const cargo = findCargoById(state.antiMalware.targetCargoId);
    return cargo && !cargo.dusting ? cargo : null;
  }

  function antiMalwareIconCenter() {
    const size = antiMalwareIconSize();
    return pt(
      state.antiMalware.iconPos.x + size * 0.5,
      state.antiMalware.iconPos.y + size * 0.5
    );
  }

  function antiMalwareIconAnchor(targetPoint) {
    const size = antiMalwareIconSize();
    const center = antiMalwareIconCenter();
    const rel = sub(targetPoint, center);
    const half = size * 0.5;
    const inset = 5;

    if (Math.abs(rel.x) >= Math.abs(rel.y)) {
      return pt(
        center.x + (rel.x >= 0 ? half - inset : -half + inset),
        center.y + clamp(rel.y, -half * 0.58, half * 0.58)
      );
    }

    return pt(
      center.x + clamp(rel.x, -half * 0.58, half * 0.58),
      center.y + (rel.y >= 0 ? half - inset : -half + inset)
    );
  }

  function antiMalwareCargoAnchor(cargo, fromPoint = antiMalwareIconCenter()) {
    const center = pt(cargo.pos.x + cargo.width / 2, cargo.pos.y + cargo.height / 2);
    const rel = sub(fromPoint, center);
    const inset = 8;

    if (Math.abs(rel.x) >= Math.abs(rel.y)) {
      return pt(
        rel.x >= 0 ? cargo.pos.x + cargo.width - inset : cargo.pos.x + inset,
        center.y
      );
    }

    return pt(
      center.x,
      rel.y >= 0 ? cargo.pos.y + cargo.height - inset : cargo.pos.y + inset
    );
  }

  function antiMalwareConnectionProgress(cargoId = state.antiMalware.targetCargoId) {
    const anti = state.antiMalware;
    if (anti.status !== "connecting" || anti.targetCargoId !== cargoId) {
      return 0;
    }
    return clamp(
      (state.time - anti.connectionStart) / Math.max(anti.connectionDuration, 0.001),
      0,
      1
    );
  }

  function setAntiMalwareEvent(message, duration = 1.8) {
    state.antiMalware.lastEvent = message;
    state.antiMalware.lastEventUntil = state.time + duration;
  }

  function deployAntiMalware() {
    const anti = state.antiMalware;
    if (!anti.deployed) {
      anti.deployed = true;
      anti.windowOpen = false;
      if (isUnplacedDesktopPoint(anti.iconPos)) {
        anti.iconPos = defaultAntiMalwareIconPos();
      }
      anti.windowPos = defaultAntiMalwareWindowPos();
      anti.status = "idle";
      anti.cooldownUntil = state.time + 0.4;
      setAntiMalwareEvent("App deployed", 1.6);
    } else {
      anti.windowOpen = false;
      anti.status = anti.status === "offline" ? "idle" : anti.status;
      setAntiMalwareEvent("App online", 1.2);
    }
    layoutAntiMalware();
    syncToolUi();
  }

  function deployRecycleBin() {
    const bin = state.recycleBin;
    if (!bin.deployed) {
      bin.deployed = true;
      if (isUnplacedDesktopPoint(bin.iconPos)) {
        bin.iconPos = defaultRecycleBinIconPos();
      }
    }
    layoutRecycleBin();
    syncToolUi();
  }

  function deployTaskManager() {
    const task = state.taskManager;
    if (!task.deployed) {
      task.deployed = true;
      if (isUnplacedDesktopPoint(task.iconPos)) {
        task.iconPos = defaultTaskManagerIconPos();
      }
      task.windowPos = defaultTaskManagerWindowPos();
      task.windowOpen = false;
    }
    layoutTaskManager();
    syncToolUi();
  }

  function openTaskManagerWindow() {
    deployTaskManager();
    state.taskManager.windowOpen = true;
    layoutTaskManager();
    syncToolUi();
  }

  function closeTaskManagerWindow() {
    state.taskManager.windowOpen = false;
    syncToolUi();
  }

  function closeAntiMalwareWindow() {
    const anti = state.antiMalware;
    anti.windowOpen = false;
    anti.status = "offline";
    anti.targetCargoId = null;
    anti.connectionStart = 0;
    anti.connectionDuration = 0;
    anti.cooldownUntil = state.time + 0.4;
    setAntiMalwareEvent("Window closed", 1.2);
    syncToolUi();
  }

  function pickAntiMalwareTarget() {
    const anchor = antiMalwareIconCenter();
    let bestCargo = null;
    let bestDistance = Infinity;

    for (const cargo of state.cargoes) {
      if (!cargo.visible || cargo.dusting) {
        continue;
      }

      const distance = dist(anchor, antiMalwareCargoAnchor(cargo, anchor));
      if (distance < bestDistance) {
        bestCargo = cargo;
        bestDistance = distance;
      }
    }

    return bestCargo;
  }

  function startAntiMalwareConnection(cargo) {
    const anti = state.antiMalware;
    anti.status = "connecting";
    anti.targetCargoId = cargo.id;
    anti.connectionStart = state.time;
    anti.connectionDuration = rand(0.4, 0.6);
    setAntiMalwareEvent(`Target locked: ${cargo.title}`, 1.7);
  }

  function spawnAntiMalwareHexDissolve(cargo) {
    const anti = state.antiMalware;
    const center = pt(cargo.pos.x + cargo.width / 2, cargo.pos.y + cargo.height / 2);
    const count = Math.round(clamp((cargo.width * cargo.height) / 620, 38, 96));

    for (let i = 0; i < count; i += 1) {
      const spawn = pt(
        cargo.pos.x + rand(10, cargo.width - 10),
        cargo.pos.y + rand(24, cargo.height - 8)
      );
      const offset = sub(spawn, center);
      const drift = mag(offset) > 0.01 ? norm(offset) : angleVec(rand(0, TAU));
      const lifetime = rand(0.72, 1.65);
      pushTrimmed(anti.hexDigits, {
        text: HEX_DIGITS[randInt(0, HEX_DIGITS.length - 1)],
        pos: spawn,
        vel: add(
          mul(drift, rand(18, 86)),
          pt(rand(-20, 20), rand(-88, -14))
        ),
        size: rand(10, 18),
        life: lifetime,
        maxLife: lifetime,
        spin: rand(-1.8, 1.8),
      }, 360);
    }

    for (let i = 0; i < 9; i += 1) {
      spawnSmoke(center, pt(rand(-0.2, 0.2), -1), 0.96, 22);
    }
  }

  function updateAntiMalware(dt) {
    const anti = state.antiMalware;
    anti.pulse += dt * 5.8;

    compactInPlace(anti.hexDigits, (digit) => {
      digit.life -= dt;
      digit.pos = add(digit.pos, mul(digit.vel, dt));
      digit.vel = add(mul(digit.vel, 0.978), pt(0, -10 * dt));
      digit.size *= 0.998;
      return digit.life > 0 && digit.size > 4;
    });

    if (anti.lastEvent && state.time >= anti.lastEventUntil) {
      anti.lastEvent = "";
    }

    if (!anti.deployed) {
      anti.status = "idle";
      anti.targetCargoId = null;
      return;
    }

    const target = antiMalwareTargetCargo();
    if (anti.status === "connecting") {
      if (!target || !target.visible) {
        anti.status = "cooldown";
        anti.targetCargoId = null;
        anti.cooldownUntil = state.time + 0.75;
        return;
      }

      if (state.time - anti.connectionStart >= anti.connectionDuration) {
        spawnAntiMalwareHexDissolve(target);
        removeCargo(target.id);
        anti.status = "cooldown";
        anti.targetCargoId = null;
        anti.cooldownUntil = state.time + rand(0.8, 1.35);
        setAntiMalwareEvent("Threat dissolved", 1.6);
      }
      return;
    }

    if (anti.status === "cooldown" && state.time < anti.cooldownUntil) {
      return;
    }

    const nextTarget = pickAntiMalwareTarget();
    if (!nextTarget) {
      anti.status = "idle";
      anti.targetCargoId = null;
      return;
    }

    startAntiMalwareConnection(nextTarget);
  }

  function updateGauntlet(dt) {
    const gauntlet = state.gauntlet;
    gauntlet.pulse += dt * 4.8;

    compactInPlace(gauntlet.dustParticles, (particle) => {
      particle.life -= dt;
      particle.pos = add(particle.pos, mul(particle.vel, dt));
      particle.vel = add(mul(particle.vel, 0.986), pt(34 * dt, -8 * dt));
      particle.angle += particle.spin * dt;
      particle.size *= 0.995;
      return particle.life > 0 && particle.size > 0.6;
    });

    const dissolveQueue = [];
    for (const cargo of state.cargoes) {
      if (!cargo.dusting || state.time < cargo.dustStartAt) {
        continue;
      }

      const progress = cargoDustProgress(cargo);
      if (state.time >= cargo.dustNextAt) {
        spawnGauntletDust(cargo, progress, lerp(1.25, 2.7, progress));
        cargo.dustNextAt = state.time + rand(0.026, 0.058);
      }

      if (progress >= 1) {
        dissolveQueue.push(cargo);
      }
    }

    for (const cargo of dissolveQueue) {
      if (!cargo.removed) {
        removeCargo(cargo.id);
      }
    }

    if (gauntlet.snapping && state.time >= gauntlet.cooldownUntil) {
      gauntlet.snapping = false;
      syncToolUi();
    }
  }

  function updateRecycleBin(dt) {
    const bin = state.recycleBin;
    bin.pulse += dt * 4.2;
    if (!bin.deployed) {
      return;
    }

    const mouth = recycleBinMouthPoint();
    const collected = [];
    for (const cargo of state.cargoes) {
      if (!cargo.visible || cargo.dusting) {
        cargo.vacuumProgress = Math.max(0, (cargo.vacuumProgress || 0) - dt * 2.2);
        continue;
      }

      const cargoCenter = pt(cargo.pos.x + cargo.width / 2, cargo.pos.y + cargo.height / 2);
      const distance = dist(mouth, cargoCenter);
      if (distance <= bin.suctionRadius) {
        if (cargo.grabbed || cargo.ownerId) {
          releaseCargoOwner(cargo);
        }
        const closeness = 1 - distance / bin.suctionRadius;
        const vacuumCharge = clamp(closeness * 0.78 + (cargo.vacuumProgress || 0) * 0.82, 0, 1);
        cargo.vacuumProgress = Math.min(
          1,
          (cargo.vacuumProgress || 0) + dt / lerp(2.45, 0.42, vacuumCharge)
        );
        const direction = norm(sub(mouth, cargoCenter));
        const pull = lerp(84, 420, Math.max(Math.pow(closeness, 0.72), cargo.vacuumProgress || 0));
        cargo.pos = clampPoint(add(cargo.pos, mul(direction, pull * dt)));
        if (cargo.vacuumProgress >= 1) {
          collected.push(cargo);
        }
      } else {
        cargo.vacuumProgress = Math.max(0, (cargo.vacuumProgress || 0) - dt * 1.25);
      }
    }

    for (const cargo of collected) {
      if (!cargo.removed) {
        removeCargo(cargo.id);
      }
    }
  }

  function updateTaskManager(dt) {
    state.taskManager.pulse += dt * 4.4;
  }

  function antiMalwareHitTarget(point) {
    if (internetExplorerBlackoutActive()) {
      return null;
    }

    if (state.antiMalware.windowOpen && pointInRect(point, antiMalwareCloseRect())) {
      return "anti-close";
    }
    if (state.antiMalware.windowOpen && pointInRect(point, antiMalwareWindowBarRect())) {
      return "anti-window";
    }
    if (state.antiMalware.windowOpen && pointInRect(point, antiMalwareWindowRect())) {
      return "anti-window-body";
    }
    if (state.antiMalware.deployed && pointInRect(point, antiMalwareIconRect())) {
      return "anti-icon";
    }

    if (state.taskManager.windowOpen) {
      for (const row of taskManagerRows()) {
        if (pointInRect(point, row.endRect)) {
          return `task-end:${row.cargo.id}`;
        }
      }
      if (pointInRect(point, taskManagerCloseRect())) {
        return "task-close";
      }
      if (pointInRect(point, taskManagerBarRect())) {
        return "task-window";
      }
      if (pointInRect(point, taskManagerWindowRect())) {
        return "task-window-body";
      }
    }

    const toolTarget = desktopToolAppHitTarget(point);
    if (toolTarget) {
      return toolTarget;
    }
    if (state.recycleBin.deployed && pointInRect(point, recycleBinIconRect())) {
      return "recycle-icon";
    }
    if (state.taskManager.deployed && pointInRect(point, taskManagerIconRect())) {
      return "task-icon";
    }
    return null;
  }

  function beginAntiMalwareDrag(target, point) {
    let origin = pt();
    clearDesktopSelections();

    if (target === "anti-window") {
      origin = state.antiMalware.windowPos;
    } else if (target === "anti-icon") {
      origin = state.antiMalware.iconPos;
      state.antiMalware.selected = true;
    } else if (target === "recycle-icon") {
      origin = state.recycleBin.iconPos;
      state.recycleBin.selected = true;
    } else if (target === "task-window") {
      origin = state.taskManager.windowPos;
      state.taskManager.selected = true;
    } else if (target === "task-icon") {
      origin = state.taskManager.iconPos;
      state.taskManager.selected = true;
    } else if (target.startsWith("app-icon:")) {
      const appId = target.slice("app-icon:".length);
      const app = state.desktopApps[appId];
      if (!app) {
        return;
      }
      origin = app.iconPos;
      app.selected = true;
    }

    const anti = state.antiMalware;
    anti.drag.active = true;
    anti.drag.target = target;
    anti.drag.offset = sub(point, origin);
    anti.drag.moved = false;
    anti.drag.ignoreClick = false;
  }

  function updateAntiMalwareDrag(point) {
    const anti = state.antiMalware;
    if (!anti.drag.active) {
      return;
    }

    const nextPos = sub(point, anti.drag.offset);
    if (anti.drag.target === "anti-window") {
      const clamped = clampRectPosition(nextPos, anti.width, anti.height, 18);
      if (!anti.drag.moved && dist(clamped, anti.windowPos) > 2) {
        anti.drag.moved = true;
      }
      anti.windowPos = clamped;
      return;
    }

    if (anti.drag.target === "task-window") {
      const task = state.taskManager;
      const clamped = clampRectPosition(nextPos, task.width, task.height, 18);
      if (!anti.drag.moved && dist(clamped, task.windowPos) > 2) {
        anti.drag.moved = true;
      }
      task.windowPos = clamped;
      return;
    }

    if (anti.drag.target === "anti-icon") {
      const size = antiMalwareIconSize();
      const clamped = clampRectPosition(nextPos, size, size + 26, 18);
      if (!anti.drag.moved && dist(clamped, anti.iconPos) > 2) {
        anti.drag.moved = true;
      }
      anti.iconPos = clamped;
      return;
    }

    if (anti.drag.target === "recycle-icon") {
      const size = recycleBinIconSize();
      const clamped = clampRectPosition(nextPos, size, size + 26, 18);
      if (!anti.drag.moved && dist(clamped, state.recycleBin.iconPos) > 2) {
        anti.drag.moved = true;
      }
      state.recycleBin.iconPos = clamped;
      return;
    }

    if (anti.drag.target === "task-icon") {
      const size = taskManagerIconSize();
      const clamped = clampRectPosition(nextPos, size, size + 26, 18);
      if (!anti.drag.moved && dist(clamped, state.taskManager.iconPos) > 2) {
        anti.drag.moved = true;
      }
      state.taskManager.iconPos = clamped;
      return;
    }

    if (anti.drag.target.startsWith("app-icon:")) {
      const appId = anti.drag.target.slice("app-icon:".length);
      const app = state.desktopApps[appId];
      if (!app) {
        return;
      }
      const size = desktopToolIconSize();
      const clamped = clampRectPosition(nextPos, size, size + 26, 18);
      if (!anti.drag.moved && dist(clamped, app.iconPos) > 2) {
        anti.drag.moved = true;
      }
      app.iconPos = clamped;
    }
  }

  function endAntiMalwareDrag() {
    const anti = state.antiMalware;
    if (!anti.drag.active) {
      return;
    }
    anti.drag.ignoreClick = anti.drag.moved && state.pointer.inside;
    anti.drag.active = false;
    anti.drag.target = null;
    anti.drag.offset = pt();
    anti.drag.moved = false;
  }
