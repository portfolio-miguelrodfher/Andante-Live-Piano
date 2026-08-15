import type { HarmonyEvent } from './harmonyTypes'

const ALTER_TO_TEXT: Record<number, string> = {
  [-2]: 'bb',
  [-1]: 'b',
  0: '',
  1: '#',
  2: '##',
}

const KIND_TO_TEXT: Record<string, string> = {
  major: '',
  minor: 'm',
  dominant: '7',
  diminished: 'dim',
  augmented: 'aug',
  'major-seventh': 'maj7',
  'minor-seventh': 'm7',
  'half-diminished': 'ø',
  'diminished-seventh': 'dim7',
}

export function parseHarmonyEvents(musicXml: string): HarmonyEvent[] {
  const document = new DOMParser().parseFromString(musicXml, 'application/xml')
  const events: HarmonyEvent[] = []

  document.querySelectorAll('score-partwise > part:first-of-type > measure').forEach((measure, index) => {
    const measureNumber = Number(measure.getAttribute('number')) || index + 1

    measure.querySelectorAll(':scope > harmony').forEach((harmony) => {
      const label = harmonyLabel(harmony)
      if (label) {
        events.push({ measureNumber, label })
      }
    })
  })

  return events
}

export function harmonyForMeasure(events: HarmonyEvent[], measureNumber: number): HarmonyEvent | undefined {
  return [...events]
    .sort((a, b) => a.measureNumber - b.measureNumber)
    .filter((event) => event.measureNumber <= measureNumber)
    .at(-1)
}

function harmonyLabel(harmony: Element): string | undefined {
  const rootStep = harmony.querySelector(':scope > root > root-step')?.textContent
  if (!rootStep) return undefined

  const rootAlter = Number(harmony.querySelector(':scope > root > root-alter')?.textContent ?? '0')
  const kindElement = harmony.querySelector(':scope > kind')
  const kindValue = kindElement?.getAttribute('text') || KIND_TO_TEXT[kindElement?.textContent?.trim() ?? ''] || ''
  const bassStep = harmony.querySelector(':scope > bass > bass-step')?.textContent
  const bassAlter = Number(harmony.querySelector(':scope > bass > bass-alter')?.textContent ?? '0')
  const root = `${rootStep}${ALTER_TO_TEXT[rootAlter] ?? ''}`
  const bass = bassStep ? `/${bassStep}${ALTER_TO_TEXT[bassAlter] ?? ''}` : ''

  return `${root}${kindValue}${bass}`
}
