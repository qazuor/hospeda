/**
 * Unit tests for `isBlockedAddress` (pure IP classification logic).
 *
 * No mocking required — these are pure functions with no side effects.
 */

import { describe, expect, it } from 'vitest';
import { isBlockedAddress } from '../src/safe-fetch-ip';

// ---------------------------------------------------------------------------
// isBlockedAddress — pure unit tests (no mocks needed)
// ---------------------------------------------------------------------------

describe('isBlockedAddress', () => {
    describe('IPv4 — blocked ranges', () => {
        it('blocks 127.0.0.1 (loopback)', () => {
            expect(isBlockedAddress('127.0.0.1')).toBe(true);
        });

        it('blocks 127.255.255.255 (loopback boundary)', () => {
            expect(isBlockedAddress('127.255.255.255')).toBe(true);
        });

        it('blocks 10.1.2.3 (RFC 1918 10/8)', () => {
            expect(isBlockedAddress('10.1.2.3')).toBe(true);
        });

        it('blocks 10.0.0.1 (RFC 1918 10/8 base)', () => {
            expect(isBlockedAddress('10.0.0.1')).toBe(true);
        });

        it('blocks 192.168.1.1 (RFC 1918 192.168/16)', () => {
            expect(isBlockedAddress('192.168.1.1')).toBe(true);
        });

        it('blocks 172.16.5.5 (RFC 1918 172.16/12)', () => {
            expect(isBlockedAddress('172.16.5.5')).toBe(true);
        });

        it('blocks 172.31.255.255 (RFC 1918 172.16/12 boundary)', () => {
            expect(isBlockedAddress('172.31.255.255')).toBe(true);
        });

        it('blocks 169.254.169.254 (cloud IMDS / link-local)', () => {
            // AWS/GCP/Azure instance metadata endpoint — critical SSRF target.
            expect(isBlockedAddress('169.254.169.254')).toBe(true);
        });

        it('blocks 169.254.0.1 (link-local range start)', () => {
            expect(isBlockedAddress('169.254.0.1')).toBe(true);
        });

        it('blocks 100.64.0.1 (CGNAT RFC 6598)', () => {
            expect(isBlockedAddress('100.64.0.1')).toBe(true);
        });

        it('blocks 100.127.255.255 (CGNAT boundary)', () => {
            expect(isBlockedAddress('100.127.255.255')).toBe(true);
        });

        it('blocks 0.0.0.0 (this-network)', () => {
            expect(isBlockedAddress('0.0.0.0')).toBe(true);
        });
    });

    describe('IPv4 — public addresses allowed', () => {
        it('allows 93.184.216.34 (example.com)', () => {
            expect(isBlockedAddress('93.184.216.34')).toBe(false);
        });

        it('allows 8.8.8.8 (Google DNS)', () => {
            expect(isBlockedAddress('8.8.8.8')).toBe(false);
        });

        it('allows 1.1.1.1 (Cloudflare DNS)', () => {
            expect(isBlockedAddress('1.1.1.1')).toBe(false);
        });

        it('does not block 172.32.0.1 (just outside 172.16/12)', () => {
            expect(isBlockedAddress('172.32.0.1')).toBe(false);
        });

        it('does not block 11.0.0.1 (outside 10/8)', () => {
            expect(isBlockedAddress('11.0.0.1')).toBe(false);
        });
    });

    describe('IPv6 — blocked ranges', () => {
        it('blocks ::1 (loopback)', () => {
            expect(isBlockedAddress('::1')).toBe(true);
        });

        it('blocks fe80::1 (link-local)', () => {
            expect(isBlockedAddress('fe80::1')).toBe(true);
        });

        it('blocks fe80::dead:beef (link-local)', () => {
            expect(isBlockedAddress('fe80::dead:beef')).toBe(true);
        });

        it('blocks fc00::1 (ULA)', () => {
            expect(isBlockedAddress('fc00::1')).toBe(true);
        });

        it('blocks fd00::1 (ULA fd prefix)', () => {
            expect(isBlockedAddress('fd00::1')).toBe(true);
        });

        it('blocks ::ffff:127.0.0.1 (IPv4-mapped loopback, dotted)', () => {
            expect(isBlockedAddress('::ffff:127.0.0.1')).toBe(true);
        });

        it('blocks ::ffff:192.168.1.1 (IPv4-mapped private, dotted)', () => {
            expect(isBlockedAddress('::ffff:192.168.1.1')).toBe(true);
        });

        it('blocks ::ffff:c0a8:0101 (IPv4-mapped 192.168.1.1, hex)', () => {
            expect(isBlockedAddress('::ffff:c0a8:0101')).toBe(true);
        });

        it('blocks ::ffff:7f00:0001 (IPv4-mapped 127.0.0.1, hex)', () => {
            expect(isBlockedAddress('::ffff:7f00:0001')).toBe(true);
        });
    });

    describe('IPv6 — public addresses allowed', () => {
        it('allows 2606:2800::1 (example.com IPv6)', () => {
            expect(isBlockedAddress('2606:2800::1')).toBe(false);
        });

        it('allows 2001:4860:4860::8888 (Google DNS IPv6)', () => {
            expect(isBlockedAddress('2001:4860:4860::8888')).toBe(false);
        });

        it('allows 2001:db8::1 (documentation range, not blocked by policy)', () => {
            // RFC 3849 documentation range is NOT in our explicit block list.
            expect(isBlockedAddress('2001:db8::1')).toBe(false);
        });
    });
});
