  function setPointerHover(uiTarget = null, cargoId = null) {
    state.hoveredUiTarget = uiTarget;
    state.hoveredCargoId = cargoId;
    syncCanvasCursor();
  }

  function clearPointerHover() {
    setPointerHover(null, null);
  }

  function isDesktopDragTarget(target) {
    return target === "my-computer-icon"
      || target === "anti-icon"
      || target === "anti-window"
      || target === "recycle-icon"
      || target === "task-icon"
      || target === "task-window"
      || target?.startsWith("app-icon:");
  }

  function updatePointerToolAim(previous, point) {
    toolManager.get("katana").updateAim(sub(point, previous));
    toolManager.get("flamethrower").updateAim(point);
    toolManager.get("notepad").updateAim(sub(point, previous));
  }

  function handleToolPointerMove(uiTarget, previous, point) {
    if (state.katana.active) {
      if (uiTarget && !state.katana.slicing) {
        setPointerHover(uiTarget);
        return true;
      }
      if (state.katana.slicing) {
        toolManager.get("katana").extendSlice(previous, point);
      }
      clearPointerHover();
      return true;
    }

    if (state.flamethrower.active) {
      if (uiTarget && !state.flamethrower.firing) {
        setPointerHover(uiTarget);
        return true;
      }
      state.flamethrower.hovered = false;
      clearPointerHover();
      return true;
    }

    if (state.paint.active) {
      if (uiTarget && !state.paint.painting) {
        setPointerHover(uiTarget);
        return true;
      }
      if (state.paint.painting && !uiTarget) {
        toolManager.get("paint").extend(previous, point);
      }
      clearPointerHover();
      return true;
    }

    if (state.nuke.active || state.fist.active || state.thunder.active || state.bread.active || state.notepad.active || state.minesweeper.active) {
      if (uiTarget) {
        setPointerHover(uiTarget);
      } else {
        clearPointerHover();
      }
      return true;
    }

    return false;
  }

  function handleCanvasPointerMove(event) {
    const point = pointerPoint(event);
    const previous = state.pointer.inside ? state.pointer.pos : point;
    state.pointer.pos = point;
    state.pointer.inside = true;
    updatePointerToolAim(previous, point);

    const uiTarget = antiMalwareHitTarget(point);
    if (state.antiMalware.drag.active) {
      updateAntiMalwareDrag(point);
      setPointerHover(state.antiMalware.drag.target);
      return;
    }

    if (handleToolPointerMove(uiTarget, previous, point)) {
      return;
    }

    if (uiTarget) {
      setPointerHover(uiTarget);
      return;
    }

    const hoveredCargo = findCloseableCargo(point);
    setPointerHover(null, hoveredCargo ? hoveredCargo.id : null);
  }

  function handleCanvasPointerLeave() {
    state.pointer.inside = false;
    state.katana.slicing = false;
    state.flamethrower.firing = false;
    state.flamethrower.hovered = false;
    state.paint.painting = false;
    clearPointerHover();
  }

  function handleCanvasPointerDown(event) {
    const point = pointerPoint(event);
    state.pointer.pos = point;
    state.pointer.inside = true;
    toolManager.get("flamethrower").updateAim(point);

    if (event.button !== 0) {
      return;
    }

    const uiTarget = antiMalwareHitTarget(point);
    if (isDesktopDragTarget(uiTarget)) {
      beginAntiMalwareDrag(uiTarget, point);
      setPointerHover(uiTarget);
      return;
    }

    if (uiTarget) {
      setPointerHover(uiTarget);
      return;
    }

    if (state.nuke.active || state.fist.active || state.thunder.active || state.bread.active || state.notepad.active) {
      clearPointerHover();
      return;
    }

    if (state.paint.active) {
      toolManager.get("paint").begin(point);
      clearPointerHover();
      return;
    }

    if (state.katana.active) {
      toolManager.get("katana").beginSlicing(point);
      return;
    }

    if (state.flamethrower.active) {
      toolManager.get("flamethrower").startFiring();
    }
  }

  function hoveredUiTargetAfterPointerUp() {
    if (!state.pointer.inside || state.katana.active || state.thunder.active || state.bread.active || state.paint.active || state.notepad.active || state.minesweeper.active || state.fist.active) {
      return null;
    }
    return antiMalwareHitTarget(state.pointer.pos);
  }

  function handleWindowPointerUp() {
    toolManager.get("katana").stopSlicing();
    toolManager.get("flamethrower").stopFiring();
    toolManager.get("paint").stop();
    endAntiMalwareDrag();
    setPointerHover(hoveredUiTargetAfterPointerUp(), null);
  }

  function handleStoreToggleClick() {
    toggleShop();
  }

  function handleStoreCloseClick() {
    toggleShop(false);
  }

  function handleStoreListClick(event) {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }
    const action = event.target.closest("button[data-app-id]");
    if (!action) {
      return;
    }
    purchaseDesktopApp(action.dataset.appId);
  }

  function isAttributionDismissed() {
    try {
      return window.localStorage.getItem(ATTRIBUTION_DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  }

  function persistAttributionDismissal() {
    try {
      window.localStorage.setItem(ATTRIBUTION_DISMISSED_KEY, "1");
    } catch {
      // If storage is unavailable, keep the session-level dismissal behavior.
    }
  }

  function openAttributionModal() {
    if (!attributionModal) {
      return;
    }
    attributionModal.hidden = false;
    attributionClose?.focus({ preventScroll: true });
  }

  function closeAttributionModal() {
    if (attributionModal) {
      attributionModal.hidden = true;
    }
    persistAttributionDismissal();
    if (document.activeElement === attributionClose) {
      attributionOpen?.focus({ preventScroll: true });
    }
  }

  function initAttributionModal() {
    if (!attributionModal) {
      return;
    }
    attributionModal.hidden = true;
    if (!isAttributionDismissed()) {
      openAttributionModal();
    }
  }

  function isAttributionModalOpen() {
    return !!attributionModal && !attributionModal.hidden;
  }

  function handleWindowKeydown(event) {
    if (isAttributionModalOpen()) {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        closeAttributionModal();
      }
      return;
    }

    if (event.repeat) {
      return;
    }

    if (toolManager.get("notepad").handleTyping(event)) {
      event.preventDefault();
      return;
    }

    const key = String(event.key).toLowerCase();
    if (toolManager.handleHotkey(key)) {
      event.preventDefault();
      return;
    }

    if (key === "t" && isAppOwned("taskManager")) {
      event.preventDefault();
      openTaskManagerWindow();
    }
  }

  function handleToolCanvasClick(point, uiTarget) {
    if (uiTarget) {
      return false;
    }

    if (state.fist.active) {
      toolManager.get("fist").smash(point);
      render();
      return true;
    }

    if (state.thunder.active) {
      toolManager.get("thunder").strike(point);
      render();
      return true;
    }

    if (state.nuke.active) {
      toolManager.get("nuke").drop(point);
      render();
      return true;
    }

    if (state.minesweeper.active) {
      toolManager.get("minesweeper").place(point);
      render();
      return true;
    }

    return false;
  }

  function handleUiTargetClick(uiTarget, event) {
    if (state.antiMalware.drag.ignoreClick) {
      state.antiMalware.drag.ignoreClick = false;
      setPointerHover(antiMalwareHitTarget(state.pointer.pos));
      return true;
    }

    if (uiTarget === "anti-close") {
      closeAntiMalwareWindow();
      clearPointerHover();
      render();
      return true;
    }

    if (uiTarget === "task-close") {
      closeTaskManagerWindow();
      clearPointerHover();
      render();
      return true;
    }

    const appId = targetAppId(uiTarget);
    if (appId) {
      clearDesktopSelections();
      setDesktopAppSelected(appId, true);
      if (event.detail >= 2) {
        if (appId === "myComputer") {
          toggleShop(true);
        } else {
          launchDesktopApp(appId);
        }
      }
      setPointerHover(iconTargetForApp(appId));
      render();
      return true;
    }

    if (uiTarget === "anti-window" || uiTarget === "anti-window-body") {
      setPointerHover(uiTarget);
      return true;
    }

    if (uiTarget === "task-window" || uiTarget === "task-window-body") {
      state.taskManager.selected = true;
      setPointerHover(uiTarget);
      return true;
    }

    if (uiTarget?.startsWith("task-end:")) {
      const cargoId = Number(uiTarget.split(":")[1]);
      if (Number.isFinite(cargoId)) {
        removeCargo(cargoId);
      }
      setPointerHover(uiTarget);
      render();
      return true;
    }

    return false;
  }

  function handleCanvasClick(event) {
    const point = pointerPoint(event);
    state.pointer.pos = point;
    state.pointer.inside = true;
    const uiTarget = antiMalwareHitTarget(point);

    if ((state.flamethrower.active || state.katana.active || state.bread.active || state.paint.active || state.notepad.active) && !uiTarget) {
      return;
    }

    if (handleToolCanvasClick(point, uiTarget)) {
      return;
    }

    if (handleUiTargetClick(uiTarget, event)) {
      return;
    }

    clearDesktopSelections();

    const cargo = findCloseableCargo(point);
    if (!cargo) {
      render();
      return;
    }

    const cargoCenter = pt(cargo.pos.x + cargo.width / 2, cargo.pos.y + cargo.height / 2);
    removeCargo(cargo.id);
    triggerNearbyCursorChase(cargoCenter);
    clearPointerHover();
    render();
  }
