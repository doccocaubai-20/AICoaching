/**
 * CALISCOACHING - WORKOUT SOUND SYNTHESIZER (WEB AUDIO API)
 * Bộ tổng hợp âm thanh nhẹ, không cần file mp3 bên ngoài, chạy tức thì trên mọi trình duyệt.
 */

class SoundSynthesizer {
  private audioCtx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Tiếng Beep đếm ngược ngắn (chuẩn bị)
   */
  playCountdownBeep(freq = 600, duration = 0.1) {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Bỏ qua lỗi audio policy
    }
  }

  /**
   * Tiếng Ding trong trẻo khi hoàn thành 1 hiệp (Set complete)
   */
  playSetCompleteDing() {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now); // nốt A5
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.3); // nốt A6

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(now + 0.5);
    } catch {
      // Audio policy
    }
  }

  /**
   * Tiếng chuông báo hết giờ nghỉ (Rest time over -> Vào set mới!)
   */
  playRestOverAlarm() {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const startTime = ctx.currentTime + i * 0.1;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.25, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.25);
      });
    } catch {
      // Audio policy
    }
  }

  /**
   * Tiếng nhạc chiến thắng khi hoàn thành trọn vẹn buổi tập (Fanfare)
   */
  playWorkoutFinishedFanfare() {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const chords = [523.25, 659.25, 783.99, 1046.5]; // C - E - G - C
      chords.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 1.2);
      });
    } catch {
      // Audio policy
    }
  }
}

export const workoutSound = new SoundSynthesizer();
