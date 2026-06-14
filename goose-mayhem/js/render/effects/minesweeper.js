  function drawMinesweeperMines() {
    const mines = state.minesweeper.mines;
    if (!mines.length) {
      return;
    }

    const flagImage = state.minesweeper.flagImage;
    for (const mine of mines) {
      const pop = mine.triggered
        ? Math.sin(clamp(mine.triggerAge / mine.triggerDuration, 0, 1) * Math.PI)
        : 0;
      const flagSize = 42 + pop * 18;

      ctx.save();
      ctx.translate(mine.pos.x, mine.pos.y - pop * 12);
      ctx.fillStyle = "rgba(25, 17, 12, 0.14)";
      ctx.beginPath();
      ctx.ellipse(0, 11 + pop * 8, 9 + pop * 6, 2.6 + pop * 1.4, 0, 0, TAU);
      ctx.fill();

      if (pop > 0) {
        ctx.fillStyle = "rgba(34, 34, 34, 0.95)";
        ctx.beginPath();
        ctx.arc(0, 7, 10 + pop * 5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 216, 84, ${0.5 + pop * 0.35})`;
        ctx.beginPath();
        ctx.arc(0, 7, 3 + pop * 2, 0, TAU);
        ctx.fill();
      }

      if (flagImage?.complete && flagImage.naturalWidth > 0) {
        ctx.drawImage(flagImage, -flagSize * 0.5, -flagSize + 12, flagSize, flagSize);
      } else {
        ctx.strokeStyle = "rgba(88, 44, 18, 0.94)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-5, 13);
        ctx.lineTo(-5, -24 - pop * 8);
        ctx.stroke();
        ctx.fillStyle = "rgba(221, 18, 18, 0.98)";
        ctx.beginPath();
        ctx.moveTo(-4, -24 - pop * 8);
        ctx.lineTo(20, -15 - pop * 8);
        ctx.lineTo(-4, -6 - pop * 8);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawMinesweeperExplosions() {
    const explosions = state.minesweeper.explosions;
    if (!explosions.length) {
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const explosion of explosions) {
      const t = clamp(explosion.age / explosion.duration, 0, 1);
      const reveal = clamp(t / 0.18, 0, 1);
      const fade = 1 - clamp((t - 0.42) / 0.58, 0, 1);
      const radius = explosion.radius * cubicEaseInOut(clamp(t * 1.24, 0, 1));
      const alpha = reveal * fade;

      const blast = ctx.createRadialGradient(
        explosion.pos.x, explosion.pos.y, 0,
        explosion.pos.x, explosion.pos.y, radius
      );
      blast.addColorStop(0, `rgba(255, 246, 196, ${alpha * 0.95})`);
      blast.addColorStop(0.24, `rgba(255, 151, 56, ${alpha * 0.74})`);
      blast.addColorStop(0.62, `rgba(231, 50, 31, ${alpha * 0.34})`);
      blast.addColorStop(1, "rgba(231, 50, 31, 0)");
      ctx.fillStyle = blast;
      ctx.beginPath();
      ctx.arc(explosion.pos.x, explosion.pos.y, radius, 0, TAU);
      ctx.fill();

      ctx.strokeStyle = `rgba(255, 235, 174, ${alpha * 0.72})`;
      ctx.lineWidth = 3.5 + alpha * 5;
      for (let i = 0; i < 12; i += 1) {
        const angle = explosion.seed + i * (TAU / 12);
        const from = add(explosion.pos, mul(angleVec(angle), radius * 0.16));
        const to = add(explosion.pos, mul(angleVec(angle + Math.sin(i) * 0.12), radius * rand(0.46, 0.9)));
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
