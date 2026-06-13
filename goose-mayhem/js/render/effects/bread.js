  function drawBreadCursor() {
    if (!state.bread.active || !state.pointer.inside) {
      return;
    }

    const point = state.pointer.pos;
    const pulse = Math.sin(state.bread.pulse * 1.8) * 0.5 + 0.5;

    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.globalCompositeOperation = "lighter";
    const aura = ctx.createRadialGradient(0, 0, 6, 0, 0, 34 + pulse * 8);
    aura.addColorStop(0, `rgba(255, 244, 182, ${0.2 + pulse * 0.08})`);
    aura.addColorStop(0.5, `rgba(255, 210, 110, ${0.12 + pulse * 0.08})`);
    aura.addColorStop(1, "rgba(255, 210, 110, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 34 + pulse * 8, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(point.x - 18, point.y - 18);
    ctx.fillStyle = COLORS.breadCrust;
    ctx.beginPath();
    ctx.moveTo(3, 34);
    ctx.lineTo(3, 18);
    ctx.quadraticCurveTo(5, 4, 18, 6);
    ctx.quadraticCurveTo(31, 2, 33, 18);
    ctx.lineTo(33, 34);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = COLORS.breadFace;
    ctx.beginPath();
    ctx.moveTo(7, 31);
    ctx.lineTo(7, 19);
    ctx.quadraticCurveTo(9, 9, 18, 10);
    ctx.quadraticCurveTo(27, 8, 29, 19);
    ctx.lineTo(29, 31);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = COLORS.breadButter;
    roundedRectPath(14, 17, 9, 9, 3);
    ctx.fill();

    ctx.fillStyle = COLORS.breadSeed;
    ctx.beginPath();
    ctx.ellipse(11, 15, 1.4, 2.3, -0.3, 0, TAU);
    ctx.ellipse(24, 13, 1.4, 2.3, 0.3, 0, TAU);
    ctx.ellipse(18, 12, 1.4, 2.3, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 238, 142, ${0.62 + pulse * 0.18})`;
    ctx.beginPath();
    ctx.arc(18, 18, 2.8 + pulse * 1.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
