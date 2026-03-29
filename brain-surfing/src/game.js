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
    const DATASET_INFO = {
        sleep: {
            badge: "Sleep demo",
            sourceLabel: "Sleep-EDF Expanded",
            sourceUrl: "https://www.physionet.org/content/sleep-edfx/1.0.0/",
            sourceDetail: "Sleep cassette example SC4001E0-PSG.edf",
            originalSampleRate: "100 Hz",
            summary: "Overnight polysomnography from PhysioNet's Sleep-EDF Expanded collection.",
            notes: [
                "Default gameplay channel uses Fpz-Cz from the source recording.",
                "This demo loads a short slice of the overnight recording so the game starts quickly.",
                "The game keeps the waveform looping and rescales it visually for surfing.",
                "Stage labels in the HUD come from the accompanying sleep stage annotations.",
            ],
        },
        seizure: {
            badge: "Seizure demo",
            sourceLabel: "Siena Scalp EEG Database",
            sourceUrl: "https://www.physionet.org/content/siena-scalp-eeg/1.0.0/",
            sourceDetail: "Patient 12, recording 3",
            originalSampleRate: "512 Hz",
            summary: "Clinical scalp EEG from the University of Siena, published on PhysioNet.",
            notes: [
                "The original recordings use the international 10-20 electrode system.",
                "This demo loads a short seizure-centered EDF slice so the original probe data stays fast to load.",
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
                "The surf wave still uses a normalized gameplay copy, but the probe keeps the raw EDF amplitude readout.",
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
    const SCORE_ROLL_DURATION = 0.28;
    const SCORE_ROLL_OFFSET = 28;
    const SCORE_FLASH_DURATION = 0.35;
    const GAME_OVER_FADE_DURATION = 0.4;
    const GAME_OVER_FADE_DELAY = 0.5;
    const SHATTER_GRAVITY = 2200;
    const SHATTER_BLAST_SPEED = 440;
    const SHATTER_SPIN_SPEED = 18;
    const SHATTER_TILE_SIZE = 6;
    const SHATTER_SOURCE_SIZE = PLAYER_SIZE + 96;
    const SHATTER_WIND_ACCEL = -420;

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

    const images = {
        player: image(ASSETS.player),
        background: image(ASSETS.background, resizeBackground),
        flipBoard: image(ASSETS.flipBoard),
        flipPenguin: image(ASSETS.flipPenguin),
        glidePenguin: image(ASSETS.glidePenguin),
    };
    const sessionHighScore = new window.SessionHighScore();

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

    function restartEntranceAnimation() {
        document.body.classList.remove("scene-enter");
        void document.body.offsetWidth;
        document.body.classList.add("scene-enter");
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

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function loopedSample(values, index) {
        if (!Array.isArray(values) || !values.length || !Number.isFinite(index)) {
            return null;
        }

        let i = index % values.length;
        if (i < 0) i += values.length;
        const value = values[i];
        return Number.isFinite(value) ? value : null;
    }

    function hasOriginalEdfProbe() {
        return Boolean(state.lastUploadedEdfBuffer && state.eegProbeMeta);
    }

    function hasPhysicalReadout() {
        return Array.isArray(state.eegPhysicalValues) && state.eegPhysicalValues.length === state.eegLength;
    }

    function sampleIndexForCanvasX(x) {
        const width = Math.max(viewport.width, 1);
        const sampleRate = state.eegSampleRate || 50;
        const clampedX = clamp(Math.round(x), 0, width - 1);
        const headSample = Number.isFinite(state.currentHeadSample)
            ? state.currentHeadSample
            : Math.floor(state.lastEffectiveTime * sampleRate);
        return Math.round(headSample - (width - 1 - clampedX) * HORIZONTAL_SAMPLE_STEP);
    }

    function readOriginalEdfPhysicalSampleAtTime(timeSec) {
        if (!hasOriginalEdfProbe()) return null;

        const meta = state.eegProbeMeta;
        const totalSamples = meta.originalSampleCount || (meta.channelSamplesPerRecord * meta.numRecords);
        if (!Number.isFinite(totalSamples) || totalSamples <= 0) return null;

        let sampleIndex = Math.round(timeSec * meta.originalSampleRate);
        sampleIndex %= totalSamples;
        if (sampleIndex < 0) sampleIndex += totalSamples;

        const recordIndex = Math.floor(sampleIndex / meta.channelSamplesPerRecord);
        const sampleInRecord = sampleIndex % meta.channelSamplesPerRecord;
        const byteOffset = meta.headerBytes +
            (recordIndex * meta.bytesPerRecord) +
            meta.channelRecordByteOffset +
            (sampleInRecord * 2);

        if (byteOffset < 0 || byteOffset + 2 > state.lastUploadedEdfBuffer.byteLength) {
            return null;
        }

        const view = new DataView(state.lastUploadedEdfBuffer);
        const digitalValue = view.getInt16(byteOffset, true);
        const physicalValue = meta.physicalMin + (digitalValue - meta.digitalMin) * meta.scale;
        return Number.isFinite(physicalValue) ? physicalValue : null;
    }

    function formatProbeLabel(sampleIndex) {
        const originalPhysicalValue = readOriginalEdfPhysicalSampleAtTime(sampleIndex / (state.eegSampleRate || 50));
        if (originalPhysicalValue !== null) {
            const unit = state.eegProbeMeta?.amplitudeUnit || state.eegPhysicalUnit || "uV";
            return `Original EDF magnitude: ${Math.abs(originalPhysicalValue).toFixed(1)} ${unit}`;
        }

        const physicalValue = loopedSample(state.eegPhysicalValues, sampleIndex);
        if (physicalValue !== null) {
            const unit = state.eegPhysicalUnit || "raw";
            return `Resampled magnitude: ${Math.abs(physicalValue).toFixed(1)} ${unit}`;
        }

        return "EDF magnitude unavailable";
    }

    function setWaveProbeFromPointer(event) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const x = ((event.clientX - rect.left) / rect.width) * viewport.width;
        const y = ((event.clientY - rect.top) / rect.height) * viewport.height;
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > viewport.width || y > viewport.height) {
            state.waveProbeX = null;
            return;
        }

        state.waveProbeX = clamp(x, 0, Math.max(0, viewport.width - 1));
    }

    function stagePretty(code) {
        const dataset = DATASETS[state.datasetKey];
        if (!dataset?.hasStages || !code) return "No stage data";
        return STAGE_LABELS[state.datasetKey]?.[code] || code;
    }

    function resizeBackground() {
        if (!images.background.height || !viewport.height) return;
        state.bgScale = viewport.height / images.background.height;
    }

    function rescaleRuntimeState(previousWidth, previousHeight) {
        if (!previousWidth || !previousHeight) return;

        const scaleX = viewport.width / previousWidth;
        const scaleY = viewport.height / previousHeight;
        if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY)) return;

        if (state.player) {
            state.player.x *= scaleX;
            state.player.y *= scaleY;
        }

        if (state.waveProbeX !== null) {
            state.waveProbeX = clamp(state.waveProbeX * scaleX, 0, Math.max(0, viewport.width - 1));
        }

        state.particles.forEach((particle) => {
            particle.x *= scaleX;
            particle.y *= scaleY;
        });

        state.floatingTexts.forEach((text) => {
            text.x *= scaleX;
            text.y *= scaleY;
        });

        state.shatterPieces.forEach((piece) => {
            piece.x *= scaleX;
            piece.y *= scaleY;
        });

        state.terrainProfile = [];
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
        return data?.visualValuesByChannel || data?.channels || data?.valuesByChannel || null;
    }

    function physicalChannelsFrom(data) {
        return data?.physicalValuesByChannel || data?.physicalByChannel || null;
    }

    function renderChannelDropdown() {
        const useEdfLabels = Array.isArray(state.lastUploadedEdfLabels) && state.lastUploadedEdfLabels.length > 1;
        const labels = useEdfLabels
            ? state.lastUploadedEdfLabels
            : state.availableChannels;

        if (!dom.channels || !labels || labels.length <= 1) {
            if (dom.channels) dom.channels.innerHTML = "";
            return;
        }

        dom.channels.innerHTML = `
          <div class="channel-select-row">
            <label class="channel-select-label" for="channel-select">Channel</label>
            <select id="channel-select" class="channel-select">
              ${labels.map((label, index) => {
                const value = useEdfLabels ? String(index) : label;
                const selected = useEdfLabels
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
        const probeSummary = hasOriginalEdfProbe()
            ? `Probe reads the nearest original EDF sample at the source sample rate and shows its absolute ${state.eegProbeMeta?.amplitudeUnit || state.eegPhysicalUnit || "signal"} magnitude with no centering, normalization, or resampling.`
            : hasPhysicalReadout()
                ? `Probe uses absolute ${state.eegPhysicalUnit || "signal"} values from the resampled physical signal because the original EDF sample stream is not available here.`
                : "This dataset does not currently expose EDF probe data.";
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
            <dt>Probe</dt>
            <dd>${hasOriginalEdfProbe() ? `Original ${state.eegProbeMeta?.amplitudeUnit || state.eegPhysicalUnit || "EDF"} ready` : hasPhysicalReadout() ? `Resampled ${state.eegPhysicalUnit || "EDF"} ready` : "Probe unavailable"}</dd>
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
              <li>Gameplay terrain uses a normalized copy of the signal so the surf wave stays playable.</li>
              <li>${probeSummary}</li>
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
        const physicalChannelMap = physicalChannelsFrom(data);

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

        const visualRaw = channelMap
            ? (Array.isArray(channelMap[state.channelName]) ? channelMap[state.channelName] : [])
            : (Array.isArray(data.visualValues) ? data.visualValues : Array.isArray(data.values) ? data.values : []);
        const physicalRaw = physicalChannelMap
            ? (Array.isArray(physicalChannelMap[state.channelName]) ? physicalChannelMap[state.channelName] : null)
            : (Array.isArray(data.physicalValues) ? data.physicalValues : null);

        if (!visualRaw.length) throw new Error("Selected channel has no values");
        let maxAbs = 0;
        for (const value of visualRaw) {
            const abs = Math.abs(value);
            if (abs > maxAbs) maxAbs = abs;
        }
        if (!maxAbs) throw new Error("All EEG samples are zero");

        state.eegValues = visualRaw.map((value) => value / maxAbs);
        state.eegPhysicalValues = Array.isArray(physicalRaw) && physicalRaw.length === visualRaw.length
            ? physicalRaw.slice()
            : null;
        state.eegPhysicalUnit = typeof data.amplitudeUnit === "string" ? data.amplitudeUnit : "";
        state.eegProbeMeta = data?.probeMeta || null;
        state.eegLength = state.eegValues.length;
        state.eegReady = true;
        if (state.waveProbeX !== null) {
            state.waveProbeX = clamp(state.waveProbeX, 0, Math.max(0, viewport.width - 1));
        }
        renderChannelDropdown();
        updateInfoPanel();
        restartEntranceAnimation();
        setStatus(`EEG: wave loaded (${state.eegLength} samples @ ${state.eegSampleRate} Hz)`, "rgba(0,128,0,0.7)");
    }

    function loadEEGFromUrl(url) {
        setStatus("EEG: loading...", "rgba(0,0,0,0.6)");
        state.eegReady = false;
        state.isLoadingEeg = true;
        state.eegPhysicalValues = null;
        state.eegPhysicalUnit = "";
        state.eegProbeMeta = null;
        state.lastUploadedEdfBuffer = null;
        state.lastUploadedEdfLabels = null;
        state.waveProbeX = null;
        window.SpikeSystem?.reset?.();

        fetch(url)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data) => {
                state.lastEEGJson = data;
                initEEGFromJson(data);
                state.isLoadingEeg = false;
            })
            .catch((err) => {
                console.error("Failed to load EEG data:", err);
                state.isLoadingEeg = false;
                setStatus("EEG: failed to load dataset", "rgba(128,0,0,0.7)");
            });
    }

    function parseEdfBuffer(buffer, options = {}) {
        const {
            channelIndex,
            datasetKey = state.datasetKey,
            preferredLabels,
            resetStages = false,
            useEdfStartTime = false,
            statusText = null,
        } = options;

        const json = window.parseEdfToJson(buffer, { channelIndex, preferredLabels, targetRate: 50 });
        state.lastUploadedEdfBuffer = buffer;
        state.lastUploadedEdfLabels = json.channelLabels || null;
        state.currentEdfChannelIndex = Number.isFinite(json.channelIndex) ? json.channelIndex : state.currentEdfChannelIndex;
        state.datasetKey = datasetKey;
        state.lastEEGJson = json;

        if (resetStages) {
            state.sleepSegments = [];
            state.currentStageCode = null;
        }

        if (useEdfStartTime) {
            state.eegStartOffsetSec = 0;
            state.eegDisplayOffsetSec = Number.isFinite(json.startTimeSec) ? json.startTimeSec : 0;
            state.lastEffectiveTime = state.eegDisplayOffsetSec;
        }

        initEEGFromJson(json);
        state.isLoadingEeg = false;
        setStatus(statusText || `EEG: wave loaded (${json.channelLabel || "channel"})`, "rgba(0,128,0,0.7)");
    }

    function loadEEGFromEdfUrl(dataset) {
        setStatus("EEG: loading EDF...", "rgba(0,0,0,0.6)");
        state.eegReady = false;
        state.isLoadingEeg = true;
        state.eegPhysicalValues = null;
        state.eegPhysicalUnit = "";
        state.eegProbeMeta = null;
        state.lastUploadedEdfBuffer = null;
        state.lastUploadedEdfLabels = null;
        state.waveProbeX = null;
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
                setStatus("EEG: failed to load EDF dataset", "rgba(128,0,0,0.7)");
            });
    }

    function initStagesFromJson(data) {
        const segments = Array.isArray(data.segments) ? data.segments : [];
        state.sleepSegments = segments
            .filter((segment) => typeof segment.t === "number" && typeof segment.stage === "string")
            .sort((a, b) => a.t - b.t);

        const firstN1 = state.sleepSegments.find((segment) => segment.stage === "N1");
        const firstNonW = state.sleepSegments.find((segment) => segment.stage !== "W");
        const sourceOffsetSec = Number.isFinite(data?.sourceOffsetSec) ? data.sourceOffsetSec : null;
        state.eegStartOffsetSec = sourceOffsetSec === null
            ? state.datasetKey === "seizure"
                ? 300
                : firstN1?.t ?? firstNonW?.t ?? 0
            : 0;
        state.eegDisplayOffsetSec = sourceOffsetSec === null ? 0 : sourceOffsetSec;
        state.sleepIndex = 0;
        state.lastEffectiveTime = state.eegStartOffsetSec + state.eegDisplayOffsetSec;
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
        state.waveProbeX = null;
        syncDatasetButtons();
        renderChannelDropdown();

        if (state.datasetKey === "user") {
            state.eegReady = false;
            state.isLoadingEeg = false;
            state.eegPhysicalValues = null;
            state.eegPhysicalUnit = "";
            state.eegProbeMeta = null;
            state.lastUploadedEdfBuffer = null;
            state.lastUploadedEdfLabels = null;
            state.sleepSegments = [];
            state.currentStageCode = null;
            setStatus("EEG: upload an EDF to start", "rgba(0,0,0,0.6)");
            window.SpikeSystem?.reset?.();
            return;
        }

        state.sleepSegments = [];
        state.sleepIndex = 0;
        state.currentStageCode = null;
        state.eegStartOffsetSec = 0;
        state.eegDisplayOffsetSec = 0;
        state.lastEffectiveTime = 0;

        if (dataset.edfUrl) loadEEGFromEdfUrl(dataset);
        else if (dataset.eegUrl) loadEEGFromUrl(dataset.eegUrl);
        if (dataset.hasStages && dataset.stagesUrl) loadStagesFromUrl(dataset.stagesUrl);
    }

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        const nextWidth = Math.max(1, Math.round(rect.width || viewport.width || canvas.width));
        const nextHeight = Math.max(1, Math.round(rect.height || viewport.height || canvas.height));
        const previousWidth = viewport.width;
        const previousHeight = viewport.height;
        const deviceScale = clamp(window.devicePixelRatio || 1, 1, 2);

        viewport.width = nextWidth;
        viewport.height = nextHeight;

        canvas.width = Math.max(1, Math.round(nextWidth * deviceScale));
        canvas.height = Math.max(1, Math.round(nextHeight * deviceScale));
        ctx.setTransform(canvas.width / viewport.width, 0, 0, canvas.height / viewport.height, 0, 0);

        state.groundY = viewport.height - GROUND_MARGIN;
        resizeBackground();
        rescaleRuntimeState(previousWidth, previousHeight);
    }

    function createPlayer() {
        state.player = {
            x: viewport.width / 2 - PLAYER_SIZE / 2,
            y: state.groundY - PLAYER_SIZE,
            vy: 0,
            onGround: false,
            angle: 0,
            airBaseAngle: 0,
        };
    }

    function drawCurrentPlayerSprite(targetCtx) {
        const canFlipDraw =
            images.flipBoard.complete &&
            images.flipPenguin.complete &&
            images.flipBoard.naturalWidth > 0 &&
            images.flipPenguin.naturalWidth > 0;
        const canGlideDraw = images.glidePenguin.complete && images.glidePenguin.naturalWidth > 0;

        if (state.glideActive && canGlideDraw) {
            targetCtx.drawImage(images.glidePenguin, -PLAYER_SIZE / 2, -PLAYER_SIZE / 2 - 30, PLAYER_SIZE + 10, PLAYER_SIZE + 23);
            return;
        }

        if (state.flipAnimTimeLeft > 0 && canFlipDraw) {
            targetCtx.drawImage(images.flipBoard, -PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
            targetCtx.save();
            targetCtx.translate(0, -PLAYER_SIZE * 0.35);
            targetCtx.rotate((1 - state.flipAnimTimeLeft / FLIP_DURATION) * 4 * Math.PI);
            targetCtx.drawImage(images.flipPenguin, -PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
            targetCtx.restore();
            return;
        }

        if (images.player.complete && images.player.naturalWidth > 0) {
            targetCtx.drawImage(images.player, -PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
            return;
        }

        targetCtx.fillStyle = "#000";
        targetCtx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
    }

    function spriteTileHasPixels(data, width, sx, sy, sw, sh) {
        for (let y = sy; y < sy + sh; y += 1) {
            for (let x = sx; x < sx + sw; x += 1) {
                if (data[(y * width + x) * 4 + 3] > 16) return true;
            }
        }
        return false;
    }

    function capturePlayerSprite() {
        const spriteCanvas = document.createElement("canvas");
        spriteCanvas.width = SHATTER_SOURCE_SIZE;
        spriteCanvas.height = SHATTER_SOURCE_SIZE;
        const spriteCtx = spriteCanvas.getContext("2d");
        if (!spriteCtx) return null;

        spriteCtx.translate(SHATTER_SOURCE_SIZE / 2, SHATTER_SOURCE_SIZE / 2);
        spriteCtx.rotate(state.player?.angle || 0);
        drawCurrentPlayerSprite(spriteCtx);
        return spriteCanvas;
    }

    function triggerGameOver() {
        const p = state.player;
        if (!p || state.isGameOver) return;

        const spriteCanvas = capturePlayerSprite();
        const spriteCtx = spriteCanvas?.getContext("2d");
        const spriteData = spriteCtx?.getImageData(0, 0, SHATTER_SOURCE_SIZE, SHATTER_SOURCE_SIZE);
        const pieces = [];
        const centerX = p.x + PLAYER_SIZE / 2;
        const centerY = p.y + PLAYER_SIZE / 2;

        if (spriteData) {
            const { data, width, height } = spriteData;
            for (let sy = 0; sy < height; sy += SHATTER_TILE_SIZE) {
                for (let sx = 0; sx < width; sx += SHATTER_TILE_SIZE) {
                    const sw = Math.min(SHATTER_TILE_SIZE, width - sx);
                    const sh = Math.min(SHATTER_TILE_SIZE, height - sy);
                    if (!spriteTileHasPixels(data, width, sx, sy, sw, sh)) continue;

                    const offsetX = sx + sw / 2 - width / 2;
                    const offsetY = sy + sh / 2 - height / 2;
                    const distance = Math.hypot(offsetX, offsetY) || 1;
                    const blast = SHATTER_BLAST_SPEED * (0.55 + Math.random() * 0.9);
                    const windPush = 280 + Math.random() * 220;

                    pieces.push({
                        source: spriteCanvas,
                        sx,
                        sy,
                        sw,
                        sh,
                        x: centerX + offsetX,
                        y: centerY + offsetY,
                        vx: (offsetX / distance) * blast * 0.35 - windPush + (Math.random() - 0.5) * 60,
                        vy: (offsetY / distance) * blast * 0.22 - (180 + Math.random() * 280),
                        rotation: (Math.random() - 0.5) * 0.6,
                        vr: (Math.random() - 0.5) * SHATTER_SPIN_SPEED,
                    });
                }
            }
        }

        if (!pieces.length) {
            for (let i = 0; i < 72; i += 1) {
                const angle = (Math.PI * 2 * i) / 72 + (Math.random() - 0.5) * 0.1;
                const blast = SHATTER_BLAST_SPEED * (0.5 + Math.random() * 0.8);
                const windPush = 280 + Math.random() * 220;
                pieces.push({
                    source: null,
                    sx: 0,
                    sy: 0,
                    sw: 6 + Math.random() * 6,
                    sh: 6 + Math.random() * 6,
                    x: centerX + (Math.random() - 0.5) * PLAYER_SIZE * 0.7,
                    y: centerY + (Math.random() - 0.5) * PLAYER_SIZE * 0.7,
                    vx: Math.cos(angle) * blast * 0.35 - windPush,
                    vy: Math.sin(angle) * blast * 0.25 - (180 + Math.random() * 260),
                    rotation: Math.random() * Math.PI * 2,
                    vr: (Math.random() - 0.5) * SHATTER_SPIN_SPEED,
                });
            }
        }

        state.shatterPieces = pieces;
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
        p.vy = 0;
        syncGameOverChrome();
        window.SurfAudio?.playCrash?.();
        window.SurfAudio?.pause?.();
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
        createPlayer();
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

    function smoothStep01(t) {
        return t * t * (3 - 2 * t);
    }

    function triggerScoreFlash() {
        state.scoreFlash = 1;
    }

    function updateScoreRoll(dt) {
        const scoreInt = Math.floor(state.score);
        const previousScoreInt = state.scoreRoll.lastScoreInt;
        const currentText = scoreInt.toString();
        const previousText = previousScoreInt.toString();
        const currentLeadingDigit = currentText.charAt(0) || "0";
        const previousLeadingDigit = previousText.charAt(0) || "0";

        if (
            scoreInt !== previousScoreInt &&
            (currentText.length !== previousText.length || currentLeadingDigit !== previousLeadingDigit)
        ) {
            state.scoreRoll.active = true;
            state.scoreRoll.progress = 0;
            state.scoreRoll.fromDigit = previousLeadingDigit;
            state.scoreRoll.toDigit = currentLeadingDigit;
        }

        state.scoreRoll.lastScoreInt = scoreInt;
        sessionHighScore.update(scoreInt);

        if (state.scoreRoll.active) {
            state.scoreRoll.progress += dt / SCORE_ROLL_DURATION;
            if (state.scoreRoll.progress >= 1) {
                state.scoreRoll.progress = 1;
                state.scoreRoll.active = false;
                state.scoreRoll.fromDigit = state.scoreRoll.toDigit;
            }
        }

        if (state.scoreFlash > 0) {
            state.scoreFlash = Math.max(0, state.scoreFlash - dt / SCORE_FLASH_DURATION);
        }
    }

    function sampleEEG(index) {
        if (!state.eegReady || !state.eegLength) {
            return 0;
        }

        let sum = 0;
        for (let offset = -SMOOTH_WINDOW; offset <= SMOOTH_WINDOW; offset += 1) {
            sum += loopedSample(state.eegValues, index + offset) || 0;
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

    function computeTerrain(dt, options = {}) {
        const { trackPlayer = true, updateAudio = true } = options;
        const p = state.player;
        const baselineY = state.groundY;
        const width = viewport.width;
        const wasOnGround = p.onGround;
        const sampleRate = state.eegSampleRate || 50;

        state.eegTime += dt * EEG_SCROLL_SPEED;
        const localTimeSec = state.eegTime + state.eegStartOffsetSec;
        state.lastEffectiveTime = localTimeSec + state.eegDisplayOffsetSec;
        updateStage(localTimeSec);

        const headSample = Math.floor(localTimeSec * sampleRate);
        state.currentHeadSample = headSample;
        const maxWaveHeight = baselineY - TOP_MARGIN;
        state.terrainProfile = new Array(width);

        for (let x = 0; x < width; x += 1) {
            const sampleIndex = Math.round(headSample - (width - 1 - x) * HORIZONTAL_SAMPLE_STEP);
            let amp = (sampleEEG(sampleIndex) + 1) / 2;
            amp = Math.min(1, Math.max(0, amp * AMP_SCALE));
            state.terrainProfile[x] = Math.max(TOP_MARGIN, baselineY - amp * maxWaveHeight);
        }

        if (trackPlayer) {
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
                    triggerScoreFlash();
                    window.SurfAudio?.playCrash?.();
                }
                state.currentTrick = null;
                state.trickTimer = 0;
                state.trickLocked = false;
                state.glideActive = false;
            }
        }

        state.currentWaveAmp = (sampleEEG(headSample) + 1) / 2;
        if (updateAudio) window.SurfAudio?.update?.(p.onGround, state.currentWaveAmp, state.currentTrick);
    }

    function updateParticles(dt, emitTrail = true) {
        const p = state.player;
        if (emitTrail && p.onGround && !state.shatterPieces.length) {
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

    function updateShatterPieces(dt) {
        state.gameOverTimer += dt;
        state.gameOverFade = Math.max(
            0,
            Math.min(1, (state.gameOverTimer - GAME_OVER_FADE_DELAY) / GAME_OVER_FADE_DURATION)
        );

        state.shatterPieces = state.shatterPieces.filter((piece) => {
            piece.vx += SHATTER_WIND_ACCEL * dt;
            piece.vy += SHATTER_GRAVITY * dt;
            piece.x += piece.vx * dt;
            piece.y += piece.vy * dt;
            piece.rotation += piece.vr * dt;
            return piece.y - piece.sh < viewport.height + 180;
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
        if (!state.player) return;
        if (state.isTabPaused) return;

        if (state.isGameOver) {
            const bgWidth = images.background.width * state.bgScale || 1;
            state.bgScrollX = (state.bgScrollX + BG_SCROLL_SPEED * dt) % bgWidth;
            computeTerrain(dt, { trackPlayer: false, updateAudio: false });
            window.SpikeSystem?.update?.(
                dt,
                state.terrainProfile,
                { x: -9999, y: -9999 },
                PLAYER_SIZE,
                viewport.width,
                viewport.height
            );
            updateParticles(dt, false);
            updateShatterPieces(dt);
            updateScoreRoll(dt);
            return;
        }

        if (state.isLoadingEeg) {
            state.loadingSpinAngle += dt * 4.8;
            return;
        }

        state.score += dt * SCORE_SPEED;

        const bgWidth = images.background.width * state.bgScale || 1;
        state.bgScrollX = (state.bgScrollX + BG_SCROLL_SPEED * dt) % bgWidth;

        const p = state.player;
        const gravity = state.currentTrick === "glide" ? GLIDE_GRAVITY : GRAVITY;
        if (state.currentTrick === "glide") p.vy = 80;
        p.vy += gravity * dt;
        p.y += p.vy * dt;

        computeTerrain(dt);
        window.SpikeSystem?.update?.(
            dt,
            state.terrainProfile,
            p,
            PLAYER_SIZE,
            viewport.width,
            viewport.height
        );

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

        updateScoreRoll(dt);
    }

    function drawBackground() {
        if (!images.background.width || !state.terrainProfile.length) return;
        const width = viewport.width;
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
        if (state.terrainProfile.length !== viewport.width) return;
        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        for (let x = 0; x < viewport.width; x += 1) {
            if (x === 0) ctx.moveTo(x + 0.5, state.terrainProfile[x] + 0.5);
            else ctx.lineTo(x + 0.5, state.terrainProfile[x] + 0.5);
        }
        ctx.strokeStyle = "#000";
        ctx.stroke();
    }

    function drawWaveProbe() {
        if (state.waveProbeX === null || state.terrainProfile.length !== viewport.width) return;

        const x = clamp(Math.round(state.waveProbeX), 0, Math.max(0, viewport.width - 1));
        const y = state.terrainProfile[x];
        if (!Number.isFinite(y)) return;

        const sampleIndex = sampleIndexForCanvasX(x);
        const label = formatProbeLabel(sampleIndex);
        const labelPaddingX = 10;
        const labelHeight = 28;

        ctx.save();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.22)";
        ctx.beginPath();
        ctx.moveTo(x + 0.5, TOP_MARGIN);
        ctx.lineTo(x + 0.5, state.groundY);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + 0.5, y + 0.5, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = "bold 14px 'Courier New', monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        const textWidth = ctx.measureText(label).width;
        const boxWidth = textWidth + labelPaddingX * 2;
        let boxX = x + 16;
        if (boxX + boxWidth > viewport.width - 8) boxX = viewport.width - boxWidth - 8;
        if (boxX < 8) boxX = 8;

        let boxY = y - 42;
        if (boxY < 8) boxY = Math.min(y + 16, viewport.height - labelHeight - 8);

        ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
        ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.rect(boxX, boxY, boxWidth, labelHeight);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#000";
        ctx.fillText(label, boxX + labelPaddingX, boxY + labelHeight / 2 + 0.5);
        ctx.restore();
    }

    function drawPlayer() {
        const p = state.player;
        if (state.hidePlayer || state.isGameOver || state.shatterPieces.length) return;
        const cx = p.x + PLAYER_SIZE / 2;
        const cy = p.y + PLAYER_SIZE / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(p.angle || 0);
        drawCurrentPlayerSprite(ctx);
        ctx.restore();
    }

    function drawEffects() {
        ctx.save();
        state.shatterPieces.forEach((piece) => {
            ctx.save();
            ctx.translate(piece.x, piece.y);
            ctx.rotate(piece.rotation);
            if (piece.source) {
                ctx.drawImage(
                    piece.source,
                    piece.sx,
                    piece.sy,
                    piece.sw,
                    piece.sh,
                    -piece.sw / 2,
                    -piece.sh / 2,
                    piece.sw,
                    piece.sh
                );
            } else {
                ctx.fillStyle = "#000";
                ctx.fillRect(-piece.sw / 2, -piece.sh / 2, piece.sw, piece.sh);
            }
            ctx.restore();
        });
        ctx.restore();

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
        ctx.fillText(`Stage: ${stagePretty(state.currentStageCode)}`, viewport.width / 2, viewport.height * 0.39 + 50);
        ctx.font = "16px 'Courier New', monospace";
        ctx.fillText(`EDF time: ${formatClock(state.lastEffectiveTime)}`, viewport.width / 2, viewport.height * 0.39 + 70);
        ctx.fillText(`Channel: ${state.channelName || "N/A"}`, viewport.width / 2, viewport.height * 0.39 + 90);
        ctx.font = "bold 16px 'Courier New', monospace";
        ctx.fillText(`High score: ${sessionHighScore.get()}`, viewport.width / 2, viewport.height * 0.39 + 110);
        ctx.globalAlpha = 0.18;
        ctx.font = "bold 96px 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";
        ctx.fillStyle = getScoreDisplayColor();
        drawRollingScore(viewport.width / 2, viewport.height * 0.39);
        ctx.restore();
    }

    function getScoreDisplayColor() {
        if (state.scoreFlash <= 0) return "#000";
        const flash = smoothStep01(state.scoreFlash);
        const red = Math.round(255 * flash);
        const green = Math.round(78 * flash);
        const blue = Math.round(78 * flash);
        return `rgb(${red}, ${green}, ${blue})`;
    }

    function drawLoadingState() {
        const centerX = viewport.width / 2;
        const centerY = viewport.height * 0.39;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(state.loadingSpinAngle);

        if (images.player.complete && images.player.naturalWidth > 0) {
            ctx.drawImage(images.player, -PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
        } else {
            ctx.fillStyle = "#000";
            ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
        }
        ctx.restore();

        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
        ctx.font = "bold 26px 'Courier New', monospace";
        ctx.fillText("Loading EEG...", centerX, centerY + 78);
        ctx.font = "16px 'Courier New', monospace";
        ctx.fillText("Preparing the wave for surfing", centerX, centerY + 108);
        ctx.restore();
    }

    function drawRollingScore(x, y) {
        const currentText = Math.floor(state.score).toString();
        const currentDigit = currentText.charAt(0) || "0";
        const currentRest = currentText.slice(1);
        if (!state.scoreRoll.active) {
            ctx.fillText(currentText, x, y);
            return;
        }

        const t = smoothStep01(Math.max(0, Math.min(1, state.scoreRoll.progress)));
        const outgoingY = y + SCORE_ROLL_OFFSET * t;
        const incomingY = y - SCORE_ROLL_OFFSET * (1 - t);
        const restText = currentRest;
        const digitWidth = Math.max(
            ctx.measureText(state.scoreRoll.fromDigit || currentDigit).width,
            ctx.measureText(state.scoreRoll.toDigit || currentDigit).width
        );
        const restWidth = ctx.measureText(restText).width;
        const totalWidth = digitWidth + restWidth;
        const leftX = x - totalWidth / 2;

        ctx.save();
        ctx.textAlign = "left";
        ctx.fillText(restText, leftX + digitWidth, y);
        ctx.restore();

        ctx.save();
        ctx.textAlign = "left";
        ctx.globalAlpha *= 1 - t;
        ctx.fillText(state.scoreRoll.fromDigit, leftX, outgoingY);
        ctx.restore();

        ctx.save();
        ctx.textAlign = "left";
        ctx.globalAlpha *= t;
        ctx.fillText(state.scoreRoll.toDigit || currentDigit, leftX, incomingY);
        ctx.restore();
    }

    function drawGameOver() {
        const fade = smoothStep01(state.gameOverFade);
        const centerX = viewport.width / 2;
        const centerY = viewport.height * 0.39;

        ctx.save();
        const overlayGradient = ctx.createLinearGradient(0, 0, 0, viewport.height);
        overlayGradient.addColorStop(0, `rgba(12, 10, 10, ${0.32 * fade})`);
        overlayGradient.addColorStop(0.45, `rgba(12, 10, 10, ${0.58 * fade})`);
        overlayGradient.addColorStop(1, `rgba(12, 10, 10, ${0.8 * fade})`);
        ctx.fillStyle = overlayGradient;
        ctx.fillRect(0, 0, viewport.width, viewport.height);
        ctx.restore();

        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = fade;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 40px 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";
        ctx.fillText("GAME OVER", centerX, centerY - 96 + (1 - fade) * 12);
        ctx.font = "bold 96px 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";
        ctx.fillText(Math.floor(state.score).toString(), centerX, centerY + (1 - fade) * 8);
        ctx.font = "bold 20px 'Courier New', monospace";
        ctx.fillText(`High score: ${sessionHighScore.get()}`, centerX, centerY + 58 + (1 - fade) * 8);
        ctx.font = "20px 'Courier New', monospace";
        ctx.fillText("Press R to restart", centerX, centerY + 86 + (1 - fade) * 10);
        ctx.restore();
    }

    function draw() {
        ctx.fillStyle = "#EAE7D9";
        ctx.fillRect(0, 0, viewport.width, viewport.height);
        if (state.isLoadingEeg) {
            drawLoadingState();
        } else {
            drawBackground();
            drawWave();
            window.SpikeSystem?.draw?.(ctx, state.terrainProfile);
            drawPlayer();
            drawEffects();
            drawWaveProbe();
            if (state.isGameOver) drawGameOver();
            else drawHud();
        }
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
        const idx = Math.max(0, Math.min(viewport.width - 1, Math.round(p.x + PLAYER_SIZE / 2)));
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
        parseEdfBuffer(buffer, {
            channelIndex,
            datasetKey: "user",
            resetStages: true,
            useEdfStartTime: true,
            statusText: "EEG: user EDF loaded - hover the wave for original uV magnitude",
        });
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
        if (state.lastUploadedEdfBuffer && state.lastUploadedEdfLabels) {
            if (state.datasetKey === "user") {
                parseUploadedEdf(state.lastUploadedEdfBuffer, parseInt(select.value, 10));
            } else {
                parseEdfBuffer(state.lastUploadedEdfBuffer, {
                    channelIndex: parseInt(select.value, 10),
                    datasetKey: state.datasetKey,
                    resetStages: false,
                    useEdfStartTime: false,
                    statusText: `EEG: original EDF loaded (${DATASETS[state.datasetKey]?.label || "dataset"}) - hover for original uV magnitude`,
                });
            }
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

    canvas.addEventListener("pointermove", setWaveProbeFromPointer);
    canvas.addEventListener("pointerdown", setWaveProbeFromPointer);
    canvas.addEventListener("pointerleave", () => {
        state.waveProbeX = null;
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
    });
    window.addEventListener("blur", () => {
        state.isTabPaused = true;
        state.lastTime = performance.now();
        clearHeldInput();
        window.SurfAudio?.pause?.();
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
            window.SurfAudio?.pause?.();
        }
    });

    resizeCanvas();
    createPlayer();
    syncDatasetButtons();
    window.SpikeSystem?.init?.({
        jumpVelocity: JUMP_VELOCITY,
        onHit: () => {
            triggerGameOver();
        },
    });
    restartEntranceAnimation();
    loadDataset();

    requestAnimationFrame((timestamp) => {
        state.lastTime = timestamp;
        loop(timestamp);
    });
})();
