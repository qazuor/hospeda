import { z } from 'zod';
import { OneTimeAddonActivated } from '../../templates/billing/one-time-addon-activated.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';
import type { ListingNamesReader } from './vertical-listing-renderers.js';

/** Facts the API turns into localized copy (HOS-2405). */
export interface OneTimeAddonActivatedMailCopyInput {
    readonly locale: 'es' | 'en' | 'pt';
    readonly addonSlug: string;
    readonly addonName: string;
    /** The listing's name, or `null` when the add-on targets no listing. */
    readonly listingName: string | null;
    /** When the add-on ends, or `null` when it has no fixed end. */
    readonly endsAt: Date | null;
}

/** Localized copy of the mail. */
export interface OneTimeAddonActivatedMailCopy {
    readonly subject: string;
    readonly preview: string;
    readonly heading: string;
    readonly paragraphs: readonly string[];
    readonly cta: string;
}

/** Resolves the copy without coupling notifications to an i18n package. */
export type OneTimeAddonActivatedMailCopyResolver = (
    input: OneTimeAddonActivatedMailCopyInput
) => OneTimeAddonActivatedMailCopy;

const payloadSchema = z
    .strictObject({
        addonInstanceId: z.string().min(1),
        locale: z.enum(['es', 'en', 'pt']),
        addonSlug: z.string().min(1),
        addonName: z.string().min(1),
        listingId: z.string().min(1).nullable(),
        vertical: z.enum(['accommodation', 'venue', 'experience']).nullable(),
        endsAt: z.iso.datetime().nullable()
    })
    .refine((payload) => (payload.listingId === null) === (payload.vertical === null));

/** Renderer of `billing.one-time-addon-activated`. */
export function createBillingOneTimeAddonActivatedRenderers(input: {
    readonly siteUrl: string;
    readonly readListingNames: ListingNamesReader;
    readonly resolveCopy: OneTimeAddonActivatedMailCopyResolver;
}): Readonly<Record<string, OutboxMailRenderer>> {
    return {
        'billing.one-time-addon-activated': async ({ row }) => {
            const parsed = payloadSchema.safeParse(row.payload);
            if (!parsed.success) throw new TypeError('Invalid one-time add-on activated payload');
            const { locale, addonSlug, addonName, listingId, vertical, endsAt } = parsed.data;
            let listingName: string | null = null;
            if (listingId !== null && vertical !== null) {
                const found = (await input.readListingNames({ vertical, ids: [listingId] })).get(
                    listingId
                );
                if (typeof found !== 'string' || found.trim() === '')
                    throw new TypeError(`La ficha ${listingId} no tiene nombre para el aviso`);
                listingName = found;
            }
            const copy = input.resolveCopy({
                locale,
                addonSlug,
                addonName,
                listingName,
                endsAt: endsAt === null ? null : new Date(endsAt)
            });
            return {
                subject: copy.subject,
                react: (
                    <OneTimeAddonActivated
                        {...copy}
                        baseUrl={input.siteUrl.replace(/\/$/, '')}
                        locale={locale}
                    />
                )
            };
        }
    };
}
