import { describe, expect, it } from 'vitest';
import {
    InvalidUtmParamsError,
    PRESENTATION_AUDIENCES,
    QR_CAMPAIGNS,
    SHARE_CAMPAIGNS,
    UTM_MEDIUMS,
    UTM_SOURCES,
    UtmParamsSchema,
    type WithUtmInput,
    withUtm
} from '../src/index.js';

describe('UTM vocabulary (HOS-2359 OD-4)', () => {
    it('pins the closed lists', () => {
        // Arrange / Act / Assert
        expect(UTM_SOURCES).toEqual([
            'email',
            'whatsapp',
            'facebook',
            'x',
            'telegram',
            'share',
            'copy',
            'qr',
            'instagram',
            'google-business'
        ]);
        expect(UTM_MEDIUMS).toEqual([
            'transactional',
            'campaign',
            'share',
            'print',
            'direct-outreach',
            'profile'
        ]);
        expect(SHARE_CAMPAIGNS).toEqual(['accommodation', 'event', 'post', 'venue', 'experience']);
        expect(QR_CAMPAIGNS).toEqual([
            'accommodation',
            'venue',
            'experience',
            'host-trade',
            'certificate',
            'manual'
        ]);
        expect(PRESENTATION_AUDIENCES).toEqual([
            'alojamientos',
            'comer-y-salir',
            'experiencias',
            'proveedores',
            'aliados',
            'editores'
        ]);
    });

    it.each([
        {
            source: 'email',
            medium: 'transactional',
            campaign: 'auth-reset-password',
            content: 'cta'
        },
        { source: 'email', medium: 'campaign', campaign: 'otono-abcd1234', content: 'body-link' },
        { source: 'whatsapp', medium: 'share', campaign: 'post' },
        { source: 'share', medium: 'share', campaign: 'event' },
        { source: 'copy', medium: 'share', campaign: 'accommodation' },
        { source: 'qr', medium: 'print', campaign: 'certificate', content: 'certificate' },
        { source: 'qr', medium: 'print', campaign: 'manual' },
        { source: 'telegram', medium: 'direct-outreach', campaign: 'presentacion-aliados' },
        { source: 'copy', medium: 'direct-outreach', campaign: 'presentacion-comer-y-salir' },
        { source: 'instagram', medium: 'profile', campaign: 'bio' },
        { source: 'google-business', medium: 'profile', campaign: 'bio' }
    ])('accepts $medium/$source/$campaign', (params) => {
        expect(UtmParamsSchema.safeParse(params).success).toBe(true);
    });

    it.each([
        { source: 'qr', medium: 'share', campaign: 'post' },
        { source: 'whatsapp', medium: 'transactional', campaign: 'x', content: 'cta' },
        { source: 'email', medium: 'transactional', campaign: 'auth-reset-password' },
        { source: 'email', medium: 'transactional', campaign: 'Auth.Reset', content: 'cta' },
        { source: 'email', medium: 'campaign', campaign: 'a', content: 'Body Link' },
        {
            source: 'email',
            medium: 'transactional',
            campaign: 'a'.repeat(101),
            content: 'cta'
        },
        { source: 'email', medium: 'transactional', campaign: 'a', content: 'c'.repeat(41) },
        { source: 'whatsapp', medium: 'share', campaign: 'host-trade' },
        { source: 'share', medium: 'direct-outreach', campaign: 'presentacion-aliados' },
        { source: 'whatsapp', medium: 'direct-outreach', campaign: 'presentacion-otros' },
        { source: 'qr', medium: 'print', campaign: 'listing' },
        { source: 'qr', medium: 'print', campaign: 'manual', content: 'Host Trade' },
        { source: 'facebook', medium: 'profile', campaign: 'bio' },
        { source: 'instagram', medium: 'profile', campaign: 'story' },
        { source: 'email', medium: 'newsletter', campaign: 'a', content: 'b' }
    ])('rejects $medium/$source/$campaign/$content', (params) => {
        expect(UtmParamsSchema.safeParse(params).success).toBe(false);
    });
});

describe('withUtm', () => {
    it('appends source, medium, campaign and content in that order', () => {
        // Act
        const url = withUtm({
            url: 'https://hospeda.com.ar/es/alojamientos/',
            source: 'email',
            medium: 'transactional',
            campaign: 'auth-reset-password',
            content: 'home'
        });

        // Assert
        expect(url).toBe(
            'https://hospeda.com.ar/es/alojamientos/?utm_source=email&utm_medium=transactional&utm_campaign=auth-reset-password&utm_content=home'
        );
    });

    it('omits utm_content when not given', () => {
        const url = withUtm({
            url: 'https://hospeda.com.ar/es/publicaciones/a/',
            source: 'whatsapp',
            medium: 'share',
            campaign: 'post'
        });

        expect(url).toBe(
            'https://hospeda.com.ar/es/publicaciones/a/?utm_source=whatsapp&utm_medium=share&utm_campaign=post'
        );
    });

    it('preserves existing params and the hash', () => {
        const url = withUtm({
            url: 'https://hospeda.com.ar/es/x/?token=a%2Bb&page=2#reviews',
            source: 'qr',
            medium: 'print',
            campaign: 'accommodation',
            content: 'listing'
        });

        expect(url).toBe(
            'https://hospeda.com.ar/es/x/?token=a%2Bb&page=2&utm_source=qr&utm_medium=print&utm_campaign=accommodation&utm_content=listing#reviews'
        );
    });

    it.each([
        'https://hospeda.com.ar/es/?utm_source=newsletter',
        'https://hospeda.com.ar/es/?a=1&utm_campaign=otro',
        'https://hospeda.com.ar/es/?utm_term=x'
    ])('returns %s unchanged when it already has a utm_* param (AC-8)', (input) => {
        expect(withUtm({ url: input, source: 'whatsapp', medium: 'share', campaign: 'post' })).toBe(
            input
        );
    });

    it('accepts a base-relative URL and returns it relative', () => {
        const url = withUtm({
            url: '/es/presentacion/alojamientos/',
            source: 'whatsapp',
            medium: 'direct-outreach',
            campaign: 'presentacion-alojamientos'
        });

        expect(url).toBe(
            '/es/presentacion/alojamientos/?utm_source=whatsapp&utm_medium=direct-outreach&utm_campaign=presentacion-alojamientos'
        );
    });

    it('throws InvalidUtmParamsError on an invalid combination (AC-9)', () => {
        expect(() =>
            withUtm({
                url: 'https://hospeda.com.ar/',
                source: 'qr',
                medium: 'share',
                campaign: 'post'
            } as unknown as WithUtmInput)
        ).toThrow(InvalidUtmParamsError);
    });

    it('validates even when the URL already carries UTMs', () => {
        expect(() =>
            withUtm({
                url: 'https://hospeda.com.ar/?utm_source=x',
                source: 'qr',
                medium: 'share',
                campaign: 'post'
            } as unknown as WithUtmInput)
        ).toThrow(InvalidUtmParamsError);
    });
});
