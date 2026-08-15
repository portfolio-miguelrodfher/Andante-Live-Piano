export type HandMode = 'right' | 'left' | 'both'

export interface ExpectedNote {
  midiNumber: number
  pitchName: string
  octave: number
  tiedFromPrevious?: boolean
  tiedToNext?: boolean
}

export interface PracticeEvent {
  id: string
  measureNumber: number
  onset: number
  staffEvents: {
    rightHand: ExpectedNote[]
    leftHand: ExpectedNote[]
  }
  allExpectedNotes: ExpectedNote[]
  duration?: number
  durationBeats?: number
  isRest?: boolean
}

export interface NoteInputEvent {
  type: 'noteon' | 'noteoff'
  midi: number
  velocity: number
  timestamp: number
  source: 'midi' | 'screen-piano' | 'computer-keyboard' | 'demo'
}

export type PracticeEngineStatus = 'idle' | 'waiting' | 'completed'

export interface PracticeSnapshot {
  status: PracticeEngineStatus
  activeIndex: number
  activeEvent?: PracticeEvent
  satisfiedNotes: number[]
  expectedNotes: number[]
  unexpectedNote?: number
}
