  function findPaintCleanupGoose(cargo) {
    const center = pt(cargo.pos.x + cargo.width / 2, cargo.pos.y + cargo.height / 2);
    const owner = cargo.ownerId ? findGooseById(cargo.ownerId) : null;
    if (owner) {
      return owner;
    }

    let bestGoose = null;
    let bestDistance = Infinity;
    for (const goose of state.geese) {
      if (
        goose.cargoId
        || (goose.task === TASKS.DRAG_TAB && goose.cargoId)
        || (goose.task === TASKS.PAINT_CLEANUP && goose.cargoId)
      ) {
        continue;
      }
      const distance = dist(goose.pos, center);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestGoose = goose;
      }
    }

    if (bestGoose) {
      return bestGoose;
    }

    for (const goose of state.geese) {
      const distance = dist(goose.pos, center);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestGoose = goose;
      }
    }
    return bestGoose;
  }

  function sendPaintedCargoAway(cargo) {
    if (!cargo || cargo.paintCleanupQueued || cargo.removed) {
      return;
    }
    cargo.paintCleanupQueued = true;
    const goose = findPaintCleanupGoose(cargo);
    if (!goose) {
      removeCargo(cargo.id);
      return;
    }
    gooseTaskRegistry.enter(goose, TASKS.PAINT_CLEANUP, cargo);
  }

  function ensureCargoPaintState(cargo) {
    if (!cargo.paintStrokes) {
      cargo.paintStrokes = [];
    }
    if (!cargo.paintCells) {
      cargo.paintCells = new Set();
    }
    if (!Number.isFinite(cargo.paintCoverage)) {
      cargo.paintCoverage = 0;
    }
  }

  function markCargoPaintCoverage(cargo, localPoint, radius) {
    ensureCargoPaintState(cargo);
    const cellSize = state.paint.paintCellSize;
    const minCellX = Math.floor((localPoint.x - radius) / cellSize);
    const maxCellX = Math.floor((localPoint.x + radius) / cellSize);
    const minCellY = Math.floor((localPoint.y - radius) / cellSize);
    const maxCellY = Math.floor((localPoint.y + radius) / cellSize);
    const radiusSq = radius * radius;

    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        const center = pt(
          cellX * cellSize + cellSize * 0.5,
          cellY * cellSize + cellSize * 0.5
        );
        if (
          center.x < 0
          || center.x > cargo.width
          || center.y < 0
          || center.y > cargo.height
          || dist(center, localPoint) > radius + cellSize * 0.58
        ) {
          continue;
        }
        if (dist(center, localPoint) <= Math.sqrt(radiusSq) + cellSize * 0.58) {
          cargo.paintCells.add(`${cellX}:${cellY}`);
        }
      }
    }

    cargo.paintCoverage = clamp(
      (cargo.paintCells.size * cellSize * cellSize) / Math.max(cargo.width * cargo.height, 1),
      0,
      1
    );
  }

  function stampPaint(point) {
    const cargo = findTopCargoAtPoint(point);
    if (!cargo || !cargo.visible || cargo.dusting || cargo.removed) {
      return false;
    }

    ensureCargoPaintState(cargo);
    const radius = state.paint.brushRadius;
    const localPoint = pt(
      clamp(point.x - cargo.pos.x, 0, cargo.width),
      clamp(point.y - cargo.pos.y, 0, cargo.height)
    );
    pushTrimmed(cargo.paintStrokes, {
      x: localPoint.x,
      y: localPoint.y,
      radius: radius * rand(0.86, 1.18),
      wobble: rand(0, TAU),
    }, 420);
    markCargoPaintCoverage(cargo, localPoint, radius);

    if (cargo.paintCoverage > 0.4) {
      sendPaintedCargoAway(cargo);
    }
    return true;
  }

  function paintAlongSegment(start, end) {
    const distance = dist(start, end);
    const steps = Math.max(1, Math.ceil(distance / 5));
    let painted = false;
    for (let i = 0; i <= steps; i += 1) {
      painted = stampPaint(lerpPt(start, end, i / steps)) || painted;
    }
    return painted;
  }

  function togglePaint(force) {
    const desired = toolToggleDesired(state.paint, force);
    state.paint.active = desired;
    state.paint.painting = false;
    if (desired) {
      deactivateExclusiveTools("paint");
    }
    finishToolToggle();
  }

  function beginPainting(point) {
    state.paint.painting = true;
    paintAlongSegment(point, point);
  }

  function extendPainting(previous, point) {
    if (!state.paint.active || !state.paint.painting) {
      return false;
    }
    return paintAlongSegment(previous, point);
  }

  function stopPainting() {
    state.paint.painting = false;
  }

  function updatePaint(dt) {
    state.paint.pulse += dt * (state.paint.painting ? 9.6 : 4.2);
  }

  function drawPaintCursor() {
    if (!state.paint.active || !state.pointer.inside) {
      return;
    }

    const pulse = Math.sin(state.paint.pulse * 1.7) * 0.5 + 0.5;
    const radius = state.paint.brushRadius;
    const point = state.pointer.pos;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(-0.72 + pulse * 0.06);
    ctx.shadowColor = "rgba(122, 0, 0, 0.32)";
    ctx.shadowBlur = state.paint.painting ? 12 : 6;

    ctx.fillStyle = "rgba(138, 76, 30, 0.98)";
    roundedRectPath(-5, -36, 10, 32, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(79, 38, 15, 0.72)";
    ctx.strokeRect(-5, -36, 10, 32);

    ctx.fillStyle = "rgba(55, 57, 63, 0.96)";
    roundedRectPath(-8, -10, 16, 12, 3);
    ctx.fill();

    ctx.fillStyle = "rgba(221, 22, 22, 0.96)";
    ctx.beginPath();
    ctx.moveTo(-radius * 0.72, 0);
    ctx.quadraticCurveTo(0, radius * 0.72 + pulse * 3, radius * 0.72, 0);
    ctx.lineTo(radius * 0.5, radius * 1.28);
    ctx.quadraticCurveTo(0, radius * 1.62, -radius * 0.5, radius * 1.28);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  class PaintAnimation extends ToolAnimationInterface {
    update(dt) {
      updatePaint(dt);
    }

    drawCursor() {
      drawPaintCursor();
    }
  }

  class PaintTool extends DesktopToggleTool {
    constructor(context) {
      super(context, {
        id: "paint",
        hotkey: "p",
        animation: new PaintAnimation(context),
        toggle: togglePaint,
      });
    }

    begin(point) {
      beginPainting(point);
    }

    extend(previous, point) {
      return extendPainting(previous, point);
    }

    stop() {
      stopPainting();
    }
  }
