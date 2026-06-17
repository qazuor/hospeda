import { describe, expect, it } from 'vitest';

import { detectSource } from '../../../src/services/accommodation-import/detect-source.js';

// ---------------------------------------------------------------------------
// detectSource
// ---------------------------------------------------------------------------

describe('detectSource', () => {
    // -----------------------------------------------------------------------
    // MercadoLibre
    // -----------------------------------------------------------------------
    describe('when the URL belongs to MercadoLibre / MercadoLivre', () => {
        it('should return "mercadolibre" for an articulo.mercadolibre.com.ar URL', () => {
            // Arrange
            const url = 'https://articulo.mercadolibre.com.ar/MLA-123456789-cabana-_JM';

            // Act
            const result = detectSource({ url });

            // Assert
            expect(result).toBe('mercadolibre');
        });

        it('should return "mercadolibre" for a mercadolibre.com listing', () => {
            const result = detectSource({ url: 'https://mercadolibre.com/listing/x' });
            expect(result).toBe('mercadolibre');
        });

        it('should return "mercadolibre" for a mercadolibre.com.mx URL', () => {
            const result = detectSource({ url: 'https://articulo.mercadolibre.com.mx/MLM-999-x' });
            expect(result).toBe('mercadolibre');
        });

        it('should return "mercadolibre" for a MercadoLivre Brazil URL (produto.mercadolivre.com.br)', () => {
            const result = detectSource({
                url: 'https://produto.mercadolivre.com.br/MLB-123-cabana_JM'
            });
            expect(result).toBe('mercadolibre');
        });

        it('should return "mercadolibre" for a www.mercadolibre.com URL (strips www)', () => {
            const result = detectSource({ url: 'https://www.mercadolibre.com/listing' });
            expect(result).toBe('mercadolibre');
        });
    });

    // -----------------------------------------------------------------------
    // Google Maps
    // -----------------------------------------------------------------------
    describe('when the URL belongs to Google Maps', () => {
        it('should return "google" for a google.com/maps URL', () => {
            // Arrange
            const url = 'https://www.google.com/maps/place/Cabana+del+Rio/@-32.4,-58.2,17z';

            // Act
            const result = detectSource({ url });

            // Assert
            expect(result).toBe('google');
        });

        it('should return "google" for a maps.google.com URL', () => {
            const result = detectSource({ url: 'https://maps.google.com/?q=hotel' });
            expect(result).toBe('google');
        });

        it('should return "google" for a maps.google.com.ar URL', () => {
            const result = detectSource({ url: 'https://maps.google.com.ar/?q=cabana' });
            expect(result).toBe('google');
        });

        it('should return "google" for a goo.gl/maps short link', () => {
            const result = detectSource({ url: 'https://goo.gl/maps/AbCdEfGh' });
            expect(result).toBe('google');
        });

        it('should return "google" for a maps.app.goo.gl short link', () => {
            const result = detectSource({ url: 'https://maps.app.goo.gl/XyZ123' });
            expect(result).toBe('google');
        });

        it('should return "google" for a g.page short link', () => {
            const result = detectSource({ url: 'https://g.page/some-business' });
            expect(result).toBe('google');
        });
    });

    // -----------------------------------------------------------------------
    // Booking.com
    // -----------------------------------------------------------------------
    describe('when the URL belongs to Booking.com', () => {
        it('should return "booking" for a www.booking.com hotel URL', () => {
            // Arrange
            const url = 'https://www.booking.com/hotel/ar/sol-del-litoral.html';

            // Act
            const result = detectSource({ url });

            // Assert
            expect(result).toBe('booking');
        });

        it('should return "booking" for a booking.com URL without www (strips www)', () => {
            const result = detectSource({ url: 'https://booking.com/hotel/ar/x.html' });
            expect(result).toBe('booking');
        });

        it('should return "booking" for a secure.booking.com sub-domain', () => {
            const result = detectSource({ url: 'https://secure.booking.com/list.html' });
            expect(result).toBe('booking');
        });
    });

    // -----------------------------------------------------------------------
    // Airbnb
    // -----------------------------------------------------------------------
    describe('when the URL belongs to Airbnb', () => {
        it('should return "airbnb" for a www.airbnb.com rooms URL', () => {
            // Arrange
            const url = 'https://www.airbnb.com/rooms/123456789';

            // Act
            const result = detectSource({ url });

            // Assert
            expect(result).toBe('airbnb');
        });

        it('should return "airbnb" for an airbnb.com.ar URL', () => {
            const result = detectSource({ url: 'https://www.airbnb.com.ar/rooms/987' });
            expect(result).toBe('airbnb');
        });

        it('should return "airbnb" for an airbnb.mx URL', () => {
            const result = detectSource({ url: 'https://www.airbnb.mx/rooms/456' });
            expect(result).toBe('airbnb');
        });

        it('should return "airbnb" for an airbnb.es URL', () => {
            const result = detectSource({ url: 'https://airbnb.es/rooms/789' });
            expect(result).toBe('airbnb');
        });
    });

    // -----------------------------------------------------------------------
    // www. stripping
    // -----------------------------------------------------------------------
    describe('www. prefix stripping', () => {
        it('should strip www. before matching airbnb', () => {
            expect(detectSource({ url: 'https://www.airbnb.com/rooms/1' })).toBe('airbnb');
        });

        it('should strip www. before matching booking', () => {
            expect(detectSource({ url: 'https://www.booking.com/hotel/ar/x.html' })).toBe(
                'booking'
            );
        });

        it('should strip www. before matching mercadolibre', () => {
            expect(detectSource({ url: 'https://www.mercadolibre.com.ar/foo' })).toBe(
                'mercadolibre'
            );
        });
    });

    // -----------------------------------------------------------------------
    // Generic fallback
    // -----------------------------------------------------------------------
    describe('when the URL does not match any known platform', () => {
        it('should return "generic" for an unknown host', () => {
            // Arrange
            const url = 'https://example.com/listing/42';

            // Act
            const result = detectSource({ url });

            // Assert
            expect(result).toBe('generic');
        });

        it('should return "generic" for an arbitrary travel site', () => {
            const result = detectSource({ url: 'https://despegar.com/hoteles/ar/buenos-aires' });
            expect(result).toBe('generic');
        });

        it('should return "generic" for a localhost URL', () => {
            const result = detectSource({ url: 'http://localhost:3000/test' });
            expect(result).toBe('generic');
        });
    });

    // -----------------------------------------------------------------------
    // Garbage / malformed input — must not throw
    // -----------------------------------------------------------------------
    describe('when the input is not a valid URL', () => {
        it('should return "generic" for a plain string (no protocol)', () => {
            const result = detectSource({ url: 'not-a-url' });
            expect(result).toBe('generic');
        });

        it('should return "generic" for an empty string', () => {
            const result = detectSource({ url: '' });
            expect(result).toBe('generic');
        });

        it('should return "generic" for a garbage string', () => {
            const result = detectSource({ url: '!!!@@@###' });
            expect(result).toBe('generic');
        });

        it('should not throw for a malformed URL — always returns a string', () => {
            expect(() => detectSource({ url: 'http://' })).not.toThrow();
        });
    });

    // -----------------------------------------------------------------------
    // Case-insensitivity
    // -----------------------------------------------------------------------
    describe('case-insensitivity', () => {
        it('should detect airbnb from an upper-case host', () => {
            // Arrange — some HTTP clients may preserve original casing
            const url = 'https://WWW.AIRBNB.COM/rooms/999';

            // Act
            const result = detectSource({ url });

            // Assert
            expect(result).toBe('airbnb');
        });

        it('should detect booking from a mixed-case host', () => {
            const result = detectSource({ url: 'https://Www.Booking.Com/hotel/ar/x.html' });
            expect(result).toBe('booking');
        });

        it('should detect mercadolibre from an upper-case host', () => {
            const result = detectSource({ url: 'https://ARTICULO.MERCADOLIBRE.COM.AR/MLA-1' });
            expect(result).toBe('mercadolibre');
        });
    });

    // -----------------------------------------------------------------------
    // "none" is never returned
    // -----------------------------------------------------------------------
    describe('reserved value "none"', () => {
        it('should never return "none" — that value is for manual-entry accommodations only', () => {
            const urls = [
                'https://airbnb.com/rooms/1',
                'https://booking.com/hotel/ar/x.html',
                'https://example.com/x',
                'not-a-url',
                ''
            ];
            for (const url of urls) {
                expect(detectSource({ url })).not.toBe('none');
            }
        });
    });
});
