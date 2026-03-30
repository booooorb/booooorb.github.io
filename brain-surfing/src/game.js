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
    };

    const config = window.BrainSurfingConfig || {};
    const DATASETS = config.datasets || {};
    const STAGE_LABELS = config.stageLabelsByDataset || {};
    const ASSETS = config.assets || {};
    const STATUS_SUCCESS = "rgba(0,128,0,0.7)";
    const STATUS_ERROR = "rgba(128,0,0,0.7)";
    const STATUS_NEUTRAL = "rgba(0,0,0,0.6)";

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
        player: image(ASSETS.player),
        background: image(ASSETS.background),
        flipBoard: image(ASSETS.flipBoard),
        flipPenguin: image(ASSETS.flipPenguin),
        glidePenguin: image(ASSETS.glidePenguin),
    };

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
        datasets: DATASETS,
        stageLabels: STAGE_LABELS,
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

    images.background.onload = layout.resizeBackground;
    if (images.background.complete) {
        layout.resizeBackground();
    }

    textInformation.initInfoToggle();

    function resetSignalState(options) {
        const { loading } = options || {};

        state.eegReady = false;
        state.isLoadingEeg = Boolean(loading);
        state.eegValues = [];
        state.eegPhysicalValues = null;
        state.eegPhysicalUnit = "";
        state.eegProbeMeta = null;
        state.eegLength = 0;
        state.eegTime = 0;
        state.lastEEGJson = null;
        state.lastUploadedEdfBuffer = null;
        state.lastUploadedEdfLabels = null;
        state.waveProbeX = null;
        state.terrainProfile = [];
        state.availableChannels = [];
        state.currentHeadSample = 0;
        state.currentWaveAmp = 0;
        textInformation.renderChannelDropdown();
    }

    function applyEegData(data, statusText) {
        state.lastEEGJson = data;
        textInformation.applyEEGData(data);
        state.isLoadingEeg = false;
        restartEntranceAnimation();
        setStatus(
            statusText || `EEG: wave loaded (${state.eegLength} samples @ ${state.eegSampleRate} Hz)`,
            STATUS_SUCCESS
        );
    }

    function loadEEGFromUrl(url) {
        setStatus("EEG: loading...", STATUS_NEUTRAL);
        resetSignalState({ loading: true });
        window.SpikeSystem?.reset?.();

        fetch(url)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data) => {
                applyEegData(data);
            })
            .catch((err) => {
                console.error("Failed to load EEG data:", err);
                state.isLoadingEeg = false;
                setStatus("EEG: failed to load dataset", STATUS_ERROR);
            });
    }

    function parseEdfBuffer(buffer, options) {
        const {
            channelIndex,
            datasetKey = state.datasetKey,
            preferredLabels,
            resetStages = false,
            useEdfStartTime = false,
            statusText = null,
        } = options || {};

        const json = window.BrainSurfingEdf.parseToJson(buffer, {
            channelIndex,
            preferredLabels,
            targetRate: 50,
        });

        state.lastUploadedEdfBuffer = buffer;
        state.lastUploadedEdfLabels = json.channelLabels || null;
        state.currentEdfChannelIndex = Number.isFinite(json.channelIndex)
            ? json.channelIndex
            : state.currentEdfChannelIndex;
        state.datasetKey = datasetKey;

        if (resetStages) {
            window.BrainSurfingStages.reset(state);
        }

        if (useEdfStartTime) {
            state.eegStartOffsetSec = 0;
            state.eegDisplayOffsetSec = Number.isFinite(json.startTimeSec) ? json.startTimeSec : 0;
            state.lastEffectiveTime = state.eegDisplayOffsetSec;
        }

        applyEegData(
            json,
            statusText || `EEG: wave loaded (${json.channelLabel || "channel"})`
        );
    }

    function loadEEGFromEdfUrl(dataset) {
        setStatus("EEG: loading EDF...", STATUS_NEUTRAL);
        resetSignalState({ loading: true });
        window.SpikeSystem?.reset?.();

        fetch(dataset.edfUrl)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.arrayBuffer();
            })
            .then((buffer) => {
                parseEdfBuffer(buffer, {
                    datasetKey: state.datasetKey,
                    preferredLabels: dataset.defaultChannel ? [dataset.defaultChannel] : undefined,
                    resetStages: false,
                    useEdfStartTime: false,
                    statusText: `EEG: original EDF loaded (${dataset.defaultChannel || "channel"}) - hover for original uV magnitude`,
                });
            })
            .catch((err) => {
                console.error("Failed to load EDF data:", err);
                state.isLoadingEeg = false;
                setStatus("EEG: failed to load EDF dataset", STATUS_ERROR);
            });
    }

    function loadStagesFromUrl(url) {
        window.BrainSurfingStages.loadFromUrl(url)
            .then((data) => {
                window.BrainSurfingStages.initFromJson(state, data, state.datasetKey);
            })
            .catch(() => {
                window.BrainSurfingStages.reset(state);
            });
    }

    function loadDataset() {
        const dataset = DATASETS[state.datasetKey];
        if (!dataset) return;

        state.channelName = dataset.defaultChannel || state.channelName;
        state.waveProbeX = null;
        textInformation.syncDatasetButtons();
        textInformation.renderChannelDropdown();

        if (state.datasetKey === "user") {
            resetSignalState({ loading: false });
            window.BrainSurfingStages.reset(state);
            setStatus("EEG: upload an EDF to start", STATUS_NEUTRAL);
            window.SpikeSystem?.reset?.();
            textInformation.updateInfoPanel();
            return;
        }

        window.BrainSurfingStages.reset(state);
        state.eegStartOffsetSec = 0;
        state.eegDisplayOffsetSec = 0;
        state.lastEffectiveTime = 0;

        if (dataset.edfUrl) {
            loadEEGFromEdfUrl(dataset);
        } else if (dataset.eegUrl) {
            loadEEGFromUrl(dataset.eegUrl);
        }

        if (dataset.hasStages && dataset.stagesUrl) {
            loadStagesFromUrl(dataset.stagesUrl);
        }
    }

    function triggerGameOver() {
        const player = state.player;
        if (!player || state.isGameOver) return;

        const spriteCanvas = character.captureSprite();
        const centerX = player.x + constants.playerSize / 2;
        const centerY = player.y + constants.playerSize / 2;

        state.shatterPieces = particles.createShatterPiecesFromSprite(
            spriteCanvas,
            centerX,
            centerY,
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
        state.pressInAir = false;
        state.primaryDown = false;

        if (state.holdTimerId !== null) {
            clearTimeout(state.holdTimerId);
            state.holdTimerId = null;
        }

        player.vy = 0;
        syncGameOverChrome();
        window.BrainSurfingActionSound?.playCrash?.();
        window.BrainSurfingWaveSound?.pause?.();
    }

    function clearHeldInput() {
        state.primaryDown = false;
        state.pressInAir = false;

        if (state.holdTimerId !== null) {
            clearTimeout(state.holdTimerId);
            state.holdTimerId = null;
        }
    }

    function resetGame() {
        character.createPlayer();
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
        clearHeldInput();
        state.scoreRoll.active = false;
        state.scoreRoll.progress = 1;
        state.scoreRoll.fromDigit = "0";
        state.scoreRoll.toDigit = "0";
        state.scoreRoll.lastScoreInt = 0;
        state.scoreFlash = 0;
        restartEntranceAnimation();
        syncGameOverChrome();
        window.SpikeSystem?.reset?.();
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

            if (state.isGameOver) {
                textInformation.drawGameOver(ctx);
            } else {
                textInformation.drawHud(ctx);
            }
        }

        syncGameOverChrome();
    }

    function primaryKey(event) {
        return event.code === "Space" ||
            event.key === " " ||
            event.key === "ArrowUp" ||
            event.key === "w" ||
            event.key === "W";
    }

    function isInteractiveElement(target) {
        return Boolean(target?.closest("button, select, option, input, label, a, summary"));
    }

    function handlePrimaryDown() {
        if (state.isGameOver || state.primaryDown) return;

        state.primaryDown = true;
        window.BrainSurfingWaveSound?.ensure?.();
        window.BrainSurfingActionSound?.ensure?.();

        if (physics.canJumpNow()) {
            physics.jump();
            return;
        }

        if (state.trickLocked) return;

        state.pressInAir = true;
        state.holdTimerId = setTimeout(() => {
            if (!state.pressInAir || state.trickLocked || state.currentTrick || state.isGameOver) return;

            state.currentTrick = "glide";
            state.glideActive = true;
            state.trickLocked = true;
            state.trickTimer = 0;
        }, constants.holdThreshold);
    }

    function handlePrimaryUp() {
        if (!state.primaryDown) return;

        state.primaryDown = false;
        if (state.holdTimerId !== null) {
            clearTimeout(state.holdTimerId);
            state.holdTimerId = null;
        }
        if (state.isGameOver) return;

        if (state.currentTrick === "glide") {
            state.currentTrick = null;
            state.glideActive = false;
            state.pressInAir = false;
            return;
        }

        if (
            state.pressInAir &&
            !state.player.onGround &&
            !state.canCoyoteJump &&
            !state.trickLocked &&
            !state.currentTrick
        ) {
            state.currentTrick = "flip";
            state.trickTimer = 0;
            state.trickLocked = true;
            state.flipAnimTimeLeft = constants.flipDuration * (2 / 3);
            state.score += 1000;
            particles.spawnFloatingText("+1000");
            window.BrainSurfingActionSound?.playFlip?.();
        }

        state.pressInAir = false;
    }

    function parseUploadedEdf(buffer, channelIndex) {
        parseEdfBuffer(buffer, {
            channelIndex,
            datasetKey: "user",
            resetStages: true,
            useEdfStartTime: true,
            statusText: "EEG: user EDF loaded - hover the wave for original uV magnitude",
        });
    }

    function update(dt) {
        if (!state.player || state.isTabPaused) return;

        if (state.isGameOver) {
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
            return;
        }

        if (state.isLoadingEeg) {
            state.loadingSpinAngle += dt * 4.8;
            return;
        }

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

    function loop(timestamp) {
        let dt = (timestamp - state.lastTime) / 1000;
        state.lastTime = timestamp;
        dt = Math.max(0, Math.min(constants.maxDt, dt));
        update(dt);
        draw();
        requestAnimationFrame(loop);
    }

    dom.datasets?.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-dataset]");
        if (!button) return;

        const key = button.getAttribute("data-dataset");
        if (!DATASETS[key]) return;

        state.datasetKey = key;
        loadDataset();
    });

    dom.channels?.addEventListener("change", (event) => {
        const select = event.target.closest("#channel-select");
        if (!select) return;

        if (state.lastUploadedEdfBuffer && state.lastUploadedEdfLabels) {
            const selectedIndex = parseInt(select.value, 10);
            if (state.datasetKey === "user") {
                parseUploadedEdf(state.lastUploadedEdfBuffer, selectedIndex);
            } else {
                parseEdfBuffer(state.lastUploadedEdfBuffer, {
                    channelIndex: selectedIndex,
                    datasetKey: state.datasetKey,
                    resetStages: false,
                    useEdfStartTime: false,
                    statusText: `EEG: original EDF loaded (${DATASETS[state.datasetKey]?.label || "dataset"}) - hover for original uV magnitude`,
                });
            }
            return;
        }

        state.channelName = select.value;
        if (state.lastEEGJson) {
            applyEegData(state.lastEEGJson);
        }
    });

    dom.upload?.addEventListener("change", (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            try {
                parseUploadedEdf(loadEvent.target.result, state.currentEdfChannelIndex);
            } catch (err) {
                console.error("Failed to parse uploaded EDF:", err);
                setStatus("EEG: EDF parse error", STATUS_ERROR);
            } finally {
                dom.upload.value = "";
            }
        };
        reader.readAsArrayBuffer(file);
    });

    canvas.addEventListener("pointermove", layout.setWaveProbeFromPointer);
    canvas.addEventListener("pointerdown", layout.setWaveProbeFromPointer);
    canvas.addEventListener("pointerleave", () => {
        state.waveProbeX = null;
    });

    window.addEventListener("keydown", (event) => {
        if (primaryKey(event)) {
            event.preventDefault();
            handlePrimaryDown();
        }

        if ((event.key === "r" || event.key === "R") && state.isGameOver) {
            resetGame();
        }
    });

    window.addEventListener("keyup", (event) => {
        if (primaryKey(event)) handlePrimaryUp();
    });

    window.addEventListener("pointerdown", (event) => {
        if (isInteractiveElement(event.target)) return;
        event.preventDefault();
        handlePrimaryDown();
    });

    window.addEventListener("pointerup", handlePrimaryUp);
    window.addEventListener("resize", layout.resizeCanvas);
    window.addEventListener("blur", () => {
        state.isTabPaused = true;
        state.lastTime = performance.now();
        clearHeldInput();
        window.BrainSurfingWaveSound?.pause?.();
    });
    window.addEventListener("focus", () => {
        if (document.hidden) return;
        state.isTabPaused = false;
        state.lastTime = performance.now();
    });
    document.addEventListener("visibilitychange", () => {
        state.isTabPaused = document.hidden;
        state.lastTime = performance.now();

        if (document.hidden) {
            clearHeldInput();
            window.BrainSurfingWaveSound?.pause?.();
        }
    });

    layout.resizeCanvas();
    character.createPlayer();
    textInformation.syncDatasetButtons();
    textInformation.updateInfoPanel();
    window.SpikeSystem?.init?.({
        jumpVelocity: constants.jumpVelocity,
        onHit: triggerGameOver,
    });
    restartEntranceAnimation();
    loadDataset();

    requestAnimationFrame((timestamp) => {
        state.lastTime = timestamp;
        loop(timestamp);
    });
})();
