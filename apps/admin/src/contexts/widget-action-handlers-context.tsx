/**
 * WidgetActionHandlersContext — declarative action dispatch for dashboard widgets.
 *
 * Bridges the gap between serializable widget config (which cannot hold function
 * references) and React state. Dashboard widgets declare their actions as string
 * keys (e.g. `footerLink.action: 'whats-new-panel'`); this context maps those
 * keys to live React callbacks.
 *
 * ## Design
 *
 * `ListWidget` calls `useWidgetActionHandlers()` to retrieve handlers when its
 * config declares a `footerLink` or per-item callback. The handlers are
 * registered by feature controllers (e.g. `WhatsNewAutoTrigger`) that are
 * mounted above the dashboard in the React tree.
 *
 * This approach keeps `ListWidget` config serializable while allowing callbacks
 * to close over live React state — without coupling `ListWidget` to any specific
 * feature.
 *
 * ## Usage
 *
 * ```tsx
 * // In AppLayout.tsx — register What's New actions once:
 * <WidgetActionHandlersProvider
 *   handlers={{
 *     'whats-new-panel': () => setWnPanelOpen(true),
 *     'whats-new-entry': (item) => { setWnEntryId(item.id); setWnModalOpen(true); }
 *   }}
 * >
 *   {children}
 * </WidgetActionHandlersProvider>
 *
 * // In ListWidget — fire an action by key:
 * const { getFooterHandler, getItemHandler } = useWidgetActionHandlers();
 * const onFooter = getFooterHandler(footerLink.action);
 * ```
 *
 * @module widget-action-handlers-context
 * @see apps/admin/src/components/dashboards/widgets/ListWidget.tsx
 * @see apps/admin/src/components/layout/AppLayout.tsx
 * @see SPEC-175 T-017
 */

import type { ListItem } from '@/components/dashboards/widgets/ListWidget';
import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * A footer action handler — called with the declarative action key when the
 * footer link button is clicked.
 *
 * @param action - The `footerLink.action` key from the widget config.
 */
export type FooterActionHandler = (action: string) => void;

/**
 * A per-item action handler — called with the `ListItem` when the item
 * button is clicked (actionPerItem without hrefTemplate).
 *
 * @param item - The full `ListItem` for the clicked row.
 */
export type ItemActionHandler = (item: ListItem) => void;

/**
 * Registry of named action handlers.
 *
 * Key format: an action name string matching `footerLink.action` or a
 * per-item action name from `widget.config`.
 */
export interface WidgetActionHandlers {
    /**
     * Footer action handlers keyed by action name.
     * Called when the footer link button is clicked.
     */
    readonly footerHandlers: Readonly<Record<string, FooterActionHandler>>;
    /**
     * Per-item action handlers keyed by action name.
     * Called when an item button (no hrefTemplate) is clicked.
     */
    readonly itemHandlers: Readonly<Record<string, ItemActionHandler>>;
}

// ============================================================================
// CONTEXT VALUE
// ============================================================================

/**
 * Value exposed by {@link WidgetActionHandlersContext}.
 */
export interface WidgetActionHandlersContextValue {
    /**
     * Returns the footer handler for the given action key, or `undefined` when
     * no handler is registered. Callers must guard on the return value.
     *
     * @param action - The `footerLink.action` key from the widget config.
     */
    getFooterHandler: (action: string) => FooterActionHandler | undefined;

    /**
     * Returns the item handler for the given action key, or `undefined` when
     * no handler is registered.
     *
     * @param action - The per-item action name from the widget config.
     */
    getItemHandler: (action: string) => ItemActionHandler | undefined;

    /**
     * Registers additional handlers at runtime. Useful for lazy-mounted feature
     * controllers that need to add their handlers after initial mount.
     *
     * Merges with existing handlers — does NOT replace the full registry.
     */
    registerHandlers: (handlers: Partial<WidgetActionHandlers>) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const WidgetActionHandlersContext = createContext<WidgetActionHandlersContextValue | null>(null);

WidgetActionHandlersContext.displayName = 'WidgetActionHandlersContext';

// ============================================================================
// PROVIDER PROPS
// ============================================================================

/**
 * Props for {@link WidgetActionHandlersProvider}.
 */
export interface WidgetActionHandlersProviderProps {
    /**
     * Initial set of action handlers. Typically provided by the feature
     * controllers mounted in `AppLayout.tsx`.
     */
    readonly initialHandlers?: Partial<WidgetActionHandlers>;
    readonly children: ReactNode;
}

// ============================================================================
// PROVIDER
// ============================================================================

/**
 * Provides widget action handlers to the React tree.
 *
 * Mount this in `AppLayout.tsx` (or wherever the dashboard lives) with the
 * initial set of handlers. Feature controllers (e.g. the What's New panel
 * opener) call `registerHandlers()` to add their own callbacks.
 *
 * @example
 * ```tsx
 * // AppLayout.tsx
 * <WidgetActionHandlersProvider
 *   initialHandlers={{
 *     footerHandlers: { 'whats-new-panel': () => setWnPanelOpen(true) },
 *     itemHandlers: { 'whats-new-entry': (item) => openWnModal(item.id) }
 *   }}
 * >
 *   {children}
 * </WidgetActionHandlersProvider>
 * ```
 */
export function WidgetActionHandlersProvider({
    initialHandlers,
    children
}: WidgetActionHandlersProviderProps) {
    const [handlers, setHandlers] = useState<WidgetActionHandlers>({
        footerHandlers: initialHandlers?.footerHandlers ?? {},
        itemHandlers: initialHandlers?.itemHandlers ?? {}
    });

    const getFooterHandler = useCallback(
        (action: string): FooterActionHandler | undefined => {
            return handlers.footerHandlers[action];
        },
        [handlers.footerHandlers]
    );

    const getItemHandler = useCallback(
        (action: string): ItemActionHandler | undefined => {
            return handlers.itemHandlers[action];
        },
        [handlers.itemHandlers]
    );

    const registerHandlers = useCallback((incoming: Partial<WidgetActionHandlers>) => {
        setHandlers((prev) => ({
            footerHandlers: {
                ...prev.footerHandlers,
                ...(incoming.footerHandlers ?? {})
            },
            itemHandlers: {
                ...prev.itemHandlers,
                ...(incoming.itemHandlers ?? {})
            }
        }));
    }, []);

    const value = useMemo<WidgetActionHandlersContextValue>(
        () => ({ getFooterHandler, getItemHandler, registerHandlers }),
        [getFooterHandler, getItemHandler, registerHandlers]
    );

    return (
        <WidgetActionHandlersContext.Provider value={value}>
            {children}
        </WidgetActionHandlersContext.Provider>
    );
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Returns the widget action handlers from the nearest provider.
 *
 * Returns a no-op fallback when called outside a provider so components
 * never crash — they simply do nothing when a button is clicked.
 *
 * @returns {@link WidgetActionHandlersContextValue}
 */
export function useWidgetActionHandlers(): WidgetActionHandlersContextValue {
    const ctx = useContext(WidgetActionHandlersContext);

    if (!ctx) {
        // Safe fallback — no crash; handlers are no-ops.
        return {
            getFooterHandler: () => undefined,
            getItemHandler: () => undefined,
            registerHandlers: () => undefined
        };
    }

    return ctx;
}
