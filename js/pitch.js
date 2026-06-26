// pitch.js
// Real-time monophonic pitch detection from the microphone using normalized
// autocorrelation (the "ACF2+" approach). Returns a frequency in Hz, or -1.

(function () {
  class PitchDetector {
    constructor() {
      this.audioCtx = null;
      this.analyser = null;
      this.buf = new Float32Array(2048);
      this.stream = null;
      this.running = false;
    }

    async start() {
      if (this.running) return;
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
        },
      });
      const src = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;
      src.connect(this.analyser);
      this.running = true;
    }

    stop() {
      if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
      if (this.audioCtx) this.audioCtx.close();
      this.running = false;
    }

    // Minimum loudness (RMS) before we even try to detect a pitch. Tunable via
    // `detector.rmsGate`. Background hum/fan noise sits well below ~0.02.
    rmsGate = 0.02;
    // Minimum normalized autocorrelation peak ("clarity", 0..1). A plucked note
    // scores ~0.85+; broadband noise scores ~0.05-0.2. 0.7 cleanly separates
    // them. This is the main noise reject.
    clarityGate = 0.7;

    // Returns { freq, rms, clarity } — freq is -1 when no clear pitch / too quiet.
    detect() {
      if (!this.running) return { freq: -1, rms: 0, clarity: 0 };
      const buf = this.buf;
      this.analyser.getFloatTimeDomainData(buf);
      const SIZE = buf.length;

      // RMS for a silence gate
      let rms = 0;
      for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
      rms = Math.sqrt(rms / SIZE);
      if (rms < this.rmsGate) return { freq: -1, rms, clarity: 0 };

      // Autocorrelation over the full frame (lag 0 = total energy)
      const n = SIZE;
      const c = new Float32Array(n);
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n - i; j++) c[i] += buf[j] * buf[j + i];

      const energy = c[0];
      if (energy <= 0) return { freq: -1, rms, clarity: 0 };

      // Skip the initial downslope, then find the highest peak.
      let d = 0;
      while (d < n - 1 && c[d] > c[d + 1]) d++;
      let maxval = -1, maxpos = -1;
      for (let i = d; i < n; i++) {
        if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
      }
      if (maxpos <= 0) return { freq: -1, rms, clarity: 0 };

      // Clarity = peak height relative to zero-lag energy. Rejects noise.
      const clarity = maxval / energy;
      if (clarity < this.clarityGate) return { freq: -1, rms, clarity };

      // Parabolic interpolation for sub-sample accuracy
      let T0 = maxpos;
      const x1 = c[T0 - 1] || 0, x2 = c[T0], x3 = c[T0 + 1] || 0;
      const a = (x1 + x3 - 2 * x2) / 2;
      const bb = (x3 - x1) / 2;
      if (a) T0 = T0 - bb / (2 * a);

      const freq = this.audioCtx.sampleRate / T0;
      if (freq < 70 || freq > 1200) return { freq: -1, rms, clarity };
      return { freq, rms, clarity };
    }
  }

  // Hz -> pitch class (0..11, C=0). Returns -1 if invalid.
  function freqToPitchClass(freq) {
    if (freq <= 0) return -1;
    const midi = Math.round(12 * Math.log2(freq / 440) + 69);
    return ((midi % 12) + 12) % 12; // midi 69 = A = pc 9, matches C=0 indexing
  }

  window.PitchDetector = PitchDetector;
  window.freqToPitchClass = freqToPitchClass;
})();
