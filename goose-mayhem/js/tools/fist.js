  function toggleFist(force) {
    const desired = toolToggleDesired(state.fist, force);
    state.fist.active = desired;
    if (desired) {
      deactivateExclusiveTools("fist");
    }
    finishToolToggle();
  }

  function spawnFistCrack(point, scale = 1) {
    const crack = {
      point: pt(point.x, point.y),
      age: 0,
      duration: motionQuery.matches ? 8 : 12,
      scale,
      rotation: rand(0, TAU),
      seed: rand(0, TAU),
      spokes: Array.from({ length: 8 }, (_, index) => ({
        angle: (TAU / 8) * index + rand(-0.26, 0.26),
        length: rand(34, 88) * scale,
        bend: rand(-14, 14),
        splitAt: rand(0.35, 0.72),
        splitAngle: rand(-0.75, 0.75),
        splitLength: rand(12, 34) * scale,
      })),
    };
    state.fist.cracks.unshift(crack);
    if (state.fist.cracks.length > 10) {
      state.fist.cracks.length = 10;
    }
  }

  function spawnFistShards(cargo, point) {
    const snapshot = cargoSnapshot(cargo);
    const columns = 4;
    const rows = 3;
    const localImpact = pt(
      clamp(point.x - cargo.pos.x, 0, cargo.width),
      clamp(point.y - cargo.pos.y, 0, cargo.height)
    );

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const source = {
          x: (cargo.width / columns) * column,
          y: (cargo.height / rows) * row,
          width: cargo.width / columns,
          height: cargo.height / rows,
        };
        const center = pt(
          cargo.pos.x + source.x + source.width / 2,
          cargo.pos.y + source.y + source.height / 2
        );
        const localCenter = pt(source.x + source.width / 2, source.y + source.height / 2);
        const away = norm(sub(localCenter, localImpact));
        const direction = mag(away) ? away : angleVec(rand(0, TAU));
        const lifetime = rand(0.8, 1.35);

        state.fist.shards.push({
          cargo: snapshot,
          source,
          pos: center,
          vel: add(
            mul(direction, rand(160, 320)),
            pt(rand(-30, 30), rand(-280, -110))
          ),
          angle: rand(-0.26, 0.26),
          spin: rand(-8.2, 8.2),
          life: lifetime,
          maxLife: lifetime,
        });
      }
    }

    if (state.fist.shards.length > 80) {
      state.fist.shards.splice(0, state.fist.shards.length - 80);
    }
  }

  function smashWithFist(point) {
    const impact = pt(
      clamp(point.x, 22, Math.max(22, state.width - 22)),
      clamp(point.y, 22, Math.max(22, state.height - 22))
    );
    state.fist.punchAge = 0;
    state.fist.punchDuration = motionQuery.matches ? 0.18 : 0.26;
    state.fist.punchAngle = Math.PI * 0.25 + rand(-0.38, 0.38);
    spawnFistCrack(impact, 1);

    const cargo = findTopCargoAtPoint(impact);
    if (!cargo) {
      syncToolUi();
      return;
    }

    spawnFistShards(cargo, impact);
    removeCargo(cargo.id);
    triggerNearbyCursorChase(pt(cargo.pos.x + cargo.width / 2, cargo.pos.y + cargo.height / 2));
    syncToolUi();
  }

  function updateCurrencyBursts(dt) {
    compactInPlace(state.currencyBursts, (burst) => {
      burst.age += dt;
      burst.vel = add(mul(burst.vel, 0.985), pt(0, 620 * dt));
      burst.pos = add(burst.pos, mul(burst.vel, dt));
      burst.angle += burst.spin * dt;
      return (
        burst.age < burst.duration
        && burst.pos.y < state.height + burst.radius * 4
      );
    });
  }

  function updateFist(dt) {
    state.fist.pulse += dt * (state.fist.active ? 6.8 : 3.6);
    state.fist.punchAge = Math.min(state.fist.punchDuration, state.fist.punchAge + dt);
    state.fist.impactFlash *= Math.exp(-dt * 8.2);
    if (state.fist.impactFlash < 0.002) {
      state.fist.impactFlash = 0;
    }

    compactInPlace(state.fist.cracks, (crack) => {
      crack.age += dt;
      return crack.age < crack.duration;
    });

    compactInPlace(state.fist.shards, (shard) => {
      shard.life -= dt;
      shard.pos = add(shard.pos, mul(shard.vel, dt));
      shard.vel = add(mul(shard.vel, 0.965), pt(0, 540 * dt));
      shard.angle += shard.spin * dt;
      return (
        shard.life > 0
        && shard.pos.x > -160
        && shard.pos.x < state.width + 160
        && shard.pos.y < state.height + 240
      );
    });
  }

  class FistAnimation extends ToolAnimationInterface {
    update(dt) {
      updateFist(dt);
    }

    drawCursor() {
      drawFistCursor();
    }

    drawShards() {
      drawFistShards();
    }

    drawCracks() {
      drawFistCracks();
    }
  }

  class FistTool extends DesktopToggleTool {
    constructor(context) {
      super(context, {
        id: "fist",
        hotkey: "h",
        animation: new FistAnimation(context),
        toggle: toggleFist,
      });
    }

    smash(point) {
      smashWithFist(point);
    }
  }
