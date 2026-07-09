/**
 * @file ai-settings-provider.utils.ts
 * @description Pure helpers for the "Proveedor principal" selects on the AI
 * settings page (BETA-130).
 *
 * Root cause of the bug: each feature's `primaryProvider` select only listed
 * `credentials`-derived provider ids. Every feature defaults to `'stub'` (a
 * built-in provider with no credential row), so the saved value was never
 * present in the option list and Radix `Select` rendered empty instead of
 * showing the actual saved provider.
 *
 * `buildProviderOptions` fixes this by always including the built-in `stub`
 * provider and the feature's current value in the option list, so the select
 * can always match and render the saved value.
 *
 * `applyProviderToAllFeatures` backs the "Apply to all features" bulk
 * control: it pushes one provider id onto every feature's `primaryProvider`
 * form field without touching any other field (model, params, enabled).
 */

import type { AiFeatureId, AiProviderId, AiProvidersMap } from '@/features/ai-settings';
import { getProviderLabel } from '@/features/ai-settings';

/** A single option for a "Proveedor principal" select. */
export interface ProviderOption {
    readonly value: AiProviderId;
    readonly label: string;
}

/**
 * Builds the deduped list of provider options for a "Proveedor principal"
 * select.
 *
 * The option list is the union of:
 * - every credentialed provider id (`knownProviders`),
 * - the built-in `stub` provider (always available, no credential needed),
 * - the field's current value (so a legacy/orphaned provider id already
 *   saved is never rendered as an empty select).
 *
 * Labels are decorated with a "(prueba)" marker for `stub` and a
 * "(deshabilitado)" marker for any provider whose `enabled` flag in
 * `providers` is explicitly `false`. Disabled providers are NOT removed from
 * the list — only marked — so the user can still see (and change away from)
 * a disabled selection.
 *
 * @param params.knownProviders - Provider ids with a saved credential.
 * @param params.currentValue - The feature's current `primaryProvider` value.
 * @param params.providers - The form's current `providers` map (for the
 *   enabled/disabled marker).
 * @returns The deduped, labeled option list, in encounter order.
 */
export function buildProviderOptions(params: {
    readonly knownProviders: readonly AiProviderId[];
    readonly currentValue: AiProviderId;
    readonly providers: AiProvidersMap;
}): ProviderOption[] {
    const { knownProviders, currentValue, providers } = params;

    // Radix `<Select.Item />` throws if any item has an empty-string value
    // (it reserves "" to clear the selection). A feature's `primaryProvider`
    // can be transiently empty during a form reset, and a saved blob may
    // carry an empty value; filter those out so the option list is always
    // renderable.
    const ids = Array.from(new Set<AiProviderId>([...knownProviders, 'stub', currentValue])).filter(
        (id) => id !== ('' as AiProviderId)
    );

    return ids.map((id) => {
        const isStub = id === 'stub';
        const isDisabled = providers[id]?.enabled === false;

        let label = getProviderLabel(id);
        if (isStub) label = `${label} (prueba)`;
        if (isDisabled) label = `${label} (deshabilitado)`;

        return { value: id, label };
    });
}

/**
 * Filters a provider's model list down to the values Radix `<Select.Item />`
 * can actually render.
 *
 * Radix reserves the empty string `""` to clear a `Select`'s value and throws
 * if any item carries it. A credential's model list can contain blank/
 * whitespace-only entries (a saved blob with an empty slot, or a trailing
 * comma in a manually edited list), so those must be dropped before the list
 * is mapped to `<Select.Item />`s. When the result is empty the caller falls
 * back to a free-text `<Input />` instead of a model select.
 *
 * @param models - The raw model ids for the selected provider.
 * @returns The models safe to render as select items, in encounter order.
 */
export function filterRenderableModels(models: readonly string[]): string[] {
    return models.filter((model) => model.trim() !== '');
}

/** Minimal shape of a TanStack Form instance needed to apply a bulk update. */
export interface ProviderFieldSetter {
    setFieldValue(field: string, value: AiProviderId): void;
}

/**
 * Sets `primaryProvider` to `providerId` on every feature in `featureIds`,
 * via the form's `setFieldValue`. Leaves every other field (`enabled`,
 * `model`, `params`, `fallbackChain`) untouched — this powers the "Apply to
 * all features" bulk control, which does NOT auto-save (the user still
 * reviews and clicks "Guardar").
 *
 * @param params.form - Any object exposing `setFieldValue` (the real
 *   TanStack Form instance in production, a spy in tests).
 * @param params.providerId - The provider id to apply to every feature.
 * @param params.featureIds - The feature ids to update.
 */
export function applyProviderToAllFeatures(params: {
    readonly form: ProviderFieldSetter;
    readonly providerId: AiProviderId;
    readonly featureIds: readonly AiFeatureId[];
}): void {
    const { form, providerId, featureIds } = params;
    for (const featureId of featureIds) {
        form.setFieldValue(`features.${featureId}.primaryProvider`, providerId);
    }
}
