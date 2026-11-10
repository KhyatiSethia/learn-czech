import { describe, expect, it } from 'vitest'
import * as webllm from '@mlc-ai/web-llm'
import { MODEL_CHOICES, modelIdFor } from '../docs/.vitepress/theme/lib/tutor-models'

describe('tutor model list', () => {
  const known = new Set(webllm.prebuiltAppConfig.model_list.map((m) => m.model_id))

  it('only offers models the installed WebLLM version actually ships', () => {
    for (const c of MODEL_CHOICES) {
      expect(known.has(c.f16), c.f16).toBe(true)
      if (c.f32) expect(known.has(c.f32), c.f32).toBe(true)
    }
  })

  it('picks the 32-bit build when the GPU lacks 16-bit shaders, and nothing if there is none', () => {
    const balanced = MODEL_CHOICES.find((c) => c.key === 'balanced')!
    const light = MODEL_CHOICES.find((c) => c.key === 'light')!
    expect(modelIdFor(balanced, true)).toBe(balanced.f16)
    expect(modelIdFor(balanced, false)).toBe(balanced.f32)
    expect(modelIdFor(light, false)).toBeNull()
  })

  it('quotes GPU memory figures that match WebLLM\'s own numbers', () => {
    const mb = (id: string) => Math.round(webllm.prebuiltAppConfig.model_list.find((m) => m.model_id === id)!.vram_required_MB!)
    for (const c of MODEL_CHOICES) {
      expect(c.mb16, c.f16).toBe(mb(c.f16))
      if (c.f32) expect(c.mb32, c.f32).toBe(mb(c.f32))
    }
  })

  it('stays within a 4096-token context window', () => {
    for (const c of MODEL_CHOICES) {
      const rec = webllm.prebuiltAppConfig.model_list.find((m) => m.model_id === c.f16)!
      expect(rec.overrides?.context_window_size ?? 4096).toBeLessThanOrEqual(4096)
    }
  })
})
