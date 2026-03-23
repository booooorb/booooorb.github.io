(function () {
    const canvas = document.getElementById("game-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
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
    const DATASET_INFO = {
        sleep: {
            badge: "Sleep demo",
            sourceLabel: "Sleep-EDF Expanded",
            sourceUrl: "https://www.physionet.org/content/sleep-edfx/1.0.0/",
            sourceDetail: "Sleep cassette example SC4001E0-PSG.edf",
            originalSampleRate: "100 Hz EEG/EOG",
            summary: "Overnight polysomnography from PhysioNet's Sleep-EDF Expanded collection.",
            notes: [
                "Default gameplay channel uses Fpz-Cz from the source recording.",
                "The game keeps the waveform looping and rescales it visually for surfing.",
                "Stage labels in the HUD come from the accompanying sleep stage annotations.",
            ],
        },
        seizure: {
            badge: "Seizure demo",
            sourceLabel: "Siena Scalp EEG Database",
            sourceUrl: "https://www.physionet.org/content/siena-scalp-eeg/1.0.0/",
            sourceDetail: "Scalp EEG recordings from 14 patients",
            originalSampleRate: "512 Hz",
            summary: "Clinical scalp EEG from the University of Siena, published on PhysioNet.",
            notes: [
                "The original recordings use the international 10-20 electrode system.",
                "This demo uses a seizure-oriented channel selection and loops the processed waveform.",
                "The game timing is gameplay-oriented, not a diagnostic viewer.",
            ],
        },
        user: {
            badge: "User EDF",
            sourceLabel: "Local upload",
            sourceUrl: "",
            sourceDetail: "Custom EDF chosen in your browser",
            originalSampleRate: "Varies by file",
            summary: "Your uploaded EDF is parsed locally in the browser and converted for the game.",
            notes: [
                "The game auto-picks a channel, but you can switch channels from the dropdown.",
                "Uploaded EDF data is resampled and normalized for the surfing view.",
            ],
        },
    };

    const PLAYER_SIZE = 64;
    const GRAVITY = 1600;
    const GLIDE_GRAVITY = 200;
    const JUMP_VELOCITY = -640;
    const GROUND_MARGIN = 10;
    const TOP_MARGIN = 20;
    const EEG_SCROLL_SPEED = 5;
    const SMOOTH_WINDOW = 25;
    const HORIZONTAL_SAMPLE_STEP = 0.3;
    const AMP_SCALE = 1.5;
    const SCORE_SPEED = 30;
    const COYOTE_TIME = 0.4;
    const HOLD_THRESHOLD = 220;
    const FLIP_DURATION = 0.5;
    const TRICK_FAIL_PENALTY = 1500;
    const FLOAT_TEXT_LIFETIME = 0.7;
    const BG_SCROLL_SPEED = 20;
    const MAX_AIR_TILT = Math.PI / 6;
    const MAX_DT = 0.1;

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
        eegLength: 0,
        eegTime: 0,
        eegStartOffsetSec: 11300,
        lastEffectiveTime: 0,
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
    };

    const images = {
        player: image(ASSETS.player),
        background: image(ASSETS.background, resizeBackground),
        flipBoard: image(ASSETS.flipBoard),
        flipPenguin: image(ASSETS.flipPenguin),
        glidePenguin: image(ASSETS.glidePenguin),
    };

    if (dom.infoToggle && dom.info) {
        dom.infoToggle.addEventListener("click", () => {
            const collapsed = dom.info.classList.toggle("collapsed");
            dom.infoToggle.textContent = collapsed ? "EEG info >" : "EEG info v";
        });
    }

    function image(src, onLoad) {
        const img = new Image();
        if (src) img.src = src;
        if (onLoad) img.onload = onLoad;
        return img;
    }

    function setStatus(text, background) {
        if (!dom.status) return;
        dom.status.textContent = text;
        if (background) dom.status.style.background = background;
    }

    function syncGameOverChrome() {
        document.body.classList.toggle("game-over", state.isGameOver);
    }

    function formatClock(tSec) {
        const total = ((tSec % 86400) + 86400) % 86400;
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = Math.floor(total % 60);
        const pad = (n) => String(n).padStart(2, "0");
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }

    function stagePretty(code) {
        const dataset = DATASETS[state.datasetKey];
        if (!dataset?.hasStages || !code) return "No stage data";
        return STAGE_LABELS[state.datasetKey]?.[code] || code;
    }

    function resizeBackground() {
        if (!images.background.height || !canvas.height) return;
        state.bgScale = canvas.height / images.background.height;
    }

    function spawnFloatingText(text, color, radius = 0) {
        const p = state.player;
        if (!p) return;
        const angle = Math.random() * Math.PI * 2;
        const distance = radius * Math.random();
        state.floatingTexts.push({
            x: p.x + PLAYER_SIZE / 2 + Math.cos(angle) * distance,
            y: p.y + PLAYER_SIZE * 0.15 + Math.sin(angle) * distance,
            vy: -60,
            life: FLOAT_TEXT_LIFETIME,
            maxLife: FLOAT_TEXT_LIFETIME,
            text,
            color,
        });
    }

    function syncDatasetButtons() {
        const buttons = dom.datasets?.querySelectorAll("button[data-dataset]");
        buttons?.forEach((button) => {
            const active = button.getAttribute("data-dataset") === state.datasetKey;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", active ? "true" : "false");
        });
    }

    function channelsFrom(data) {
        return data?.channels || data?.valuesByChannel || null;
    }

    function renderChannelDropdown() {
        const labels = state.datasetKey === "user" && state.lastUploadedEdfLabels
            ? state.lastUploadedEdfLabels
            : state.availableChannels;

        if (!dom.channels || !labels || labels.length <= 1) {
            if (dom.channels) dom.channels.innerHTML = "";
            return;
        }

        const userEdf = state.datasetKey === "user" && state.lastUploadedEdfLabels;
        dom.channels.innerHTML = `
          <div class="channel-select-row">
            <label class="channel-select-label" for="channel-select">Channel</label>
            <select id="channel-select" class="channel-select">
              ${labels.map((label, index) => {
                const value = userEdf ? String(index) : label;
                const selected = userEdf
                    ? index === state.currentEdfChannelIndex
                    : label === state.channelName;
                return `<option value="${value}" ${selected ? "selected" : ""}>${label}</option>`;
              }).join("")}
            </select>
          </div>`;
    }

    function updateInfoPanel() {
        if (!dom.info) return;
        const dataset = DATASET_INFO[state.datasetKey] || DATASET_INFO.user;
        const smoothSamples = SMOOTH_WINDOW * 2 + 1;
        const smoothSec = state.eegSampleRate ? (smoothSamples / state.eegSampleRate).toFixed(2) : "0.00";
        const sourceLink = dataset.sourceUrl
            ? `<a class="info-source" href="${dataset.sourceUrl}" target="_blank" rel="noreferrer">${dataset.sourceLabel}</a>`
            : `<strong>${dataset.sourceLabel}</strong>`;

        dom.info.innerHTML = `
          <div class="info-heading">
            <div class="info-title">EEG Processing</div>
            <span class="info-chip">${dataset.badge}</span>
          </div>
          <dl class="info-meta">
            <dt>Source</dt>
            <dd>${sourceLink}</dd>
            <dt>Record</dt>
            <dd>${dataset.sourceDetail}</dd>
            <dt>Original rate</dt>
            <dd>${dataset.originalSampleRate}</dd>
            <dt>Game rate</dt>
            <dd>${state.eegSampleRate || 0} Hz</dd>
            <dt>Channel</dt>
            <dd>${state.channelName || "N/A"}</dd>
          </dl>
          <div class="info-section">
            <div class="info-section-title">About This Dataset</div>
            <ul class="info-list">
              <li>${dataset.summary}</li>
              ${dataset.notes.map((note) => `<li>${note}</li>`).join("")}
            </ul>
          </div>
          <div class="info-section">
            <div class="info-section-title">Game Processing</div>
            <ul class="info-list">
              <li>EEG values are normalized to [-1, 1] before drawing.</li>
              <li>Smoothing window: ${smoothSamples} samples (~${smoothSec}s at ${state.eegSampleRate || 0} Hz).</li>
              <li>Amplitude scale: x${AMP_SCALE}; horizontal stretch: ${HORIZONTAL_SAMPLE_STEP} samples/px.</li>
              <li>Wave scroll speed: ${EEG_SCROLL_SPEED}x real time.</li>
            </ul>
          </div>
        `;
    }

    function initEEGFromJson(data) {
        state.eegSampleRate = data.sampleRate || 50;
        const channelMap = channelsFrom(data);

        if (channelMap) {
            state.availableChannels = Object.keys(channelMap);
            if (!state.channelName || !channelMap[state.channelName]) {
                state.channelName = state.availableChannels[0] || null;
            }
        } else if (Array.isArray(data.channelLabels) && data.channelLabels.length > 1) {
            state.availableChannels = data.channelLabels.slice();
            state.channelName = data.channelLabel || state.availableChannels[0] || null;
            state.currentEdfChannelIndex = Number.isFinite(data.channelIndex) ? data.channelIndex : state.currentEdfChannelIndex;
        } else {
            state.availableChannels = [];
            state.channelName = state.channelName || data.channel || data.channelLabel || null;
        }

        const raw = channelMap
            ? (Array.isArray(channelMap[state.channelName]) ? channelMap[state.channelName] : [])
            : (Array.isArray(data.values) ? data.values : []);

        if (!raw.length) throw new Error("Selected channel has no values");
        let maxAbs = 0;
        for (const value of raw) {
            const abs = Math.abs(value);
            if (abs > maxAbs) maxAbs = abs;
        }
        if (!maxAbs) throw new Error("All EEG samples are zero");

        state.eegValues = raw.map((value) => value / maxAbs);
        state.eegLength = state.eegValues.length;
        state.eegReady = true;
        renderChannelDropdown();
        updateInfoPanel();
        setStatus(`EEG: wave loaded (${state.eegLength} samples @ ${state.eegSampleRate} Hz)`, "rgba(0,128,0,0.7)");
    }

    function loadEEGFromUrl(url) {
        setStatus("EEG: loading...", "rgba(0,0,0,0.6)");
        state.eegReady = false;
        window.SpikeSystem?.reset?.();

        fetch(url)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data) => {
                state.lastEEGJson = data;
                initEEGFromJson(data);
            })
            .catch((err) => {
                console.error("Failed to load EEG data:", err);
                setStatus("EEG: failed to load dataset", "rgba(128,0,0,0.7)");
            });
    }

    function initStagesFromJson(data) {
        const segments = Array.isArray(data.segments) ? data.segments : [];
        state.sleepSegments = segments
            .filter((segment) => typeof segment.t === "number" && typeof segment.stage === "string")
            .sort((a, b) => a.t - b.t);

        const firstN1 = state.sleepSegments.find((segment) => segment.stage === "N1");
        const firstNonW = state.sleepSegments.find((segment) => segment.stage !== "W");
        state.eegStartOffsetSec = state.datasetKey === "seizure"
            ? 300
            : firstN1?.t ?? firstNonW?.t ?? 0;
        state.sleepIndex = 0;
        state.lastEffectiveTime = state.eegStartOffsetSec;
        state.currentStageCode = state.sleepSegments[0]?.stage || null;
    }

    function loadStagesFromUrl(url) {
        fetch(url)
            .then((res) => res.json())
            .then(initStagesFromJson)
            .catch(() => {
                state.sleepSegments = [];
                state.currentStageCode = null;
            });
    }

    function loadDataset() {
        const dataset = DATASETS[state.datasetKey];
        if (!dataset) return;
        state.channelName = dataset.defaultChannel || state.channelName;
        syncDatasetButtons();
        renderChannelDropdown();

        if (state.datasetKey === "user") {
            state.eegReady = false;
            state.sleepSegments = [];
            state.currentStageCode = null;
            setStatus("EEG: upload an EDF to start", "rgba(0,0,0,0.6)");
            window.SpikeSystem?.reset?.();
            return;
        }

        loadEEGFromUrl(dataset.eegUrl);
        if (dataset.hasStages && dataset.stagesUrl) loadStagesFromUrl(dataset.stagesUrl);
    }

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        state.groundY = canvas.height - GROUND_MARGIN;
        resizeBackground();
    }

    function createPlayer() {
        state.player = {
            x: canvas.width / 2 - PLAYER_SIZE / 2,
            y: state.groundY - PLAYER_SIZE,
            vy: 0,
            onGround: false,
            angle: 0,
            airBaseAngle: 0,
        };
    }

    function resetGame() {
        createPlayer();
        state.eegTime = 0;
        state.score = 0;
        state.isGameOver = false;
        state.sleepIndex = 0;
        state.particles = [];
        state.floatingTexts = [];
        state.currentTrick = null;
        state.trickTimer = 0;
        state.trickLocked = false;
        state.flipAnimTimeLeft = 0;
        state.glideActive = false;
        syncGameOverChrome();
        window.SpikeSystem?.reset?.();
    }

    function sampleEEG(index) {
        if (!state.eegReady || !state.eegLength) {
            return Math.sin((index / (state.eegSampleRate || 50)) * Math.PI);
        }

        let sum = 0;
        for (let offset = -SMOOTH_WINDOW; offset <= SMOOTH_WINDOW; offset += 1) {
            let i = (index + offset) % state.eegLength;
            if (i < 0) i += state.eegLength;
            sum += state.eegValues[i];
        }
        return sum / (SMOOTH_WINDOW * 2 + 1);
    }

    function updateStage(timeSec) {
        if (!state.sleepSegments.length) {
            state.currentStageCode = null;
            return;
        }
        while (
            state.sleepIndex + 1 < state.sleepSegments.length &&
            timeSec >= state.sleepSegments[state.sleepIndex + 1].t
        ) {
            state.sleepIndex += 1;
        }
        state.currentStageCode = state.sleepSegments[state.sleepIndex].stage;
    }

    function computeTerrain(dt) {
        const p = state.player;
        const baselineY = state.groundY;
        const width = canvas.width;
        const wasOnGround = p.onGround;
        const sampleRate = state.eegSampleRate || 50;

        state.eegTime += dt * EEG_SCROLL_SPEED;
        state.lastEffectiveTime = state.eegTime + state.eegStartOffsetSec;
        updateStage(state.lastEffectiveTime);

        const headSample = Math.floor(state.lastEffectiveTime * sampleRate);
        const maxWaveHeight = baselineY - TOP_MARGIN;
        state.terrainProfile = new Array(width);

        for (let x = 0; x < width; x += 1) {
            const sampleIndex = Math.round(headSample - (width - 1 - x) * HORIZONTAL_SAMPLE_STEP);
            let amp = (sampleEEG(sampleIndex) + 1) / 2;
            amp = Math.min(1, Math.max(0, amp * AMP_SCALE));
            state.terrainProfile[x] = Math.max(TOP_MARGIN, baselineY - amp * maxWaveHeight);
        }

        const left = Math.max(0, Math.floor(p.x));
        const right = Math.min(width - 1, Math.ceil(p.x + PLAYER_SIZE));
        let contactY = null;
        for (let i = left; i <= right; i += 1) {
            const y = state.terrainProfile[i];
            if (contactY === null || y < contactY) contactY = y;
        }

        if (contactY !== null && p.y + PLAYER_SIZE >= contactY - 4 && p.vy >= 0) {
            p.y = contactY - PLAYER_SIZE;
            p.vy = 0;
            p.onGround = true;
        } else {
            p.onGround = false;
        }

        const centerIndex = Math.max(0, Math.min(width - 1, Math.round(p.x + PLAYER_SIZE / 2)));
        const leftIdx = Math.max(0, centerIndex - 2);
        const rightIdx = Math.min(width - 1, centerIndex + 2);
        const targetAngle = Math.atan2(state.terrainProfile[rightIdx] - state.terrainProfile[leftIdx], rightIdx - leftIdx || 1);
        if (p.onGround && Number.isFinite(targetAngle)) {
            p.angle += (targetAngle - p.angle) * 0.25;
            p.airBaseAngle = p.angle;
        }

        if (!wasOnGround && p.onGround) {
            if (state.currentTrick === "flip" && state.trickTimer < FLIP_DURATION || state.currentTrick === "glide") {
                state.score = Math.max(0, state.score - TRICK_FAIL_PENALTY);
                spawnFloatingText("-1500", "red");
                window.SurfAudio?.playCrash?.();
            }
            state.currentTrick = null;
            state.trickTimer = 0;
            state.trickLocked = false;
            state.glideActive = false;
        }

        state.currentWaveAmp = (sampleEEG(headSample) + 1) / 2;
        window.SurfAudio?.update?.(p.onGround, state.currentWaveAmp, state.currentTrick);
    }

    function updateParticles(dt) {
        const p = state.player;
        if (p.onGround) {
            for (let i = 0; i < 5; i += 1) {
                state.particles.push({
                    x: p.x + PLAYER_SIZE * 0.25 + (Math.random() * 4 - 2),
                    y: p.y + PLAYER_SIZE - 2 + (Math.random() * 4 - 2),
                    vx: -(120 + Math.random() * 80),
                    vy: -(40 + Math.random() * 40),
                    life: 0.4 + Math.random() * 0.3,
                    size: 2 + Math.random() * 2,
                });
            }
        }

        state.particles = state.particles.filter((particle) => {
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            particle.vy += 250 * dt;
            particle.life -= dt;
            return particle.life > 0;
        });

        state.floatingTexts = state.floatingTexts.filter((text) => {
            text.life -= dt;
            text.y += text.vy * dt;
            return text.life > 0;
        });
    }

    function updateTilt(dt) {
        const p = state.player;
        if (p.onGround) return;
        const target = p.vy < 0 ? -MAX_AIR_TILT : MAX_AIR_TILT;
        const currentOffset = p.angle - p.airBaseAngle;
        const speed = state.glideActive ? 0.5 : p.angle < Math.PI / 12 ? 4 : 1.5;
        p.angle = p.airBaseAngle + currentOffset + (target - currentOffset) * speed * dt;
    }

    function update(dt) {
        if (!state.player || state.isGameOver) return;

        state.score += dt * SCORE_SPEED;

        const bgWidth = images.background.width * state.bgScale || 1;
        state.bgScrollX = (state.bgScrollX + BG_SCROLL_SPEED * dt) % bgWidth;

        const p = state.player;
        const gravity = state.currentTrick === "glide" ? GLIDE_GRAVITY : GRAVITY;
        if (state.currentTrick === "glide") p.vy = 80;
        p.vy += gravity * dt;
        p.y += p.vy * dt;

        computeTerrain(dt);
        window.SpikeSystem?.update?.(dt, state.terrainProfile, p, PLAYER_SIZE, canvas.width);

        if (state.currentTrick) {
            state.trickTimer += dt;
            if (state.currentTrick === "glide") {
                state.score += 400 * dt;
                spawnFloatingText("+5", null, PLAYER_SIZE * 0.9);
            }
            if (state.currentTrick === "flip" && state.trickTimer >= FLIP_DURATION) {
                state.currentTrick = null;
                state.trickTimer = 0;
            }
        }

        updateParticles(dt);
        updateTilt(dt);

        if (p.onGround) {
            state.coyoteTimer = COYOTE_TIME;
            state.canCoyoteJump = true;
        } else if (state.coyoteTimer > 0) {
            state.coyoteTimer -= dt;
            if (state.coyoteTimer <= 0) state.canCoyoteJump = false;
        }

        if (state.flipAnimTimeLeft > 0) {
            state.flipAnimTimeLeft = Math.max(0, state.flipAnimTimeLeft - dt);
        }
    }

    function drawBackground() {
        if (!images.background.width || !state.terrainProfile.length) return;
        const width = canvas.width;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(width, 0);
        for (let x = width - 1; x >= 0; x -= 1) {
            ctx.lineTo(x + 0.5, state.terrainProfile[x] + 0.5);
        }
        ctx.closePath();
        ctx.clip();
        ctx.globalAlpha = 0.35;
        const imgW = images.background.width * state.bgScale;
        const imgH = images.background.height * state.bgScale;
        let startX = -state.bgScrollX;
        while (startX > 0) startX -= imgW;
        for (let x = startX; x < width; x += imgW) {
            ctx.drawImage(images.background, x, 0, imgW, imgH);
        }
        ctx.restore();
    }

    function drawWave() {
        if (state.terrainProfile.length !== canvas.width) return;
        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        for (let x = 0; x < canvas.width; x += 1) {
            if (x === 0) ctx.moveTo(x + 0.5, state.terrainProfile[x] + 0.5);
            else ctx.lineTo(x + 0.5, state.terrainProfile[x] + 0.5);
        }
        ctx.strokeStyle = "#000";
        ctx.stroke();
    }

    function drawPlayer() {
        const p = state.player;
        const cx = p.x + PLAYER_SIZE / 2;
        const cy = p.y + PLAYER_SIZE / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(p.angle || 0);

        const canFlipDraw = images.flipBoard.complete && images.flipPenguin.complete && images.flipBoard.naturalWidth > 0 && images.flipPenguin.naturalWidth > 0;
        const canGlideDraw = images.glidePenguin.complete && images.glidePenguin.naturalWidth > 0;

        if (state.glideActive && canGlideDraw) {
            ctx.drawImage(images.glidePenguin, -PLAYER_SIZE / 2, -PLAYER_SIZE / 2 - 30, PLAYER_SIZE + 10, PLAYER_SIZE + 23);
        } else if (state.flipAnimTimeLeft > 0 && canFlipDraw) {
            ctx.drawImage(images.flipBoard, -PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
            ctx.save();
            ctx.translate(0, -PLAYER_SIZE * 0.35);
            ctx.rotate((1 - state.flipAnimTimeLeft / FLIP_DURATION) * 4 * Math.PI);
            ctx.drawImage(images.flipPenguin, -PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
            ctx.restore();
        } else if (images.player.complete && images.player.naturalWidth > 0) {
            ctx.drawImage(images.player, -PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
        } else {
            ctx.fillStyle = "#000";
            ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
        }
        ctx.restore();
    }

    function drawEffects() {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "#000";
        state.particles.forEach((particle) => ctx.fillRect(particle.x, particle.y, particle.size, particle.size));
        ctx.restore();

        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "20px Liberation Mono, Courier, system-ui, sans-serif";
        state.floatingTexts.forEach((text) => {
            ctx.globalAlpha = Math.max(text.life / text.maxLife, 0);
            ctx.fillStyle = text.color === "red" ? "#a10000" : "#000";
            ctx.fillText(text.text, text.x, text.y);
        });
        ctx.restore();
    }

    function drawHud() {
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#000";
        ctx.font = "20px 'Courier New', monospace";
        ctx.fillText(`Stage: ${stagePretty(state.currentStageCode)}`, canvas.width / 2, canvas.height * 0.39 + 50);
        ctx.font = "16px 'Courier New', monospace";
        ctx.fillText(`EDF time: ${formatClock(state.lastEffectiveTime)}`, canvas.width / 2, canvas.height * 0.39 + 70);
        ctx.fillText(`Channel: ${state.channelName || "N/A"}`, canvas.width / 2, canvas.height * 0.39 + 90);
        ctx.globalAlpha = 0.18;
        ctx.font = "bold 96px 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";
        ctx.fillText(Math.floor(state.score).toString(), canvas.width / 2, canvas.height * 0.39);
        ctx.restore();
    }

    function drawGameOver() {
        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff";
        ctx.font = "bold 40px 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";
        ctx.fillText("GAME OVER", canvas.width / 2, canvas.height * 0.39 - 90);
        ctx.font = "bold 96px 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";
        ctx.fillText(Math.floor(state.score).toString(), canvas.width / 2, canvas.height * 0.39);
        ctx.font = "20px 'Courier New', monospace";
        ctx.fillText("Press R to restart", canvas.width / 2, canvas.height * 0.39 + 60);
        ctx.restore();
    }

    function draw() {
        ctx.fillStyle = "#EAE7D9";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawBackground();
        drawWave();
        window.SpikeSystem?.draw?.(ctx, state.terrainProfile);
        drawPlayer();
        drawEffects();
        if (state.isGameOver) drawGameOver();
        else drawHud();
        syncGameOverChrome();
    }

    function jump() {
        const p = state.player;
        if (!p || (!p.onGround && !state.canCoyoteJump)) return;
        p.onGround = false;
        p.vy = JUMP_VELOCITY;
        p.airBaseAngle = p.angle - 0.02;
        p.angle = p.airBaseAngle;
        state.canCoyoteJump = false;
        state.coyoteTimer = 0;
    }

    function primaryKey(event) {
        return event.code === "Space" || event.key === " " || event.key === "ArrowUp" || event.key === "w" || event.key === "W";
    }

    function isInteractiveElement(target) {
        return Boolean(target?.closest("button, select, option, input, label, a, summary"));
    }

    function canJumpNow() {
        const p = state.player;
        if (!p) return false;
        if (p.onGround || state.canCoyoteJump) return true;
        if (!state.terrainProfile.length) return false;
        const idx = Math.max(0, Math.min(canvas.width - 1, Math.round(p.x + PLAYER_SIZE / 2)));
        return Math.abs(p.y + PLAYER_SIZE - state.terrainProfile[idx]) <= 8;
    }

    function handlePrimaryDown() {
        if (state.isGameOver || state.primaryDown) return;
        state.primaryDown = true;
        window.SurfAudio?.ensure?.();
        if (canJumpNow()) return jump();
        if (state.trickLocked) return;
        state.pressInAir = true;
        state.holdTimerId = setTimeout(() => {
            if (!state.pressInAir || state.trickLocked || state.currentTrick || state.isGameOver) return;
            state.currentTrick = "glide";
            state.glideActive = true;
            state.trickLocked = true;
            state.trickTimer = 0;
        }, HOLD_THRESHOLD);
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
        if (state.pressInAir && !state.player.onGround && !state.canCoyoteJump && !state.trickLocked && !state.currentTrick) {
            state.currentTrick = "flip";
            state.trickTimer = 0;
            state.trickLocked = true;
            state.flipAnimTimeLeft = FLIP_DURATION * (2 / 3);
            state.score += 1000;
            spawnFloatingText("+1000");
            window.SurfAudio?.playFlip?.();
        }
        state.pressInAir = false;
    }

    function parseUploadedEdf(buffer, channelIndex) {
        const json = window.parseEdfToJson(buffer, { channelIndex, targetRate: 50 });
        state.lastUploadedEdfBuffer = buffer;
        state.lastUploadedEdfLabels = json.channelLabels || null;
        state.currentEdfChannelIndex = Number.isFinite(json.channelIndex) ? json.channelIndex : state.currentEdfChannelIndex;
        state.eegStartOffsetSec = Number.isFinite(json.startTimeSec) ? json.startTimeSec : 0;
        state.lastEffectiveTime = state.eegStartOffsetSec;
        state.datasetKey = "user";
        state.lastEEGJson = json;
        state.sleepSegments = [];
        state.currentStageCode = null;
        initEEGFromJson(json);
        setStatus(`EEG: user EDF loaded (${json.channelLabel || "channel"})`, "rgba(0,128,0,0.7)");
    }

    function loop(timestamp) {
        let dt = (timestamp - state.lastTime) / 1000;
        state.lastTime = timestamp;
        dt = Math.max(0, Math.min(MAX_DT, dt));
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
        if (state.datasetKey === "user" && state.lastUploadedEdfBuffer && state.lastUploadedEdfLabels) {
            parseUploadedEdf(state.lastUploadedEdfBuffer, parseInt(select.value, 10));
            return;
        }
        state.channelName = select.value;
        if (state.lastEEGJson) initEEGFromJson(state.lastEEGJson);
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
                setStatus("EEG: EDF parse error", "rgba(128,0,0,0.7)");
            } finally {
                dom.upload.value = "";
            }
        };
        reader.readAsArrayBuffer(file);
    });

    window.addEventListener("keydown", (event) => {
        if (primaryKey(event)) {
            event.preventDefault();
            handlePrimaryDown();
        }
        if ((event.key === "r" || event.key === "R") && state.isGameOver) resetGame();
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
    window.addEventListener("resize", () => {
        resizeCanvas();
        createPlayer();
    });
    window.addEventListener("blur", () => window.SurfAudio?.pause?.());
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) window.SurfAudio?.pause?.();
    });

    resizeCanvas();
    createPlayer();
    syncDatasetButtons();
    window.SpikeSystem?.init?.({
        jumpVelocity: JUMP_VELOCITY,
        onHit: () => {
            if (state.isGameOver) return;
            state.isGameOver = true;
            syncGameOverChrome();
            window.SurfAudio?.playCrash?.();
            window.SurfAudio?.pause?.();
        },
    });
    loadDataset();

    requestAnimationFrame((timestamp) => {
        state.lastTime = timestamp;
        loop(timestamp);
    });
})();
