/**
 * What's New components barrel.
 *
 * Exports all public-facing components for the What's New feature (SPEC-175).
 * Internal sub-components (WhatsNewEntryItem, WhatsNewPanelRow) are not
 * re-exported — they are implementation details of their parent modules.
 *
 * @module whats-new
 */

export type { WhatsNewAutoTriggerProps } from './WhatsNewAutoTrigger';
export { WhatsNewAutoTrigger } from './WhatsNewAutoTrigger';

export { WhatsNewBadge } from './WhatsNewBadge';

export { WhatsNewDashboardController } from './WhatsNewDashboardController';
export type { WhatsNewModalProps } from './WhatsNewModal';
export { WhatsNewModal } from './WhatsNewModal';
export type { WhatsNewPanelProps } from './WhatsNewPanel';
export { WhatsNewPanel } from './WhatsNewPanel';
