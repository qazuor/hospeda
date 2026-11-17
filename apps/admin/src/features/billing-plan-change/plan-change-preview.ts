import { isMissingTranslation, type TranslationKey } from '@repo/i18n';

type Translate = (key: TranslationKey) => string;

/** Returns the localized plan name, falling back to the internal catalog name. */
export function planLabel(args: {
    readonly slug: string;
    readonly name: string;
    readonly t: Translate;
}): string {
    const key = `billing.plan.${args.slug}.name`;
    const translated = args.t(key as TranslationKey);
    return isMissingTranslation({ key, value: translated }) ? args.name : translated;
}

/** Returns the localized billing cycle label. */
export function cycleLabel(args: { readonly cycle: string; readonly t: Translate }): string {
    const key = `admin-billing.planCatalogEditor.cycles.${args.cycle}`;
    const translated = args.t(key as TranslationKey);
    return isMissingTranslation({ key, value: translated }) ? args.cycle : translated;
}

/** Derives the reviewed path from the catalog direction and billing cycles. */
export function resolvePlanChangePreview(args: {
    readonly direction: 'UP' | 'DOWN' | 'CYCLE' | 'NONE';
    readonly currentCycle: string | null;
    readonly targetCycle: string;
    readonly nextChargeAt: string | null;
}): { readonly mode: 'AT_CYCLE_END' | 'NEEDS_CHECKOUT'; readonly date: string | null } {
    if (args.direction === 'DOWN' && args.currentCycle === args.targetCycle) {
        return { mode: 'AT_CYCLE_END', date: args.nextChargeAt };
    }
    return { mode: 'NEEDS_CHECKOUT', date: null };
}
