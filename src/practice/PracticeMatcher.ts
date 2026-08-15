import type { HandMode, PracticeEvent } from './PracticeTypes'

export function expectedNotesForMode(event: PracticeEvent, handMode: HandMode): number[] {
  const notes =
    handMode === 'right'
      ? event.staffEvents.rightHand
      : handMode === 'left'
        ? event.staffEvents.leftHand
        : event.allExpectedNotes

  return [...new Set(notes.filter((note) => !note.tiedFromPrevious).map((note) => note.midiNumber))]
}

export function isPlayableEvent(event: PracticeEvent, handMode: HandMode): boolean {
  return !event.isRest && expectedNotesForMode(event, handMode).length > 0
}
