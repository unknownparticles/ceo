/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Elegant Retro Synth Sounds using Web Audio API

let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export const playSound = {
  // Positive coin chime for business success
  success: () => {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.24); // C6

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.start(now);
      osc.stop(now + 0.42);
    } catch (e) {
      console.warn("Audio Context blocked or not supported", e);
    }
  },

  // Sad sliding slide-down synth for negative impacts/ruin
  failure: () => {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(329.63, now); // E4
      osc.frequency.exponentialRampToValueAtTime(110.00, now + 0.45); // A2

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {
      console.warn(e);
    }
  },

  // Interactive UI click tap
  click: () => {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {
      console.warn(e);
    }
  },

  // Fast retro ticking warning for time pressure
  tick: (frequencyMultiplier: number = 1) => {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(1200 * frequencyMultiplier, now);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.setValueAtTime(0.08, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {
      console.warn(e);
    }
  },

  // Glorious 8-bit entrepreneurial startup chord (major triad with arpeggio)
  startupFanfare: () => {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Arpeggiate
      const playTone = (freq: number, startDelay: number, duration: number, type: OscillatorType = "square") => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + startDelay);
        osc.connect(gain);
        gain.connect(ctx.destination);

        gain.gain.setValueAtTime(0.08, now + startDelay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + startDelay + duration);

        osc.start(now + startDelay);
        osc.stop(now + startDelay + duration);
      };

      playTone(261.63, 0.0, 0.2);     // C4
      playTone(329.63, 0.1, 0.2);     // E4
      playTone(392.00, 0.2, 0.2);     // G4
      playTone(523.25, 0.3, 0.5, "sine"); // C5 (held)
      playTone(659.25, 0.4, 0.4, "sine"); // E5 (held)
    } catch (e) {
      console.warn(e);
    }
  }
};
