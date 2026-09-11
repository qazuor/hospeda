/**
 * @file publish-page-slot.ts
 * @description What the three publish pages render where the form goes, and the
 * URLs that state needs (HOS-1156 T-017, §6).
 *
 * The slot has exactly three states, resolved in this order:
 *
 * | Visitor state                    | What renders                         |
 * | -------------------------------- | ------------------------------------ |
 * | No session                       | The signup CTA, returning here (D-1) |
 * | Session, `create_direct`         | The vertical's create form           |
 * | Session, any other decision      | The precheck panel                   |
 *
 * ## Three things this owns that a page must not re-derive
 *
 * **The fail-open (D-5).** Any precheck failure — a thrown fetch, a non-ok
 * response, a missing cookie — resolves to `create_direct`, i.e. the form. The
 * real cap lives server-side on the create endpoint, which answers 403
 * `LIMIT_REACHED` regardless of what this decided, so a transient failure here
 * costs an owner a friendlier dialog and never the limit itself. Failing CLOSED
 * would be the worse bug: it would show an upgrade panel to somebody with quota.
 *
 * **Never a redirect to login (D-1).** Both form pages this replaces called
 * `buildLoginRedirect` in their frontmatter, which drops a cold visitor onto a
 * login screen before they have read a word. These pages are reached from a
 * PUBLIC navbar button, so a signed-out visitor gets the whole page and a signup
 * CTA in the form's place.
 *
 * **Every URL is per-vertical.** The panel talks about a cap, offers to resume a
 * draft and links to "mis fichas"; all three differ per vertical, and a panel on
 * the gastronomy page that offered to resume a property would be worse than no
 * panel at all.
 *
 * @module lib/publish/publish-page-slot
 */

import type {
    HostOnboardingPrecheckDecision,
    HostOnboardingPrecheckDraft,
    PublishVerticalSlug
} from '@/lib/api/endpoints-protected';
import { publishApi } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { webLogger as logger } from '@/lib/logger';
import { buildUrl, buildUrlWithParams } from '@/lib/urls';
import { ACCOUNT_LISTINGS_PATH_BY_VERTICAL } from './publish-page-paths';

/** Which of the three §6 states the form slot is in. */
export type PublishSlotState = 'signup_cta' | 'form' | 'precheck_panel';

/**
 * Everything the slot component needs to render, whichever state it landed in.
 */
export interface PublishPageSlot {
    readonly state: PublishSlotState;
    /**
     * The precheck's decision. `create_direct` when signed out or when the
     * precheck failed — see the fail-open note in the module doc.
     */
    readonly decision: HostOnboardingPrecheckDecision;
    readonly currentCount: number;
    readonly maxAllowed: number;
    readonly drafts: ReadonlyArray<HostOnboardingPrecheckDraft>;
    /** Editor URL for `drafts[0]`; present only when there is exactly one draft. */
    readonly editUrl?: string;
    /** This page with `?create=1`, which bypasses the panel and renders the form. */
    readonly createUrl: string;
    /** This vertical's "my listings" page. */
    readonly accountListingsUrl: string;
    /** This vertical's subscription page. */
    readonly subscriptionUrl: string;
    /** Sign-up, returning to this same page (D-1). */
    readonly signupUrl: string;
    /** Sign-in, returning to this same page — for a visitor who already has an account. */
    readonly signinUrl: string;
}

/** Input for {@link resolvePublishPageSlot}. */
export interface ResolvePublishPageSlotParams {
    readonly locale: SupportedLocale;
    readonly vertical: PublishVerticalSlug;
    /** `Astro.locals.user` reduced to the only question this asks of it. */
    readonly isAuthenticated: boolean;
    /** Raw `Cookie` header of the SSR request, forwarded to the precheck. */
    readonly cookieHeader: string | null;
    /** This page's own path, e.g. `/es/publicar/gastronomia/`. */
    readonly pathname: string;
    /**
     * Whether the request carries `?create=1` — the panel's "crear uno nuevo"
     * action, honoured only for the two decisions that actually offer that
     * choice. NOT a security bypass: the create endpoint re-validates the cap.
     */
    readonly wantsCreate: boolean;
}

/**
 * Builds the editor URL for one draft of one vertical.
 *
 * The two shapes differ and neither is derivable from the other, so this is a
 * switch rather than a template with a variable segment.
 */
function buildDraftEditUrl(input: {
    readonly locale: SupportedLocale;
    readonly vertical: PublishVerticalSlug;
    readonly draftId: string;
}): string {
    const { locale, vertical, draftId } = input;

    if (vertical === 'accommodation') {
        return buildUrl({ locale, path: `mi-cuenta/propiedades/${draftId}/editar` });
    }
    return buildUrl({ locale, path: `mi-cuenta/comercio/${vertical}/${draftId}/editar` });
}

/**
 * The subscription page, scoped to the vertical's own billing domain.
 *
 * `/mi-cuenta/suscripcion/` defaults to the accommodation subscription and takes
 * `?domain=` for the others (HOS-689). Sending a commerce owner to the bare URL
 * would show them a page about a subscription they may not even hold.
 */
function buildSubscriptionUrl(input: {
    readonly locale: SupportedLocale;
    readonly vertical: PublishVerticalSlug;
}): string {
    const { locale, vertical } = input;

    if (vertical === 'accommodation') {
        return buildUrl({ locale, path: 'mi-cuenta/suscripcion' });
    }
    return buildUrlWithParams({
        locale,
        path: 'mi-cuenta/suscripcion',
        params: { domain: vertical }
    });
}

/**
 * Resolves which of the three states the form slot renders, and the URLs it
 * needs.
 *
 * @param params - See {@link ResolvePublishPageSlotParams}.
 * @returns The slot resolution. Never throws: every failure path lands on the
 *   form (D-5).
 *
 * @example
 * ```ts
 * const slot = await resolvePublishPageSlot({
 *   locale, vertical: 'gastronomy', isAuthenticated: Boolean(Astro.locals.user),
 *   cookieHeader: Astro.request.headers.get('cookie'),
 *   pathname: Astro.url.pathname,
 *   wantsCreate: Astro.url.searchParams.get('create') === '1'
 * });
 * ```
 */
export async function resolvePublishPageSlot(
    params: ResolvePublishPageSlotParams
): Promise<PublishPageSlot> {
    const { locale, vertical, isAuthenticated, cookieHeader, pathname, wantsCreate } = params;

    const returnUrl = encodeURIComponent(pathname);
    const urls = {
        createUrl: `${pathname}?create=1`,
        accountListingsUrl: buildUrl({
            locale,
            path: ACCOUNT_LISTINGS_PATH_BY_VERTICAL[vertical]
        }),
        subscriptionUrl: buildSubscriptionUrl({ locale, vertical }),
        signupUrl: `${buildUrl({ locale, path: 'auth/signup' })}?returnUrl=${returnUrl}`,
        signinUrl: `${buildUrl({ locale, path: 'auth/signin' })}?returnUrl=${returnUrl}`
    };

    // D-1: a signed-out visitor reads the whole page and is offered an account,
    // never bounced to a login screen. The precheck is not even attempted —
    // there is no session for it to answer about.
    if (!isAuthenticated) {
        return {
            state: 'signup_cta',
            decision: 'create_direct',
            currentCount: 0,
            maxAllowed: 0,
            drafts: [],
            ...urls
        };
    }

    let decision: HostOnboardingPrecheckDecision = 'create_direct';
    let currentCount = 0;
    let maxAllowed = 0;
    let drafts: ReadonlyArray<HostOnboardingPrecheckDraft> = [];

    try {
        if (cookieHeader) {
            const result = await publishApi.precheck({ vertical, cookieHeader });
            if (result.ok) {
                currentCount = result.data.currentCount;
                maxAllowed = result.data.maxAllowed;
                drafts = result.data.drafts;
                decision = result.data.decision;
            } else {
                logger.warn('publish slot: precheck returned an error', {
                    vertical,
                    error: result.error
                });
            }
        }
    } catch (error) {
        logger.warn('publish slot: precheck threw', { vertical, error });
    }

    // The `?create=1` bypass is honoured only where the panel actually offered
    // a "create new" choice. On the at-cap decisions it is ignored, so pasting
    // the URL cannot skip a panel that was never offering that option.
    const showForm =
        decision === 'create_direct' ||
        (wantsCreate && (decision === 'resume_or_create' || decision === 'pick_draft_or_create'));

    const firstDraft = drafts[0];

    return {
        state: showForm ? 'form' : 'precheck_panel',
        decision,
        currentCount,
        maxAllowed,
        drafts,
        editUrl: firstDraft
            ? buildDraftEditUrl({ locale, vertical, draftId: firstDraft.id })
            : undefined,
        ...urls
    };
}
