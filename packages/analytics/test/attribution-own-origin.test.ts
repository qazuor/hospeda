import { describe, expect, it } from 'vitest';
import { buildOwnWebOrigins, isOwnWebUrl } from '../src/index.js';

describe('buildOwnWebOrigins', () => {
    it('adds the site origin to the fixed public hosts, deduped', () => {
        expect(buildOwnWebOrigins({ siteUrl: 'https://hospeda.com.ar/' })).toEqual([
            'https://hospeda.com.ar',
            'https://www.hospeda.com.ar',
            'https://staging.hospeda.com.ar'
        ]);
        expect(buildOwnWebOrigins({ siteUrl: 'http://localhost:4321/es/' })).toEqual([
            'http://localhost:4321',
            'https://hospeda.com.ar',
            'https://www.hospeda.com.ar',
            'https://staging.hospeda.com.ar'
        ]);
    });

    it('ignores an unparseable site URL', () => {
        expect(buildOwnWebOrigins({ siteUrl: 'not a url' })).toEqual([
            'https://hospeda.com.ar',
            'https://www.hospeda.com.ar',
            'https://staging.hospeda.com.ar'
        ]);
    });
});

describe('isOwnWebUrl', () => {
    const ownOrigins = buildOwnWebOrigins({ siteUrl: 'http://localhost:4321' });

    it.each([
        'https://hospeda.com.ar/es/',
        'https://www.hospeda.com.ar/',
        'https://staging.hospeda.com.ar/es/x/?a=1',
        'http://localhost:4321/es/mi-cuenta/'
    ])('accepts %s', (url) => {
        expect(isOwnWebUrl({ url, ownOrigins })).toBe(true);
    });

    it.each([
        'https://api.hospeda.com.ar/api/auth/verify-email?token=x',
        'https://admin.hospeda.com.ar/',
        'https://staging-api.hospeda.com.ar/',
        'https://example.com/',
        'http://hospeda.com.ar/',
        'https://hospeda.com.ar.evil.com/',
        'mailto:hola@hospeda.com.ar',
        'tel:+5493442000000',
        '#top',
        '/es/relative/',
        ''
    ])('rejects %s', (url) => {
        expect(isOwnWebUrl({ url, ownOrigins })).toBe(false);
    });
});
