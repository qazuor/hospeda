/**
 * Dashboard widget components barrel.
 *
 * T-022: DeferredWidget (coming-soon placeholder for phase-2 slots).
 * T-023: KpiWidget (pilot renderer — establishes the pattern for T-024..T-028).
 * T-024..T-028: ListWidget, ChartWidget, ChecklistWidget, StatusWidget,
 *               shared widget states (to be appended here).
 */
export { DeferredWidget } from './DeferredWidget';
export type { DeferredWidgetProps } from './DeferredWidget';

export { KpiWidget } from './KpiWidget';
export type { KpiWidgetProps, KpiData, KpiWidgetConfig } from './KpiWidget';

export { ListWidget } from './ListWidget';
export type { ListWidgetProps } from './ListWidget';

export { ChartWidget } from './ChartWidget';
export type { ChartWidgetProps } from './ChartWidget';

export { ChecklistWidget } from './ChecklistWidget';
export type { ChecklistWidgetProps } from './ChecklistWidget';

export { StatusWidget } from './StatusWidget';
export type { StatusWidgetProps } from './StatusWidget';
