interface Piece {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  rot: number
  vr: number
  color: string
}

const COLORS = ['#c8202f', '#11457e', '#f4b400', '#ffffff', '#1e8a55']

/** Fire a short burst of confetti on a full-screen canvas. Does nothing if the user prefers reduced motion. */
export function burst(canvas: HTMLCanvasElement | null, count = 120, origin: { x: number; y: number } = { x: 0.5, y: 0.35 }) {
  if (!canvas || typeof window === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const W = (canvas.width = window.innerWidth * dpr)
  const H = (canvas.height = window.innerHeight * dpr)
  const pieces: Piece[] = Array.from({ length: count }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9
    const speed = (6 + Math.random() * 9) * dpr
    return {
      x: origin.x * W,
      y: origin.y * H,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: (5 + Math.random() * 6) * dpr,
      h: (3 + Math.random() * 4) * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }
  })
  const start = performance.now()
  const frame = (now: number) => {
    const t = now - start
    ctx.clearRect(0, 0, W, H)
    for (const p of pieces) {
      p.vy += 0.32 * dpr
      p.vx *= 0.992
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.globalAlpha = Math.max(0, 1 - t / 2600)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }
    if (t < 2600) requestAnimationFrame(frame)
    else ctx.clearRect(0, 0, W, H)
  }
  requestAnimationFrame(frame)
}
