// surfAudio.js
(function (global) {
    const AC = window.AudioContext || window.webkitAudioContext;

    const SurfAudio = {
        audioCtx: null,
        osc: null,
        gain: null,
        ready: false,

        windBuffer: null,
        windSource: null,
        windGain: null,
        loadingWind: false,

        flipBuffer: null,
        loadingFlip: false,


        crashBuffer: null,
        loadingCrash: false,

        sfxGain: null,

        init() {
            if (this.ready || !AC) return;

            const ctx = new AC();
            this.audioCtx = ctx;

            this.osc = this.audioCtx.createOscillator();
            this.gain = this.audioCtx.createGain();

            this.osc.type = "sine";
            this.osc.frequency.value = 240;
            this.gain.gain.value = 0;

            // wind noise for gliding
            this.windGain = ctx.createGain();
            this.windGain.gain.value = 0;    // start silent

            // sfx 
            this.sfxGain = ctx.createGain();
            this.sfxGain.gain.value = 0.10;   // overall SFX volume

            this.ready = true;

            // Connect to output
            this.osc.connect(this.gain);
            this.gain.connect(ctx.destination);
            this.sfxGain.connect(ctx.destination);
            this.windGain.connect(ctx.destination);

            // Load MP3
            this.loadWind("sounds/wind_glide.mp3");
            this.loadFlip("sounds/flip.mp3");
            this.loadCrash("sounds/crash.mp3");

            this.osc.start();

            this.ready = true;
        },

        loadWind(url) {
            if (!this.audioCtx || this.loadingWind || this.windBuffer) return;
            this.loadingWind = true;

            fetch(url)
                .then(res => res.arrayBuffer())
                .then(data => this.audioCtx.decodeAudioData(data))
                .then(buf => {
                    this.windBuffer = buf;
                    this.loadingWind = false;
                    this.startWindIfNeeded();
                })
                .catch(err => {
                    console.warn("Failed to load wind sample:", err);
                    this.loadingWind = false;
                });
        },

        loadFlip(url) {
            if (!this.audioCtx || this.loadingFlip || this.flipBuffer) return;
            this.loadingFlip = true;

            fetch(url)
                .then(res => res.arrayBuffer())
                .then(data => this.audioCtx.decodeAudioData(data))
                .then(buf => {
                    this.flipBuffer = buf;
                    this.loadingFlip = false;
                })
                .catch(err => {
                    console.warn("Failed to load flip SFX:", err);
                    this.loadingFlip = false;
                });
        },


        loadCrash(url) {
            if (!this.audioCtx || this.loadingCrash || this.crashBuffer) return;
            this.loadingCrash = true;

            fetch(url)
                .then(res => res.arrayBuffer())
                .then(data => this.audioCtx.decodeAudioData(data))
                .then(buf => {
                    this.crashBuffer = buf;
                    this.loadingCrash = false;
                })
                .catch(err => {
                    console.warn("Failed to load flip SFX:", err);
                    this.loadingCrash = false;
                });
        },

        playFlip() {
            if (!this.audioCtx || !this.flipBuffer || !this.sfxGain) return;

            const ctx = this.audioCtx;
            const src = ctx.createBufferSource();
            src.buffer = this.flipBuffer;
            src.connect(this.sfxGain);
            src.start(0);
        },

        playCrash() {
            if (!this.audioCtx || !this.crashBuffer || !this.sfxGain) return;

            const ctx = this.audioCtx;
            const src = ctx.createBufferSource();
            src.buffer = this.crashBuffer;
            src.connect(this.sfxGain);
            src.start(0);
        },

        startWindIfNeeded() {
            if (!this.audioCtx || !this.windBuffer) return;

            if (this.windSource) return;

            const ctx = this.audioCtx;
            const src = ctx.createBufferSource();
            src.buffer = this.windBuffer;
            src.loop = true;

            src.connect(this.windGain);
            src.start(0);

            this.windSource = src;
        },

        ensure() {
            if (!AC) return;
            if (!this.ready) {
                this.init();
            } else if (this.audioCtx.state === "suspended") {
                this.audioCtx.resume();
            }
        },

        update(onGround, amp01, currentTrick) {
            if (!this.ready || !this.audioCtx || !this.osc || !this.gain) return;

            const t = this.audioCtx.currentTime;

            if (onGround) {
                const minFreq = 1;
                const maxFreq = 180;
                const freq = minFreq + (maxFreq - minFreq) * amp01;

                this.osc.frequency.setTargetAtTime(freq, t, 0.02);
                this.gain.gain.setTargetAtTime(0.15, t, 0.07);
            } else {
                this.gain.gain.setTargetAtTime(0.0, t, 0.05);
            }

            if (this.windBuffer && !this.windSource) {
                this.startWindIfNeeded();
            }

            if (this.windGain) {
                const baseGain = 1.5;  // how loud wind is when gliding
                const target = (currentTrick === "glide") ? baseGain : 0.0;
                this.windGain.gain.setTargetAtTime(target, t, 0.1);
            }
        },

        pause() {
            if (!this.ready || !this.audioCtx || !this.gain) return;
            const t = this.audioCtx.currentTime;
            if (this.gain) {
                this.gain.gain.setTargetAtTime(0, t, 0.05);
            }

            if (this.windGain) {
                this.windGain.gain.setTargetAtTime(0, t, 0.05);
            }

        },

        createNoiseSource() {
            const ctx = this.audioCtx;
            const bufferSize = ctx.sampleRate * 2;              // 2 seconds of noise
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);

            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;
            return noise;
        },
    };

    global.SurfAudio = SurfAudio;
})(window);