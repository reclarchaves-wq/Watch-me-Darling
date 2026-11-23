import type { ConversionCurve, HapticFrame, PulsePattern } from '../types.ts';

type FrameListener = (frame: HapticFrame) => void;

class AudioHapticEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private panner: StereoPannerNode | null = null;
  private frequencyData: Uint8Array<ArrayBuffer> | null = null;
  private rafId: number | null = null;
  private listeners = new Set<FrameListener>();

  // Procedural synth nodes
  private synthStopper: (() => void) | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;

  // Attached HTMLMediaElements cache so createMediaElementSource is called once per element
  private mediaSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
  private activeMediaEl: HTMLMediaElement | null = null;

  // Settings
  private earbudVolume = 75;
  private earbudBalance = 0;
  private watchIntensityScale = 80;
  private curve: ConversionCurve = 'sub-bass';
  private activePattern: PulsePattern = 'wave';
  private sourceMode: HapticFrame['sourceMode'] = 'solo';
  private activeSource: 'none' | 'synth' | 'media' | 'mic' | 'manual' = 'none';

  // Manual/Burst override envelope
  private burstUntil = 0;
  private burstIntensity = 0;
  private burstHz = 65;
  private burstPattern: PulsePattern = 'wave';

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.72;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.earbudVolume / 100;

      this.panner = this.ctx.createStereoPanner();
      this.panner.pan.value = this.earbudBalance;

      this.analyser.connect(this.panner);
      this.panner.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public subscribe(listener: FrameListener): () => void {
    this.listeners.add(listener);
    this.startLoop();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stopLoop();
      }
    };
  }

  public setEarbudVolume(vol: number): void {
    this.earbudVolume = Math.max(0, Math.min(100, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.earbudVolume / 100, this.ctx.currentTime, 0.03);
    }
  }

  public setEarbudBalance(balance: number): void {
    this.earbudBalance = Math.max(-1, Math.min(1, balance));
    if (this.panner && this.ctx) {
      this.panner.pan.setTargetAtTime(this.earbudBalance, this.ctx.currentTime, 0.03);
    }
  }

  public async setAudioSink(deviceId: string): Promise<boolean> {
    const ctx = this.ensureContext() as AudioContext & {
      setSinkId?: (id: string) => Promise<void>;
    };
    if (typeof ctx.setSinkId === 'function') {
      try {
        await ctx.setSinkId(deviceId);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  public setWatchIntensityScale(scale: number): void {
    this.watchIntensityScale = Math.max(0, Math.min(100, scale));
  }

  public setConversionCurve(curve: ConversionCurve): void {
    this.curve = curve;
  }

  public setSourceMode(mode: HapticFrame['sourceMode']): void {
    this.sourceMode = mode;
  }

  public startSynthSoundscape(
    preset: 'velvet' | 'rain' | 'pulse',
    bpm: number,
    baseHz: number
  ): void {
    this.stopAllSources();
    const ctx = this.ensureContext();
    if (!this.analyser) return;

    const subGain = ctx.createGain();
    subGain.gain.value = 0.42;
    subGain.connect(this.analyser);

    // Warm sub-bass carrier + harmonic chord
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.value = preset === 'rain' ? 920 : preset === 'velvet' ? 420 : 280;
    filter.Q.value = 2.4;

    osc1.type = preset === 'pulse' ? 'triangle' : 'sine';
    osc1.frequency.value = baseHz;

    osc2.type = 'sine';
    osc2.frequency.value = baseHz * (preset === 'velvet' ? 1.5 : 2);

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = preset === 'rain' ? 0.16 : 0.28;

    // Rhythmic LFO tied to BPM
    const beatHz = Math.max(0.4, bpm / 60);
    lfo.type = preset === 'pulse' ? 'sawtooth' : 'sine';
    lfo.frequency.value = beatHz;
    lfoGain.gain.value = preset === 'pulse' ? 0.34 : 0.22;

    lfo.connect(lfoGain);
    lfoGain.connect(subGain.gain);

    osc1.connect(filter);
    osc2.connect(osc2Gain);
    osc2Gain.connect(filter);
    filter.connect(subGain);

    // Subtle rain droplet shimmer for rain preset
    let noiseNode: AudioBufferSourceNode | null = null;
    if (preset === 'rain') {
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.14;
      }
      noiseNode = ctx.createBufferSource();
      noiseNode.buffer = noiseBuffer;
      noiseNode.loop = true;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400;
      bp.Q.value = 0.8;

      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.25;

      noiseNode.connect(bp);
      bp.connect(noiseGain);
      noiseGain.connect(this.analyser);
      noiseNode.start();
    }

    osc1.start();
    osc2.start();
    lfo.start();

    this.activeSource = 'synth';
    this.activePattern = preset === 'pulse' ? 'heartbeat' : preset === 'rain' ? 'whisper' : 'wave';

    this.synthStopper = () => {
      try {
        osc1.stop();
        osc2.stop();
        lfo.stop();
        noiseNode?.stop();
        subGain.disconnect();
      } catch {
        // Ignore already-stopped nodes
      }
    };
  }

  public attachMediaElement(el: HTMLMediaElement, mode: 'solo' | 'video'): void {
    this.stopSynth();
    this.stopMic();
    const ctx = this.ensureContext();
    if (!this.analyser) return;

    let src = this.mediaSources.get(el);
    if (!src) {
      src = ctx.createMediaElementSource(el);
      this.mediaSources.set(el, src);
    }

    if (this.activeMediaEl && this.activeMediaEl !== el) {
      const prev = this.mediaSources.get(this.activeMediaEl);
      try {
        prev?.disconnect();
      } catch {
        // ignore
      }
    }

    try {
      src.disconnect();
    } catch {
      // ignore
    }
    src.connect(this.analyser);
    this.activeMediaEl = el;
    this.activeSource = 'media';
    this.sourceMode = mode;
  }

  public async startMicrophone(): Promise<void> {
    this.stopAllSources();
    const ctx = this.ensureContext();
    if (!this.analyser || !this.panner) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    this.micStream = stream;
    this.micSource = ctx.createMediaStreamSource(stream);

    // Connect mic directly to analyser ONLY (not masterGain) to prevent speaker feedback
    try {
      this.analyser.disconnect();
    } catch {
      // ignore
    }
    this.micSource.connect(this.analyser);
    this.activeSource = 'mic';
  }

  public stopMicrophone(): void {
    this.stopMic();
    // Reconnect analyser -> panner for audio playback
    if (this.analyser && this.panner) {
      try {
        this.analyser.connect(this.panner);
      } catch {
        // ignore
      }
    }
    if (this.activeSource === 'mic') {
      this.activeSource = 'none';
    }
  }

  public playEarbudAudioChime(): void {
    const ctx = this.ensureContext();
    if (!this.panner) return;
    const now = ctx.currentTime;
    const freqs = [261.63, 329.63, 392.0];
    freqs.forEach((hz, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = hz;
      const start = now + idx * 0.09;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(0.09, start + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.48);
      osc.connect(g);
      g.connect(this.panner!);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  }

  public triggerManualPulse(
    intensity: number,
    frequencyHz: number,
    pattern: PulsePattern,
    durationMs = 450,
    withSoftAudibleTone = false
  ): void {
    this.burstIntensity = Math.max(0, Math.min(100, intensity));
    this.burstHz = Math.max(25, Math.min(220, frequencyHz));
    this.burstPattern = pattern;
    this.burstUntil = performance.now() + durationMs;

    if (withSoftAudibleTone && this.burstIntensity > 5) {
      const ctx = this.ensureContext();
      if (this.panner) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = Math.max(45, Math.min(180, this.burstHz));
        const now = ctx.currentTime;
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.08 * (this.burstIntensity / 100), now + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
        osc.connect(g);
        g.connect(this.panner);
        osc.start(now);
        osc.stop(now + durationMs / 1000 + 0.02);
      }
    }
  }

  private stopSynth(): void {
    if (this.synthStopper) {
      this.synthStopper();
      this.synthStopper = null;
    }
  }

  private stopMic(): void {
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {
        // ignore
      }
      this.micSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
  }

  public stopAllSources(): void {
    this.stopSynth();
    this.stopMic();
    if (this.analyser && this.panner) {
      try {
        this.analyser.connect(this.panner);
      } catch {
        // ignore
      }
    }
    this.activeSource = 'none';
  }

  private startLoop(): void {
    if (this.rafId !== null) return;
    const tick = () => {
      const frame = this.computeFrame();
      this.listeners.forEach((cb) => cb(frame));
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private computeFrame(): HapticFrame {
    const now = performance.now();

    // Check manual/partner burst envelope first
    if (now < this.burstUntil) {
      const scaled = Math.round((this.burstIntensity * this.watchIntensityScale) / 100);
      return {
        intensity: scaled,
        frequencyHz: this.burstHz,
        subBassEnergy: scaled,
        midEnergy: Math.round(scaled * 0.65),
        pattern: this.burstPattern,
        sourceMode: this.sourceMode,
        timestamp: Date.now(),
      };
    }

    if (!this.analyser || !this.frequencyData || this.activeSource === 'none') {
      return {
        intensity: 0,
        frequencyHz: 48,
        subBassEnergy: 0,
        midEnergy: 0,
        pattern: this.activePattern,
        sourceMode: this.sourceMode,
        timestamp: Date.now(),
      };
    }

    this.analyser.getByteFrequencyData(this.frequencyData);
    const bins = this.frequencyData;

    // Bins 0..5 roughly cover 20Hz..350Hz depending on sampleRate
    let subSum = 0;
    for (let i = 0; i < 4; i++) subSum += bins[i] ?? 0;
    const subBassEnergy = Math.min(100, Math.round((subSum / (4 * 255)) * 115));

    let midSum = 0;
    for (let i = 4; i < 16; i++) midSum += bins[i] ?? 0;
    const midEnergy = Math.min(100, Math.round((midSum / (12 * 255)) * 125));

    let rawIntensity = 0;
    let freqHz = 55;

    switch (this.curve) {
      case 'sub-bass':
        rawIntensity = subBassEnergy * 0.92 + midEnergy * 0.12;
        freqHz = 42 + Math.round((subBassEnergy / 100) * 58);
        break;
      case 'heartbeat': {
        const beatWave = 0.55 + 0.45 * Math.sin(now * 0.006);
        rawIntensity = (subBassEnergy * 0.75 + midEnergy * 0.25) * beatWave;
        freqHz = 52 + Math.round((rawIntensity / 100) * 44);
        break;
      }
      case 'melodic-wave':
        rawIntensity = midEnergy * 0.72 + subBassEnergy * 0.35;
        freqHz = 68 + Math.round((midEnergy / 100) * 110);
        break;
      case 'transient-spark':
        rawIntensity = Math.max(subBassEnergy, midEnergy * 1.15);
        freqHz = 85 + Math.round((midEnergy / 100) * 130);
        break;
    }

    const scaledIntensity = Math.min(
      100,
      Math.round((rawIntensity * this.watchIntensityScale) / 100)
    );

    return {
      intensity: scaledIntensity,
      frequencyHz: Math.max(25, Math.min(220, freqHz)),
      subBassEnergy,
      midEnergy,
      pattern: this.activePattern,
      sourceMode: this.sourceMode,
      timestamp: Date.now(),
    };
  }
}

export const audioHapticEngine = new AudioHapticEngine();
