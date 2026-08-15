import { midiNoteToPitch } from '../midi/midiNote'
import type { ExpectedNote, PracticeEvent } from '../practice/PracticeTypes'

const STEP_TO_SEMITONE: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

interface PendingEvent {
  id: string
  measureNumber: number
  onset: number
  duration: number
  durationBeats: number
  staffEvents: PracticeEvent['staffEvents']
  isRest: boolean
}

export function parseMusicXmlPracticeEvents(musicXml: string): PracticeEvent[] {
  const document = new DOMParser().parseFromString(musicXml, 'application/xml')
  const parserError = document.querySelector('parsererror')

  if (parserError) {
    throw new Error('The selected file is not valid MusicXML.')
  }

  const eventsByPosition = new Map<string, PendingEvent>()
  const parts = [...document.querySelectorAll('score-partwise > part')]

  parts.forEach((part, partIndex) => {
    let onset = 0
    let currentDivisions = 1

    ;[...part.querySelectorAll(':scope > measure')].forEach((measure, measureIndex) => {
      const divisions = Number(measure.querySelector(':scope > attributes > divisions')?.textContent)
      if (Number.isFinite(divisions) && divisions > 0) {
        currentDivisions = divisions
      }

      let cursor = onset
      let maxCursor = onset
      let lastNoteOnset = onset
      const measureNumber = Number(measure.getAttribute('number')) || measureIndex + 1

      ;[...measure.children].forEach((child) => {
        if (child.tagName === 'backup') {
          cursor -= Number(child.querySelector(':scope > duration')?.textContent ?? '0')
          return
        }

        if (child.tagName === 'forward') {
          cursor += Number(child.querySelector(':scope > duration')?.textContent ?? '0')
          maxCursor = Math.max(maxCursor, cursor)
          return
        }

        if (child.tagName !== 'note') return

        const noteElement = child
        const duration = Number(noteElement.querySelector(':scope > duration')?.textContent ?? '1')
        const isChordTone = noteElement.querySelector(':scope > chord') !== null
        const isRest = noteElement.querySelector(':scope > rest') !== null
        const staff = noteElement.querySelector(':scope > staff')?.textContent === '2' ? 'leftHand' : 'rightHand'
        const eventOnset = isChordTone ? lastNoteOnset : cursor
        const key = `${partIndex}-${measureNumber}-${eventOnset}`
        const event =
          eventsByPosition.get(key) ??
          ({
            id: `m${measureNumber}-o${eventOnset}-p${partIndex}`,
            measureNumber,
            onset: eventOnset,
            duration,
            durationBeats: duration / currentDivisions,
            staffEvents: { rightHand: [], leftHand: [] },
            isRest: true,
          } satisfies PendingEvent)

        if (!isRest) {
          const expected = parseExpectedNote(noteElement)
          if (expected) {
            event.staffEvents[staff].push(expected)
            event.isRest = false
          }
        }

        event.duration = Math.max(event.duration, duration)
        event.durationBeats = Math.max(event.durationBeats, duration / currentDivisions)
        eventsByPosition.set(key, event)

        if (!isChordTone) {
          lastNoteOnset = cursor
          cursor += duration
          maxCursor = Math.max(maxCursor, cursor)
        }
      })

      onset = maxCursor
    })
  })

  return [...eventsByPosition.values()]
    .sort((a, b) => a.measureNumber - b.measureNumber || a.onset - b.onset)
    .map((event) => ({
      id: event.id,
      measureNumber: event.measureNumber,
      onset: event.onset,
      staffEvents: event.staffEvents,
      allExpectedNotes: [...event.staffEvents.rightHand, ...event.staffEvents.leftHand],
      duration: event.duration,
      durationBeats: event.durationBeats,
      isRest: event.isRest,
    }))
}

function parseExpectedNote(noteElement: Element): ExpectedNote | null {
  const pitch = noteElement.querySelector(':scope > pitch')
  if (!pitch) return null

  const step = pitch.querySelector(':scope > step')?.textContent
  const octave = Number(pitch.querySelector(':scope > octave')?.textContent)
  const alter = Number(pitch.querySelector(':scope > alter')?.textContent ?? '0')

  if (!step || !Number.isFinite(octave)) return null

  const midiNumber = (octave + 1) * 12 + STEP_TO_SEMITONE[step] + alter
  const tieNodes = [...noteElement.querySelectorAll(':scope > tie')]
  const { pitchName } = midiNoteToPitch(midiNumber)

  return {
    midiNumber,
    pitchName,
    octave,
    tiedFromPrevious: tieNodes.some((node) => node.getAttribute('type') === 'stop'),
    tiedToNext: tieNodes.some((node) => node.getAttribute('type') === 'start'),
  }
}
