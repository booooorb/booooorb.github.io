(function (global) {
    function createBrainSurfingEegManager(options) {
        const {
            state,
            datasets,
            textInformation,
            setStatus,
            restartEntranceAnimation,
            statusColors,
            resetSpikes,
        } = options;

        function channelsFrom(data) {
            return data?.visualValuesByChannel || data?.channels || data?.valuesByChannel || null;
        }

        function physicalChannelsFrom(data) {
            return data?.physicalValuesByChannel || data?.physicalByChannel || null;
        }

        function resetSignalState(optionsOverride) {
            const { loading = false } = optionsOverride || {};

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

        function resetTimelineState() {
            global.BrainSurfingStages.reset(state);
            state.eegStartOffsetSec = 0;
            state.eegDisplayOffsetSec = 0;
            state.lastEffectiveTime = 0;
        }

        function applyEEGData(data, statusText) {
            state.lastEEGJson = data;
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
                state.currentEdfChannelIndex = Number.isFinite(data.channelIndex)
                    ? data.channelIndex
                    : state.currentEdfChannelIndex;
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

            let maxAmplitude = 0;
            for (let i = 0; i < visualRaw.length; i += 1) {
                const abs = Math.abs(visualRaw[i]);
                if (abs > maxAmplitude) maxAmplitude = abs;
            }

            if (!maxAmplitude) throw new Error("All EEG samples are zero");

            state.eegValues = visualRaw.map((value) => value / maxAmplitude);
            state.eegPhysicalValues = Array.isArray(physicalRaw) && physicalRaw.length === visualRaw.length
                ? physicalRaw.slice()
                : null;
            state.eegPhysicalUnit = typeof data.amplitudeUnit === "string" ? data.amplitudeUnit : "";
            state.eegProbeMeta = data?.probeMeta || null;
            state.eegLength = state.eegValues.length;
            state.eegReady = true;
            state.isLoadingEeg = false;

            if (state.waveProbeX !== null) {
                state.waveProbeX = Math.max(0, Math.min(state.waveProbeX, Math.max(0, state.eegLength - 1)));
            }

            textInformation.renderChannelDropdown();
            textInformation.updateInfoPanel();
            restartEntranceAnimation();
            setStatus(
                statusText || `EEG: wave loaded (${state.eegLength} samples @ ${state.eegSampleRate} Hz)`,
                statusColors.success
            );
        }

        function beginSignalLoad(statusText) {
            setStatus(statusText, statusColors.neutral);
            resetSignalState({ loading: true });
            resetSpikes?.();
        }

        function handleLoadError(message, err) {
            console.error(message, err);
            state.isLoadingEeg = false;
            setStatus(message, statusColors.error);
        }

        function parseEdfBuffer(buffer, optionsOverride) {
            const {
                channelIndex,
                datasetKey = state.datasetKey,
                preferredLabels,
                resetStages = false,
                useEdfStartTime = false,
                statusText = null,
            } = optionsOverride || {};

            const json = global.BrainSurfingEdf.parseToJson(buffer, {
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
                global.BrainSurfingStages.reset(state);
            }

            if (useEdfStartTime) {
                state.eegStartOffsetSec = 0;
                state.eegDisplayOffsetSec = Number.isFinite(json.startTimeSec) ? json.startTimeSec : 0;
                state.lastEffectiveTime = state.eegDisplayOffsetSec;
            }

            applyEEGData(json, statusText || `EEG: wave loaded (${json.channelLabel || "channel"})`);
        }

        function loadEEGFromUrl(url) {
            beginSignalLoad("EEG: loading...");

            fetch(url)
                .then((res) => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                })
                .then((data) => {
                    applyEEGData(data);
                })
                .catch((err) => {
                    handleLoadError("EEG: failed to load dataset", err);
                });
        }

        function loadEEGFromEdfUrl(dataset) {
            beginSignalLoad("EEG: loading EDF...");

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
                    handleLoadError("EEG: failed to load EDF dataset", err);
                });
        }

        function loadStagesFromUrl(url) {
            global.BrainSurfingStages.loadFromUrl(url)
                .then((data) => {
                    global.BrainSurfingStages.initFromJson(state, data, state.datasetKey);
                })
                .catch(() => {
                    global.BrainSurfingStages.reset(state);
                });
        }

        function loadDataset() {
            const dataset = datasets[state.datasetKey];
            if (!dataset) return;

            state.channelName = dataset.defaultChannel || state.channelName;
            state.waveProbeX = null;
            textInformation.syncDatasetButtons();
            textInformation.renderChannelDropdown();
            resetTimelineState();

            if (state.datasetKey === "user") {
                resetSignalState({ loading: false });
                setStatus("EEG: upload an EDF to start", statusColors.neutral);
                resetSpikes?.();
                textInformation.updateInfoPanel();
                return;
            }

            if (dataset.edfUrl) {
                loadEEGFromEdfUrl(dataset);
            } else if (dataset.eegUrl) {
                loadEEGFromUrl(dataset.eegUrl);
            }

            if (dataset.hasStages && dataset.stagesUrl) {
                loadStagesFromUrl(dataset.stagesUrl);
            }
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

        function handleChannelSelection(value) {
            if (state.lastUploadedEdfBuffer && state.lastUploadedEdfLabels) {
                const selectedIndex = parseInt(value, 10);
                if (state.datasetKey === "user") {
                    parseUploadedEdf(state.lastUploadedEdfBuffer, selectedIndex);
                } else {
                    parseEdfBuffer(state.lastUploadedEdfBuffer, {
                        channelIndex: selectedIndex,
                        datasetKey: state.datasetKey,
                        resetStages: false,
                        useEdfStartTime: false,
                        statusText: `EEG: original EDF loaded (${datasets[state.datasetKey]?.label || "dataset"}) - hover for original uV magnitude`,
                    });
                }
                return;
            }

            state.channelName = value;
            if (state.lastEEGJson) {
                applyEEGData(state.lastEEGJson);
            }
        }

        return {
            loadDataset,
            parseUploadedEdf,
            handleChannelSelection,
        };
    }

    global.createBrainSurfingEegManager = createBrainSurfingEegManager;
})(window);
