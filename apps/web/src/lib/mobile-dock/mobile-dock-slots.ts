/**
 * Named destinations in visual order: comparison sits above the row, then
 * filters and listing controls start at the left, followed by map and AI
 * actions at the right. Keeping the order here gives every portal one contract.
 */
export const MOBILE_DOCK_SLOTS = [
    'above',
    'filters',
    'start',
    'map-cards',
    'ai-search',
    'ai-chat'
] as const;

/** Valid destination names accepted by DockPortal. */
export type MobileDockSlot = (typeof MOBILE_DOCK_SLOTS)[number];

/** Attribute used to locate a named destination in the rendered dock. */
export const MOBILE_DOCK_SLOT_ATTR = 'data-mobile-dock-slot' as const;

/** Attribute that marks a control whose visibility contributes to dock height. */
export const MOBILE_DOCK_ITEM_ATTR = 'data-dock-item' as const;
