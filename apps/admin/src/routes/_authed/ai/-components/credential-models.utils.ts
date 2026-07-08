/**
 * @file credential-models.utils.ts
 * @description Pure helper reconciling the two parallel model-state stores
 * used by `CreateCredentialDialog` (BETA credential-models persist follow-up).
 *
 * `CreateCredentialDialog` tracks enabled/disabled models in two different
 * ways depending on whether a "Sincronizar modelos" preflight has run yet:
 *
 * - **Pre-sync**: the curated catalog (`known.models`) is rendered with
 *   `isEnabled = !disabledModels.includes(model)` — toggling a curated model
 *   off adds it to `disabledModels`. Custom models added via `addCustomModel`
 *   land in `selectedModels` and are ALSO toggled through `disabledModels` in
 *   this render branch.
 * - **Post-sync**: once `preflightMutation.data` exists, the merged catalog is
 *   rendered with `isEnabled = selectedModels.includes(model.id)` — toggling a
 *   model directly adds/removes it from `selectedModels` (`disabledModels` is
 *   not touched in this branch at all).
 *
 * `handleSubmit` only ever persisted `selectedModels` into `metadata.models`,
 * so the pre-sync branch's `disabledModels` toggles were silently ignored —
 * curated models the user never explicitly re-added to `selectedModels`
 * (which is most of them, since curated models start OUT of `selectedModels`
 * pre-sync) were dropped from the saved credential regardless of their
 * enabled/disabled switch state.
 *
 * `resolveCredentialModelsToPersist` reconciles both stores into the single
 * list that should actually be saved, based on which render branch was
 * active at submit time.
 */

/**
 * Computes the final list of model ids to persist into
 * `metadata.models` for a new AI credential.
 *
 * @param params.curatedModels - The provider's curated catalog
 *   (`known?.models ?? []`), in catalog order.
 * @param params.selectedModels - Custom-added models plus, once a preflight
 *   sync has run, the post-sync toggled-on models.
 * @param params.disabledModels - Curated/custom models explicitly toggled off
 *   in the PRE-sync render branch. Ignored once `hasSyncedPreview` is true,
 *   since that branch never writes to it.
 * @param params.hasSyncedPreview - Whether a "Sincronizar modelos" preflight
 *   has completed (`Boolean(preflightMutation.data)`), i.e. whether the
 *   POST-sync render branch is the one currently shown to the user.
 * @returns The deduped list of model ids to persist, curated-first then
 *   custom, preserving encounter order within each group.
 */
export function resolveCredentialModelsToPersist(params: {
    readonly curatedModels: readonly string[];
    readonly selectedModels: readonly string[];
    readonly disabledModels: readonly string[];
    readonly hasSyncedPreview: boolean;
}): string[] {
    const { curatedModels, selectedModels, disabledModels, hasSyncedPreview } = params;

    if (hasSyncedPreview) {
        return Array.from(new Set(selectedModels));
    }

    const customAdded = selectedModels.filter((m) => !curatedModels.includes(m));
    const enabled = [...curatedModels, ...customAdded].filter((m) => !disabledModels.includes(m));

    return Array.from(new Set(enabled));
}
