  function drawCurrencyBursts() {
    if (!state.currencyBursts.length) {
      return;
    }

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const burst of state.currencyBursts) {
      const life = clamp(1 - burst.age / burst.duration, 0, 1);
      const alpha = clamp(life * 1.15, 0, 1);
      const billWidth = burst.radius * 3;
      const billHeight = burst.radius * 1.85;
      const corner = Math.max(4, burst.radius * 0.34);
      const wobble = Math.sin(burst.angle) * 0.16;

      ctx.globalAlpha = alpha;
      ctx.shadowColor = COLORS.currencyGlow;
      ctx.shadowBlur = 14;

      ctx.save();
      ctx.translate(burst.pos.x, burst.pos.y);
      ctx.rotate(burst.angle * 0.18);
      ctx.transform(1, 0, wobble, 1, 0, 0);

      roundedRectPath(-billWidth / 2, -billHeight / 2, billWidth, billHeight, corner);
      ctx.fillStyle = COLORS.billFace;
      ctx.fill();

      roundedRectPath(-billWidth * 0.36, -billHeight * 0.28, billWidth * 0.72, billHeight * 0.56, corner * 0.8);
      ctx.fillStyle = COLORS.billShade;
      ctx.fill();

      ctx.strokeStyle = COLORS.billEdge;
      ctx.lineWidth = 1.8;
      roundedRectPath(-billWidth / 2, -billHeight / 2, billWidth, billHeight, corner);
      ctx.stroke();

      ctx.lineWidth = 1.2;
      roundedRectPath(-billWidth * 0.36, -billHeight * 0.28, billWidth * 0.72, billHeight * 0.56, corner * 0.8);
      ctx.stroke();

      ctx.fillStyle = COLORS.billSeal;
      ctx.beginPath();
      ctx.arc(-billWidth * 0.26, 0, billHeight * 0.18, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(billWidth * 0.26, 0, billHeight * 0.18, 0, TAU);
      ctx.fill();

      ctx.fillStyle = COLORS.billText;
      ctx.font = `700 ${Math.max(11, billHeight * 0.74)}px ${DESKTOP_FONT}`;
      ctx.fillText("$", 0, billHeight * 0.03);

      ctx.fillRect(-billWidth * 0.34, -billHeight * 0.06, billWidth * 0.12, billHeight * 0.04);
      ctx.fillRect(billWidth * 0.22, -billHeight * 0.06, billWidth * 0.12, billHeight * 0.04);

      ctx.globalAlpha = alpha * 0.52;
      ctx.fillStyle = "rgba(236, 255, 240, 0.9)";
      ctx.fillRect(-billWidth * 0.38, -billHeight * 0.22, billWidth * 0.76, billHeight * 0.08);

      ctx.restore();
    }
    ctx.restore();
  }
