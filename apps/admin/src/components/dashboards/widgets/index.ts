/**
 * Dashboard widget components barrel.
 *
 * Only DeferredWidget is exported here for T-022.
 * T-023..T-028 (KpiWidget, ListWidget, ChartWidget, ChecklistWidget,
 * StatusWidget, skeleton/error/empty) will append their exports here.
 */
export { DeferredWidget } from './DeferredWidget';
export type { DeferredWidgetProps } from './DeferredWidget';
