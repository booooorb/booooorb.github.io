  function drawShadow(goose) {
    const s = goose.size;
    const bodyBob = Math.abs(goose.gait) * 1.25 * s;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(goose.pos.x, goose.pos.y + 2 + bodyBob, 20 * s, 15 * s, 0, 0, TAU);
    ctx.fillStyle = COLORS.shadow;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(goose.pos.x, goose.pos.y + 3 + bodyBob, 14 * s, 10 * s, 0, 0, TAU);
    ctx.fillStyle = COLORS.shadowCore;
    ctx.fill();
    ctx.restore();
  }

  function drawGoose(goose) {
    const s = goose.size;
    const fwd = angleVec(goose.angle);
    const side = angleVec(goose.angle + Math.PI / 2);
    const bodyBob = Math.abs(goose.gait) * 1.25 * s;
    const bodyCenter = add(goose.rig.bodyCenter, mul(SCREEN_UP, bodyBob));
    const underbodyCenter = add(goose.rig.underbodyCenter, mul(SCREEN_UP, bodyBob * 0.85));
    const neckBase = add(goose.rig.neckBase, mul(SCREEN_UP, bodyBob * 0.6));
    const neckHeadPoint = add(goose.rig.neckHeadPoint, mul(SCREEN_UP, bodyBob * 0.5));
    const head1EndPoint = add(goose.rig.head1EndPoint, mul(SCREEN_UP, bodyBob * 0.5));
    const head2EndPoint = add(goose.rig.head2EndPoint, mul(SCREEN_UP, bodyBob * 0.5));
    const tailStart = add(bodyCenter, mul(fwd, -8 * s));
    const tailEnd = add(add(bodyCenter, mul(fwd, -16 * s)), mul(SCREEN_UP, -1.8 * s));

    const strokeLine = (from, to, width, color) => {
      ctx.beginPath();
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    };

    const fillCircle = (center, radius, color) => {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(center.x, center.y, radius, 0, TAU);
      ctx.fill();
    };

    fillCircle(goose.feet.l.pos, 4 * s, COLORS.feet);
    fillCircle(goose.feet.r.pos, 4 * s, COLORS.feet);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    strokeLine(tailStart, tailEnd, 5 * s, COLORS.bodyShadow);
    strokeLine(add(bodyCenter, mul(fwd, 11 * s)), add(bodyCenter, mul(fwd, -11 * s)), 24 * s, COLORS.bodyShadow);
    strokeLine(neckBase, neckHeadPoint, 15 * s, COLORS.bodyShadow);
    strokeLine(neckHeadPoint, head1EndPoint, 17 * s, COLORS.bodyShadow);
    strokeLine(head1EndPoint, head2EndPoint, 12 * s, COLORS.bodyShadow);
    strokeLine(add(underbodyCenter, mul(fwd, 7 * s)), add(underbodyCenter, mul(fwd, -7 * s)), 15 * s, COLORS.underbody);
    strokeLine(add(bodyCenter, mul(fwd, 11 * s)), add(bodyCenter, mul(fwd, -11 * s)), 22 * s, COLORS.body);
    strokeLine(neckBase, neckHeadPoint, 13 * s, COLORS.body);
    strokeLine(neckHeadPoint, head1EndPoint, 15 * s, COLORS.body);
    strokeLine(head1EndPoint, head2EndPoint, 10 * s, COLORS.body);

    strokeLine(
      add(bodyCenter, add(mul(fwd, 3 * s), mul(side, 3.5 * s))),
      add(bodyCenter, add(mul(fwd, -7 * s), mul(side, 1.2 * s))),
      4.5 * s,
      COLORS.wing
    );
    strokeLine(
      add(bodyCenter, add(mul(fwd, 3 * s), mul(side, -3.5 * s))),
      add(bodyCenter, add(mul(fwd, -7 * s), mul(side, -1.2 * s))),
      4.5 * s,
      COLORS.wing
    );

    strokeLine(head2EndPoint, add(head2EndPoint, mul(fwd, 3 * s)), 9 * s, COLORS.beak);
    ctx.restore();

    const eyeBase = add(neckHeadPoint, add(mul(SCREEN_UP, 3 * s), mul(fwd, 5 * s)));
    const eyeSide = mul(side, 6.5 * s);
    fillCircle(sub(eyeBase, eyeSide), 2 * s, COLORS.eye);
    fillCircle(add(eyeBase, eyeSide), 2 * s, COLORS.eye);
  }

  function drawHonkBubble(goose) {
    if (!goose.honkText || state.time >= goose.honkUntil) {
      return;
    }

    const bubbleAnchor = add(goose.rig.neckHeadPoint, mul(SCREEN_UP, 28 * goose.size));
    const fontSize = 13;
    ctx.save();
    ctx.font = `700 ${fontSize}px ${PLAYFUL_FONT}`;
    const measuredWidth = typeof ctx.measureText === "function"
      ? ctx.measureText(goose.honkText).width
      : goose.honkText.length * fontSize * 0.58;
    const bubbleWidth = measuredWidth + 18;
    const bubbleHeight = 24;
    const bubbleX = clamp(bubbleAnchor.x - bubbleWidth / 2, 10, state.width - bubbleWidth - 10);
    const bubbleY = clamp(bubbleAnchor.y - bubbleHeight - 14, 10, state.height - bubbleHeight - 10);

    ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
    ctx.strokeStyle = "rgba(46, 38, 26, 0.2)";
    ctx.lineWidth = 1;
    ctx.fillRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight);
    ctx.strokeRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight);

    ctx.beginPath();
    ctx.moveTo(bubbleAnchor.x - 6, bubbleY + bubbleHeight);
    ctx.lineTo(bubbleAnchor.x + 2, bubbleY + bubbleHeight);
    ctx.lineTo(bubbleAnchor.x - 2, bubbleY + bubbleHeight + 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#2d2318";
    ctx.fillText(goose.honkText, bubbleX + 9, bubbleY + 16);
    ctx.restore();
  }
