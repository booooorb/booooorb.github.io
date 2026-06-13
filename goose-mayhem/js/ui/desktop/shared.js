  function desktopIconRect(pos, size) {
    return {
      x: pos.x,
      y: pos.y,
      width: size,
      height: size + 26,
    };
  }

  function desktopLabelSelectionRect(rect) {
    const selectionWidth = rect.width + 22;
    const boxX = rect.x + rect.width / 2 - selectionWidth / 2;
    return {
      x: boxX,
      y: rect.y - 4,
      width: selectionWidth,
      height: rect.height + 8,
    };
  }

  function isUnplacedDesktopPoint(pos) {
    return !pos.x && !pos.y;
  }

  function antiMalwareIconSize() {
    return motionQuery.matches ? 54 : 62;
  }

  function desktopToolIconSize() {
    return motionQuery.matches ? 54 : 62;
  }

  function antiMalwareLabel() {
    return motionQuery.matches ? "anti-malware" : "anti-malware.app";
  }

  function defaultAntiMalwareIconPos() {
    return findDesktopIconSpot("antiMalware");
  }

  function clampRectPosition(pos, width, height, padding = 18) {
    return pt(
      clamp(pos.x, padding, Math.max(padding, state.width - width - padding)),
      clamp(pos.y, padding, Math.max(padding, state.height - height - padding))
    );
  }

  function defaultAntiMalwareWindowPos() {
    return clampRectPosition(
      pt(state.width - state.antiMalware.width - 36, Math.min(104, state.height * 0.18)),
      state.antiMalware.width,
      state.antiMalware.height
    );
  }

  function recycleBinIconSize() {
    return motionQuery.matches ? 66 : 78;
  }

  function recycleBinLabel() {
    return motionQuery.matches ? "trash-bin" : "trash-bin.app";
  }

  function defaultRecycleBinIconPos() {
    return findDesktopIconSpot("recycleBin");
  }

  function recycleBinIconRect() {
    return desktopIconRect(state.recycleBin.iconPos, recycleBinIconSize());
  }

  function recycleBinSelectionRect() {
    return desktopLabelSelectionRect(recycleBinIconRect(), recycleBinLabel());
  }

  function recycleBinMouthPoint() {
    const rect = recycleBinIconRect();
    const size = recycleBinIconSize();
    return pt(rect.x + size * 0.5, rect.y + 17);
  }

  function layoutRecycleBin() {
    const bin = state.recycleBin;
    const iconSize = recycleBinIconSize();
    if (isUnplacedDesktopPoint(bin.iconPos)) {
      bin.iconPos = defaultRecycleBinIconPos();
    }
    bin.iconPos = clampRectPosition(bin.iconPos, iconSize, iconSize + 26, 18);
  }

  function taskManagerIconSize() {
    return motionQuery.matches ? 54 : 62;
  }

  function taskManagerLabel() {
    return motionQuery.matches ? "task-mgr" : "task-manager.app";
  }

  function defaultTaskManagerIconPos() {
    return findDesktopIconSpot("taskManager");
  }

  function taskManagerIconRect() {
    return desktopIconRect(state.taskManager.iconPos, taskManagerIconSize());
  }

  function taskManagerSelectionRect() {
    return desktopLabelSelectionRect(taskManagerIconRect(), taskManagerLabel());
  }

  function defaultTaskManagerWindowPos() {
    return clampRectPosition(
      pt(state.width - state.taskManager.width - 54, Math.min(132, state.height * 0.2)),
      state.taskManager.width,
      state.taskManager.height
    );
  }

  function taskManagerWindowRect() {
    return {
      x: state.taskManager.windowPos.x,
      y: state.taskManager.windowPos.y,
      width: state.taskManager.width,
      height: state.taskManager.height,
    };
  }

  function taskManagerCloseRect() {
    const rect = taskManagerWindowRect();
    return {
      x: rect.x + 12,
      y: rect.y + 9,
      width: 16,
      height: 16,
    };
  }

  function taskManagerBarRect() {
    const rect = taskManagerWindowRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: 32,
    };
  }

  function taskManagerRows() {
    const rect = taskManagerWindowRect();
    const cargoes = latestVisibleCargoes(6);
    return cargoes.map((cargo, index) => {
      const y = rect.y + 54 + index * 29;
      return {
        cargo,
        rect: {
          x: rect.x + 14,
          y,
          width: rect.width - 28,
          height: 24,
        },
        endRect: {
          x: rect.x + rect.width - 82,
          y: y + 3,
          width: 58,
          height: 18,
        },
      };
    });
  }

  function layoutTaskManager() {
    const task = state.taskManager;
    const iconSize = taskManagerIconSize();
    if (isUnplacedDesktopPoint(task.iconPos)) {
      task.iconPos = defaultTaskManagerIconPos();
    }
    task.iconPos = clampRectPosition(task.iconPos, iconSize, iconSize + 26, 18);
    if (isUnplacedDesktopPoint(task.windowPos)) {
      task.windowPos = defaultTaskManagerWindowPos();
    }
    task.windowPos = clampRectPosition(task.windowPos, task.width, task.height, 18);
  }

  function clearDesktopSelections() {
    state.antiMalware.selected = false;
    state.recycleBin.selected = false;
    state.taskManager.selected = false;
    for (const app of DESKTOP_TOOL_APPS) {
      state.desktopApps[app.id].selected = false;
    }
  }

  function antiMalwareIconRect() {
    return desktopIconRect(state.antiMalware.iconPos, antiMalwareIconSize());
  }

  function antiMalwareSelectionRect() {
    return desktopLabelSelectionRect(antiMalwareIconRect(), antiMalwareLabel());
  }

  function antiMalwareWindowRect() {
    return {
      x: state.antiMalware.windowPos.x,
      y: state.antiMalware.windowPos.y,
      width: state.antiMalware.width,
      height: state.antiMalware.height,
    };
  }

  function antiMalwareCloseRect() {
    const rect = antiMalwareWindowRect();
    return {
      x: rect.x + 11,
      y: rect.y + 9,
      width: 16,
      height: 16,
    };
  }

  function antiMalwareWindowBarRect() {
    const rect = antiMalwareWindowRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: 32,
    };
  }

  function layoutAntiMalware() {
    const anti = state.antiMalware;
    const iconSize = antiMalwareIconSize();
    if (isUnplacedDesktopPoint(anti.iconPos)) {
      anti.iconPos = defaultAntiMalwareIconPos();
    }
    anti.iconPos = clampRectPosition(anti.iconPos, iconSize, iconSize + 26, 18);
    if (isUnplacedDesktopPoint(anti.windowPos)) {
      anti.windowPos = defaultAntiMalwareWindowPos();
    }
    anti.windowPos = clampRectPosition(anti.windowPos, anti.width, anti.height, 18);
  }

  function storeAppEntry(appId) {
    return STORE_APPS.find((app) => app.id === appId) || null;
  }

  function isAppOwned(appId) {
    if (appId === "antiMalware") {
      return state.antiMalware.deployed;
    }
    if (appId === "recycleBin") {
      return state.recycleBin.deployed;
    }
    if (appId === "taskManager") {
      return state.taskManager.deployed;
    }
    return !!state.desktopApps[appId]?.owned;
  }

  function desktopToolLabel(appId) {
    const entry = storeAppEntry(appId);
    if (!entry) {
      return appId;
    }
    return motionQuery.matches ? entry.shortLabel : entry.desktopLabel;
  }

  function desktopToolIconRect(appId) {
    return desktopIconRect(state.desktopApps[appId].iconPos, desktopToolIconSize());
  }

  function desktopToolSelectionRect(appId) {
    return desktopLabelSelectionRect(desktopToolIconRect(appId), desktopToolLabel(appId));
  }

  function desktopIconRectForApp(appId) {
    if (appId === "antiMalware") {
      return antiMalwareIconRect();
    }
    if (appId === "recycleBin") {
      return recycleBinIconRect();
    }
    if (appId === "taskManager") {
      return taskManagerIconRect();
    }
    if (state.desktopApps[appId]) {
      return desktopToolIconRect(appId);
    }
    return null;
  }

  function setDesktopAppSelected(appId, selected) {
    if (appId === "antiMalware") {
      state.antiMalware.selected = selected;
      return;
    }
    if (appId === "recycleBin") {
      state.recycleBin.selected = selected;
      return;
    }
    if (appId === "taskManager") {
      state.taskManager.selected = selected;
      return;
    }
    if (state.desktopApps[appId]) {
      state.desktopApps[appId].selected = selected;
    }
  }

  function iconTargetForApp(appId) {
    if (appId === "antiMalware") {
      return "anti-icon";
    }
    if (appId === "recycleBin") {
      return "recycle-icon";
    }
    if (appId === "taskManager") {
      return "task-icon";
    }
    return `app-icon:${appId}`;
  }

  function targetAppId(target) {
    if (target === "anti-icon") {
      return "antiMalware";
    }
    if (target === "recycle-icon") {
      return "recycleBin";
    }
    if (target === "task-icon") {
      return "taskManager";
    }
    if (target?.startsWith("app-icon:")) {
      return target.slice("app-icon:".length);
    }
    return null;
  }

  function syncDesktopToolSelections() {
    const activeSelection = {
      flamethrower: state.flamethrower.active,
      katana: state.katana.active,
      nuke: state.nuke.active || state.nuke.dropping || state.nuke.armed,
      thunder: state.thunder.active,
      gauntlet: state.gauntlet.snapping,
      bread: state.bread.active,
      fist: state.fist.active,
    };

    for (const app of DESKTOP_TOOL_APPS) {
      if (!state.desktopApps[app.id].owned) {
        continue;
      }
      state.desktopApps[app.id].selected = !!activeSelection[app.id];
    }
  }

  function rectsOverlap(a, b, padding = 10) {
    return !(
      a.x + a.width + padding <= b.x
      || b.x + b.width + padding <= a.x
      || a.y + a.height + padding <= b.y
      || b.y + b.height + padding <= a.y
    );
  }

  function occupiedDesktopIconRects(excludeAppId = null) {
    const rects = [];
    for (const app of STORE_APPS) {
      if (app.id === excludeAppId || !isAppOwned(app.id)) {
        continue;
      }
      const rect = desktopIconRectForApp(app.id);
      if (rect) {
        rects.push(rect);
      }
    }
    return rects;
  }

  function findDesktopIconSpot(appId) {
    const size = desktopToolIconSize();
    const width = size;
    const height = size + 26;
    const top = motionQuery.matches ? 90 : 98;
    const bottomInset = motionQuery.matches ? 158 : 176;
    const left = 28;
    const stepX = size + 24;
    const stepY = height + 16;
    const usableHeight = Math.max(height, state.height - top - bottomInset);
    const rows = Math.max(1, Math.floor(usableHeight / stepY) + 1);
    const columns = Math.max(1, Math.floor((state.width - left - 24 - width) / stepX) + 1);
    const occupied = occupiedDesktopIconRects(appId);

    for (let column = 0; column < columns; column += 1) {
      for (let row = 0; row < rows; row += 1) {
        const candidate = clampRectPosition(
          pt(left + column * stepX, top + row * stepY),
          width,
          height,
          18
        );
        const rect = {
          x: candidate.x,
          y: candidate.y,
          width,
          height,
        };
        if (!occupied.some((occupiedRect) => rectsOverlap(rect, occupiedRect))) {
          return candidate;
        }
      }
    }

    return clampRectPosition(pt(left, top), width, height, 18);
  }

  function layoutToolApps() {
    const size = desktopToolIconSize();
    for (const app of DESKTOP_TOOL_APPS) {
      const tool = state.desktopApps[app.id];
      if (!tool.owned) {
        continue;
      }
      if (isUnplacedDesktopPoint(tool.iconPos)) {
        tool.iconPos = findDesktopIconSpot(app.id);
      }
      tool.iconPos = clampRectPosition(tool.iconPos, size, size + 26, 18);
    }
  }

  function desktopToolAppHitTarget(point) {
    for (let i = DESKTOP_TOOL_APPS.length - 1; i >= 0; i -= 1) {
      const appId = DESKTOP_TOOL_APPS[i].id;
      if (!state.desktopApps[appId].owned) {
        continue;
      }
      if (pointInRect(point, desktopToolIconRect(appId))) {
        return `app-icon:${appId}`;
      }
    }
    return null;
  }
