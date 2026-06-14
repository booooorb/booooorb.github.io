  function drawFistShards() {
    if (!state.fist.shards.length) {
      return;
    }

    for (const shard of state.fist.shards) {
      const alpha = clamp(shard.life / shard.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(shard.pos.x, shard.pos.y);
      ctx.rotate(shard.angle);
      ctx.translate(-shard.source.width / 2, -shard.source.height / 2);
      ctx.beginPath();
      ctx.rect(0, 0, shard.source.width, shard.source.height);
      ctx.clip();
      ctx.translate(-shard.source.x, -shard.source.y);
      drawCargoSnapshotFace(shard.cargo, { showClose: false, showFrame: false });
      ctx.restore();
    }
  }

  function drawFistCursor() {
    if (!state.fist.active || !state.pointer.inside) {
      return;
    }

    const pulse = Math.sin(state.fist.pulse * 1.8) * 0.5 + 0.5;
    const iconImage = state.fist.iconImage;
    const punchT = state.fist.punchDuration > 0
      ? clamp(state.fist.punchAge / state.fist.punchDuration, 0, 1)
      : 1;
    const punchPower = punchT < 1 ? Math.sin(punchT * Math.PI) : 0;
    const punchSnap = punchT < 1 ? Math.sin(punchT * Math.PI * 2) : 0;
    const punchDir = angleVec(state.fist.punchAngle);
    const punchOffset = mul(punchDir, punchPower * 22);

    ctx.save();
    ctx.translate(state.pointer.pos.x + punchOffset.x, state.pointer.pos.y + punchOffset.y);
    ctx.scale(1 + punchPower * 0.18, 1 + punchPower * 0.18);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255, 245, 245, ${0.14 + pulse * 0.12})`;
    ctx.beginPath();
    ctx.arc(0, 0, 30 + pulse * 7, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (iconImage?.complete && iconImage.naturalWidth > 0) {
      const size = 52 + pulse * 5 + punchPower * 9;
      ctx.save();
      ctx.translate(state.pointer.pos.x + punchOffset.x, state.pointer.pos.y + punchOffset.y);
      ctx.rotate(Math.sin(state.fist.pulse * 0.9) * 0.05 + punchSnap * 0.16);
      ctx.scale(1 + punchPower * 0.22, 1 - punchPower * 0.08);
      ctx.shadowColor = "rgba(15, 15, 15, 0.34)";
      ctx.shadowBlur = 10 + punchPower * 8;
      ctx.drawImage(iconImage, -size * 0.5, -size * 0.5, size, size);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(state.pointer.pos.x - 12 + punchOffset.x, state.pointer.pos.y - 10 + punchOffset.y);
    ctx.rotate(punchSnap * 0.16);
    ctx.scale(1 + punchPower * 0.18, 1 - punchPower * 0.08);
    ctx.fillStyle = COLORS.fistSkin;
    roundedRectPath(0, 16, 30, 22, 10);
    ctx.fill();
    ctx.fillStyle = COLORS.fistShade;
    roundedRectPath(18, 24, 15, 13, 7);
    ctx.fill();
    ctx.fillStyle = COLORS.fistSkin;
    for (let i = 0; i < 4; i += 1) {
      roundedRectPath(2 + i * 7, 0, 8, 18, 4);
      ctx.fill();
    }
    ctx.strokeStyle = COLORS.fistOutline;
    ctx.lineWidth = 1.4;
    roundedRectPath(0, 16, 30, 22, 10);
    ctx.stroke();
    ctx.restore();
  }

  function drawFistCracks() {
    const fist = state.fist;
    if (!fist.cracks.length) {
      return;
    }

    const glassImage = fist.glassImage;
    if (glassImage?.complete && glassImage.naturalWidth > 0) {
      ctx.save();
      for (const crack of fist.cracks) {
        const removalFade = clamp((crack.duration - crack.age) / 0.55, 0, 1);
        const size = 250 + crack.scale * 78;
        ctx.save();
        ctx.globalAlpha = removalFade;
        ctx.translate(crack.point.x, crack.point.y);
        ctx.rotate(crack.rotation || 0);
        ctx.drawImage(glassImage, -size * 0.5, -size * 0.5, size, size);
        ctx.restore();
      }
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const crack of fist.cracks) {
      const alpha = clamp(1 - crack.age / crack.duration, 0, 1);
      ctx.strokeStyle = `rgba(41, 78, 118, ${alpha * 0.28})`;
      ctx.lineWidth = 4;
      for (const spoke of crack.spokes) {
        const end = pt(
          crack.point.x + Math.cos(spoke.angle) * spoke.length,
          crack.point.y + Math.sin(spoke.angle) * spoke.length
        );
        const bend = pt(
          crack.point.x + Math.cos(spoke.angle) * spoke.length * 0.55 + Math.sin(spoke.angle) * spoke.bend,
          crack.point.y + Math.sin(spoke.angle) * spoke.length * 0.55 - Math.cos(spoke.angle) * spoke.bend
        );
        ctx.beginPath();
        ctx.moveTo(crack.point.x, crack.point.y);
        ctx.lineTo(bend.x, bend.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }

      ctx.strokeStyle = `rgba(232, 245, 255, ${alpha * 0.92})`;
      ctx.lineWidth = 1.4;
      for (const spoke of crack.spokes) {
        const end = pt(
          crack.point.x + Math.cos(spoke.angle) * spoke.length,
          crack.point.y + Math.sin(spoke.angle) * spoke.length
        );
        const bend = pt(
          crack.point.x + Math.cos(spoke.angle) * spoke.length * 0.55 + Math.sin(spoke.angle) * spoke.bend,
          crack.point.y + Math.sin(spoke.angle) * spoke.length * 0.55 - Math.cos(spoke.angle) * spoke.bend
        );
        const splitOrigin = lerpPt(crack.point, end, spoke.splitAt);
        const splitEnd = pt(
          splitOrigin.x + Math.cos(spoke.angle + spoke.splitAngle) * spoke.splitLength,
          splitOrigin.y + Math.sin(spoke.angle + spoke.splitAngle) * spoke.splitLength
        );

        ctx.beginPath();
        ctx.moveTo(crack.point.x, crack.point.y);
        ctx.lineTo(bend.x, bend.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(splitOrigin.x, splitOrigin.y);
        ctx.lineTo(splitEnd.x, splitEnd.y);
        ctx.stroke();
      }

      ctx.fillStyle = `rgba(242, 249, 255, ${alpha * 0.64})`;
      ctx.beginPath();
      ctx.arc(crack.point.x, crack.point.y, 3.4 * crack.scale, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
