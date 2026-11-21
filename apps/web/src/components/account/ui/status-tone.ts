/**
 * Status vocabulary for the Mi Cuenta kit (HOS-2413 T-010).
 *
 * One table maps each domain's statuses to a tone, so every page that shows a
 * publication, moderation, subscription, promotion or benefit-usage status
 * speaks the same color language. The tones are the role tokens
 * `status-{tone}-*`; `plan` uses the `upsell-*` tokens. The WORD always comes
 * from i18n (`account.ui.status.<domain>.<STATUS>`): color is never the only
 * signal.
 *
 * @module components/account/ui/status-tone
 */

/** Tone of a pill. `plan` paints with the upsell tokens. */
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'plan';

/**
 * Domain to status to tone. Keys are the wire values of the domain's enum:
 * `LifecycleStatusEnum` (publication), `ModerationStatusEnum`,
 * `SUBSCRIPTION_STATUSES`, the owner-promotion lifecycle and
 * `HostTradeUsageStatusEnum` (benefitUsage).
 */
export const STATUS_TONES = {
    publication: {
        DRAFT: 'neutral',
        ACTIVE: 'success',
        INACTIVE: 'warning',
        ARCHIVED: 'neutral'
    },
    moderation: {
        PENDING: 'warning',
        APPROVED: 'success',
        REJECTED: 'danger'
    },
    subscription: {
        PENDING_AUTHORIZATION: 'info',
        ABANDONED: 'neutral',
        ACTIVE: 'success',
        GRACE_PERIOD: 'warning',
        PAUSED: 'neutral',
        SUSPENDED: 'danger',
        CANCEL_SCHEDULED: 'warning',
        CANCELLED: 'neutral',
        CHARGE_DECLINED: 'danger'
    },
    promotion: {
        DRAFT: 'neutral',
        SCHEDULED: 'info',
        ACTIVE: 'success',
        PAUSED: 'warning',
        EXPIRED: 'neutral'
    },
    benefitUsage: {
        PENDING: 'warning',
        CONFIRMED: 'success',
        REJECTED: 'danger',
        EXPIRED: 'neutral'
    }
} as const satisfies Record<string, Record<string, StatusTone>>;

/** A status domain. */
export type StatusDomain = keyof typeof STATUS_TONES;

/** The statuses of one domain. */
export type StatusOf<D extends StatusDomain> = keyof (typeof STATUS_TONES)[D] & string;

/**
 * Resolves the tone of a domain status.
 *
 * @param input - Options object.
 * @param input.domain - The status domain.
 * @param input.status - A status of that domain.
 * @returns The tone, or `neutral` for a status the table does not know.
 */
export function toneFor({
    domain,
    status
}: {
    readonly domain: StatusDomain;
    readonly status: string;
}): StatusTone {
    const table: Readonly<Record<string, StatusTone>> = STATUS_TONES[domain];
    return table[status] ?? 'neutral';
}

/**
 * Builds the i18n key of a domain status label.
 *
 * @param input - Options object.
 * @param input.domain - The status domain.
 * @param input.status - A status of that domain.
 * @returns e.g. `account.ui.status.moderation.PENDING`.
 */
export function statusLabelKey({
    domain,
    status
}: {
    readonly domain: StatusDomain;
    readonly status: string;
}): string {
    return `account.ui.status.${domain}.${status}`;
}
