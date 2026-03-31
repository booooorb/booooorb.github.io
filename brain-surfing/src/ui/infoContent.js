(function (global) {
    const datasetInfo = Object.freeze({
        sleep: Object.freeze({
            badge: "Sleep demo",
            sourceLabel: "Sleep-EDF Expanded",
            sourceUrl: "https://www.physionet.org/content/sleep-edfx/1.0.0/",
            sourceDetail: "Sleep cassette example SC4001E0-PSG.edf",
            originalSampleRate: "100 Hz",
            summary: "Overnight polysomnography from PhysioNet's Sleep-EDF Expanded collection.",
            notes: Object.freeze([
                "Default gameplay channel uses Fpz-Cz from the source recording.",
                "This demo loads a short slice of the overnight recording so the game starts quickly.",
                "The game keeps the waveform looping and rescales it visually for surfing.",
                "Stage labels in the HUD come from the accompanying sleep stage annotations.",
            ]),
        }),
        seizure: Object.freeze({
            badge: "Seizure demo",
            sourceLabel: "Siena Scalp EEG Database",
            sourceUrl: "https://www.physionet.org/content/siena-scalp-eeg/1.0.0/",
            sourceDetail: "Patient 12, recording 3",
            originalSampleRate: "512 Hz",
            summary: "Clinical scalp EEG from the University of Siena, published on PhysioNet.",
            notes: Object.freeze([
                "The original recordings use the international 10-20 electrode system.",
                "This demo loads a short seizure-centered EDF slice so the original probe data stays fast to load.",
                "This demo uses a seizure-oriented channel selection and loops the processed waveform.",
                "The game timing is gameplay-oriented, not a diagnostic viewer.",
            ]),
        }),
        user: Object.freeze({
            badge: "User EDF",
            sourceLabel: "Local upload",
            sourceUrl: "",
            sourceDetail: "Custom EDF chosen in your browser",
            originalSampleRate: "Varies by file",
            summary: "Your uploaded EDF is parsed locally in the browser and converted for the game.",
            notes: Object.freeze([
                "The game auto-picks a channel, but you can switch channels from the dropdown on desktop.",
                "The surf wave still uses a normalized gameplay copy, but the probe keeps the raw EDF amplitude readout.",
            ]),
        }),
    });

    const surfSteps = Object.freeze([
        {
            label: "Jump",
            detail: "Press Space, W, or Up. On phones, a tap also jumps.",
        },
        {
            label: "Glide",
            detail: "Hold the same input while you are in the air.",
        },
        {
            label: "Flip",
            detail: "Tap and release in the air for a quick trick.",
        },
        {
            label: "Restart",
            detail: "Press R after a crash. On mobile, tapping the game-over screen does the same thing.",
        },
    ]);

    function getDatasetInfo(datasetKey) {
        return datasetInfo[datasetKey] || datasetInfo.user;
    }

    function renderSourceLink(dataset) {
        if (!dataset.sourceUrl) {
            return `<strong>${dataset.sourceLabel}</strong>`;
        }

        return `<a class="info-source" href="${dataset.sourceUrl}" target="_blank" rel="noreferrer">${dataset.sourceLabel}</a>`;
    }

    function renderDatasetSection(datasetKey, heading) {
        const dataset = getDatasetInfo(datasetKey);

        return `
          <section class="info-section">
            <div class="info-heading">
              <div class="info-title">${heading || "About This Dataset"}</div>
              <span class="info-chip">${dataset.badge}</span>
            </div>
            <dl class="info-meta">
              <dt>Source</dt>
              <dd>${renderSourceLink(dataset)}</dd>
              <dt>Record</dt>
              <dd>${dataset.sourceDetail}</dd>
              <dt>Original rate</dt>
              <dd>${dataset.originalSampleRate}</dd>
            </dl>
            <div class="info-section">
              <div class="info-section-title">Dataset Notes</div>
              <ul class="info-list">
                <li>${dataset.summary}</li>
                ${dataset.notes.map((note) => `<li>${note}</li>`).join("")}
              </ul>
            </div>
          </section>
        `;
    }

    function renderHowToSurfSection() {
        return `
          <section class="info-section">
            <div class="info-section-title">How To Surf</div>
            <ul class="info-list">
              ${surfSteps.map((step) => `<li><strong>${step.label}:</strong> ${step.detail}</li>`).join("")}
            </ul>
          </section>
        `;
    }

    global.BrainSurfingInfoContent = {
        datasetInfo,
        getDatasetInfo,
        renderDatasetSection,
        renderHowToSurfSection,
    };
})(window);
