import { z } from 'zod';

/**
 * The URL schemes a user-authored outbound link may use. THE single source.
 *
 * Both sides of the contract read this list and nothing else:
 * - the WRITE side, through {@link safeExternalUrl} (what a request body may
 *   persist), and
 * - the READ side, through `resolveSafeExternalUrl` in `apps/web` (what may
 *   reach an `href`), which derives its `http:` / `https:` set from here.
 *
 * An allow-list, not a deny-list: naming `javascript:` and `data:` invites the
 * next scheme nobody thought of. A static guard in `apps/web`
 * (`outbound-href-sanitization`) forbids a second copy of this list.
 */
export const SAFE_EXTERNAL_URL_SCHEMES = ['http', 'https'] as const;

/** Zod's `protocol` option takes a regex tested against the bare scheme. */
export const SAFE_EXTERNAL_URL_PROTOCOL = new RegExp(`^(${SAFE_EXTERNAL_URL_SCHEMES.join('|')})$`);

/**
 * Validator for a user-authored third-party URL that will be stored and later
 * rendered into an `href` (HOS-703): a partner's website, a sponsor's link, a
 * social profile.
 *
 * `z.string().url()` does NOT restrict the scheme: `javascript:alert(1)`,
 * `data:text/html,...` and `vbscript:msgbox(1)` all parse as valid URLs, so the
 * payload would be stored and only the render-side sanitizer would stand
 * between it and a stored XSS. This makes the WRITE contract refuse it too.
 *
 * Apply it to INPUT (create / update / owner-edit) schemas only. A response or
 * shared entity schema must stay tolerant of rows already stored, because
 * tightening a read contract turns every bad legacy row into a permanent 500.
 *
 * Uses Zod's native `protocol` option rather than a `.refine()` so the field
 * stays a plain `ZodString` and `.pick()` / `.omit()` / `.partial()` keep
 * working on schemas that embed it.
 *
 * @param message - i18n key for the validation error.
 * @returns A Zod schema accepting only `http` / `https` URLs.
 */
export const safeExternalUrl = (message: string) =>
    z.url({ protocol: SAFE_EXTERNAL_URL_PROTOCOL, message });
