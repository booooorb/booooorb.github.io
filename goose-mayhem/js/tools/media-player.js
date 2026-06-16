  const MEDIA_PLAYER_SHOCK_DURATION = motionQuery.matches ? 1.08 : 1.48;
  const MEDIA_PLAYER_RESUME_DURATION = motionQuery.matches ? 0.62 : 0.86;
  const MEDIA_PLAYER_FREEZE_DURATION = 8;

  function mediaPlayerOrigin() {
    if (state.desktopApps.mediaPlayer?.owned) {
      const rect = desktopToolIconRect("mediaPlayer");
      return pt(rect.x + rect.width / 2, rect.y + rect.height / 2);
    }
    return pt(state.width / 2, state.height / 2);
  }

  function syncMediaPlayerStageClass() {
    stage?.classList.toggle("stage--time-stop", mediaPlayerFreezeActive());
  }

  function triggerMediaPlayerTimeStop() {
    const media = state.mediaPlayer;
    media.resumeWave = null;
    media.shockwave = {
      origin: mediaPlayerOrigin(),
      age: 0,
      duration: MEDIA_PLAYER_SHOCK_DURATION,
      maxRadius: Math.hypot(state.width, state.height) * 1.05,
      seed: rand(0, TAU),
    };
    media.frozen = true;
    media.freezeStartedAt = state.time;
    media.freezeUntil = state.time + MEDIA_PLAYER_FREEZE_DURATION;
    syncMediaPlayerStageClass();
    syncToolUi();
  }

  function triggerMediaPlayerResumeIndicator(remaining = MEDIA_PLAYER_RESUME_DURATION) {
    state.mediaPlayer.resumeWave = {
      origin: pt(state.width / 2, state.height / 2),
      age: clamp(MEDIA_PLAYER_RESUME_DURATION - remaining, 0, MEDIA_PLAYER_RESUME_DURATION),
      duration: MEDIA_PLAYER_RESUME_DURATION,
      maxRadius: Math.hypot(state.width, state.height) * 1.05,
      seed: rand(0, TAU),
    };
  }

  function mediaPlayerFreezeActive() {
    return !!state.mediaPlayer.frozen && state.time < state.mediaPlayer.freezeUntil;
  }

  function mediaPlayerVisualActive() {
    return !!state.mediaPlayer.shockwave || !!state.mediaPlayer.resumeWave || mediaPlayerFreezeActive();
  }

  function updateMediaPlayer(dt) {
    const media = state.mediaPlayer;
    media.pulse += dt * (mediaPlayerVisualActive() ? 7.8 : 3.2);

    if (media.shockwave) {
      media.shockwave.age += dt;
      if (media.shockwave.age >= media.shockwave.duration) {
        media.shockwave = null;
        syncToolUi();
      }
    }

    if (media.frozen && !media.resumeWave) {
      const remaining = media.freezeUntil - state.time;
      if (remaining > 0 && remaining <= MEDIA_PLAYER_RESUME_DURATION) {
        triggerMediaPlayerResumeIndicator(remaining);
        syncToolUi();
      }
    }

    if (media.resumeWave) {
      media.resumeWave.age += dt;
      if (media.resumeWave.age >= media.resumeWave.duration) {
        media.resumeWave = null;
        syncToolUi();
      }
    }

    if (media.frozen && state.time >= media.freezeUntil) {
      media.frozen = false;
      media.freezeUntil = 0;
      media.freezeStartedAt = 0;
      media.resumeWave = null;
      syncToolUi();
    }
    syncMediaPlayerStageClass();
  }

  class MediaPlayerAnimation extends ToolAnimationInterface {
    update(dt) {
      updateMediaPlayer(dt);
    }
  }

  class MediaPlayerTool extends ToolInterface {
    constructor(context) {
      super(context, {
        id: "mediaPlayer",
        hotkey: "w",
        animation: new MediaPlayerAnimation(context),
      });
    }

    launchFromDesktop() {
      triggerMediaPlayerTimeStop();
    }
  }
