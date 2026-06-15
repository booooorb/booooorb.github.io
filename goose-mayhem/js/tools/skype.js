  function skypeOrigin() {
    const app = state.desktopApps.skype;
    if (!app?.owned) {
      return pt(state.width / 2, state.height / 2);
    }
    const rect = desktopToolIconRect("skype");
    return pt(rect.x + rect.width / 2, rect.y + rect.height / 2);
  }

  function skypeCellRadius() {
    return desktopToolIconSize() * 0.5;
  }

  function addSkypeCell(origin, delay = 0, duration = null) {
    const angle = rand(0, TAU);
    const speed = motionQuery.matches ? rand(36, 58) : rand(46, 78);
    state.skype.cells.push({
      id: rand(100000, 999999),
      pos: pt(origin.x + rand(-18, 18), origin.y + rand(-18, 18)),
      vel: mul(angleVec(angle), speed),
      age: -delay,
      duration: duration || (motionQuery.matches ? 1.8 : 2),
      angle: rand(0, TAU),
      spin: rand(-2.2, 2.2),
      radius: skypeCellRadius(),
      cargoId: null,
      captureAge: 0,
      popping: false,
      seed: rand(0, TAU),
    });
    if (state.skype.cells.length > 44) {
      state.skype.cells.splice(0, state.skype.cells.length - 44);
    }
  }

  function spawnSkypeCells(origin, count = 2, duration = null) {
    for (let i = 0; i < count; i += 1) {
      addSkypeCell(origin, i * 0.08, duration);
    }
  }

  function popSkypeCell(cell, branch = false) {
    if (cell.popping) {
      return;
    }
    cell.popping = true;
    state.skype.pops.unshift({
      pos: pt(cell.pos.x, cell.pos.y),
      age: 0,
      duration: motionQuery.matches ? 0.34 : 0.46,
      radius: cell.radius,
      seed: cell.seed,
    });
    if (state.skype.pops.length > 16) {
      state.skype.pops.length = 16;
    }
    if (branch) {
      spawnSkypeCells(cell.pos, 2, Math.sqrt(cell.duration));
    }
  }

  function cellTouchesCargo(cell, cargo) {
    if (!cargo.visible || cargo.dusting || cargo.removed || cargo.skypeCellId) {
      return false;
    }
    const rect = cargoRect(cargo);
    const nearest = pt(
      clamp(cell.pos.x, rect.x, rect.x + rect.width),
      clamp(cell.pos.y, rect.y, rect.y + rect.height)
    );
    return dist(cell.pos, nearest) <= cell.radius * 0.86;
  }

  function captureCargoWithSkypeCell(cell, cargo) {
    if (cell.cargoId || cargo.removed) {
      return;
    }
    releaseCargoOwner(cargo);
    cargo.skypeCellId = cell.id;
    cargo.skypeCellProgress = 0;
    cell.cargoId = cargo.id;
    cell.captureAge = 0;
    cell.vel = mul(cell.vel, 0.38);
  }

  function updateSkypeCellMotion(cell, dt) {
    if (cell.age < 0) {
      return;
    }

    cell.pos = add(cell.pos, mul(cell.vel, dt));
    cell.angle += cell.spin * dt;
    const radius = cell.radius;
    if (cell.pos.x < radius) {
      cell.pos.x = radius;
      cell.vel.x = Math.abs(cell.vel.x);
    } else if (cell.pos.x > state.width - radius) {
      cell.pos.x = state.width - radius;
      cell.vel.x = -Math.abs(cell.vel.x);
    }
    if (cell.pos.y < radius) {
      cell.pos.y = radius;
      cell.vel.y = Math.abs(cell.vel.y);
    } else if (cell.pos.y > state.height - radius) {
      cell.pos.y = state.height - radius;
      cell.vel.y = -Math.abs(cell.vel.y);
    }
  }

  function updateSkypeCellCapture(cell, dt) {
    if (!cell.cargoId) {
      for (const cargo of state.cargoes) {
        if (cellTouchesCargo(cell, cargo)) {
          captureCargoWithSkypeCell(cell, cargo);
          break;
        }
      }
      return false;
    }

    const cargo = findCargoById(cell.cargoId);
    if (!cargo || cargo.removed) {
      popSkypeCell(cell, true);
      return true;
    }

    cell.captureAge += dt;
    const shrinkDuration = motionQuery.matches ? 0.62 : 0.78;
    const captureDuration = motionQuery.matches ? 1.8 : 2;
    const shrinkProgress = clamp(cell.captureAge / shrinkDuration, 0, 1);
    cargo.visible = true;
    cargo.grabbed = false;
    cargo.ownerId = null;
    cargo.skypeCellProgress = shrinkProgress;
    cargo.pos = lerpPt(
      cargo.pos,
      pt(cell.pos.x - cargo.width / 2, cell.pos.y - cargo.height / 2),
      0.24 + shrinkProgress * 0.4
    );
    cell.radius = lerp(cell.radius, skypeCellRadius() * 1.18, 0.08);

    if (cell.captureAge >= captureDuration) {
      removeCargo(cargo.id);
      popSkypeCell(cell, true);
      return true;
    }
    return false;
  }

  function spawnSkypeFromDesktop() {
    spawnSkypeCells(skypeOrigin(), 2);
    syncToolUi();
  }

  function updateSkype(dt) {
    state.skype.pulse += dt * 4.6;
    compactInPlace(state.skype.cells, (cell) => {
      cell.age += dt;
      updateSkypeCellMotion(cell, dt);
      const consumed = updateSkypeCellCapture(cell, dt);
      if (consumed || cell.popping) {
        return false;
      }
      if (!cell.cargoId && cell.age >= cell.duration) {
        popSkypeCell(cell, false);
        return false;
      }
      return true;
    });

    compactInPlace(state.skype.pops, (pop) => {
      pop.age += dt;
      return pop.age < pop.duration;
    });
  }

  class SkypeAnimation extends ToolAnimationInterface {
    update(dt) {
      updateSkype(dt);
    }
  }

  class SkypeTool extends ToolInterface {
    constructor(context) {
      super(context, {
        id: "skype",
        hotkey: "v",
        animation: new SkypeAnimation(context),
      });
    }

    launchFromDesktop() {
      spawnSkypeFromDesktop();
    }
  }
