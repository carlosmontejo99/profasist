// Web Audio API Synthesizer and Haptic Feedback Engine
// 100% Offline, Zero external assets, ultra-fast latency

class AudioHapticsEngine {
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private hapticsEnabled: boolean = true;

  constructor() {
    this.loadSettings();
  }

  public loadSettings() {
    try {
      const soundVal = localStorage.getItem('profasist_sound_enabled');
      this.soundEnabled = soundVal !== null ? soundVal === 'true' : true;

      const hapticsVal = localStorage.getItem('profasist_haptics_enabled');
      this.hapticsEnabled = hapticsVal !== null ? hapticsVal === 'true' : true;
    } catch (e) {
      this.soundEnabled = true;
      this.hapticsEnabled = true;
    }
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    try {
      localStorage.setItem('profasist_sound_enabled', String(enabled));
    } catch (e) {}
  }

  public setHapticsEnabled(enabled: boolean) {
    this.hapticsEnabled = enabled;
    try {
      localStorage.setItem('profasist_haptics_enabled', String(enabled));
    } catch (e) {}
  }

  public getSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public getHapticsEnabled(): boolean {
    return this.hapticsEnabled;
  }

  private initAudio() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // --- HAPTIC FEEDBACK (VIBRATION) ---

  public vibrateShort() {
    if (!this.hapticsEnabled || !('vibrate' in navigator)) return;
    try {
      navigator.vibrate(15);
    } catch (e) {}
  }

  public vibrateSuccess() {
    if (!this.hapticsEnabled || !('vibrate' in navigator)) return;
    try {
      navigator.vibrate([25, 30, 35]);
    } catch (e) {}
  }

  public vibrateAlert() {
    if (!this.hapticsEnabled || !('vibrate' in navigator)) return;
    try {
      navigator.vibrate([50, 40, 50]);
    } catch (e) {}
  }

  // --- SOUND SYNTHESIZERS (WEB AUDIO API) ---

  public playPop() {
    this.vibrateShort();
    if (!this.soundEnabled) return;
    this.initAudio();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.audioCtx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.04);
    } catch (e) {}
  }

  public playPresent() {
    this.vibrateSuccess();
    if (!this.soundEnabled) return;
    this.initAudio();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.setValueAtTime(659.25, now + 0.06); // E5

      osc2.frequency.setValueAtTime(1046.5, now + 0.06); // C6

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start(now);
      osc2.start(now + 0.06);

      osc1.stop(now + 0.18);
      osc2.stop(now + 0.18);
    } catch (e) {}
  }

  public playAbsent() {
    this.vibrateAlert();
    if (!this.soundEnabled) return;
    this.initAudio();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  public playSuccess() {
    this.vibrateSuccess();
    if (!this.soundEnabled) return;
    this.initAudio();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.5]; // C E G C

      freqs.forEach((freq, idx) => {
        const osc = this.audioCtx!.createOscillator();
        const gain = this.audioCtx!.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);

        gain.gain.setValueAtTime(0.12, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.15);

        osc.connect(gain);
        gain.connect(this.audioCtx!.destination);

        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.15);
      });
    } catch (e) {}
  }

  public playTick() {
    this.vibrateShort();
    if (!this.soundEnabled) return;
    this.initAudio();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.02);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.02);
    } catch (e) {}
  }

  public playAlarm() {
    this.vibrateAlert();
    if (!this.soundEnabled) return;
    this.initAudio();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      for (let i = 0; i < 3; i++) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now + i * 0.2);

        gain.gain.setValueAtTime(0.15, now + i * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.2 + 0.12);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + i * 0.2);
        osc.stop(now + i * 0.2 + 0.12);
      }
    } catch (e) {}
  }
}

export const AudioHaptics = new AudioHapticsEngine();
