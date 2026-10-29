/* Where to scroll the lifecycle rail so a stage sits in the middle of the
   view. Pure, so it is tested without a browser. */

export interface RailGeometry {
  /** Visible width of the rail. */
  viewport: number
  /** Full scrollable width of the rail. */
  content: number
  /** The stage's left edge, measured from the start of the rail. */
  itemStart: number
  itemWidth: number
}

/** The scroll position that centers the stage, kept inside the scrollable range. 0 when the rail fits. */
export function centeredScrollLeft({ viewport, content, itemStart, itemWidth }: RailGeometry): number {
  const max = Math.max(0, content - viewport)
  const target = itemStart + itemWidth / 2 - viewport / 2
  return Math.round(Math.min(max, Math.max(0, target)))
}
