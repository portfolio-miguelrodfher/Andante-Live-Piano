export type MidiConnectionState =
  | 'unsupported'
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'denied'
  | 'disconnected'
  | 'error'

export interface MidiInputInfo {
  id: string
  name: string
  manufacturer?: string
}

export interface NormalizedMidiNote {
  noteNumber: number
  pitchName: string
  octave: number
  velocity: number
  timestamp: number
  source: 'midi' | 'simulated'
}

export type MidiNoteHandler = (note: NormalizedMidiNote) => void

export interface MidiStatus {
  state: MidiConnectionState
  inputs: MidiInputInfo[]
  selectedInputId?: string
  message: string
}

export interface WebMidiAccess extends EventTarget {
  inputs: Map<string, WebMidiInput>
  onstatechange: ((event: WebMidiConnectionEvent) => void) | null
}

export interface WebMidiInput extends EventTarget {
  id: string
  name: string | null
  manufacturer: string | null
  onmidimessage: ((event: WebMidiMessageEvent) => void) | null
}

export interface WebMidiConnectionEvent extends Event {
  port?: {
    type?: string
    state?: string
  }
}

export interface WebMidiMessageEvent extends Event {
  data: Uint8Array
  receivedTime: number
}

export interface NavigatorWithMidi {
  requestMIDIAccess?: () => Promise<WebMidiAccess>
}
