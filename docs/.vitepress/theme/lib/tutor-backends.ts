import type { MLCEngineInterface } from '@mlc-ai/web-llm'

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant'
  content: string
}
export interface LoadProgress {
  text: string
  /** 0..1 */
  progress: number
}

export interface Backend {
  load(onProgress: (p: LoadProgress) => void): Promise<void>
  generate(messages: ChatMsg[], onToken: (delta: string) => void): Promise<void>
  stop(): void
  unload(): Promise<void>
}

const GEN = { temperature: 0.3, top_p: 0.9, max_tokens: 700 }

/** The model runs inside this browser tab on the GPU (WebGPU) and is cached for offline use. */
export class WebLlmBackend implements Backend {
  private engine: MLCEngineInterface | null = null
  private worker: Worker | null = null

  constructor(private readonly modelId: string) {}

  async load(onProgress: (p: LoadProgress) => void) {
    const webllm = await import('@mlc-ai/web-llm')
    this.worker = new Worker(new URL('./llm.worker.ts', import.meta.url), { type: 'module' })
    this.engine = await webllm.CreateWebWorkerMLCEngine(this.worker, this.modelId, {
      initProgressCallback: (r) => onProgress({ text: r.text, progress: r.progress }),
    })
    try {
      // Ask the browser not to evict the downloaded model when disk space gets tight.
      await navigator.storage?.persist?.()
    } catch {
      /* optional */
    }
  }

  async generate(messages: ChatMsg[], onToken: (delta: string) => void) {
    if (!this.engine) throw new Error('The model is not loaded yet')
    const stream = await this.engine.chat.completions.create({ messages, stream: true, ...GEN })
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) onToken(delta)
    }
  }

  stop() {
    void this.engine?.interruptGenerate()
  }

  async unload() {
    try {
      await this.engine?.unload()
    } catch {
      /* already gone */
    }
    this.worker?.terminate()
    this.engine = null
    this.worker = null
  }
}

export function normalizeOllamaUrl(url: string): string {
  return url.trim().replace(/\/+$/, '') || 'http://localhost:11434'
}

export function ollamaUnreachable(url: string): string {
  return (
    `Could not reach Ollama at ${url}. Check that it is running. If it is, allow this site to talk to it by starting it with ` +
    `OLLAMA_ORIGINS="${location.origin}" (or "*") and try again.`
  )
}

export async function listOllamaModels(baseUrl: string): Promise<string[]> {
  const url = normalizeOllamaUrl(baseUrl)
  let res: Response
  try {
    res = await fetch(`${url}/api/tags`)
  } catch {
    throw new Error(ollamaUnreachable(url))
  }
  if (!res.ok) throw new Error(`Ollama answered ${res.status} at ${url}`)
  const json = (await res.json()) as { models?: { name: string }[] }
  return (json.models ?? []).map((m) => m.name)
}

/** An Ollama server running on this computer. Strongest option if you already use Ollama. */
export class OllamaBackend implements Backend {
  private abort: AbortController | null = null
  private readonly url: string

  constructor(baseUrl: string, private readonly model: string) {
    this.url = normalizeOllamaUrl(baseUrl)
  }

  async load(onProgress: (p: LoadProgress) => void) {
    onProgress({ text: `Connecting to Ollama at ${this.url}`, progress: 0.4 })
    const names = await listOllamaModels(this.url)
    const wanted = this.model.trim()
    if (!names.some((n) => n === wanted || n === `${wanted}:latest`)) {
      throw new Error(
        names.length
          ? `Ollama does not have "${wanted}". Installed: ${names.join(', ')}. To add it, run: ollama pull ${wanted}`
          : `Ollama has no models yet. Run: ollama pull ${wanted}`,
      )
    }
    onProgress({ text: 'Connected', progress: 1 })
  }

  async generate(messages: ChatMsg[], onToken: (delta: string) => void) {
    this.abort = new AbortController()
    let res: Response
    try {
      res = await fetch(`${this.url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
          options: { temperature: GEN.temperature, top_p: GEN.top_p, num_ctx: 4096, num_predict: GEN.max_tokens },
        }),
        signal: this.abort.signal,
      })
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      throw new Error(ollamaUnreachable(this.url))
    }
    if (!res.ok || !res.body) throw new Error(`Ollama answered ${res.status}`)

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim()
          buf = buf.slice(nl + 1)
          if (!line) continue
          const msg = JSON.parse(line) as { message?: { content?: string }; error?: string }
          if (msg.error) throw new Error(msg.error)
          if (msg.message?.content) onToken(msg.message.content)
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') throw e
    }
  }

  stop() {
    this.abort?.abort()
  }

  async unload() {
    this.stop()
  }
}
