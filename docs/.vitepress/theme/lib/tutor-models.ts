export interface ModelChoice {
  key: 'light' | 'balanced' | 'strong'
  label: string
  blurb: string
  /** WebLLM model id for GPUs with 16-bit shader support (most laptops from the last few years). */
  f16: string
  /** Fallback id for GPUs without it. Missing means the model needs 16-bit shader support. */
  f32?: string
  /** Approximate GPU memory needed, in MB, as reported by WebLLM's model list. */
  mb16: number
  mb32?: number
}

// Ids are checked against WebLLM's built-in list by tests/tutor.test.ts.
export const MODEL_CHOICES: ModelChoice[] = [
  {
    key: 'light',
    label: 'Light',
    blurb: 'Gemma 3 1B. Smallest and quickest. Fine for short explanations; expect more slips in Czech forms.',
    f16: 'gemma3-1b-it-q4f16_1-MLC',
    mb16: 711,
  },
  {
    key: 'balanced',
    label: 'Balanced',
    blurb: 'Gemma 2 2B. Better Czech and clearer explanations. The best place to start.',
    f16: 'gemma-2-2b-it-q4f16_1-MLC',
    f32: 'gemma-2-2b-it-q4f32_1-MLC',
    mb16: 1895,
    mb32: 2509,
  },
  {
    key: 'strong',
    label: 'Strong',
    blurb: 'Qwen 2.5 3B. The most capable of the three, but slower and happier on a laptop with 8 GB of RAM or more.',
    f16: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
    f32: 'Qwen2.5-3B-Instruct-q4f32_1-MLC',
    mb16: 2505,
    mb32: 2894,
  },
]

export function modelIdFor(choice: ModelChoice, hasF16: boolean): string | null {
  return hasF16 ? choice.f16 : (choice.f32 ?? null)
}

export const SYSTEM_PROMPT = `You are a patient Czech tutor for an adult English speaker who is learning Czech (around level A2).
Always answer in English. Write Czech words with their correct diacritics (á č ď é ě í ň ó ř š ť ú ů ý ž) and give a short English translation in brackets the first time a Czech word appears.
When asked to explain a Czech sentence or an exercise answer: 1) translate it, 2) go through the words and name the case, tense or aspect where it matters, 3) state the rule in one or two sentences, 4) give one short extra example.
Keep answers under 180 words. Use short lists and put Czech examples in bold.
If you are not sure about a Czech form, say so plainly instead of guessing. Do not invent rules.`

export function gpuMemory(choice: ModelChoice, hasF16: boolean): number | null {
  return hasF16 ? choice.mb16 : (choice.mb32 ?? null)
}

export function formatMb(mb: number): string {
  return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb} MB`
}
