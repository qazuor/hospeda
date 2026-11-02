import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../../src/routes');
const EXPECTED_GET_PROTECTED_COUNT = 97;
// HOS-1703: empty on purpose; add a file only with a linked owner decision
const PENDING_OWNER_DECISION: readonly string[] = [];

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
            'accommodation/protected/qrSheet.ts',
            'accommodation-external-reputation/protected/listListings.ts'
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

describe('TEST:1703:4 service read gates use inspection permission', () => {
    it('the service read gates behind protected GET routes do not read ACCOMMODATION_UPDATE_ANY', () => {
        const serviceRoot = join(
            import.meta.dirname,
            '../../../../packages/service-core/src/services/accommodation'
        );
        const occupancy = withoutComments(
            readFileSync(join(serviceRoot, 'accommodation.occupancy.ts'), 'utf8')
        );
        const media = withoutComments(
            readFileSync(join(serviceRoot, 'accommodation.media-reader.ts'), 'utf8')
        );
        const readGate = occupancy.match(/function isOwnerOrInspector\([\s\S]*?\n}/)?.[0];
        const accessGate = occupancy.match(/function assertOwnerReadAccess\([\s\S]*?\n}/)?.[0];
        expect(readGate, 'isOwnerOrInspector block must be instrumented').toBeDefined();
        expect(accessGate, 'assertOwnerReadAccess block must be instrumented').toBeDefined();
        expect(`${readGate}\n${accessGate}`).not.toMatch(/ACCOMMODATION_UPDATE_ANY\b/);
        expect(`${readGate}\n${accessGate}`).toMatch(/ACCOMMODATION_VIEW_ALL\b/);
        expect(media).not.toMatch(/UPDATE_ANY\b/);
        expect(media).toMatch(/ACCOMMODATION_VIEW_ALL\b/);
    });
});
