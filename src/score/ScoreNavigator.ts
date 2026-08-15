import type { PracticeEvent } from '../practice/PracticeTypes'

export function activeMeasureForEvent(event?: PracticeEvent): number | undefined {
  return event?.measureNumber
}
