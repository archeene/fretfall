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

    // Returns { freq, rms } — freq is -1 when no clear pitch / too quiet.
    detect() {
      if (!this.running) return { freq: -1, rms: 0 };
      const buf = this.buf;
      this.analyser.getFloatTimeDomainData(buf);
      const SIZE = buf.length;

      // RMS for a silence gate
      let rms = 0;
      for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
      rms = Math.sqrt(rms / SIZE);
      if (rms < 0.01) return { freq: -1, rms };

      // Trim to the loud region
      let r1 = 0, r2 = SIZE - 1;
      const thres = 0.2;
      for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
      for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
      const b = buf.slice(r1, r2);
      const n = b.length;

      const c = new Float32Array(n).fill(0);
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n - i; j++) c[i] += b[j] * b[j + i];

      let d = 0;
      while (d < n - 1 && c[d] > c[d + 1]) d++;
      let maxval = -1, maxpos = -1;
      for (let i = d; i < n; i++) {
        if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
      }
      let T0 = maxpos;
      if (T0 <= 0) return { freq: -1, rms };

      // Parabolic interpolation for sub-sample accuracy
      const x1 = c[T0 - 1] || 0, x2 = c[T0], x3 = c[T0 + 1] || 0;
      const a = (x1 + x3 - 2 * x2) / 2;
      const bb = (x3 - x1) / 2;
      if (a) T0 = T0 - bb / (2 * a);

      const freq = this.audioCtx.sampleRate / T0;
      if (freq < 60 || freq > 1400) return { freq: -1, rms };
      return { freq, rms };
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
