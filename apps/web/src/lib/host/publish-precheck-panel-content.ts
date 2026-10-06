/**
 * @file publish-precheck-panel-content.ts
 * @description Pure decision → dialog content mapping for the "publicar
 * nueva" host-onboarding precheck (BETA-197).
 *
 * `GET /api/v1/protected/host-onboarding/precheck` returns one of six
 * decisions (see `HostOnboardingPrecheckDecision` in
 * `@/lib/api/endpoints-protected`). This module derives, for every decision
 * except `create_direct` (which renders the onboarding form directly, no
 * panel), which title/body copy and which actions the "publicar nueva" page
 * should show BEFORE the onboarding form — the actual dialog/panel matrix
 * described in the BETA-197 spec.
 *
 * Kept as a pure function (no i18n, no DOM, no fetch) so the decision logic
 * is unit-testable in isolation; `PublishPrecheckPanel.astro` is the only
 * consumer and is responsible for resolving `labelKey`/`titleKey`/etc.
 * through `t()` and rendering the actual markup.
 *
 * HOS-1352: transitional until V3 (HOS-1357), see PR: cap offers are
 * unavailable while the replacement effective-limit contract is being built.
 */

import type { HostOnboardingPrecheckDecision } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';

/**
 * The verticals reachable from the header's "Publicar" menu.
 */
export type PublishVertical = 'accommodation' | 'gastronomy' | 'experience';

/**
 * Per-vertical copy: which i18n namespace holds this vertical's draft-panel
 * strings, and what it calls the thing being published.
 *
 * Accommodation keeps `host.pages.nueva.precheck.*` — the keys that shipped with
 * BETA-197. Renaming them would have been a pure i18n migration with no
 * user-visible gain, and the guards that check i18n see structure rather than
 * content, so a half-finished rename would have gone unnoticed.
 *
 * Those keys are live in three locales, but only since this file was
 * generalised: BETA-197 shipped **fourteen of the eighteen as inline fallbacks
 * and no locale entry at all**, so the Spanish literal was served under /en and
 * /pt too. That was survivable only while the fallback sat in a literal
 * `t(key, fallback)` call that `scripts/i18n-fallback-inventory.json` could
 * see. Moving the copy into returned `labelKey` + `labelFallback` DATA — which
 * is what made one mapper serve three verticals — took those fourteen sites out
 * of the inventory's reach, so the debt was written into the locales instead of
 * being trimmed off the list. Anything added here follows the same rule: the
 * fallback is a safety net for a missing key, never the shipping copy.
 *
 * `noun` exists because the FALLBACK text has to read correctly for a vertical
 * whose key is not translated yet. "Tenés una propiedad sin publicar" is simply
 * wrong on the gastronomy page, and a fallback that is wrong is worse than one
 * that is generic.
 *
 * **All three nouns are feminine, and the fallbacks below depend on it**
 * ("Tenés UNA {noun} sin publicar", "crear una {noun} NUEVA"). A masculine noun
 * added here would produce "una comercio nueva" — grammatically wrong in the one
 * place a reader is already blocked. Adding one means writing its fallbacks with
 * agreement, not just extending this map.
 */
const PRECHECK_COPY: Readonly<
    Record<
        PublishVertical,
        { readonly ns: string; readonly noun: string; readonly nounPlural: string }
    >
> = {
    accommodation: {
        ns: 'host.pages.nueva.precheck',
        noun: 'propiedad',
        nounPlural: 'propiedades'
    },
    gastronomy: { ns: 'publish.precheck.gastronomy', noun: 'ficha', nounPlural: 'fichas' },
    experience: {
        ns: 'publish.precheck.experience',
        noun: 'experiencia',
        nounPlural: 'experiencias'
    }
};

/** Retained locale key segments from the former publish-limit map. */
const LIMIT_KEY_BY_PUBLISH_VERTICAL: Readonly<Record<PublishVertical, string>> = {
    accommodation: 'max_accommodations',
    gastronomy: 'max_gastronomies',
    experience: 'max_experiences'
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A plain navigation action — rendered as an `<a href>`.
 */
export interface PrecheckPanelLinkAction {
    readonly kind: 'link';
    /** Visual weight: `primary` (accent CTA) or `secondary` (text link). */
    readonly variant: 'primary' | 'secondary';
    readonly href: string;
    readonly labelKey: string;
    readonly labelFallback: string;
}

/**
 * The "Borrar borrador" action — rendered via the existing `DeleteButton`
 * island (soft-deletes the DRAFT, then reloads so the precheck re-derives
 * `create_direct` once quota is freed). Carries no `href`; the consumer
 * supplies the accommodation id separately.
 */
export interface PrecheckPanelDeleteAction {
    readonly kind: 'delete-draft';
    readonly labelKey: string;
    readonly labelFallback: string;
    readonly confirmTextKey: string;
    readonly confirmTextFallback: string;
}

export type PrecheckPanelAction = PrecheckPanelLinkAction | PrecheckPanelDeleteAction;

/**
 * Resolved content for one non-`create_direct` decision.
 */
export interface PrecheckPanelContent {
    readonly titleKey: string;
    readonly titleFallback: string;
    readonly bodyKey: string;
    readonly bodyFallback: string;
    /** Whether the body should be interpolated with `{{currentCount}}`/`{{maxAllowed}}`. */
    readonly showQuota: boolean;
    /**
     * Which quota number the body's `_one`/`_other` plural form is keyed on.
     * `undefined` when `showQuota` is `false` (no plural resolution needed).
     * `'currentCount'` when the noun immediately follows the current count
     * (e.g. "Estás usando {{currentCount}} propiedades..."); `'maxAllowed'`
     * when it follows the plan's cap in an "X of Y noun" construction (e.g.
     * "...de {{maxAllowed}} propiedades.").
     */
    readonly bodyPluralBasis?: 'currentCount' | 'maxAllowed';
    readonly actions: readonly PrecheckPanelAction[];
}

/**
 * Input for {@link resolvePrecheckPanelContent}.
 */
export interface ResolvePrecheckPanelContentParams {
    /** Any decision except `create_direct` (that one renders the form directly). */
    readonly decision: HostOnboardingPrecheckDecision;
    /** Active locale retained for the caller contract. */
    readonly locale: SupportedLocale;
    /**
     * Which vertical is being published (HOS-1156 T-013).
     *
     * Selects the copy namespace. Defaults to `'accommodation'` for callers
     * that predate this parameter.
     */
    readonly vertical?: PublishVertical;
    /**
     * Edit URL for the actor's single DRAFT (`drafts[0]`). Required for
     * `resume_or_create` / `resume_delete_or_upgrade` (draftCount === 1);
     * unused otherwise.
     */
    readonly editUrl?: string;
    /** Current page URL with `?create=1` appended — bypasses the panel to render the form. */
    readonly createUrl: string;
    /** "Mis propiedades" listing — where the user picks among several DRAFTs. */
    readonly accountPropertiesUrl: string;
    /** Plan upgrade / subscription page. */
    readonly subscriptionUrl: string;
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Derives the panel title/body/actions for a given precheck decision.
 *
 * `create_direct` is intentionally unsupported (throws) — the caller must
 * branch on `decision === 'create_direct'` and render the onboarding form
 * directly instead of calling this function.
 *
 * @param params - See {@link ResolvePrecheckPanelContentParams}.
 * @returns The content to render for the decision's panel.
 *
 * @example
 * ```ts
 * const content = resolvePrecheckPanelContent({
 *   decision: 'resume_or_create',
 *   locale: 'es',
 *   editUrl: '/es/mi-cuenta/propiedades/acc-1/editar/',
 *   createUrl: '/es/publicar/nueva/?create=1',
 *   accountPropertiesUrl: '/es/mi-cuenta/propiedades/',
 *   subscriptionUrl: '/es/mi-cuenta/suscripcion/'
 * });
 * ```
 */
export function resolvePrecheckPanelContent(
    params: ResolvePrecheckPanelContentParams
): PrecheckPanelContent {
    const {
        decision,
        locale: _locale,
        editUrl,
        createUrl,
        accountPropertiesUrl,
        subscriptionUrl,
        vertical = 'accommodation'
    } = params;

    const { ns, noun, nounPlural } = PRECHECK_COPY[vertical];
    const limitKey = LIMIT_KEY_BY_PUBLISH_VERTICAL[vertical];

    // HOS-1352: transitional until V3 (HOS-1357), see PR: no plan-cap add-on is offered before effective limits exist.

    switch (decision) {
        case 'upgrade_only':
            return {
                titleKey: `billing.limit.${limitKey}.atLimitPanel.title`,
                titleFallback: 'Llegaste al límite de tu plan',
                bodyKey: `billing.limit.${limitKey}.atLimitPanel.body`,
                bodyFallback: `Estás usando {{currentCount}} de {{maxAllowed}} ${nounPlural}. Para publicar otra, actualizá tu plan.`,
                showQuota: true,
                bodyPluralBasis: 'maxAllowed',
                actions: [
                    {
                        kind: 'link',
                        variant: 'primary',
                        href: subscriptionUrl,
                        labelKey: `billing.limit.${limitKey}.atLimitPanel.primaryCta`,
                        labelFallback: 'Ver mi suscripción'
                    },
                    {
                        kind: 'link',
                        variant: 'secondary',
                        href: accountPropertiesUrl,
                        labelKey: `billing.limit.${limitKey}.atLimitPanel.secondaryCta`,
                        labelFallback: `Ver mis ${nounPlural}`
                    }
                ]
            };

        case 'resume_or_create':
            return {
                titleKey: `${ns}.resumeOrCreate.title`,
                titleFallback: 'Ya tenés un borrador en curso',
                bodyKey: `${ns}.resumeOrCreate.body`,
                bodyFallback: `Tenés una ${noun} sin publicar. Podés retomarla donde la dejaste o empezar una nueva desde cero.`,
                showQuota: false,
                actions: [
                    {
                        kind: 'link',
                        variant: 'primary',
                        href: editUrl ?? accountPropertiesUrl,
                        labelKey: `${ns}.resumeOrCreate.resumeCta`,
                        labelFallback: 'Retomar borrador'
                    },
                    {
                        kind: 'link',
                        variant: 'secondary',
                        href: createUrl,
                        labelKey: `${ns}.resumeOrCreate.createCta`,
                        labelFallback: 'Crear uno nuevo'
                    }
                ]
            };

        case 'resume_delete_or_upgrade':
            return {
                titleKey: `${ns}.resumeDeleteOrUpgrade.title`,
                titleFallback: 'Tenés un borrador, pero llegaste al límite de tu plan',
                bodyKey: `${ns}.resumeDeleteOrUpgrade.body`,
                bodyFallback: `Estás usando {{currentCount}} ${nounPlural} y tu plan permite {{maxAllowed}}. Podés retomar tu borrador, borrarlo para liberar lugar, o subir de plan.`,
                showQuota: true,
                bodyPluralBasis: 'currentCount',
                actions: [
                    {
                        kind: 'link',
                        variant: 'primary',
                        href: editUrl ?? accountPropertiesUrl,
                        labelKey: `${ns}.resumeDeleteOrUpgrade.resumeCta`,
                        labelFallback: 'Retomar borrador'
                    },
                    {
                        kind: 'delete-draft',
                        labelKey: `${ns}.resumeDeleteOrUpgrade.deleteCta`,
                        labelFallback: 'Borrar borrador',
                        confirmTextKey: `${ns}.resumeDeleteOrUpgrade.deleteConfirm`,
                        confirmTextFallback: `¿Borrar este borrador? Vas a poder crear una ${noun} nueva.`
                    },
                    {
                        kind: 'link',
                        variant: 'secondary',
                        href: subscriptionUrl,
                        labelKey: `${ns}.resumeDeleteOrUpgrade.upgradeCta`,
                        labelFallback: 'Subir de plan'
                    }
                ]
            };

        case 'pick_draft_or_create':
            return {
                titleKey: `${ns}.pickDraftOrCreate.title`,
                titleFallback: 'Tenés varios borradores sin publicar',
                bodyKey: `${ns}.pickDraftOrCreate.body`,
                bodyFallback: `Elegí uno de tus borradores existentes para continuar, o empezá una ${noun} nueva desde cero.`,
                showQuota: false,
                actions: [
                    {
                        kind: 'link',
                        variant: 'primary',
                        href: createUrl,
                        labelKey: `${ns}.pickDraftOrCreate.createCta`,
                        labelFallback: 'Crear uno nuevo'
                    },
                    {
                        kind: 'link',
                        variant: 'secondary',
                        href: accountPropertiesUrl,
                        labelKey: `${ns}.pickDraftOrCreate.pickCta`,
                        labelFallback: 'Editar un borrador existente'
                    }
                ]
            };

        case 'pick_draft_delete_or_upgrade':
            return {
                titleKey: `${ns}.pickDraftDeleteOrUpgrade.title`,
                titleFallback: 'Tenés varios borradores, pero llegaste al límite de tu plan',
                bodyKey: `${ns}.pickDraftDeleteOrUpgrade.body`,
                bodyFallback: `Estás usando {{currentCount}} ${nounPlural} y tu plan permite {{maxAllowed}}. Editá uno de tus borradores existentes o subí de plan para crear uno nuevo.`,
                showQuota: true,
                bodyPluralBasis: 'currentCount',
                actions: [
                    {
                        kind: 'link',
                        variant: 'primary',
                        href: accountPropertiesUrl,
                        labelKey: `${ns}.pickDraftDeleteOrUpgrade.pickCta`,
                        labelFallback: 'Editar un borrador existente'
                    },
                    {
                        kind: 'link',
                        variant: 'secondary',
                        href: subscriptionUrl,
                        labelKey: `${ns}.pickDraftDeleteOrUpgrade.upgradeCta`,
                        labelFallback: 'Subir de plan'
                    }
                ]
            };

        case 'create_direct':
            throw new Error(
                'resolvePrecheckPanelContent: create_direct renders the onboarding form directly, it has no panel content.'
            );

        default: {
            const exhaustiveCheck: never = decision;
            throw new Error(
                `resolvePrecheckPanelContent: unhandled decision "${String(exhaustiveCheck)}"`
            );
        }
    }
}
