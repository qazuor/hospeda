type Translator = (key: string, fallback?: string) => string;

/**
 * Minimal runtime plan shape required to localize a plan name.
 */
interface PlanLike {
    readonly slug: string;
    readonly name: string;
    /** Accepted so callers holding a full plan can pass it unchanged; not read here. */
    readonly description?: string;
}

/**
 * Get the localized human-readable name for a plan.
 *
 * Tries `billing.plan.<slug>.name`. Falls back to the English `plan.name` from
 * the billing config so missing translations never produce an empty card.
 */
export function getPlanName(input: { plan: PlanLike; t: Translator }): string {
    const { plan, t } = input;
    return t(`billing.plan.${plan.slug}.name`, plan.name);
}
