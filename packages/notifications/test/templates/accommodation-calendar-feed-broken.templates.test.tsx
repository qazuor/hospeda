/**
 * AccommodationCalendarFeedBroken Email Template Test Suite (HOS-162 Phase 3,
 * spec §14.4).
 *
 * Tests for the broken/expired iCal feed host-notification email template:
 * - Template renders without errors
 * - Required props (recipientName, accommodationName, providerLabel,
 *   reconnectUrl) appear in output
 * - Overbooking-risk warning copy is present
 * - CTA link is built from reconnectUrl
 * - No unsubscribe link (TRANSACTIONAL)
 *
 * @module test/templates/accommodation-calendar-feed-broken.templates.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    AccommodationCalendarFeedBroken,
    type AccommodationCalendarFeedBrokenProps
} from '../../src/templates/calendar-sync/accommodation-calendar-feed-broken';

describe('AccommodationCalendarFeedBroken email template (HOS-162)', () => {
    const validProps: AccommodationCalendarFeedBrokenProps = {
        recipientName: 'Juan Pérez',
        accommodationName: 'Cabañas del Río',
        providerLabel: 'Airbnb',
        reconnectUrl: 'https://hospeda.com.ar/es/mi-cuenta/propiedades/acc-uuid/editar'
    };

    describe('render', () => {
        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(AccommodationCalendarFeedBroken(validProps));

            // Assert
            expect(render).not.toThrow();
        });

        it('should contain recipient name', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AccommodationCalendarFeedBroken(validProps));

            // Assert
            expect(html).toContain('Juan Pérez');
        });

        it('should contain the accommodation name', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AccommodationCalendarFeedBroken(validProps));

            // Assert
            expect(html).toContain('Cabañas del Río');
        });

        it('should contain the provider label', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AccommodationCalendarFeedBroken(validProps));

            // Assert
            expect(html).toContain('Airbnb');
        });

        it('should include the reconnect CTA link', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AccommodationCalendarFeedBroken(validProps));

            // Assert
            expect(html).toContain(
                'https://hospeda.com.ar/es/mi-cuenta/propiedades/acc-uuid/editar'
            );
            expect(html).toContain('Reconectar calendario');
        });

        it('should work with a different provider (Booking.com)', () => {
            // Arrange
            const bookingProps: AccommodationCalendarFeedBrokenProps = {
                ...validProps,
                providerLabel: 'Booking.com'
            };

            // Act
            const html = renderToStaticMarkup(AccommodationCalendarFeedBroken(bookingProps));

            // Assert
            expect(html).toContain('Booking.com');
        });
    });

    describe('overbooking warning', () => {
        it('should warn about the double-booking risk', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AccommodationCalendarFeedBroken(validProps));

            // Assert
            expect(html).toContain('doble reserva');
        });

        it('should not expose raw technical error detail (kind/message)', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AccommodationCalendarFeedBroken(validProps));

            // Assert — this template never receives fetch/parse error internals
            expect(html).not.toContain('fetch_error');
            expect(html).not.toContain('parse_error');
        });
    });

    describe('infoBox fields', () => {
        it('should show the accommodation and origin labels', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AccommodationCalendarFeedBroken(validProps));

            // Assert
            expect(html).toContain('Alojamiento');
            expect(html).toContain('Origen');
            expect(html).toContain('Sincronización interrumpida');
        });
    });

    describe('transactional behaviour', () => {
        it('should not render an unsubscribe link (transactional email)', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AccommodationCalendarFeedBroken(validProps));

            // Assert
            expect(html).not.toContain('Administrar preferencias de notificaciones');
            expect(html).not.toContain('unsubscribe_url');
        });
    });
});
