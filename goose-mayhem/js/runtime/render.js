  function renderDesktopLayer(katana, fist) {
    drawAntiMalwareIcon();
    drawRecycleBinIcon();
    drawTaskManagerIcon();
    drawDesktopToolApps();

    for (const cargo of state.cargoes) {
      drawCargo(cargo);
    }

    katana.animation.drawSplitPieces();
    fist.animation.drawShards();
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

    for (const goose of state.renderGeese) {
      drawShadow(goose);
      drawGoose(goose);
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

  function renderEffectLayer(flamethrower, katana, thunder, nuke, gauntlet, bread, paint, fist) {
    gauntlet.animation.drawDust();
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
    fist.animation.drawCursor();
    flamethrower.animation.drawReticle();
    nuke.animation.drawEffects();
    thunder.animation.drawEffects();
    toolManager.drawCurrencyBursts();
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
    const fist = toolManager.get("fist");

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    renderDesktopLayer(katana, fist);
    renderGeeseLayer();
    renderEffectLayer(flamethrower, katana, thunder, nuke, gauntlet, bread, paint, fist);
  }
