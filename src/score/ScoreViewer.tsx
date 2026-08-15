import { CursorType, OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { PracticeEvent } from '../practice/PracticeTypes'

interface ScoreViewerProps {
  musicXml?: string
  zoom: number
  activeMeasure?: number
  activeIndex?: number
  totalMeasures: number
  practiceEvents: PracticeEvent[]
  expectedNotes: number[]
  onSeekStart: () => void
  onSeekCommit: (eventIndex: number) => void
  onRenderError: (message: string) => void
}

interface ScoreWindow {
  from: number
  to: number
}

export interface GraphicalEventPosition {
  eventIndex: number
  measureNumber: number
  scoreTimeQuarter: number
  x: number
  y: number
  systemIndex: number
  boundingRect: DOMRect
}

const MEASURES_PER_READING_WINDOW = 16
const MEASURE_CONTEXT = 2
const HIT_TARGET_PX = 24

export function ScoreViewer({
  musicXml,
  zoom,
  activeMeasure,
  activeIndex,
  totalMeasures,
  practiceEvents,
  expectedNotes,
  onSeekStart,
  onSeekCommit,
  onRenderError,
}: ScoreViewerProps) {
  const readingWindowRef = useRef<HTMLDivElement | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)
  const loadedRef = useRef(false)
  const renderGenerationRef = useRef(0)
  const renderRequestRef = useRef('idle')
  const latestWindowRef = useRef<ScoreWindow>({ from: 1, to: 1 })
  const latestZoomRef = useRef(zoom)
  const latestActiveIndexRef = useRef(activeIndex)
  const latestActiveMeasureRef = useRef(activeMeasure)
  const latestPracticeEventsRef = useRef(practiceEvents)
  const graphicalPositionsRef = useRef<GraphicalEventPosition[]>([])
  const draggingRef = useRef(false)
  const [isRendered, setIsRendered] = useState(false)
  const [error, setError] = useState<string>()
  const [previewPosition, setPreviewPosition] = useState<GraphicalEventPosition>()
  const [isSeeking, setIsSeeking] = useState(false)
  const [containerSize, setContainerSize] = useState({ width: 1, height: 1 })
  const scoreWindow = useMemo(
    () => readingWindowForMeasure(activeMeasure, totalMeasures),
    [activeMeasure, totalMeasures],
  )

  latestWindowRef.current = scoreWindow
  latestZoomRef.current = zoom
  latestActiveIndexRef.current = activeIndex
  latestActiveMeasureRef.current = activeMeasure
  latestPracticeEventsRef.current = practiceEvents

  const logDiagnostics = useCallback((reason: string) => {
    const host = hostRef.current
    const reader = readingWindowRef.current
    const window = latestWindowRef.current
    const svgs = host?.querySelectorAll('svg').length ?? 0
    const renderedMeasures = host?.querySelectorAll('[id*="vf-measure"], g[class*="measure"]').length ?? 0

    console.warn('[Andante ScoreViewer diagnostic]', {
      reason,
      scoreViewerMounted: true,
      osmdContainerExists: Boolean(host),
      osmdSvgCount: svgs,
      currentEventIndex: latestActiveIndexRef.current,
      currentMeasure: latestActiveMeasureRef.current,
      scoreWindowStart: window.from,
      scoreWindowEnd: window.to,
      renderedMeasureCount: renderedMeasures,
      containerWidth: reader?.clientWidth ?? 0,
      containerHeight: reader?.clientHeight ?? 0,
      documentBodyHeight: document.body.clientHeight,
      lastRenderRequest: renderRequestRef.current,
      cachedGraphicalEvents: graphicalPositionsRef.current.length,
    })
  }, [])

  const failScoreDisplay = useCallback((message: string, errorValue?: unknown) => {
    console.error(message, errorValue)
    logDiagnostics(message)
    setError(message)
    onRenderError(`${message} Audio paused.`)
  }, [logDiagnostics, onRenderError])

  const moveCursorToActiveIndex = useCallback(() => {
    const osmd = osmdRef.current
    const index = latestActiveIndexRef.current
    if (!osmd || !loadedRef.current || index == null) return

    const steps = cursorStepsForActiveEvent(latestPracticeEventsRef.current, index, latestWindowRef.current)
    try {
      osmd.cursor.reset()
      osmd.cursor.show()
      for (let step = 0; step < steps; step += 1) {
        osmd.cursor.next()
      }
    } catch (errorValue) {
      failScoreDisplay('Score display encountered an error.', errorValue)
    }
  }, [failScoreDisplay])

  const buildGraphicalPositionCache = useCallback(() => {
    const osmd = osmdRef.current
    const reader = readingWindowRef.current
    if (!osmd || !reader || !loadedRef.current) return

    const visibleEvents = latestPracticeEventsRef.current
      .map((event, eventIndex) => ({ event, eventIndex }))
      .filter(({ event }) => event.measureNumber >= latestWindowRef.current.from && event.measureNumber <= latestWindowRef.current.to)
      .filter(({ event }) => event.allExpectedNotes.length > 0)

    const positions: GraphicalEventPosition[] = []
    const readerRect = reader.getBoundingClientRect()

    try {
      osmd.cursor.reset()
      osmd.cursor.show()
      visibleEvents.forEach(({ event, eventIndex }, visibleIndex) => {
        if (visibleIndex > 0) osmd.cursor.next()
        const rect = osmd.cursor.cursorElement.getBoundingClientRect()
        positions.push({
          eventIndex,
          measureNumber: event.measureNumber,
          scoreTimeQuarter: scoreTimeQuarterForEvent(latestPracticeEventsRef.current, eventIndex),
          x: rect.left - readerRect.left + reader.scrollLeft,
          y: rect.top - readerRect.top + reader.scrollTop,
          systemIndex: systemIndexForY(positions, rect.top - readerRect.top + reader.scrollTop),
          boundingRect: new DOMRect(
            rect.left - readerRect.left + reader.scrollLeft,
            rect.top - readerRect.top + reader.scrollTop,
            rect.width,
            rect.height,
          ),
        })
      })
      graphicalPositionsRef.current = positions
      moveCursorToActiveIndex()
    } catch (errorValue) {
      graphicalPositionsRef.current = []
      failScoreDisplay('Score display encountered an error.', errorValue)
    }
  }, [failScoreDisplay, moveCursorToActiveIndex])

  const renderCurrentWindow = useCallback((reason: string) => {
    const osmd = osmdRef.current
    const reader = readingWindowRef.current
    if (!osmd || !loadedRef.current || !reader) return

    if (reader.clientWidth === 0 || reader.clientHeight === 0) {
      renderRequestRef.current = `${reason}: deferred for zero-size container`
      logDiagnostics('Score render deferred because the container is zero-size.')
      return
    }

    const generation = ++renderGenerationRef.current
    const window = latestWindowRef.current
    renderRequestRef.current = `${reason}: ${window.from}-${window.to}`

    try {
      osmd.setOptions({
        drawFromMeasureNumber: window.from,
        drawUpToMeasureNumber: window.to,
      })
      osmd.Zoom = latestZoomRef.current
      osmd.render()
      if (generation !== renderGenerationRef.current) return
      osmd.cursor.show()
      setError(undefined)
      setIsRendered(true)
      focusScoreWindow(hostRef.current)
      buildGraphicalPositionCache()
    } catch (errorValue) {
      if (generation !== renderGenerationRef.current) return
      failScoreDisplay('Score display encountered an error.', errorValue)
    }
  }, [buildGraphicalPositionCache, failScoreDisplay, logDiagnostics])

  useEffect(() => {
    if (!hostRef.current || !musicXml) return

    const osmd = new OpenSheetMusicDisplay(hostRef.current, {
      autoResize: false,
      backend: 'svg',
      cursorsOptions: [{
        type: CursorType.ThinLeft,
        color: '#E09E2E',
        alpha: 0.9,
        follow: true,
      }],
      disableCursor: false,
      drawComposer: false,
      drawCredits: false,
      drawLyricist: false,
      drawMeasureNumbers: true,
      drawMeasureNumbersOnlyAtSystemStart: true,
      drawSubtitle: false,
      drawTitle: false,
      drawingParameters: 'compact',
      pageBackgroundColor: '#FAFAF500',
      pageFormat: 'Endless',
      drawFromMeasureNumber: latestWindowRef.current.from,
      drawUpToMeasureNumber: latestWindowRef.current.to,
      newPageFromXML: false,
      newSystemFromXML: false,
    })

    const generation = ++renderGenerationRef.current
    osmdRef.current = osmd
    loadedRef.current = false
    graphicalPositionsRef.current = []
    setIsRendered(false)
    setError(undefined)
    hostRef.current.replaceChildren()
    renderRequestRef.current = 'load score'

    osmd
      .load(musicXml)
      .then(() => {
        if (generation !== renderGenerationRef.current) return
        loadedRef.current = true
        renderCurrentWindow('initial render')
      })
      .catch((errorValue: unknown) => {
        if (generation !== renderGenerationRef.current) return
        failScoreDisplay('Score display encountered an error.', errorValue)
      })

    return () => {
      renderGenerationRef.current += 1
      loadedRef.current = false
      osmdRef.current = null
    }
  }, [failScoreDisplay, musicXml, renderCurrentWindow])

  useEffect(() => {
    if (!isRendered) return
    renderCurrentWindow('window or zoom change')
  }, [containerSize, isRendered, renderCurrentWindow, scoreWindow.from, scoreWindow.to, zoom])

  useEffect(() => {
    if (!isRendered) return
    moveCursorToActiveIndex()
  }, [activeIndex, isRendered, moveCursorToActiveIndex])

  useEffect(() => {
    const reader = readingWindowRef.current
    if (!reader) return

    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width)
      const height = Math.round(entry.contentRect.height)
      if (width > 0 && height > 0) {
        setContainerSize({ width, height })
      } else {
        logDiagnostics('Score container became zero-size.')
      }
    })
    observer.observe(reader)
    return () => observer.disconnect()
  }, [logDiagnostics])

  const nearestPositionForPointer = (event: ReactPointerEvent<HTMLDivElement>): GraphicalEventPosition | undefined => {
    const reader = readingWindowRef.current
    const positions = graphicalPositionsRef.current
    if (!reader || positions.length === 0) return undefined

    const rect = reader.getBoundingClientRect()
    const x = event.clientX - rect.left + reader.scrollLeft
    const y = event.clientY - rect.top + reader.scrollTop
    return nearestGraphicalPosition(positions, x, y)
  }

  const beginSeek = (event: ReactPointerEvent<HTMLDivElement>) => {
    const nearest = nearestPositionForPointer(event)
    if (!nearest) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    draggingRef.current = true
    setIsSeeking(true)
    setPreviewPosition(nearest)
    onSeekStart()
  }

  const updateSeek = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    const nearest = nearestPositionForPointer(event)
    if (nearest) setPreviewPosition(nearest)
  }

  const commitSeek = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    const nearest = nearestPositionForPointer(event) ?? previewPosition
    draggingRef.current = false
    setIsSeeking(false)
    setPreviewPosition(undefined)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (nearest) onSeekCommit(nearest.eventIndex)
  }

  const cancelSeek = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false
    setIsSeeking(false)
    setPreviewPosition(undefined)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div className="score-viewer" aria-label="Sheet music" data-window={`${scoreWindow.from}-${scoreWindow.to}`}>
      <div
        ref={readingWindowRef}
        className={isSeeking ? 'score-reading-window is-seeking' : 'score-reading-window'}
        onPointerDown={beginSeek}
        onPointerMove={updateSeek}
        onPointerUp={commitSeek}
        onPointerCancel={cancelSeek}
      >
        {previewPosition ? (
          <div
            className="score-seek-preview"
            style={{
              height: `${Math.max(28, previewPosition.boundingRect.height)}px`,
              left: `${previewPosition.x}px`,
              top: `${previewPosition.y}px`,
              width: `${HIT_TARGET_PX}px`,
            }}
            aria-hidden="true"
          />
        ) : null}
        <div className="score-focus-summary" aria-label="Expected notes">
          {expectedNotes.length > 0 ? `${expectedNotes.length} expected ${expectedNotes.length === 1 ? 'note' : 'notes'}` : 'Waiting'}
        </div>
        {error ? (
          <div className="score-error score-error-panel" role="alert">
            <span>Score display encountered an error.</span>
            <span>Audio paused.</span>
            <button type="button" onClick={() => renderCurrentWindow('retry after error')}>Retry score display</button>
          </div>
        ) : null}
        <div ref={hostRef} className="osmd-host" />
      </div>
    </div>
  )
}

function readingWindowForMeasure(activeMeasure = 1, totalMeasures: number): ScoreWindow {
  const maxMeasure = Math.max(1, totalMeasures || 1)
  const clampedMeasure = Math.min(Math.max(1, activeMeasure), maxMeasure)
  const windowIndex = Math.floor((clampedMeasure - 1) / 8)
  const desiredFrom = windowIndex * 8 + 1 - MEASURE_CONTEXT
  const from = Math.min(Math.max(1, desiredFrom), maxMeasure)
  const to = Math.min(maxMeasure, Math.max(from, from + MEASURES_PER_READING_WINDOW - 1))

  return { from, to }
}

function cursorStepsForActiveEvent(
  practiceEvents: PracticeEvent[],
  activeIndex: number,
  scoreWindow: ScoreWindow,
): number {
  const visibleEvents = practiceEvents
    .slice(0, activeIndex + 1)
    .filter((event) => event.measureNumber >= scoreWindow.from && event.measureNumber <= scoreWindow.to && event.allExpectedNotes.length > 0)

  return Math.max(0, visibleEvents.length - 1)
}

function scoreTimeQuarterForEvent(practiceEvents: PracticeEvent[], eventIndex: number): number {
  return practiceEvents.slice(0, eventIndex).reduce((total, event) => total + (event.durationBeats ?? 0), 0)
}

function systemIndexForY(positions: GraphicalEventPosition[], y: number): number {
  const existingSystem = positions.find((position) => Math.abs(position.y - y) < 48)
  if (existingSystem) return existingSystem.systemIndex

  return new Set(positions.map((position) => position.systemIndex)).size
}

function nearestGraphicalPosition(positions: GraphicalEventPosition[], x: number, y: number): GraphicalEventPosition {
  return positions.reduce((nearest, position) => {
    const nearestDistance = weightedDistance(nearest, x, y)
    const currentDistance = weightedDistance(position, x, y)
    return currentDistance < nearestDistance ? position : nearest
  }, positions[0])
}

function weightedDistance(position: GraphicalEventPosition, x: number, y: number): number {
  const centerX = position.x + position.boundingRect.width / 2
  const centerY = position.y + position.boundingRect.height / 2
  const dx = centerX - x
  const dy = (centerY - y) * 2.2
  return Math.hypot(dx, dy)
}

function focusScoreWindow(host: HTMLDivElement | null): void {
  host?.parentElement?.scrollTo({ top: 0, left: 0, behavior: 'instant' })
}
