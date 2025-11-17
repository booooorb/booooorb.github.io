(function () {
    const canvas = document.getElementById("game-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const datasetControlsEl = document.getElementById("dataset-controls");
    const uploadInput = document.getElementById("eeg-upload-input");

    const PLAYER_SIZE = 64;
    const GRAVITY = 1800;        // px/s^2
    const JUMP_VELOCITY = -800;  // px/s
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

    let EEG_START_OFFSET_SEC = 11300;

    const MAX_AIR_TILT = Math.PI / 6; // max extra tilt in air (30°)
    const AIR_TILT_SPEED = 4.0;
    const SLOW_TILT_SPEED = 1.5;

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
        },
        seizure: {
            label: "Seizure (demo)",
            eegUrl: "brainwave_runner_seizure.json",
            stagesUrl: "brainwave_stages_seizure.json",
            hasStages: true,
        },
        user: {
            label: "User upload",
            eegUrl: null,   // loaded from <input type="file">
            stagesUrl: null,
            hasStages: false,
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
    let score = 0;
    const SCORE_SPEED = 30;

    let terrainProfile = [];

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
            "- EEG Fpz-Cz channel, normalized to [-1, 1]",
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

    // DRAW EEG + COLLISION + GROUND-BASED ROTATION
    function drawWaveAndCollide(dt) {
        const w = canvas.width;
        const baselineY = groundY;

        if (eegSampleRate === 0) eegSampleRate = 50;

        // advance game-time and convert to EDF time
        eegTime += dt * EEG_SCROLL_SPEED;
        const effectiveTime = eegTime + EEG_START_OFFSET_SEC;
        lastEffectiveTime = effectiveTime;

        updateSleepStageForTime(effectiveTime);

        const headSample = Math.floor(effectiveTime * eegSampleRate);
        const maxWaveHeight = baselineY - TOP_MARGIN;
        const playerCenterX = player.x + PLAYER_SIZE / 2;

        terrainProfile = new Array(w);
        let waveYAtPlayer = null;

        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.imageSmoothingEnabled = true;

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

            if (x === 0) {
                ctx.moveTo(x + 0.5, waveY + 0.5);
            } else {
                ctx.lineTo(x + 0.5, waveY + 0.5);
            }

            if (Math.abs(x - playerCenterX) < 1) {
                waveYAtPlayer = waveY;
            }
        }

        ctx.strokeStyle = "#000000";
        ctx.stroke();

        // COLLISION WITH WAVE
        const playerBottom = player.y + PLAYER_SIZE;

        if (waveYAtPlayer !== null) {
            if (playerBottom >= waveYAtPlayer) {
                player.y = waveYAtPlayer - PLAYER_SIZE;
                player.vy = 0;
                player.onGround = true;
            } else {
                player.onGround = false;
            }
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
    }

    // PHYSICS & GAME LOGIC
    function update(dt) {
        if (!player || isGameOver) return;

        score += dt * SCORE_SPEED;

        player.vy += GRAVITY * dt;
        player.y += player.vy * dt;

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

        /* Clamp at very bottom of canvas as a safety net
        const baseline = groundY - PLAYER_SIZE;
        if (player.y > baseline) {
            player.y = baseline;
            player.vy = 0;
            player.onGround = true;
        }

        const topClamp = canvas.height * 0.05; // 5% from the top
        if (player.y < topClamp) {
            player.y = topClamp;
            if (player.vy < 0) player.vy = 0;
        }*/

        // Air tilt
        if (!player.onGround) {
            const targetOffset = (player.vy < 0) ? -MAX_AIR_TILT : MAX_AIR_TILT;
            const currentOffset = player.angle - player.airBaseAngle;
            const newOffset = (player.angle < Math.PI / 12) ?
                currentOffset + (targetOffset - currentOffset) * AIR_TILT_SPEED * dt :
                currentOffset + (targetOffset - currentOffset) * SLOW_TILT_SPEED * dt;
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
    }

    // RENDER
    function draw(dt) {
        const w = canvas.width;
        const h = canvas.height;

        ctx.fillStyle = "#EAE7D9";
        ctx.fillRect(0, 0, w, h);

        drawWaveAndCollide(dt);

        // player
        const cx = player.x + PLAYER_SIZE / 2;
        const cy = player.y + PLAYER_SIZE / 2;
        const angle = player.angle || 0;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        if (playerImgLoaded) {
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


        // HUD
        const conf = DATASETS[currentDatasetKey];
        let stageText = "";

        if (conf && conf.hasStages) {
            stageText = "Stage: " + stagePretty(currentStageCode);
        }
        const timeText = "EDF time: " + formatClock(lastEffectiveTime);

        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.font = "20px 'Courier New', monospace";
        ctx.fillStyle = "#000000";
        ctx.fillText(stageText, w / 2, h * 0.39 + 50);

        ctx.font = "16px 'Courier New', monospace";
        ctx.fillText(timeText, w / 2, h * 0.39 + 50 + 20);
        ctx.restore();

        // BIG CENTER SCORE
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

        if (isGameOver) {
            // TODO: Game over screen
        }
    }

    // MAIN LOOP
    function loop(timestamp) {
        const dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

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

    window.addEventListener("keydown", (e) => {
        if (
            e.code === "Space" ||
            e.key === "ArrowUp" ||
            e.key === "w" ||
            e.key === "W"
        ) {
            e.preventDefault();
            jump();
        }

        if (e.key === "r" || e.key === "R") {
            if (isGameOver) {
                isGameOver = false;
                resetGame();
            }
        }
    });

    window.addEventListener("pointerdown", () => {
        jump();
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

    // Load default dataset (sleep demo)
    loadDataset();

    requestAnimationFrame((t) => {
        lastTime = t;
        loop(t);
    });
})();