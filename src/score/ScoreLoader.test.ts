import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PracticeEngine } from '../practice/PracticeEngine'
import { parseHarmonyEvents } from '../harmony/HarmonyContext'
import { parseKeySignatureEvents, tonalContextForMeasure } from '../harmony/KeySignatureParser'
import { parseMusicXmlPracticeEvents } from './MusicXmlPracticeParser'
import { parseScoreDiagnostics } from './ScoreDiagnostics'
import { extractMusicXmlFromMxl } from './ScoreLoader'

const fixturePath = resolve(process.cwd(), 'public/scores/single-heartbeat/score.mxl')

describe('Single Heartbeat fixture', () => {
  it('parses the full 138-measure score and can navigate to the end', async () => {
    const musicXml = await extractMusicXmlFromMxl(await readFile(fixturePath))
    const practiceEvents = parseMusicXmlPracticeEvents(musicXml)
    const diagnostics = parseScoreDiagnostics(musicXml, practiceEvents)

    expect(diagnostics.sourceMeasureCount).toBe(138)
    expect(diagnostics.lastMeasureNumber).toBe(138)
    expect(diagnostics.practiceEventCount).toBeGreaterThan(100)
    expect(diagnostics.tempoBpm).toBe(147)

    const engine = new PracticeEngine(practiceEvents)
    let currentMeasure = 0
    engine.subscribe((snapshot) => {
      currentMeasure = snapshot.activeEvent?.measureNumber ?? 0
    })
    engine.start()

    for (const measure of [25, 50, 75, 100, 137, 138]) {
      engine.jumpToMeasure(measure)
      expect(currentMeasure).toBeGreaterThanOrEqual(measure)
      expect(currentMeasure).toBeLessThanOrEqual(138)
    }
  })

  it('derives tonal and harmony context from MusicXML data', async () => {
    const musicXml = await extractMusicXmlFromMxl(await readFile(fixturePath))
    const keySignatureEvents = parseKeySignatureEvents(musicXml)
    const harmonyEvents = parseHarmonyEvents(musicXml)
    const firstContext = tonalContextForMeasure(keySignatureEvents, 1)

    expect(firstContext.fifths).toBe(-1)
    expect(firstContext.certainty).toBe('ambiguous')
    expect(harmonyEvents).toEqual([])
  })
})
