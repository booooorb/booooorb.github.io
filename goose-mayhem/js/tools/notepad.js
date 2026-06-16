  const NOTEPAD_WORD_LENGTH = 4;
  const NOTEPAD_PROJECTILE_SPEED = motionQuery.matches ? 390 : 560;
  const NOTEPAD_PROJECTILE_MAX_AGE = 6;

  function notepadCursorPoint() {
    if (state.pointer.inside) {
      return pt(state.pointer.pos.x, state.pointer.pos.y);
    }
    if (state.desktopApps.notepad?.owned) {
      const rect = desktopToolIconRect("notepad");
      return pt(rect.x + rect.width / 2, rect.y + rect.height / 2);
    }
    return pt(state.width / 2, state.height / 2);
  }

  function updateNotepadAim(movement) {
    if (!movement || mag(movement) < 2) {
      return;
    }
    state.notepad.aimDir = norm(movement);
  }

  function toggleNotepad(force) {
    const desired = toolToggleDesired(state.notepad, force);
    state.notepad.active = desired;
    state.notepad.buffer = "";
    if (desired) {
      deactivateExclusiveTools("notepad");
      if (!mag(state.notepad.aimDir)) {
        state.notepad.aimDir = pt(1, 0);
      }
    }
    finishToolToggle();
  }

  function spawnNotepadWord(word) {
    const origin = notepadCursorPoint();
    const direction = mag(state.notepad.aimDir) ? state.notepad.aimDir : pt(1, 0);
    state.notepad.projectiles.push({
      word: word.toUpperCase(),
      pos: pt(origin.x, origin.y),
      prev: pt(origin.x, origin.y),
      vel: mul(direction, NOTEPAD_PROJECTILE_SPEED),
      age: 0,
      angle: Math.atan2(direction.y, direction.x),
      wobble: rand(0, TAU),
    });

    if (state.notepad.projectiles.length > 16) {
      state.notepad.projectiles.splice(0, state.notepad.projectiles.length - 16);
    }
  }

  function handleNotepadTyping(event) {
    if (!state.notepad.active || event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }

    if (event.key === "Backspace") {
      state.notepad.buffer = state.notepad.buffer.slice(0, -1);
      syncToolUi();
      return true;
    }

    if (event.key === "Escape") {
      toggleNotepad(false);
      return true;
    }

    if (event.key.length !== 1 || !/^[a-z]$/i.test(event.key)) {
      return false;
    }

    state.notepad.buffer += event.key.toLowerCase();
    if (state.notepad.buffer.length >= NOTEPAD_WORD_LENGTH) {
      spawnNotepadWord(state.notepad.buffer.slice(0, NOTEPAD_WORD_LENGTH));
      state.notepad.buffer = state.notepad.buffer.slice(NOTEPAD_WORD_LENGTH);
    }
    syncToolUi();
    return true;
  }

  function updateNotepadProjectiles(dt) {
    state.notepad.pulse += dt * (state.notepad.active ? 7.2 : 3.4);

    compactInPlace(state.notepad.projectiles, (projectile) => {
      projectile.age += dt;
      projectile.prev = pt(projectile.pos.x, projectile.pos.y);
      projectile.pos = add(projectile.pos, mul(projectile.vel, dt));
      projectile.angle = Math.atan2(projectile.vel.y, projectile.vel.x);

      for (let i = state.cargoes.length - 1; i >= 0; i -= 1) {
        const cargo = state.cargoes[i];
        if (!cargo.visible || cargo.dusting || cargo.removed) {
          continue;
        }
        if (!segmentIntersectsRect(projectile.prev, projectile.pos, cargoRect(cargo))) {
          continue;
        }
        spawnFistShards(cargo, projectile.pos);
        removeCargo(cargo.id);
        triggerNearbyCursorChase(pt(cargo.pos.x + cargo.width / 2, cargo.pos.y + cargo.height / 2));
      }

      return (
        projectile.age < NOTEPAD_PROJECTILE_MAX_AGE
        && projectile.pos.x > -180
        && projectile.pos.x < state.width + 180
        && projectile.pos.y > -140
        && projectile.pos.y < state.height + 140
      );
    });
  }

  class NotepadAnimation extends ToolAnimationInterface {
    update(dt) {
      updateNotepadProjectiles(dt);
    }

    drawCursor() {
      drawNotepadCursor();
    }

    drawProjectiles() {
      drawNotepadProjectiles();
    }
  }

  class NotepadTool extends DesktopToggleTool {
    constructor(context) {
      super(context, {
        id: "notepad",
        hotkey: "o",
        animation: new NotepadAnimation(context),
        toggle: toggleNotepad,
      });
    }

    updateAim(movement) {
      updateNotepadAim(movement);
    }

    handleTyping(event) {
      return handleNotepadTyping(event);
    }
  }
