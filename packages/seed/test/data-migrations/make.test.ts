/**
 * @fileoverview
 * Tests for the data-migration scaffold generator (HOS-25, T-013):
 * {@link makeMigration}.
 *
 * Uses a fresh temp directory (Node `fs.mkdtemp` under `os.tmpdir()`) per
 * test run so nothing ever gets written into the real
 * `src/data-migrations/` source tree.
 */
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeMigration } from '../../src/data-migrations/make.js';

describe('HOS-25 T-013: makeMigration', () => {
    let dir: string;

    beforeEach(async () => {
        dir = await mkdtemp(path.join(tmpdir(), 'hos25-make-migration-'));
    });

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    it('creates 0001-<slug>.ts when the directory is empty', async () => {
        const result = await makeMigration({ slug: 'add-wifi-amenity', dir });

        expect(result.name).toBe('0001-add-wifi-amenity');
        expect(result.filePath).toBe(path.join(dir, '0001-add-wifi-amenity.ts'));

        const entries = await readdir(dir);
        expect(entries).toContain('0001-add-wifi-amenity.ts');
    });

    it('computes the next prefix from consecutive existing files (max + 1)', async () => {
        await makeMigration({ slug: 'first', dir });
        await makeMigration({ slug: 'second', dir });

        const result = await makeMigration({ slug: 'third', dir });
        expect(result.name).toBe('0003-third');
    });

    it('picks up an existing gapped sequence and computes next as max + 1, not count + 1', async () => {
        // Arrange: seed the dir with 0001-*.ts and 0003-*.ts directly (no
        // 0002-*.ts), so max=3 and count=2 — next must be 0004 (max+1), never
        // 0003 (count+1).
        await writeFile(path.join(dir, '0001-alpha.ts'), '// fixture placeholder\n');
        await writeFile(path.join(dir, '0003-charlie.ts'), '// fixture placeholder\n');

        const result = await makeMigration({ slug: 'delta', dir });
        expect(result.name).toBe('0004-delta');
    });

    it('emits a file whose meta.name equals the filename stem', async () => {
        const result = await makeMigration({
            slug: 'remove-legacy-feature',
            dir,
            group: 'example'
        });

        const mod = (await import(result.filePath)) as {
            meta: { name: string; group: string; destructive: boolean };
            up: (ctx: unknown) => Promise<unknown>;
        };

        expect(mod.meta.name).toBe(result.name);
        expect(mod.meta.group).toBe('example');
        expect(mod.meta.destructive).toBe(false);
        expect(typeof mod.up).toBe('function');
    });

    it('defaults group to "required" and destructive to false', async () => {
        const result = await makeMigration({ slug: 'default-group', dir });

        const mod = (await import(result.filePath)) as {
            meta: { name: string; group: string; destructive: boolean };
        };

        expect(mod.meta.group).toBe('required');
        expect(mod.meta.destructive).toBe(false);
    });

    it('respects an explicit destructive: true', async () => {
        const result = await makeMigration({ slug: 'drop-old-table', dir, destructive: true });

        const mod = (await import(result.filePath)) as { meta: { destructive: boolean } };
        expect(mod.meta.destructive).toBe(true);
    });

    it.each([
        ['contains spaces', 'add wifi amenity'],
        ['has a .ts suffix', 'add-wifi-amenity.ts'],
        ['is empty', ''],
        ['is only whitespace', '   '],
        ['starts with a digit', '1-add-wifi'],
        ['has a leading hyphen', '-add-wifi'],
        ['has a trailing hyphen', 'add-wifi-'],
        ['has a double hyphen', 'add--wifi'],
        ['contains an underscore', 'add_wifi_amenity']
    ])('throws for an invalid slug that %s ("%s")', async (_label, slug) => {
        await expect(makeMigration({ slug, dir })).rejects.toThrow();
    });

    it('normalizes surrounding whitespace before validating (trim only)', async () => {
        const result = await makeMigration({ slug: '  add-wifi-amenity  ', dir });
        expect(result.name).toBe('0001-add-wifi-amenity');
    });

    it('normalizes uppercase input to lowercase (documented normalization)', async () => {
        const result = await makeMigration({ slug: 'Add-Wifi-Amenity', dir });
        expect(result.name).toBe('0001-add-wifi-amenity');
    });

    it('scaffolds sequential prefixes even when the slug repeats', async () => {
        const first = await makeMigration({ slug: 'alpha', dir });
        expect(first.name).toBe('0001-alpha');

        const second = await makeMigration({ slug: 'alpha', dir });
        expect(second.name).toBe('0002-alpha');
    });
});
