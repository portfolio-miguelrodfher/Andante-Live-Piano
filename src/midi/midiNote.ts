import type { NormalizedMidiNote } from './MidiTypes'

const PITCH_CLASSES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const

export function midiNoteToPitch(noteNumber: number): Pick<NormalizedMidiNote, 'pitchName' | 'octave'> {
  const pitchName = PITCH_CLASSES[((noteNumber % 12) + 12) % 12]
  const octave = Math.floor(noteNumber / 12) - 1
  return { pitchName, octave }
}

export function createMidiNote(
  noteNumber: number,
  velocity: number,
  timestamp: number,
  source: NormalizedMidiNote['source'],
): NormalizedMidiNote {
  return {
    noteNumber,
    velocity,
    timestamp,
    source,
    ...midiNoteToPitch(noteNumber),
  }
}

export function parseMidiMessage(data: Uint8Array, timestamp: number): NormalizedMidiNote | null {
  const [status = 0, noteNumber = 0, velocity = 0] = data
  const command = status & 0xf0

  if (command === 0x90 && velocity > 0) {
    return createMidiNote(noteNumber, velocity, timestamp, 'midi')
  }

  return null
}

export function isMidiNoteOff(data: Uint8Array): boolean {
  const [status = 0, , velocity = 0] = data
  const command = status & 0xf0
  return command === 0x80 || (command === 0x90 && velocity === 0)
}
