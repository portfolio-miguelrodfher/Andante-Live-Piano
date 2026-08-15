import type { KeyMode, KeySignatureEvent, TonalContext } from './harmonyTypes'

export const FIFTHS_TO_KEYS: Record<number, Pick<TonalContext, 'majorKey' | 'relativeMinor'>> = {
  [-7]: { majorKey: 'Cb', relativeMinor: 'Abm' },
  [-6]: { majorKey: 'Gb', relativeMinor: 'Ebm' },
  [-5]: { majorKey: 'Db', relativeMinor: 'Bbm' },
  [-4]: { majorKey: 'Ab', relativeMinor: 'Fm' },
  [-3]: { majorKey: 'Eb', relativeMinor: 'Cm' },
  [-2]: { majorKey: 'Bb', relativeMinor: 'Gm' },
  [-1]: { majorKey: 'F', relativeMinor: 'Dm' },
  0: { majorKey: 'C', relativeMinor: 'Am' },
  1: { majorKey: 'G', relativeMinor: 'Em' },
  2: { majorKey: 'D', relativeMinor: 'Bm' },
  3: { majorKey: 'A', relativeMinor: 'F#m' },
  4: { majorKey: 'E', relativeMinor: 'C#m' },
  5: { majorKey: 'B', relativeMinor: 'G#m' },
  6: { majorKey: 'F#', relativeMinor: 'D#m' },
  7: { majorKey: 'C#', relativeMinor: 'A#m' },
}

export function parseKeySignatureEvents(musicXml: string): KeySignatureEvent[] {
  const document = new DOMParser().parseFromString(musicXml, 'application/xml')
  const events: KeySignatureEvent[] = []

  document.querySelectorAll('score-partwise > part:first-of-type > measure').forEach((measure, index) => {
    const key = measure.querySelector(':scope > attributes > key')
    const fifthsText = key?.querySelector(':scope > fifths')?.textContent
    if (!key || fifthsText == null) return

    const fifths = Number(fifthsText)
    if (!Number.isFinite(fifths) || !FIFTHS_TO_KEYS[fifths]) return

    const modeText = key.querySelector(':scope > mode')?.textContent?.trim().toLowerCase()
    const mode = modeText === 'major' || modeText === 'minor' ? (modeText as KeyMode) : undefined
    events.push({
      measureNumber: Number(measure.getAttribute('number')) || index + 1,
      fifths,
      mode,
    })
  })

  return events.length > 0 ? events : [{ measureNumber: 1, fifths: 0 }]
}

export function tonalContextForMeasure(events: KeySignatureEvent[], measureNumber: number): TonalContext {
  const event =
    [...events]
      .sort((a, b) => a.measureNumber - b.measureNumber)
      .filter((candidate) => candidate.measureNumber <= measureNumber)
      .at(-1) ?? events[0] ?? { measureNumber: 1, fifths: 0 }

  const keys = FIFTHS_TO_KEYS[event.fifths] ?? FIFTHS_TO_KEYS[0]
  return {
    fifths: event.fifths,
    mode: event.mode,
    majorKey: keys.majorKey,
    relativeMinor: keys.relativeMinor,
    activeKey: event.mode === 'major' ? keys.majorKey : event.mode === 'minor' ? keys.relativeMinor : undefined,
    sourceMeasure: event.measureNumber,
    certainty: event.mode ? 'explicit' : 'ambiguous',
  }
}
