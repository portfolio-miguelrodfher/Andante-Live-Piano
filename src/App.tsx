import { Home, Library, Music2, Piano, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PianoKeyboard } from './components/PianoKeyboard'
import { PracticeToolbar } from './components/PracticeToolbar'
import { harmonyForMeasure } from './harmony/HarmonyContext'
import { tonalContextForMeasure } from './harmony/KeySignatureParser'
import { HarmonyInspector } from './harmony/HarmonyInspector'
import { MidiManager } from './midi/MidiManager'
import type { MidiStatus } from './midi/MidiTypes'
import { PlaybackEngine } from './playback/PlaybackEngine'
import { PianoInstrument } from './playback/PianoInstrument'
import type { PianoLoadStatus, PlaybackSnapshot } from './playback/PlaybackTypes'
import { PracticeEngine } from './practice/PracticeEngine'
import type { HandMode, NoteInputEvent, PracticeSnapshot } from './practice/PracticeTypes'
import { activeMeasureForEvent } from './score/ScoreNavigator'
import { BUNDLED_SONGS, loadBundledScore, loadLocalScore } from './score/ScoreLoader'
import { ScoreViewer } from './score/ScoreViewer'
import type { LoadedScore } from './score/ScoreTypes'

const midiManager = new MidiManager()

function App() {
  const [score, setScore] = useState<LoadedScore>()
  const [loadError, setLoadError] = useState<string>()
  const [handMode, setHandMode] = useState<HandMode>(() => (localStorage.getItem('andante-hand-mode') as HandMode) || 'both')
  const [zoom, setZoom] = useState(() => Number(localStorage.getItem('andante-score-zoom')) || 0.82)
  const [midiStatus, setMidiStatus] = useState<MidiStatus>(midiManager.currentStatus)
  const [pressedNotes, setPressedNotes] = useState<number[]>([])
  const [harmonyOpen, setHarmonyOpen] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [pianoLoadStatus, setPianoLoadStatus] = useState<PianoLoadStatus>('idle')
  const [pianoLoadError, setPianoLoadError] = useState<string>()
  const [playbackSnapshot, setPlaybackSnapshot] = useState<PlaybackSnapshot>({
    status: 'stopped',
    soundingNotes: [],
  })
  const [snapshot, setSnapshot] = useState<PracticeSnapshot>({
    status: 'idle',
    activeIndex: 0,
    satisfiedNotes: [],
    expectedNotes: [],
  })
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const seekWasPlayingRef = useRef(false)

  const practiceEngine = useMemo(() => new PracticeEngine(score?.practiceEvents ?? [], handMode), [score, handMode])
  const pianoInstrument = useMemo(() => new PianoInstrument(), [])
  const playbackEngine = useMemo(() => new PlaybackEngine(score?.practiceEvents ?? [], pianoInstrument), [score, pianoInstrument])
  const bundledSong = BUNDLED_SONGS[0]
  const displaySnapshot = playbackSnapshot.status === 'stopped' ? snapshot : {
    ...snapshot,
    activeIndex: playbackSnapshot.activeIndex ?? snapshot.activeIndex,
    activeEvent: playbackSnapshot.activeEvent ?? snapshot.activeEvent,
    expectedNotes: playbackSnapshot.soundingNotes.length > 0 ? playbackSnapshot.soundingNotes : snapshot.expectedNotes,
  }
  const activeMeasure = activeMeasureForEvent(displaySnapshot.activeEvent) ?? 1
  const tonalContext = useMemo(
    () => tonalContextForMeasure(score?.keySignatureEvents ?? [], activeMeasure),
    [score?.keySignatureEvents, activeMeasure],
  )
  const currentHarmony = useMemo(
    () => harmonyForMeasure(score?.harmonyEvents ?? [], activeMeasure),
    [score?.harmonyEvents, activeMeasure],
  )

  useEffect(() => {
    loadBundledScore(bundledSong)
      .then((loadedScore) => {
        setScore(loadedScore)
        setLoadError(undefined)
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : 'The bundled score could not be loaded.')
      })
  }, [bundledSong])

  useEffect(() => {
    const unsubscribe = practiceEngine.subscribe(setSnapshot)
    practiceEngine.start()
    return unsubscribe
  }, [practiceEngine])

  useEffect(() => playbackEngine.subscribe((playback) => {
    setPlaybackSnapshot(playback)
    if (playback.status !== 'stopped' && playback.activeIndex != null) {
      practiceEngine.jumpToEventIndex(playback.activeIndex)
    }
  }), [playbackEngine, practiceEngine])

  useEffect(() => midiManager.onStatus(setMidiStatus), [])

  useEffect(() => {
    let cancelled = false
    setPianoLoadStatus('loading')
    setPianoLoadError(undefined)
    pianoInstrument
      .load()
      .then(() => {
        if (!cancelled) setPianoLoadStatus('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setPianoLoadStatus('error')
        setPianoLoadError(error instanceof Error ? error.message : 'The concert grand piano samples could not be loaded.')
      })

    return () => {
      cancelled = true
    }
  }, [pianoInstrument])

  useEffect(() => {
    localStorage.setItem('andante-hand-mode', handMode)
    practiceEngine.setHandMode(handMode)
  }, [handMode, practiceEngine])

  useEffect(() => {
    localStorage.setItem('andante-score-zoom', String(zoom))
  }, [zoom])

  const soundUserNote = useCallback((midi: number, velocity = 90) => {
    const duration = Math.max(0.28, 0.9 * (velocity / 127))
    void pianoInstrument
      .initialize()
      .then(() => pianoInstrument.trigger([midi], duration))
      .catch((error: unknown) => {
        setPianoLoadStatus('error')
        setPianoLoadError(error instanceof Error ? error.message : 'The concert grand piano could not be started.')
      })
  }, [pianoInstrument])

  useEffect(() => {
    return midiManager.onNote((note) => {
      setPressedNotes((current) => [...new Set([...current, note.noteNumber])])
      soundUserNote(note.noteNumber, note.velocity)
      practiceEngine.receiveNote(note)
      window.setTimeout(() => {
        setPressedNotes((current) => current.filter((noteNumber) => noteNumber !== note.noteNumber))
      }, 180)
    })
  }, [practiceEngine, soundUserNote])

  const handleNoteInput = (input: NoteInputEvent) => {
    if (input.type === 'noteon') {
      setPressedNotes((current) => [...new Set([...current, input.midi])])
      soundUserNote(input.midi, input.velocity)
      practiceEngine.receiveInput(input)
      return
    }

    setPressedNotes((current) => current.filter((noteNumber) => noteNumber !== input.midi))
  }

  const handlePlayPause = useCallback(() => {
    if (!score) return
    if (pianoLoadStatus !== 'ready') return

    if (playbackSnapshot.status === 'playing') {
      playbackEngine.pause()
      return
    }

    if (playbackSnapshot.status === 'paused') {
      playbackEngine.resume()
      return
    }

    void playbackEngine.playFrom(snapshot.activeIndex, {
      tempoBpm: score.diagnostics.tempoBpm,
      speed,
    })
  }, [pianoLoadStatus, playbackEngine, playbackSnapshot.status, score, snapshot.activeIndex, speed])

  const seekToEvent = useCallback((eventIndex: number, resumePlayback = false) => {
    if (!score) return

    practiceEngine.jumpToEventIndex(eventIndex)
    playbackEngine.seekToEvent(eventIndex, {
      tempoBpm: score.diagnostics.tempoBpm,
      speed,
    }, resumePlayback && pianoLoadStatus === 'ready')
  }, [pianoLoadStatus, playbackEngine, practiceEngine, score, speed])

  const handleSeekStart = useCallback(() => {
    seekWasPlayingRef.current = playbackSnapshot.status === 'playing'
    if (seekWasPlayingRef.current) {
      playbackEngine.pauseForSeek()
    }
  }, [playbackEngine, playbackSnapshot.status])

  const handleSeekCommit = useCallback((eventIndex: number) => {
    seekToEvent(eventIndex, seekWasPlayingRef.current)
    seekWasPlayingRef.current = false
  }, [seekToEvent])

  const handleScoreDisplayError = useCallback((message: string) => {
    playbackEngine.pauseForSeek()
    setLoadError(message)
  }, [playbackEngine])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || isTextEditingTarget(event.target)) return
      event.preventDefault()
      handlePlayPause()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handlePlayPause])

  const openLocalScore = async (file: File) => {
    try {
      const loadedScore = await loadLocalScore(file)
      setScore(loadedScore)
      setLoadError(undefined)
      localStorage.setItem('andante-recent-score', loadedScore.title)
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'The local score could not be opened.')
    }
  }

  return (
    <main className="app-shell">
      <nav className="rail" aria-label="Primary">
        <button className="rail-button active" title="Practice" type="button">
          <Home size={18} />
        </button>
        <button className="rail-button" title="Open a score" type="button" onClick={() => fileInputRef.current?.click()}>
          <Music2 size={18} />
        </button>
        <button className="rail-button" title="Open MusicXML" type="button" onClick={() => fileInputRef.current?.click()}>
          <Upload size={18} />
        </button>
        <button className="rail-button" title="MIDI" type="button" onClick={() => void midiManager.requestAccess()}>
          <Piano size={18} />
        </button>
        <span className="wordmark" aria-label="Andante" />
      </nav>

      <ErrorBoundary name="PracticeView" onError={handleScoreDisplayError}>
      <section className="practice-screen">
        <header className="topbar">
          <button className="library-link" type="button" onClick={() => fileInputRef.current?.click()}>
            <Library size={16} />
            Open score
          </button>
          <div className="title-block">
            <img className="site-logo" src={`${import.meta.env.BASE_URL}andante-logo.svg`} alt="" />
            <h1>{score?.title ?? bundledSong.title}</h1>
            <span>{score?.composer ?? bundledSong.composer}</span>
          </div>
          <div className="midi-cluster">
            <button type="button" onClick={() => void midiManager.requestAccess()}>
              Connect MIDI
            </button>
            <span className={`midi-dot ${midiStatus.state}`} aria-hidden="true" />
            <span>{midiStatus.selectedInputId ? midiStatus.inputs.find((input) => input.id === midiStatus.selectedInputId)?.name : midiStatus.message}</span>
          </div>
        </header>

        <div
          className={harmonyOpen ? 'practice-score-region has-harmony' : 'practice-score-region'}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            const file = event.dataTransfer.files[0]
            if (file) void openLocalScore(file)
          }}
        >
          <ErrorBoundary name="ScoreViewer" onError={handleScoreDisplayError}>
            <ScoreViewer
              musicXml={score?.musicXml}
              zoom={zoom}
              activeMeasure={activeMeasure}
              activeIndex={displaySnapshot.activeIndex}
              totalMeasures={score?.diagnostics.sourceMeasureCount ?? 0}
              practiceEvents={score?.practiceEvents ?? []}
              expectedNotes={displaySnapshot.expectedNotes}
              onSeekStart={handleSeekStart}
              onSeekCommit={handleSeekCommit}
              onRenderError={handleScoreDisplayError}
            />
          </ErrorBoundary>
          <ErrorBoundary name="HarmonyInspector" onError={handleScoreDisplayError}>
            <HarmonyInspector isOpen={harmonyOpen} tonalContext={tonalContext} currentHarmony={currentHarmony} />
          </ErrorBoundary>
        </div>

        {loadError ? <p className="load-error">{loadError}</p> : null}

        <div className="score-diagnostics" aria-label="Score diagnostics">
          <span>Score: {score?.title ?? 'Loading'}</span>
          <span>Measures: {score?.diagnostics.sourceMeasureCount ?? 0}</span>
          <span>Current measure: {activeMeasure}</span>
          <span>Practice events: {score?.diagnostics.practiceEventCount ?? 0}</span>
          <span>Current event: {displaySnapshot.activeIndex + 1}</span>
          <span>Key context: {tonalContext.activeKey ?? `${tonalContext.majorKey}/${tonalContext.relativeMinor}`}</span>
          <span>MIDI: {midiStatus.selectedInputId ? 'Connected' : 'Not connected'}</span>
          <span>Input mode: Screen piano available</span>
          <span>Playback: {playbackSnapshot.status}</span>
        </div>

        <PracticeToolbar
          handMode={handMode}
          zoom={zoom}
          measureNumber={activeMeasure}
          harmonyOpen={harmonyOpen}
          playbackStatus={playbackSnapshot.status}
          pianoLoadStatus={pianoLoadStatus}
          pianoLoadError={pianoLoadError}
          tempoBpm={score?.diagnostics.tempoBpm ?? 100}
          speed={speed}
          onHandModeChange={setHandMode}
          onPrevious={() => {
            playbackEngine.stop()
            practiceEngine.previousMeasure()
          }}
          onNext={() => {
            playbackEngine.stop()
            practiceEngine.nextMeasure()
          }}
          onRestart={() => {
            playbackEngine.stop()
            practiceEngine.restart()
          }}
          onZoomChange={setZoom}
          onPlayPause={handlePlayPause}
          onStop={() => {
            playbackEngine.stop()
            practiceEngine.restart()
          }}
          onSpeedChange={setSpeed}
          onToggleHarmony={() => setHarmonyOpen((isOpen) => !isOpen)}
          onToggleFullscreen={() => {
            if (document.fullscreenElement) {
              void document.exitFullscreen()
            } else {
              void document.documentElement.requestFullscreen()
            }
          }}
        />

        <ErrorBoundary name="PianoKeyboard" onError={handleScoreDisplayError}>
          <PianoKeyboard
            expectedNotes={displaySnapshot.expectedNotes}
            pressedNotes={pressedNotes}
            playbackNotes={playbackSnapshot.soundingNotes}
            satisfiedNotes={displaySnapshot.satisfiedNotes}
            onNoteInput={handleNoteInput}
          />
        </ErrorBoundary>
      </section>
      </ErrorBoundary>

      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept=".musicxml,.xml,.mxl"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void openLocalScore(file)
        }}
      />
    </main>
  )
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  const tagName = target.tagName.toLowerCase()
  return tagName === 'input' || tagName === 'select' || tagName === 'textarea' || target.isContentEditable
}

export default App
