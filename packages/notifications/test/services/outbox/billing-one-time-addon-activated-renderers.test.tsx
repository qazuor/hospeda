import type { EmailOutboxRow } from '@repo/db';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type {
    OneTimeAddonActivatedMailCopy,
    OneTimeAddonActivatedMailCopyInput
} from '../../../src/services/outbox/billing-one-time-addon-activated-renderers.js';
import { createBillingOneTimeAddonActivatedRenderers } from '../../../src/services/outbox/billing-one-time-addon-activated-renderers.js';

const payload = {
    addonInstanceId: 'instance-1',
    locale: 'pt',
    addonSlug: 'visibility-boost-7d',
    addonName: 'Stored boost',
    listingId: 'listing-1',
    vertical: 'accommodation',
    endsAt: '2026-11-27T15:00:00.000Z'
};

function row(value: Record<string, unknown>): EmailOutboxRow {
    return {
        id: 'outbox-test',
        recipientUserId: 'user-test',
        recipientEmail: 'a@example.test',
        template: 'billing.one-time-addon-activated',
        channel: 'email',
        payload: value,
        sendAfter: null,
        status: 'processing',
        dedupKey: 'dedup',
        lockedBy: 'test',
        lockedUntil: new Date(),
        attempts: 0,
        providerMessageId: null,
        lastError: null,
        correlationId: null,
        createdAt: new Date(),
        updatedAt: new Date()
    };
}

function copy(_input: OneTimeAddonActivatedMailCopyInput): OneTimeAddonActivatedMailCopy {
    return {
        subject: 'Subject',
        preview: 'Preview',
        heading: 'Heading',
        paragraphs: ['First paragraph', 'Second paragraph'],
        cta: 'See my add-ons'
    };
}

async function render(
    value: Record<string, unknown>,
    names: ReadonlyMap<string, string> = new Map([['listing-1', 'Cabañas del Río']])
) {
    const resolveCopy = vi.fn(copy);
    const readListingNames = vi.fn(async () => names);
    const renderer = createBillingOneTimeAddonActivatedRenderers({
        siteUrl: 'https://hospeda.test/',
        readListingNames,
        resolveCopy
    })['billing.one-time-addon-activated'];
    if (!renderer) throw new Error('Renderer missing');
    const result = await renderer({ row: row(value) });
    return { result, resolveCopy, readListingNames };
}

describe('HOS-2405 one-time add-on activated renderer', () => {
    it('hands the copy facts with the listing name to the resolver and renders its copy', async () => {
        // Arrange
        // Act
        const { result, resolveCopy, readListingNames } = await render(payload);

        // Assert
        expect(readListingNames).toHaveBeenCalledWith({
            vertical: 'accommodation',
            ids: ['listing-1']
        });
        expect(resolveCopy).toHaveBeenCalledWith({
            locale: 'pt',
            addonSlug: 'visibility-boost-7d',
            addonName: 'Stored boost',
            listingName: 'Cabañas del Río',
            endsAt: new Date('2026-11-27T15:00:00.000Z')
        });
        expect(result.subject).toBe('Subject');
        const html = renderToStaticMarkup(result.react);
        expect(html).toContain('Heading');
        expect(html).toContain('First paragraph');
        expect(html).toContain('Second paragraph');
        expect(html).toContain('https://hospeda.test/pt/mi-cuenta/complementos/');
    });

    it('reads no listing when the add-on targets none, and passes a null expiry through', async () => {
        // Arrange
        // Act
        const { resolveCopy, readListingNames } = await render({
            ...payload,
            listingId: null,
            vertical: null,
            endsAt: null
        });

        // Assert
        expect(readListingNames).not.toHaveBeenCalled();
        expect(resolveCopy).toHaveBeenCalledWith(
            expect.objectContaining({ listingName: null, endsAt: null })
        );
    });

    it('throws when the listing has no name, so the row retries instead of naming nothing', async () => {
        // Arrange
        // Act
        const act = render(payload, new Map());

        // Assert
        await expect(act).rejects.toThrow(TypeError);
    });

    it.each([
        ['an unknown locale', { ...payload, locale: 'fr' }],
        ['an unknown vertical', { ...payload, vertical: 'tourist' }],
        ['a listing without its vertical', { ...payload, vertical: null }],
        ['a vertical without its listing', { ...payload, listingId: null }],
        ['an expiry that is not an instant', { ...payload, endsAt: 'next week' }],
        ['a missing add-on slug', { ...payload, addonSlug: '' }],
        ['an unexpected field', { ...payload, payerEmail: 'payer@example.test' }]
    ])('rejects %s', async (_label, invalid) => {
        // Arrange
        // Act
        const act = render(invalid);

        // Assert
        await expect(act).rejects.toThrow(TypeError);
    });
});
