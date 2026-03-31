(function () {
    const canvas = document.getElementById("game-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const viewport = {
        width: canvas.width,
        height: canvas.height,
    };
    const dom = {
        datasets: document.getElementById("dataset-controls"),
        upload: document.getElementById("eeg-upload-input"),
        channels: document.getElementById("channel-controls"),
        status: document.getElementById("eeg-status"),
        info: document.getElementById("eeg-info"),
        infoToggle: document.getElementById("info-toggle"),
        mobileInfoLink: document.getElementById("mobile-info-link"),
    };

    const config = window.BrainSurfingConfig || {};
    const datasets = config.datasets || {};
    const requestedDataset = new URLSearchParams(window.location.search).get("dataset");
    const stageLabels = config.stageLabelsByDataset || {};
    const assets = config.assets || {};
    const statusColors = {
        success: "rgba(0,128,0,0.7)",
        error: "rgba(128,0,0,0.7)",
        neutral: "rgba(0,0,0,0.6)",
    };
    const constants = {
        playerSize: 64,
        gravity: 1600,
        glideGravity: 200,
        jumpVelocity: -640,
        groundMargin: 10,
        topMargin: 20,
        eegScrollSpeed: 5,
        smoothWindow: 25,
        horizontalSampleStep: 0.3,
        ampScale: 1.5,
        scoreSpeed: 30,
        coyoteTime: 0.4,
        holdThreshold: 220,
        flipDuration: 0.5,
        trickFailPenalty: 1500,
        floatTextLifetime: 0.7,
        bgScrollSpeed: 20,
        maxAirTilt: Math.PI / 6,
        maxDt: 0.1,
        scoreRollDuration: 0.28,
        scoreRollOffset: 28,
        scoreFlashDuration: 0.35,
        gameOverFadeDuration: 0.4,
        gameOverFadeDelay: 0.5,
        shatterGravity: 2200,
        shatterBlastSpeed: 440,
        shatterSpinSpeed: 18,
        shatterTileSize: 6,
        shatterSourceSize: 160,
        shatterWindAccel: -420,
    };
    const state = {
        datasetKey: "sleep",
        channelName: null,
        availableChannels: [],
        lastEEGJson: null,
        lastUploadedEdfBuffer: null,
        lastUploadedEdfLabels: null,
        currentEdfChannelIndex: 14,
        eegReady: false,
        eegSampleRate: 0,
        eegValues: [],
        eegPhysicalValues: null,
        eegPhysicalUnit: "",
        eegProbeMeta: null,
        eegLength: 0,
        eegTime: 0,
        eegStartOffsetSec: 11300,
        eegDisplayOffsetSec: 0,
        lastEffectiveTime: 0,
        currentHeadSample: 0,
        currentWaveAmp: 0,
        waveProbeX: null,
        sleepSegments: [],
        sleepIndex: 0,
        currentStageCode: null,
        player: null,
        groundY: 0,
        score: 0,
        isGameOver: false,
        terrainProfile: [],
        particles: [],
        floatingTexts: [],
        coyoteTimer: 0,
        canCoyoteJump: false,
        currentTrick: null,
        trickTimer: 0,
        trickLocked: false,
        flipAnimTimeLeft: 0,
        glideActive: false,
        primaryDown: false,
        pressInAir: false,
        holdTimerId: null,
        lastTime: performance.now(),
        bgScale: 0.25,
        bgScrollX: 0,
        loadingSpinAngle: 0,
        isLoadingEeg: false,
        gameOverFade: 0,
        gameOverTimer: 0,
        shatterPieces: [],
        hidePlayer: false,
        isTabPaused: false,
        scoreRoll: {
            active: false,
            progress: 1,
            fromDigit: "0",
            toDigit: "0",
            lastScoreInt: 0,
        },
        scoreFlash: 0,
    };

    if (requestedDataset && datasets[requestedDataset]) {
        state.datasetKey = requestedDataset;
    }

    function image(src) {
        const img = new Image();
        if (src) img.src = src;
        return img;
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function setStatus(text, background) {
        if (!dom.status) return;
        dom.status.textContent = text;
        if (background) dom.status.style.background = background;
    }

    function restartEntranceAnimation() {
        document.body.classList.remove("scene-enter");
        void document.body.offsetWidth;
        document.body.classList.add("scene-enter");
    }

    function syncGameOverChrome() {
        document.body.classList.toggle("game-over", state.isGameOver);
    }

    const images = {
        player: image(assets.player),
        background: image(assets.background),
        flipBoard: image(assets.flipBoard),
        flipPenguin: image(assets.flipPenguin),
        glidePenguin: image(assets.glidePenguin),
    };

    const resetSpikes = () => window.SpikeSystem?.reset?.();
    const sessionHighScore = new window.SessionHighScore();
    const layout = window.createBrainSurfingLayout({
        canvas,
        ctx,
        viewport,
        state,
        images,
        clamp,
        constants,
    });
    const textInformation = window.createBrainSurfingTextInformation({
        dom,
        state,
        viewport,
        images,
        constants,
        datasets,
        stageLabels,
        sessionHighScore,
    });
    const character = window.createBrainSurfingCharacter({
        state,
        viewport,
        images,
        constants,
    });
    const particles = window.createBrainSurfingParticles({
        state,
        viewport,
        constants,
    });
    const wave = window.createBrainSurfingWave({
        state,
        viewport,
        images,
        clamp,
        constants,
    });
    const physics = window.createBrainSurfingPhysics({
        state,
        viewport,
        constants,
        updateStage: (timeSec) => window.BrainSurfingStages.updateCurrentStage(state, timeSec),
        spawnFloatingText: particles.spawnFloatingText,
        triggerScoreFlash: textInformation.triggerScoreFlash,
        playCrash: () => window.BrainSurfingActionSound?.playCrash?.(),
        updateWaveSound: (onGround, amp01, currentTrick) => {
            window.BrainSurfingWaveSound?.update?.(onGround, amp01, currentTrick);
        },
    });
    const eegManager = window.createBrainSurfingEegManager({
        state,
        datasets,
        textInformation,
        setStatus,
        restartEntranceAnimation,
        statusColors,
        resetSpikes,
    });

    let controls = null;

    function triggerGameOver() {
        const player = state.player;
        if (!player || state.isGameOver) return;

        state.shatterPieces = particles.createShatterPiecesFromSprite(
            character.captureSprite(),
            player.x + constants.playerSize / 2,
            player.y + constants.playerSize / 2,
            72,
            constants.playerSize
        );
        state.isGameOver = true;
        state.hidePlayer = true;
        state.gameOverFade = 0;
        state.gameOverTimer = 0;
        state.currentTrick = null;
        state.trickTimer = 0;
        state.trickLocked = true;
        state.glideActive = false;
        controls?.clearHeldInput?.();
        player.vy = 0;

        syncGameOverChrome();
        window.BrainSurfingActionSound?.playCrash?.();
        window.BrainSurfingWaveSound?.pause?.();
    }

    function resetRunState() {
        state.eegTime = 0;
        state.score = 0;
        state.isGameOver = false;
        state.waveProbeX = null;
        state.sleepIndex = 0;
        state.particles = [];
        state.floatingTexts = [];
        state.currentTrick = null;
        state.trickTimer = 0;
        state.trickLocked = false;
        state.flipAnimTimeLeft = 0;
        state.glideActive = false;
        state.loadingSpinAngle = 0;
        state.isLoadingEeg = false;
        state.gameOverFade = 0;
        state.gameOverTimer = 0;
        state.shatterPieces = [];
        state.hidePlayer = false;
        state.scoreRoll.active = false;
        state.scoreRoll.progress = 1;
        state.scoreRoll.fromDigit = "0";
        state.scoreRoll.toDigit = "0";
        state.scoreRoll.lastScoreInt = 0;
        state.scoreFlash = 0;
        controls?.clearHeldInput?.();
    }

    function resetGame() {
        character.createPlayer();
        resetRunState();
        restartEntranceAnimation();
        syncGameOverChrome();
        resetSpikes();
    }

    function draw() {
        ctx.fillStyle = "#EAE7D9";
        ctx.fillRect(0, 0, viewport.width, viewport.height);

        if (state.isLoadingEeg) {
            textInformation.drawLoadingState(ctx);
        } else {
            wave.drawBackground(ctx);
            wave.drawWave(ctx);
            window.SpikeSystem?.draw?.(ctx, state.terrainProfile);
            character.draw(ctx);
            particles.draw(ctx);
            wave.drawWaveProbe(ctx);
            if (state.isGameOver) textInformation.drawGameOver(ctx);
            else textInformation.drawHud(ctx);
        }

        syncGameOverChrome();
    }

    function updateGameOver(dt) {
        const bgWidth = images.background.width * state.bgScale || 1;
        state.bgScrollX = (state.bgScrollX + constants.bgScrollSpeed * dt) % bgWidth;
        physics.computeTerrain(dt, { trackPlayer: false, updateAudio: false });
        window.SpikeSystem?.update?.(
            dt,
            state.terrainProfile,
            { x: -9999, y: -9999 },
            constants.playerSize,
            viewport.width,
            viewport.height
        );
        particles.update(dt, false);
        particles.updateShatterPieces(dt);
        textInformation.updateScoreRoll(dt);
    }

    function updateActiveRun(dt) {
        state.score += dt * constants.scoreSpeed;

        const bgWidth = images.background.width * state.bgScale || 1;
        state.bgScrollX = (state.bgScrollX + constants.bgScrollSpeed * dt) % bgWidth;

        physics.applyPlayerMotion(dt);
        physics.computeTerrain(dt);
        window.SpikeSystem?.update?.(
            dt,
            state.terrainProfile,
            state.player,
            constants.playerSize,
            viewport.width,
            viewport.height
        );

        if (state.currentTrick) {
            state.trickTimer += dt;

            if (state.currentTrick === "glide") {
                state.score += 400 * dt;
                particles.spawnFloatingText("+5", null, constants.playerSize * 0.9);
            }

            if (state.currentTrick === "flip" && state.trickTimer >= constants.flipDuration) {
                state.currentTrick = null;
                state.trickTimer = 0;
            }
        }

        particles.update(dt);
        physics.updateTilt(dt);

        if (state.player.onGround) {
            state.coyoteTimer = constants.coyoteTime;
            state.canCoyoteJump = true;
        } else if (state.coyoteTimer > 0) {
            state.coyoteTimer -= dt;
            if (state.coyoteTimer <= 0) state.canCoyoteJump = false;
        }

        if (state.flipAnimTimeLeft > 0) {
            state.flipAnimTimeLeft = Math.max(0, state.flipAnimTimeLeft - dt);
        }

        textInformation.updateScoreRoll(dt);
    }

    function update(dt) {
        if (!state.player || state.isTabPaused) return;
        if (state.isGameOver) return updateGameOver(dt);
        if (state.isLoadingEeg) {
            state.loadingSpinAngle += dt * 4.8;
            return;
        }
        updateActiveRun(dt);
    }

    function loop(timestamp) {
        let dt = (timestamp - state.lastTime) / 1000;
        state.lastTime = timestamp;
        dt = Math.max(0, Math.min(constants.maxDt, dt));
        update(dt);
        draw();
        requestAnimationFrame(loop);
    }

    function bindDomEvents() {
        dom.datasets?.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-dataset]");
            if (!button) return;

            const key = button.getAttribute("data-dataset");
            if (!datasets[key]) return;

            state.datasetKey = key;
            eegManager.loadDataset();
        });

        dom.channels?.addEventListener("change", (event) => {
            const select = event.target.closest("#channel-select");
            if (!select) return;
            eegManager.handleChannelSelection(select.value);
        });

        dom.upload?.addEventListener("change", (event) => {
            const file = event.target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                try {
                    eegManager.parseUploadedEdf(loadEvent.target.result, state.currentEdfChannelIndex);
                } catch (err) {
                    console.error("Failed to parse uploaded EDF:", err);
                    setStatus("EEG: EDF parse error", statusColors.error);
                } finally {
                    dom.upload.value = "";
                }
            };
            reader.readAsArrayBuffer(file);
        });

        window.addEventListener("resize", layout.resizeCanvas);
    }

    images.background.onload = layout.resizeBackground;
    if (images.background.complete) {
        layout.resizeBackground();
    }

    textInformation.initInfoToggle();
    controls = window.createBrainSurfingControls({
        state,
        canvas,
        layout,
        physics,
        particles,
        constants,
        onRestart: resetGame,
        ensureWaveSound: () => window.BrainSurfingWaveSound?.ensure?.(),
        ensureActionSound: () => window.BrainSurfingActionSound?.ensure?.(),
        playFlip: () => window.BrainSurfingActionSound?.playFlip?.(),
        pauseWaveSound: () => window.BrainSurfingWaveSound?.pause?.(),
    });

    bindDomEvents();
    controls.bind();
    layout.resizeCanvas();
    character.createPlayer();
    textInformation.syncDatasetButtons();
    textInformation.updateInfoPanel();
    window.SpikeSystem?.init?.({
        jumpVelocity: constants.jumpVelocity,
        onHit: triggerGameOver,
    });
    restartEntranceAnimation();
    eegManager.loadDataset();

    requestAnimationFrame((timestamp) => {
        state.lastTime = timestamp;
        loop(timestamp);
    });
})();
