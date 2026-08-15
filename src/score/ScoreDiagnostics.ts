import type { PracticeEvent } from '../practice/PracticeTypes'

export interface ScoreDiagnostics {
  sourceMeasureCount: number
  practiceEventCount: number
  firstMeasureNumber: number
  lastMeasureNumber: number
  tempoBpm: number
}

export function parseScoreDiagnostics(musicXml: string, practiceEvents: PracticeEvent[]): ScoreDiagnostics {
  const document = new DOMParser().parseFromString(musicXml, 'application/xml')
  const measures = [...document.querySelectorAll('score-partwise > part:first-of-type > measure')]
  const measureNumbers = measures.map((measure, index) => Number(measure.getAttribute('number')) || index + 1)

  return {
    sourceMeasureCount: measures.length,
    practiceEventCount: practiceEvents.length,
    firstMeasureNumber: measureNumbers[0] ?? 1,
    lastMeasureNumber: measureNumbers.at(-1) ?? 1,
    tempoBpm: parseTempoBpm(document) ?? 100,
  }
}

function parseTempoBpm(document: Document): number | undefined {
  const soundTempo = Number(document.querySelector('sound[tempo]')?.getAttribute('tempo'))
  if (Number.isFinite(soundTempo) && soundTempo > 0) return soundTempo

  const metronomeTempo = Number(document.querySelector('metronome per-minute')?.textContent)
  if (Number.isFinite(metronomeTempo) && metronomeTempo > 0) return metronomeTempo

  return undefined
}
