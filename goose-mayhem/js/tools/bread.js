  function toggleBread(force) {
    const desired = toolToggleDesired(state.bread, force);
    state.bread.active = desired;
    if (desired) {
      deactivateExclusiveTools("bread");
    }
    finishToolToggle();
  }

  function updateBread(dt) {
    state.bread.pulse += dt * (state.bread.active ? 7.2 : 3.4);
  }

  class BreadAnimation extends ToolAnimationInterface {
    update(dt) {
      updateBread(dt);
    }

    drawCursor() {
      drawBreadCursor();
    }
  }

  class BreadTool extends DesktopToggleTool {
    constructor(context) {
      super(context, {
        id: "bread",
        hotkey: "b",
        animation: new BreadAnimation(context),
        toggle: toggleBread,
      });
    }
  }
