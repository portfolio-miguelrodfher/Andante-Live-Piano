import { ChevronLeft, ChevronRight, Maximize2, Pause, Play, RotateCcw, Search, Square, Timer, ZoomIn, ZoomOut } from 'lucide-react'
import type { PianoLoadStatus, PlaybackStatus } from '../playback/PlaybackTypes'
import type { HandMode } from '../practice/PracticeTypes'

interface PracticeToolbarProps {
  handMode: HandMode
  zoom: number
  measureNumber?: number
  harmonyOpen: boolean
  playbackStatus: PlaybackStatus
  pianoLoadStatus: PianoLoadStatus
  pianoLoadError?: string
  tempoBpm: number
  speed: number
  onHandModeChange: (mode: HandMode) => void
  onPrevious: () => void
  onNext: () => void
  onRestart: () => void
  onZoomChange: (zoom: number) => void
  onPlayPause: () => void
  onStop: () => void
  onSpeedChange: (speed: number) => void
  onToggleHarmony: () => void
}

export function PracticeToolbar({
  handMode,
  zoom,
  measureNumber,
  harmonyOpen,
  playbackStatus,
  pianoLoadStatus,
  pianoLoadError,
  tempoBpm,
  speed,
  onHandModeChange,
  onPrevious,
  onNext,
  onRestart,
  onZoomChange,
  onPlayPause,
  onStop,
  onSpeedChange,
  onToggleHarmony,
}: PracticeToolbarProps) {
  const playDisabled = pianoLoadStatus !== 'ready'
  const playLabel = playbackStatus === 'playing'
    ? 'Pause'
    : playbackStatus === 'paused'
      ? 'Resume'
      : pianoLoadStatus === 'loading'
        ? 'Loading piano...'
        : pianoLoadStatus === 'error'
          ? 'Piano unavailable'
          : 'Play'

  return (
    <div className="practice-toolbar" aria-label="Practice controls">
      <div className="toolbar-group">
        <button className="mode-chip is-active" type="button">
          <Timer size={16} />
          Wait Mode
        </button>
      </div>

      <div className="segmented" role="group" aria-label="Hand mode">
        <button className={handMode === 'right' ? 'selected' : ''} type="button" onClick={() => onHandModeChange('right')}>
          RH
        </button>
        <button className={handMode === 'left' ? 'selected' : ''} type="button" onClick={() => onHandModeChange('left')}>
          LH
        </button>
        <button className={handMode === 'both' ? 'selected' : ''} type="button" onClick={() => onHandModeChange('both')}>
          Both
        </button>
      </div>

      <div className="toolbar-group">
        <button type="button" title="Previous" onClick={onPrevious}>
          <ChevronLeft size={17} />
        </button>
        <button
          className="transport-play"
          type="button"
          disabled={playDisabled}
          onClick={onPlayPause}
          title={pianoLoadError ?? 'Play / Pause'}
        >
          {playbackStatus === 'playing' ? <Pause size={20} /> : <Play size={20} />}
          {playLabel}
        </button>
        <button type="button" title="Stop / Restart" onClick={onStop}>
          <Square size={15} />
        </button>
        <button type="button" title="Next" onClick={onNext}>
          <ChevronRight size={17} />
        </button>
        <button type="button" title="Restart" onClick={onRestart}>
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="toolbar-group">
        <span className="tempo-readout">♩ = {Math.round(tempoBpm)}</span>
        <div className="speed-control" role="group" aria-label="Playback speed">
          {[0.5, 0.75, 1].map((value) => (
            <button className={speed === value ? 'selected' : ''} key={value} type="button" onClick={() => onSpeedChange(value)}>
              {Math.round(value * 100)}%
            </button>
          ))}
        </div>
        <button type="button" title="Zoom out" onClick={() => onZoomChange(Math.max(0.55, zoom - 0.05))}>
          <ZoomOut size={16} />
        </button>
        <span className="zoom-readout">{Math.round(zoom * 100)}%</span>
        <button type="button" title="Zoom in" onClick={() => onZoomChange(Math.min(1.35, zoom + 0.05))}>
          <ZoomIn size={16} />
        </button>
      </div>

      <div className="toolbar-group secondary">
        <span className="measure-status">{measureNumber ? `Measure ${measureNumber}` : 'Ready'}</span>
        <button type="button" title="Loop region">
          <Search size={16} />
          Loop
        </button>
        <button type="button" className={harmonyOpen ? 'selected-button' : ''} onClick={onToggleHarmony}>
          Harmony
        </button>
        <button type="button" title="Full screen">
          <Maximize2 size={16} />
        </button>
      </div>
    </div>
  )
}
