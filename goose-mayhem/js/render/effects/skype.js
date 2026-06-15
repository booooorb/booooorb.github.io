  function drawSkypeCells(mode = "all") {
    const image = state.skype.cellImage;

    ctx.save();
    for (const cell of state.skype.cells) {
      if (cell.age < 0) {
        continue;
      }
      const capturing = !!cell.cargoId;
      if (mode === "capturing" && !capturing) {
        continue;
      }
      if (mode === "loose" && capturing) {
        continue;
      }
      const capturePulse = cell.cargoId ? Math.sin(state.time * 12 + cell.seed) * 0.5 + 0.5 : 0;
      const width = cell.radius * (1.88 + capturePulse * 0.18);
      const height = width * 0.71;
      const alpha = 1;
      const hover = Math.sin(state.time * 3.4 + cell.seed) * (cell.cargoId ? 4.5 : 2.6);

      ctx.save();
      ctx.translate(cell.pos.x, cell.pos.y + hover);
      ctx.rotate(cell.angle);
      ctx.globalAlpha = alpha * (cell.cargoId ? 0.42 : 0.86);
      ctx.shadowColor = cell.cargoId ? "rgba(103, 232, 255, 0.68)" : "rgba(54, 186, 235, 0.46)";
      ctx.shadowBlur = cell.cargoId ? 18 : 12;
      if (cell.cargoId) {
        ctx.filter = `hue-rotate(${10 + capturePulse * 12}deg) saturate(1.18) brightness(1.08)`;
      }
      if (image?.complete && image.naturalWidth > 0) {
        ctx.drawImage(image, -width * 0.5, -height * 0.5, width, height);
      } else {
        const gradient = ctx.createRadialGradient(0, 0, width * 0.08, 0, 0, width * 0.5);
        gradient.addColorStop(0, "rgba(238, 252, 255, 0.96)");
        gradient.addColorStop(0.52, "rgba(74, 190, 236, 0.72)");
        gradient.addColorStop(1, "rgba(32, 126, 210, 0.18)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(0, 0, width * 0.5, height * 0.5, 0, 0, TAU);
        ctx.fill();
      }
      if (cell.cargoId) {
        ctx.filter = "none";
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawSkypePops() {
    if (!state.skype.pops.length) {
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const pop of state.skype.pops) {
      const t = clamp(pop.age / pop.duration, 0, 1);
      const alpha = 1 - cubicEaseInOut(t);
      const radius = lerp(pop.radius * 0.55, pop.radius * 1.8, cubicEaseInOut(t));
      ctx.strokeStyle = `rgba(144, 232, 255, ${alpha * 0.58})`;
      ctx.lineWidth = 2 + alpha * 3;
      ctx.beginPath();
      ctx.arc(pop.pos.x, pop.pos.y, radius, 0, TAU);
      ctx.stroke();

      ctx.fillStyle = `rgba(235, 252, 255, ${alpha * 0.24})`;
      for (let i = 0; i < 5; i += 1) {
        const angle = pop.seed + i * (TAU / 5) + t * 0.6;
        const point = add(pop.pos, mul(angleVec(angle), radius * lerp(0.42, 0.92, t)));
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2 + alpha * 3, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }
