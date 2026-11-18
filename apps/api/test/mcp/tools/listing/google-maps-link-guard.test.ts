/**
 * HOS-2335 §5.5 / AC-C23d — the SSRF guard of the Maps link resolver: the URL
 * rules, the address blocklist and the guarded DNS lookup. Pure: the lookup
 * tests inject the DNS function, nothing reaches the network.
 *
 * @module test/mcp/tools/listing/google-maps-link-guard
 */

import type { LookupAddress } from 'node:dns';
import { describe, expect, it } from 'vitest';

import {
    checkMapsUrl,
    createGuardedLookup,
    isBlockedAddress,
    MAPS_LINK_HOST_ALLOWLIST,
    type MapsDnsLookup,
    MapsLinkAddressError
} from '../../../../src/mcp/tools/listing/google-maps-link-guard';

describe('checkMapsUrl', () => {
    it.each(MAPS_LINK_HOST_ALLOWLIST.map((host) => [host]))('accepts the exact host %s', (host) => {
        expect(checkMapsUrl({ raw: `https://${host}/maps/x` }).ok).toBe(true);
    });

    it('compares the hostname after WHATWG lowercasing, so case does not matter', () => {
        expect(checkMapsUrl({ raw: 'https://MAPS.APP.GOO.GL/x' })).toMatchObject({
            ok: true,
            isShortLink: true
        });
    });

    it('marks only maps.app.goo.gl and goo.gl as short links', () => {
        expect(checkMapsUrl({ raw: 'https://goo.gl/maps/x' })).toMatchObject({ isShortLink: true });
        expect(checkMapsUrl({ raw: 'https://www.google.com/maps/x' })).toMatchObject({
            isShortLink: false
        });
    });

    it.each([
        'https://maps.app.goo.gl.evil.com/x',
        'https://evilgoogle.com/maps/x',
        'https://xgoogle.com/maps/x',
        'https://google.com.evil/maps/x',
        'https://sub.maps.google.com/x',
        'https://google.com@169.254.169.254/x',
        'https://a@maps.app.goo.gl/x',
        'http://maps.app.goo.gl/x',
        'ftp://maps.app.goo.gl/x',
        'https://maps.app.goo.gl:443/x',
        'https://maps.app.goo.gl:8080/x',
        'https://10.0.0.1/maps/x',
        'https://2130706433/maps/x',
        'https://0177.0.0.01/maps/x',
        'https://0x7f000001/maps/x',
        'https://[::1]/maps/x',
        'https://[fe80::1]/maps/x',
        'https://goo.gl/notmaps'
    ])('refuses %s', (raw) => {
        expect(checkMapsUrl({ raw })).toEqual({ ok: false, reason: 'HOST_NOT_ALLOWED' });
    });

    it('refuses a relative URL without a base, and resolves one against an allowed base', () => {
        expect(checkMapsUrl({ raw: '/maps/x' })).toEqual({ ok: false, reason: 'INVALID_URL' });
        const base = new URL('https://maps.app.goo.gl/a');
        expect(checkMapsUrl({ raw: '/b', base })).toMatchObject({ ok: true });
        expect(checkMapsUrl({ raw: '//evil.example/b', base })).toEqual({
            ok: false,
            reason: 'HOST_NOT_ALLOWED'
        });
    });
});

describe('isBlockedAddress', () => {
    it.each([
        '127.0.0.1',
        '10.1.2.3',
        '172.16.0.1',
        '172.31.255.255',
        '192.168.1.1',
        '169.254.169.254',
        '100.64.0.1',
        '0.0.0.0',
        '224.0.0.1',
        '255.255.255.255',
        '::1',
        '::',
        'fe80::1',
        'fc00::1',
        'fd12:3456::1',
        'ff02::1',
        '::ffff:127.0.0.1',
        '::ffff:169.254.169.254',
        '::ffff:7f00:1',
        '64:ff9b::a9fe:a9fe',
        '2001:db8::1',
        // 6to4 (2002::/16) carrying loopback and the metadata address.
        '2002:7f00:1::',
        '2002:a9fe:a9fe::1',
        '2002:0a00:0001::',
        // Bits 16-48 only: the next hextets (here a public 1.1.142.250) are not the IPv4.
        '2002:c0a8:0101:8efa::',
        // IPv4-translated (::ffff:0:0/96).
        '::ffff:0:7f00:1',
        '::ffff:0:a9fe:a9fe',
        // Local-use NAT64 (64:ff9b:1::/48), whatever it embeds.
        '64:ff9b:1::a9fe:a9fe',
        '64:ff9b:1::8.8.8.8',
        // Documentation (3fff::/20) and SRv6 SIDs (5f00::/16).
        '3fff::1',
        '3fff:fff:ffff::1',
        '5f00::1',
        '5f00:ffff::1',
        'not-an-ip'
    ])('blocks %s', (address) => {
        expect(isBlockedAddress({ address })).toBe(true);
    });

    it.each([
        '142.250.79.46',
        '172.217.172.14',
        '8.8.8.8',
        '2800:3f0:4002:80a::200e',
        '::ffff:142.250.79.46',
        // The same families carrying or sitting next to a public address.
        '2002:8efa:4f2e::1',
        // 142.250.127.0, even though hextets 2-3 read as 127.0.0.0.
        '2002:8efa:7f00::',
        '::ffff:0:8efa:4f2e',
        '64:ff9b::8efa:4f2e',
        '3fff:1000::1',
        '5f01::1',
        '64:ff9b:2::1'
    ])('allows the public address %s', (address) => {
        expect(isBlockedAddress({ address })).toBe(false);
    });
});

describe('createGuardedLookup', () => {
    const answering =
        (addresses: readonly LookupAddress[]): MapsDnsLookup =>
        (_hostname, callback) =>
            callback(null, addresses);

    const lookupWith = (dns: MapsDnsLookup, all: boolean) =>
        new Promise<{ error: unknown; address: unknown; family?: number }>((resolve) => {
            createGuardedLookup({ dns })('maps.app.goo.gl', { all }, (error, address, family) =>
                resolve({ error, address, family })
            );
        });

    it('passes a public answer through to the socket', async () => {
        const result = await lookupWith(
            answering([{ address: '142.250.79.46', family: 4 }]),
            false
        );
        expect(result).toEqual({ error: null, address: '142.250.79.46', family: 4 });
    });

    it('passes every address through when the socket asks for all', async () => {
        const addresses = [
            { address: '142.250.79.46', family: 4 },
            { address: '2800:3f0:4002:80a::200e', family: 6 }
        ];
        const result = await lookupWith(answering(addresses), true);
        expect(result.address).toEqual(addresses);
    });

    it('refuses when ANY address of the answer is blocked (rebinding mix)', async () => {
        const result = await lookupWith(
            answering([
                { address: '142.250.79.46', family: 4 },
                { address: '169.254.169.254', family: 4 }
            ]),
            false
        );
        expect(result.error).toBeInstanceOf(MapsLinkAddressError);
    });

    it('refuses an empty answer and propagates a DNS error', async () => {
        expect((await lookupWith(answering([]), false)).error).toBeInstanceOf(MapsLinkAddressError);
        const failing: MapsDnsLookup = (_h, callback) =>
            callback(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }), []);
        expect((await lookupWith(failing, false)).error).toMatchObject({ code: 'ENOTFOUND' });
    });
});
