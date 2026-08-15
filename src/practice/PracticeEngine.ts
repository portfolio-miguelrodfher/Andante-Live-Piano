import type { NormalizedMidiNote } from '../midi/MidiTypes'
import { expectedNotesForMode, isPlayableEvent } from './PracticeMatcher'
import type { HandMode, NoteInputEvent, PracticeEvent, PracticeSnapshot } from './PracticeTypes'

type SnapshotHandler = (snapshot: PracticeSnapshot) => void

export class PracticeEngine {
  private events: PracticeEvent[]
  private handMode: HandMode
  private activeIndex = 0
  private status: PracticeSnapshot['status'] = 'idle'
  private satisfiedNotes = new Set<number>()
  private handlers = new Set<SnapshotHandler>()
  private unexpectedNote?: number

  constructor(events: PracticeEvent[], handMode: HandMode = 'both') {
    this.events = events
    this.handMode = handMode
    this.activeIndex = this.findNextPlayableIndex(0)
  }

  subscribe(handler: SnapshotHandler): () => void {
    this.handlers.add(handler)
    handler(this.snapshot())
    return () => this.handlers.delete(handler)
  }

  start(): void {
    this.status = this.events.length > 0 ? 'waiting' : 'completed'
    this.activeIndex = this.findNextPlayableIndex(this.activeIndex)
    this.satisfiedNotes.clear()
    this.unexpectedNote = undefined
    this.emit()
  }

  setHandMode(handMode: HandMode): void {
    this.handMode = handMode
    this.satisfiedNotes.clear()
    this.unexpectedNote = undefined
    this.activeIndex = this.findNextPlayableIndex(this.activeIndex)
    this.emit()
  }

  restart(): void {
    this.activeIndex = this.findNextPlayableIndex(0)
    this.satisfiedNotes.clear()
    this.unexpectedNote = undefined
    this.status = this.events.length > 0 ? 'waiting' : 'completed'
    this.emit()
  }

  previous(): void {
    const previous = this.findPreviousPlayableIndex(this.activeIndex - 1)
    this.activeIndex = previous
    this.satisfiedNotes.clear()
    this.unexpectedNote = undefined
    this.status = 'waiting'
    this.emit()
  }

  next(): void {
    this.advance()
  }

  jumpToMeasure(measureNumber: number): void {
    const index = this.events.findIndex((event) => event.measureNumber >= measureNumber && isPlayableEvent(event, this.handMode))
    this.activeIndex = index >= 0 ? index : this.findPreviousPlayableIndex(this.events.length - 1)
    this.satisfiedNotes.clear()
    this.unexpectedNote = undefined
    this.status = this.events.length > 0 ? 'waiting' : 'completed'
    this.emit()
  }

  jumpToEventIndex(eventIndex: number): void {
    const clampedIndex = Math.min(Math.max(0, eventIndex), Math.max(0, this.events.length - 1))
    this.activeIndex = isPlayableEvent(this.events[clampedIndex], this.handMode)
      ? clampedIndex
      : this.findNextPlayableIndex(clampedIndex)
    this.satisfiedNotes.clear()
    this.unexpectedNote = undefined
    this.status = this.events.length > 0 ? 'waiting' : 'completed'
    this.emit()
  }

  previousMeasure(): void {
    const currentMeasure = this.events[this.activeIndex]?.measureNumber ?? 1
    this.jumpToMeasure(Math.max(1, currentMeasure - 1))
  }

  nextMeasure(): void {
    const currentMeasure = this.events[this.activeIndex]?.measureNumber ?? 1
    const laterEvent = this.events.find((event) => event.measureNumber > currentMeasure && isPlayableEvent(event, this.handMode))
    if (laterEvent) {
      this.jumpToMeasure(laterEvent.measureNumber)
    }
  }

  receiveNote(note: NormalizedMidiNote): void {
    this.receiveInput({
      type: 'noteon',
      midi: note.noteNumber,
      velocity: note.velocity,
      timestamp: note.timestamp,
      source: note.source === 'midi' ? 'midi' : 'screen-piano',
    })
  }

  receiveInput(input: NoteInputEvent): void {
    if (input.type !== 'noteon') return
    if (this.status !== 'waiting') return

    const activeEvent = this.events[this.activeIndex]
    if (!activeEvent) return

    const expected = expectedNotesForMode(activeEvent, this.handMode)
    if (expected.includes(input.midi)) {
      this.satisfiedNotes.add(input.midi)
      this.unexpectedNote = undefined
    } else {
      this.unexpectedNote = input.midi
    }

    if (expected.every((noteNumber) => this.satisfiedNotes.has(noteNumber))) {
      this.advance()
      return
    }

    this.emit()
  }

  private advance(): void {
    const nextIndex = this.findNextPlayableIndex(this.activeIndex + 1)
    this.satisfiedNotes.clear()
    this.unexpectedNote = undefined

    if (nextIndex >= this.events.length) {
      this.status = 'completed'
      this.activeIndex = this.events.length - 1
    } else {
      this.status = 'waiting'
      this.activeIndex = nextIndex
    }

    this.emit()
  }

  private findNextPlayableIndex(startIndex: number): number {
    for (let index = Math.max(0, startIndex); index < this.events.length; index += 1) {
      if (isPlayableEvent(this.events[index], this.handMode)) return index
    }

    return this.events.length
  }

  private findPreviousPlayableIndex(startIndex: number): number {
    for (let index = Math.min(startIndex, this.events.length - 1); index >= 0; index -= 1) {
      if (isPlayableEvent(this.events[index], this.handMode)) return index
    }

    return this.findNextPlayableIndex(0)
  }

  private snapshot(): PracticeSnapshot {
    const activeEvent = this.events[this.activeIndex]
    return {
      status: this.status,
      activeIndex: this.activeIndex,
      activeEvent,
      satisfiedNotes: [...this.satisfiedNotes],
      expectedNotes: activeEvent ? expectedNotesForMode(activeEvent, this.handMode) : [],
      unexpectedNote: this.unexpectedNote,
    }
  }

  private emit(): void {
    const snapshot = this.snapshot()
    this.handlers.forEach((handler) => handler(snapshot))
  }
}
