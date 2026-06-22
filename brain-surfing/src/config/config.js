(function (global) {
    const IMAGE_BASE = "assets/images";
    const AUDIO_BASE = "assets/audio";
    const DATA_BASE = "data";

    global.BrainSurfingConfig = Object.freeze({
        assets: Object.freeze({
            player: `${IMAGE_BASE}/character2.png`,
            background: `${IMAGE_BASE}/background_sky_2.png`,
            waveRetractionSprite: `${IMAGE_BASE}/wave_retraction_long_sprite.png`,
            flipBoard: `${IMAGE_BASE}/flip1_p.png`,
            flipPenguin: `${IMAGE_BASE}/flip1_b.png`,
            glidePenguin: `${IMAGE_BASE}/glide_p.png`,
            boats: Object.freeze([
                `${IMAGE_BASE}/boat1.png`,
                `${IMAGE_BASE}/boat2.png`,
                `${IMAGE_BASE}/boat3.png`,
                `${IMAGE_BASE}/boat4.png`,
                `${IMAGE_BASE}/boat5.png`,
                `${IMAGE_BASE}/boat6.png`,
                `${IMAGE_BASE}/boat7.png`,
            ]),
            audio: Object.freeze({
                windGlide: `${AUDIO_BASE}/wind_glide.mp3`,
                flip: `${AUDIO_BASE}/flip.mp3`,
                crash: `${AUDIO_BASE}/crash.mp3`,
            }),
        }),
        datasets: Object.freeze({
            sleep: Object.freeze({
                label: "Sleep (demo)",
                edfUrl: `${DATA_BASE}/SC4001E0-PSG-demo.edf`,
                eegUrl: null,
                stagesUrl: `${DATA_BASE}/brainwave_stages_sleep_demo.json`,
                hasStages: true,
                defaultChannel: "Fpz-Cz",
            }),
            seizure: Object.freeze({
                label: "Seizure (demo)",
                edfUrl: `${DATA_BASE}/PN12-3-demo.edf`,
                eegUrl: null,
                stagesUrl: `${DATA_BASE}/brainwave_stages_seizure_demo.json`,
                hasStages: true,
                defaultChannel: "Cz",
            }),
            user: Object.freeze({
                label: "User upload",
                eegUrl: null,
                stagesUrl: null,
                hasStages: false,
                defaultChannel: null,
            }),
        }),
        stageLabelsByDataset: Object.freeze({
            sleep: Object.freeze({
                W: "Wake",
                N1: "N1 - light sleep",
                N2: "N2 - light sleep",
                N3: "N3 - deep sleep",
                N4: "N4 - deep sleep",
                REM: "REM sleep",
                R: "REM sleep",
            }),
            seizure: Object.freeze({
                SZ: "Seizure",
                NS: "No seizure",
            }),
            user: null,
        }),
    });
})(window);
