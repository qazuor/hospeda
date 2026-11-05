import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findPartnerLegacyReferences, run } from '../check-partner-no-tier-and-dates.js';

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), 'utf8');

describe('TEST:V7:16 AC:V7:16 — readers use effective presence keys', () => {
    it('runs the existing legacy-field guard and proves its synthetic checks are active', () => {
        const result = run({ root });
        expect(result.exitCode).toBe(0);
        expect(result.output).toMatch(/across ([1-9][0-9]*) file\(s\)/);
        expect(
            findPartnerLegacyReferences([
                { file: 'apps/api/src/any-file.ts', content: `${['partners', 'tier'].join('.')};` },
                { file: 'apps/api/src/routes/partner/mine.ts', content: 'startsAt; ends_at;' }
            ])
        ).toEqual([
            { file: 'apps/api/src/any-file.ts', line: 1, name: 'tier' },
            { file: 'apps/api/src/routes/partner/mine.ts', line: 1, name: 'startsAt' },
            { file: 'apps/api/src/routes/partner/mine.ts', line: 1, name: 'ends_at' }
        ]);
    });

    it('wires public page and owner readers to the key and omits retired partner fields', () => {
        expect(source('apps/api/src/routes/partners/public/get-by-slug.ts')).toContain(
            'getPublicPartnerPage'
        );
        expect(
            source('apps/api/src/services/partner-presence/partner-presence-read.service.ts')
        ).toContain('EntitlementKeyEnum.PARTNER_PUBLIC_PAGE');
        expect(source('apps/api/src/routes/partners/protected/mine.ts')).toContain(
            'readOwnerPartnerPresence'
        );
        expect(source('apps/api/src/routes/partners/protected/mine-stats.ts')).toContain(
            'readOwnerPartnerPresence'
        );
        const mentions = source('apps/api/src/routes/partners/protected/mine-mentions.ts');
        expect(mentions).not.toMatch(/starts_at|ends_at|\btier\b/);
    });
});
