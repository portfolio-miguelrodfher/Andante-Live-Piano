import type { PracticeEvent } from '../practice/PracticeTypes'

export type PlaybackStatus = 'stopped' | 'playing' | 'paused'
export type PianoLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface PlaybackSnapshot {
  status: PlaybackStatus
  activeIndex?: number
  activeEvent?: PracticeEvent
  soundingNotes: number[]
}

export interface PlaybackOptions {
  tempoBpm: number
  speed: number
}
