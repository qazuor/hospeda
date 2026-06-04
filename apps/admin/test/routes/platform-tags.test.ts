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
 *
 * NOTE (SPEC-185 T-014): The `internal` index route was migrated onto
 * `createEntityListPage`. The Link references for create/edit navigation
 * moved from `index.tsx` into the columns config file. The assertions for
 * those routes now scan the columns config instead of the route index.
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

            // For the 'internal' namespace the index is migrated to the framework
            // (SPEC-185 T-014) — create link lives in the config file, edit link
            // in the columns config. For 'system' (not yet migrated) both stay in index.tsx.
            const internalConfigSrc =
                ns === 'internal'
                    ? readFileSync(
                          resolve(
                              __dirname,
                              '../../src/features/tags/internal/config/internal-tags.config.ts'
                          ),
                          'utf8'
                      )
                    : null;
            const internalColumnsSrc =
                ns === 'internal'
                    ? readFileSync(
                          resolve(
                              __dirname,
                              '../../src/features/tags/internal/config/internal-tags.columns.ts'
                          ),
                          'utf8'
                      )
                    : null;
            // Combined source for nav assertions (index + config + columns for migrated lists)
            const listNavSrc =
                ns === 'internal'
                    ? `${internalConfigSrc ?? ''}\n${internalColumnsSrc ?? ''}`
                    : indexSrc;

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
                // For migrated lists the link lives in the columns config (createElement
                // calls use single-quoted TS strings); for un-migrated, JSX double-quoted.
                const createLinkJsx = `to="/platform/tags/${ns}/new"`;
                const createLinkTs = `'/platform/tags/${ns}/new'`;
                expect(
                    listNavSrc.includes(createLinkJsx) || listNavSrc.includes(createLinkTs)
                ).toBe(true);
            });

            it('list -> edit Link uses the new namespace path with $id placeholder', () => {
                // For migrated lists the link lives in the columns config (single-quoted TS);
                // for un-migrated, JSX double-quoted.
                const editLinkJsx = `to="/platform/tags/${ns}/$id/edit"`;
                const editLinkTs = `'/platform/tags/${ns}/$id/edit'`;
                expect(listNavSrc.includes(editLinkJsx) || listNavSrc.includes(editLinkTs)).toBe(
                    true
                );
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
