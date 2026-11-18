/**
 * HOS-2335 §5.5 / AC-C23d — the default hop fetcher refuses a hop whose host
 * resolves to a blocked address BEFORE any socket connects: the guarded lookup
 * is the socket's own lookup. The DNS function is injected, so these tests
 * never reach the network (a blocked or aborted hop never opens a connection).
 *
 * @module test/mcp/tools/listing/google-maps-link-fetcher
 */

import { describe, expect, it, vi } from 'vitest';

import {
    createNodeMapsHopFetcher,
    MapsLinkTimeoutError
} from '../../../../src/mcp/tools/listing/google-maps-link-fetcher';
import {
    type MapsDnsLookup,
    MapsLinkAddressError
} from '../../../../src/mcp/tools/listing/google-maps-link-guard';

const URL_UNDER_TEST = new URL('https://maps.app.goo.gl/AbC');

describe('createNodeMapsHopFetcher', () => {
    it.each([
        '169.254.169.254',
        '127.0.0.1',
        '10.0.0.5',
        '::1'
    ])('refuses before connecting when DNS answers %s', async (address) => {
        // Arrange
        const dns = vi.fn<MapsDnsLookup>((_host, callback) =>
            callback(null, [{ address, family: address.includes(':') ? 6 : 4 }])
        );
        const fetchHop = createNodeMapsHopFetcher({ dns });

        // Act
        const hop = fetchHop({
            url: URL_UNDER_TEST,
            method: 'HEAD',
            signal: new AbortController().signal
        });

        // Assert
        await expect(hop).rejects.toBeInstanceOf(MapsLinkAddressError);
        expect(dns).toHaveBeenCalledWith('maps.app.goo.gl', expect.any(Function));
    });

    it('never starts a hop whose signal is already aborted', async () => {
        // Arrange
        const dns = vi.fn<MapsDnsLookup>();
        const controller = new AbortController();
        controller.abort();

        // Act
        const hop = createNodeMapsHopFetcher({ dns })({
            url: URL_UNDER_TEST,
            method: 'HEAD',
            signal: controller.signal
        });

        // Assert
        await expect(hop).rejects.toBeInstanceOf(MapsLinkTimeoutError);
        expect(dns).not.toHaveBeenCalled();
    });
});
