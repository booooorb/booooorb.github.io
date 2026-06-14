  function toggleMinesweeper(force) {
    const desired = toolToggleDesired(state.minesweeper, force);
    state.minesweeper.active = desired;
    if (desired) {
      deactivateExclusiveTools("minesweeper");
    }
    finishToolToggle();
  }

  function placeMine(point) {
    const directCargo = findTopCargoAtPoint(point);
    const mine = {
      pos: pt(
        clamp(point.x, 24, Math.max(24, state.width - 24)),
        clamp(point.y, 36, Math.max(36, state.height - 24))
      ),
      age: 0,
      armedAt: state.time + 0.2,
      triggered: false,
      triggerAge: 0,
      triggerDuration: motionQuery.matches ? 0.18 : 0.28,
      radius: motionQuery.matches ? 28 : 34,
      phase: rand(0, TAU),
    };

    if (directCargo && directCargo.visible && !directCargo.dusting && !directCargo.removed) {
      detonateMine(mine);
      syncToolUi();
      return;
    }

    state.minesweeper.mines.push(mine);
    if (state.minesweeper.mines.length > 28) {
      state.minesweeper.mines.shift();
    }
    syncToolUi();
  }

  function cargoTriggersMine(cargo, mine) {
    if (!cargo.visible || cargo.dusting || cargo.removed || state.time < mine.armedAt) {
      return false;
    }
    const rect = cargoRect(cargo);
    const nearest = pt(
      clamp(mine.pos.x, rect.x, rect.x + rect.width),
      clamp(mine.pos.y, rect.y, rect.y + rect.height)
    );
    return dist(mine.pos, nearest) <= mine.radius;
  }

  function detonateMine(mine) {
    state.minesweeper.explosions.unshift({
      pos: pt(mine.pos.x, mine.pos.y),
      age: 0,
      duration: motionQuery.matches ? 0.72 : 0.98,
      radius: motionQuery.matches ? 118 : 156,
      seed: rand(0, TAU),
    });
    if (state.minesweeper.explosions.length > 8) {
      state.minesweeper.explosions.length = 8;
    }

    const affected = [];
    for (const cargo of state.cargoes) {
      if (!cargo.visible || cargo.dusting || cargo.removed) {
        continue;
      }
      const center = pt(cargo.pos.x + cargo.width / 2, cargo.pos.y + cargo.height / 2);
      if (dist(center, mine.pos) <= 118 + Math.hypot(cargo.width, cargo.height) * 0.28) {
        affected.push(cargo);
      }
    }

    for (const cargo of affected) {
      if (!cargo.removed) {
        spawnFistShards(cargo, mine.pos);
        removeCargo(cargo.id);
      }
    }

    for (const goose of state.geese) {
      const distance = dist(goose.pos, mine.pos);
      if (distance > 210) {
        continue;
      }
      if (goose.cargoId) {
        dropGooseCargo(goose);
      }
      const away = norm(sub(goose.pos, mine.pos));
      const direction = mag(away) ? away : angleVec(rand(0, TAU));
      goose.sprinting = true;
      goose.pauseUntil = 0;
      goose.vel = add(goose.vel, mul(direction, rand(180, 340)));
      goose.target = clampPoint(add(goose.pos, mul(direction, rand(120, 230))));
      if (Math.random() < 0.34) {
        triggerHonk(goose, "HONK!");
      }
    }
  }

  function updateMinesweeper(dt) {
    const minesweeper = state.minesweeper;
    minesweeper.pulse += dt * (minesweeper.active ? 5.8 : 3.4);

    const detonating = [];
    for (const mine of minesweeper.mines) {
      mine.age += dt;
      if (mine.triggered) {
        mine.triggerAge += dt;
        if (mine.triggerAge >= mine.triggerDuration) {
          detonating.push(mine);
        }
        continue;
      }
      for (const cargo of state.cargoes) {
        if (!cargo.ownerId && !cargo.grabbed) {
          continue;
        }
        if (cargoTriggersMine(cargo, mine)) {
          mine.triggered = true;
          mine.triggerAge = 0;
          break;
        }
      }
    }

    if (detonating.length) {
      compactInPlace(minesweeper.mines, (mine) => {
        if (!detonating.includes(mine)) {
          return true;
        }
        detonateMine(mine);
        return false;
      });
    }

    compactInPlace(minesweeper.explosions, (explosion) => {
      explosion.age += dt;
      return explosion.age < explosion.duration;
    });
  }

  function drawMinesweeperCursor() {
    if (!state.minesweeper.active || !state.pointer.inside) {
      return;
    }

    const pulse = Math.sin(state.minesweeper.pulse * 1.8) * 0.5 + 0.5;
    const point = state.pointer.pos;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255, 32, 32, ${0.12 + pulse * 0.12})`;
    ctx.beginPath();
    ctx.arc(0, 0, 24 + pulse * 4, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.strokeStyle = "rgba(90, 38, 18, 0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-5, 16);
    ctx.lineTo(-5, -18);
    ctx.stroke();
    ctx.fillStyle = "rgba(224, 18, 18, 0.98)";
    ctx.beginPath();
    ctx.moveTo(-4, -18);
    ctx.lineTo(18, -10);
    ctx.lineTo(-4, -2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  class MinesweeperAnimation extends ToolAnimationInterface {
    update(dt) {
      updateMinesweeper(dt);
    }

    drawCursor() {
      drawMinesweeperCursor();
    }
  }

  class MinesweeperTool extends DesktopToggleTool {
    constructor(context) {
      super(context, {
        id: "minesweeper",
        hotkey: "m",
        animation: new MinesweeperAnimation(context),
        toggle: toggleMinesweeper,
      });
    }

    place(point) {
      placeMine(point);
    }
  }
