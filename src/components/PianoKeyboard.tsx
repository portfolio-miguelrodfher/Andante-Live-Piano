import { createMidiNote, midiNoteToPitch } from '../midi/midiNote'
import type { NormalizedMidiNote } from '../midi/MidiTypes'
import type { NoteInputEvent } from '../practice/PracticeTypes'

interface PianoKeyboardProps {
  expectedNotes: number[]
  pressedNotes: number[]
  playbackNotes: number[]
  satisfiedNotes: number[]
  onNoteInput: (input: NoteInputEvent) => void
}

interface PianoKey {
  midiNumber: number
  label: string
  octave: number
  isBlack: boolean
}

const FIRST_KEY = 21
const LAST_KEY = 108
const BLACK_PITCHES = new Set(['C#', 'Eb', 'F#', 'Ab', 'Bb'])

const KEYS: PianoKey[] = Array.from({ length: LAST_KEY - FIRST_KEY + 1 }, (_, index) => {
  const midiNumber = FIRST_KEY + index
  const { pitchName, octave } = midiNoteToPitch(midiNumber)
  return {
    midiNumber,
    label: `${pitchName}${octave}`,
    octave,
    isBlack: BLACK_PITCHES.has(pitchName),
  }
})

const WHITE_KEYS = KEYS.filter((key) => !key.isBlack)

export function PianoKeyboard({ expectedNotes, pressedNotes, playbackNotes, satisfiedNotes, onNoteInput }: PianoKeyboardProps) {
  const whiteKeyIndex = new Map<number, number>()
  WHITE_KEYS.forEach((key, index) => whiteKeyIndex.set(key.midiNumber, index))

  return (
    <div className="keyboard-shell" aria-label="88-key piano keyboard">
      <div className="keyboard">
        <div className="white-keys">
          {WHITE_KEYS.map((key) => (
            <button
              className={keyClass(key, expectedNotes, pressedNotes, playbackNotes, satisfiedNotes)}
              data-midi={key.midiNumber}
              key={key.midiNumber}
              onPointerDown={() => onNoteInput(toInputEvent(key.midiNumber, 'noteon'))}
              onPointerLeave={(event) => {
                if (event.buttons > 0) onNoteInput(toInputEvent(key.midiNumber, 'noteoff'))
              }}
              onPointerUp={() => onNoteInput(toInputEvent(key.midiNumber, 'noteoff'))}
              type="button"
              aria-label={`Play ${key.label}`}
            >
              <span className="key-state-layer" aria-hidden="true" />
              {key.label.startsWith('C') || key.label.startsWith('F') ? <span className="key-label">{key.label}</span> : null}
            </button>
          ))}
        </div>
        <div className="black-keys" aria-hidden="true">
          {KEYS.filter((key) => key.isBlack).map((key) => {
            const previousWhite = findPreviousWhiteKey(key.midiNumber)
            const index = whiteKeyIndex.get(previousWhite) ?? 0
            return (
              <button
                className={keyClass(key, expectedNotes, pressedNotes, playbackNotes, satisfiedNotes)}
                data-midi={key.midiNumber}
                key={key.midiNumber}
                style={{ left: `calc((100% / ${WHITE_KEYS.length}) * ${index + 0.68})` }}
                onPointerDown={() => onNoteInput(toInputEvent(key.midiNumber, 'noteon'))}
                onPointerLeave={(event) => {
                  if (event.buttons > 0) onNoteInput(toInputEvent(key.midiNumber, 'noteoff'))
                }}
                onPointerUp={() => onNoteInput(toInputEvent(key.midiNumber, 'noteoff'))}
                type="button"
                tabIndex={-1}
              >
                <span className="key-state-layer" aria-hidden="true" />
                <span className="key-label">{key.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function keyClass(
  key: PianoKey,
  expectedNotes: number[],
  pressedNotes: number[],
  playbackNotes: number[],
  satisfiedNotes: number[],
): string {
  return [
    'piano-key',
    key.isBlack ? 'black-key' : 'white-key',
    expectedNotes.includes(key.midiNumber) ? 'is-expected' : '',
    playbackNotes.includes(key.midiNumber) ? 'is-playback' : '',
    pressedNotes.includes(key.midiNumber) ? 'is-pressed' : '',
    satisfiedNotes.includes(key.midiNumber) ? 'is-satisfied' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function toInputEvent(midi: number, type: NoteInputEvent['type']): NoteInputEvent {
  const normalized: NormalizedMidiNote = createMidiNote(midi, type === 'noteon' ? 90 : 0, performance.now(), 'simulated')
  return {
    type,
    midi: normalized.noteNumber,
    velocity: normalized.velocity,
    timestamp: normalized.timestamp,
    source: 'screen-piano',
  }
}

function findPreviousWhiteKey(midiNumber: number): number {
  for (let note = midiNumber - 1; note >= FIRST_KEY; note -= 1) {
    if (!BLACK_PITCHES.has(midiNoteToPitch(note).pitchName)) return note
  }

  return FIRST_KEY
}
