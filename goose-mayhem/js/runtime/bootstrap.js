  function loop(timestamp) {
    state.acc += Math.min(0.1, (timestamp - state.last) / 1000);
    state.last = timestamp;
    let steps = 0;
    while (state.acc >= FIXED_DT && steps < MAX_FRAME_STEPS) {
      tick(FIXED_DT);
      state.acc -= FIXED_DT;
      steps += 1;
    }
    if (state.acc >= FIXED_DT) {
      state.acc = 0;
    }
    render();
    requestAnimationFrame(loop);
  }

  function relayoutDesktopUi() {
    layoutMyComputer();
    layoutAntiMalware();
    layoutRecycleBin();
    layoutTaskManager();
    layoutToolApps();
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    state.width = rect.width;
    state.height = rect.height;
    state.dpr = clamp(window.devicePixelRatio || 1, 1, MAX_CANVAS_DPR);
    canvas.width = Math.round(rect.width * state.dpr);
    canvas.height = Math.round(rect.height * state.dpr);

    if (!state.geese.length) {
      populateGeese();
    } else {
      for (let i = 0; i < state.geese.length; i += 1) {
        const goose = state.geese[i];
        goose.home = spreadPoint(i, state.geese.length);
        goose.pos = clampPoint(goose.pos);
        goose.target = clampPoint(goose.target);
        if (dist(goose.pos, goose.target) < 18) {
          chooseTarget(goose, 80, 0.95);
        }
        updateRig(goose);
      }
      for (const cargo of state.cargoes) {
        cargo.pos = clampPoint(cargo.pos);
      }
    }

    relayoutDesktopUi();
    if (state.pointer.inside) {
      updateFlamethrowerAim(state.pointer.pos);
    }
    state.flamethrower.grabbed = state.flamethrower.active;
    state.flamethrower.hovered = false;
    syncToolUi();
    render();
  }

  function bindGooseMayhemEvents() {
    window.addEventListener("resize", resize);
    window.addEventListener("pointerdown", markAudioInteraction, { once: true });
    window.addEventListener("keydown", markAudioInteraction, { once: true });
    window.addEventListener("keydown", handleWindowKeydown);
    window.addEventListener("pointerup", handleWindowPointerUp);

    canvas.addEventListener("pointermove", handleCanvasPointerMove);
    canvas.addEventListener("pointerdown", handleCanvasPointerDown);
    canvas.addEventListener("pointerleave", handleCanvasPointerLeave);
    canvas.addEventListener("click", handleCanvasClick);

    storeToggle?.addEventListener("click", handleStoreToggleClick);
    storeClose?.addEventListener("click", handleStoreCloseClick);
    storeList?.addEventListener("click", handleStoreListClick);
    attributionClose?.addEventListener("click", closeAttributionModal);
    attributionOpen?.addEventListener("click", openAttributionModal);
  }

  if (GOOSE_MAYHEM_ACTIVE) {
    initAttributionModal();
    bindGooseMayhemEvents();
    syncToolUi();
    resize();
    requestAnimationFrame((timestamp) => {
      state.last = timestamp;
      loop(timestamp);
    });
  }
