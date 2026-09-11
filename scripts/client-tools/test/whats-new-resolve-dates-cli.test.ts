import { describe, expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolveCatalogFilePath } from '../src/commands/whats-new/resolve-dates-cli.ts';

/**
 * Regression test for the 2026-09-11 first-real-run ENOENT (run 34647242767):
 * the resolve-dates workflow invokes this CLI with
 * `working-directory: scripts/client-tools`, and the CLI's old default was a
 * cwd-relative `apps/api/src/data/whats-new/whats-new.ts` — which resolved to
 * `scripts/client-tools/apps/api/...` and crashed before resolving any
 * marker. The default must be anchored to the CLI's own repo root, never the
 * process cwd.
 */
describe('resolveCatalogFilePath', () => {
    it('honors WHATS_NEW_FILE verbatim so tests can point at a temp copy', () => {
        expect(resolveCatalogFilePath({ envFile: '/tmp/custom-catalog.ts' })).toBe(
            '/tmp/custom-catalog.ts'
        );
    });

    it('anchors the default to the CLI own repo root — never the cwd (the workflow runs from scripts/client-tools)', () => {
        const originalCwd = process.cwd();
        try {
            // Any cwd outside the repo reproduces the workflow's conditions:
            // the old cwd-relative default resolved to `<cwd>/apps/api/...`
            // from here and did not exist.
            process.chdir(tmpdir());
            const path = resolveCatalogFilePath({});
            expect(path.endsWith('apps/api/src/data/whats-new/whats-new.ts')).toBe(true);
            expect(existsSync(path)).toBe(true);
        } finally {
            process.chdir(originalCwd);
        }
    });
});
