/**
 * DeferredWidget Component
 *
 * Reusable "coming soon" placeholder for dashboard card slots whose backend
 * data is deferred to a phase-2 spec (marked 🔴 in SPEC-155). Renders a
 * visually consistent card-sized surface using the established
 * `EMPTY_SURFACE_CLASS` vocabulary so it matches `ComingSoon` and `EmptyState`
 * styling (river dashed border, bg-card surface, Geologica title, centered
 * layout).
 *
 * Usage — drop inside any dashboard card slot that has no live data yet:
 *
 * @example
 * ```tsx
 * <DeferredWidget
 *   phaseSpec="SPEC-159"
 *   title="Vistas por alojamiento"
 *   description="Las métricas de vistas estarán disponibles cuando se implemente el sistema de tracking."
 * />
 * ```
 *
 * @module DeferredWidget
 */

import { EMPTY_SURFACE_CLASS } from '@/components/feedback/empty-surface';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import type { TranslationKey } from '@repo/i18n';
import { ClockIcon } from '@repo/icons';

/**
 * Props for the DeferredWidget component.
 * Follows the RO-RO pattern — single readonly props object.
 */
export interface DeferredWidgetProps {
    /**
     * Identifier of the phase-2 spec that will deliver this data slot.
     * Rendered as a badge next to the title so operators know what to expect.
     *
     * @example "SPEC-159"
     */
    readonly phaseSpec: string;

    /**
     * Optional human-readable title for the deferred slot.
     * Defaults to the generic "Próximamente" i18n key when omitted.
     */
    readonly title?: string;

    /**
     * Optional description explaining what this slot will show once the
     * phase-2 spec ships. Defaults to the generic "coming soon" description
     * when omitted.
     */
    readonly description?: string;

    /**
     * Additional Tailwind utility classes forwarded to the root container.
     * Useful for controlling height in mixed-slot cards (e.g., `min-h-[120px]`).
     */
    readonly className?: string;
}

/**
 * Renders a "coming soon" placeholder for dashboard slots awaiting a
 * phase-2 backend spec. Never throws; never blocks sibling slots.
 */
export function DeferredWidget({ phaseSpec, title, description, className }: DeferredWidgetProps) {
    const { t } = useTranslations();

    const displayTitle = title ?? t('admin-common.comingSoon.title' as TranslationKey);

    const displayDescription =
        description ?? t('admin-common.comingSoon.description' as TranslationKey);

    return (
        <div
            className={cn(EMPTY_SURFACE_CLASS, 'gap-2 p-6', className)}
            data-testid="deferred-widget"
            aria-label={`${displayTitle} — ${phaseSpec}`}
        >
            {/* Clock icon — signals "not ready yet" without being alarming */}
            <div
                className="text-primary"
                aria-hidden="true"
            >
                <ClockIcon className="h-6 w-6" />
            </div>

            <div className="flex flex-col items-center gap-1">
                <h3 className="font-heading font-semibold text-sm">{displayTitle}</h3>

                {/* Phase spec badge — shows which spec will deliver this */}
                <span
                    className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 font-mono text-primary text-xs"
                    data-testid="deferred-widget-spec-badge"
                >
                    {phaseSpec}
                </span>
            </div>

            <p className="max-w-xs text-center text-muted-foreground text-xs">
                {displayDescription}
            </p>
        </div>
    );
}
