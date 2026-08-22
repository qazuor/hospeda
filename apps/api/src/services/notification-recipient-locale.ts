/**
 * Recipient locale resolution for outbound notification CTA links (HOS-722).
 *
 * Every add-on lifecycle email carries a CTA that deep-links into `apps/web`,
 * whose routes are locale-prefixed (`/{locale}/mi-cuenta/addons/`). The locale
 * segment therefore has to be resolved per RECIPIENT, not hardcoded — which is
 * exactly what all five add-on dispatch sites used to get wrong, every one of
 * them shipping a `/es/` link to English- and Portuguese-speaking hosts.
 *
 * This module exists so those five sites resolve the locale ONE way. The logic
 * originally lived as a private function inside `addon-expiry.job.ts`, which
 * covered its own three dispatches (expired, and the 3-day and 1-day warnings)
 * and left purchase and cancellation with no way to reach it — so in practice
 * those two did not resolve a locale at all.
 *
 * @module services/notification-recipient-locale
 */

import { UserModel } from '@repo/db';
import type { AddonLinkLocale } from '@repo/notifications';
import { apiLogger } from '../utils/logger.js';

/** Locale used when the recipient's preference is unknown or unsupported. */
export const DEFAULT_RECIPIENT_LOCALE: AddonLinkLocale = 'es';

/**
 * Lazily-created `UserModel` singleton.
 *
 * Deliberately NOT constructed at module scope: this module is imported by
 * `addon.checkout.ts` and `addon.user-addons.ts`, so an import-time `new
 * UserModel()` would force every existing consumer's `@repo/db` mock to grow a
 * `UserModel` export just to get past the import — turning a locale lookup that
 * most of those suites never reach into a load-time failure for all of them.
 */
let userModel: UserModel | null = null;

/**
 * Returns the shared `UserModel`, constructing it on first use.
 *
 * @returns The module's `UserModel` singleton.
 */
function getUserModel(): UserModel {
    if (!userModel) {
        userModel = new UserModel();
    }

    return userModel;
}

/**
 * Narrows an arbitrary stored value to a supported notification link locale.
 *
 * @param value - Candidate value, typically `users.settings.languageWeb`.
 * @returns Whether the value is one of `'es' | 'en' | 'pt'`.
 */
function isSupportedLocale(value: unknown): value is AddonLinkLocale {
    return value === 'es' || value === 'en' || value === 'pt';
}

/**
 * Resolves the recipient's preferred locale for a notification CTA link.
 *
 * Reads `users.settings.languageWeb` — the user's web-facing language
 * preference (`packages/schemas/src/entities/user/user.settings.schema.ts`) —
 * which is what a link into an `apps/web` route must match.
 *
 * Degrades to {@link DEFAULT_RECIPIENT_LOCALE} instead of throwing when
 * `userId` is `null` (a billing customer with no linked Hospeda user), when the
 * user does not exist, when the lookup fails, or when the stored value is
 * outside the three supported locales. A locale mismatch is cosmetic and is
 * never a reason to drop a notification.
 *
 * @param params - `{ userId }` Hospeda `users.id`, or `null` if unresolved.
 * @returns The recipient's preferred locale, or `'es'` as fallback.
 *
 * @example
 * ```ts
 * const locale = await resolveRecipientLocale({ userId: purchase.userId });
 * // => 'pt' for a Portuguese-speaking host, 'es' when unknown
 * ```
 */
export async function resolveRecipientLocale({
    userId
}: {
    readonly userId: string | null;
}): Promise<AddonLinkLocale> {
    if (!userId) {
        return DEFAULT_RECIPIENT_LOCALE;
    }

    try {
        const user = await getUserModel().findById(userId);
        const rawLocale = user?.settings?.languageWeb;

        return isSupportedLocale(rawLocale) ? rawLocale : DEFAULT_RECIPIENT_LOCALE;
    } catch (error) {
        apiLogger.warn(
            { userId, error: error instanceof Error ? error.message : String(error) },
            'Failed to resolve recipient locale for notification, defaulting to es'
        );
        return DEFAULT_RECIPIENT_LOCALE;
    }
}
