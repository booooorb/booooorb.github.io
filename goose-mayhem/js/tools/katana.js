  function updateKatanaAim(movement) {
    if (!movement || mag(movement) < 2) {
      return;
    }
    state.katana.aimDir = norm(movement);
  }

  function clearKatanaTrail() {
    state.katana.slashTrail = [];
  }

  function pushKatanaTrailPoint(point) {
    const trail = state.katana.slashTrail;
    const last = trail[trail.length - 1];
    if (last && dist(last.pos, point) < 4) {
      last.pos = pt(point.x, point.y);
      last.age = 0;
      return;
    }
    trail.push({
      pos: pt(point.x, point.y),
      age: 0,
    });
    if (trail.length > 22) {
      trail.shift();
    }
  }

  function splitCargoWithKatana(cargo, start, end) {
    const slice = sub(end, start);
    if (mag(slice) < KATANA_SLICE_MIN) {
      return false;
    }

    const splitAxis = Math.abs(slice.x) >= Math.abs(slice.y) ? "horizontal" : "vertical";
    const tangent = mag(slice) > 1 ? norm(slice) : pt(1, 0);
    let normal = perp(tangent);
    if (!mag(normal)) {
      normal = pt(0, -1);
    }
    const snapshot = cargoSnapshot(cargo);
    const pieceVelocities = [
      add(mul(normal, rand(150, 230)), add(mul(tangent, rand(-42, 42)), pt(rand(-28, 18), -rand(170, 250)))),
      add(mul(normal, -rand(150, 230)), add(mul(tangent, rand(-42, 42)), pt(rand(-18, 28), -rand(170, 250)))),
    ];

    removeCargo(cargo.id);

    for (let i = 0; i < 2; i += 1) {
      state.katana.splitPieces.push({
        cargo: snapshot,
        pos: pt(cargo.pos.x, cargo.pos.y),
        vel: pieceVelocities[i],
        angle: 0,
        spin: rand(i === 0 ? -4.8 : 1.6, i === 0 ? -1.6 : 4.8),
        axis: splitAxis,
        side: i,
      });
    }

    return true;
  }

  function attemptKatanaSlice(start, end) {
    if (dist(start, end) < KATANA_SLICE_MIN) {
      return;
    }

    for (let i = state.cargoes.length - 1; i >= 0; i -= 1) {
      const cargo = state.cargoes[i];
      if (!cargo.visible || cargo.dusting) {
        continue;
      }
      if (segmentIntersectsRect(start, end, cargoRect(cargo))) {
        splitCargoWithKatana(cargo, start, end);
      }
    }
  }

  function updateKatana(dt) {
    compactInPlace(state.katana.slashTrail, (point) => {
      point.age += dt;
      return point.age < 0.28;
    });

    compactInPlace(state.katana.splitPieces, (piece) => {
      piece.pos = add(piece.pos, mul(piece.vel, dt));
      piece.vel = add(mul(piece.vel, 0.995), pt(0, 980 * dt));
      piece.angle += piece.spin * dt;
      return (
        piece.pos.x < state.width + piece.cargo.width + 160 &&
        piece.pos.x > -piece.cargo.width - 160 &&
        piece.pos.y < state.height + piece.cargo.height + 220
      );
    });
  }

  function toggleKatana(force) {
    const desired = toolToggleDesired(state.katana, force);
    state.katana.active = desired;
    state.katana.slicing = false;
    clearKatanaTrail();

    if (desired) {
      deactivateExclusiveTools("katana");
      if (state.pointer.inside) {
        state.katana.aimDir = norm(pt(-1, -0.45));
      }
    }

    finishToolToggle();
  }

  class KatanaAnimation extends ToolAnimationInterface {
    update(dt) {
      updateKatana(dt);
    }

    drawTrail() {
      drawKatanaTrail();
    }

    drawCursor() {
      drawKatanaCursor();
    }

    drawSplitPieces() {
      drawKatanaSplitPieces();
    }
  }

  class KatanaTool extends DesktopToggleTool {
    constructor(context) {
      super(context, {
        id: "katana",
        hotkey: "k",
        animation: new KatanaAnimation(context),
        toggle: toggleKatana,
      });
    }

    updateAim(movement) {
      updateKatanaAim(movement);
    }

    beginSlicing(point) {
      state.katana.slicing = true;
      clearKatanaTrail();
      pushKatanaTrailPoint(point);
      state.hoveredCargoId = null;
      state.hoveredUiTarget = null;
      syncCanvasCursor();
    }

    extendSlice(start, end) {
      pushKatanaTrailPoint(start);
      pushKatanaTrailPoint(end);
      attemptKatanaSlice(start, end);
    }

    stopSlicing() {
      state.katana.slicing = false;
    }
  }
