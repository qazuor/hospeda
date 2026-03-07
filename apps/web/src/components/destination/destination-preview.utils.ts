/**
 * @file destination-preview.utils.ts
 * @description Pure utility functions for the DestinationPreview component.
 * Extracted from the inline script to enable unit testing without DOM dependencies.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Bounding rectangle of the trigger element (card that activates the preview) */
interface TriggerRect {
    /** Distance from top of viewport to the top edge of the trigger */
    readonly top: number;
    /** Distance from top of viewport to the bottom edge of the trigger */
    readonly bottom: number;
    /** Distance from left of viewport to the left edge of the trigger */
    readonly left: number;
}

/** Input for calculating the fixed position of the preview panel */
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
    /** Left position in pixels (CSS: position: fixed; left: ...) */
    readonly left: number;
    /** Top position in pixels (CSS: position: fixed; top: ...) */
    readonly top: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Gap in pixels between the trigger card bottom edge and the preview top */
const PREVIEW_GAP = 8;

/** Minimum distance from any viewport edge */
const EDGE_PADDING = 8;

/** Right-side padding applied when clamping horizontal overflow */
const RIGHT_PADDING = 16;

// ─── calculatePreviewPosition ─────────────────────────────────────────────────

/**
 * Calculate the fixed-position coordinates for the destination preview panel.
 *
 * Placement strategy:
 * 1. Prefer positioning below the trigger card.
 * 2. Fall back to above the card if the panel would overflow the bottom edge.
 * 3. Ensure the panel never overlaps the top viewport edge.
 * 4. Clamp horizontally to prevent right-edge overflow.
 *
 * @param input - Trigger rect, preview dimensions, and viewport dimensions
 * @returns Fixed-position coordinates `{ left, top }` in pixels
 */
export function calculatePreviewPosition({
    triggerRect,
    previewWidth,
    previewHeight,
    viewportWidth,
    viewportHeight
}: CalculatePreviewPositionInput): CalculatePreviewPositionResult {
    /* Prefer placing the preview below the card */
    let top = triggerRect.bottom + PREVIEW_GAP;

    /* Fall back to above if the preview would overflow the bottom viewport edge */
    if (top + previewHeight > viewportHeight) {
        top = triggerRect.top - previewHeight - PREVIEW_GAP;
    }

    /* Clamp to ensure the preview never overlaps the top viewport edge */
    top = Math.max(EDGE_PADDING, top);

    /* Align with the card's left edge, clamp to prevent right overflow */
    let left = triggerRect.left;
    if (left + previewWidth > viewportWidth) {
        left = viewportWidth - previewWidth - RIGHT_PADDING;
    }

    return { left, top };
}
