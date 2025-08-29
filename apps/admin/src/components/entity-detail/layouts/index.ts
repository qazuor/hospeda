/**
 * @file Layout Components Index
 *
 * Central export file for all layout components and utilities.
 */

export {
    ConfigurableLayout,
    createGapClasses,
    createResponsiveClasses,
    useLayoutValidation
} from './ConfigurableLayout';

// Layout renderers
export { AccordionLayout } from './renderers/AccordionLayout';
export { FlexLayout } from './renderers/FlexLayout';
export { GridLayout } from './renderers/GridLayout';
export { SidebarLayout } from './renderers/SidebarLayout';
export { TabsLayout } from './renderers/TabsLayout';

// Re-export types for convenience
export type {
    AccordionLayoutConfig,
    CustomLayoutConfig,
    FlexLayoutConfig,
    GridLayoutConfig,
    LayoutConfig,
    LayoutRendererContext,
    LayoutType,
    ResponsiveBreakpoints,
    SidebarLayoutConfig,
    TabsLayoutConfig
} from '../types';
