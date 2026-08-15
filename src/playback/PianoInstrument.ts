import * as Tone from 'tone'
import { midiNoteToPitch } from '../midi/midiNote'
import type { PianoLoadStatus } from './PlaybackTypes'
import { PIANO_SAMPLE_LAYERS } from './PianoSampleMap'

export class PianoInstrument {
  private sampler?: Tone.Sampler
  private loadPromise?: Promise<void>
  private status: PianoLoadStatus = 'idle'
  private error?: string

  get loadStatus(): PianoLoadStatus {
    return this.status
  }

  get loadError(): string | undefined {
    return this.error
  }

  async load(): Promise<void> {
    if (this.status === 'ready') return
    if (this.loadPromise) return this.loadPromise

    this.status = 'loading'
    this.error = undefined
    const sampleLayer = PIANO_SAMPLE_LAYERS[0]

    this.loadPromise = new Promise<void>((resolve, reject) => {
      this.sampler = new Tone.Sampler({
        urls: sampleLayer.urls,
        baseUrl: `${import.meta.env.BASE_URL}audio/salamander/`,
        attack: 0,
        release: 1.15,
        onload: () => {
          this.status = 'ready'
          resolve()
        },
        onerror: (error) => {
          this.status = 'error'
          this.error = error instanceof Error ? error.message : 'The concert grand piano samples could not be loaded.'
          reject(new Error(this.error))
        },
      }).toDestination()
    })

    return this.loadPromise
  }

  async initialize(): Promise<void> {
    await this.load()
    await Tone.start()
  }

  trigger(notes: number[], durationSeconds: number, time?: number): void {
    if (!this.sampler || this.status !== 'ready' || notes.length === 0) return
    this.sampler.triggerAttackRelease(notes.map(midiToTonePitch), Math.max(0.08, durationSeconds), time)
  }

  releaseAll(): void {
    this.sampler?.releaseAll()
  }
}

function midiToTonePitch(midiNumber: number): string {
  const { pitchName, octave } = midiNoteToPitch(midiNumber)
  return `${pitchName}${octave}`
}
