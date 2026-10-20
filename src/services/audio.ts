let context: AudioContext | null = null;
let musicTimer: ReturnType<typeof setInterval> | null = null;
let step = 0;

const MELODY = [523.25, 587.33, 659.25, 783.99, 659.25, 587.33];

function audioContext(): AudioContext | null {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!context) context = new Ctx();
  return context;
}

export function unlockAudio(): void {
  const ctx = audioContext();
  if (ctx?.state === 'suspended') void ctx.resume();
}

function tone(frequency: number, duration: number, gainValue: number, delay = 0): void {
  const ctx = audioContext();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playChime(): void {
  tone(523.25, 0.18, 0.03);
  tone(659.25, 0.22, 0.02, 0.08);
}

export function playPage(): void {
  tone(392, 0.12, 0.02);
}

export function syncMusic(enabled: boolean): void {
  if (!enabled) {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
    return;
  }
  unlockAudio();
  if (musicTimer) return;
  musicTimer = setInterval(() => {
    const note = MELODY[step % MELODY.length] ?? 523;
    step += 1;
    tone(note, 0.35, 0.015);
  }, 1400);
}
