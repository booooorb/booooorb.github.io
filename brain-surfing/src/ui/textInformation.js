(function (global) {
    function createBrainSurfingTextInformation(options) {
        const {
            dom,
            state,
            viewport,
            images,
            constants,
            datasets,
            stageLabels,
            sessionHighScore,
        } = options;

        const datasetInfo = {
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

        function smoothStep01(t) {
            return t * t * (3 - 2 * t);
        }

        function formatClock(tSec) {
            const total = ((tSec % 86400) + 86400) % 86400;
            const hours = Math.floor(total / 3600);
            const minutes = Math.floor((total % 3600) / 60);
            const seconds = Math.floor(total % 60);
            const pad = (value) => String(value).padStart(2, "0");
            return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
        }

        function hasOriginalEdfProbe() {
            return Boolean(state.lastUploadedEdfBuffer && state.eegProbeMeta);
        }

        function hasPhysicalReadout() {
            return Array.isArray(state.eegPhysicalValues) && state.eegPhysicalValues.length === state.eegLength;
        }

        function initInfoToggle() {
            if (!dom.infoToggle || !dom.info) return;

            dom.infoToggle.addEventListener("click", () => {
                const collapsed = dom.info.classList.toggle("collapsed");
                dom.infoToggle.textContent = collapsed ? "EEG info >" : "EEG info v";
            });
        }

        function syncDatasetButtons() {
            const buttons = dom.datasets?.querySelectorAll("button[data-dataset]");
            buttons?.forEach((button) => {
                const isActive = button.getAttribute("data-dataset") === state.datasetKey;
                button.classList.toggle("active", isActive);
                button.setAttribute("aria-pressed", isActive ? "true" : "false");
            });
        }

        function renderChannelDropdown() {
            const useEdfLabels = Array.isArray(state.lastUploadedEdfLabels) && state.lastUploadedEdfLabels.length > 1;
            const labels = useEdfLabels ? state.lastUploadedEdfLabels : state.availableChannels;

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

            const dataset = datasetInfo[state.datasetKey] || datasetInfo.user;
            const smoothSamples = constants.smoothWindow * 2 + 1;
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
                  <li>Amplitude scale: x${constants.ampScale}; horizontal stretch: ${constants.horizontalSampleStep} samples/px.</li>
                  <li>Wave scroll speed: ${constants.eegScrollSpeed}x real time.</li>
                </ul>
              </div>
            `;
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
                state.scoreRoll.progress += dt / constants.scoreRollDuration;
                if (state.scoreRoll.progress >= 1) {
                    state.scoreRoll.progress = 1;
                    state.scoreRoll.active = false;
                    state.scoreRoll.fromDigit = state.scoreRoll.toDigit;
                }
            }

            if (state.scoreFlash > 0) {
                state.scoreFlash = Math.max(0, state.scoreFlash - dt / constants.scoreFlashDuration);
            }
        }

        function getScoreDisplayColor() {
            if (state.scoreFlash <= 0) return "#000";
            const flash = smoothStep01(state.scoreFlash);
            const red = Math.round(255 * flash);
            const green = Math.round(78 * flash);
            const blue = Math.round(78 * flash);
            return `rgb(${red}, ${green}, ${blue})`;
        }

        function drawRollingScore(ctx, x, y) {
            const currentText = Math.floor(state.score).toString();
            const currentDigit = currentText.charAt(0) || "0";
            const currentRest = currentText.slice(1);

            if (!state.scoreRoll.active) {
                ctx.fillText(currentText, x, y);
                return;
            }

            const t = smoothStep01(Math.max(0, Math.min(1, state.scoreRoll.progress)));
            const outgoingY = y + constants.scoreRollOffset * t;
            const incomingY = y - constants.scoreRollOffset * (1 - t);
            const digitWidth = Math.max(
                ctx.measureText(state.scoreRoll.fromDigit || currentDigit).width,
                ctx.measureText(state.scoreRoll.toDigit || currentDigit).width
            );
            const restWidth = ctx.measureText(currentRest).width;
            const totalWidth = digitWidth + restWidth;
            const leftX = x - totalWidth / 2;

            ctx.save();
            ctx.textAlign = "left";
            ctx.fillText(currentRest, leftX + digitWidth, y);
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

        function drawHud(ctx) {
            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#000";
            ctx.font = "20px 'Courier New', monospace";
            ctx.fillText(
                `Stage: ${global.BrainSurfingStages.prettyLabel(state.datasetKey, state.currentStageCode, datasets, stageLabels)}`,
                viewport.width / 2,
                viewport.height * 0.39 + 50
            );
            ctx.font = "16px 'Courier New', monospace";
            ctx.fillText(`EDF time: ${formatClock(state.lastEffectiveTime)}`, viewport.width / 2, viewport.height * 0.39 + 70);
            ctx.fillText(`Channel: ${state.channelName || "N/A"}`, viewport.width / 2, viewport.height * 0.39 + 90);
            ctx.font = "bold 16px 'Courier New', monospace";
            ctx.fillText(`High score: ${sessionHighScore.get()}`, viewport.width / 2, viewport.height * 0.39 + 110);
            ctx.globalAlpha = 0.18;
            ctx.font = "bold 96px 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";
            ctx.fillStyle = getScoreDisplayColor();
            drawRollingScore(ctx, viewport.width / 2, viewport.height * 0.39);
            ctx.restore();
        }

        function drawLoadingState(ctx) {
            const centerX = viewport.width / 2;
            const centerY = viewport.height * 0.39;

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(state.loadingSpinAngle);

            if (images.player.complete && images.player.naturalWidth > 0) {
                ctx.drawImage(
                    images.player,
                    -constants.playerSize / 2,
                    -constants.playerSize / 2,
                    constants.playerSize,
                    constants.playerSize
                );
            } else {
                ctx.fillStyle = "#000";
                ctx.fillRect(
                    -constants.playerSize / 2,
                    -constants.playerSize / 2,
                    constants.playerSize,
                    constants.playerSize
                );
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

        function drawGameOver(ctx) {
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

        return {
            initInfoToggle,
            syncDatasetButtons,
            renderChannelDropdown,
            updateInfoPanel,
            triggerScoreFlash,
            updateScoreRoll,
            drawHud,
            drawLoadingState,
            drawGameOver,
        };
    }

    global.createBrainSurfingTextInformation = createBrainSurfingTextInformation;
})(window);
