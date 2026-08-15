import * as Tone from 'tone'
import { PianoInstrument } from './PianoInstrument'
import type { PlaybackOptions, PlaybackSnapshot, PlaybackStatus } from './PlaybackTypes'
import type { PracticeEvent } from '../practice/PracticeTypes'

type PlaybackHandler = (snapshot: PlaybackSnapshot) => void

export class PlaybackEngine {
  private instrument: PianoInstrument
  private events: PracticeEvent[]
  private handlers = new Set<PlaybackHandler>()
  private scheduledIds: number[] = []
  private status: PlaybackStatus = 'stopped'
  private activeIndex?: number
  private soundingNotes: number[] = []
  private soundingNoteCounts = new Map<number, number>()
  private playRunId = 0

  constructor(events: PracticeEvent[], instrument = new PianoInstrument()) {
    this.events = events
    this.instrument = instrument
  }

  subscribe(handler: PlaybackHandler): () => void {
    this.handlers.add(handler)
    handler(this.snapshot())
    return () => this.handlers.delete(handler)
  }

  async playFrom(startIndex: number, options: PlaybackOptions): Promise<void> {
    await this.instrument.initialize()
    this.playRunId += 1
    const runId = this.playRunId
    this.clearSchedule()
    this.status = 'playing'
    this.activeIndex = startIndex
    this.soundingNoteCounts.clear()
    this.soundingNotes = []
    Tone.getTransport().stop()
    Tone.getTransport().cancel()

    let offsetSeconds = 0
    const secondsPerBeat = 60 / (options.tempoBpm * options.speed)
    Tone.getTransport().bpm.value = options.tempoBpm * options.speed

    this.events.slice(startIndex).forEach((event, relativeIndex) => {
      const eventIndex = startIndex + relativeIndex
      const durationSeconds = Math.max(0.12, (event.durationBeats ?? 1) * secondsPerBeat)
      const id = Tone.getTransport().schedule((time) => {
        const eventNotes = event.allExpectedNotes.map((note) => note.midiNumber)
        this.instrument.trigger(eventNotes, durationSeconds, time)
        Tone.Draw.schedule(() => {
          if (this.playRunId !== runId || this.status !== 'playing') return
          this.activeIndex = eventIndex
          this.addSoundingNotes(eventNotes)
          this.emit()
        }, time)
        Tone.Draw.schedule(() => {
          if (this.playRunId !== runId) return
          this.removeSoundingNotes(eventNotes)
          this.emit()
        }, time + durationSeconds)
      }, offsetSeconds)
      this.scheduledIds.push(id)
      offsetSeconds += durationSeconds
    })

    const stopId = Tone.getTransport().schedule((time) => {
      Tone.Draw.schedule(() => {
        if (this.playRunId === runId) this.stop()
      }, time)
    }, offsetSeconds + 0.1)
    this.scheduledIds.push(stopId)
    Tone.getTransport().start()
    this.emit()
  }

  pause(): void {
    if (this.status !== 'playing') return
    Tone.getTransport().pause()
    this.status = 'paused'
    this.instrument.releaseAll()
    this.soundingNoteCounts.clear()
    this.soundingNotes = []
    this.emit()
  }

  resume(): void {
    if (this.status !== 'paused') return
    this.status = 'playing'
    Tone.getTransport().start()
    this.emit()
  }

  seekToEvent(eventIndex: number, options: PlaybackOptions, shouldPlay: boolean): void {
    const clampedIndex = Math.min(Math.max(0, eventIndex), Math.max(0, this.events.length - 1))
    const nextStatus: PlaybackStatus = shouldPlay ? 'playing' : this.status === 'paused' ? 'paused' : 'stopped'
    Tone.getTransport().stop()
    this.playRunId += 1
    this.clearSchedule()
    this.instrument.releaseAll()
    this.soundingNoteCounts.clear()
    this.soundingNotes = []
    this.activeIndex = clampedIndex
    this.status = nextStatus
    this.emit()

    if (shouldPlay) {
      void this.playFrom(clampedIndex, options)
    }
  }

  pauseForSeek(): void {
    if (this.status !== 'playing') return
    Tone.getTransport().pause()
    this.status = 'paused'
    this.instrument.releaseAll()
    this.soundingNoteCounts.clear()
    this.soundingNotes = []
    this.emit()
  }

  stop(): void {
    Tone.getTransport().stop()
    this.playRunId += 1
    this.clearSchedule()
    this.status = 'stopped'
    this.activeIndex = undefined
    this.instrument.releaseAll()
    this.soundingNoteCounts.clear()
    this.soundingNotes = []
    this.emit()
  }

  private addSoundingNotes(notes: number[]): void {
    notes.forEach((note) => {
      this.soundingNoteCounts.set(note, (this.soundingNoteCounts.get(note) ?? 0) + 1)
    })
    this.syncSoundingNotes()
  }

  private removeSoundingNotes(notes: number[]): void {
    notes.forEach((note) => {
      const nextCount = (this.soundingNoteCounts.get(note) ?? 0) - 1
      if (nextCount > 0) {
        this.soundingNoteCounts.set(note, nextCount)
      } else {
        this.soundingNoteCounts.delete(note)
      }
    })
    this.syncSoundingNotes()
  }

  private syncSoundingNotes(): void {
    this.soundingNotes = [...this.soundingNoteCounts.keys()]
  }

  private clearSchedule(): void {
    const transport = Tone.getTransport()
    this.scheduledIds.forEach((id) => transport.clear(id))
    this.scheduledIds = []
  }

  private snapshot(): PlaybackSnapshot {
    return {
      status: this.status,
      activeIndex: this.activeIndex,
      activeEvent: this.activeIndex == null ? undefined : this.events[this.activeIndex],
      soundingNotes: this.soundingNotes,
    }
  }

  private emit(): void {
    const snapshot = this.snapshot()
    this.handlers.forEach((handler) => handler(snapshot))
  }
}
