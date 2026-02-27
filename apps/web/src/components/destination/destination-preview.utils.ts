/**
 * Pure utility functions extracted from DestinationPreview.astro inline script.
 * Enables unit testing of preview positioning logic without DOM dependencies.
 */

/** Bounding rectangle of the trigger element */
interface TriggerRect {
    /** Distance from top of viewport to top of trigger */
    readonly top: number;
    /** Distance from top of viewport to bottom of trigger */
    readonly bottom: number;
    /** Distance from left of viewport to left of trigger */
    readonly left: number;
}

/** Input for calculating the preview panel position */
interface CalculatePreviewPositionInput {
    /** Bounding rectangle of the card that triggered the preview */
    readonly triggerRect: TriggerRect;
    /** Width of the preview panel in pixels */
    readonly previewWidth: number;
    /** Height of the preview panel in pixels */
    readonly previewHeight: number;
    /** Viewport width in pixels */
    readonly viewportWidth: number;
    /** Viewport height in pixels */
    readonly viewportHeight: number;
}

/** Result of preview position calculation */
interface CalculatePreviewPositionResult {
    /** Left position in pixels (for CSS position: fixed) */
    readonly left: number;
    /** Top position in pixels (for CSS position: fixed) */
    readonly top: number;
}

/** Gap between the trigger card and the preview panel */
const PREVIEW_GAP = 8;

/** Minimum distance from viewport edges */
const EDGE_PADDING = 8;

/** Right-side padding when preventing horizontal overflow */
const RIGHT_PADDING = 16;

/**
 * Calculate the fixed position for a preview panel relative to a trigger card.
 * Prefers placing the preview below the card. Falls back to above if clipped.
 * Clamps horizontally to prevent right-edge overflow.
 * Ensures a minimum distance from the top edge.
 *
 * @param input - Trigger rect, preview dimensions, and viewport dimensions
 * @returns Fixed position coordinates for the preview panel
 */
export function calculatePreviewPosition({
    triggerRect,
    previewWidth,
    previewHeight,
    viewportWidth,
    viewportHeight
}: CalculatePreviewPositionInput): CalculatePreviewPositionResult {
    /* Prefer below the card */
    let top = triggerRect.bottom + PREVIEW_GAP;

    /* Fall back to above if it would clip the bottom */
    if (top + previewHeight > viewportHeight) {
        top = triggerRect.top - previewHeight - PREVIEW_GAP;
    }

    /* Ensure minimum distance from top edge */
    top = Math.max(EDGE_PADDING, top);

    /* Horizontal: align with card left, clamp to prevent right overflow */
    let left = triggerRect.left;
    if (left + previewWidth > viewportWidth) {
        left = viewportWidth - previewWidth - RIGHT_PADDING;
    }

    return { left, top };
}
