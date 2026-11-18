/**
 * HOS-2335 §5.5 / HOS-2329 — the Google Maps link resolver.
 *
 * AC-C23a: each accepted form resolves to the expected point (fixture table),
 * `!3d…!4d…` wins over `@`, short links through a stubbed redirect chain.
 * AC-C23c: unparseable and out-of-region links fail with a reason.
 * AC-C23d/e: the SSRF rules. Every test injects the hop fetcher; NO test
 * reaches the network, and a full URL must cause zero hops.
 *
 * @module test/mcp/tools/listing/google-maps-link
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import {
    MAPS_LINK_HOP_TIMEOUT_MS,
    MAPS_LINK_MAX_REDIRECTS,
    MAPS_LINK_TOTAL_TIMEOUT_MS,
    resolveGoogleMapsLink
} from '../../../../src/mcp/tools/listing/google-maps-link';
import type {
    MapsHopFetcher,
    MapsHopRequest
} from '../../../../src/mcp/tools/listing/google-maps-link-fetcher';
import { MapsLinkAddressError } from '../../../../src/mcp/tools/listing/google-maps-link-guard';
import { apiLogger } from '../../../../src/utils/logger';

/** A fetcher that answers a fixed chain, one response per call, and records each request. */
function chain(responses: ReadonlyArray<{ status: number; location?: string } | Error>) {
    const calls: MapsHopRequest[] = [];
    const fetchHop = vi.fn<MapsHopFetcher>(async (request) => {
        calls.push(request);
        const next = responses[calls.length - 1];
        if (next === undefined) throw new Error('unexpected extra hop');
        if (next instanceof Error) throw next;
        return { status: next.status, location: next.location ?? null };
    });
    return { fetchHop, calls };
}

const PIN_URL =
    'https://www.google.com/maps/place/Termas+de+Col%C3%B3n/@-32.2241,-58.1402,15z/data=!4m6!3m5!1s0x0:0x0!8m2!3d-32.2251!4d-58.1428!16s';

describe('resolveGoogleMapsLink — accepted forms (AC-C23a)', () => {
    const FIXTURES: ReadonlyArray<{
        readonly name: string;
        readonly url: string;
        readonly lat: number;
        readonly lng: number;
        readonly hint?: string;
    }> = [
        {
            name: 'viewport @lat,lng,zoom',
            url: 'https://www.google.com/maps/@-32.4825,-58.2372,17z',
            lat: -32.4825,
            lng: -58.2372
        },
        {
            name: 'pin !3d…!4d… wins over @',
            url: PIN_URL,
            lat: -32.2251,
            lng: -58.1428,
            hint: 'Termas de Colón'
        },
        {
            name: '?q=lat,lng',
            url: 'https://maps.google.com/?q=-32.48,-58.23',
            lat: -32.48,
            lng: -58.23
        },
        {
            name: '?query=lat,lng (search API)',
            url: 'https://www.google.com/maps/search/?api=1&query=-31.39,-58.02',
            lat: -31.39,
            lng: -58.02
        },
        {
            name: '?ll=lat,lng',
            url: 'https://maps.google.com/maps?ll=-33.01,-58.52&z=14',
            lat: -33.01,
            lng: -58.52
        },
        {
            name: '/maps/search/lat,lng',
            url: 'https://www.google.com.ar/maps/search/-32.48,+-58.23',
            lat: -32.48,
            lng: -58.23
        },
        {
            name: '/place/<name>/…@lat,lng (address hint)',
            url: 'https://www.google.com/maps/place/Av.+San+Mart%C3%ADn+123,+Col%C3%B3n/@-32.22,-58.14,17z',
            lat: -32.22,
            lng: -58.14,
            hint: 'Av. San Martín 123, Colón'
        }
    ];

    it.each(FIXTURES)('$name', async ({ url, lat, lng, hint }) => {
        // Arrange
        const { fetchHop } = chain([]);

        // Act
        const result = await resolveGoogleMapsLink({ url, fetchHop });

        // Assert: the expected point, and a full URL never fetches (AC-C23e)
        expect(result).toEqual({
            ok: true,
            point: { lat, lng },
            ...(hint === undefined ? {} : { addressHint: hint })
        });
        expect(fetchHop).toHaveBeenCalledTimes(0);
    });

    it('resolves a maps.app.goo.gl short link through a stubbed redirect chain', async () => {
        // Arrange
        const { fetchHop, calls } = chain([
            { status: 302, location: 'https://maps.app.goo.gl/next' },
            { status: 301, location: PIN_URL }
        ]);

        // Act
        const result = await resolveGoogleMapsLink({
            url: 'https://maps.app.goo.gl/AbC123',
            fetchHop
        });

        // Assert
        expect(result).toMatchObject({ ok: true, point: { lat: -32.2251, lng: -58.1428 } });
        expect(calls.map((c) => [c.method, c.url.href])).toEqual([
            ['HEAD', 'https://maps.app.goo.gl/AbC123'],
            ['HEAD', 'https://maps.app.goo.gl/next']
        ]);
    });

    it('resolves a goo.gl/maps short link and a relative Location against the hop', async () => {
        // Arrange
        const { fetchHop, calls } = chain([
            { status: 302, location: '/maps/hop2' },
            { status: 302, location: 'https://www.google.com/maps/@-32.4,-58.2,12z' }
        ]);

        // Act
        const result = await resolveGoogleMapsLink({ url: 'https://goo.gl/maps/xyz', fetchHop });

        // Assert
        expect(result).toEqual({ ok: true, point: { lat: -32.4, lng: -58.2 } });
        expect(calls[1]?.url.href).toBe('https://goo.gl/maps/hop2');
    });

    it('falls back to GET on a 405 for the same hop', async () => {
        // Arrange
        const { fetchHop, calls } = chain([
            { status: 405 },
            { status: 302, location: 'https://www.google.com/maps/@-32.4,-58.2,12z' }
        ]);

        // Act
        const result = await resolveGoogleMapsLink({
            url: 'https://maps.app.goo.gl/x',
            fetchHop
        });

        // Assert
        expect(result.ok).toBe(true);
        expect(calls.map((c) => c.method)).toEqual(['HEAD', 'GET']);
    });
});

describe('resolveGoogleMapsLink — refusals (AC-C23c)', () => {
    it.each([
        ['a /place/ URL with no point', 'https://www.google.com/maps/place/Hotel+Plaza/'],
        ['a URL with no coordinates at all', 'https://www.google.com/maps'],
        ['an impossible latitude', 'https://maps.google.com/?q=-132.48,-58.23']
    ])('%s is UNPARSEABLE', async (_name, url) => {
        expect(await resolveGoogleMapsLink({ url, fetchHop: chain([]).fetchHop })).toEqual({
            ok: false,
            reason: 'UNPARSEABLE'
        });
    });

    it.each([
        ['Madrid', 'https://maps.google.com/?q=40.41,-3.70'],
        ['São Paulo', 'https://maps.google.com/?q=-23.55,-46.63'],
        ['Null Island', 'https://maps.google.com/?q=0,0']
    ])('a point in %s is OUT_OF_REGION, never clamped', async (_name, url) => {
        expect(await resolveGoogleMapsLink({ url, fetchHop: chain([]).fetchHop })).toEqual({
            ok: false,
            reason: 'OUT_OF_REGION'
        });
    });

    it('a short link that answers 200 (no redirect) is RESOLUTION_FAILED', async () => {
        const { fetchHop } = chain([{ status: 200 }]);
        expect(await resolveGoogleMapsLink({ url: 'https://maps.app.goo.gl/x', fetchHop })).toEqual(
            { ok: false, reason: 'RESOLUTION_FAILED' }
        );
    });

    it('logs the reason and host only, never the URL', async () => {
        // Arrange
        const secret = 'https://maps.app.goo.gl/PRIVATE-TOKEN-123';
        const { fetchHop } = chain([{ status: 200 }]);

        // Act
        await resolveGoogleMapsLink({ url: secret, fetchHop });

        // Assert
        const logged = JSON.stringify(vi.mocked(apiLogger.info).mock.calls);
        expect(logged).toContain('RESOLUTION_FAILED');
        expect(logged).toContain('maps.app.goo.gl');
        expect(logged).not.toContain('PRIVATE-TOKEN-123');
    });
});

describe('resolveGoogleMapsLink — SSRF: no request at all (AC-C23d)', () => {
    it.each([
        ['a look-alike suffix host', 'https://maps.app.goo.gl.evil.com/x'],
        ['a look-alike prefix host', 'https://evilgoogle.com/maps/@-32.4,-58.2,12z'],
        ['userinfo pointing at metadata', 'https://google.com@169.254.169.254/maps/x'],
        ['userinfo on an allowed host', 'https://user:pass@maps.app.goo.gl/x'],
        ['http scheme', 'http://maps.app.goo.gl/x'],
        ['javascript scheme', 'javascript:alert(1)'],
        ['an explicit non-default port', 'https://maps.app.goo.gl:8443/x'],
        ['an explicit default port', 'https://maps.app.goo.gl:443/x'],
        ['an IPv4 literal', 'https://169.254.169.254/maps/x'],
        ['a decimal IPv4 literal', 'https://2130706433/maps/x'],
        ['an octal IPv4 literal', 'https://0177.0.0.1/maps/x'],
        ['a hex IPv4 literal', 'https://0x7f.0.0.1/maps/x'],
        ['an IPv6 literal', 'https://[::1]/maps/x'],
        ['an IPv4-mapped IPv6 literal', 'https://[::ffff:169.254.169.254]/maps/x'],
        ['goo.gl outside /maps/', 'https://goo.gl/abc'],
        ['a trailing-dot host', 'https://maps.app.goo.gl./x'],
        ['an unrelated host', 'https://example.com/maps/@-32.4,-58.2,12z'],
        ['not a URL', 'mi casa en Colón'],
        ['an oversized URL', `https://maps.app.goo.gl/${'a'.repeat(3000)}`]
    ])('refuses %s without fetching', async (_name, url) => {
        // Arrange
        const { fetchHop } = chain([]);

        // Act
        const result = await resolveGoogleMapsLink({ url, fetchHop });

        // Assert
        expect(result.ok).toBe(false);
        expect(fetchHop).not.toHaveBeenCalled();
    });

    it('refuses when the hop resolves to a private address (guarded lookup error)', async () => {
        // Arrange: the default fetcher rejects with this error when DNS answers a blocked IP.
        const { fetchHop } = chain([new MapsLinkAddressError()]);

        // Act
        const result = await resolveGoogleMapsLink({ url: 'https://maps.app.goo.gl/x', fetchHop });

        // Assert
        expect(result).toEqual({ ok: false, reason: 'PRIVATE_ADDRESS' });
        expect(fetchHop).toHaveBeenCalledTimes(1);
    });
});

describe('resolveGoogleMapsLink — SSRF: redirects and deadlines (AC-C23e)', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it.each([
        ['a non-allowlisted host', 'https://evil.example/maps/@-32.4,-58.2,12z'],
        ['the metadata IP', 'http://169.254.169.254/latest/meta-data/'],
        ['an http downgrade of an allowed host', 'http://www.google.com/maps/@-32.4,-58.2,12z'],
        ['a look-alike host', 'https://www.google.com.evil.com/maps/@-32.4,-58.2,12z'],
        ['a protocol-relative host', '//evil.example/maps/x'],
        ['an allowed host with an explicit port', 'https://maps.app.goo.gl:444/x']
    ])('never follows a redirect to %s', async (_name, location) => {
        // Arrange
        const { fetchHop, calls } = chain([{ status: 302, location }]);

        // Act
        const result = await resolveGoogleMapsLink({ url: 'https://maps.app.goo.gl/x', fetchHop });

        // Assert: one hop (the user's link), the bad target was never requested
        expect(result).toEqual({ ok: false, reason: 'HOST_NOT_ALLOWED' });
        expect(calls).toHaveLength(1);
    });

    it(`stops after ${MAPS_LINK_MAX_REDIRECTS} hops`, async () => {
        // Arrange: an endless short-link loop.
        const { fetchHop } = chain(
            Array.from({ length: MAPS_LINK_MAX_REDIRECTS + 3 }, (_, i) => ({
                status: 302,
                location: `https://maps.app.goo.gl/loop${i}`
            }))
        );

        // Act
        const result = await resolveGoogleMapsLink({ url: 'https://maps.app.goo.gl/x', fetchHop });

        // Assert
        expect(result).toEqual({ ok: false, reason: 'TOO_MANY_REDIRECTS' });
        expect(fetchHop).toHaveBeenCalledTimes(MAPS_LINK_MAX_REDIRECTS);
    });

    it(`times a hop out after ${MAPS_LINK_HOP_TIMEOUT_MS} ms, even when the fetcher ignores the signal`, async () => {
        // Arrange
        vi.useFakeTimers();
        const fetchHop = vi.fn<MapsHopFetcher>(() => new Promise(() => undefined));

        // Act
        const pending = resolveGoogleMapsLink({ url: 'https://maps.app.goo.gl/x', fetchHop });
        await vi.advanceTimersByTimeAsync(MAPS_LINK_HOP_TIMEOUT_MS - 1);
        const signal = fetchHop.mock.calls[0]?.[0].signal;
        expect(signal?.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(1);

        // Assert
        expect(await pending).toEqual({ ok: false, reason: 'TIMEOUT' });
        expect(signal?.aborted).toBe(true);
    });

    it(`stops the whole resolution at ${MAPS_LINK_TOTAL_TIMEOUT_MS} ms across hops`, async () => {
        // Arrange: each hop answers just under its own deadline.
        vi.useFakeTimers();
        const fetchHop = vi.fn<MapsHopFetcher>(
            ({ signal }) =>
                new Promise((resolve, reject) => {
                    const timer = setTimeout(
                        () => resolve({ status: 302, location: 'https://maps.app.goo.gl/again' }),
                        MAPS_LINK_HOP_TIMEOUT_MS - 500
                    );
                    signal.addEventListener('abort', () => {
                        clearTimeout(timer);
                        reject(new Error('aborted'));
                    });
                })
        );

        // Act
        const pending = resolveGoogleMapsLink({ url: 'https://maps.app.goo.gl/x', fetchHop });
        await vi.advanceTimersByTimeAsync(MAPS_LINK_TOTAL_TIMEOUT_MS);

        // Assert: hop 1 finished at 2.5 s, hop 2 was cut by the 5 s total deadline
        expect(await pending).toEqual({ ok: false, reason: 'TIMEOUT' });
        expect(fetchHop).toHaveBeenCalledTimes(2);
    });

    it('never asks the fetcher for a body: each hop is HEAD, GET only after a 405', async () => {
        // Arrange
        const { fetchHop, calls } = chain([
            { status: 302, location: 'https://maps.app.goo.gl/b' },
            { status: 302, location: 'https://www.google.com/maps/@-32.4,-58.2,12z' }
        ]);

        // Act
        await resolveGoogleMapsLink({ url: 'https://maps.app.goo.gl/a', fetchHop });

        // Assert
        expect(calls.every((c) => c.method === 'HEAD')).toBe(true);
    });
});
