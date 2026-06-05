/**
 * Unit tests for the visitor-hash utility.
 *
 * Tests cover:
 *   - determinism: same inputs → same hash
 *   - date sensitivity: different days → different hash
 *   - UA sensitivity: different user agents → different hash
 *   - IP sensitivity: meaningfully different IPs → different hash
 *   - IP truncation: same /24 prefix (IPv4) → same hash regardless of last octet
 *   - IPv6 truncation: same first 4 groups → same hash regardless of last 4 groups
 *   - output format: hex string with no raw IP embedded
 *   - authenticated path: userId provided → 'user:<uuid>' prefix form
 *
 * @module test/utils/visitor-hash
 */

import { describe, expect, it } from 'vitest';
import { computeVisitorHash } from '../../src/utils/visitor-hash';

const SECRET = 'a-test-secret-that-is-at-least-32-characters-long';
const UA = 'Mozilla/5.0 (compatible; TestBot/1.0)';
const DATE = new Date('2024-03-15T12:00:00Z');
const IPV4 = '192.168.1.42';
const IPV6 = '2001:db8:85a3:0000:0000:8a2e:0370:7334';

describe('computeVisitorHash', () => {
    describe('determinism', () => {
        it('returns the same hash for identical inputs', () => {
            const hash1 = computeVisitorHash({
                ip: IPV4,
                userAgent: UA,
                date: DATE,
                secret: SECRET
            });
            const hash2 = computeVisitorHash({
                ip: IPV4,
                userAgent: UA,
                date: DATE,
                secret: SECRET
            });

            expect(hash1).toBe(hash2);
        });
    });

    describe('date sensitivity', () => {
        it('returns a different hash for a different day', () => {
            const dateA = new Date('2024-03-15T00:00:00Z');
            const dateB = new Date('2024-03-16T00:00:00Z');

            const hashA = computeVisitorHash({
                ip: IPV4,
                userAgent: UA,
                date: dateA,
                secret: SECRET
            });
            const hashB = computeVisitorHash({
                ip: IPV4,
                userAgent: UA,
                date: dateB,
                secret: SECRET
            });

            expect(hashA).not.toBe(hashB);
        });

        it('returns the same hash for two timestamps within the same UTC day', () => {
            const dateA = new Date('2024-03-15T08:00:00Z');
            const dateB = new Date('2024-03-15T23:59:59Z');

            const hashA = computeVisitorHash({
                ip: IPV4,
                userAgent: UA,
                date: dateA,
                secret: SECRET
            });
            const hashB = computeVisitorHash({
                ip: IPV4,
                userAgent: UA,
                date: dateB,
                secret: SECRET
            });

            expect(hashA).toBe(hashB);
        });
    });

    describe('user agent sensitivity', () => {
        it('returns a different hash when the user agent changes', () => {
            const hashA = computeVisitorHash({
                ip: IPV4,
                userAgent: 'Chrome/120',
                date: DATE,
                secret: SECRET
            });
            const hashB = computeVisitorHash({
                ip: IPV4,
                userAgent: 'Firefox/119',
                date: DATE,
                secret: SECRET
            });

            expect(hashA).not.toBe(hashB);
        });
    });

    describe('IPv4 truncation', () => {
        it('returns the same hash when only the last IPv4 octet differs (same /24)', () => {
            const hashA = computeVisitorHash({
                ip: '10.0.0.1',
                userAgent: UA,
                date: DATE,
                secret: SECRET
            });
            const hashB = computeVisitorHash({
                ip: '10.0.0.254',
                userAgent: UA,
                date: DATE,
                secret: SECRET
            });

            expect(hashA).toBe(hashB);
        });

        it('returns a different hash when a non-last IPv4 octet differs', () => {
            const hashA = computeVisitorHash({
                ip: '10.0.0.1',
                userAgent: UA,
                date: DATE,
                secret: SECRET
            });
            const hashB = computeVisitorHash({
                ip: '10.0.1.1',
                userAgent: UA,
                date: DATE,
                secret: SECRET
            });

            expect(hashA).not.toBe(hashB);
        });

        it('returns a different hash when the first IPv4 octet differs', () => {
            const hashA = computeVisitorHash({
                ip: '10.0.0.1',
                userAgent: UA,
                date: DATE,
                secret: SECRET
            });
            const hashB = computeVisitorHash({
                ip: '11.0.0.1',
                userAgent: UA,
                date: DATE,
                secret: SECRET
            });

            expect(hashA).not.toBe(hashB);
        });
    });

    describe('IPv6 truncation', () => {
        it('returns the same hash when only the last 4 IPv6 groups differ', () => {
            const hashA = computeVisitorHash({
                ip: '2001:db8:85a3:0000:0000:8a2e:0370:7334',
                userAgent: UA,
                date: DATE,
                secret: SECRET
            });
            const hashB = computeVisitorHash({
                ip: '2001:db8:85a3:0000:9999:ffff:aaaa:bbbb',
                userAgent: UA,
                date: DATE,
                secret: SECRET
            });

            expect(hashA).toBe(hashB);
        });

        it('returns a different hash when any of the first 4 IPv6 groups differ', () => {
            const hashA = computeVisitorHash({
                ip: '2001:db8:85a3:0000:0000:8a2e:0370:7334',
                userAgent: UA,
                date: DATE,
                secret: SECRET
            });
            const hashB = computeVisitorHash({
                ip: '2001:db8:85a3:0001:0000:8a2e:0370:7334',
                userAgent: UA,
                date: DATE,
                secret: SECRET
            });

            expect(hashA).not.toBe(hashB);
        });
    });

    describe('output format', () => {
        it('returns a lowercase hex string', () => {
            const hash = computeVisitorHash({
                ip: IPV4,
                userAgent: UA,
                date: DATE,
                secret: SECRET
            });

            expect(hash).toMatch(/^[0-9a-f]+$/);
        });

        it('does not contain the raw IPv4 address as a substring', () => {
            const hash = computeVisitorHash({
                ip: IPV4,
                userAgent: UA,
                date: DATE,
                secret: SECRET
            });

            expect(hash).not.toContain(IPV4);
        });

        it('does not contain the raw IPv6 address as a substring', () => {
            const hash = computeVisitorHash({
                ip: IPV6,
                userAgent: UA,
                date: DATE,
                secret: SECRET
            });

            expect(hash).not.toContain(IPV6.toLowerCase());
        });

        it('does not contain the truncated IPv4 prefix as a substring', () => {
            const hash = computeVisitorHash({
                ip: '203.0.113.99',
                userAgent: UA,
                date: DATE,
                secret: SECRET
            });

            expect(hash).not.toContain('203.0.113');
        });
    });

    describe('authenticated path (userId)', () => {
        it('returns user:<uuid> form when userId is provided', () => {
            const userId = '550e8400-e29b-41d4-a716-446655440000';
            const hash = computeVisitorHash({
                ip: IPV4,
                userAgent: UA,
                date: DATE,
                secret: SECRET,
                userId
            });

            expect(hash).toBe(`user:${userId}`);
        });

        it('ignores ip and userAgent when userId is provided', () => {
            const userId = '550e8400-e29b-41d4-a716-446655440000';
            const hashA = computeVisitorHash({
                ip: '1.2.3.4',
                userAgent: 'AgentA',
                date: DATE,
                secret: SECRET,
                userId
            });
            const hashB = computeVisitorHash({
                ip: '5.6.7.8',
                userAgent: 'AgentB',
                date: DATE,
                secret: SECRET,
                userId
            });

            expect(hashA).toBe(hashB);
            expect(hashA).toBe(`user:${userId}`);
        });
    });

    describe('secret sensitivity', () => {
        it('returns a different hash when the secret changes', () => {
            const secretA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
            const secretB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

            const hashA = computeVisitorHash({
                ip: IPV4,
                userAgent: UA,
                date: DATE,
                secret: secretA
            });
            const hashB = computeVisitorHash({
                ip: IPV4,
                userAgent: UA,
                date: DATE,
                secret: secretB
            });

            expect(hashA).not.toBe(hashB);
        });
    });

    describe('getClientIp trust-chain prefixes (regression — review finding)', () => {
        it('strips the proxy: prefix so the embedded IPv4 is still /24-truncated', () => {
            // Without prefix stripping, 'proxy:192.168.1.5' contains a colon and
            // would be misparsed as IPv6, skipping truncation entirely.
            const hashPrefixedA = computeVisitorHash({
                ip: 'proxy:192.168.1.5',
                userAgent: UA,
                date: DATE,
                secret: SECRET
            });
            const hashPrefixedB = computeVisitorHash({
                ip: 'proxy:192.168.1.200',
                userAgent: UA,
                date: DATE,
                secret: SECRET
            });
            const hashClean = computeVisitorHash({
                ip: '192.168.1.99',
                userAgent: UA,
                date: DATE,
                secret: SECRET
            });

            // Same /24 → same hash, prefix or not.
            expect(hashPrefixedA).toBe(hashPrefixedB);
            expect(hashPrefixedA).toBe(hashClean);
        });

        it('strips internal: and untrusted: prefixes equivalently', () => {
            const base = computeVisitorHash({
                ip: '10.0.0.1',
                userAgent: UA,
                date: DATE,
                secret: SECRET
            });

            for (const prefixed of ['internal:10.0.0.1', 'untrusted:10.0.0.1']) {
                const hash = computeVisitorHash({
                    ip: prefixed,
                    userAgent: UA,
                    date: DATE,
                    secret: SECRET
                });
                expect(hash).toBe(base);
            }
        });

        it("hashes the literal 'unknown' sentinel without throwing", () => {
            const hash = computeVisitorHash({
                ip: 'unknown',
                userAgent: UA,
                date: DATE,
                secret: SECRET
            });

            expect(hash).toMatch(/^[0-9a-f]{64}$/);
        });
    });
});
