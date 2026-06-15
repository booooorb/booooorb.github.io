  function drawDesktopSelection(selectionRect) {
    ctx.fillStyle = "rgba(49, 106, 197, 0.34)";
    ctx.strokeStyle = "rgba(217, 235, 255, 0.86)";
    ctx.lineWidth = 1;
    ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
    ctx.strokeRect(selectionRect.x + 0.5, selectionRect.y + 0.5, selectionRect.width - 1, selectionRect.height - 1);
  }

  function drawDesktopLabel(text, x, y) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
    ctx.textAlign = "center";
    ctx.font = `${motionQuery.matches ? 400 : 500} ${motionQuery.matches ? 10 : 11}px ${DESKTOP_FONT}`;
    ctx.shadowColor = "rgba(11, 22, 37, 0.92)";
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  const iconImageBoundsCache = new WeakMap();

  function visibleImageBounds(image) {
    const cached = iconImageBoundsCache.get(image);
    if (cached) {
      return cached;
    }

    const fallback = {
      x: 0,
      y: 0,
      width: image.naturalWidth,
      height: image.naturalHeight,
    };

    try {
      const sampleMax = 192;
      const scale = Math.min(1, sampleMax / Math.max(image.naturalWidth, image.naturalHeight));
      const sampleWidth = Math.max(1, Math.round(image.naturalWidth * scale));
      const sampleHeight = Math.max(1, Math.round(image.naturalHeight * scale));
      const sampleCanvas = document.createElement("canvas");
      sampleCanvas.width = sampleWidth;
      sampleCanvas.height = sampleHeight;
      const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
      sampleCtx.drawImage(image, 0, 0, sampleWidth, sampleHeight);
      const pixels = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight).data;
      let minX = sampleWidth;
      let minY = sampleHeight;
      let maxX = -1;
      let maxY = -1;

      for (let y = 0; y < sampleHeight; y += 1) {
        for (let x = 0; x < sampleWidth; x += 1) {
          if (pixels[(y * sampleWidth + x) * 4 + 3] <= 12) {
            continue;
          }
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }

      if (maxX < minX || maxY < minY) {
        iconImageBoundsCache.set(image, fallback);
        return fallback;
      }

      const padding = 1 / scale;
      const bounds = {
        x: Math.max(0, minX / scale - padding),
        y: Math.max(0, minY / scale - padding),
        width: Math.min(image.naturalWidth, (maxX - minX + 1) / scale + padding * 2),
        height: Math.min(image.naturalHeight, (maxY - minY + 1) / scale + padding * 2),
      };
      iconImageBoundsCache.set(image, bounds);
      return bounds;
    } catch (error) {
      void error;
      iconImageBoundsCache.set(image, fallback);
      return fallback;
    }
  }

  function drawNormalizedIconImage(image, centerX, centerY, boxWidth, boxHeight) {
    const bounds = visibleImageBounds(image);
    const scale = Math.min(boxWidth / bounds.width, boxHeight / bounds.height);
    const drawWidth = bounds.width * scale;
    const drawHeight = bounds.height * scale;
    ctx.drawImage(
      image,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      centerX - drawWidth / 2,
      centerY - drawHeight / 2,
      drawWidth,
      drawHeight
    );
  }

  function drawRecycleBinIcon() {
    if (!state.recycleBin.deployed) {
      return;
    }

    const rect = recycleBinIconRect();
    const selectionRect = recycleBinSelectionRect();
    const size = recycleBinIconSize();
    const hovered = state.hoveredUiTarget === "recycle-icon" || state.antiMalware.drag.target === "recycle-icon";
    const selected = state.recycleBin.selected || state.antiMalware.drag.target === "recycle-icon";
    const pulse = Math.sin(state.recycleBin.pulse * 1.7) * 0.5 + 0.5;

    ctx.save();
    if (selected) {
      drawDesktopSelection(selectionRect);
    }
    ctx.translate(rect.x, rect.y);
    ctx.fillStyle = COLORS.recycleBinShadow;
    ctx.beginPath();
    ctx.ellipse(size * 0.52, size + 12, size * 0.42, 9, 0, 0, TAU);
    ctx.fill();

    const iconImage = state.recycleBin.iconImage;
    if (iconImage?.complete && iconImage.naturalWidth > 0) {
      ctx.save();
      ctx.shadowColor = COLORS.recycleBinGlow;
      ctx.shadowBlur = hovered ? 24 : 14;
      drawNormalizedIconImage(iconImage, size * 0.5, size * 0.48, size * 0.76, size * 0.76);
      ctx.restore();
      drawDesktopLabel(recycleBinLabel(), size * 0.5, size + 20);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.shadowColor = COLORS.recycleBinGlow;
    ctx.shadowBlur = hovered ? 24 : 14;
    ctx.fillStyle = COLORS.recycleBinLid;
    roundedRectPath(size * 0.18, 8, size * 0.64, 11, 6);
    ctx.fill();
    ctx.restore();

    roundedRectPath(size * 0.22, 18, size * 0.56, size * 0.56, 11);
    ctx.fillStyle = COLORS.recycleBinBody;
    ctx.fill();
    ctx.strokeStyle = COLORS.recycleBinBodyEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.strokeStyle = `rgba(74, 126, 168, ${0.32 + pulse * 0.24})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      const x = size * (0.36 + i * 0.14);
      ctx.beginPath();
      ctx.moveTo(x, 24);
      ctx.lineTo(x, size * 0.68);
      ctx.stroke();
    }

    drawDesktopLabel(recycleBinLabel(), size * 0.5, size + 20);
    ctx.restore();
  }

  function drawRecycleBinEffect() {
    if (!state.recycleBin.deployed) {
      return;
    }

    const center = recycleBinMouthPoint();
    let drawing = false;

    for (const cargo of state.cargoes) {
      if (cargo.vacuumProgress <= 0.02 || !cargo.visible || cargo.dusting) {
        continue;
      }

      if (!drawing) {
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalCompositeOperation = "lighter";
        drawing = true;
      }

      const progress = cargo.vacuumProgress;
      const cargoCenter = pt(cargo.pos.x + cargo.width / 2, cargo.pos.y + cargo.height / 2);
      const direction = norm(sub(center, cargoCenter));
      const side = perp(direction);
      const mid = pt(
        lerp(cargoCenter.x, center.x, 0.52),
        lerp(cargoCenter.y, center.y, 0.52)
      );
      const curveAmount = (26 + progress * 44) * Math.sin(state.time * 8 + cargo.id * 0.9);

      ctx.strokeStyle = `rgba(185, 235, 255, ${0.18 + progress * 0.24})`;
      ctx.lineWidth = 8 + progress * 10;
      ctx.beginPath();
      ctx.moveTo(cargoCenter.x, cargoCenter.y);
      ctx.quadraticCurveTo(
        mid.x + side.x * (18 + progress * 22),
        mid.y + side.y * (18 + progress * 22),
        center.x,
        center.y
      );
      ctx.stroke();

      ctx.strokeStyle = `rgba(233, 248, 255, ${0.3 + progress * 0.3})`;
      ctx.lineWidth = 2.4 + progress * 4.2;
      for (let strand = -1; strand <= 1; strand += 1) {
        const offset = strand * (8 + progress * 9);
        ctx.beginPath();
        ctx.moveTo(cargoCenter.x + side.x * offset, cargoCenter.y + side.y * offset);
        ctx.quadraticCurveTo(
          mid.x + side.x * (offset * 0.35 + curveAmount),
          mid.y + side.y * (offset * 0.35 + curveAmount),
          center.x + side.x * offset * 0.18,
          center.y + side.y * offset * 0.18
        );
        ctx.stroke();
      }

      ctx.fillStyle = `rgba(220, 245, 255, ${0.2 + progress * 0.36})`;
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, 10 + progress * 20, 5 + progress * 12, Math.atan2(direction.y, direction.x), 0, TAU);
      ctx.fill();
    }

    if (drawing) {
      ctx.restore();
    }
  }

  function drawTaskManagerIcon() {
    if (!state.taskManager.deployed) {
      return;
    }

    const rect = taskManagerIconRect();
    const selectionRect = taskManagerSelectionRect();
    const size = taskManagerIconSize();
    const hovered = state.hoveredUiTarget === "task-icon" || state.antiMalware.drag.target === "task-icon";
    const selected = state.taskManager.selected || state.antiMalware.drag.target === "task-icon";
    const pulse = Math.sin(state.taskManager.pulse * 1.6) * 0.5 + 0.5;

    ctx.save();
    if (selected) {
      drawDesktopSelection(selectionRect);
    }
    ctx.translate(rect.x, rect.y);
    ctx.fillStyle = COLORS.taskManagerShadow;
    ctx.beginPath();
    ctx.ellipse(size * 0.5, size + 12, size * 0.42, 9, 0, 0, TAU);
    ctx.fill();

    const iconImage = state.taskManager.iconImage;
    if (iconImage?.complete && iconImage.naturalWidth > 0) {
      ctx.save();
      ctx.shadowColor = COLORS.taskManagerShadow;
      ctx.shadowBlur = hovered ? 16 : 8;
      drawNormalizedIconImage(iconImage, size * 0.5, size * 0.5, size * 0.78, size * 0.78);
      ctx.restore();
      drawDesktopLabel(taskManagerLabel(), size * 0.5, size + 20);
      ctx.restore();
      return;
    }

    roundedRectPath(4, 8, size - 8, size * 0.6, 10);
    ctx.fillStyle = hovered ? "rgba(238, 244, 255, 0.98)" : COLORS.taskManagerPanel;
    ctx.fill();
    ctx.strokeStyle = COLORS.taskManagerPanelEdge;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = COLORS.taskManagerBar;
    roundedRectPath(5, 9, size - 10, 10, 8);
    ctx.fill();

    ctx.strokeStyle = `rgba(89, 108, 188, ${0.32 + pulse * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, size * 0.48);
    ctx.lineTo(22, size * 0.4);
    ctx.lineTo(30, size * 0.5);
    ctx.lineTo(38, size * 0.3);
    ctx.lineTo(48, size * 0.44);
    ctx.stroke();

    drawDesktopLabel(taskManagerLabel(), size * 0.5, size + 20);
    ctx.restore();
  }

  function drawMyComputerIcon() {
    if (!state.myComputer.deployed) {
      return;
    }

    const rect = myComputerIconRect();
    const selectionRect = myComputerSelectionRect();
    const size = myComputerIconSize();
    const hovered = state.hoveredUiTarget === "my-computer-icon" || state.antiMalware.drag.target === "my-computer-icon";
    const selected = state.myComputer.selected || state.antiMalware.drag.target === "my-computer-icon";
    const iconImage = state.myComputer.iconImage;

    ctx.save();
    if (selected) {
      drawDesktopSelection(selectionRect);
    }
    ctx.translate(rect.x, rect.y);

    ctx.fillStyle = "rgba(12, 28, 48, 0.22)";
    ctx.beginPath();
    ctx.ellipse(size * 0.5, size + 12, size * 0.42, 9, 0, 0, TAU);
    ctx.fill();

    if (iconImage?.complete && iconImage.naturalWidth > 0) {
      ctx.save();
      ctx.shadowColor = hovered ? "rgba(136, 202, 255, 0.42)" : "rgba(90, 146, 220, 0.28)";
      ctx.shadowBlur = hovered ? 18 : 9;
      drawNormalizedIconImage(iconImage, size * 0.5, size * 0.5, size * 0.78, size * 0.78);
      ctx.restore();
    }

    drawDesktopLabel(myComputerLabel(), size * 0.5, size + 20);
    ctx.restore();
  }

  function drawTaskManagerWindow() {
    if (!state.taskManager.deployed || !state.taskManager.windowOpen) {
      return;
    }

    const task = state.taskManager;
    const rect = taskManagerWindowRect();
    const closeRect = taskManagerCloseRect();
    const hoveredBar = state.hoveredUiTarget === "task-window" || state.antiMalware.drag.target === "task-window";
    const hoveredClose = state.hoveredUiTarget === "task-close";
    const rows = taskManagerRows();
    const selectedRow = rows[0];

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.38)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = "#ece9d8";
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "#003c74";
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.strokeRect(rect.x + 2.5, rect.y + 31.5, rect.width - 5, rect.height - 34);

    const titleGradient = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.width, rect.y);
    titleGradient.addColorStop(0, hoveredBar ? "#1d6fd6" : "#0a3ea8");
    titleGradient.addColorStop(0.52, hoveredBar ? "#2f8afa" : "#1668d2");
    titleGradient.addColorStop(1, hoveredBar ? "#0d55c4" : "#08449d");
    ctx.fillStyle = titleGradient;
    ctx.fillRect(rect.x + 3, rect.y + 3, rect.width - 6, 25);

    ctx.fillStyle = "#ffffff";
    ctx.font = `700 12px ${DESKTOP_FONT}`;
    ctx.textBaseline = "middle";
    ctx.fillText("Windows Task Manager", rect.x + 28, rect.y + 16);

    ctx.fillStyle = "#2f72d6";
    ctx.fillRect(rect.x + 10, rect.y + 9, 12, 11);
    ctx.fillStyle = "#d7e8ff";
    ctx.fillRect(rect.x + 12, rect.y + 11, 8, 2);
    ctx.fillRect(rect.x + 12, rect.y + 15, 8, 2);

    const closeGradient = ctx.createLinearGradient(closeRect.x, closeRect.y, closeRect.x, closeRect.y + closeRect.height);
    closeGradient.addColorStop(0, hoveredClose ? "#ffb6a6" : "#f49a86");
    closeGradient.addColorStop(1, hoveredClose ? "#d93320" : "#b91d13");
    ctx.fillStyle = closeGradient;
    ctx.fillRect(closeRect.x, closeRect.y, closeRect.width, closeRect.height);
    ctx.strokeStyle = "#7a120b";
    ctx.strokeRect(closeRect.x + 0.5, closeRect.y + 0.5, closeRect.width - 1, closeRect.height - 1);
    ctx.strokeStyle = "#fff4ef";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(closeRect.x + 5, closeRect.y + 5);
    ctx.lineTo(closeRect.x + closeRect.width - 5, closeRect.y + closeRect.height - 5);
    ctx.moveTo(closeRect.x + closeRect.width - 5, closeRect.y + 5);
    ctx.lineTo(closeRect.x + 5, closeRect.y + closeRect.height - 5);
    ctx.stroke();

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#111";
    ctx.font = `11px ${DESKTOP_FONT}`;
    ctx.fillText("File", rect.x + 9, rect.y + 45);
    ctx.fillText("Options", rect.x + 42, rect.y + 45);
    ctx.fillText("View", rect.x + 92, rect.y + 45);

    const tabY = rect.y + 55;
    const tabHeight = 23;
    const tabs = [
      { label: "Applications", width: 82, active: true },
      { label: "Processes", width: 72, active: false },
      { label: "Performance", width: 86, active: false },
    ];
    let tabX = rect.x + 8;
    for (const tab of tabs) {
      ctx.fillStyle = tab.active ? "#ffffff" : "#d4d0c8";
      ctx.fillRect(tabX, tabY, tab.width, tabHeight);
      ctx.strokeStyle = "#aca899";
      ctx.strokeRect(tabX + 0.5, tabY + 0.5, tab.width - 1, tabHeight - 1);
      ctx.fillStyle = "#111";
      ctx.font = `11px ${DESKTOP_FONT}`;
      ctx.fillText(tab.label, tabX + 8, tabY + 15);
      tabX += tab.width - 1;
    }

    const listX = rect.x + 8;
    const listY = rect.y + 78;
    const listWidth = rect.width - 16;
    const listHeight = rect.height - 124;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(listX, listY, listWidth, listHeight);
    ctx.strokeStyle = "#aca899";
    ctx.strokeRect(listX + 0.5, listY + 0.5, listWidth - 1, listHeight - 1);

    ctx.fillStyle = "#ece9d8";
    ctx.fillRect(listX + 1, listY + 1, listWidth - 2, 18);
    ctx.strokeStyle = "#d4d0c8";
    ctx.beginPath();
    ctx.moveTo(listX + 1, listY + 19.5);
    ctx.lineTo(listX + listWidth - 1, listY + 19.5);
    ctx.moveTo(listX + 182, listY + 1);
    ctx.lineTo(listX + 182, listY + listHeight - 1);
    ctx.stroke();
    ctx.fillStyle = "#111";
    ctx.font = `11px ${DESKTOP_FONT}`;
    ctx.fillText("Task", listX + 8, listY + 14);
    ctx.fillText("Status", listX + 190, listY + 14);

    if (!rows.length) {
      ctx.fillStyle = "#666";
      ctx.fillText("No goose tabs running", listX + 9, listY + 43);
    }

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const isSelected = index === 0;
      const y = row.rect.y;
      if (isSelected) {
        ctx.fillStyle = "#316ac5";
        ctx.fillRect(listX + 2, y, listWidth - 4, 20);
      }
      ctx.fillStyle = isSelected ? "#ffffff" : "#111";
      ctx.font = `11px ${DESKTOP_FONT}`;
      const kindLabel = row.cargo.kind === "meme" ? "Image" : "Note";
      ctx.fillText(`${kindLabel} - ${row.cargo.title}`, listX + 8, y + 15);
      ctx.fillText("Running", listX + 190, y + 15);
    }

    const buttonRect = selectedRow?.endRect || {
      x: rect.x + rect.width - 86,
      y: rect.y + rect.height - 34,
      width: 76,
      height: 24,
    };
    const hoveredEnd = selectedRow && state.hoveredUiTarget === `task-end:${selectedRow.cargo.id}`;
    ctx.fillStyle = hoveredEnd ? "#f5f3ea" : "#ece9d8";
    ctx.fillRect(buttonRect.x, buttonRect.y, buttonRect.width, buttonRect.height);
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(buttonRect.x + 0.5, buttonRect.y + buttonRect.height - 0.5);
    ctx.lineTo(buttonRect.x + 0.5, buttonRect.y + 0.5);
    ctx.lineTo(buttonRect.x + buttonRect.width - 0.5, buttonRect.y + 0.5);
    ctx.stroke();
    ctx.strokeStyle = "#808080";
    ctx.beginPath();
    ctx.moveTo(buttonRect.x + buttonRect.width - 0.5, buttonRect.y + 0.5);
    ctx.lineTo(buttonRect.x + buttonRect.width - 0.5, buttonRect.y + buttonRect.height - 0.5);
    ctx.lineTo(buttonRect.x + 0.5, buttonRect.y + buttonRect.height - 0.5);
    ctx.stroke();
    ctx.fillStyle = rows.length ? "#111" : "#777";
    ctx.font = `11px ${DESKTOP_FONT}`;
    ctx.fillText("End Task", buttonRect.x + 16, buttonRect.y + 16);

    ctx.fillStyle = "#ece9d8";
    ctx.fillRect(rect.x + 4, rect.y + rect.height - 23, rect.width - 96, 19);
    ctx.strokeStyle = "#aca899";
    ctx.strokeRect(rect.x + 4.5, rect.y + rect.height - 22.5, rect.width - 100, 18);
    ctx.fillStyle = "#111";
    ctx.font = `11px ${DESKTOP_FONT}`;
    ctx.fillText(`Processes: ${visibleCargoCount()}`, rect.x + 10, rect.y + rect.height - 9);

    ctx.restore();
  }

  function desktopToolPalette(appId) {
    if (appId === "flamethrower") {
      return {
        body: "rgba(255, 232, 213, 0.98)",
        edge: "rgba(164, 81, 38, 0.42)",
        text: "rgba(88, 40, 20, 0.9)",
        glow: "rgba(255, 152, 88, 0.26)",
      };
    }
    if (appId === "katana") {
      return {
        body: "rgba(241, 244, 252, 0.98)",
        edge: "rgba(112, 128, 170, 0.38)",
        text: "rgba(34, 42, 68, 0.9)",
        glow: "rgba(204, 224, 255, 0.24)",
      };
    }
    if (appId === "nuke") {
      return {
        body: "rgba(255, 244, 216, 0.98)",
        edge: "rgba(152, 110, 32, 0.38)",
        text: "rgba(78, 56, 10, 0.9)",
        glow: "rgba(255, 203, 112, 0.24)",
      };
    }
    if (appId === "thunder") {
      return {
        body: "rgba(255, 246, 199, 0.98)",
        edge: "rgba(167, 128, 22, 0.38)",
        text: "rgba(91, 62, 4, 0.9)",
        glow: "rgba(255, 224, 126, 0.24)",
      };
    }
    if (appId === "gauntlet") {
      return {
        body: "rgba(255, 236, 205, 0.98)",
        edge: "rgba(143, 96, 28, 0.38)",
        text: "rgba(88, 52, 9, 0.9)",
        glow: "rgba(255, 178, 102, 0.24)",
      };
    }
    if (appId === "bread") {
      return {
        body: "rgba(255, 238, 196, 0.98)",
        edge: "rgba(156, 112, 46, 0.38)",
        text: "rgba(94, 58, 13, 0.9)",
        glow: "rgba(255, 212, 128, 0.24)",
      };
    }
    if (appId === "paint") {
      return {
        body: "rgba(255, 238, 238, 0.98)",
        edge: "rgba(166, 64, 64, 0.38)",
        text: "rgba(105, 28, 28, 0.9)",
        glow: "rgba(255, 92, 92, 0.24)",
      };
    }
    if (appId === "spotify") {
      return {
        body: "rgba(225, 255, 232, 0.98)",
        edge: "rgba(28, 126, 56, 0.38)",
        text: "rgba(12, 78, 32, 0.9)",
        glow: "rgba(30, 215, 96, 0.28)",
      };
    }
    if (appId === "minesweeper") {
      return {
        body: "rgba(238, 240, 244, 0.98)",
        edge: "rgba(92, 98, 110, 0.38)",
        text: "rgba(38, 42, 52, 0.9)",
        glow: "rgba(255, 56, 56, 0.24)",
      };
    }
    if (appId === "internetExplorer") {
      return {
        body: "rgba(222, 244, 255, 0.98)",
        edge: "rgba(52, 126, 184, 0.38)",
        text: "rgba(16, 78, 132, 0.9)",
        glow: "rgba(80, 174, 238, 0.28)",
      };
    }
    if (appId === "chrome") {
      return {
        body: "rgba(246, 252, 255, 0.98)",
        edge: "rgba(62, 128, 92, 0.38)",
        text: "rgba(34, 74, 52, 0.9)",
        glow: "rgba(80, 210, 255, 0.28)",
      };
    }
    if (appId === "skype") {
      return {
        body: "rgba(224, 246, 255, 0.98)",
        edge: "rgba(30, 138, 198, 0.38)",
        text: "rgba(12, 84, 134, 0.9)",
        glow: "rgba(70, 196, 255, 0.3)",
      };
    }
    return {
      body: "rgba(255, 230, 220, 0.98)",
      edge: "rgba(146, 91, 68, 0.38)",
      text: "rgba(96, 48, 32, 0.9)",
      glow: "rgba(255, 210, 198, 0.24)",
    };
  }

  function drawDesktopToolGlyph(appId, size, pulse, active) {
    if (appId === "flamethrower") {
      ctx.fillStyle = "rgba(88, 95, 107, 0.98)";
      roundedRectPath(14, size * 0.46, size * 0.44, 11, 6);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 156, 84, 0.94)";
      ctx.beginPath();
      ctx.moveTo(size * 0.62, size * 0.26);
      ctx.quadraticCurveTo(size * 0.84, size * 0.4, size * 0.62, size * 0.68);
      ctx.quadraticCurveTo(size * 0.5, size * 0.52, size * 0.56, size * 0.44);
      ctx.quadraticCurveTo(size * 0.4, size * 0.38, size * 0.62, size * 0.26);
      ctx.fill();
      return;
    }

    if (appId === "katana") {
      ctx.strokeStyle = "rgba(210, 222, 240, 0.98)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(16, size * 0.68);
      ctx.lineTo(size * 0.78, size * 0.24);
      ctx.stroke();
      ctx.strokeStyle = "rgba(120, 140, 175, 0.7)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(17, size * 0.7);
      ctx.lineTo(size * 0.76, size * 0.26);
      ctx.stroke();
      ctx.fillStyle = "rgba(41, 46, 56, 0.96)";
      ctx.fillRect(11, size * 0.62, 14, 8);
      return;
    }

    if (appId === "nuke") {
      ctx.fillStyle = "rgba(78, 88, 100, 0.96)";
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.44, 14, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(242, 200, 78, 0.96)";
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.44, 5.4, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(38, 31, 16, 0.82)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i += 1) {
        const angle = i * (TAU / 3) + pulse * 0.12;
        ctx.beginPath();
        ctx.moveTo(size * 0.5, size * 0.44);
        ctx.lineTo(
          size * 0.5 + Math.cos(angle) * 10,
          size * 0.44 + Math.sin(angle) * 10
        );
        ctx.stroke();
      }
      return;
    }

    if (appId === "thunder") {
      ctx.fillStyle = active ? "rgba(255, 210, 96, 0.98)" : "rgba(255, 232, 148, 0.98)";
      ctx.beginPath();
      ctx.moveTo(size * 0.48, 12);
      ctx.lineTo(size * 0.66, size * 0.36);
      ctx.lineTo(size * 0.54, size * 0.36);
      ctx.lineTo(size * 0.7, size * 0.72);
      ctx.lineTo(size * 0.34, size * 0.44);
      ctx.lineTo(size * 0.46, size * 0.44);
      ctx.closePath();
      ctx.fill();
      return;
    }

    if (appId === "gauntlet") {
      ctx.fillStyle = "rgba(210, 152, 78, 0.98)";
      roundedRectPath(size * 0.24, size * 0.26, size * 0.5, size * 0.42, 12);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 212, 122, 0.98)";
      for (let i = 0; i < 4; i += 1) {
        roundedRectPath(size * (0.25 + i * 0.11), 10, 8, 18, 4);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(112, 74, 22, 0.98)";
      ctx.beginPath();
      ctx.arc(size * 0.36, size * 0.44, 3.2, 0, TAU);
      ctx.arc(size * 0.5, size * 0.4, 3.2, 0, TAU);
      ctx.arc(size * 0.62, size * 0.48, 3.2, 0, TAU);
      ctx.fill();
      return;
    }

    if (appId === "bread") {
      ctx.fillStyle = COLORS.breadCrust;
      ctx.beginPath();
      ctx.moveTo(size * 0.24, size * 0.72);
      ctx.lineTo(size * 0.24, size * 0.4);
      ctx.quadraticCurveTo(size * 0.28, size * 0.12, size * 0.5, size * 0.16);
      ctx.quadraticCurveTo(size * 0.72, size * 0.1, size * 0.76, size * 0.4);
      ctx.lineTo(size * 0.76, size * 0.72);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = COLORS.breadFace;
      ctx.beginPath();
      ctx.moveTo(size * 0.31, size * 0.67);
      ctx.lineTo(size * 0.31, size * 0.42);
      ctx.quadraticCurveTo(size * 0.34, size * 0.2, size * 0.5, size * 0.23);
      ctx.quadraticCurveTo(size * 0.66, size * 0.17, size * 0.69, size * 0.42);
      ctx.lineTo(size * 0.69, size * 0.67);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = active ? "rgba(255, 242, 146, 0.98)" : COLORS.breadButter;
      roundedRectPath(size * 0.42, size * 0.38, size * 0.12, size * 0.12, 4);
      ctx.fill();
      return;
    }

    if (appId === "paint") {
      ctx.save();
      ctx.translate(size * 0.48, size * 0.48);
      ctx.rotate(-0.65);
      ctx.fillStyle = "rgba(132, 75, 32, 0.98)";
      roundedRectPath(-5, -28, 10, 32, 4);
      ctx.fill();
      ctx.fillStyle = "rgba(58, 61, 68, 0.96)";
      roundedRectPath(-8, 0, 16, 10, 3);
      ctx.fill();
      ctx.fillStyle = active ? "rgba(255, 28, 28, 0.98)" : "rgba(220, 24, 24, 0.96)";
      ctx.beginPath();
      ctx.moveTo(-9, 8);
      ctx.quadraticCurveTo(0, 25, 9, 8);
      ctx.lineTo(6, 28);
      ctx.quadraticCurveTo(0, 36, -6, 28);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }

    if (appId === "spotify") {
      ctx.fillStyle = "rgba(30, 215, 96, 0.98)";
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.5, size * 0.3, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(8, 54, 24, 0.9)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(size * 0.43, size * (0.45 + i * 0.08), size * (0.2 + i * 0.03), -0.6, 0.7);
        ctx.stroke();
      }
      return;
    }

    if (appId === "minesweeper") {
      ctx.fillStyle = "rgba(198, 198, 198, 0.98)";
      ctx.fillRect(size * 0.18, size * 0.18, size * 0.64, size * 0.64);
      ctx.strokeStyle = "rgba(72, 72, 72, 0.88)";
      ctx.strokeRect(size * 0.18, size * 0.18, size * 0.64, size * 0.64);
      ctx.fillStyle = "rgba(224, 18, 18, 0.98)";
      ctx.beginPath();
      ctx.moveTo(size * 0.42, size * 0.3);
      ctx.lineTo(size * 0.68, size * 0.4);
      ctx.lineTo(size * 0.42, size * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(80, 42, 18, 0.9)";
      ctx.beginPath();
      ctx.moveTo(size * 0.4, size * 0.3);
      ctx.lineTo(size * 0.4, size * 0.72);
      ctx.stroke();
      return;
    }

    if (appId === "internetExplorer") {
      ctx.fillStyle = "rgba(38, 150, 220, 0.98)";
      ctx.beginPath();
      ctx.arc(size * 0.48, size * 0.52, size * 0.25, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(244, 198, 55, 0.98)";
      ctx.lineWidth = 4;
      ctx.save();
      ctx.translate(size * 0.5, size * 0.5);
      ctx.rotate(-0.58);
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.38, size * 0.18, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (appId === "chrome") {
      ctx.fillStyle = "rgba(234, 67, 53, 0.98)";
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.5, size * 0.3, -Math.PI * 0.15, Math.PI * 0.62);
      ctx.lineTo(size * 0.5, size * 0.5);
      ctx.fill();
      ctx.fillStyle = "rgba(251, 188, 5, 0.98)";
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.5, size * 0.3, Math.PI * 0.62, Math.PI * 1.28);
      ctx.lineTo(size * 0.5, size * 0.5);
      ctx.fill();
      ctx.fillStyle = "rgba(52, 168, 83, 0.98)";
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.5, size * 0.3, Math.PI * 1.28, Math.PI * 1.85);
      ctx.lineTo(size * 0.5, size * 0.5);
      ctx.fill();
      ctx.fillStyle = "rgba(66, 133, 244, 0.98)";
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.5, size * 0.13, 0, TAU);
      ctx.fill();
      return;
    }

    if (appId === "skype") {
      ctx.fillStyle = "rgba(0, 175, 240, 0.96)";
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.5, size * 0.28, 0, TAU);
      ctx.arc(size * 0.31, size * 0.38, size * 0.12, 0, TAU);
      ctx.arc(size * 0.69, size * 0.62, size * 0.12, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `800 ${size * 0.34}px ${DESKTOP_FONT}`;
      ctx.textAlign = "center";
      ctx.fillText("S", size * 0.5, size * 0.62);
      return;
    }

    ctx.fillStyle = COLORS.fistSkin;
    roundedRectPath(size * 0.22, size * 0.34, size * 0.44, size * 0.28, 10);
    ctx.fill();
    ctx.fillStyle = COLORS.fistShade;
    roundedRectPath(size * 0.44, size * 0.46, size * 0.24, size * 0.18, 8);
    ctx.fill();
    ctx.fillStyle = COLORS.fistSkin;
    for (let i = 0; i < 4; i += 1) {
      roundedRectPath(size * (0.2 + i * 0.11), size * 0.18, 9, 18, 4);
      ctx.fill();
    }
  }

  function drawDesktopToolAppIcon(appId) {
    const app = state.desktopApps[appId];
    if (!app?.owned) {
      return;
    }
    if (appId === "internetExplorer" && internetExplorerIconHidden()) {
      return;
    }

    const rect = desktopToolIconRect(appId);
    const selectionRect = desktopToolSelectionRect(appId);
    const size = desktopToolIconSize();
    const hovered = state.hoveredUiTarget === `app-icon:${appId}` || state.antiMalware.drag.target === `app-icon:${appId}`;
    const selected = app.selected || state.antiMalware.drag.target === `app-icon:${appId}`;
    const pulse = Math.sin(state.time * 2.1 + appId.length) * 0.5 + 0.5;
    const palette = desktopToolPalette(appId);
    const iconImage = appId === "flamethrower"
      ? state.flamethrower.iconImage
      : appId === "katana"
        ? state.katana.iconImage
        : appId === "nuke"
          ? state.nuke.iconImage
        : appId === "thunder"
          ? state.thunder.iconImage
        : appId === "gauntlet"
          ? state.gauntlet.iconImage
        : appId === "bread"
          ? state.bread.iconImage
        : appId === "paint"
          ? state.paint.iconImage
        : appId === "spotify"
          ? state.spotify.iconImage
        : appId === "minesweeper"
          ? state.minesweeper.iconImage
        : appId === "internetExplorer"
          ? state.internetExplorer.iconImage
        : appId === "chrome"
          ? state.chrome.iconImage
        : appId === "skype"
          ? state.skype.iconImage
        : appId === "fist"
          ? state.fist.iconImage
          : null;
    const hasLoadedIconImage = iconImage?.complete && iconImage.naturalWidth > 0;
    const isBareImageIcon = appId === "flamethrower" || appId === "katana" || appId === "nuke" || appId === "thunder" || appId === "gauntlet" || appId === "bread" || appId === "paint" || appId === "spotify" || appId === "minesweeper" || appId === "internetExplorer" || appId === "chrome" || appId === "skype" || appId === "fist";
    const drawIconBackground = !isBareImageIcon;

    ctx.save();
    if (selected) {
      drawDesktopSelection(selectionRect);
    }

    ctx.translate(rect.x, rect.y);
    if (!isBareImageIcon) {
      ctx.fillStyle = "rgba(24, 46, 66, 0.18)";
      ctx.beginPath();
      ctx.ellipse(size * 0.5, size + 12, size * 0.42, 9, 0, 0, TAU);
      ctx.fill();
    }

    if (drawIconBackground) {
      ctx.save();
      ctx.shadowColor = palette.glow;
      ctx.shadowBlur = hovered ? 24 : 14;
      roundedRectPath(0, 0, size, size, 15);
      ctx.fillStyle = palette.body;
      ctx.fill();
      ctx.restore();

      roundedRectPath(0, 0, size, size, 15);
      ctx.strokeStyle = palette.edge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (hasLoadedIconImage) {
      ctx.save();
      ctx.shadowColor = palette.glow;
      ctx.shadowBlur = hovered ? 12 : 6;
      drawNormalizedIconImage(iconImage, size * 0.5, size * 0.5, size * 0.78, size * 0.78);
      ctx.restore();
    } else {
      drawDesktopToolGlyph(appId, size, pulse, selected);
    }

    drawDesktopLabel(desktopToolLabel(appId), size * 0.5, size + 20);
    ctx.restore();
  }

  function drawDesktopToolApps() {
    for (const app of DESKTOP_TOOL_APPS) {
      drawDesktopToolAppIcon(app.id);
    }
  }

  function drawAntiMalwareIcon() {
    if (!state.antiMalware.deployed) {
      return;
    }

    const rect = antiMalwareIconRect();
    const selectionRect = antiMalwareSelectionRect();
    const size = antiMalwareIconSize();
    const hovered = state.hoveredUiTarget === "anti-icon" || state.antiMalware.drag.target === "anti-icon";
    const selected = state.antiMalware.selected || state.antiMalware.drag.target === "anti-icon";
    const pulse = Math.sin(state.antiMalware.pulse * 1.7) * 0.5 + 0.5;
    const iconImage = state.antiMalware.iconImage;

    ctx.save();
    if (selected) {
      drawDesktopSelection(selectionRect);
    }
    ctx.translate(rect.x, rect.y);
    ctx.fillStyle = COLORS.antiMalwareShadow;
    ctx.beginPath();
    ctx.ellipse(size * 0.52, size + 12, size * 0.42, 9, 0, 0, TAU);
    ctx.fill();

    if (iconImage?.complete && iconImage.naturalWidth > 0) {
      ctx.save();
      ctx.shadowColor = COLORS.antiMalwareGlow;
      ctx.shadowBlur = hovered ? 22 : 12;
      drawNormalizedIconImage(iconImage, size * 0.5, size * 0.5, size * 0.78, size * 0.78);
      ctx.restore();
      drawDesktopLabel(antiMalwareLabel(), size * 0.5, size + 20);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.shadowColor = COLORS.antiMalwareGlow;
    ctx.shadowBlur = hovered ? 24 : 16;
    roundedRectPath(0, 0, size, size, 14);
    ctx.fillStyle = COLORS.antiMalwareIcon;
    ctx.fill();
    ctx.restore();

    roundedRectPath(0, 0, size, size, 14);
    ctx.strokeStyle = COLORS.antiMalwareIconEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(size * 0.5, 12);
    ctx.lineTo(size * 0.77, size * 0.33);
    ctx.lineTo(size * 0.68, size * 0.8);
    ctx.lineTo(size * 0.32, size * 0.8);
    ctx.lineTo(size * 0.23, size * 0.33);
    ctx.closePath();
    ctx.fillStyle = hovered ? "#ffffff" : "rgba(243, 255, 247, 0.96)";
    ctx.fill();

    ctx.strokeStyle = `rgba(55, 123, 76, ${0.32 + pulse * 0.28})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(size * 0.28, size * 0.5);
    ctx.lineTo(size * 0.45, size * 0.66);
    ctx.lineTo(size * 0.72, size * 0.34);
    ctx.stroke();

    drawDesktopLabel(antiMalwareLabel(), size * 0.5, size + 20);
    ctx.restore();
  }

  function traceSmoothPath(points) {
    if (points.length < 2) {
      return;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
      return;
    }

    for (let i = 1; i < points.length - 1; i += 1) {
      const mid = lerpPt(points[i], points[i + 1], 0.5);
      ctx.quadraticCurveTo(points[i].x, points[i].y, mid.x, mid.y);
    }

    const last = points.length - 1;
    ctx.quadraticCurveTo(
      points[last - 1].x,
      points[last - 1].y,
      points[last].x,
      points[last].y
    );
  }

  function samplePolyline(points, t) {
    if (!points.length) {
      return pt();
    }
    if (points.length === 1) {
      return points[0];
    }

    const scaled = clamp(t, 0, 1) * (points.length - 1);
    const index = Math.floor(scaled);
    const localT = scaled - index;
    const current = points[index];
    const next = points[Math.min(points.length - 1, index + 1)];
    return lerpPt(current, next, localT);
  }

  function pathNormals(points) {
    return points.map((point, index) => {
      const prev = points[Math.max(0, index - 1)];
      const next = points[Math.min(points.length - 1, index + 1)];
      const tangent = norm(sub(next, prev));
      return mag(tangent) ? perp(tangent) : pt(0, -1);
    });
  }

  function drawAntiMalwareConnection() {
    if (!state.antiMalware.deployed || state.antiMalware.status !== "connecting") {
      return;
    }

    const cargo = antiMalwareTargetCargo();
    if (!cargo) {
      return;
    }

    const iconCenter = antiMalwareIconCenter();
    const end = antiMalwareCargoAnchor(cargo, iconCenter);
    const start = antiMalwareIconAnchor(end);
    const delta = sub(end, start);
    const direction = norm(delta);
    const side = perp(direction);
    const beamLength = mag(delta);
    const progress = clamp(
      (state.time - state.antiMalware.connectionStart) / Math.max(state.antiMalware.connectionDuration, 0.001),
      0,
      1
    );
    const points = [];
    const steps = motionQuery.matches
      ? 9
      : clamp(Math.round(beamLength / 28), 10, 13);
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const centerWeight = 1 - Math.abs(t - 0.5) * 1.18;
      const waveA = Math.sin(state.antiMalware.pulse * 2.6 + t * 6.8) * (8 + 6 * (1 - progress));
      const waveB = Math.cos(state.time * 12 + t * 14) * (2 + 3 * progress);
      const forward = Math.sin(t * Math.PI) * Math.cos(state.time * 4.2 + t * 6.8) * 2.8;
      points.push(
        add(
          lerpPt(start, end, t),
          add(
            mul(side, (waveA + waveB) * centerWeight),
            mul(direction, forward * centerWeight)
          )
        )
      );
    }
    const normals = pathNormals(points);
    const angle = Math.atan2(direction.y, direction.x);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = COLORS.antiMalwareGlow;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = `rgba(111, 255, 163, ${0.24 + (1 - progress) * 0.2})`;
    ctx.lineWidth = 16;
    traceSmoothPath(points);
    ctx.stroke();

    const strands = [
      {
        color: `rgba(72, 255, 141, ${0.34 + progress * 0.18})`,
        width: 6.2,
        base: -5,
        amp: 3.2,
        speed: 6.6,
      },
      {
        color: `rgba(202, 255, 220, ${0.56 + progress * 0.16})`,
        width: 3.8,
        base: 0,
        amp: 2.2,
        speed: 7.8,
      },
    ];

    for (const strand of strands) {
      const strandPoints = points.map((point, index) => {
        const t = index / Math.max(points.length - 1, 1);
        const swing = strand.base
          + Math.sin(state.time * strand.speed + t * 11 + index * 0.25) * strand.amp;
        const taper = 0.42 + 0.58 * Math.sin(t * Math.PI);
        return add(point, mul(normals[index], swing * taper));
      });
      ctx.shadowBlur = 6;
      ctx.strokeStyle = strand.color;
      ctx.lineWidth = strand.width;
      traceSmoothPath(strandPoints);
      ctx.stroke();
    }

    ctx.fillStyle = COLORS.antiMalwareHex;
    ctx.font = `700 11px ${MONO_FONT}`;
    ctx.textAlign = "center";
    const beamHexFrame = Math.floor(state.time * 40);
    for (let i = 1; i < 5; i += 1) {
      const t = (progress * 0.82 + i * 0.18 + state.time * 0.26) % 1;
      const point = samplePolyline(points, t);
      ctx.globalAlpha = 0.38 + 0.46 * Math.sin(state.time * 6 + i);
      ctx.fillText(HEX_DIGITS[(i * 31 + beamHexFrame) % HEX_DIGITS.length], point.x, point.y - 6);
    }

    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(start.x, start.y);
    ctx.rotate(angle);
    ctx.fillStyle = `rgba(142, 255, 182, ${0.46 + progress * 0.18})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(209, 255, 224, ${0.58 + progress * 0.16})`;
    ctx.beginPath();
    ctx.ellipse(6, 0, 8, 5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    const impactBase = 10 + progress * 12;
    ctx.save();
    ctx.translate(end.x, end.y);
    ctx.rotate(angle);
    ctx.shadowBlur = 12;
    ctx.shadowColor = COLORS.antiMalwareGlow;
    ctx.fillStyle = `rgba(114, 255, 162, ${0.28 + progress * 0.18})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, impactBase * 1.4, impactBase, 0, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = `rgba(178, 255, 210, ${0.34 + progress * 0.24})`;
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 3; i += 1) {
      const radius = impactBase + i * 7 + Math.sin(state.time * 5 + i) * 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, radius, -1.25, 1.25);
      ctx.stroke();
    }

    ctx.strokeStyle = `rgba(160, 255, 196, ${0.42 + progress * 0.22})`;
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 6; i += 1) {
      const spread = lerp(-1.05, 1.05, i / 5);
      const rayAngle = spread + Math.sin(state.time * 5.5 + i) * 0.09;
      const from = pt(Math.cos(rayAngle) * 6, Math.sin(rayAngle) * 6);
      const to = pt(Math.cos(rayAngle) * (impactBase + 14), Math.sin(rayAngle) * (impactBase + 10));
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }

    ctx.fillStyle = COLORS.antiMalwareHex;
    const orbitHexFrame = Math.floor(state.time * 32);
    for (let i = 0; i < 4; i += 1) {
      const orbitAngle = state.time * 2.8 + i * (TAU / 4);
      const orbit = pt(Math.cos(orbitAngle) * (impactBase + 8), Math.sin(orbitAngle) * (impactBase + 4));
      ctx.fillText(HEX_DIGITS[(orbitHexFrame + i * 19) % HEX_DIGITS.length], orbit.x, orbit.y);
    }
    ctx.restore();

    ctx.restore();
  }

  function drawAntiMalwareWindow() {
    if (!state.antiMalware.deployed || !state.antiMalware.windowOpen) {
      return;
    }

    const anti = state.antiMalware;
    const rect = antiMalwareWindowRect();
    const closeRect = antiMalwareCloseRect();
    const hoveredBar = state.hoveredUiTarget === "anti-window" || anti.drag.target === "anti-window";
    const hoveredClose = state.hoveredUiTarget === "anti-close";
    const progress = anti.status === "connecting"
      ? clamp((state.time - anti.connectionStart) / Math.max(anti.connectionDuration, 0.001), 0, 1)
      : 0;
    const target = antiMalwareTargetCargo();

    ctx.save();
    ctx.shadowColor = COLORS.antiMalwareShadow;
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    roundedRectPath(rect.x, rect.y, rect.width, rect.height, 18);
    ctx.fillStyle = COLORS.antiMalwarePanel;
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundedRectPath(rect.x, rect.y, rect.width, rect.height, 18);
    ctx.strokeStyle = COLORS.antiMalwarePanelEdge;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    roundedRectPath(rect.x + 10, rect.y + 38, rect.width - 20, rect.height - 48, 13);
    ctx.fillStyle = COLORS.antiMalwareScreen;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x + 12, rect.y + 40, rect.width - 24, rect.height - 52);
    ctx.clip();
    ctx.strokeStyle = COLORS.antiMalwareGrid;
    ctx.lineWidth = 1;
    for (let x = rect.x + 14; x <= rect.x + rect.width - 14; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, rect.y + 40);
      ctx.lineTo(x, rect.y + rect.height - 12);
      ctx.stroke();
    }
    for (let y = rect.y + 44; y <= rect.y + rect.height - 14; y += 16) {
      ctx.beginPath();
      ctx.moveTo(rect.x + 12, y);
      ctx.lineTo(rect.x + rect.width - 12, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = hoveredBar ? "rgba(53, 78, 66, 0.99)" : COLORS.antiMalwareBar;
    roundedRectPath(rect.x + 1, rect.y + 1, rect.width - 2, 30, 17);
    ctx.fill();

    if (hoveredBar) {
      ctx.strokeStyle = "rgba(169, 255, 192, 0.34)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rect.x + 42, rect.y + 10);
      ctx.lineTo(rect.x + rect.width - 16, rect.y + 10);
      ctx.stroke();
    }

    ctx.fillStyle = hoveredClose ? "rgba(215, 255, 224, 0.96)" : "rgba(178, 255, 198, 0.9)";
    ctx.fillRect(closeRect.x, closeRect.y, closeRect.width, closeRect.height);
    ctx.strokeStyle = "rgba(32, 90, 52, 0.75)";
    ctx.lineWidth = 1;
    ctx.strokeRect(closeRect.x, closeRect.y, closeRect.width, closeRect.height);
    ctx.beginPath();
    ctx.moveTo(closeRect.x + 4, closeRect.y + 4);
    ctx.lineTo(closeRect.x + closeRect.width - 4, closeRect.y + closeRect.height - 4);
    ctx.moveTo(closeRect.x + closeRect.width - 4, closeRect.y + 4);
    ctx.lineTo(closeRect.x + 4, closeRect.y + closeRect.height - 4);
    ctx.stroke();

    ctx.fillStyle = COLORS.antiMalwareText;
    ctx.font = `600 12px ${DESKTOP_FONT}`;
    ctx.fillText("Malwarebytes", rect.x + 36, rect.y + 20);

    ctx.font = `700 13px ${DESKTOP_FONT}`;
    ctx.fillText("MALWAREBYTES", rect.x + 18, rect.y + 62);

    ctx.font = `12px ${DESKTOP_FONT}`;
    ctx.fillStyle = COLORS.antiMalwareTextSoft;
    ctx.fillText(`STATUS  ${anti.status === "connecting" ? "PURGING" : anti.status === "cooldown" ? "COOLDOWN" : "IDLE"}`, rect.x + 18, rect.y + 84);
    ctx.fillText(`TARGET  ${target ? target.title.toUpperCase() : "NONE"}`, rect.x + 18, rect.y + 104);

    if (anti.lastEvent) {
      ctx.fillText(anti.lastEvent.toUpperCase(), rect.x + 18, rect.y + 124);
    }

    const meterX = rect.x + 18;
    const meterY = rect.y + 136;
    const meterWidth = rect.width - 36;
    ctx.fillStyle = "rgba(127, 255, 163, 0.12)";
    ctx.fillRect(meterX, meterY, meterWidth, 10);
    ctx.fillStyle = COLORS.antiMalwareGlow;
    ctx.fillRect(meterX, meterY, meterWidth * (anti.status === "connecting" ? progress : anti.status === "cooldown" ? 0.18 : 0.06), 10);
    ctx.strokeStyle = "rgba(135, 255, 170, 0.24)";
    ctx.strokeRect(meterX, meterY, meterWidth, 10);

    const radarY = rect.y + rect.height - 26;
    for (let i = 0; i < 14; i += 1) {
      const intensity = 0.26 + 0.18 * Math.sin(anti.pulse * 4.2 + i * 0.75);
      ctx.fillStyle = `rgba(126, 255, 161, ${intensity})`;
      ctx.fillRect(rect.x + 18 + i * 16, radarY - rand(0, 10), 9, 8 + (i % 4) * 4);
    }

    ctx.restore();
  }

  function drawAntiMalwareHexDigits() {
    const digits = state.antiMalware.hexDigits;
    if (!digits.length) {
      return;
    }

    ctx.save();
    ctx.textAlign = "center";
    for (const digit of digits) {
      const alpha = clamp(digit.life / digit.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.save();
      ctx.translate(digit.pos.x, digit.pos.y);
      ctx.rotate(digit.spin * (1 - alpha));
      ctx.font = `700 ${digit.size}px ${MONO_FONT}`;
      ctx.shadowColor = COLORS.antiMalwareGlow;
      ctx.shadowBlur = 12;
      ctx.fillStyle = COLORS.antiMalwareHex;
      ctx.fillText(digit.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

