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

    ctx.save();
    ctx.translate(state.pointer.pos.x, state.pointer.pos.y);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255, 228, 214, ${0.16 + pulse * 0.12})`;
    ctx.beginPath();
    ctx.arc(0, 0, 28 + pulse * 6, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(state.pointer.pos.x - 12, state.pointer.pos.y - 10);
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
    if (!fist.cracks.length && fist.impactFlash <= 0) {
      return;
    }

    if (fist.impactFlash > 0) {
      const flashAlpha = clamp(Math.pow(fist.impactFlash, 0.6) * 0.22, 0, 0.22);
      ctx.save();
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      ctx.fillStyle = `rgba(225, 241, 255, ${flashAlpha})`;
      ctx.fillRect(0, 0, state.width, state.height);
      ctx.restore();
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
