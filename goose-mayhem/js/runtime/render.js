  function renderDesktopLayer(katana, fist) {
    const blackout = internetExplorerBlackoutActive();
    if (blackout) {
      ctx.clearRect(0, 0, state.width, state.height);
    } else {
      drawMyComputerIcon();
      drawAntiMalwareIcon();
      drawRecycleBinIcon();
      drawTaskManagerIcon();
      drawDesktopToolApps();
    }

    drawSkypeCells("capturing");

    for (const cargo of state.cargoes) {
      if (!cargoIntersectsRenderViewport(cargo)) {
        continue;
      }
      drawCargo(cargo);
    }

    if (!blackout) {
      drawInternetExplorerHalo();
      drawMinesweeperMines();
      katana.animation.drawSplitPieces();
      fist.animation.drawShards();
    }
  }

  function cargoIntersectsRenderViewport(cargo) {
    if (!cargo.visible) {
      return false;
    }

    const margin = Math.max(240, cargo.width * 1.5, cargo.height * 1.5);
    return (
      cargo.pos.x + cargo.width >= -margin
      && cargo.pos.x <= state.width + margin
      && cargo.pos.y + cargo.height >= -margin
      && cargo.pos.y <= state.height + margin
    );
  }

  function syncRenderGeese() {
    state.renderGeese.length = state.geese.length;
    for (let i = 0; i < state.geese.length; i += 1) {
      state.renderGeese[i] = state.geese[i];
    }
    state.renderGeese.sort((a, b) => a.pos.y - b.pos.y);
  }

  function renderGeeseLayer() {
    syncRenderGeese();
    const geeseFrozen = mediaPlayerFreezeActive();

    for (const goose of state.renderGeese) {
      drawShadow(goose, geeseFrozen);
      drawGoose(goose, geeseFrozen);
    }

    let drawnHonkBubbles = 0;
    const honkLimit = honkBubbleLimit();
    for (const goose of state.renderGeese) {
      if (!goose.honkText || state.time >= goose.honkUntil) {
        continue;
      }
      if (drawnHonkBubbles >= honkLimit) {
        break;
      }
      drawHonkBubble(goose);
      drawnHonkBubbles += 1;
    }
  }

  function renderEffectLayer(flamethrower, katana, thunder, nuke, gauntlet, bread, paint, spotify, notepad, minesweeper, chrome, skype, fist) {
    if (internetExplorerBlackoutActive()) {
      return;
    }

    drawMediaPlayerEffects();
    gauntlet.animation.drawDust();
    chrome.animation.drawBeams();
    drawRecycleBinEffect();
    drawAntiMalwareConnection();
    drawAntiMalwareHexDigits();
    drawTaskManagerWindow();
    nuke.animation.drawDropped();
    flamethrower.animation.drawSmoke();
    flamethrower.animation.drawJet();
    flamethrower.animation.drawFlames();
    flamethrower.animation.drawEmbers();
    flamethrower.animation.drawRig();
    nuke.animation.drawCursor();
    katana.animation.drawTrail();
    katana.animation.drawCursor();
    thunder.animation.drawCursor();
    bread.animation.drawCursor();
    paint.animation.drawCursor();
    notepad.animation.drawProjectiles();
    notepad.animation.drawCursor();
    minesweeper.animation.drawCursor();
    chrome.animation.drawCursor();
    fist.animation.drawCursor();
    flamethrower.animation.drawReticle();
    nuke.animation.drawEffects();
    thunder.animation.drawEffects();
    drawSpotifyWaves();
    drawMinesweeperExplosions();
    drawSkypeCells("loose");
    drawSkypePops();
    // Temporarily disabled so money-burst graphics can be excluded from lag testing.
    // toolManager.drawCurrencyBursts();
    fist.animation.drawCracks();
  }

  function render() {
    const flamethrower = toolManager.get("flamethrower");
    const katana = toolManager.get("katana");
    const thunder = toolManager.get("thunder");
    const nuke = toolManager.get("nuke");
    const gauntlet = toolManager.get("gauntlet");
    const bread = toolManager.get("bread");
    const paint = toolManager.get("paint");
    const spotify = toolManager.get("spotify");
    const notepad = toolManager.get("notepad");
    const minesweeper = toolManager.get("minesweeper");
    const chrome = toolManager.get("chrome");
    const skype = toolManager.get("skype");
    const fist = toolManager.get("fist");

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    renderDesktopLayer(katana, fist);
    renderGeeseLayer();
    renderEffectLayer(flamethrower, katana, thunder, nuke, gauntlet, bread, paint, spotify, notepad, minesweeper, chrome, skype, fist);
    drawInternetExplorerBlackoutFlash();
    drawInternetExplorerReturnTransition();
  }
