(function (global) {
    const BrainSurfingStages = {
        initFromJson(state, data, datasetKey) {
            const segments = Array.isArray(data?.segments) ? data.segments : [];
            state.sleepSegments = segments
                .filter((segment) => typeof segment.t === "number" && typeof segment.stage === "string")
                .sort((a, b) => a.t - b.t);

            const firstN1 = state.sleepSegments.find((segment) => segment.stage === "N1");
            const firstNonWake = state.sleepSegments.find((segment) => segment.stage !== "W");
            const sourceOffsetSec = Number.isFinite(data?.sourceOffsetSec) ? data.sourceOffsetSec : null;

            state.eegStartOffsetSec = sourceOffsetSec === null
                ? datasetKey === "seizure"
                    ? 300
                    : firstN1?.t ?? firstNonWake?.t ?? 0
                : 0;
            state.eegDisplayOffsetSec = sourceOffsetSec === null ? 0 : sourceOffsetSec;
            state.sleepIndex = 0;
            state.lastEffectiveTime = state.eegStartOffsetSec + state.eegDisplayOffsetSec;
            state.currentStageCode = state.sleepSegments[0]?.stage || null;
        },

        loadFromUrl(url) {
            return fetch(url).then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            });
        },

        reset(state) {
            state.sleepSegments = [];
            state.sleepIndex = 0;
            state.currentStageCode = null;
        },

        updateCurrentStage(state, timeSec) {
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
        },

        prettyLabel(datasetKey, code, datasets, stageLabelsByDataset) {
            const dataset = datasets?.[datasetKey];
            if (!dataset?.hasStages || !code) return "No stage data";
            return stageLabelsByDataset?.[datasetKey]?.[code] || code;
        },
    };

    global.BrainSurfingStages = BrainSurfingStages;
})(window);
