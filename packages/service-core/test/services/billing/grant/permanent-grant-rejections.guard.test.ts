import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('GUARD: the permanent grant acts authorize and every rejection is typed', () => {
    const sourceDir = resolve(import.meta.dirname, '../../../../src/services/billing/grant');
    const files = readdirSync(sourceDir).filter((name) => name.endsWith('.ts'));
    const sources = new Map(
        files.map((name) => [name, readFileSync(join(sourceDir, name), 'utf8')])
    );
    const authorization = sources.get('permanent-grant-authorization.ts') ?? '';
    const allowlist = new Set(
        authorization.match(
            /'((?:PERMANENT_GRANT_[A-Z_]+|INVALID_PERMANENT_GRANT_INPUT|ADMINISTRATIVE_ACTION_FORBIDDEN))'/g
        ) ?? []
    );

    it('scans the grant source module set including the shared authorization module', () => {
        expect(files.length).toBeGreaterThanOrEqual(4);
        expect(sources.has('permanent-grant-authorization.ts')).toBe(true);
    });

    it('keeps both authorization checks and an actor on every write act', () => {
        for (const name of [
            'grantPermanentGrant',
            'anchorPermanentGrantVertical',
            'resumePermanentGrant'
        ]) {
            const source = [...sources.values()].join('\n');
            const start = source.indexOf(`export async function ${name}`);
            expect(start, `${name} must remain exported`).toBeGreaterThanOrEqual(0);
            const next = source.indexOf('\nexport ', start + 1);
            const body = source.slice(start, next < 0 ? undefined : next);
            expect(body).toContain('assertPermanentGrantPermitted(');
            expect(body).toContain('assertPermanentGrantSubject(');
            expect(body.slice(0, body.indexOf('): Promise<'))).toMatch(/actor\s*:\s*Actor/);
        }
    });

    it('registers every rejection literal and maps its ServiceError code consistently', () => {
        const reasons =
            /'(?:PERMANENT_GRANT_[A-Z_]+|INVALID_PERMANENT_GRANT_INPUT|ADMINISTRATIVE_ACTION_FORBIDDEN)'/g;
        const exceptions = new Map([
            [
                "'PERMANENT_GRANT_ROW_CHANGED'",
                'HOS-1583 internal optimistic-write marker, not a caller rejection'
            ],
            ["'PERMANENT_GRANT_ADDON'", 'S20 domain-event kind, not a caller rejection']
        ]);
        for (const [name, source] of sources) {
            if (name === 'permanent-grant-authorization.ts') continue;
            for (const reason of source.match(reasons) ?? []) {
                if (exceptions.has(reason)) continue;
                expect(allowlist.has(reason), `${name} has unregistered reason ${reason}`).toBe(
                    true
                );
            }
            const mapped =
                /new ServiceError\(ServiceErrorCode\.([A-Z_]+),[\s\S]{0,280}?'((?:PERMANENT_GRANT_[A-Z_]+|INVALID_PERMANENT_GRANT_INPUT|ADMINISTRATIVE_ACTION_FORBIDDEN))'/g;
            for (const match of source.matchAll(mapped)) {
                const reason = match[2]!;
                if (!allowlist.has(`'${reason}'`)) continue;
                const expected =
                    reason === 'ADMINISTRATIVE_ACTION_FORBIDDEN'
                        ? 'FORBIDDEN'
                        : reason === 'PERMANENT_GRANT_NOT_FOUND'
                          ? 'NOT_FOUND'
                          : [
                                  'PERMANENT_GRANT_ALREADY_LIVE',
                                  'PERMANENT_GRANT_VERTICAL_ALREADY_ANCHORED'
                              ].includes(reason)
                            ? 'ALREADY_EXISTS'
                            : 'VALIDATION_ERROR';
                expect(match[1], `${name}: ${reason}`).toBe(expected);
            }
        }
    });

    it('never authorizes by role', () => {
        for (const [name, source] of sources) {
            expect(source, name).not.toMatch(/\.roles\b/);
            expect(source, name).not.toMatch(/import[^;]*\bRoleEnum\b/s);
        }
    });
});
