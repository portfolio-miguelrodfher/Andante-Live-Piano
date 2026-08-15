import type {
  MidiNoteHandler,
  MidiStatus,
  NavigatorWithMidi,
  WebMidiAccess,
  WebMidiInput,
} from './MidiTypes'
import { isMidiNoteOff, parseMidiMessage } from './midiNote'

type StatusHandler = (status: MidiStatus) => void

const IDLE_STATUS: MidiStatus = {
  state: 'idle',
  inputs: [],
  message: 'MIDI access has not been requested.',
}

export class MidiManager {
  private access?: WebMidiAccess
  private selectedInput?: WebMidiInput
  private heldNotes = new Set<number>()
  private noteHandlers = new Set<MidiNoteHandler>()
  private statusHandlers = new Set<StatusHandler>()
  private status: MidiStatus = IDLE_STATUS

  get heldNoteNumbers(): number[] {
    return [...this.heldNotes]
  }

  get currentStatus(): MidiStatus {
    return this.status
  }

  onNote(handler: MidiNoteHandler): () => void {
    this.noteHandlers.add(handler)
    return () => this.noteHandlers.delete(handler)
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler)
    handler(this.status)
    return () => this.statusHandlers.delete(handler)
  }

  async requestAccess(): Promise<void> {
    const nav = navigator as unknown as NavigatorWithMidi

    if (!nav.requestMIDIAccess) {
      this.setStatus({
        state: 'unsupported',
        inputs: [],
        message: 'This browser does not support Web MIDI.',
      })
      return
    }

    this.setStatus({ ...this.status, state: 'requesting', message: 'Waiting for MIDI permission.' })

    try {
      this.access = await nav.requestMIDIAccess()
      this.access.onstatechange = () => this.refreshInputs()
      this.refreshInputs()
      const rememberedInputId = localStorage.getItem('andante-midi-input')
      const firstInput = this.status.inputs.find((input) => input.id === rememberedInputId) ?? this.status.inputs[0]

      if (firstInput) {
        this.selectInput(firstInput.id)
      }
    } catch {
      this.setStatus({
        state: 'denied',
        inputs: [],
        message: 'MIDI permission was not granted.',
      })
    }
  }

  selectInput(inputId: string): void {
    if (!this.access) return

    const input = this.access.inputs.get(inputId)
    if (!input) {
      this.selectedInput = undefined
      this.setStatus({
        state: 'disconnected',
        inputs: this.listInputs(),
        message: 'The selected MIDI input is no longer available.',
      })
      return
    }

    if (this.selectedInput) {
      this.selectedInput.onmidimessage = null
    }

    this.selectedInput = input
    this.selectedInput.onmidimessage = (event) => {
      const noteOn = parseMidiMessage(event.data, event.receivedTime)
      if (noteOn) {
        this.heldNotes.add(noteOn.noteNumber)
        this.noteHandlers.forEach((handler) => handler(noteOn))
        return
      }

      if (isMidiNoteOff(event.data)) {
        this.heldNotes.delete(event.data[1] ?? -1)
      }
    }

    localStorage.setItem('andante-midi-input', input.id)
    this.setStatus({
      state: 'ready',
      inputs: this.listInputs(),
      selectedInputId: input.id,
      message: input.name ? `Connected to ${input.name}.` : 'MIDI input connected.',
    })
  }

  private refreshInputs(): void {
    const inputs = this.listInputs()
    const selectedStillExists = this.selectedInput ? inputs.some((input) => input.id === this.selectedInput?.id) : false

    if (this.selectedInput && !selectedStillExists) {
      this.selectedInput = undefined
      this.heldNotes.clear()
      this.setStatus({
        state: 'disconnected',
        inputs,
        message: 'The selected MIDI input was disconnected.',
      })
      return
    }

    this.setStatus({
      state: inputs.length > 0 ? 'ready' : 'disconnected',
      inputs,
      selectedInputId: this.selectedInput?.id,
      message: inputs.length > 0 ? 'MIDI input available.' : 'No MIDI inputs found.',
    })
  }

  private listInputs(): MidiStatus['inputs'] {
    return this.access
      ? [...this.access.inputs.values()].map((input) => ({
          id: input.id,
          name: input.name ?? 'Unnamed MIDI input',
          manufacturer: input.manufacturer ?? undefined,
        }))
      : []
  }

  private setStatus(status: MidiStatus): void {
    this.status = status
    this.statusHandlers.forEach((handler) => handler(status))
  }
}
