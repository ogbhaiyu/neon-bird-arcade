class AudioSystem {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  // Background Cabinet Hum Nodes
  private humOsc1: OscillatorNode | null = null;
  private humOsc2: OscillatorNode | null = null;
  private humFilter: BiquadFilterNode | null = null;
  private humGain: GainNode | null = null;
  private humLfo: OscillatorNode | null = null;
  private humLfoGain: GainNode | null = null;

  // Initialize the audio context
  init() {
    if (this.ctx) return;
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
      // this.startCabinetHum(); // Disabled to get rid of background noise when tab opens
    }
  }

  private resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  // Toggle Mute / Control Volume
  setMuted(isMuted: boolean) {
    this.muted = isMuted;
    this.init();
    this.resume();

    if (!this.ctx || !this.humGain) return;
    const now = this.ctx.currentTime;
    try {
      if (this.muted) {
        // Fade out background hum smoothly
        this.humGain.gain.setValueAtTime(this.humGain.gain.value, now);
        this.humGain.gain.linearRampToValueAtTime(0.0001, now + 0.15);
      } else {
        // Fade in background hum
        this.humGain.gain.setValueAtTime(this.humGain.gain.value, now);
        this.humGain.gain.linearRampToValueAtTime(0.012, now + 0.3);
      }
    } catch (e) {
      console.warn("Failed to set mute volume:", e);
    }
  }

  // Synthesize a continuous warm analog low-frequency cabinet hum
  private startCabinetHum() {
    try {
      if (!this.ctx || this.humOsc1) return;
      const now = this.ctx.currentTime;

      // 1. Dual detuned oscillators representing sub-bass arcade components
      this.humOsc1 = this.ctx.createOscillator();
      this.humOsc2 = this.ctx.createOscillator();
      this.humFilter = this.ctx.createBiquadFilter();
      this.humGain = this.ctx.createGain();

      this.humOsc1.type = "sawtooth";
      this.humOsc2.type = "sawtooth";

      // A1 (55Hz) and slightly detuned voice
      this.humOsc1.frequency.setValueAtTime(55, now);
      this.humOsc2.frequency.setValueAtTime(55.35, now);

      // Lowpass filter to muffle the hum into a background rumble
      this.humFilter.type = "lowpass";
      this.humFilter.Q.setValueAtTime(4.0, now);

      // 2. Slow LFO to sweep filter cutoff frequency for organic breathing feel
      this.humLfo = this.ctx.createOscillator();
      this.humLfoGain = this.ctx.createGain();
      this.humLfo.frequency.setValueAtTime(0.12, now); // 0.12Hz cycle
      this.humLfoGain.gain.setValueAtTime(25, now); // Modulate cutoff by +/- 25Hz

      // Connect LFO modulator
      this.humLfo.connect(this.humLfoGain);
      this.humLfoGain.connect(this.humFilter.frequency);
      this.humFilter.frequency.setValueAtTime(105, now); // base cutoff frequency

      // Connect audio signal path
      this.humOsc1.connect(this.humFilter);
      this.humOsc2.connect(this.humFilter);
      this.humFilter.connect(this.humGain);
      this.humGain.connect(this.ctx.destination);

      // Initial gain (starts muted or quiet)
      const targetVolume = this.muted ? 0.0001 : 0.012;
      this.humGain.gain.setValueAtTime(targetVolume, now);

      this.humLfo.start(now);
      this.humOsc1.start(now);
      this.humOsc2.start(now);
    } catch (e) {
      console.warn("Failed to start cabinet hum:", e);
    }
  }

  // Play a tactile click sound representing mechanical arcade buttons
  playClick() {
    if (this.muted) return;
    try {
      this.init();
      this.resume();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      // Triangle pitch sweep mimics physical click spring
      osc.type = "triangle";
      osc.frequency.setValueAtTime(1500, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.035);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.035);

      osc.start(now);
      osc.stop(now + 0.035);
    } catch (e) {
      console.warn("Failed to play click sound:", e);
    }
  }

  // Play a retro low-pitch buzzer error sound (sawtooth pitch sweep downwards + lowpass filter)
  playError() {
    if (this.muted) return;
    try {
      this.init();
      this.resume();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const duration = 0.15; // Short buzzer

      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.type = "sawtooth";
      osc2.type = "sawtooth";

      // Low pitched buzz dropping from 140Hz to 80Hz
      osc1.frequency.setValueAtTime(140, now);
      osc1.frequency.linearRampToValueAtTime(80, now + duration);
      
      osc2.frequency.setValueAtTime(143.5, now); // slightly detuned for chorus fatness
      osc2.frequency.linearRampToValueAtTime(82.5, now + duration);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(350, now); // muffle the highs

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration);
      osc2.stop(now + duration);
    } catch (e) {
      console.warn("Failed to play error sound:", e);
    }
  }

  // Play glorious detuned arcade boot-up chord tune (major arpeggio delay)
  playReady() {
    if (this.muted) return;
    try {
      this.init();
      this.resume();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const playReadyTone = (freq: number, start: number, duration: number) => {
        if (!this.ctx) return;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.type = "square";
        osc2.type = "triangle";

        osc1.frequency.setValueAtTime(freq, start);
        osc2.frequency.setValueAtTime(freq * 1.006, start); // detune for stereo-chorus width

        gain.gain.setValueAtTime(0.06, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        osc1.start(start);
        osc2.start(start);
        osc1.stop(start + duration);
        osc2.stop(start + duration);
      };

      // Play quick arpeggiated C-major scale: C5 -> E5 -> G5 -> C6
      playReadyTone(523.25, now, 0.12);
      playReadyTone(659.25, now + 0.06, 0.12);
      playReadyTone(783.99, now + 0.12, 0.12);
      playReadyTone(1046.50, now + 0.18, 0.35);
    } catch (e) {
      console.warn("Failed to play ready sound:", e);
    }
  }

  // Play a punchy sci-fi arcade thruster zap (sub-bass pop + FM metallic zap + tight noise burst)
  playFlap() {
    if (this.muted) return;
    try {
      this.init();
      this.resume();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      // Layer 1: Sub-bass sine pop — gives physical "kick" impact on every press
      const pop = this.ctx.createOscillator();
      const popGain = this.ctx.createGain();
      pop.connect(popGain);
      popGain.connect(this.ctx.destination);

      pop.type = "sine";
      pop.frequency.setValueAtTime(280, now);
      pop.frequency.exponentialRampToValueAtTime(90, now + 0.07);

      popGain.gain.setValueAtTime(0.22, now);
      popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      pop.start(now);
      pop.stop(now + 0.09);

      // Layer 2: FM metallic zap — sci-fi character with fast modulator decay
      const carrier = this.ctx.createOscillator();
      const modulator = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      const zapGain = this.ctx.createGain();

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(zapGain);
      zapGain.connect(this.ctx.destination);

      carrier.type = "sine";
      carrier.frequency.setValueAtTime(520, now);
      carrier.frequency.exponentialRampToValueAtTime(260, now + 0.1);

      modulator.type = "sine";
      modulator.frequency.setValueAtTime(1040, now); // 2:1 harmonic ratio
      modulator.frequency.exponentialRampToValueAtTime(520, now + 0.06);

      // Modulation depth decays fast for a sharp metallic "ping" attack
      modGain.gain.setValueAtTime(600, now);
      modGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

      zapGain.gain.setValueAtTime(0.09, now);
      zapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      modulator.start(now);
      carrier.start(now);
      modulator.stop(now + 0.12);
      carrier.stop(now + 0.12);

      // Layer 3: Tight filtered noise burst — exhaust texture
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.05);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(2200, now);
      filter.Q.setValueAtTime(1.5, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.04, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.05);
    } catch (e) {
      console.warn("Failed to play flap sound:", e);
    }
  }

  // Play heavy distorted multi-layered explosion crash (distorted waveshaper + sub-boom + failure beep)
  playCrash() {
    if (this.muted) return;
    try {
      this.init();
      this.resume();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const duration = 0.6;

      // Auxiliary WaveShaper helper for crunchy digital distortion
      const makeDistortionCurve = (amount: number) => {
        const k = typeof amount === "number" ? amount : 50;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
          const x = (i * 2) / n_samples - 1;
          curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
        }
        return curve;
      };

      const shaper = this.ctx.createWaveShaper();
      shaper.curve = makeDistortionCurve(65);
      shaper.oversample = "4x";
      shaper.connect(this.ctx.destination);

      // Layer 1: Sub-bass boom
      const boom = this.ctx.createOscillator();
      const boomGain = this.ctx.createGain();
      boom.connect(boomGain);
      boomGain.connect(this.ctx.destination); // Direct bypass for clean sub-bass
      boom.type = "sine";
      boom.frequency.setValueAtTime(180, now);
      boom.frequency.exponentialRampToValueAtTime(15, now + 0.4);
      boomGain.gain.setValueAtTime(0.35, now);
      boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      boom.start(now);
      boom.stop(now + 0.4);

      // Layer 2: White noise blast wave
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.setValueAtTime(6.0, now); // resonance crackle
      filter.frequency.setValueAtTime(1100, now);
      filter.frequency.exponentialRampToValueAtTime(40, now + duration);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.24, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      noise.connect(filter);
      filter.connect(shaper); // Run through wave distortion
      shaper.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + duration);

      // Layer 3: Tragic pitch-down computer beep sequence
      const beep = this.ctx.createOscillator();
      const beepGain = this.ctx.createGain();
      beep.connect(beepGain);
      beepGain.connect(this.ctx.destination);
      beep.type = "square";
      beep.frequency.setValueAtTime(520, now);
      beep.frequency.linearRampToValueAtTime(80, now + 0.45);
      beepGain.gain.setValueAtTime(0.05, now);
      beepGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      beep.start(now);
      beep.stop(now + 0.45);
    } catch (e) {
      console.warn("Failed to play crash sound:", e);
    }
  }

  // Play premium FM-synthesis crystal chime gate score sound (carrier + modulator)
  playScore() {
    if (this.muted) return;
    try {
      this.init();
      this.resume();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const duration = 0.28;

      const playFMBell = (baseFreq: number, startOffset: number) => {
        if (!this.ctx) return;
        
        // FM Synthesis setup
        const carrier = this.ctx.createOscillator();
        const modulator = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        const mainGain = this.ctx.createGain();

        // Modulator modulates carrier frequency
        modulator.connect(modGain);
        modGain.connect(carrier.frequency);
        
        // Carrier connects to destination
        carrier.connect(mainGain);
        mainGain.connect(this.ctx.destination);

        // Carrier frequency
        carrier.type = "sine";
        carrier.frequency.setValueAtTime(baseFreq, now + startOffset);

        // Modulator frequency is harmonic (Carrier * 2) for crystal tones
        modulator.type = "sine";
        modulator.frequency.setValueAtTime(baseFreq * 2.0, now + startOffset);

        // Modulator depth envelope (exponential drop creates metallic hit)
        modGain.gain.setValueAtTime(800, now + startOffset);
        modGain.gain.exponentialRampToValueAtTime(0.01, now + startOffset + 0.1);

        // Main gain volume envelope
        mainGain.gain.setValueAtTime(0.06, now + startOffset);
        mainGain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);

        modulator.start(now + startOffset);
        carrier.start(now + startOffset);
        modulator.stop(now + startOffset + duration);
        carrier.stop(now + startOffset + duration);
      };

      // Play double-bell chime arpeggio: C6 (1046.50Hz) then E6 (1318.51Hz)
      playFMBell(1046.50, 0);
      playFMBell(1318.51, 0.05);
    } catch (e) {
      console.warn("Failed to play score sound:", e);
    }
  }

  // Play triumphant arpeggio melody when player beats their personal high score
  playHighScore() {
    if (this.muted) return;
    try {
      this.init();
      this.resume();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const playFanfareNote = (freq: number, start: number, dur: number) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = "square";
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.01, start + dur); // tiny vibrato sweep

        gain.gain.setValueAtTime(0.07, start);
        gain.gain.linearRampToValueAtTime(0.0001, start + dur);

        osc.start(start);
        osc.stop(start + dur);
      };

      // Quick victorious synth run: C5 -> E5 -> G5 -> C6 -> E6 -> G6 -> C7
      const noteDelay = 0.07;
      playFanfareNote(523.25, now, 0.12);
      playFanfareNote(659.25, now + noteDelay, 0.12);
      playFanfareNote(783.99, now + noteDelay * 2, 0.12);
      playFanfareNote(1046.50, now + noteDelay * 3, 0.12);
      playFanfareNote(1318.51, now + noteDelay * 4, 0.12);
      playFanfareNote(1567.98, now + noteDelay * 5, 0.12);
      playFanfareNote(2093.00, now + noteDelay * 6, 0.35);
    } catch (e) {
      console.warn("Failed to play highscore fanfare:", e);
    }
  }

  // Play a sad retro minor game-over theme winding down
  playGameOverMelody() {
    if (this.muted) return;
    try {
      this.init();
      this.resume();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const playSadNote = (freq: number, start: number, dur: number) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, start);
        // Add a detuning pitch slide downwards to sound sad / falling apart
        osc.frequency.linearRampToValueAtTime(freq * 0.95, start + dur);

        gain.gain.setValueAtTime(0.06, start);
        gain.gain.linearRampToValueAtTime(0.0001, start + dur);

        osc.start(start);
        osc.stop(start + dur);
      };

      // Tragic descending progression: A4 -> F4 -> D4 -> C#4
      const noteDelay = 0.22;
      playSadNote(440.00, now, 0.24);      // A4
      playSadNote(349.23, now + noteDelay, 0.24); // F4
      playSadNote(293.66, now + noteDelay * 2, 0.24); // D4
      playSadNote(277.18, now + noteDelay * 3, 0.55); // C#4
    } catch (e) {
      console.warn("Failed to play game over theme:", e);
    }
  }

  // Play a short, high-pitched crystal sweep-up chime when the player performs a near-miss stunt
  playNearMiss() {
    if (this.muted) return;
    try {
      this.init();
      this.resume();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = "sine";
      // High-pitched crystal synth sweep up
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1600, now + 0.08);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.08);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {
      console.warn("Failed to play near miss sound:", e);
    }
  }
}

export const audioSystem = new AudioSystem();
export default audioSystem;
