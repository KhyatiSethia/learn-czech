<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Item } from '../lib/types'
import type { Prefs } from '../lib/store'
import { Session, hintFor, type AnswerResult, type Summary, type Tile } from '../lib/session'
import { normalize } from '../lib/text'
import { sounds } from '../lib/sound'
import { burst } from '../lib/confetti'
import { openTutor } from '../lib/tutor'
import DiaText from './DiaText.vue'
import CzechKeys from './CzechKeys.vue'
import TramRoute from './TramRoute.vue'

const props = defineProps<{
  title: string
  items: Item[]
  pool: Item[]
  prefs: Prefs
}>()

const emit = defineEmits<{
  exit: []
  again: []
  mistakes: [items: Item[]]
  done: [summary: Summary]
}>()

const session = reactive(
  new Session(props.items, props.pool, {
    mode: props.prefs.mode,
    hearts: props.prefs.hearts,
    strict: props.prefs.strict,
  }),
) as Session

// The challenge on screen. It stays put while feedback is showing, even though the
// session has already moved on to the next one.
const shown = ref(session.current)
const answer = ref('')
const picked = ref<string | null>(null)
const built = ref<Tile[]>([])
const hintText = ref('')
const feedback = ref<AnswerResult | null>(null)
const summary = ref<Summary | null>(null)
const leaving = ref(false)
const shaking = ref(false)

const inputEl = ref<HTMLInputElement | null>(null)
const continueEl = ref<HTMLButtonElement | null>(null)
const confettiEl = ref<HTMLCanvasElement | null>(null)

const PRAISE: [string, string][] = [
  ['Výborně!', 'Excellent'],
  ['Skvěle!', 'Great'],
  ['Správně!', 'Correct'],
  ['Paráda!', 'Awesome'],
  ['Bezva!', 'Nice one'],
  ['Perfektní!', 'Perfect'],
]
const praise = ref(PRAISE[0])

const kind = computed(() => shown.value?.kind ?? 'type')
const fill = computed(() => {
  const q = shown.value?.item.q ?? ''
  const m = /_{3,}/.exec(q)
  return m ? { before: q.slice(0, m.index), after: q.slice(m.index + m[0].length) } : null
})
const kindLabel = computed(() => {
  if (kind.value === 'choice') return 'Pick the right one'
  if (kind.value === 'tiles') return 'Build the sentence'
  return fill.value ? 'Fill the gap' : 'Type the answer'
})
const gapValue = computed(() => {
  if (kind.value === 'choice') return picked.value ?? ''
  if (kind.value === 'tiles') return built.value.map((t) => t.text).join(' ')
  return answer.value
})
const gapClass = computed(() => {
  const f = feedback.value
  return f ? (f.verdict === 'correct' ? 'right' : f.verdict === 'almost' ? 'close' : 'wrong') : gapValue.value ? 'filled' : ''
})
const canCheck = computed(() => {
  if (!shown.value || feedback.value) return false
  if (kind.value === 'type') return answer.value.trim() !== ''
  if (kind.value === 'choice') return picked.value !== null
  return built.value.length > 0
})
const usedIds = computed(() => new Set(built.value.map((t) => t.id)))
const answerKeys = computed(() => new Set((shown.value?.item.a ?? []).map(normalize)))
const isRight = (opt: string) => answerKeys.value.has(normalize(opt))
const alsoAccepted = computed(() => (feedback.value?.item.a ?? []).filter((a) => a !== feedback.value?.expected))

function resetInputs() {
  answer.value = ''
  picked.value = null
  built.value = []
  hintText.value = ''
  feedback.value = null
}

function focusSoon() {
  nextTick(() => {
    if (kind.value === 'type') inputEl.value?.focus()
  })
}

function showHint() {
  if (shown.value && !hintText.value) hintText.value = hintFor(shown.value.item)
}

function insertChar(ch: string) {
  const el = inputEl.value
  if (!el || feedback.value) return
  const start = el.selectionStart ?? answer.value.length
  const end = el.selectionEnd ?? start
  answer.value = answer.value.slice(0, start) + ch + answer.value.slice(end)
  nextTick(() => {
    el.focus()
    el.setSelectionRange(start + 1, start + 1)
  })
}

function pick(opt: string) {
  if (feedback.value) return
  picked.value = opt
  if (props.prefs.sound) sounds.tick()
}
function place(t: Tile) {
  if (feedback.value || usedIds.value.has(t.id)) return
  built.value = [...built.value, t]
  if (props.prefs.sound) sounds.tick()
}
function unplace(t: Tile) {
  if (feedback.value) return
  built.value = built.value.filter((b) => b.id !== t.id)
}

function check() {
  const ch = shown.value
  if (!ch || !canCheck.value) return
  const response = ch.kind === 'type' ? answer.value : ch.kind === 'choice' ? (picked.value as string) : built.value.map((t) => t.text)
  const result = session.submit(response, !!hintText.value)
  feedback.value = result

  if (result.verdict === 'wrong') {
    shaking.value = true
    setTimeout(() => (shaking.value = false), 400)
    if (props.prefs.sound) sounds.wrong()
  } else {
    praise.value = PRAISE[Math.floor(Math.random() * PRAISE.length)]
    if (props.prefs.sound) (result.verdict === 'correct' ? sounds.correct : sounds.almost)()
    if (session.streak > 0 && session.streak % 5 === 0) burst(confettiEl.value, 60, { x: 0.5, y: 0.85 })
  }
  nextTick(() => continueEl.value?.focus({ preventScroll: true }))
}

function next() {
  if (!feedback.value) return
  const wasFinished = feedback.value.finished
  resetInputs()
  if (wasFinished) {
    finish()
    return
  }
  shown.value = session.current
  focusSoon()
}

function finish() {
  const s = session.summary()
  summary.value = s
  emit('done', s)
  if (props.prefs.sound) sounds.finish()
  if (s.stars === 3) burst(confettiEl.value, 160)
}

function askTutorAbout(item: Item, expected: string, given?: string) {
  const mine = given ? ` I answered "${given}".` : ''
  openTutor(
    `In my Czech exercise the question was "${item.q}". The right answer is "${expected}".${mine} Explain why "${expected}" is correct${given ? ' and what I got wrong' : ''}.`,
    { send: true },
  )
}

function askLeave() {
  leaving.value = true
}

const cards = computed(() => summary.value?.missed ?? [])

function onKey(e: KeyboardEvent) {
  if (e.isComposing) return
  const target = e.target as HTMLElement | null
  if (target?.closest('.tutor')) return

  if (e.key === 'Escape') {
    if (!summary.value) leaving.value = !leaving.value
    return
  }
  if (leaving.value || summary.value) return

  if (e.key === 'Enter') {
    e.preventDefault()
    if (feedback.value) next()
    else check()
    return
  }
  if (feedback.value) return

  if (kind.value === 'choice' && /^[1-9]$/.test(e.key)) {
    const opt = shown.value?.options?.[Number(e.key) - 1]
    if (opt) pick(opt)
  } else if (kind.value === 'tiles' && e.key === 'Backspace' && target?.tagName !== 'INPUT') {
    built.value = built.value.slice(0, -1)
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.documentElement.style.overflow = 'hidden'
  focusSoon()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.documentElement.style.overflow = ''
})
</script>

<template>
  <div class="game" role="dialog" aria-modal="true" :aria-label="`Practice: ${title}`">
    <canvas ref="confettiEl" class="confetti" aria-hidden="true" />

    <header class="top">
      <button class="close" type="button" aria-label="Leave this run" @click="askLeave">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
        </svg>
      </button>
      <TramRoute :total="session.total" :done="session.doneIds.length" />
      <div class="chips">
        <span v-if="session.streak >= 2" class="chip streak" :key="session.streak">{{ session.streak }} in a row</span>
        <span class="chip xp">{{ session.xp }} XP</span>
        <span v-if="prefs.hearts" class="hearts" role="img" :aria-label="`${session.lives} of 3 hearts left`">
          <svg v-for="n in 3" :key="n" viewBox="0 0 24 22" width="22" height="20" :class="{ lost: n > session.lives }">
            <path d="M12 21C5.5 15.5 1.5 12 1.5 7.5 1.5 4.4 3.9 2 7 2c1.9 0 3.7 1 5 2.7C13.3 3 15.1 2 17 2c3.1 0 5.5 2.4 5.5 5.5 0 4.5-4 8-10.5 13.5z" />
          </svg>
        </span>
      </div>
    </header>

    <main v-if="!summary && shown" :key="shown.key" class="stage">
      <p class="kind">{{ kindLabel }}</p>

      <div class="prompt" :class="{ shake: shaking, hit: feedback && feedback.verdict !== 'wrong' }">
        <p v-if="!fill" class="q"><DiaText :text="shown.item.q" /></p>
        <p v-else class="q">
          <DiaText :text="fill.before" /><span class="gap" :class="gapClass"
            ><DiaText v-if="gapValue" :text="gapValue" /><i v-else aria-label="blank">&nbsp;</i></span
          ><DiaText :text="fill.after" />
        </p>
        <p v-if="hintText" class="hint"><span>Hint</span> {{ hintText }}</p>
      </div>

      <div class="answer">
        <template v-if="kind === 'type'">
          <input
            ref="inputEl"
            v-model="answer"
            class="field"
            type="text"
            :disabled="!!feedback"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="done"
            aria-label="Your answer"
            placeholder="Type your answer"
          />
          <CzechKeys @insert="insertChar" />
        </template>

        <ul v-else-if="kind === 'choice'" class="choices">
          <li v-for="(opt, i) in shown.options" :key="opt">
            <button
              type="button"
              class="choice"
              :class="{
                picked: picked === opt && !feedback,
                right: feedback && isRight(opt),
                wrong: feedback && picked === opt && !isRight(opt),
              }"
              :disabled="!!feedback"
              @click="pick(opt)"
            >
              <kbd>{{ i + 1 }}</kbd>
              <DiaText :text="opt" />
            </button>
          </li>
        </ul>

        <template v-else>
          <div class="built" :class="{ empty: !built.length }" aria-label="Your sentence">
            <button v-for="t in built" :key="t.id" type="button" class="tile on" :disabled="!!feedback" @click="unplace(t)">
              <DiaText :text="t.text" />
            </button>
            <span v-if="!built.length" class="ph">Tap the words in order</span>
          </div>
          <div class="bank">
            <button
              v-for="t in shown.tiles"
              :key="t.id"
              type="button"
              class="tile"
              :class="{ used: usedIds.has(t.id) }"
              :disabled="!!feedback || usedIds.has(t.id)"
              :tabindex="usedIds.has(t.id) ? -1 : 0"
              @click="place(t)"
            >
              <DiaText :text="t.text" />
            </button>
          </div>
        </template>
      </div>
    </main>

    <section v-else-if="summary" class="summary">
      <h2>
        {{ summary.failed ? 'Konec hry' : 'Hotovo!' }}
        <span class="gloss">{{ summary.failed ? 'Out of hearts' : 'Done' }}</span>
      </h2>

      <div class="stars" role="img" :aria-label="`${summary.stars} of 3 stars`">
        <svg v-for="n in 3" :key="n" viewBox="0 0 24 24" width="56" height="56" :class="{ on: n <= summary.stars }" :style="{ '--i': n }">
          <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" />
        </svg>
      </div>

      <dl class="tally">
        <div>
          <dt>Right first time</dt>
          <dd>{{ summary.firstTry }} of {{ summary.total }}</dd>
        </div>
        <div>
          <dt>XP earned</dt>
          <dd>+{{ summary.xp }}</dd>
        </div>
        <div>
          <dt>Longest streak</dt>
          <dd>{{ summary.bestStreak }}</dd>
        </div>
      </dl>

      <div v-if="cards.length" class="missed">
        <h3>Worth another look</h3>
        <ul>
          <li v-for="m in cards" :key="m.id">
            <span class="mq">{{ m.q }}</span>
            <span class="ma"><DiaText :text="m.a[0]" /></span>
            <button type="button" class="link" @click="askTutorAbout(m, m.a[0])">Ask the tutor</button>
          </li>
        </ul>
      </div>
      <p v-else class="perfect">Not a single miss. Nicely done.</p>

      <div class="acts">
        <button v-if="cards.length" type="button" class="primary" @click="emit('mistakes', cards)">Practise the misses</button>
        <button type="button" :class="cards.length ? 'secondary' : 'primary'" @click="emit('again')">Play again</button>
        <button type="button" class="ghost" @click="emit('exit')">Back to exercises</button>
      </div>
    </section>

    <footer v-if="!summary" class="bar" :class="feedback ? feedback.verdict : ''">
      <div v-if="!feedback" class="bar-inner">
        <button type="button" class="ghost" :disabled="!!hintText" @click="showHint">Hint</button>
        <span class="tip">Enter to check</span>
        <button type="button" class="primary" :disabled="!canCheck" @click="check">Check</button>
      </div>

      <div v-else class="bar-inner sheet" role="status" aria-live="polite">
        <div class="verdict">
          <p class="head">
            <template v-if="feedback.verdict === 'correct'">
              <strong>{{ praise[0] }}</strong> <span class="gloss">{{ praise[1] }}</span>
            </template>
            <template v-else-if="feedback.verdict === 'almost'">
              <strong>Skoro!</strong> <span class="gloss">Almost</span>
            </template>
            <template v-else>
              <strong>Ouha!</strong> <span class="gloss">Oops</span>
            </template>
            <span v-if="feedback.xp" class="gain">+{{ feedback.xp }} XP</span>
          </p>

          <p v-if="feedback.verdict === 'correct'" class="detail"><DiaText :text="feedback.expected" /></p>
          <template v-else-if="feedback.verdict === 'almost'">
            <p class="detail">
              {{ feedback.reason === 'diacritics' ? 'Mind the marks:' : 'Small slip:' }}
              <DiaText :text="feedback.expected" :against="feedback.given" />
            </p>
          </template>
          <template v-else>
            <p class="detail">
              Right answer:
              <DiaText :text="feedback.expected" />
            </p>
            <p v-if="feedback.reason === 'diacritics'" class="note">Your letters were right, but strict mode wants the marks too.</p>
            <p v-else-if="feedback.kind === 'type' && feedback.given" class="note">
              You wrote: <DiaText :text="feedback.given" />
            </p>
          </template>
          <p v-if="alsoAccepted.length && feedback.verdict !== 'wrong'" class="note">
            Also fine: <DiaText :text="alsoAccepted.join(' / ')" />
          </p>
          <p v-if="feedback.retry" class="note">This one will come back in a moment.</p>
        </div>

        <div class="acts">
          <button
            v-if="feedback.verdict !== 'correct'"
            type="button"
            class="ghost"
            @click="askTutorAbout(feedback.item, feedback.expected, feedback.given)"
          >
            Ask the tutor
          </button>
          <button ref="continueEl" type="button" class="primary" @click="next">
            {{ feedback.finished ? 'See results' : 'Continue' }}
          </button>
        </div>
      </div>
    </footer>

    <div v-if="leaving" class="leave" @click.self="leaving = false">
      <div class="leave-box" role="alertdialog" aria-labelledby="leave-title">
        <h3 id="leave-title">Leave this run?</h3>
        <p>Your answers so far won't be saved.</p>
        <div class="acts">
          <button type="button" class="primary" @click="leaving = false">Keep going</button>
          <button type="button" class="ghost" @click="emit('exit')">Leave</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game {
  position: fixed;
  inset: 0;
  z-index: 400;
  display: flex;
  flex-direction: column;
  background: var(--cz-paper);
  color: var(--cz-ink);
  font-family: var(--cz-ui);
}
.confetti {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 3;
}

/* top bar */
.top {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px 6px;
  max-width: 900px;
  width: 100%;
  margin: 0 auto;
}
.close {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--cz-muted);
  cursor: pointer;
}
.close:hover {
  background: var(--cz-blue-soft);
  color: var(--cz-ink);
}
.chips {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.chip {
  white-space: nowrap;
  padding: 3px 10px;
  border-radius: 6px;
  font: 600 15px/1.4 var(--cz-ui);
}
.chip.xp {
  background: var(--cz-yellow-soft);
  color: var(--cz-ink);
  box-shadow: inset 0 -2px 0 var(--cz-yellow);
}
.chip.streak {
  background: var(--cz-blue-soft);
  color: var(--cz-blue);
  animation: bump 0.3s cubic-bezier(0.3, 1.6, 0.5, 1);
}
.hearts {
  display: inline-flex;
  gap: 3px;
}
.hearts svg {
  fill: var(--cz-red);
  transition: fill 0.25s, transform 0.25s;
}
.hearts svg.lost {
  fill: var(--cz-line);
  transform: scale(0.85);
}

/* question */
.stage {
  flex: 1;
  overflow-y: auto;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: 28px 20px 24px;
  animation: rise 0.22s ease-out;
}
.kind {
  margin: 0 0 12px;
  font: 600 18px/1.2 var(--cz-ui);
  color: var(--cz-muted);
}
.prompt {
  padding: 22px 24px;
  border-radius: 14px;
  background: var(--cz-card);
  border: 1.5px solid var(--cz-line);
  border-bottom-width: 4px;
}
.prompt.shake {
  animation: shake 0.38s;
  border-color: var(--cz-red);
}
.prompt.hit {
  border-color: var(--cz-green);
  animation: pop 0.28s;
}
.q {
  margin: 0;
  font: 500 clamp(24px, 4.2vw, 34px) / 1.35 var(--vp-font-family-serif, 'Source Serif 4 Variable', Georgia, serif);
  overflow-wrap: anywhere;
}
.gap {
  display: inline-block;
  min-width: 3.2ch;
  margin: 0 0.2em;
  padding: 0 0.3em;
  border-bottom: 3px solid var(--cz-blue);
  background: var(--cz-blue-soft);
  border-radius: 4px 4px 0 0;
  text-align: center;
  line-height: 1.25;
}
.gap.filled {
  background: var(--cz-yellow-soft);
  border-color: var(--cz-yellow);
}
.gap.right {
  background: var(--cz-green-soft);
  border-color: var(--cz-green);
}
.gap.close {
  background: var(--cz-yellow-soft);
  border-color: var(--cz-yellow);
}
.gap.wrong {
  background: var(--cz-red-soft);
  border-color: var(--cz-red);
}
.hint {
  margin: 14px 0 0;
  font: 500 19px/1.4 var(--cz-ui);
  color: var(--cz-muted);
  letter-spacing: 0.02em;
}
.hint span {
  margin-right: 8px;
  padding: 1px 8px;
  border-radius: 4px;
  background: var(--cz-yellow-soft);
  color: var(--cz-ink);
  font-weight: 600;
}

.answer {
  margin-top: 22px;
}
.field {
  width: 100%;
  padding: 14px 16px;
  border: 2px solid var(--cz-line);
  border-radius: 12px;
  background: var(--cz-card);
  color: var(--cz-ink);
  font: 500 24px/1.3 var(--cz-ui);
}
.field:focus {
  outline: none;
  border-color: var(--cz-blue);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--cz-blue) 22%, transparent);
}
.field:disabled {
  opacity: 0.8;
}

.choices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.choice {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 64px;
  padding: 12px 16px;
  border: 2px solid var(--cz-line);
  border-bottom-width: 4px;
  border-radius: 12px;
  background: var(--cz-card);
  color: var(--cz-ink);
  font: 500 21px/1.25 var(--cz-ui);
  text-align: left;
  cursor: pointer;
  transition: transform 0.08s, border-color 0.12s, background 0.12s;
}
.choice kbd {
  flex: none;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1.5px solid var(--cz-line);
  border-radius: 6px;
  font: 600 14px/1 var(--cz-ui);
  color: var(--cz-muted);
}
.choice:hover:not(:disabled) {
  border-color: var(--cz-blue);
}
.choice:active:not(:disabled) {
  transform: translateY(2px);
  border-bottom-width: 2px;
}
.choice.picked {
  border-color: var(--cz-blue);
  background: var(--cz-blue-soft);
}
.choice.right {
  border-color: var(--cz-green);
  background: var(--cz-green-soft);
}
.choice.wrong {
  border-color: var(--cz-red);
  background: var(--cz-red-soft);
}
.choice:disabled {
  cursor: default;
}

.built {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 74px;
  padding: 12px 6px 14px;
  border-bottom: 3px dashed var(--cz-line);
  align-content: flex-start;
}
.built.empty {
  align-items: center;
}
.ph {
  padding-left: 8px;
  color: var(--cz-muted);
  font: 500 18px/1 var(--cz-ui);
}
.bank {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 20px;
}
.tile {
  padding: 9px 16px;
  border: 2px solid var(--cz-line);
  border-bottom-width: 4px;
  border-radius: 10px;
  background: var(--cz-card);
  color: var(--cz-ink);
  font: 500 22px/1.2 var(--cz-ui);
  cursor: pointer;
  transition: transform 0.08s, border-color 0.12s;
}
.tile:hover:not(:disabled) {
  border-color: var(--cz-blue);
}
.tile:active:not(:disabled) {
  transform: translateY(2px);
  border-bottom-width: 2px;
}
.tile.on {
  border-color: var(--cz-blue);
  background: var(--cz-blue-soft);
}
.tile.used {
  visibility: hidden;
}
.tile:disabled {
  cursor: default;
}

/* bottom bar */
.bar {
  border-top: 2px solid var(--cz-line);
  background: var(--cz-card);
  transition: background 0.2s, border-color 0.2s;
}
.bar.correct {
  background: var(--cz-green-soft);
  border-color: var(--cz-green);
}
.bar.almost {
  background: var(--cz-yellow-soft);
  border-color: var(--cz-yellow);
}
.bar.wrong {
  background: var(--cz-red-soft);
  border-color: var(--cz-red);
}
.bar-inner {
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: 760px;
  margin: 0 auto;
  padding: 16px 20px calc(16px + env(safe-area-inset-bottom));
}
.tip {
  flex: 1;
  text-align: center;
  color: var(--cz-muted);
  font: 500 15px/1 var(--cz-ui);
}
.sheet {
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  animation: rise 0.2s ease-out;
}
.verdict {
  flex: 1 1 260px;
  min-width: 0;
}
.verdict p {
  margin: 0;
}
.head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
  font: 700 26px/1.2 var(--cz-ui);
}
.bar.correct .head strong {
  color: var(--cz-green);
}
.bar.almost .head strong {
  color: var(--cz-ink);
}
.bar.wrong .head strong {
  color: var(--cz-red);
}
.gloss {
  font: 500 17px/1.2 var(--cz-ui);
  color: var(--cz-muted);
}
.gain {
  margin-left: auto;
  padding: 1px 9px;
  border-radius: 6px;
  background: var(--cz-yellow);
  color: #10213f;
  font: 700 15px/1.5 var(--cz-ui);
}
.detail {
  margin-top: 6px !important;
  font: 500 21px/1.35 var(--cz-ui);
  overflow-wrap: anywhere;
}
.note {
  margin-top: 4px !important;
  font: 500 16px/1.35 var(--cz-ui);
  color: var(--cz-muted);
}
.acts {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

/* buttons */
.primary,
.secondary,
.ghost {
  min-height: 46px;
  padding: 0 22px;
  border-radius: 12px;
  border: 2px solid transparent;
  font: 700 18px/1 var(--cz-ui);
  cursor: pointer;
  transition: transform 0.08s, filter 0.12s;
}
.primary {
  background: var(--cz-primary);
  color: #fff;
  border-bottom: 4px solid var(--cz-primary-edge);
}
.primary:hover:not(:disabled) {
  filter: brightness(1.08);
}
.primary:active:not(:disabled) {
  transform: translateY(2px);
  border-bottom-width: 2px;
}
.primary:disabled {
  background: var(--cz-line);
  border-color: var(--cz-line);
  color: var(--cz-muted);
  cursor: not-allowed;
}
.secondary {
  background: transparent;
  border-color: var(--cz-primary);
  color: var(--cz-blue);
}
.ghost {
  background: transparent;
  color: var(--cz-muted);
  border-color: var(--cz-line);
}
.ghost:hover:not(:disabled) {
  color: var(--cz-ink);
  border-color: var(--cz-muted);
}
.ghost:disabled {
  opacity: 0.5;
  cursor: default;
}
.link {
  border: 0;
  background: none;
  padding: 0;
  color: var(--cz-blue);
  font: 600 16px/1.2 var(--cz-ui);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

/* summary */
.summary {
  flex: 1;
  overflow-y: auto;
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  padding: 28px 20px 32px;
  text-align: center;
  animation: rise 0.3s ease-out;
}
.summary h2 {
  margin: 0;
  border: 0;
  padding: 0;
  font: 700 44px/1.1 var(--cz-ui);
  color: var(--cz-ink);
}
.summary h2 .gloss {
  display: block;
  margin-top: 4px;
}
.stars {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin: 22px 0 18px;
}
.stars svg {
  fill: var(--cz-line);
}
.stars svg.on {
  fill: var(--cz-yellow);
  stroke: #c98f00;
  stroke-width: 0.8;
  animation: star 0.5s cubic-bezier(0.3, 1.8, 0.5, 1) both;
  animation-delay: calc(var(--i) * 0.18s);
}
.tally {
  display: flex;
  justify-content: center;
  gap: 28px;
  flex-wrap: wrap;
  margin: 0 0 24px;
}
.tally div {
  min-width: 100px;
}
.tally dt {
  color: var(--cz-muted);
  font: 500 15px/1.3 var(--cz-ui);
}
.tally dd {
  margin: 2px 0 0;
  font: 700 28px/1.2 var(--cz-ui);
}
.missed {
  margin: 0 0 24px;
  text-align: left;
}
.missed h3 {
  margin: 0 0 8px;
  font: 700 20px/1.2 var(--cz-ui);
}
.missed ul {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1.5px solid var(--cz-line);
}
.missed li {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 4px 14px;
  align-items: baseline;
  padding: 10px 2px;
  border-bottom: 1.5px solid var(--cz-line);
}
.mq {
  color: var(--cz-muted);
  font: 500 17px/1.3 var(--cz-ui);
}
.ma {
  font: 600 19px/1.3 var(--cz-ui);
}
.perfect {
  margin: 0 0 24px;
  font: 500 20px/1.4 var(--cz-ui);
  color: var(--cz-muted);
}
.summary .acts {
  justify-content: center;
}

/* leave dialog */
.leave {
  position: fixed;
  inset: 0;
  z-index: 5;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(10, 22, 44, 0.55);
}
.leave-box {
  width: min(380px, 100%);
  padding: 24px;
  border-radius: 16px;
  background: var(--cz-card);
  box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.5);
}
.leave-box h3 {
  margin: 0 0 6px;
  font: 700 24px/1.2 var(--cz-ui);
}
.leave-box p {
  margin: 0 0 18px;
  color: var(--cz-muted);
  font: 500 18px/1.4 var(--cz-ui);
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}
@keyframes shake {
  20%, 60% { transform: translateX(-7px); }
  40%, 80% { transform: translateX(7px); }
}
@keyframes pop {
  50% { transform: scale(1.018); }
}
@keyframes bump {
  from { transform: scale(0.8); }
}
@keyframes star {
  from { transform: scale(0) rotate(-40deg); }
}

@media (max-width: 560px) {
  .choices {
    grid-template-columns: 1fr;
  }
  .missed li {
    grid-template-columns: 1fr auto;
  }
  .mq {
    grid-column: 1 / -1;
  }
  .tip {
    display: none;
  }
  .bar-inner {
    justify-content: space-between;
  }
}
@media (prefers-reduced-motion: reduce) {
  .stage,
  .sheet,
  .summary,
  .prompt.shake,
  .prompt.hit,
  .chip.streak,
  .stars svg.on {
    animation: none;
  }
}
</style>
