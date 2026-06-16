  function drawNotepadProjectiles() {
    if (!state.notepad.projectiles.length) {
      return;
    }

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 34px ${DESKTOP_FONT}`;
    for (const projectile of state.notepad.projectiles) {
      const pulse = Math.sin(state.time * 14 + projectile.wobble) * 0.5 + 0.5;
      ctx.save();
      ctx.translate(projectile.pos.x, projectile.pos.y);
      ctx.rotate(projectile.angle);
      ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
      ctx.shadowBlur = 7;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.72)";
      ctx.strokeText(projectile.word, 0, 0);
      ctx.shadowColor = `rgba(170, 220, 255, ${0.3 + pulse * 0.2})`;
      ctx.shadowBlur = 12;
      ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
      ctx.fillText(projectile.word, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawNotepadCursor() {
    if (!state.notepad.active || !state.pointer.inside) {
      return;
    }

    const point = state.pointer.pos;
    const pulse = Math.sin(state.notepad.pulse * 2.8) * 0.5 + 0.5;

    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    ctx.shadowColor = "rgba(0, 0, 0, 0.72)";
    ctx.shadowBlur = 7;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.78)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(0, 30);
    ctx.moveTo(-13, -30);
    ctx.lineTo(13, -30);
    ctx.moveTo(-13, 30);
    ctx.lineTo(13, 30);
    ctx.stroke();

    ctx.shadowColor = `rgba(190, 225, 255, ${0.3 + pulse * 0.3})`;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.98)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(0, 30);
    ctx.moveTo(-13, -30);
    ctx.lineTo(13, -30);
    ctx.moveTo(-13, 30);
    ctx.lineTo(13, 30);
    ctx.stroke();

    if (state.notepad.buffer) {
      ctx.font = `800 18px ${DESKTOP_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.76)";
      ctx.lineWidth = 3;
      const preview = state.notepad.buffer.toUpperCase();
      ctx.strokeText(preview, 0, -44);
      ctx.fillText(preview, 0, -44);
    }

    ctx.restore();
  }
