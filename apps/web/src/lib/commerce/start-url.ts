/**
 * @file start-url.ts
 * @description Destination of the "Empezar ahora" CTA on the two commerce
 * vertical landings (`/publicar-restaurante/`, `/publicar-experiencia/`) —
 * HOS-810.
 *
 * ## The loop this closes
 *
 * HOS-687 opened the permission on `mi-cuenta/comercio/nuevo/*` precisely so
 * the create form would stop being reachable "only by typing the URL" — the
 * "looks fixed, still closed" outcome its own docstring names. The lock came
 * off; the link never went on. The sidebar entry for "Mi comercio" appears
 * only once a listing exists, so the brand-new account — the only one that
 * needs to create the first — is exactly the one with no way to get there,
 * and the landing's CTA sent it to `/mi-cuenta/`, where the trail ended.
 *
 * ## Why the branch is not on the landing page
 *
 * The obvious shape — "if `Astro.locals.user`, link to the form, else link to
 * signup" — cannot be built on those landings. Both are edge-cached under the
 * `pricing` cache class and deliberately parse NO session (HOS-690 AC-37);
 * `cacheable-routes-parse-no-session.guard.test.ts` fails the build if either
 * family is put back on `SESSION_OPTIONAL_SEGMENTS`. A cached page cannot know
 * who is reading it, and personalising one would hand one visitor's HTML to
 * the next for the whole TTL.
 *
 * So the CTA stays a single constant href, and the session branch happens one
 * hop later on `/auth/signup/` — a route that already parses the session
 * (`AUTH_SEGMENTS`) and already redirects a signed-in visitor away. HOS-810
 * only taught it to honour a `returnUrl` while doing so:
 *
 * - **Signed in** → signup redirects straight to the vertical's create form.
 *   The loop is broken for the reported case.
 * - **Signed out** → signup renders its form, exactly as it did before. The
 *   top-of-funnel behaviour the landing was built around is untouched.
 *
 * ## Known gap (deliberately NOT closed here)
 *
 * The return destination does not survive a brand-new REGISTRATION. Signing up
 * creates no session — the API requires e-mail verification first — so the flow
 * goes signup → verify-email-sent → (inbox) → signin → `/mi-cuenta/`, and the
 * `returnUrl` is lost at the verification hop. Carrying it through would mean
 * threading state across the verification e-mail, which is a different piece of
 * work. What this module guarantees is that a visitor WITH a session (including
 * one who just verified and signed in, then clicked the CTA again) lands on the
 * form. The "already have an account" link on signup does forward the param, so
 * the existing-user path keeps its destination end to end.
 */

import type { SupportedLocale } from '../i18n';
import { buildUrl } from '../urls';
import type { CommerceVertical } from './owner-listings';

/**
 * Path of the owner self-service create form for one vertical, locale-prefixed.
 *
 * This is the page HOS-687 unlocked; it requires a session and nothing else.
 *
 * @param params.locale - Locale prefix.
 * @param params.vertical - `gastronomy` or `experience`.
 * @returns e.g. `/es/mi-cuenta/comercio/nuevo/experience/`.
 */
export function buildCommerceCreateUrl({
    locale,
    vertical
}: {
    readonly locale: SupportedLocale;
    readonly vertical: CommerceVertical;
}): string {
    return buildUrl({ locale, path: `mi-cuenta/comercio/nuevo/${vertical}` });
}

/**
 * Destination of the landing's "Empezar ahora" CTA: the signup page, carrying
 * the vertical's create form as its post-auth return destination.
 *
 * Constant per (locale, vertical) — it reads no session and is therefore safe
 * to render into an edge-cached page. See the module docstring for the whole
 * rationale.
 *
 * @param params.locale - Locale prefix.
 * @param params.vertical - `gastronomy` or `experience`.
 * @returns e.g.
 *   `/es/auth/signup/?returnUrl=%2Fes%2Fmi-cuenta%2Fcomercio%2Fnuevo%2Fexperience%2F`.
 */
export function buildCommerceStartUrl({
    locale,
    vertical
}: {
    readonly locale: SupportedLocale;
    readonly vertical: CommerceVertical;
}): string {
    const returnUrl = encodeURIComponent(buildCommerceCreateUrl({ locale, vertical }));
    return `${buildUrl({ locale, path: 'auth/signup' })}?returnUrl=${returnUrl}`;
}
