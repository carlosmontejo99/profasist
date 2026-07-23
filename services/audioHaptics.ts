// Web Audio API Synthesizer & Native Haptic Feedback Engine
// 100% Offline, zero external assets, ultra-fast latency with Capacitor Haptics integration
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export type HapticIntensity = 'light' | 'medium' | 'heavy';

export interface AudioHapticsSettings {
  soundEnabled: boolean;
  soundVolume: number; // 0.0 to 1.0
  hapticsEnabled: boolean;
  hapticsIntensity: HapticIntensity;
  soundAttendance: boolean;
  soundTimer: boolean;
  soundRoulette: boolean;
  soundUI: boolean;
}

class AudioHapticsEngine {
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private soundVolume: number = 0.8;
  private hapticsEnabled: boolean = true;
  private hapticsIntensity: HapticIntensity = 'medium';
  private soundAttendance: boolean = true;
  private soundTimer: boolean = true;
  private soundRoulette: boolean = true;
  private soundUI: boolean = true;
  private isNative: boolean = false;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.loadSettings();
  }

  public loadSettings(): AudioHapticsSettings {
    try {
      const soundVal = localStorage.getItem('profasist_sound_enabled');
      this.soundEnabled = soundVal !== null ? soundVal === 'true' : true;

      const volVal = localStorage.getItem('profasist_sound_volume');
      this.soundVolume = volVal !== null ? parseFloat(volVal) : 0.8;

      const hapticsVal = localStorage.getItem('profasist_haptics_enabled');
      this.hapticsEnabled = hapticsVal !== null ? hapticsVal === 'true' : true;

      const intensityVal = localStorage.getItem('profasist_haptics_intensity') as HapticIntensity;
      this.hapticsIntensity = intensityVal || 'medium';

      const attVal = localStorage.getItem('profasist_sound_attendance');
      this.soundAttendance = attVal !== null ? attVal === 'true' : true;

      const timerVal = localStorage.getItem('profasist_sound_timer');
      this.soundTimer = timerVal !== null ? timerVal === 'true' : true;

      const rouletteVal = localStorage.getItem('profasist_sound_roulette');
      this.soundRoulette = rouletteVal !== null ? rouletteVal === 'true' : true;

      const uiVal = localStorage.getItem('profasist_sound_ui');
      this.soundUI = uiVal !== null ? uiVal === 'true' : true;
    } catch (e) {
      this.soundEnabled = true;
      this.soundVolume = 0.8;
      this.hapticsEnabled = true;
      this.hapticsIntensity = 'medium';
    }

    return this.getSettings();
  }

  public getSettings(): AudioHapticsSettings {
    return {
      soundEnabled: this.soundEnabled,
      soundVolume: this.soundVolume,
      hapticsEnabled: this.hapticsEnabled,
      hapticsIntensity: this.hapticsIntensity,
      soundAttendance: this.soundAttendance,
      soundTimer: this.soundTimer,
      soundRoulette: this.soundRoulette,
      soundUI: this.soundUI
    };
  }

  public updateSettings(newSettings: Partial<AudioHapticsSettings>) {
    if (newSettings.soundEnabled !== undefined) {
      this.soundEnabled = newSettings.soundEnabled;
      localStorage.setItem('profasist_sound_enabled', String(this.soundEnabled));
    }
    if (newSettings.soundVolume !== undefined) {
      this.soundVolume = Math.max(0, Math.min(1, newSettings.soundVolume));
      localStorage.setItem('profasist_sound_volume', String(this.soundVolume));
    }
    if (newSettings.hapticsEnabled !== undefined) {
      this.hapticsEnabled = newSettings.hapticsEnabled;
      localStorage.setItem('profasist_haptics_enabled', String(this.hapticsEnabled));
    }
    if (newSettings.hapticsIntensity !== undefined) {
      this.hapticsIntensity = newSettings.hapticsIntensity;
      localStorage.setItem('profasist_haptics_intensity', this.hapticsIntensity);
    }
    if (newSettings.soundAttendance !== undefined) {
      this.soundAttendance = newSettings.soundAttendance;
      localStorage.setItem('profasist_sound_attendance', String(this.soundAttendance));
    }
    if (newSettings.soundTimer !== undefined) {
      this.soundTimer = newSettings.soundTimer;
      localStorage.setItem('profasist_sound_timer', String(this.soundTimer));
    }
    if (newSettings.soundRoulette !== undefined) {
      this.soundRoulette = newSettings.soundRoulette;
      localStorage.setItem('profasist_sound_roulette', String(this.soundRoulette));
    }
    if (newSettings.soundUI !== undefined) {
      this.soundUI = newSettings.soundUI;
      localStorage.setItem('profasist_sound_ui', String(this.soundUI));
    }
  }

  public setSoundEnabled(enabled: boolean) {
    this.updateSettings({ soundEnabled: enabled });
  }

  public setHapticsEnabled(enabled: boolean) {
    this.updateSettings({ hapticsEnabled: enabled });
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

  public triggerHaptic(type: 'short' | 'success' | 'alert' | 'tick') {
    if (!this.hapticsEnabled) return;

    if (this.isNative) {
      try {
        if (type === 'short' || type === 'tick') {
          const style = this.hapticsIntensity === 'light' ? ImpactStyle.Light 
                      : this.hapticsIntensity === 'heavy' ? ImpactStyle.Heavy 
                      : ImpactStyle.Medium;
          Haptics.impact({ style });
        } else if (type === 'success') {
          Haptics.notification({ type: NotificationType.Success });
        } else if (type === 'alert') {
          Haptics.notification({ type: NotificationType.Warning });
        }
        return;
      } catch (e) {}
    }

    // Web fallback using navigator.vibrate
    if ('vibrate' in navigator) {
      try {
        if (type === 'short' || type === 'tick') {
          const ms = this.hapticsIntensity === 'light' ? 10 : this.hapticsIntensity === 'heavy' ? 25 : 15;
          navigator.vibrate(ms);
        } else if (type === 'success') {
          navigator.vibrate([25, 30, 35]);
        } else if (type === 'alert') {
          navigator.vibrate([50, 40, 50]);
        }
      } catch (e) {}
    }
  }

  public vibrateShort() {
    this.triggerHaptic('short');
  }

  public vibrateSuccess() {
    this.triggerHaptic('success');
  }

  public vibrateAlert() {
    this.triggerHaptic('alert');
  }

  // --- SOUND SYNTHESIZERS (WEB AUDIO API) ---

  public playPop() {
    this.vibrateShort();
    if (!this.soundEnabled || !this.soundUI) return;
    this.initAudio();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.audioCtx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.12 * this.soundVolume, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.04);
    } catch (e) {}
  }

  public playPresent() {
    this.vibrateSuccess();
    if (!this.soundEnabled || !this.soundAttendance) return;
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

      gain.gain.setValueAtTime(0.15 * this.soundVolume, now);
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
    if (!this.soundEnabled || !this.soundAttendance) return;
    this.initAudio();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);

      gain.gain.setValueAtTime(0.1 * this.soundVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  public playSuccess() {
    this.vibrateSuccess();
    if (!this.soundEnabled || !this.soundRoulette) return;
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

        gain.gain.setValueAtTime(0.12 * this.soundVolume, now + idx * 0.05);
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
    if (!this.soundEnabled || (!this.soundTimer && !this.soundRoulette)) return;
    this.initAudio();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.02);

      gain.gain.setValueAtTime(0.08 * this.soundVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.02);
    } catch (e) {}
  }

  public playAlarm() {
    this.vibrateAlert();
    if (!this.soundEnabled || !this.soundTimer) return;
    this.initAudio();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      for (let i = 0; i < 3; i++) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now + i * 0.2);

        gain.gain.setValueAtTime(0.15 * this.soundVolume, now + i * 0.2);
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
