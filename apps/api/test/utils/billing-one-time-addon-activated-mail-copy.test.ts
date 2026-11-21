import type { EmailOutboxRow } from '@repo/db';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import enBilling from '../../../../packages/i18n/src/locales/en/billing.json';
import enNotifications from '../../../../packages/i18n/src/locales/en/notifications.json';
import esBilling from '../../../../packages/i18n/src/locales/es/billing.json';
import esNotifications from '../../../../packages/i18n/src/locales/es/notifications.json';
import ptBilling from '../../../../packages/i18n/src/locales/pt/billing.json';
import ptNotifications from '../../../../packages/i18n/src/locales/pt/notifications.json';
import { buildOutboxSenderRender } from '../../src/cron/jobs/email-outbox-sender.job.js';
import { resolveOneTimeAddonActivatedMailCopy } from '../../src/utils/billing-one-time-addon-activated-mail-copy.js';

const locales = {
    es: { notifications: esNotifications, billing: esBilling },
    en: { notifications: enNotifications, billing: enBilling },
    pt: { notifications: ptNotifications, billing: ptBilling }
} as const;

const LISTING_NAME = 'Cabañas del Río';

const base = {
    locale: 'es' as const,
    addonSlug: 'visibility-boost-7d',
    addonName: 'Stored name',
    listingName: LISTING_NAME,
    endsAt: new Date('2026-11-27T15:00:00.000Z')
};

function row(payload: Record<string, unknown>): EmailOutboxRow {
    return {
        id: 'outbox-addon-activated',
        recipientUserId: 'user-1',
        recipientEmail: 'owner@example.test',
        template: 'billing.one-time-addon-activated',
        channel: 'email',
        payload,
        sendAfter: null,
        status: 'processing',
        dedupKey: 'addon-activated',
        lockedBy: 'test',
        lockedUntil: new Date('2026-11-20T12:05:00.000Z'),
        attempts: 0,
        providerMessageId: null,
        lastError: null,
        correlationId: null,
        createdAt: new Date('2026-11-20T12:00:00.000Z'),
        updatedAt: new Date('2026-11-20T12:00:00.000Z')
    };
}

const escapeHtml = (value: string) => value.replaceAll('&', '&amp;');

describe('HOS-2405 one-time add-on activated mail copy', () => {
    it.each([
        'es',
        'en',
        'pt'
    ] as const)('renders the %s mail through the production sender naming add-on, listing and expiry', async (locale) => {
        // Arrange
        const render = buildOutboxSenderRender({
            siteUrl: 'https://hospeda.test',
            readListingNames: async ({ ids }) => new Map(ids.map((id) => [id, LISTING_NAME]))
        });
        const copy = locales[locale];
        const product = copy.billing.addon['visibility-boost-7d'].name;
        const expected = resolveOneTimeAddonActivatedMailCopy({ ...base, locale });

        // Act
        const result = await render({
            row: row({
                addonInstanceId: 'instance-1',
                locale,
                addonSlug: base.addonSlug,
                addonName: base.addonName,
                listingId: 'listing-1',
                vertical: 'accommodation',
                endsAt: base.endsAt.toISOString()
            })
        });
        const html = renderToStaticMarkup(result.react);

        // Assert
        expect(result.subject).toBe(copy.notifications.oneTimeAddonActivated.subject);
        expect(html).toContain(escapeHtml(copy.notifications.oneTimeAddonActivated.heading));
        expect(html).toContain(
            escapeHtml(
                copy.notifications.oneTimeAddonActivated.intro
                    .replace('{{product}}', product)
                    .replace('{{listing}}', LISTING_NAME)
            )
        );
        expect(html).toContain(escapeHtml(expected.paragraphs[1] ?? 'missing expiry'));
        expect(html).toContain(copy.notifications.oneTimeAddonActivated.cta);
        expect(html).toContain(`https://hospeda.test/${locale}/mi-cuenta/complementos/`);
        expect(html).not.toContain('{{');
    });

    it.each([
        ['es', 'Vence el 27 de noviembre de 2026.'],
        ['en', 'It ends on November 27, 2026.'],
        ['pt', 'Vence em 27 de novembro de 2026.']
    ] as const)('formats the expiry as a local date in %s', (locale, expected) => {
        // Arrange
        // Act
        const copy = resolveOneTimeAddonActivatedMailCopy({ ...base, locale });
        // Assert
        expect(copy.paragraphs[1]).toBe(expected);
    });

    it('uses the market-local day of the expiry, not the UTC one', () => {
        // Arrange: 02:00 UTC on the 28th is still the 27th in Buenos Aires.
        // Act
        const copy = resolveOneTimeAddonActivatedMailCopy({
            ...base,
            endsAt: new Date('2026-11-28T02:00:00.000Z')
        });
        // Assert
        expect(copy.paragraphs[1]).toBe('Vence el 27 de noviembre de 2026.');
    });

    it('names the add-on from the catalog copy and falls back to the stored name', () => {
        // Arrange
        // Act
        const catalog = resolveOneTimeAddonActivatedMailCopy(base);
        const fallback = resolveOneTimeAddonActivatedMailCopy({
            ...base,
            addonSlug: 'not-an-addon'
        });
        // Assert
        expect(catalog.paragraphs[0]).toBe(
            `Ya está activo ${esBilling.addon['visibility-boost-7d'].name} en ${LISTING_NAME}.`
        );
        expect(fallback.paragraphs[0]).toContain('Stored name');
    });

    it('drops the listing and the expiry lines when the add-on has neither', () => {
        // Arrange
        // Act
        const copy = resolveOneTimeAddonActivatedMailCopy({
            ...base,
            listingName: null,
            endsAt: null
        });
        // Assert
        expect(copy.paragraphs).toEqual([
            `Ya está activo ${esBilling.addon['visibility-boost-7d'].name}.`,
            esNotifications.oneTimeAddonActivated.closing
        ]);
    });
});
