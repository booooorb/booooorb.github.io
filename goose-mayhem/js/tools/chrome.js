  function chromeDroidOrigin() {
    const app = state.desktopApps.chrome;
    if (!app?.owned) {
      return pt(state.width / 2, state.height * 0.28);
    }
    const rect = desktopToolIconRect("chrome");
    return pt(rect.x + rect.width / 2, rect.y + rect.height / 2);
  }

  function chromeDroidSize() {
    return clamp(desktopToolIconSize() * 1.12, 48, 68);
  }

  function addChromeDroid(origin, index = 0) {
    const facing = index % 2 === 0 ? 1 : -1;
    const speed = motionQuery.matches ? rand(118, 152) : rand(158, 214);
    state.chrome.droids.push({
      id: rand(100000, 999999),
      pos: pt(origin.x + rand(-16, 16), origin.y + rand(-12, 14)),
      vel: pt(facing * speed, rand(-52, 54)),
      age: 0,
      lifetime: 8,
      size: chromeDroidSize(),
      nextFireAt: 0.36 + index * 0.3,
      fireInterval: motionQuery.matches ? 1.7 : 1.45,
      laserDuration: motionQuery.matches ? 0.72 : 0.92,
      seed: rand(0, TAU),
      banking: rand(-0.36, 0.36),
      facing,
      nextTurnAt: rand(0.45, 0.9),
      laser: null,
    });
  }

  function spawnChromeDroids() {
    const origin = chromeDroidOrigin();
    for (let i = 0; i < 3; i += 1) {
      addChromeDroid(origin, i);
    }
    if (state.chrome.droids.length > 18) {
      state.chrome.droids.splice(0, state.chrome.droids.length - 18);
    }
    state.chrome.pulse += 1.2;
    syncToolUi();
  }

  function chromeDroidFacing(droid) {
    if (Math.abs(droid.vel.x) > 10) {
      droid.facing = droid.vel.x > 0 ? 1 : -1;
    }
    return droid.facing || 1;
  }

  function chromeDroidEyePoint(droid) {
    return pt(
      droid.pos.x,
      droid.pos.y + Math.sin(state.time * 4.4 + droid.seed) * 3.4
    );
  }

  function chromeLaserLandingPoint(droid) {
    const facing = chromeDroidFacing(droid);
    const distance = motionQuery.matches ? rand(168, 224) : rand(230, 322);
    const eye = chromeDroidEyePoint(droid);
    const drop = distance * rand(0.38, 0.52);
    const rawEnd = pt(eye.x + facing * distance, eye.y + drop);
    return {
      start: eye,
      end: pt(
        clamp(rawEnd.x, 8, state.width - 8),
        clamp(rawEnd.y, 8, state.height - 8)
      ),
      direction: norm(pt(facing, drop / distance)),
    };
  }

  function cargoAtChromeLaserPoint(point) {
    for (let i = state.cargoes.length - 1; i >= 0; i -= 1) {
      const cargo = state.cargoes[i];
      if (!cargo.visible || cargo.dusting || cargo.removed) {
        continue;
      }
      const rect = cargoRect(cargo);
      if (
        point.x >= rect.x &&
        point.x <= rect.x + rect.width &&
        point.y >= rect.y &&
        point.y <= rect.y + rect.height
      ) {
        return cargo;
      }
    }
    return null;
  }

  function markCargoWithChromeLaser(cargo, point, direction) {
    if (cargo.chromeLaserMark) {
      return;
    }
    cargo.chromeLaserMark = {
      age: 0,
      duration: 1,
      local: pt(point.x - cargo.pos.x, point.y - cargo.pos.y),
      direction: pt(direction.x, direction.y),
      seed: rand(0, TAU),
    };
  }

  function popChromeDroid(droid) {
    state.chrome.explosions.unshift({
      pos: pt(droid.pos.x, droid.pos.y),
      age: 0,
      duration: motionQuery.matches ? 0.42 : 0.62,
      radius: droid.size * 0.72,
      seed: rand(0, TAU),
    });
    if (state.chrome.explosions.length > 18) {
      state.chrome.explosions.length = 18;
    }
  }

  function pushChromeGroundTrail(beam, strong = false) {
    state.chrome.paths.unshift({
      end: pt(beam.end.x, beam.end.y),
      direction: beam.direction,
      age: 0,
      duration: strong ? 2.2 : 1.45,
      seed: rand(0, TAU),
      radius: strong ? rand(17, 24) : rand(11, 17),
    });
    if (state.chrome.paths.length > 80) {
      state.chrome.paths.length = 80;
    }
  }

  function startChromeLaser(droid) {
    const beam = chromeLaserLandingPoint(droid);
    droid.laser = {
      start: beam.start,
      end: beam.end,
      direction: beam.direction,
      age: 0,
      duration: droid.laserDuration,
      width: rand(3.4, 5.2),
      seed: rand(0, TAU),
      nextTrailAt: 0,
      hitCargoId: null,
    };
    pushChromeGroundTrail(droid.laser, true);
  }

  function updateChromeActiveLaser(droid, dt) {
    if (!droid.laser) {
      return;
    }

    const beam = chromeLaserLandingPoint(droid);
    droid.laser.start = beam.start;
    droid.laser.end = beam.end;
    droid.laser.direction = beam.direction;
    droid.laser.age += dt;

    if (droid.laser.age >= droid.laser.nextTrailAt) {
      pushChromeGroundTrail(droid.laser, true);
      droid.laser.nextTrailAt += motionQuery.matches ? 0.14 : 0.08;
    }

    const cargo = cargoAtChromeLaserPoint(beam.end);
    if (cargo) {
      markCargoWithChromeLaser(cargo, beam.end, beam.direction);
    }

    if (droid.laser.age >= droid.laser.duration) {
      droid.laser = null;
      droid.nextFireAt = droid.age + Math.max(0.42, droid.fireInterval - droid.laserDuration);
    }
  }

  function updateChromeDroidMotion(droid, dt) {
    if (droid.age >= droid.nextTurnAt) {
      const facing = Math.random() < 0.64 ? chromeDroidFacing(droid) : -chromeDroidFacing(droid);
      const angle = rand(-Math.PI * 0.54, Math.PI * 0.54) + (facing > 0 ? 0 : Math.PI);
      const speed = motionQuery.matches ? rand(118, 172) : rand(154, 226);
      droid.vel = mul(angleVec(angle), speed);
      droid.facing = droid.vel.x >= 0 ? 1 : -1;
      droid.nextTurnAt = droid.age + rand(0.55, 1.35);
    }

    const wobble = angleVec(droid.seed + state.time * 2.1);
    droid.vel = add(mul(droid.vel, 0.998), mul(wobble, dt * 42));
    const speed = mag(droid.vel);
    const maxSpeed = motionQuery.matches ? 172 : 232;
    if (speed > maxSpeed) {
      droid.vel = mul(norm(droid.vel), maxSpeed);
    }

    droid.pos = add(droid.pos, mul(droid.vel, dt));
    const margin = droid.size * 0.62;
    if (droid.pos.x < margin) {
      droid.pos.x = margin;
      droid.vel.x = Math.abs(droid.vel.x);
      droid.facing = 1;
    } else if (droid.pos.x > state.width - margin) {
      droid.pos.x = state.width - margin;
      droid.vel.x = -Math.abs(droid.vel.x);
      droid.facing = -1;
    }
    if (droid.pos.y < margin) {
      droid.pos.y = margin;
      droid.vel.y = Math.abs(droid.vel.y);
    } else if (droid.pos.y > state.height - margin) {
      droid.pos.y = state.height - margin;
      droid.vel.y = -Math.abs(droid.vel.y);
    }

    droid.banking = lerp(droid.banking, clamp(droid.vel.x / maxSpeed, -1, 1) * 0.42, 0.08);
  }

  function updateChromeDroidFiring(droid, dt) {
    if (droid.laser) {
      updateChromeActiveLaser(droid, dt);
      return;
    }
    if (droid.age >= droid.nextFireAt && droid.age < droid.lifetime - 0.16) {
      startChromeLaser(droid);
    }
  }

  function updateChromeLaserMarks(dt) {
    for (const cargo of state.cargoes) {
      const mark = cargo.chromeLaserMark;
      if (!mark || cargo.removed || cargo.dusting) {
        continue;
      }
      mark.age += dt;
      if (mark.age < mark.duration) {
        continue;
      }
      const local = mark.local || pt(cargo.width / 2, cargo.height / 2);
      const direction = mark.direction || norm(pt(1, 1));
      const center = pt(cargo.pos.x + local.x, cargo.pos.y + local.y);
      const tangent = norm(pt(direction.y, -direction.x));
      const start = add(center, mul(tangent, -Math.max(cargo.width, cargo.height)));
      const end = add(center, mul(tangent, Math.max(cargo.width, cargo.height)));
      cargo.chromeLaserMark = null;
      splitCargoWithKatana(cargo, start, end, { burned: true });
    }
  }

  function updateChrome(dt) {
    state.chrome.pulse += dt * 3.4;
    updateChromeLaserMarks(dt);

    compactInPlace(state.chrome.droids, (droid) => {
      droid.age += dt;
      updateChromeDroidMotion(droid, dt);
      updateChromeDroidFiring(droid, dt);
      if (droid.age >= droid.lifetime) {
        popChromeDroid(droid);
        return false;
      }
      return true;
    });

    compactInPlace(state.chrome.paths, (path) => {
      path.age += dt;
      return path.age < path.duration;
    });

    compactInPlace(state.chrome.explosions, (explosion) => {
      explosion.age += dt;
      return explosion.age < explosion.duration;
    });
  }

  class ChromeAnimation extends ToolAnimationInterface {
    update(dt) {
      updateChrome(dt);
    }

    drawBeams() {
      drawChromeBeams();
    }

    drawCursor() {}
  }

  class ChromeTool extends ToolInterface {
    constructor(context) {
      super(context, {
        id: "chrome",
        hotkey: "c",
        animation: new ChromeAnimation(context),
      });
    }

    launchFromDesktop() {
      spawnChromeDroids();
    }
  }
