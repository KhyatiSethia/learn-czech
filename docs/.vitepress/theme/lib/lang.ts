import type { Lang } from './types'

export type { Lang }

/**
 * A small, honest guess at whether a piece of text is Czech or English. It is used to choose a voice
 * for text that does not say which language it is in. It looks at letters only Czech uses, then at
 * very common words. When there is no evidence either way it returns the fallback.
 */

const CZECH_LETTERS = /[ěščřžýáíéúůďťňĚŠČŘŽÝÁÍÉÚŮĎŤŇ]/u

const CZECH_WORDS = new Set(
  (
    'a ale ano ne není jsem jsi je jsme jste jsou být byl byla bylo budu bude se si na v ve do z ze s se k ke o u po pro od' +
    ' to ten ta tady tam už jen také taky jak kde kdy proč co kdo který která které můj tvůj náš váš' +
    ' já ty on ona ono my vy oni mám máš má máme máte mají chci chceš chce můžu můžeš může musím musíš musí' +
    ' jdu jdeš jde jdeme jdete jdou jedu jedeš jede jedeme jedete jedou chodím chodíš chodí jezdím jezdíš jezdí' +
    ' prosím děkuji děkuju ahoj nashledanou dobrý dobrou den noc ráno večer dnes zítra včera' +
    ' dva dvě tři čtyři pět šest sedm osm devět deset jeden jedna jedno velmi moc málo hodně' +
    ' nebo protože když pokud že aby ani také ještě tedy tak ten ta to'
  )
    .split(/\s+/)
    .filter(Boolean),
)

const ENGLISH_WORDS = new Set(
  (
    'the a an and or but of to in on at for with from by as is are was were be been am i you he she it we they me him her us them' +
    ' my your his its our their this that these those there here what where when why how who which do does did not no yes' +
    ' have has had will would can could should must may might please thank thanks hello goodbye good morning night' +
    ' one two three four five six seven eight nine ten very much many some any all if then than so because about into over'
  )
    .split(/\s+/)
    .filter(Boolean),
)

const wordsIn = (s: string) => s.toLowerCase().match(/[\p{L}]+/gu) ?? []

export function detectLang(text: string, fallback: Lang = 'en'): Lang {
  if (!text.trim()) return fallback
  if (CZECH_LETTERS.test(text)) return 'cs'
  let cs = 0
  let en = 0
  for (const w of wordsIn(text)) {
    // Words that both languages share ("a", "to", "on", "my") say nothing either way.
    const inCs = CZECH_WORDS.has(w)
    const inEn = ENGLISH_WORDS.has(w)
    if (inCs && !inEn) cs += 1
    else if (inEn && !inCs) en += 1
  }
  if (cs > en) return 'cs'
  if (en > cs) return 'en'
  return fallback
}

export const LANG_NAME: Record<Lang, string> = { cs: 'Czech', en: 'English' }
export const LANG_TAG: Record<Lang, string> = { cs: 'cs-CZ', en: 'en-GB' }
