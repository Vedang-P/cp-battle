/**
 * Sound effects for CP Battle — high octane electro EDM style.
 *
 * All sounds are synthesized using the Web Audio API.
 * No external audio files needed.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/** Resume audio context (must be called from a user gesture). */
export function resumeAudio() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
}

/** Play a submission judged sound — quick synth stab. */
export function playJudged(verdict: 'AC' | 'WA' | 'TLE' | 'RE' | 'CE' | string) {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;

    if (verdict === 'AC') {
      // Victory arpeggio — 3 ascending notes
      [0, 0.08, 0.16].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime([523, 659, 784][i]!, now + delay); // C5, E5, G5
        gain.gain.setValueAtTime(0.15, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.25);
      });
    } else {
      // Wrong answer — descending buzz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch {}
}

/** Play match found sound — epic reveal sting. */
export function playMatchFound() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;

    // Whoosh + hit
    const noise = ctx.createOscillator();
    const noiseGain = ctx.createGain();
    noise.type = 'sawtooth';
    noise.frequency.setValueAtTime(200, now);
    noise.frequency.exponentialRampToValueAtTime(800, now + 0.1);
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    noise.connect(noiseGain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.35);

    // Bass drop
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(80, now + 0.05);
    bassGain.gain.setValueAtTime(0.25, now + 0.05);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    bass.connect(bassGain).connect(ctx.destination);
    bass.start(now + 0.05);
    bass.stop(now + 0.45);
  } catch {}
}

/** Play victory fanfare — triumphant electro blast. */
export function playVictory() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;

    // Rising chord stab
    [0, 0.12, 0.24].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime([262, 330, 392][i]!, now + delay); // C4, E4, G4
      gain.gain.setValueAtTime(0.15, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.45);
    });

    // Final blast
    const blast = ctx.createOscillator();
    const blastGain = ctx.createGain();
    blast.type = 'sawtooth';
    blast.frequency.setValueAtTime(523, now + 0.36); // C5
    blastGain.gain.setValueAtTime(0.2, now + 0.36);
    blastGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    blast.connect(blastGain).connect(ctx.destination);
    blast.start(now + 0.36);
    blast.stop(now + 0.85);
  } catch {}
}

/** Play defeat sound — low rumble. */
export function playDefeat() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.5);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.65);
  } catch {}
}

/** Play problem solved sound — quick ascending ping. */
export function playProblemSolved() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch {}
}

/** Play opponent solved sound — pressure alert. */
export function playOpponentSolved() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;

    // Double beep
    [0, 0.12].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now + delay);
      gain.gain.setValueAtTime(0.08, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.1);
    });
  } catch {}
}

/** Play tick sound for countdown. */
export function playTick() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  } catch {}
}
