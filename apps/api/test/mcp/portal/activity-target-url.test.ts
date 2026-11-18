/**
 * HOS-2348 (spec HOS-2335 §5.6, §6.9) — the portal link of an assistant
 * activity target: a listing opens its editor, a conversation its inquiry
 * thread, anything else gets no link, and a link that cannot be built is
 * dropped instead of thrown.
 *
 * @module test/mcp/portal/activity-target-url
 */

import { describe, expect, it } from 'vitest';
import {
    activityTargetDestination,
    buildActivityTargetUrl
} from '../../../src/mcp/portal/activity-target-url';

const SITE = 'https://hospeda.test';
const ID = '9a1f5c2e-6b7d-4e8f-a0b1-c2d3e4f5a6b7';

describe('buildActivityTargetUrl', () => {
    it.each([
        ['accommodation', `mi-cuenta/propiedades/${ID}/editar`],
        ['venue', `mi-cuenta/comercio/venue/${ID}/editar`],
        ['experience', `mi-cuenta/comercio/experience/${ID}/editar`],
        ['conversation', `mi-cuenta/consultas-propietario/${ID}`]
    ])('links a %s target to its portal page', (type, path) => {
        // Act
        const url = buildActivityTargetUrl({ target: { type, id: ID }, siteUrl: SITE });

        // Assert
        expect(url).toBe(`${SITE}/es/${path}/`);
    });

    it.each([
        ['es', 'es'],
        ['en', 'en'],
        ['pt', 'pt']
    ] as const)('builds the link in the %s locale', (locale, prefix) => {
        const url = buildActivityTargetUrl({
            target: { type: 'accommodation', id: ID },
            siteUrl: SITE,
            locale
        });

        expect(url).toBe(`${SITE}/${prefix}/mi-cuenta/propiedades/${ID}/editar/`);
    });

    it('gives no link to a target type no page shows', () => {
        expect(
            buildActivityTargetUrl({ target: { type: 'amenity', id: ID }, siteUrl: SITE })
        ).toBeUndefined();
        expect(activityTargetDestination({ target: { type: 'amenity', id: ID } })).toBeUndefined();
    });

    it('drops the link instead of throwing when it cannot be built', () => {
        expect(
            buildActivityTargetUrl({ target: { type: 'accommodation', id: ID }, siteUrl: ' ' })
        ).toBeUndefined();
        expect(
            buildActivityTargetUrl({ target: { type: 'conversation', id: ' ' }, siteUrl: SITE })
        ).toBeUndefined();
    });

    it('matches the vertical exactly, never by prefix or case', () => {
        expect(
            buildActivityTargetUrl({ target: { type: 'Accommodation', id: ID }, siteUrl: SITE })
        ).toBeUndefined();
    });
});
