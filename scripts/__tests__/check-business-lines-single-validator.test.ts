import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    findBusinessLineViolations,
    run as runBillingBoundary
} from '../check-billing-verticals-boundary.js';
import {
    INVENTORY_PATH,
    run as runSingleValidator
} from '../check-business-lines-single-validator.js';

describe('TEST:2.4:3 G-FAC-09', () => {
    it('is wired into check:guards and the guards CI job', () => {
        const packageJson = JSON.parse(
            readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
        ) as {
            scripts: Record<string, string>;
        };
        expect(packageJson.scripts['check:business-lines-single-validator']).toBe(
            'tsx scripts/check-business-lines-single-validator.ts'
        );
        expect(packageJson.scripts['check:guards']).toContain(
            'pnpm check:business-lines-single-validator'
        );
        const ci = readFileSync(path.join(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
        expect(ci).toContain(
            'name: Check business lines use the single validator (GUARD:G-FAC-09)'
        );
        expect(ci).toContain('run: pnpm check:business-lines-single-validator');
    });

    it('passes the repository and detects an unlisted validator caller', () => {
        expect(runSingleValidator().exitCode).toBe(0);
        const inventory = {
            validateBusinessLines: [],
            resolveBusinessLineOptions: []
        } as const;
        const temp = mkdtempSync(path.join(tmpdir(), 'fac09-'));
        try {
            for (const file of ['apps/a.ts', 'packages/b.ts', 'scripts/c.ts']) {
                mkdirSync(path.dirname(path.join(temp, file)), { recursive: true });
                writeFileSync(path.join(temp, file), 'export const ok = 1;');
            }
            mkdirSync(path.dirname(path.join(temp, INVENTORY_PATH)), { recursive: true });
            writeFileSync(path.join(temp, INVENTORY_PATH), JSON.stringify(inventory));
            writeFileSync(
                path.join(temp, 'apps/a.ts'),
                'validateBusinessLines({ vertical: "venue" }); resolveBusinessLineOptions({ vertical: "venue" });'
            );
            const result = runSingleValidator({ root: temp, minScannedFiles: 1, inventory });
            expect(result.exitCode).toBe(1);
            expect(result.output).toContain('apps/a.ts has 1 validateBusinessLines call(s)');
            expect(result.output).toContain('apps/a.ts has 1 resolveBusinessLineOptions call(s)');
            expect(
                runSingleValidator({ root: temp, minScannedFiles: 4, inventory }).output
            ).toContain('scan: only 3 files scanned');
        } finally {
            rmSync(temp, { recursive: true, force: true });
        }
    });

    it('rejects local maximum checks and option filters', () => {
        // These are direct positive controls over the scanner predicate.
        const inventory = { validateBusinessLines: [], resolveBusinessLineOptions: [] } as const;
        const temp = mkdtempSync(path.join(tmpdir(), 'fac09-mut-'));
        try {
            for (const file of ['apps/a.ts', 'packages/b.ts', 'scripts/c.ts']) {
                mkdirSync(path.dirname(path.join(temp, file)), { recursive: true });
                writeFileSync(path.join(temp, file), 'export const ok = 1;');
            }
            mkdirSync(path.dirname(path.join(temp, INVENTORY_PATH)), { recursive: true });
            writeFileSync(path.join(temp, INVENTORY_PATH), JSON.stringify(inventory));
            writeFileSync(path.join(temp, 'apps/a.ts'), 'if (businessLines.length > 2) return;');
            writeFileSync(
                path.join(temp, 'packages/b.ts'),
                'const businessLines = options.filter(x => allowed.includes(x));'
            );
            const result = runSingleValidator({ root: temp, minScannedFiles: 1, inventory });
            expect(result.exitCode).toBe(1);
            expect(result.output).toContain('businessLines.length');
            expect(result.output).toContain('allowed.includes');
        } finally {
            rmSync(temp, { recursive: true, force: true });
        }
    });
});

describe('G-FAC-07 billing business-line boundary', () => {
    it('passes the repository and rejects rubro imports or fields in billing surfaces', () => {
        expect(runBillingBoundary().exitCode).toBe(0);
        expect(
            findBusinessLineViolations({
                files: {
                    'apps/api/src/routes/plan-catalog/response.ts':
                        'export const response = { businessLines: [] };'
                }
            })
        ).toHaveLength(1);
        expect(
            findBusinessLineViolations({
                files: {
                    'apps/api/src/routes/billing-promo/source.ts':
                        "import { BUSINESS_LINES } from '@repo/schemas/catalog/business-lines';"
                }
            })
        ).toHaveLength(1);
    });
});
