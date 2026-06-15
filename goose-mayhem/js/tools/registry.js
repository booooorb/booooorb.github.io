  const toolManager = new ToolManager({
    state,
    canvas,
    ctx,
  });

  toolManager.register(new FlamethrowerTool(toolManager.context));
  toolManager.register(new KatanaTool(toolManager.context));
  toolManager.register(new ThunderTool(toolManager.context));
  toolManager.register(new NukeTool(toolManager.context));
  toolManager.register(new GauntletTool(toolManager.context));
  toolManager.register(new BreadTool(toolManager.context));
  toolManager.register(new PaintTool(toolManager.context));
  toolManager.register(new SpotifyTool(toolManager.context));
  toolManager.register(new MinesweeperTool(toolManager.context));
  toolManager.register(new InternetExplorerTool(toolManager.context));
  toolManager.register(new ChromeTool(toolManager.context));
  toolManager.register(new SkypeTool(toolManager.context));
  toolManager.register(new FistTool(toolManager.context));
