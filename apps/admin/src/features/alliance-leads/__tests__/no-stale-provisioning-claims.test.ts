/**
 * HOS-2339 AC-5.2: the comments and the route description that used to say
 * approving a lead never provisions anything must not come back. Since HOS-278
 * approving a `service_provider` lead provisions its listing.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ADMIN_FEATURE = resolve(__dirname, '..');
const API_ROUTE = resolve(
    __dirname,
    '../../../../../api/src/routes/alliance/admin/mark-handled.ts'
);

const FILES = [
    resolve(ADMIN_FEATURE, 'components/AllianceLeadInbox.tsx'),
    resolve(ADMIN_FEATURE, 'hooks/useAllianceLeads.ts'),
    resolve(ADMIN_FEATURE, '__tests__/alliance-leads.test.tsx'),
    API_ROUTE
];

const STALE = [/NO "Approve & provision"/i, /never auto-provisions/i, /no "Approve & provision"/i];

describe('stale "never provisions" claims (HOS-2339)', () => {
    it.each(FILES)('%s carries none of the retired sentences', (file) => {
        const content = readFileSync(file, 'utf8');
        expect(content.length).toBeGreaterThan(0);
        for (const pattern of STALE) {
            expect(content).not.toMatch(pattern);
        }
    });

    it('the mark-handled description states that approval provisions and names the field', () => {
        const content = readFileSync(API_ROUTE, 'utf8');
        expect(content).toContain('provisions its directory listing');
        expect(content).toContain('`provisioning` field');
    });
});
