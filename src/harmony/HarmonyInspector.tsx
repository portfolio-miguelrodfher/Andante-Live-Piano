import { CircleOfFifths } from './CircleOfFifths'
import type { HarmonyEvent, TonalContext } from './harmonyTypes'

interface HarmonyInspectorProps {
  isOpen: boolean
  tonalContext: TonalContext
  currentHarmony?: HarmonyEvent
}

export function HarmonyInspector({ isOpen, tonalContext, currentHarmony }: HarmonyInspectorProps) {
  if (!isOpen) return null

  const keyLabel =
    tonalContext.certainty === 'explicit'
      ? tonalContext.activeKey
      : `${tonalContext.majorKey} major / ${minorKeyName(tonalContext.relativeMinor)} minor`

  return (
    <aside className="harmony-inspector" aria-label="Harmony inspector">
      <section>
        <h2>Key</h2>
        <p className="harmony-primary">{keyLabel}</p>
        <p className="harmony-secondary">
          {tonalContext.certainty === 'explicit' ? 'From MusicXML key signature' : 'Mode is not specified in MusicXML'}
        </p>
      </section>

      <CircleOfFifths tonalContext={tonalContext} />

      <section>
        <h2>Current chord</h2>
        <p className="harmony-primary">{currentHarmony?.label ?? 'Not specified'}</p>
        <p className="harmony-secondary">
          {currentHarmony ? `Nearest harmony event at measure ${currentHarmony.measureNumber}` : 'No MusicXML harmony event before this position'}
        </p>
      </section>
    </aside>
  )
}

function minorKeyName(relativeMinor: string): string {
  return relativeMinor.endsWith('m') ? relativeMinor.slice(0, -1) : relativeMinor
}
