/**
 * What's New components barrel.
 *
 * Exports all public-facing components for the What's New feature (SPEC-175).
 * Internal sub-components (WhatsNewEntryItem, WhatsNewPanelRow) are not
 * re-exported — they are implementation details of their parent modules.
 *
 * @module whats-new
 */

export { WhatsNewAutoTrigger } from './WhatsNewAutoTrigger';
export type { WhatsNewAutoTriggerProps } from './WhatsNewAutoTrigger';

export { WhatsNewBadge } from './WhatsNewBadge';

export { WhatsNewModal } from './WhatsNewModal';
export type { WhatsNewModalProps } from './WhatsNewModal';

export { WhatsNewPanel } from './WhatsNewPanel';
export type { WhatsNewPanelProps } from './WhatsNewPanel';
