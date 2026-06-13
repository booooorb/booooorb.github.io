  class FlamethrowerAnimation extends ToolAnimationInterface {
    update(dt) {
      updateFlamethrower(dt);
    }

    drawRig() {
      drawFlamethrowerRig();
    }

    drawJet() {
      drawFlameJet();
    }

    drawSmoke() {
      drawSmokeParticles();
    }

    drawEmbers() {
      drawEmberParticles();
    }

    drawFlames() {
      drawFlameParticles();
    }

    drawReticle() {
      drawFlamethrowerReticle();
    }
  }

  class FlamethrowerTool extends DesktopToggleTool {
    constructor(context) {
      super(context, {
        id: "flamethrower",
        hotkey: "f",
        animation: new FlamethrowerAnimation(context),
        toggle: toggleFlamethrower,
      });
    }

    updateAim(point) {
      updateFlamethrowerAim(point);
    }

    startFiring() {
      state.flamethrower.grabbed = true;
      state.flamethrower.firing = true;
      state.hoveredCargoId = null;
      syncCanvasCursor();
    }

    stopFiring() {
      state.flamethrower.firing = false;
      state.flamethrower.grabbed = state.flamethrower.active;
    }
  }
