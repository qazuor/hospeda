/**
 * Dashboard widget components barrel.
 *
 * T-022: DeferredWidget (coming-soon placeholder for phase-2 slots).
 * T-023: KpiWidget (pilot renderer — establishes the pattern for T-024..T-028).
 * T-024..T-028: ListWidget, ChartWidget, ChecklistWidget, StatusWidget,
 *               shared widget states (to be appended here).
 */

export type { ChartWidgetProps } from './ChartWidget';
export { ChartWidget } from './ChartWidget';
export type { ChecklistWidgetProps } from './ChecklistWidget';
export { ChecklistWidget } from './ChecklistWidget';
export type { CommentsFeedCardProps } from './CommentsFeedCard';
export { CommentsFeedCard } from './CommentsFeedCard';
export type { DeferredWidgetProps } from './DeferredWidget';
export { DeferredWidget } from './DeferredWidget';
export type { KpiData, KpiWidgetConfig, KpiWidgetProps } from './KpiWidget';
export { KpiWidget } from './KpiWidget';
export type { ListWidgetProps } from './ListWidget';
export { ListWidget } from './ListWidget';
export type { StatusWidgetProps } from './StatusWidget';
export { StatusWidget } from './StatusWidget';
export type {
    AdminViewKpi,
    AdminViewsData,
    EditorViewsData,
    HostViewsData,
    ViewsEntityRow,
    ViewsWidgetConfig,
    ViewsWidgetProps
} from './ViewsWidget';
export { ViewsWidget } from './ViewsWidget';
export type {
    WidgetCardProps,
    WidgetEmptyBodyProps,
    WidgetEmptyProps,
    WidgetErrorBodyProps,
    WidgetErrorProps,
    WidgetSkeletonBodyProps,
    WidgetSkeletonProps,
    WidgetUnavailableBodyProps,
    WidgetUnavailableProps,
    WidgetVariant
} from './widget-states';
export {
    WidgetCard,
    WidgetEmpty,
    WidgetEmptyBody,
    WidgetError,
    WidgetErrorBody,
    WidgetSkeleton,
    WidgetSkeletonBody,
    WidgetUnavailable,
    WidgetUnavailableBody
} from './widget-states';
