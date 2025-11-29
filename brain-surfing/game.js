(function () {
    const canvas = document.getElementById("game-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const datasetControlsEl = document.getElementById("dataset-controls");
    const uploadInput = document.getElementById("eeg-upload-input");

    const PLAYER_SIZE = 64;
    const GRAVITY = 1600;        // px/s^2
    const JUMP_VELOCITY = -640;  // px/s
    const GROUND_MARGIN = 10;    // distance from bottom to baseline
    const TOP_MARGIN = 20;       // min distance from top for the wave

    const EEG_SCROLL_SPEED = 5.0;
    const SMOOTH_WINDOW = 25;            // moving-average half-window (25 -> 51 samples)
    const HORIZONTAL_SAMPLE_STEP = 0.3;
    const AMP_SCALE = 1.5;

    const playerImg = new Image();
    let playerImgLoaded = false;
    playerImg.src = "character2.png";

    playerImg.onload = () => {
        playerImgLoaded = true;
        console.log("Player image loaded");
    };

    // BACKGROUND IMAGE CONSTANTS
    const BG_SCROLL_SPEED = 20;   // px/sec horizontally (tweak)
    const bgImg = new Image();
    let bgImgLoaded = false;
    let bgScrollX = 0;            // horizontal offset in screen pixels
    let bgScale = 0.25;              // scale so it covers the canvas vertically

    bgImg.src = "background_sky_2.png";   
    bgImg.onload = () => {
        bgImgLoaded = true;
        updateBgScale();
        console.log("Background image loaded");
    };

    let EEG_START_OFFSET_SEC = 11300;

    const MAX_AIR_TILT = Math.PI / 6; // max extra tilt in air (30°)
    const AIR_TILT_SPEED = 4.0;
    const SLOW_TILT_SPEED = 1.5;
    const GLIDE_TILT_SPEED = 0.5;

    const COYOTE_TIME = 0.4; // seconds after leaving ground you can still jump
    let coyoteTimer = 0;
    let canCoyoteJump = false;

    let isGameOver = false;

    // DATASET DEFINITIONS
    const STAGE_LABELS_BY_DATASET = {
        // Sleep staging 
        sleep: {
            W: "Wake",
            N1: "N1 – light sleep",
            N2: "N2 – light sleep",
            N3: "N3 – deep sleep",
            N4: "N4 – deep sleep",
            REM: "REM sleep",
            R: "REM sleep",
        },

        // Seizure Staging
        seizure: {
            SZ: "Seizure",
            NS: "No seizure",
        },

        // User-upload EEG
        user: null,
    };

    const DATASETS = {
        sleep: {
            label: "Sleep (demo)",
            eegUrl: "brainwave_runner_sleep.json",
            stagesUrl: "brainwave_stages_sleep.json",
            hasStages: true,
            channel: "Fpz-Cz",
        },
        seizure: {
            label: "Seizure (demo)",
            eegUrl: "brainwave_runner_seizure.json",
            stagesUrl: "brainwave_stages_seizure.json",
            hasStages: true,
            channel: "Cz",
        },
        user: {
            label: "User upload",
            eegUrl: null,   // loaded from <input type="file">
            stagesUrl: null,
            hasStages: false,
            channel: null,
        },
    };

    let currentDatasetKey = "sleep";


    const statusEl = document.getElementById("eeg-status");
    const infoEl = document.getElementById("eeg-info");

    const infoToggle = document.getElementById("info-toggle");
    if (infoToggle && infoEl) {
        infoToggle.addEventListener("click", () => {
            const collapsed = infoEl.classList.toggle("collapsed");
            infoToggle.textContent = collapsed ? "EEG info ▸" : "EEG info ▾";
        });
    }


    // World state
    let groundY;
    let player;
    let lastTime = performance.now();
    let worldTime = 0;
    let currentWaveAmp = 0;

    let score = 0;
    const SCORE_SPEED = 30;

    let terrainProfile = [];
    let waveTopY = 0;

    const TERRAIN_LAUNCH_WINDOW = 0.2; // seconds to look back
    const TERRAIN_LAUNCH_MIN_RISE = 45; // pixels "up" needed to trigger 
    let launchBaselineY = null;
    let launchBaselineTime = 0;
    let wasOnGround = false;

    // EEG data
    let eegReady = false;
    let eegSampleRate = 0;
    let eegValues = [];  // normalized [-1,1]
    let eegLength = 0;
    let eegTime = 0;     // seconds since game start (no offset)
    let lastEffectiveTime = 0; // EEG time (EDF seconds from recording start)

    // Sleep stage data
    let sleepSegments = [];       // [{t, stage}]
    let sleepIndex = 0;
    let currentStageCode = null;

    let particles = [];

    // --- TRICK CONSTANTS ---
    const FLIP_DURATION = 0.5;          // seconds, single tap
    const GLIDE_GRAVITY = 200;          // slower fall during glide
    const TRICK_FAIL_PENALTY = 1500;
    const DOUBLE_TAP_WINDOW = 220;      // ms
    const HOLD_THRESHOLD = 220;         // ms before press counts as hold

    // Air trick state
    let currentTrick = null;        // 'flip' | 'glide' | null
    let trickTimer = 0;
    let trickDuration = 0;
    let trickLocked = false;        // true after any trick until landing
    let flipAnimTimeLeft = 0;       // >0 → play flip animation


    // Tap / hold detection for tricks
    let tapPending = false;
    let tapTimeoutId = null;
    let lastTapTimeMs = 0;
    let primaryDown = false;
    let pressInAir = false;
    let holdTimerId = null;
    let glideActive = false;

    const FLOAT_TEXT_LIFETIME = 0.7; // seconds
    let floatingTexts = [];          // {x, y, vy, life, maxLife, text, color}

    const SPIKE_BASE_WIDTH = 20;          // width of the triangle base in px
    const SPIKE_HEIGHT = 45;              // spike height in px
    const SPIKE_SPEED = 340;              // how fast spikes move left (px/s)

    const SPIKE_INTERVAL_START = 4.0;     // seconds between spikes at t=0
    const SPIKE_INTERVAL_MIN = 0.8;       // smallest interval (cap on frequency)
    const SPIKE_RAMP_DURATION = 10;      // seconds until we reach min interval

    let spikes = [];                      // each: { x }
    let spikeTimer = SPIKE_INTERVAL_START;

    const BOAT_BASE_SCALE = 0.25;

    const BOAT_CONFIGS = [
        { src: "boat1.png", scale: 1 },
        { src: "boat2.png", scale: 1 },
        { src: "boat3.png", scale: 1 },
        { src: "boat4.png", scale: 1 },
        { src: "boat5.png", scale: 1 },
        { src: "boat6.png", scale: 1 },
    ];

    // Load images
    for (const cfg of BOAT_CONFIGS) {
        const img = new Image();
        img.src = cfg.src;
        cfg.img = img;
    }



    // UTILS
    function formatClock(tSec) {
        const day = 24 * 3600;
        let t = ((tSec % day) + day) % day;
        const h = Math.floor(t / 3600);
        t -= h * 3600;
        const m = Math.floor(t / 60);
        const s = Math.floor(t - m * 60);
        const pad = (x) => (x < 10 ? "0" + x : "" + x);
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }

    function stagePretty(code) {
        const conf = DATASETS[currentDatasetKey];

        if (!conf || !conf.hasStages || !code) {
            return "No stage data";
        }

        const labels = STAGE_LABELS_BY_DATASET[currentDatasetKey];

        if (!labels) return code;

        return labels[code] || code;
    }

    function updateBgScale() {
        if (!bgImgLoaded || !canvas.height) return;
        const targetHeight = canvas.height;
        // bgScale = targetHeight / bgImg.height;
    }

    // images for tricks
    const flipBoardImg = new Image();
    let flipBoardLoaded = false;
    flipBoardImg.src = "flip1_p.png";
    flipBoardImg.onload = () => {
        flipBoardLoaded = true;
        console.log("Flip board image loaded");
    };

    const flipPenguinImg = new Image();
    let flipPenguinLoaded = false;
    flipPenguinImg.src = "flip1_b.png";
    flipPenguinImg.onload = () => {
        flipPenguinLoaded = true;
        console.log("Flip penguin image loaded");
    };

    const glidePenguinImg = new Image();
    let glidePenguinLoaded = false;
    glidePenguinImg.src = "glide_p.png";
    glidePenguinImg.onload = () => {
        glidePenguinLoaded = true;
        console.log("Glide penguin image loaded");
    };

    function startFlipTrick() {
        if (trickLocked || currentTrick) return;
        currentTrick = "flip";
        trickTimer = 0;
        trickDuration = FLIP_DURATION;
        trickLocked = true;
        score += 1000;
        if (window.SurfAudio && SurfAudio.playFlip) {
            SurfAudio.playFlip();
        }
        flipAnimTimeLeft = FLIP_DURATION * 2 / 3;

        const cx = player.x + PLAYER_SIZE / 2;
        const cy = player.y + PLAYER_SIZE / 2 - PLAYER_SIZE * 0.35;

        const radius = PLAYER_SIZE * 0.3;
        const theta = Math.random() * Math.PI * 2;
        const r = radius * Math.random();

        const worldX = cx + r * Math.cos(theta);
        const worldY = cy + r * Math.sin(theta);

        floatingTexts.push({
            x: worldX,
            y: worldY,
            vy: -60,                   // pixels/sec upward
            life: FLOAT_TEXT_LIFETIME,
            maxLife: FLOAT_TEXT_LIFETIME,
            text: "+1000",
        });
    }



    function startGlideTrick() {
        if (trickLocked || currentTrick || !player || player.onGround) return;
        currentTrick = "glide";
        trickTimer = 0;
        trickDuration = 0;
        trickLocked = true;
        glideActive = true;
    }

    function endGlideTrick() {
        glideActive = false;
        currentTrick = null;
        trickTimer = 0;
        trickDuration = 0;
        // trickLocked stays true until landing (only one trick per jump)
    }

    function resetTrickStateOnLanding() {
        // penalty if landing before flip
        if (currentTrick === "flip" || currentTrick === "glide") {
            if (trickTimer < trickDuration || glideActive === true) {
                score -= TRICK_FAIL_PENALTY;
                if (score < 0) score = 0;
                if (window.SurfAudio && SurfAudio.playCrash) {
                    SurfAudio.playCrash();
                }

                const cx = player.x + PLAYER_SIZE / 2;
                const cy = player.y + PLAYER_SIZE / 2 - PLAYER_SIZE * 0.35; // near penguin (same offset as drawing)

                const radius = PLAYER_SIZE * 0.3;
                const theta = Math.random() * Math.PI * 2;
                const r = radius * Math.random();

                const worldX = cx + r * Math.cos(theta);
                const worldY = cy + r * Math.sin(theta);

                floatingTexts.push({
                    x: worldX,
                    y: worldY,
                    vy: -60,                   // pixels/sec upward
                    life: FLOAT_TEXT_LIFETIME,
                    maxLife: FLOAT_TEXT_LIFETIME,
                    text: "-1500",
                    color: "red",
                });
            }
        }


        currentTrick = null;
        trickTimer = 0;
        trickDuration = 0;
        trickLocked = false;
        tapPending = false;
        if (tapTimeoutId !== null) {
            clearTimeout(tapTimeoutId);
            tapTimeoutId = null;
        }
        pressInAir = false;
        glideActive = false;
    }

    function handleAirTap() {
        if (trickLocked || currentTrick === "glide") return;
        startFlipTrick();
    }


    function initEEGFromJson(data) {
        eegSampleRate = data.sampleRate || 50;
        const raw = Array.isArray(data.values) ? data.values : [];

        if (!raw.length) throw new Error("JSON has empty values array");

        // Normalize to [-1, 1]
        let maxAbs = 0;
        for (let i = 0; i < raw.length; i++) {
            const v = Math.abs(raw[i]);
            if (v > maxAbs) maxAbs = v;
        }
        if (maxAbs === 0) throw new Error("All EEG samples are zero");

        eegValues = raw.map((v) => v / maxAbs);
        eegLength = eegValues.length;
        eegReady = true;

        statusEl.textContent =
            "EEG: wave loaded (" + eegLength + " samples @ " + eegSampleRate + " Hz)";
        statusEl.style.background = "rgba(0,128,0,0.7)";

        const smoothSamples = SMOOTH_WINDOW * 2 + 1;
        const smoothSec = (smoothSamples / eegSampleRate).toFixed(2);
        infoEl.innerHTML = [
            "EEG processing:",
            "- EEG data normalized to be between [-1, 1]",
            `- One sample is taken every ${smoothSamples} data points for smoothing (one sample every ~${smoothSec}s at ${eegSampleRate}Hz)`,
            " (does not accurately represent fast activity such as spindles or sharp K-complexes)",
            `- amplitude scale: ×${AMP_SCALE}, clipped to fit canvas`,
            `- horizontal stretch: ${HORIZONTAL_SAMPLE_STEP} samples/px`,
            `- scroll speed: ${EEG_SCROLL_SPEED}× real time`,
        ].join("<br>");

        console.log("EEG data loaded:", eegLength, "samples at", eegSampleRate, "Hz");
    }

    function loadEEGFromUrl(url) {
        statusEl.textContent = "EEG: loading…";
        statusEl.style.background = "rgba(0,0,0,0.6)";
        eegReady = false;

        fetch(url)
            .then((res) => {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.json();
            })
            .then((data) => {
                initEEGFromJson(data);
            })
            .catch((err) => {
                console.error("Failed to load/normalize EEG data:", err);
                statusEl.textContent = "EEG: FAILED, using fake sine wave";
                statusEl.style.background = "rgba(128,0,0,0.7)";
                eegReady = false;
            });
    }

    // LOAD SLEEP STAGES
    function initStagesFromJson(data) {
        const segs = Array.isArray(data.segments) ? data.segments : [];
        if (!segs.length) {
            console.warn("No segments in stages JSON");
            sleepSegments = [];
            currentStageCode = null;
            return;
        }

        sleepSegments = segs
            .filter((s) => typeof s.t === "number" && typeof s.stage === "string")
            .sort((a, b) => a.t - b.t);

        sleepIndex = 0;
        currentStageCode = sleepSegments[0].stage;

        console.log("Loaded", sleepSegments.length, "sleep stage segments.");

        // Choose starting point: first N1, or first non-W, or 0
        const firstN1 = sleepSegments.find((s) => s.stage === "N1");
        const firstNonW = sleepSegments.find((s) => s.stage !== "W");

        if (firstN1) {
            EEG_START_OFFSET_SEC = firstN1.t;
        } else if (firstNonW) {
            EEG_START_OFFSET_SEC = firstNonW.t;
        } else {
            EEG_START_OFFSET_SEC = 0;
        }

        if (currentDatasetKey == "seizure") {
            EEG_START_OFFSET_SEC = 300;
        }

        console.log("EEG_START_OFFSET_SEC set to", EEG_START_OFFSET_SEC, "seconds");

        sleepIndex = 0;
        updateSleepStageForTime(EEG_START_OFFSET_SEC);
        lastEffectiveTime = EEG_START_OFFSET_SEC;
    }

    function loadStagesFromUrl(url) {
        fetch(url)
            .then((res) => {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.json();
            })
            .then((data) => {
                initStagesFromJson(data);
            })
            .catch((err) => {
                console.warn("Failed to load sleep stages JSON:", err);
                sleepSegments = [];
                currentStageCode = null;
            });
    }

    function loadDataset() {
        const conf = DATASETS[currentDatasetKey];
        if (!conf) return;

        console.log("Loading dataset:", currentDatasetKey, conf.label);

        if (conf.eegUrl) {
            loadEEGFromUrl(conf.eegUrl);
        }

        if (conf.hasStages && conf.stagesUrl) {
            loadStagesFromUrl(conf.stagesUrl);
        } else {
            sleepSegments = [];
            currentStageCode = null;
        }
    }

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        groundY = canvas.height - GROUND_MARGIN;

        updateBgScale();
    }

    function createPlayer() {
        player = {
            x: canvas.width / 2 - PLAYER_SIZE / 2,
            y: groundY - PLAYER_SIZE,
            vy: 0,
            onGround: false,
            angle: 0,
            airBaseAngle: 0,
        };
    }

    function resetGame() {
        createPlayer();
        eegTime = 0;
        sleepIndex = 0;
        score = 0;

        // reset spike system
        spikes = [];
        spikeTimer = SPIKE_INTERVAL_START;
        worldTime = 0;
        isGameOver = false;
    }

    function getBoatDrawSize(cfg) {
        const img = cfg.img;
        const naturalW = (img && img.naturalWidth) ? img.naturalWidth : 32;
        const naturalH = (img && img.naturalHeight) ? img.naturalHeight : 32;

        const base = BOAT_BASE_SCALE;
        const perBoat = (cfg.scale != null ? cfg.scale : 1.0);
        const s = base * perBoat;

        const drawW = naturalW * s;
        const drawH = naturalH * s;
        return { drawW, drawH };
    }

    // SLEEP STAGE LOOKUP
    function updateSleepStageForTime(tSec) {
        if (!sleepSegments.length) {
            currentStageCode = null;
            return;
        }

        while (
            sleepIndex + 1 < sleepSegments.length &&
            tSec >= sleepSegments[sleepIndex + 1].t
        ) {
            sleepIndex++;
        }

        currentStageCode = sleepSegments[sleepIndex].stage;
    }

    function sampleEEG(index) {
        if (eegReady && eegLength > 0) {
            let sum = 0;
            let count = 0;
            const win = SMOOTH_WINDOW;

            for (let k = -win; k <= win; k++) {
                let j = index + k;
                j %= eegLength;
                if (j < 0) j += eegLength;
                sum += eegValues[j];
                count++;
            }
            return sum / count; // smoothed signed value in [-1,1]
        } else {
            if (eegSampleRate === 0) eegSampleRate = 50;
            const t = index / eegSampleRate;
            return Math.sin(t * 2 * Math.PI * 0.5);
        }
    }

    function computeTerrainAndCollide(dt) {
        const w = canvas.width;
        const baselineY = groundY;

        if (eegSampleRate === 0) eegSampleRate = 50;

        // previous grounded state (for landing / launch logic)
        wasOnGround = player.onGround;

        // Advance EEG time and look up sleep stage
        eegTime += dt * EEG_SCROLL_SPEED;
        const effectiveTime = eegTime + EEG_START_OFFSET_SEC;
        lastEffectiveTime = effectiveTime;
        updateSleepStageForTime(effectiveTime);

        const headSample = Math.floor(effectiveTime * eegSampleRate);
        const maxWaveHeight = baselineY - TOP_MARGIN;
        const playerCenterX = player.x + PLAYER_SIZE / 2;

        terrainProfile = new Array(w);
        let ampAtPlayer = 0;

        // Build the terrain profile only (no drawing here)
        for (let x = 0; x < w; x++) {
            const samplesBehindHead = w - 1 - x;
            const sampleOffset = samplesBehindHead * HORIZONTAL_SAMPLE_STEP;
            const sampleIndex = Math.round(headSample - sampleOffset);

            const v = sampleEEG(sampleIndex); // [-1, 1]
            let amp01 = (v + 1) / 2;
            amp01 = Math.min(1, Math.max(0, amp01 * AMP_SCALE)); // [0,1]

            let waveY = baselineY - amp01 * maxWaveHeight;
            if (waveY < TOP_MARGIN) waveY = TOP_MARGIN;

            terrainProfile[x] = waveY;

            // use center point only for audio amplitude
            if (Math.abs(x - playerCenterX) < 1) {
                ampAtPlayer = amp01;
            }
        }

        // COLLISION WITH WAVE: check whole board width, only when falling
        const playerBottom = player.y + PLAYER_SIZE;
        const GROUND_EPS = 4; // small tolerance

        let contactY = null;
        if (terrainProfile && terrainProfile.length > 0) {
            const left = Math.max(0, Math.floor(player.x));
            const right = Math.min(
                terrainProfile.length - 1,
                Math.ceil(player.x + PLAYER_SIZE)
            );

            for (let ix = left; ix <= right; ix++) {
                const y = terrainProfile[ix];
                if (y == null) continue;
                // highest (smallest y) wave point under the board
                if (contactY === null || y < contactY) {
                    contactY = y;
                }
            }
        }

        if (
            contactY !== null &&
            playerBottom >= contactY - GROUND_EPS &&
            player.vy >= 0              // ⬅ only land when not moving upward
        ) {
            if (playerBottom > contactY) {
                player.y = contactY - PLAYER_SIZE;
            }
            player.vy = 0;
            player.onGround = true;
        } else {
            player.onGround = false;
        }

        // ROTATION TO MATCH FLOOR WHEN ON GROUND
        const idx = Math.round(playerCenterX);
        if (player.onGround && idx >= 0 && idx < terrainProfile.length) {
            const leftIdx = Math.max(0, idx - 2);
            const rightIdx = Math.min(terrainProfile.length - 1, idx + 2);
            const yL = terrainProfile[leftIdx];
            const yR = terrainProfile[rightIdx];

            if (yL != null && yR != null) {
                const dx = rightIdx - leftIdx || 1;
                const dy = yR - yL;
                const targetAngle = Math.atan2(dy, dx);

                if (Number.isFinite(targetAngle)) {
                    const blend = 0.25;
                    const current = player.angle || 0;
                    const newAngle = current + (targetAngle - current) * blend;

                    player.angle = newAngle;
                    player.airBaseAngle = newAngle;
                }
            }
        }

        // TERRAIN-BASED AUTO-LAUNCH
        /*
        if (player.onGround) {
            if (!wasOnGround) {
                launchBaselineY = player.y;
                launchBaselineTime = worldTime;
            } else {
                const dtSince = worldTime - launchBaselineTime;
                const rise = launchBaselineY - player.y;

                if (
                    dtSince <= TERRAIN_LAUNCH_WINDOW &&
                    rise >= TERRAIN_LAUNCH_MIN_RISE
                ) {
                    // launch off steep slope
                    player.onGround = false;

                    const BOOST = 0.6;
                    player.vy = JUMP_VELOCITY * BOOST;

                    const JUMP_TILT = 0.03;
                    player.airBaseAngle = player.angle + JUMP_TILT;
                    player.angle = player.airBaseAngle;

                    launchBaselineY = player.y;
                    launchBaselineTime = worldTime;
                } else if (dtSince > TERRAIN_LAUNCH_WINDOW) {
                    launchBaselineY = player.y;
                    launchBaselineTime = worldTime;
                }
            }
        } */

        // detect real landings (air → ground)
        if (!wasOnGround && player.onGround) {
            resetTrickStateOnLanding();
        }

        currentWaveAmp = ampAtPlayer;
        if (window.SurfAudio && typeof SurfAudio.update === "function") {
            SurfAudio.update(player.onGround, currentWaveAmp, currentTrick);
        }
    }

    function spawnSpike() {
        if (!canvas) return;

        // Pick a random boat config
        const boatIndex = Math.floor(Math.random() * BOAT_CONFIGS.length);
        const cfg = BOAT_CONFIGS[boatIndex];

        const { drawW } = getBoatDrawSize(cfg);

        const spawnX = canvas.width + drawW;

        spikes.push({
            x: spawnX,
            boatIndex,
        });
    }

    function handleSpikeHit() {
        if (isGameOver) return;
        isGameOver = true;

        if (window.SurfAudio) {
            if (SurfAudio.playCrash) {
                SurfAudio.playCrash();
            }
            // Stop all ongoing game sounds (wind, tone, etc.)
            if (SurfAudio.pause) {
                SurfAudio.pause();
            }
        }
    }

    function updateSpikes(dt) {
        if (!terrainProfile || terrainProfile.length === 0 || !player) return;

        // SPAWN + TIMING
        spikeTimer -= dt;
        while (spikeTimer <= 0) {
            spawnSpike();

            const t = Math.min(worldTime, SPIKE_RAMP_DURATION);
            const alpha = SPIKE_RAMP_DURATION > 0 ? t / SPIKE_RAMP_DURATION : 1;

            // Base interval from ramp
            const baseInterval =
                SPIKE_INTERVAL_START -
                (SPIKE_INTERVAL_START - SPIKE_INTERVAL_MIN) * alpha;

            // Very wide random jitter around the base interval
            const jitterFactor = 0.2 + Math.random() * 2.8;  // 0.2–3.0×
            let interval = baseInterval * jitterFactor;

            // Never go below the hard minimum
            if (interval < SPIKE_INTERVAL_MIN) {
                interval = SPIKE_INTERVAL_MIN;
            }

            spikeTimer += interval;
        }

        // MOVEMENT COLLISION

        const sampleY = player.y + PLAYER_SIZE * 0.9; 
        const samplePoints = [
            { x: player.x + PLAYER_SIZE * 0.25, y: sampleY },
            { x: player.x + PLAYER_SIZE * 0.5,  y: sampleY },
            { x: player.x + PLAYER_SIZE * 0.75, y: sampleY },
        ];

        for (let i = spikes.length - 1; i >= 0; i--) {
            const s = spikes[i];

            s.x -= SPIKE_SPEED * dt;

            // Remove boats that have left the screen
            if (s.x < -200) {
                spikes.splice(i, 1);
                continue;
            }

            const cfg = BOAT_CONFIGS[s.boatIndex];
            if (!cfg) continue;

            const idx = Math.max(
                0,
                Math.min(terrainProfile.length - 1, Math.round(s.x))
            );
            const baseY = terrainProfile[idx];
            if (baseY == null) continue;

            // Get draw size based on image dimensions + scale
            const { drawW, drawH } = getBoatDrawSize(cfg);

            const left = s.x - drawW / 2;
            const right = s.x + drawW / 2;
            const top = baseY - drawH;
            const bottom = baseY;

            const hitLeft   = left   + drawW * 0.10;
            const hitRight  = right  - drawW * 0.10;
            const hitTop    = top    + drawH * 0.15;
            const hitBottom = bottom;          

            for (const p of samplePoints) {
                if (
                    p.x >= hitLeft &&
                    p.x <= hitRight &&
                    p.y >= hitTop &&
                    p.y <= hitBottom
                ) {
                    handleSpikeHit();
                    return; // stop after first hit
                }
            }
        }
    }

    function drawSpikes() {
        if (!terrainProfile || terrainProfile.length === 0) return;
        if (!spikes.length) return;

        ctx.save();
        ctx.imageSmoothingEnabled = false; // keep pixel art crisp

        for (const s of spikes) {
            const cfg = BOAT_CONFIGS[s.boatIndex];
            const img = cfg && cfg.img;
            if (!cfg || !img) continue;

            const idx = Math.max(
                0,
                Math.min(terrainProfile.length - 1, Math.round(s.x))
            );
            const baseY = terrainProfile[idx];
            if (baseY == null) continue;

            const { drawW, drawH } = getBoatDrawSize(cfg);

            const left = s.x - drawW / 2;
            const top = baseY - drawH;   // bottom of boat touches wave

            if (img.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, left, top, drawW, drawH);
            } else {
                // Fallback: debug rectangle if image not yet loaded
                ctx.fillStyle = "#000000";
                ctx.fillRect(left, top, drawW, drawH);
            }
        }

        ctx.restore();
    }

    function renderWave() {
        const w = canvas.width;
        if (!terrainProfile || terrainProfile.length !== w) return;

        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.imageSmoothingEnabled = true;

        for (let x = 0; x < w; x++) {
            const waveY = terrainProfile[x];
            if (waveY == null) continue;
            if (x === 0) {
                ctx.moveTo(x + 0.5, waveY + 0.5);
            } else {
                ctx.lineTo(x + 0.5, waveY + 0.5);
            }
        }

        ctx.strokeStyle = "#000000ff";
        ctx.stroke();
    }




    // PHYSICS & GAME LOGIC
    function update(dt) {
        if (!player || isGameOver) return;

        score += dt * SCORE_SPEED;

        // Update wave geometry + collisions

        // Scroll the sky background
        if (bgImgLoaded) {
            const tileW = bgImg.width * bgScale || 1;
            bgScrollX = (bgScrollX + BG_SCROLL_SPEED * dt) % tileW;
        }


        // Gravity (slower while gliding)
        const g = currentTrick === "glide" ? GLIDE_GRAVITY : GRAVITY;
        if (currentTrick === "glide") {
            player.vy = 80;
        }
        player.vy += g * dt;
        player.y += player.vy * dt;
        if (currentTrick === "glide" && player.vy < 0) {
            endGlideTrick();
        }

        computeTerrainAndCollide(dt);
        updateSpikes(dt);

        // Trick timing + glide scoring
        if (currentTrick) {
            trickTimer += dt;
            if (currentTrick === "glide") {
                score += 400 * dt;

                const cx = player.x + PLAYER_SIZE / 2;
                const cy = player.y + PLAYER_SIZE / 2 - PLAYER_SIZE * 0.35;

                const radius = PLAYER_SIZE * 0.9;
                const theta = Math.random() * Math.PI * 2;
                const r = radius * Math.random();

                const worldX = cx + r * Math.cos(theta);
                const worldY = cy + r * Math.sin(theta);

                floatingTexts.push({
                    x: worldX,
                    y: worldY,
                    vy: -60,
                    life: FLOAT_TEXT_LIFETIME,
                    maxLife: FLOAT_TEXT_LIFETIME,
                    text: "+5",
                });
            }

            if (
                (currentTrick === "flip") &&
                trickTimer >= trickDuration &&
                trickDuration > 0
            ) {
                currentTrick = null;
                trickTimer = 0;
                trickDuration = 0;
            }
        }




        // SURF TRAIL PARTICLES
        if (player.onGround) {
            const EMIT_RATE = 5; // how many particles per frame

            for (let i = 0; i < EMIT_RATE; i++) {
                particles.push({
                    x: player.x + PLAYER_SIZE * 0.25 + (Math.random() * 4 - 2),
                    y: player.y + PLAYER_SIZE - 2 + (Math.random() * 4 - 2),

                    vx: - (120 + Math.random() * 80),  // 120–200 px/s left
                    vy: - (40 + Math.random() * 40),   // -40 to -80 px/s

                    life: 0.4 + Math.random() * 0.3,   // seconds
                    size: 2 + Math.random() * 2,       // 2–4 px
                });
            }
        }

        // Update particle positions & lifetimes
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];

            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 250 * dt;

            p.life -= dt;
            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }

        for (let i = floatingTexts.length - 1; i >= 0; i--) {
            const ft = floatingTexts[i];
            ft.life -= dt;
            ft.y += ft.vy * dt;

            if (ft.life <= 0) {
                floatingTexts.splice(i, 1);
            }
        }


        // Air tilt
        if (!player.onGround) {
            const targetOffset = (player.vy < 0) ? -MAX_AIR_TILT : MAX_AIR_TILT;
            const currentOffset = player.angle - player.airBaseAngle;
            let newOffset = 0;
            if (glideActive === true) {
                newOffset = currentOffset + (targetOffset - currentOffset) * GLIDE_TILT_SPEED * dt;
            } else if (player.angle < Math.PI / 12) {
                newOffset = currentOffset + (targetOffset - currentOffset) * AIR_TILT_SPEED * dt;
            } else {
                newOffset = currentOffset + (targetOffset - currentOffset) * SLOW_TILT_SPEED * dt;
            }
            player.angle = player.airBaseAngle + newOffset;
        }

        // Coyote time
        if (player.onGround) {
            coyoteTimer = COYOTE_TIME;
            canCoyoteJump = true;
        } else if (coyoteTimer > 0) {
            coyoteTimer -= dt;
            if (coyoteTimer <= 0) {
                canCoyoteJump = false;
            }
        }

        if (flipAnimTimeLeft > 0) {
            flipAnimTimeLeft -= dt;
            if (flipAnimTimeLeft < 0) flipAnimTimeLeft = 0;
        }
    }

    function drawBackgroundAboveWave() {
        if (!bgImgLoaded || !terrainProfile || terrainProfile.length === 0) return;

        const w = canvas.width;

        ctx.save();

        // Clip region = everything ABOVE the wave polyline
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(w, 0);
        for (let x = w - 1; x >= 0; x--) {
            const waveY = terrainProfile[x];
            if (waveY == null) continue;
            ctx.lineTo(x + 0.5, waveY + 0.5);
        }
        ctx.closePath();
        ctx.clip();

        ctx.imageSmoothingEnabled = true;
        ctx.globalAlpha = 0.35;   // background transparency

        const imgW = bgImg.width * bgScale;
        const imgH = bgImg.height * bgScale;

        // Scroll horizontally
        let startX = -bgScrollX;
        while (startX > 0) startX -= imgW;

        for (let x = startX; x < w; x += imgW) {
            ctx.drawImage(bgImg, x, 0, imgW, imgH);
        }

        ctx.restore();
    }

    // RENDER
    function draw(dt) {
        const w = canvas.width;
        const h = canvas.height;

        ctx.fillStyle = "#EAE7D9";
        ctx.fillRect(0, 0, w, h);

        // First paint clouds, but ONLY in the region above the wave curve
        drawBackgroundAboveWave();

        // Then draw the wave line itself on top
        renderWave();

        drawSpikes();

        // player
        const cx = player.x + PLAYER_SIZE / 2;
        const cy = player.y + PLAYER_SIZE / 2;
        const angle = player.angle || 0;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        const isFlipAnimating =
            flipAnimTimeLeft > 0 &&
            flipBoardLoaded &&
            flipPenguinLoaded;

        const isGlideAnimating =
            glideActive &&
            glidePenguinLoaded;

        if (isGlideAnimating) {
            ctx.drawImage(
                glidePenguinImg,
                -PLAYER_SIZE / 2,
                -PLAYER_SIZE / 2 - 30,
                PLAYER_SIZE + 10,
                PLAYER_SIZE + 23,
            );

        } else if (isFlipAnimating) {
            ctx.drawImage(
                flipBoardImg,
                -PLAYER_SIZE / 2,
                -PLAYER_SIZE / 2,
                PLAYER_SIZE,
                PLAYER_SIZE
            );

            ctx.save();

            const PENGUIN_OFFSET = PLAYER_SIZE * 0.35; // tweak height above board
            ctx.translate(0, -PENGUIN_OFFSET);

            // Make the penguin spin over the time window
            const phase = 1 - (flipAnimTimeLeft / FLIP_DURATION);
            const spinAngle = phase * 4 * Math.PI;

            ctx.rotate(spinAngle);

            ctx.drawImage(
                flipPenguinImg,
                -PLAYER_SIZE / 2,
                -PLAYER_SIZE / 2,
                PLAYER_SIZE,
                PLAYER_SIZE
            );

            ctx.restore();
        } else if (playerImgLoaded) {
            ctx.drawImage(
                playerImg,
                -PLAYER_SIZE / 2,
                -PLAYER_SIZE / 2,
                PLAYER_SIZE,
                PLAYER_SIZE
            );
        } else {
            // Fallback
            ctx.fillStyle = "#000000";
            ctx.fillRect(
                -PLAYER_SIZE / 2,
                -PLAYER_SIZE / 2,
                PLAYER_SIZE,
                PLAYER_SIZE
            );
        }
        ctx.restore();

        // Surf trail particles
        ctx.save();
        ctx.globalAlpha = 0.35; // trannsparency for particles
        ctx.fillStyle = "#000000";

        for (const p of particles) {
            ctx.fillRect(p.x, p.y, p.size, p.size);
        }

        ctx.restore();

        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "20px Liberation Mono, Courier, system-ui, sans-serif";

        for (const ft of floatingTexts) {
            const alpha = Math.max(ft.life / ft.maxLife, 0); // fade out
            ctx.globalAlpha = alpha;
            if (ft.color == "red") {
                ctx.fillStyle = "#a10000ff";
            } else {
                ctx.fillStyle = "#000000";
            }
            ctx.fillText(ft.text, ft.x, ft.y);
        }

        ctx.restore();


        if (!isGameOver) {
            // HUD (only when alive)
            const conf = DATASETS[currentDatasetKey];
            let stageText = "";

            if (conf && conf.hasStages) {
                stageText = "Stage: " + stagePretty(currentStageCode);
            }
            const timeText = "EDF time: " + formatClock(lastEffectiveTime);
            const channelText = "Channel: " + (conf && conf.channel ? conf.channel : "N/A");

            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            ctx.font = "20px 'Courier New', monospace";
            ctx.fillStyle = "#000000";
            ctx.fillText(stageText, w / 2, h * 0.39 + 50);

            ctx.font = "16px 'Courier New', monospace";
            ctx.fillText(timeText, w / 2, h * 0.39 + 50 + 20);

            ctx.font = "16px 'Courier New', monospace";
            ctx.fillText(channelText, w / 2, h * 0.39 + 50 + 40);
            ctx.restore();

            // BIG CENTER SCORE watermark
            const scoreText = Math.floor(score).toString();
            ctx.save();
            ctx.globalAlpha = 0.18;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "bold 96px 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";
            ctx.fillStyle = "#000000";
            const scoreX = w / 2;
            const scoreY = h * 0.39;
            ctx.fillText(scoreText, scoreX, scoreY);
            ctx.restore();
        } else {
            // GAME OVER SCREEN 
            ctx.save();

            // Dark overlay
            ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
            ctx.fillRect(0, 0, w, h);

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#FFFFFF";

            // Label
            ctx.font = "bold 40px 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";
            ctx.fillText("GAME OVER", w / 2, h * 0.30);

            // Huge bold final score
            const finalScoreText = Math.floor(score).toString();
            ctx.font = "bold 110px 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";
            ctx.fillText(finalScoreText, w / 2, h * 0.47);

            // Instruction
            ctx.font = "22px 'Courier New', monospace";
            ctx.fillText("Press R to restart", w / 2, h * 0.47 + 70);

            ctx.restore();
        }
    }

    const MAX_DT = 0.1;
    // MAIN LOOP
    function loop(timestamp) {
        let dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

        if (dt > MAX_DT) {
            dt = MAX_DT;
        } else if (dt < 0) {
            dt = 0;
        }

        worldTime += dt;

        update(dt);
        draw(dt);

        requestAnimationFrame(loop);
    }

    // CONTROLS
    function jump() {
        if (!player) return;

        if (!player.onGround && !canCoyoteJump) {
            return;
        }

        player.onGround = false;
        player.vy = JUMP_VELOCITY;

        const JUMP_TILT = -0.02;
        player.airBaseAngle = player.angle + JUMP_TILT;
        player.angle = player.airBaseAngle;

        canCoyoteJump = false;
        coyoteTimer = 0;
    }

    function isPrimaryKey(e) {
        return (
            e.code === "Space" ||
            e.key === " " ||
            e.key === "ArrowUp" ||
            e.key === "w" ||
            e.key === "W"
        );
    }

    function canJumpNow() {
        if (!player) return false;

        if (player.onGround || canCoyoteJump) {
            return true;
        }

        if (!terrainProfile || terrainProfile.length === 0) return false;

        const w = canvas.width;
        const centerX = Math.round(player.x + PLAYER_SIZE / 2);
        const idx = Math.max(0, Math.min(w - 1, centerX));
        const waveY = terrainProfile[idx];

        if (waveY == null) return false;

        const playerBottom = player.y + PLAYER_SIZE;
        const JUMP_MARGIN = 8; // jump tolerance

        return Math.abs(playerBottom - waveY) <= JUMP_MARGIN;
    }

    function handlePrimaryDown() {
        if (isGameOver) return;

        if (primaryDown) return;
        primaryDown = true;

        if (window.SurfAudio && typeof SurfAudio.ensure === "function") {
            SurfAudio.ensure();
        }

        if (!player) return;

        if (canJumpNow()) {
            jump();
            return;
        }

        if (trickLocked) return;

        pressInAir = true;

        holdTimerId = setTimeout(() => {
            if (!pressInAir || trickLocked || currentTrick || isGameOver) return;
            startGlideTrick();
        }, HOLD_THRESHOLD);
    }

    function handlePrimaryUp() {
        if (!primaryDown) return;
        primaryDown = false;

        if (holdTimerId !== null) {
            clearTimeout(holdTimerId);
            holdTimerId = null;
        }

        // No more actions after game over
        if (isGameOver) {
            pressInAir = false;
            return;
        }

        if (!player) return;

        if (currentTrick === "glide") {
            endGlideTrick();
            pressInAir = false;
            return;
        }

        if (
            pressInAir &&
            !player.onGround &&
            !canCoyoteJump &&
            !trickLocked &&
            !currentTrick
        ) {
            handleAirTap();
        }

        pressInAir = false;
    }

    window.addEventListener("keydown", (e) => {
        if (isPrimaryKey(e)) {
            e.preventDefault();
            handlePrimaryDown();
        }

        if (e.key === "r" || e.key === "R") {
            if (isGameOver) {
                isGameOver = false;
                resetGame();
            }
        }
    });

    window.addEventListener("keyup", (e) => {
        if (isPrimaryKey(e)) {
            handlePrimaryUp();
        }
    });

    window.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        handlePrimaryDown();
    });

    window.addEventListener("pointerup", () => {
        handlePrimaryUp();
    });

    window.addEventListener("keydown", (e) => {
        if (isPrimaryKey(e)) {
            e.preventDefault();
            handlePrimaryDown();
        }

        if (e.key === "r" || e.key === "R") {
            if (isGameOver) {
                isGameOver = false;
                resetGame();
            }
        }
    });



    if (datasetControlsEl) {
        datasetControlsEl.addEventListener("click", (e) => {
            const btn = e.target.closest("button[data-dataset]");
            if (!btn) return;

            const key = btn.getAttribute("data-dataset");
            if (!DATASETS || !DATASETS[key]) return;

            currentDatasetKey = key;
            loadDataset();
        });
    }

    // file input for user JSON
    if (uploadInput) {
        uploadInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const json = JSON.parse(ev.target.result);

                    currentDatasetKey = "user";
                    initEEGFromJson(json);

                    // No stages for user upload (for now)
                    sleepSegments = [];
                    currentStageCode = null;
                    EEG_START_OFFSET_SEC = 0;
                    lastEffectiveTime = 0;

                    statusEl.textContent = "EEG: user upload loaded";
                    statusEl.style.background = "rgba(0,128,0,0.7)";
                } catch (err) {
                    console.error("Failed to parse uploaded JSON:", err);
                    statusEl.textContent = "EEG: upload parse error";
                    statusEl.style.background = "rgba(128,0,0,0.7)";
                }
            };
            reader.readAsText(file);
        });
    }

    resizeCanvas();
    createPlayer();

    window.addEventListener("resize", () => {
        resizeCanvas();
        createPlayer();
    });

    window.addEventListener("blur", () => {
        if (window.SurfAudio) {
            SurfAudio.pause();
        }
    });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden && window.SurfAudio) {
            SurfAudio.pause();
        }
    });

    // Load default dataset (sleep demo)
    loadDataset();

    requestAnimationFrame((t) => {
        lastTime = t;
        loop(t);
    });
})();