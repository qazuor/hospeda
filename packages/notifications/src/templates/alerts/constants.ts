/**
 * Shared constants for the alerts & offers daily digest email templates
 * (SPEC-286 T-009).
 *
 * @module templates/alerts/constants
 */

/**
 * Base site URL used to build every CTA link inside the alerts digest
 * (accommodation detail pages, the "manage my alerts" link, etc).
 *
 * KNOWN LIMITATION: every other multi-link template in this package receives
 * its base URL as a `baseUrl` prop supplied by the caller (see
 * `PurchaseConfirmation`, `TrialExpired`, `SubscriptionCancelled`, ...) so it
 * can be environment-driven (`HOSPEDA_SITE_URL`). `AlertDigestEmail` cannot
 * follow that convention: its only caller, `EmailAlertChannel.deliver()`
 * (SPEC-286 T-008), invokes it as `AlertDigestEmail(payload)` where `payload`
 * is typed exactly as `AlertDigestPayload` — and per the T-009 task scope,
 * neither `EmailAlertChannelDeps` nor `AlertDigestPayload` may gain a new
 * field to thread a real site URL through. A future spec that wants a real,
 * environment-driven base URL here should add a `siteUrl` to
 * `EmailAlertChannelDeps` (populated from `env.HOSPEDA_SITE_URL` at
 * construction, mirroring `NotificationService`'s `this.deps.siteUrl`) and
 * pass it down to `AlertDigestEmail` as an additional render-time argument.
 */
export const ALERT_DIGEST_SITE_BASE_URL = 'https://hospeda.com.ar';
