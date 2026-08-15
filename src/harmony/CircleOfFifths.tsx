import { FIFTHS_TO_KEYS } from './KeySignatureParser'
import type { TonalContext } from './harmonyTypes'

interface CircleOfFifthsProps {
  tonalContext: TonalContext
}

const ORDER = [0, 1, 2, 3, 4, 5, 6, -5, -4, -3, -2, -1]

export function CircleOfFifths({ tonalContext }: CircleOfFifthsProps) {
  return (
    <svg className="circle-of-fifths" viewBox="0 0 320 320" role="img" aria-label="Circle of fifths">
      <circle className="circle-backdrop" cx="160" cy="160" r="146" />
      {ORDER.map((fifths, index) => {
        const keys = FIFTHS_TO_KEYS[fifths]
        const angle = index * 30 - 90
        const majorPosition = polarToCartesian(160, 160, 116, angle)
        const minorPosition = polarToCartesian(160, 160, 72, angle)
        const isMajorActive = tonalContext.mode === 'major' && tonalContext.fifths === fifths
        const isMinorActive = tonalContext.mode === 'minor' && tonalContext.fifths === fifths
        const isAmbiguousActive = tonalContext.certainty === 'ambiguous' && tonalContext.fifths === fifths

        return (
          <g className="fifths-node" key={fifths}>
            <circle
              className={isMajorActive || isAmbiguousActive ? 'key-node active' : 'key-node'}
              cx={majorPosition.x}
              cy={majorPosition.y}
              r="24"
            />
            <text x={majorPosition.x} y={majorPosition.y + 5}>
              {keys.majorKey}
            </text>
            <circle
              className={isMinorActive || isAmbiguousActive ? 'minor-node active' : 'minor-node'}
              cx={minorPosition.x}
              cy={minorPosition.y}
              r="18"
            />
            <text className="minor-label" x={minorPosition.x} y={minorPosition.y + 4}>
              {keys.relativeMinor}
            </text>
          </g>
        )
      })}
      <circle className="circle-center" cx="160" cy="160" r="38" />
      <text className="center-label" x="160" y="154">
        Key
      </text>
      <text className="center-key" x="160" y="176">
        {tonalContext.activeKey ?? `${tonalContext.majorKey}/${tonalContext.relativeMinor}`}
      </text>
    </svg>
  )
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleDegrees: number): { x: number; y: number } {
  const angleRadians = (angleDegrees * Math.PI) / 180
  return {
    x: centerX + radius * Math.cos(angleRadians),
    y: centerY + radius * Math.sin(angleRadians),
  }
}
