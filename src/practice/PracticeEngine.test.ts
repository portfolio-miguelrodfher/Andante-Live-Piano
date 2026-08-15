import { describe, expect, it } from 'vitest'
import { createMidiNote } from '../midi/midiNote'
import { isMidiNoteOff, parseMidiMessage } from '../midi/midiNote'
import { PracticeEngine } from './PracticeEngine'
import type { ExpectedNote, PracticeEvent } from './PracticeTypes'

function note(midiNumber: number): ExpectedNote {
  const pitchNames = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
  return {
    midiNumber,
    pitchName: pitchNames[midiNumber % 12],
    octave: Math.floor(midiNumber / 12) - 1,
  }
}

function event(id: string, right: number[], left: number[] = []): PracticeEvent {
  const rightHand = right.map(note)
  const leftHand = left.map(note)
  return {
    id,
    measureNumber: 1,
    onset: 0,
    staffEvents: { rightHand, leftHand },
    allExpectedNotes: [...rightHand, ...leftHand],
  }
}

function play(engine: PracticeEngine, midiNumber: number): void {
  engine.receiveNote(createMidiNote(midiNumber, 96, performance.now(), 'simulated'))
}

describe('PracticeEngine', () => {
  it('completes a single note and advances', () => {
    const engine = new PracticeEngine([event('a', [60]), event('b', [62])])
    engine.start()
    play(engine, 60)

    engine.subscribe((snapshot) => {
      expect(snapshot.activeEvent?.id).toBe('b')
      expect(snapshot.expectedNotes).toEqual([62])
    })()
  })

  it('completes a chord across staggered attacks', () => {
    const engine = new PracticeEngine([event('chord', [55, 58, 62])])
    let finalStatus = ''
    engine.subscribe((snapshot) => {
      finalStatus = snapshot.status
    })
    engine.start()
    play(engine, 55)
    play(engine, 58)
    play(engine, 62)

    expect(finalStatus).toBe('completed')
  })

  it('keeps previous chord notes satisfied after an unexpected note', () => {
    const engine = new PracticeEngine([event('chord', [60, 63, 67])])
    let expectedNotes: number[] = []
    engine.subscribe((snapshot) => {
      expectedNotes = snapshot.expectedNotes
    })
    engine.start()
    play(engine, 60)
    play(engine, 63)
    play(engine, 65)
    play(engine, 67)

    expect(expectedNotes).toEqual([60, 63, 67])
  })

  it('requires separate attacks for repeated notes', () => {
    const engine = new PracticeEngine([event('g1', [67]), event('g2', [67])])
    let activeId: string | undefined
    engine.subscribe((snapshot) => {
      activeId = snapshot.activeEvent?.id
    })
    engine.start()
    play(engine, 67)

    expect(activeId).toBe('g2')
  })

  it('uses right-hand mode only', () => {
    const engine = new PracticeEngine([event('split', [72], [48])], 'right')
    let status = ''
    engine.subscribe((snapshot) => {
      status = snapshot.status
    })
    engine.start()
    play(engine, 72)

    expect(status).toBe('completed')
  })

  it('uses left-hand mode only', () => {
    const engine = new PracticeEngine([event('split', [72], [48])], 'left')
    let expected: number[] = []
    engine.subscribe((snapshot) => {
      expected = snapshot.expectedNotes
    })
    engine.start()

    expect(expected).toEqual([48])
  })

  it('uses both hands by default', () => {
    const engine = new PracticeEngine([event('split', [72], [48])])
    let expected: number[] = []
    engine.subscribe((snapshot) => {
      expected = snapshot.expectedNotes
    })
    engine.start()

    expect(expected).toEqual([72, 48])
  })

  it('treats note-on velocity 0 as note off', () => {
    expect(parseMidiMessage(new Uint8Array([0x90, 60, 0]), 1)).toBeNull()
    expect(isMidiNoteOff(new Uint8Array([0x90, 60, 0]))).toBe(true)
  })
})
