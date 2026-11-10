let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx ??= new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.07) {
  const c = audio()
  if (!c) return
  const t0 = c.currentTime + start
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

export const sounds = {
  correct() {
    tone(659.25, 0, 0.1)
    tone(880, 0.09, 0.18)
  },
  almost() {
    tone(587.33, 0, 0.12)
    tone(698.46, 0.11, 0.14)
  },
  wrong() {
    tone(196, 0, 0.16, 'triangle', 0.09)
    tone(146.83, 0.12, 0.26, 'triangle', 0.09)
  },
  finish() {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.11, 0.22))
  },
  tick() {
    tone(440, 0, 0.04, 'square', 0.025)
  },
}
