/**
 * @file platform-tags.test.ts
 * @description Source-based tests for the internal + system tag CRUD pages
 * relocated from /tags/internal and /tags/system to /platform/tags/internal
 * and /platform/tags/system as part of SPEC-156 PR-2 (T-025). Verifies the
 * route registrations and that the internal Link refs were repointed at
 * the new paths so list <-> create <-> edit navigation still works.
 *
 * `/tags/post-tags` and `/tags/user-moderation` stay at their original
 * paths; only sidebar refs change (T-026).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const namespaces = ['internal', 'system'] as const;

describe('platform/tags/{internal,system} (T-025)', () => {
    for (const ns of namespaces) {
        describe(`namespace: ${ns}`, () => {
            const indexSrc = readFileSync(
                resolve(__dirname, `../../src/routes/_authed/platform/tags/${ns}/index.tsx`),
                'utf8'
            );
            const newSrc = readFileSync(
                resolve(__dirname, `../../src/routes/_authed/platform/tags/${ns}/new.tsx`),
                'utf8'
            );
            const editSrc = readFileSync(
                resolve(__dirname, `../../src/routes/_authed/platform/tags/${ns}/$id_.edit.tsx`),
                'utf8'
            );

            it('registers the index route at the new path', () => {
                expect(indexSrc).toContain(`createFileRoute('/_authed/platform/tags/${ns}/')`);
            });

            it('registers the create route at the new path', () => {
                expect(newSrc).toContain(`createFileRoute('/_authed/platform/tags/${ns}/new')`);
            });

            it('registers the edit route at the new path', () => {
                expect(editSrc).toContain(
                    `createFileRoute('/_authed/platform/tags/${ns}/$id_/edit')`
                );
            });

            it('list -> create Link points at the new namespace path', () => {
                expect(indexSrc).toContain(`to="/platform/tags/${ns}/new"`);
            });

            it('list -> edit Link uses the new namespace path with $id placeholder', () => {
                expect(indexSrc).toContain(`to="/platform/tags/${ns}/$id/edit"`);
            });

            it('create cancel + post-submit redirect target the new list path', () => {
                expect(newSrc).toContain(`to: '/platform/tags/${ns}'`);
                expect(newSrc).toContain(`to="/platform/tags/${ns}"`);
            });

            it('edit cancel + post-submit redirect target the new list path', () => {
                expect(editSrc).toContain(`to: '/platform/tags/${ns}'`);
                expect(editSrc).toContain(`to="/platform/tags/${ns}"`);
            });
        });
    }
});
