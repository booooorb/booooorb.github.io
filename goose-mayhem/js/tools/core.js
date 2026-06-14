  function pointerPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return pt(event.clientX - rect.left, event.clientY - rect.top);
  }

  function flamethrowerOrigin() {
    if (state.flamethrower.active && state.pointer.inside) {
      return add(state.pointer.pos, mul(FLAME_DIRECTION, -18));
    }

    return pt(
      Math.min(148, Math.max(62, state.width * 0.14)),
      state.height + 20
    );
  }

  function flamethrowerRigGeometry(origin = flamethrowerOrigin(), direction = state.flamethrower.aimDir) {
    return {
      base: add(origin, mul(direction, -44)),
      nozzle: add(origin, mul(direction, 20)),
    };
  }

  function flamethrowerEmissionPoint() {
    return flamethrowerRigGeometry().nozzle;
  }

  function flamethrowerRange() {
    const maxRange = Math.max(FLAME_RANGE, Math.hypot(state.width, state.height) * 0.62);
    if (state.flamethrower.active && state.pointer.inside) {
      return clamp(Math.max(FLAME_RANGE, maxRange * 0.34), 220, maxRange);
    }

    const origin = flamethrowerOrigin();
    if (!state.pointer.inside) {
      return maxRange * 0.62;
    }
    return clamp(dist(origin, state.pointer.pos) + 88, 160, maxRange);
  }

  function isGrabCursorTarget(target = state.hoveredUiTarget) {
    return target === "anti-icon"
      || target === "anti-window"
      || target === "recycle-icon"
      || target === "task-icon"
      || target === "task-window"
      || target?.startsWith("app-icon:");
  }

  function activeToolOwnsCursor() {
    return state.nuke.active
      || state.fist.active
      || state.thunder.active
      || state.bread.active
      || state.paint.active
      || state.katana.active
      || state.flamethrower.active;
  }

  function syncCanvasCursor() {
    if (state.antiMalware.drag.active) {
      canvas.style.cursor = "grabbing";
      return;
    }
    if (isGrabCursorTarget()) {
      canvas.style.cursor = "grab";
      return;
    }
    if (state.hoveredUiTarget === "anti-window-body" || state.hoveredUiTarget === "task-window-body") {
      canvas.style.cursor = "default";
      return;
    }
    if (activeToolOwnsCursor()) {
      canvas.style.cursor = "none";
      return;
    }
    canvas.style.cursor = state.hoveredUiTarget || state.hoveredCargoId ? "pointer" : "default";
  }

  function syncToolUi() {
    syncDesktopToolSelections();
    syncShopUi();
    syncCanvasCursor();
  }

  const EXCLUSIVE_TOOL_IDS = [
    "flamethrower",
    "katana",
    "nuke",
    "thunder",
    "bread",
    "paint",
    "fist",
  ];

  function deactivateExclusiveTool(toolId) {
    if (toolId === "flamethrower") {
      state.flamethrower.active = false;
      state.flamethrower.firing = false;
      state.flamethrower.grabbed = false;
      state.flamethrower.hovered = false;
      return;
    }

    if (toolId === "katana") {
      state.katana.active = false;
      state.katana.slicing = false;
      if (typeof clearKatanaTrail === "function") {
        clearKatanaTrail();
      }
      return;
    }

    if (toolId === "paint") {
      state.paint.active = false;
      state.paint.painting = false;
      return;
    }

    if (state[toolId]) {
      state[toolId].active = false;
    }
  }

  function deactivateExclusiveTools(activeToolId) {
    for (const toolId of EXCLUSIVE_TOOL_IDS) {
      if (toolId !== activeToolId) {
        deactivateExclusiveTool(toolId);
      }
    }
  }

  function toolToggleDesired(toolState, force) {
    return typeof force === "boolean"
      ? force
      : !toolState.active;
  }

  function finishToolToggle() {
    state.hoveredCargoId = null;
    state.hoveredUiTarget = null;
    syncToolUi();
  }

  function updateFlamethrowerAim(point = state.pointer.pos) {
    if (state.flamethrower.active) {
      state.flamethrower.aimDir = FLAME_DIRECTION;
      return;
    }

    const offset = sub(point, flamethrowerOrigin());
    if (mag(offset) < 28) {
      return;
    }
    const direction = norm(offset);
    if (mag(direction)) {
      state.flamethrower.aimDir = direction;
    }
  }

  function toggleFlamethrower(force) {
    const desired = toolToggleDesired(state.flamethrower, force);
    state.flamethrower.active = desired;
    if (!state.flamethrower.active) {
      state.flamethrower.firing = false;
      state.flamethrower.grabbed = false;
      state.flamethrower.hovered = false;
    } else {
      deactivateExclusiveTools("flamethrower");
      state.flamethrower.aimDir = FLAME_DIRECTION;
      state.flamethrower.grabbed = true;
      state.flamethrower.hovered = false;
      if (state.pointer.inside) {
        updateFlamethrowerAim(state.pointer.pos);
      }
    }
    finishToolToggle();
  }

