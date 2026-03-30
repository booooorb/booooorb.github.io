(function (global) {
    const AC = window.AudioContext || window.webkitAudioContext;
    const assetConfig = global.BrainSurfingConfig?.assets?.audio || {};

    function loadBuffer(audioCtx, url) {
        return fetch(url)
            .then((res) => res.arrayBuffer())
            .then((data) => audioCtx.decodeAudioData(data));
    }

    const BrainSurfingActionSound = {
        audioCtx: null,
        sfxGain: null,
        flipBuffer: null,
        crashBuffer: null,
        loadingFlip: false,
        loadingCrash: false,
        ready: false,

        init() {
            if (this.ready) return this.audioCtx;
            if (!AC) return null;

            const sharedCtx = global.BrainSurfingWaveSound?.ensure?.();
            this.audioCtx = sharedCtx || new AC();
            this.sfxGain = this.audioCtx.createGain();
            this.sfxGain.gain.value = 0.06;
            this.sfxGain.connect(this.audioCtx.destination);

            this.loadFlip(assetConfig.flip);
            this.loadCrash(assetConfig.crash);
            this.ready = true;

            return this.audioCtx;
        },

        ensure() {
            const ctx = this.ready ? this.audioCtx : this.init();
            if (ctx && ctx.state === "suspended") {
                ctx.resume();
            }
            return ctx;
        },

        loadFlip(url) {
            if (!this.audioCtx || this.loadingFlip || this.flipBuffer || !url) return;
            this.loadingFlip = true;

            loadBuffer(this.audioCtx, url)
                .then((buffer) => {
                    this.flipBuffer = buffer;
                    this.loadingFlip = false;
                })
                .catch((err) => {
                    console.warn("Failed to load flip SFX:", err);
                    this.loadingFlip = false;
                });
        },

        loadCrash(url) {
            if (!this.audioCtx || this.loadingCrash || this.crashBuffer || !url) return;
            this.loadingCrash = true;

            loadBuffer(this.audioCtx, url)
                .then((buffer) => {
                    this.crashBuffer = buffer;
                    this.loadingCrash = false;
                })
                .catch((err) => {
                    console.warn("Failed to load crash SFX:", err);
                    this.loadingCrash = false;
                });
        },

        playBuffer(buffer) {
            if (!this.audioCtx || !buffer || !this.sfxGain) return;

            const source = this.audioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.sfxGain);
            source.start(0);
        },

        playFlip() {
            this.playBuffer(this.flipBuffer);
        },

        playCrash() {
            this.playBuffer(this.crashBuffer);
        },
    };

    global.BrainSurfingActionSound = BrainSurfingActionSound;
})(window);
