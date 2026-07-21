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
 */

import type { HostOnboardingPrecheckDecision } from '@/lib/api/endpoints-protected';

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
    readonly actions: readonly PrecheckPanelAction[];
}

/**
 * Input for {@link resolvePrecheckPanelContent}.
 */
export interface ResolvePrecheckPanelContentParams {
    /** Any decision except `create_direct` (that one renders the form directly). */
    readonly decision: HostOnboardingPrecheckDecision;
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
    const { decision, editUrl, createUrl, accountPropertiesUrl, subscriptionUrl } = params;

    switch (decision) {
        case 'upgrade_only':
            return {
                titleKey: 'billing.limit.max_accommodations.atLimitPanel.title',
                titleFallback: 'Llegaste al límite de tu plan',
                bodyKey: 'billing.limit.max_accommodations.atLimitPanel.body',
                bodyFallback:
                    'Estás usando {{currentCount}} de {{maxAllowed}} propiedades. Para publicar otra, actualizá tu plan.',
                showQuota: true,
                actions: [
                    {
                        kind: 'link',
                        variant: 'primary',
                        href: subscriptionUrl,
                        labelKey: 'billing.limit.max_accommodations.atLimitPanel.primaryCta',
                        labelFallback: 'Ver mi suscripción'
                    },
                    {
                        kind: 'link',
                        variant: 'secondary',
                        href: accountPropertiesUrl,
                        labelKey: 'billing.limit.max_accommodations.atLimitPanel.secondaryCta',
                        labelFallback: 'Ver mis propiedades'
                    }
                ]
            };

        case 'resume_or_create':
            return {
                titleKey: 'host.pages.nueva.precheck.resumeOrCreate.title',
                titleFallback: 'Ya tenés un borrador en curso',
                bodyKey: 'host.pages.nueva.precheck.resumeOrCreate.body',
                bodyFallback:
                    'Tenés una propiedad sin publicar. Podés retomarla donde la dejaste o empezar una nueva desde cero.',
                showQuota: false,
                actions: [
                    {
                        kind: 'link',
                        variant: 'primary',
                        href: editUrl ?? accountPropertiesUrl,
                        labelKey: 'host.pages.nueva.precheck.resumeOrCreate.resumeCta',
                        labelFallback: 'Retomar borrador'
                    },
                    {
                        kind: 'link',
                        variant: 'secondary',
                        href: createUrl,
                        labelKey: 'host.pages.nueva.precheck.resumeOrCreate.createCta',
                        labelFallback: 'Crear uno nuevo'
                    }
                ]
            };

        case 'resume_delete_or_upgrade':
            return {
                titleKey: 'host.pages.nueva.precheck.resumeDeleteOrUpgrade.title',
                titleFallback: 'Tenés un borrador, pero llegaste al límite de tu plan',
                bodyKey: 'host.pages.nueva.precheck.resumeDeleteOrUpgrade.body',
                bodyFallback:
                    'Estás usando {{currentCount}} propiedades y tu plan permite {{maxAllowed}}. Podés retomar tu borrador, borrarlo para liberar lugar, o subir de plan.',
                showQuota: true,
                actions: [
                    {
                        kind: 'link',
                        variant: 'primary',
                        href: editUrl ?? accountPropertiesUrl,
                        labelKey: 'host.pages.nueva.precheck.resumeDeleteOrUpgrade.resumeCta',
                        labelFallback: 'Retomar borrador'
                    },
                    {
                        kind: 'delete-draft',
                        labelKey: 'host.pages.nueva.precheck.resumeDeleteOrUpgrade.deleteCta',
                        labelFallback: 'Borrar borrador',
                        confirmTextKey:
                            'host.pages.nueva.precheck.resumeDeleteOrUpgrade.deleteConfirm',
                        confirmTextFallback:
                            '¿Borrar este borrador? Vas a poder crear una propiedad nueva.'
                    },
                    {
                        kind: 'link',
                        variant: 'secondary',
                        href: subscriptionUrl,
                        labelKey: 'host.pages.nueva.precheck.resumeDeleteOrUpgrade.upgradeCta',
                        labelFallback: 'Subir de plan'
                    }
                ]
            };

        case 'pick_draft_or_create':
            return {
                titleKey: 'host.pages.nueva.precheck.pickDraftOrCreate.title',
                titleFallback: 'Tenés varios borradores sin publicar',
                bodyKey: 'host.pages.nueva.precheck.pickDraftOrCreate.body',
                bodyFallback:
                    'Elegí uno de tus borradores existentes para continuar, o empezá una propiedad nueva desde cero.',
                showQuota: false,
                actions: [
                    {
                        kind: 'link',
                        variant: 'primary',
                        href: createUrl,
                        labelKey: 'host.pages.nueva.precheck.pickDraftOrCreate.createCta',
                        labelFallback: 'Crear uno nuevo'
                    },
                    {
                        kind: 'link',
                        variant: 'secondary',
                        href: accountPropertiesUrl,
                        labelKey: 'host.pages.nueva.precheck.pickDraftOrCreate.pickCta',
                        labelFallback: 'Editar un borrador existente'
                    }
                ]
            };

        case 'pick_draft_delete_or_upgrade':
            return {
                titleKey: 'host.pages.nueva.precheck.pickDraftDeleteOrUpgrade.title',
                titleFallback: 'Tenés varios borradores, pero llegaste al límite de tu plan',
                bodyKey: 'host.pages.nueva.precheck.pickDraftDeleteOrUpgrade.body',
                bodyFallback:
                    'Estás usando {{currentCount}} propiedades y tu plan permite {{maxAllowed}}. Editá uno de tus borradores existentes o subí de plan para crear uno nuevo.',
                showQuota: true,
                actions: [
                    {
                        kind: 'link',
                        variant: 'primary',
                        href: accountPropertiesUrl,
                        labelKey: 'host.pages.nueva.precheck.pickDraftDeleteOrUpgrade.pickCta',
                        labelFallback: 'Editar un borrador existente'
                    },
                    {
                        kind: 'link',
                        variant: 'secondary',
                        href: subscriptionUrl,
                        labelKey: 'host.pages.nueva.precheck.pickDraftDeleteOrUpgrade.upgradeCta',
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
