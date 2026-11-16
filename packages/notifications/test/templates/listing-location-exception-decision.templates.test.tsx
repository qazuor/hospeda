/**
 * ListingLocationExceptionDecision email template (HOS-2192).
 *
 * Pins what the owner decision carries: es/en/pt copy that differs per locale, the
 * admin's reason on a rejection only, the editor link, and no address.
 *
 * @module test/templates/listing-location-exception-decision.templates.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NOTIFICATION_CATEGORY_MAP } from '../../src/config/notification-categories';
import {
    buildListingLocationExceptionSubject,
    ListingLocationExceptionDecision,
    type ListingLocationExceptionDecisionProps,
    type ListingLocationExceptionLocale
} from '../../src/templates/listing-location/listing-location-exception-decision';
import { NotificationType } from '../../src/types/notification.types';

const LOCALES: readonly ListingLocationExceptionLocale[] = ['es', 'en', 'pt'];

const base: ListingLocationExceptionDecisionProps = {
    recipientName: 'Ana',
    locale: 'es',
    approved: false,
    listingName: 'Parrilla Don Jose',
    decisionReason: 'Es el mismo local de la ficha existente',
    editorUrl: 'https://hospeda.test/es/mi-cuenta/comercio/venue/1/editar/ubicacion/'
};

describe('ListingLocationExceptionDecision', () => {
    it('shows the admin reason and the editor link on a rejection', () => {
        // Arrange / Act
        const html = renderToStaticMarkup(ListingLocationExceptionDecision(base));

        // Assert
        expect(html).toContain('Parrilla Don Jose');
        expect(html).toContain('Es el mismo local de la ficha existente');
        expect(html).toContain(base.editorUrl);
    });

    it('does not show a reason on an approval, even when one is passed', () => {
        const html = renderToStaticMarkup(
            ListingLocationExceptionDecision({ ...base, approved: true })
        );

        expect(html).not.toContain('Es el mismo local de la ficha existente');
        expect(html).toContain('Ya podés publicar');
    });

    it.each(LOCALES)('renders %s copy for both outcomes', (locale) => {
        const approved = renderToStaticMarkup(
            ListingLocationExceptionDecision({ ...base, locale, approved: true })
        );
        const rejected = renderToStaticMarkup(
            ListingLocationExceptionDecision({ ...base, locale, approved: false })
        );

        expect(approved).not.toBe(rejected);
        expect(approved).toContain(base.editorUrl);
    });

    it('writes en and pt differently from es', () => {
        const rendered = LOCALES.map((locale) =>
            renderToStaticMarkup(
                ListingLocationExceptionDecision({ ...base, locale, approved: true })
            )
        );

        expect(new Set(rendered).size).toBe(3);
    });

    it('builds a different subject per locale and outcome', () => {
        const subjects = LOCALES.flatMap((locale) =>
            [true, false].map(
                (approved) => buildListingLocationExceptionSubject({ locale, approved }).subject
            )
        );

        expect(new Set(subjects).size).toBe(6);
    });

    it('is TRANSACTIONAL for both types', () => {
        expect(
            NOTIFICATION_CATEGORY_MAP[NotificationType.LISTING_LOCATION_EXCEPTION_APPROVED]
        ).toBe('transactional');
        expect(
            NOTIFICATION_CATEGORY_MAP[NotificationType.LISTING_LOCATION_EXCEPTION_REJECTED]
        ).toBe('transactional');
    });
});
