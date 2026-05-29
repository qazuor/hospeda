import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import { CrownIcon } from '@repo/icons';
import * as React from 'react';

export interface PremiumBlockItem {
    /** Stable id for React keys. */
    readonly id: string;
    /** Display label (already localised). */
    readonly label: string;
    /**
     * Optional one-line description shown under the label so the host
     * understands what the feature unlocks before deciding to upgrade.
     */
    readonly description?: string;
}

export interface PremiumBlockProps {
    /**
     * Items to surface as "available on a higher plan". Pass `[]` to skip
     * rendering entirely (the component returns null).
     */
    readonly items: readonly PremiumBlockItem[];
    /** Override the "Mejorar plan" CTA destination. */
    readonly upgradeUrl?: string;
    /** Additional CSS classes applied to the wrapper. */
    readonly className?: string;
}

/**
 * Bottom-of-section premium upsell (spec §4.7 sabor 1: "Feature gate puntual...
 * bloque agrupado con descripción + botón 'Mejorar plan'. NO intercalado
 * entre campos editables").
 *
 * Previously, fields with an `entitlementKey` were wrapped inline in
 * `PlanEntitlementGate`, so the upsell box sat IN the grid alongside
 * editable fields — disruptive and visually noisy. EntityFormSection now
 * collects every gated field a HOST user lacks and renders them as
 * grouped items here, at the end of the section. Hosts WITH the
 * entitlement see the field in its natural place; staff see every field
 * and never see this block.
 *
 * One CTA per block (not per item) because the upgrade flow is the same
 * regardless of which feature pulled the host here.
 */
export const PremiumBlock = React.memo(function PremiumBlockComponent({
    items,
    upgradeUrl,
    className
}: PremiumBlockProps) {
    const { t } = useTranslations();

    if (items.length === 0) return null;

    const resolvedUpgradeUrl = upgradeUrl ?? '/billing/my-plan';

    return (
        <div
            className={cn('rounded-lg border border-warning/30 bg-warning/5 p-4', className)}
            data-testid="premium-block"
        >
            <div className="flex items-start gap-3">
                <div
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-warning/15"
                    aria-hidden="true"
                >
                    <CrownIcon className="h-5 w-5 text-warning" />
                </div>
                <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-foreground text-sm">
                        {t('admin-entities.premiumBlock.title')}
                    </h4>
                    <p className="mt-0.5 text-muted-foreground text-xs">
                        {t('admin-entities.premiumBlock.description')}
                    </p>
                    <ul className="mt-3 space-y-2">
                        {items.map((item) => (
                            <li
                                key={item.id}
                                className="flex items-start gap-2"
                                data-testid={`premium-block-item-${item.id}`}
                            >
                                <span
                                    className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-warning"
                                    aria-hidden="true"
                                />
                                <div className="min-w-0">
                                    <p className="font-medium text-foreground text-sm">
                                        {item.label}
                                    </p>
                                    {item.description && (
                                        <p className="text-muted-foreground text-xs">
                                            {item.description}
                                        </p>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                    <a
                        href={resolvedUpgradeUrl}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-xs hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                        <CrownIcon
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                        />
                        {t('admin-entities.premiumBlock.cta')}
                    </a>
                </div>
            </div>
        </div>
    );
});

PremiumBlock.displayName = 'PremiumBlock';
