import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../../src/routes');
const EXPECTED_GET_PROTECTED_COUNT = 97;
const PENDING_OWNER_DECISION = [
    // HOS-1693 D-1: pending owner decision; remove when it moves to the inspection permission
    'accommodation-external-reputation/protected/listListings.ts'
];

function files(dir: string, prefix = ''): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) return files(join(dir, entry.name), relative);
        return entry.name.endsWith('.ts') ? [relative] : [];
    });
}

function withoutComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const rows = files(ROOT).map((file) => ({
    file,
    text: withoutComments(readFileSync(join(ROOT, file), 'utf8'))
}));
const protectedGets = rows.filter(
    ({ file, text }) =>
        file.split('/').includes('protected') && /^\s*method:\s*'get',?\s*$/m.test(text)
);

describe('TEST:1693:4 no protected GET route reads ACCOMMODATION_UPDATE_ANY as a read bypass', () => {
    it('has no write-permission bypass except declared owner decisions', () => {
        const pending = new Set(PENDING_OWNER_DECISION);
        for (const { file, text } of protectedGets) {
            if (!pending.has(file)) {
                expect(text, file).not.toMatch(/PermissionEnum\.ACCOMMODATION_UPDATE_ANY\b/);
            }
        }
    });

    it('keeps every pending owner decision as a GET protected route that reads UPDATE_ANY', () => {
        for (const file of PENDING_OWNER_DECISION) {
            const row = protectedGets.find((candidate) => candidate.file === file);
            expect(row, `${file} must exist as a GET protected route`).toBeDefined();
            expect(row?.text, `${file} must still read UPDATE_ANY`).toMatch(
                /PermissionEnum\.ACCOMMODATION_UPDATE_ANY\b/
            );
        }
    });

    it('instruments this sheet and the current protected GET route count', () => {
        const sheetFiles = [
            'accommodation/protected/getById.ts',
            'accommodation/protected/qrCode.ts',
            'accommodation/protected/qrSheet.ts'
        ];
        for (const file of sheetFiles) {
            const row = protectedGets.find((candidate) => candidate.file === file);
            expect(row, `${file} must be matched as GET protected`).toBeDefined();
            expect(row?.text, `${file} must use the inspection permission`).toMatch(
                /PermissionEnum\.ACCOMMODATION_VIEW_ALL\b/
            );
        }
        expect(protectedGets).toHaveLength(EXPECTED_GET_PROTECTED_COUNT);
    });
});
