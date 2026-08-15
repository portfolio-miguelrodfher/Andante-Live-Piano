import type { PracticeEvent } from '../practice/PracticeTypes'
import type { HarmonyEvent, KeySignatureEvent } from '../harmony/harmonyTypes'
import type { ScoreDiagnostics } from './ScoreDiagnostics'

export interface SongMetadata {
  id: string
  title: string
  composer: string
  difficulty: string
  scorePath: string
}

export interface LoadedScore {
  id: string
  title: string
  composer?: string
  source: 'bundled' | 'local'
  musicXml: string
  practiceEvents: PracticeEvent[]
  keySignatureEvents: KeySignatureEvent[]
  harmonyEvents: HarmonyEvent[]
  diagnostics: ScoreDiagnostics
}
