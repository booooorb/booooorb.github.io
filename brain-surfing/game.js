(function () {
  const canvas = document.getElementById("game-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const PLAYER_SIZE = 40;
  const GRAVITY = 2600;         // px/s^2
  const JUMP_VELOCITY = -1200;  // px/s
  const GROUND_MARGIN = 10;     // distance from bottom to baseline
  const TOP_MARGIN = 20;        // min distance from top for the wave

  const EEG_SCROLL_SPEED = 3.0;        // how fast the wave moves left (× real time)
  const SMOOTH_WINDOW = 25;            // moving-average half-window (25 -> 51 samples)
  const HORIZONTAL_SAMPLE_STEP = 0.3;  // samples per pixel horizontally (<1 = smoother, longer waves)
  const AMP_SCALE = 1.5;               // gentle amplitude boost after normalization

  // This will be set automatically from the hypnogram (first N1 or first non-W)
  let EEG_START_OFFSET_SEC = 0;

  // Pretty labels for the stage codes we stored in JSON ("W", "N1", etc.)
  const STAGE_LABELS = {
    W: "Wake",
    N1: "N1 – light sleep",
    N2: "N2 – light sleep",
    N3: "N3 – deep sleep",
    N4: "N4 – deep sleep",
    REM: "REM sleep",
    R: "REM sleep",
  };

  // Top-left: EEG status
  const statusEl = document.createElement("div");
  statusEl.textContent = "EEG: loading…";
  Object.assign(statusEl.style, {
    position: "fixed",
    top: "8px",
    left: "8px",
    padding: "4px 8px",
    background: "rgba(0,0,0,0.6)",
    color: "#f4f4f4",
    fontFamily: "Courier New, monospace",
    fontSize: "12px",
    borderRadius: "4px",
    zIndex: "9999",
  });
  document.body.appendChild(statusEl);

  // Bottom-left: scaling info
  const infoEl = document.createElement("div");
  Object.assign(infoEl.style, {
    position: "fixed",
    bottom: "8px",
    left: "8px",
    maxWidth: "360px",
    padding: "6px 8px",
    background: "rgba(0,0,0,0.55)",
    color: "#f4f4f4",
    fontFamily: "Courier New, monospace",
    fontSize: "11px",
    borderRadius: "4px",
    lineHeight: "1.3",
    zIndex: "9999",
  });
  infoEl.innerHTML = [
    "EEG processing:",
    "- values normalized to [-1, 1]",
    `- smoothing: ${(SMOOTH_WINDOW * 2 + 1)}-sample moving avg`,
    `- amplitude scale: ×${AMP_SCALE}, clipped`,
    `- horizontal stretch: ${HORIZONTAL_SAMPLE_STEP} samples/px`,
    `- scroll speed: ${EEG_SCROLL_SPEED}× real time`,
  ].join("<br>");
  document.body.appendChild(infoEl);

  let groundY;
  let player;
  let lastTime = performance.now();

  // For terrain + slope
  let terrainProfile = [];

  // EEG data
  let eegReady = false;
  let eegSampleRate = 0;
  let eegValues = [];  // normalized [-1,1]
  let eegLength = 0;
  let eegTime = 0;     // seconds since game start; EDF offset applied separately
  let lastEffectiveTime = 0; // EDF time (seconds from recording start) for HUD

  // Sleep stage data
  let sleepSegments = [];       // [{t, stage}]
  let sleepIndex = 0;
  let currentStageCode = null;

  // ===== UTILS =====
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
    if (!code) return "Unknown";
    return STAGE_LABELS[code] || code;
  }

  fetch("brainwave_runner_data.json")
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then((data) => {
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
        "- channel from EDF, normalized to [-1, 1]",
        `- smoothing: ${smoothSamples}-sample moving avg (~${smoothSec}s @ ${eegSampleRate}Hz)`,
        `- amplitude scale: ×${AMP_SCALE}, clipped to fit canvas`,
        `- horizontal stretch: ${HORIZONTAL_SAMPLE_STEP} samples/px`,
        `- scroll speed: ${EEG_SCROLL_SPEED}× real time`,
      ].join("<br>");

      console.log("EEG data loaded:", eegLength, "samples at", eegSampleRate, "Hz");
    })
    .catch((err) => {
      console.error("Failed to load/normalize EEG data:", err);
      statusEl.textContent = "EEG: FAILED, using fake sine wave";
      statusEl.style.background = "rgba(128,0,0,0.7)";
      eegReady = false;
    });

  fetch("brainwave_stages.json")
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then((data) => {
      const segs = Array.isArray(data.segments) ? data.segments : [];
      if (!segs.length) throw new Error("No segments in stages JSON");

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

      console.log("EEG_START_OFFSET_SEC set to", EEG_START_OFFSET_SEC, "seconds");

      // Initialize to that stage for HUD
      sleepIndex = 0;
      updateSleepStageForTime(EEG_START_OFFSET_SEC);
      lastEffectiveTime = EEG_START_OFFSET_SEC;
    })
    .catch((err) => {
      console.warn("Failed to load sleep stages JSON:", err);
      // We'll just show "Unknown" in HUD
    });

  function initCanvasSizeOnce() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    groundY = canvas.height - GROUND_MARGIN;
  }

  function createPlayer() {
    player = {
      x: canvas.width / 2 - PLAYER_SIZE / 2,
      y: groundY - PLAYER_SIZE,
      vy: 0,
      onGround: true,
      angle: 0, // radians
    };
  }

  function resetGame() {
    createPlayer();
    eegTime = 0;   // game-time starts at 0; we add EDF offset separately
    sleepIndex = 0;
  }

  // ===== SLEEP STAGE LOOKUP =====
  function updateSleepStageForTime(tSec) {
    if (!sleepSegments.length) {
      currentStageCode = null;
      return;
    }

    // Monotonic time; just move pointer forward if needed
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
      // fallback: fake smooth sine wave in [-1,1]
      if (eegSampleRate === 0) eegSampleRate = 50;
      const t = index / eegSampleRate;
      return Math.sin(t * 2 * Math.PI * 0.5);
    }
  }

  // Draw EEG as a smooth LINE with long wavelengths + collision + slope angle
  function drawWaveAndCollide(dt) {
    const w = canvas.width;
    const baselineY = groundY;

    if (eegSampleRate === 0) eegSampleRate = 50;

    // advance game-time and convert to EDF time
    eegTime += dt * EEG_SCROLL_SPEED;
    const effectiveTime = eegTime + EEG_START_OFFSET_SEC;
    lastEffectiveTime = effectiveTime;

    // update sleep stage for HUD
    updateSleepStageForTime(effectiveTime);

    const headSample = Math.floor(effectiveTime * eegSampleRate);

    const maxWaveHeight = baselineY - TOP_MARGIN;
    const playerCenterX = player.x + PLAYER_SIZE / 2;
    let waveYAtPlayer = baselineY;

    terrainProfile = new Array(w);

    ctx.beginPath();
    // smoother strokes
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.imageSmoothingEnabled = true;

    for (let x = 0; x < w; x++) {
      const samplesBehindHead = w - 1 - x;

      // fractional step to stretch waveform horizontally
      const sampleOffset = samplesBehindHead * HORIZONTAL_SAMPLE_STEP;
      const sampleIndex = Math.round(headSample - sampleOffset);

      const v = sampleEEG(sampleIndex); // [-1,1]

      // map [-1,1] → [0,1]
      let amp01 = (v + 1) / 2;
      amp01 = Math.min(1, Math.max(0, amp01 * AMP_SCALE)); // slight boost

      let waveY = baselineY - amp01 * maxWaveHeight;
      if (waveY < TOP_MARGIN) waveY = TOP_MARGIN;

      terrainProfile[x] = waveY;

      if (x === 0) {
        ctx.moveTo(x + 0.5, waveY + 0.5); // half-pixel to reduce aliasing
      } else {
        ctx.lineTo(x + 0.5, waveY + 0.5);
      }

      if (Math.abs(x - playerCenterX) < 1) {
        waveYAtPlayer = waveY;
      }
    }

    ctx.strokeStyle = "#000000";
    ctx.stroke();

    // collision: simple y-clamp against wave at player's x
    const playerBottom = player.y + PLAYER_SIZE;
    if (playerBottom > waveYAtPlayer) {
      player.y = waveYAtPlayer - PLAYER_SIZE;
      player.vy = 0;
      player.onGround = true;
    }

    // compute slope angle under player for rotation
    const idx = Math.round(playerCenterX);
    if (idx >= 0 && idx < w && terrainProfile.length === w) {
      const leftIdx = Math.max(0, idx - 2);
      const rightIdx = Math.min(w - 1, idx + 2);
      const yL = terrainProfile[leftIdx];
      const yR = terrainProfile[rightIdx];
      const dx = rightIdx - leftIdx || 1;
      const dy = yR - yL;

      const targetAngle = Math.atan2(dy, dx); // radians

      if (Number.isFinite(targetAngle)) {
        const blend = 0.25;
        if (!Number.isFinite(player.angle)) {
          player.angle = targetAngle;
        } else {
          player.angle = player.angle + (targetAngle - player.angle) * blend;
        }
      }
    }
  }

  function update(dt) {
    if (!player) return;

    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;

    // clamp at ground
    const baseline = groundY - PLAYER_SIZE;
    if (player.y > baseline) {
      player.y = baseline;
      player.vy = 0;
      player.onGround = true;
    }

    // clamp at top
    const topClamp = TOP_MARGIN + 10;
    if (player.y < topClamp) {
      player.y = topClamp;
      if (player.vy < 0) player.vy = 0;
    }
  }

  function draw(dt) {
    const w = canvas.width;
    const h = canvas.height;

    // background
    ctx.fillStyle = "#EAE7D9";
    ctx.fillRect(0, 0, w, h);

    // EEG terrain + collision + rotation
    drawWaveAndCollide(dt);

    // player  
    const cx = player.x + PLAYER_SIZE / 2;
    const cy = player.y + PLAYER_SIZE / 2;
    const angle = player.angle || 0;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // outline
    ctx.fillStyle = "#EAE7D9";
    ctx.fillRect(
      -PLAYER_SIZE / 2 - 2,
      -PLAYER_SIZE / 2 - 2,
      PLAYER_SIZE + 4,
      PLAYER_SIZE + 4
    );

    ctx.fillStyle = "#000000";
    ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
    ctx.restore();

    // HUD (text info)
    const stageText = "Stage: " + stagePretty(currentStageCode);
    const timeText = "EDF time: " + formatClock(lastEffectiveTime);

    ctx.save();
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";

    ctx.font = "20px 'Courier New', monospace";
    ctx.fillStyle = "#000000";
    ctx.fillText(stageText, w - 16, h - 18);

    ctx.font = "16px 'Courier New', monospace";
    ctx.fillText(timeText, w - 16, h - 18 + 20);
    ctx.restore();
  }

  function loop(timestamp) {
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    update(dt);
    draw(dt);

    requestAnimationFrame(loop);
  }

  function jump() {
    if (!player || !player.onGround) return;
    player.onGround = false;
    player.vy = JUMP_VELOCITY;
  }

  // Controls: space / up / W / click/tap
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
  });

  window.addEventListener("pointerdown", () => {
    jump();
  });

  // Init
  initCanvasSizeOnce();
  createPlayer();
  requestAnimationFrame((t) => {
    lastTime = t;
    loop(t);
  });
})();

