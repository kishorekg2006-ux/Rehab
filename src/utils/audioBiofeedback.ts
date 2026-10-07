class AudioBiofeedbackManager {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private voiceEnabled: boolean = true;
  private lastSpokenTime: number = 0;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public setVoiceEnabled(enabled: boolean) {
    this.voiceEnabled = enabled;
  }

  public isSoundEnabled() {
    return this.soundEnabled;
  }

  public isVoiceEnabled() {
    return this.voiceEnabled;
  }

  // Play a soft high-clarity success chord
  public playSuccessChime() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    freqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + idx * 0.08);

      gain.gain.setValueAtTime(0, this.ctx!.currentTime + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.12, this.ctx!.currentTime + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + idx * 0.08 + 0.5);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(this.ctx!.currentTime + idx * 0.08);
      osc.stop(this.ctx!.currentTime + idx * 0.08 + 0.55);
    });
  }

  // Play hold biofeedback tone that ascends gently
  public playHoldTone(progressRatio: number) {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const baseFreq = 440; // A4
    const targetFreq = 440 + progressRatio * 220; // Up to E5
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(targetFreq, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + 0.09);
  }

  // Musical note for individual finger taps
  public playFingerNote(fingerIndex: number) {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    // Frequencies: Index (C4 261.6), Middle (E4 329.6), Ring (G4 392.0), Pinky (B4 493.9), Thumb (A3 220)
    const notes = [220, 261.63, 329.63, 392.0, 493.88];
    const freq = notes[fingerIndex % notes.length];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.45);
  }

  // Low gentle chime when compensation or fatigue is detected
  public playSoftAlert() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, this.ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.32);
  }

  // Gentle voice guidance for stroke patients
  public speakGuidance(text: string, force: boolean = false) {
    if (!this.voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;

    const now = Date.now();
    // Throttle voice alerts to not overwhelm the recovering patient
    if (!force && now - this.lastSpokenTime < 4500) {
      return;
    }
    this.lastSpokenTime = now;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95; // slightly slower, calm cadence for stroke rehab
      utterance.pitch = 1.05;
      utterance.volume = 0.85;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore audio synthesis errors in silent modes
    }
  }
}

export const audioBiofeedback = new AudioBiofeedbackManager();
