import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PermissionEnum } from '@repo/schemas';
import { ADMINISTRATIVE_ACTION_PERMISSIONS } from '@repo/verticals';
import { describe, expect, it } from 'vitest';
import { UNVERIFIED_STAFF_BYPASS_PERMISSIONS } from '../../src/middlewares/step2-staff-bypass';

const ROOT = join(import.meta.dirname, '../../src/routes');
const OWN_PERMISSIONS = [PermissionEnum.BILLING_VIEW_OWN];
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
const closedListRows = rows.filter(({ text }) =>
    /^\s*emailUnverifiedOperation:\s*'[A-Z_]+'[,]?\s*$/m.test(text)
);

describe('TEST:1692:7 the staff bypass set covers every permission read on a closed-list route', () => {
    it('includes every route permission read outside the own-read exception', () => {
        const allowed = new Set([...UNVERIFIED_STAFF_BYPASS_PERMISSIONS, ...OWN_PERMISSIONS]);
        for (const { file, text } of closedListRows) {
            for (const [, permission] of text.matchAll(/PermissionEnum\.([A-Z_]+)/g)) {
                expect(
                    allowed.has(PermissionEnum[permission as keyof typeof PermissionEnum]),
                    `${file}: ${permission}`
                ).toBe(true);
            }
        }
    });

    it('instruments the current 23 declarations and six route-read permissions', () => {
        const permissions = [
            ...new Set(
                closedListRows.flatMap(({ text }) =>
                    [...text.matchAll(/PermissionEnum\.([A-Z_]+)/g)].map(
                        ([, permission]) => permission
                    )
                )
            )
        ].sort();
        expect(closedListRows).toHaveLength(23);
        expect(permissions).toEqual([
            'ACCOMMODATION_VIEW_ALL',
            'BILLING_VIEW_OWN',
            'EXPERIENCE_VIEW_ALL',
            'VENUE_VIEW_ALL',
            'LISTING_FOREIGN_CONTENT_EDIT',
            'USER_READ_ALL'
        ]);
    });

    it('includes administrative action 15 and 23 permissions', () => {
        for (const permission of [
            ...ADMINISTRATIVE_ACTION_PERMISSIONS.ACC_15.permissions,
            ...ADMINISTRATIVE_ACTION_PERMISSIONS.ACC_23.permissions
        ]) {
            expect(UNVERIFIED_STAFF_BYPASS_PERMISSIONS).toContain(permission);
        }
    });
});
