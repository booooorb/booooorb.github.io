  class ToolAnimationInterface {
    constructor(context) {
      this.context = context;
      this.state = context.state;
    }

    update(dt) {
      void dt;
    }
  }

  class ToolInterface {
    constructor(context, config) {
      this.context = context;
      this.state = context.state;
      this.id = config.id;
      this.hotkey = config.hotkey || null;
      this.animation = config.animation || null;
    }

    update(dt) {
      this.animation?.update(dt);
    }

    launchFromDesktop() {}

    handleHotkey() {
      this.launchFromDesktop();
    }
  }

  class DesktopToggleTool extends ToolInterface {
    constructor(context, config) {
      super(context, config);
      this.toggle = config.toggle;
    }

    launchFromDesktop() {
      this.toggle();
    }
  }

  class ToolManager {
    constructor(context) {
      this.context = context;
      this.state = context.state;
      this.registry = new Map();
    }

    register(tool) {
      this.registry.set(tool.id, tool);
      return tool;
    }

    get(id) {
      return this.registry.get(id) || null;
    }

    has(id) {
      return this.registry.has(id);
    }

    update(dt) {
      for (const tool of this.registry.values()) {
        tool.update(dt);
      }
      updateCurrencyBursts(dt);
    }

    launchTool(appId) {
      const tool = this.get(appId);
      if (!tool) {
        return false;
      }
      tool.launchFromDesktop();
      return true;
    }

    handleHotkey(key) {
      for (const tool of this.registry.values()) {
        if (!tool.hotkey || tool.hotkey !== key) {
          continue;
        }
        if (!isAppOwned(tool.id)) {
          return false;
        }
        tool.handleHotkey();
        return true;
      }
      return false;
    }

    drawCurrencyBursts() {
      drawCurrencyBursts();
    }
  }
