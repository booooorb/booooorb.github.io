  function spawnThunderSpark(origin, direction = pt(0, 1), intensity = 1) {
    const dir = mag(direction) ? norm(direction) : pt(0, 1);
    const side = perp(dir);
    const lifetime = rand(0.16, 0.34) * lerp(0.92, 1.25, intensity);
    pushTrimmed(state.thunder.sparks, {
      pos: pt(origin.x, origin.y),
      vel: add(
        mul(dir, rand(90, 240) * intensity),
        mul(side, rand(-180, 180) * intensity)
      ),
      size: rand(2, 5.4) * lerp(0.9, 1.35, intensity),
      life: lifetime,
      maxLife: lifetime,
      angle: rand(0, TAU),
      spin: rand(-7, 7),
    }, 220);
  }

  function spawnWeatherRainDrop() {
    const wind = Math.sin(state.time * 0.46) * 34;
    const speed = rand(motionQuery.matches ? 420 : 540, motionQuery.matches ? 650 : 820);
    const lifetime = rand(0.92, 1.34);
    pushTrimmed(state.thunder.rainDrops, {
      pos: pt(rand(-90, state.width + 90), rand(-100, -8)),
      vel: pt(wind + rand(-24, 24), speed),
      length: rand(motionQuery.matches ? 11 : 16, motionQuery.matches ? 18 : 28),
      life: lifetime,
      maxLife: lifetime,
      alpha: rand(0.32, 0.68),
    }, motionQuery.matches ? 110 : 190);
  }

  function updateWeatherRain(dt) {
    const thunder = state.thunder;
    if (thunder.active) {
      thunder.rainSpawnRemainder += dt * (motionQuery.matches ? 78 : 150);
      while (thunder.rainSpawnRemainder >= 1) {
        spawnWeatherRainDrop();
        thunder.rainSpawnRemainder -= 1;
      }
    } else {
      thunder.rainSpawnRemainder = 0;
    }

    compactInPlace(thunder.rainDrops, (drop) => {
      drop.life -= dt;
      drop.pos = add(drop.pos, mul(drop.vel, dt));
      return (
        drop.life > 0
        && drop.pos.y < state.height + 80
        && drop.pos.x > -160
        && drop.pos.x < state.width + 160
      );
    });
  }

  function igniteCargoFromThunder(cargo, strikePoint, power = 1) {
    const center = pt(cargo.pos.x + cargo.width / 2, cargo.pos.y + cargo.height / 2);
    const direction = norm(sub(center, strikePoint));
    ensureCargoBurnSide(cargo, mag(direction) ? direction : pt(rand(-1, 1), -1));
    cargo.heat = clamp(cargo.heat + 0.24 * power, 0, 1);
    cargo.fireLevel = clamp(cargo.fireLevel + 0.2 * power, 0, 1);
    cargo.burnProgress = clamp(cargo.burnProgress + 0.04 * power, 0, 1.14);
    spawnBurnBurst(center);
  }

  function directThunderTargets(point) {
    return state.cargoes.filter((cargo) => (
      cargo.visible
      && !cargo.dusting
      && pointInRect(point, cargoRect(cargo))
    ));
  }

  function thunderBoltStart(target) {
    return pt(
      clamp(target.x + rand(-34, 34), 20, Math.max(20, state.width - 20)),
      -42
    );
  }

  function generateThunderBoltPath(start, end, segments = 14, amplitude = 84) {
    const path = [pt(start.x, start.y)];
    const dir = norm(sub(end, start));
    const side = mag(dir) ? perp(dir) : pt(1, 0);

    for (let i = 1; i < segments; i += 1) {
      const t = i / segments;
      const base = lerpPt(start, end, t);
      const zig = (i % 2 === 0 ? -1 : 1) * lerp(amplitude, 16, t) * rand(0.62, 1.08);
      const jitter = rand(-10, 10);
      path.push(add(base, mul(side, zig + jitter)));
    }

    path.push(pt(end.x, end.y));
    return path;
  }

  function generateThunderBranchPath(mainPath, target) {
    const startIndex = randInt(2, Math.max(2, mainPath.length - 4));
    const start = mainPath[startIndex];
    const end = pt(
      clamp(start.x + rand(-112, 112), 18, Math.max(18, state.width - 18)),
      clamp(start.y + rand(46, 132), 12, Math.max(12, target.y - 8))
    );
    return generateThunderBoltPath(start, end, randInt(4, 6), rand(28, 54));
  }

  function strikeThunder(point) {
    const clamped = pt(
      clamp(point.x, 34, Math.max(34, state.width - 34)),
      clamp(point.y, 18, Math.max(18, state.height - 34))
    );
    const nearRadius = motionQuery.matches ? 138 : 176;
    const directHits = [];
    const mainPath = generateThunderBoltPath(
      thunderBoltStart(clamped),
      clamped,
      motionQuery.matches ? 11 : 15,
      motionQuery.matches ? 62 : 92
    );

    state.thunder.flash = 1;
    state.thunder.strikes.push({
      point: clamped,
      age: 0,
      duration: motionQuery.matches ? 0.68 : 0.96,
      path: mainPath,
      branches: Array.from({ length: 7 }, () => generateThunderBranchPath(mainPath, clamped)),
    });
    pushTrimmed(state.thunder.scorches, {
      point: pt(clamped.x, clamped.y + 10),
      age: 0,
      duration: motionQuery.matches ? 1.9 : 2.8,
      radiusX: rand(34, 52),
      radiusY: rand(12, 20),
      angle: rand(-0.24, 0.24),
    }, 8);
    if (state.thunder.strikes.length > 5) {
      state.thunder.strikes.shift();
    }

    for (let i = 0; i < 46; i += 1) {
      spawnThunderSpark(clamped, angleVec(rand(-Math.PI, Math.PI)), rand(0.8, 1.3));
    }

    for (const cargo of state.cargoes) {
      if (!cargo.visible || cargo.dusting) {
        continue;
      }
      const center = pt(cargo.pos.x + cargo.width / 2, cargo.pos.y + cargo.height / 2);
      const distance = dist(clamped, center);
      if (pointInRect(clamped, cargoRect(cargo))) {
        state.thunder.vaporizing.push({
          cargo: cargoSnapshot(cargo),
          pos: pt(cargo.pos.x, cargo.pos.y),
          age: 0,
          duration: motionQuery.matches ? 0.48 : 0.72,
          seed: rand(0, 1000),
        });
        for (let i = 0; i < 26; i += 1) {
          const local = pt(rand(10, cargo.width - 10), rand(10, cargo.height - 10));
          spawnThunderSpark(add(cargo.pos, local), norm(sub(add(cargo.pos, local), clamped)), rand(0.85, 1.4));
        }
        directHits.push(cargo);
        continue;
      }
      if (distance <= nearRadius) {
        const intensity = 1 - distance / nearRadius;
        igniteCargoFromThunder(cargo, clamped, intensity);
      }
    }

    for (const cargo of directHits) {
      if (!cargo.removed) {
        removeCargo(cargo.id);
      }
    }
  }

  function updateThunder(dt) {
    state.thunder.pulse += dt * 6.4;
    state.thunder.cursorJitter += dt * 18;

    updateWeatherRain(dt);

    state.thunder.flash *= Math.exp(-dt * 6.4);
    if (state.thunder.flash < 0.002) {
      state.thunder.flash = 0;
    }

    compactInPlace(state.thunder.strikes, (strike) => {
      strike.age += dt;
      return strike.age < strike.duration;
    });

    compactInPlace(state.thunder.scorches, (scorch) => {
      scorch.age += dt;
      return scorch.age < scorch.duration;
    });

    compactInPlace(state.thunder.sparks, (spark) => {
      spark.life -= dt;
      spark.pos = add(spark.pos, mul(spark.vel, dt));
      spark.vel = add(mul(spark.vel, 0.93), pt(0, 180 * dt));
      spark.angle += spark.spin * dt;
      return spark.life > 0;
    });

    compactInPlace(state.thunder.vaporizing, (victim) => {
      victim.age += dt;
      return victim.age < victim.duration;
    });
  }

  function toggleThunder(force) {
    const desired = toolToggleDesired(state.thunder, force);
    state.thunder.active = desired;
    if (desired) {
      deactivateExclusiveTools("thunder");
    }
    finishToolToggle();
  }

  class ThunderAnimation extends ToolAnimationInterface {
    update(dt) {
      updateThunder(dt);
    }

    drawCursor() {
      drawThunderCursor();
    }

    drawEffects() {
      drawThunderEffects();
    }
  }

  class ThunderTool extends DesktopToggleTool {
    constructor(context) {
      super(context, {
        id: "thunder",
        hotkey: "y",
        animation: new ThunderAnimation(context),
        toggle: toggleThunder,
      });
    }

    strike(point) {
      strikeThunder(point);
    }
  }
