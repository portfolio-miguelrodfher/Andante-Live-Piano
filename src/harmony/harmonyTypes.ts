export type KeyMode = 'major' | 'minor'
export type TonalCertainty = 'explicit' | 'ambiguous'

export interface KeySignatureEvent {
  measureNumber: number
  fifths: number
  mode?: KeyMode
}

export interface TonalContext {
  fifths: number
  mode?: KeyMode
  majorKey: string
  relativeMinor: string
  activeKey?: string
  sourceMeasure: number
  certainty: TonalCertainty
}

export interface HarmonyEvent {
  measureNumber: number
  label: string
}
