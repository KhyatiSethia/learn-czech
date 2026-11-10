import { reactive } from 'vue'
import MarkdownIt from 'markdown-it'
import { MODEL_CHOICES, SYSTEM_PROMPT, modelIdFor } from './tutor-models'
import { OllamaBackend, WebLlmBackend, type Backend, type ChatMsg } from './tutor-backends'

const KEY = 'czech.tutor.v1'

export type BackendKind = 'webllm' | 'ollama'

export interface UiMsg {
  id: number
  role: 'user' | 'assistant'
  content: string
}

export const tutor = reactive({
  open: false,
  backend: 'webllm' as BackendKind,
  choice: 'balanced' as 'light' | 'balanced' | 'strong',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'gemma3:4b',
  status: 'idle' as 'idle' | 'loading' | 'ready' | 'error',
  progress: 0,
  progressText: '',
  error: '',
  generating: false,
  messages: [] as UiMsg[],
  input: '',
  /** After the model finishes loading, send whatever is in the input box. */
  autoSend: false,
  gpu: 'unknown' as 'unknown' | 'yes' | 'no',
  f16: false,
  cached: {} as Record<string, boolean>,
  ready: false,
})

let backend: Backend | null = null
let nextId = 1
let initialised = false
let pendingContext = ''

const md = new MarkdownIt({ html: false, linkify: false, breaks: true })
export function renderMarkdown(text: string): string {
  return md.render(text)
}

function persist() {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        backend: tutor.backend,
        choice: tutor.choice,
        ollamaUrl: tutor.ollamaUrl,
        ollamaModel: tutor.ollamaModel,
        messages: tutor.messages.slice(-40),
      }),
    )
  } catch {
    /* ignore */
  }
}

export function currentModelId(): string | null {
  const choice = MODEL_CHOICES.find((c) => c.key === tutor.choice) ?? MODEL_CHOICES[1]
  return modelIdFor(choice, tutor.f16)
}

async function detectGpu() {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu
    if (!gpu) throw new Error('no webgpu')
    const adapter = await gpu.requestAdapter()
    if (!adapter) throw new Error('no adapter')
    tutor.gpu = 'yes'
    tutor.f16 = adapter.features.has('shader-f16')
  } catch {
    tutor.gpu = 'no'
    tutor.f16 = false
  }
}

async function refreshCache() {
  if (tutor.gpu !== 'yes') return
  try {
    const { hasModelInCache } = await import('@mlc-ai/web-llm')
    const entries = await Promise.all(
      MODEL_CHOICES.flatMap((c) => [c.f16, c.f32].filter((x): x is string => !!x)).map(
        async (id) => [id, await hasModelInCache(id)] as const,
      ),
    )
    tutor.cached = Object.fromEntries(entries)
  } catch {
    /* cache probing is best effort */
  }
}

/** Call once when the drawer first appears in the browser. */
export async function initTutor() {
  if (initialised) return
  initialised = true
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (saved) {
      if (saved.backend === 'webllm' || saved.backend === 'ollama') tutor.backend = saved.backend
      if (MODEL_CHOICES.some((c) => c.key === saved.choice)) tutor.choice = saved.choice
      if (typeof saved.ollamaUrl === 'string') tutor.ollamaUrl = saved.ollamaUrl
      if (typeof saved.ollamaModel === 'string') tutor.ollamaModel = saved.ollamaModel
      if (Array.isArray(saved.messages)) {
        tutor.messages = saved.messages.filter(
          (m: UiMsg) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string',
        )
        nextId = tutor.messages.reduce((n, m) => Math.max(n, m.id ?? 0), 0) + 1
      }
    }
  } catch {
    /* start fresh */
  }
  await detectGpu()
}

/** Probe which models are already downloaded. Imports the model library, so call it only once the drawer is open. */
export async function probeDownloads() {
  await refreshCache()
}

export async function startTutor() {
  if (tutor.status === 'loading') return
  tutor.error = ''
  tutor.status = 'loading'
  tutor.progress = 0
  tutor.progressText = 'Starting'
  tutor.ready = false
  try {
    await backend?.unload()
    backend = null
    if (tutor.backend === 'ollama') {
      backend = new OllamaBackend(tutor.ollamaUrl, tutor.ollamaModel)
    } else {
      const id = currentModelId()
      if (!id) throw new Error('This model needs a GPU with 16-bit shader support. Pick Balanced or Strong, or use Ollama.')
      if (tutor.gpu === 'no') throw new Error('This browser has no WebGPU. Try a recent Chrome or Edge, or use Ollama.')
      backend = new WebLlmBackend(id)
    }
    await backend.load((p) => {
      tutor.progress = p.progress
      tutor.progressText = p.text
    })
    tutor.status = 'ready'
    tutor.ready = true
    persist()
    void refreshCache()
    if (tutor.autoSend && tutor.input.trim()) {
      tutor.autoSend = false
      await sendMessage(tutor.input, pendingContext)
    }
  } catch (e) {
    backend = null
    tutor.status = 'error'
    tutor.ready = false
    tutor.error = friendlyError(e)
  }
}

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/out of memory|OOM|allocation|Device was lost|createBuffer/i.test(msg)) {
    return 'The GPU ran out of memory. Close other tabs or pick a lighter model, then try again.'
  }
  if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(msg) && tutor.backend === 'webllm') {
    return 'The model files could not be downloaded. Check your connection. If you already downloaded this model, it will load offline.'
  }
  return msg
}

export function stopGenerating() {
  backend?.stop()
}

export async function stopTutor() {
  stopGenerating()
  await backend?.unload()
  backend = null
  tutor.status = 'idle'
  tutor.ready = false
}

export async function forgetModel(id: string) {
  try {
    if (tutor.ready && tutor.backend === 'webllm') await stopTutor()
    const { deleteModelAllInfoInCache } = await import('@mlc-ai/web-llm')
    await deleteModelAllInfoInCache(id)
  } finally {
    await refreshCache()
  }
}

export function clearChat() {
  tutor.messages = []
  persist()
}

function pageText(): string {
  const el = document.querySelector('.vp-doc') as HTMLElement | null
  return (el?.innerText ?? '').replace(/[\u200b\u00ad]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 1800)
}

/** The grammar page the learner is reading, trimmed to fit a small model's context. */
export function pageContext(): string {
  const text = pageText()
  return text ? `Page: ${document.title}\n${text}` : ''
}

function historyFor(messages: UiMsg[]): ChatMsg[] {
  const out: ChatMsg[] = []
  let budget = 3000
  for (let i = messages.length - 1; i >= 0 && out.length < 6; i--) {
    const m = messages[i]
    if (!m.content) continue
    budget -= m.content.length
    if (budget < 0) break
    out.unshift({ role: m.role, content: m.content })
  }
  // Models expect the conversation to start with a user turn.
  while (out.length && out[0].role !== 'user') out.shift()
  return out
}

export async function sendMessage(text: string, context = '') {
  const clean = text.trim()
  if (!clean || tutor.generating) return
  if (!backend || tutor.status !== 'ready') {
    tutor.input = clean
    return
  }
  const history = historyFor(tutor.messages)
  tutor.messages.push({ id: nextId++, role: 'user', content: clean })
  tutor.messages.push({ id: nextId++, role: 'assistant', content: '' })
  tutor.input = ''
  tutor.generating = true
  const reply = tutor.messages[tutor.messages.length - 1]

  const userTurn = context
    ? `What the learner is looking at:\n"""\n${context}\n"""\n\n${clean}`
    : clean
  const messages: ChatMsg[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...history, { role: 'user', content: userTurn }]

  try {
    await backend.generate(messages, (delta) => {
      reply.content += delta
    })
    if (!reply.content.trim()) reply.content = '(No answer came back. Try asking again, or pick a larger model.)'
  } catch (e) {
    reply.content += `${reply.content ? '\n\n' : ''}**Something went wrong:** ${friendlyError(e)}`
  } finally {
    tutor.generating = false
    persist()
  }
}

/**
 * Open the tutor, optionally with a ready-made question.
 * If the model is already running the question is sent right away; otherwise it waits
 * in the input box and is sent as soon as the learner starts the model.
 */
export function openTutor(prompt?: string, opts: { context?: string; send?: boolean } = {}) {
  tutor.open = true
  if (!prompt) return
  pendingContext = opts.context ?? ''
  if (tutor.ready && opts.send !== false) {
    void sendMessage(prompt, pendingContext)
  } else {
    tutor.input = prompt
    tutor.autoSend = opts.send !== false
  }
}

export function closeTutor() {
  tutor.open = false
}

export function askAboutPage(question: string) {
  openTutor(question, { context: pageContext() })
}

export function setInput(text: string) {
  tutor.input = text
  tutor.autoSend = false
}

export function noteContextForNextSend(ctx: string) {
  pendingContext = ctx
}
