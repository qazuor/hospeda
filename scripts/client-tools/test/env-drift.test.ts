import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectEnvDrift } from '../src/commands/env/drift.ts';

function fixture() {
    const root = mkdtempSync(join(tmpdir(), 'hops-env-drift-'));
    mkdirSync(join(root, 'apps/api'), { recursive: true });
    mkdirSync(join(root, 'apps/web'), { recursive: true });
    mkdirSync(join(root, 'apps/admin'), { recursive: true });
    mkdirSync(join(root, 'docker'), { recursive: true });
    for (const file of [
        'apps/api/.env.local',
        'apps/web/.env.local',
        'apps/admin/.env.local',
        'docker/.env'
    ]) {
        writeFileSync(join(root, file), '');
    }
    return root;
}

describe('collectEnvDrift', () => {
    it('reports missing, obsolete, and required values by name only', () => {
        const root = fixture();
        writeFileSync(join(root, 'apps/api/.env.example'), 'REQUIRED=placeholder\n# OPTIONAL=\n');
        writeFileSync(join(root, 'apps/web/.env.example'), 'REQUIRED=placeholder\n');
        writeFileSync(join(root, 'apps/admin/.env.example'), 'REQUIRED=placeholder\n');
        writeFileSync(join(root, 'docker/.env.example'), 'DOCKER=placeholder\n');
        writeFileSync(
            join(root, 'apps/api/.env.local'),
            '# REQUIRED=\nOBSOLETE=secret\n# OPTIONAL=\n'
        );
        const report = collectEnvDrift({ root });
        expect(report.clean).toBe(false);
        expect(report.files[0]).toEqual({
            file: 'apps/api/.env.local',
            missing: [],
            requiredMissing: [],
            optionalMissing: [],
            obsolete: ['OBSOLETE'],
            needsValue: ['REQUIRED']
        });
        expect(JSON.stringify(report)).not.toContain('secret');
    });

    it('detects cross-app mismatches without returning values', () => {
        const root = fixture();
        for (const file of ['apps/api/.env.example', 'apps/web/.env.example'])
            writeFileSync(join(root, file), 'HOSPEDA_REVALIDATION_SECRET=\n');
        writeFileSync(join(root, 'apps/admin/.env.example'), '');
        writeFileSync(join(root, 'docker/.env.example'), '');
        writeFileSync(join(root, 'apps/api/.env.local'), 'HOSPEDA_REVALIDATION_SECRET=A\n');
        writeFileSync(join(root, 'apps/web/.env.local'), 'HOSPEDA_REVALIDATION_SECRET=B\n');
        const report = collectEnvDrift({ root });
        expect(report.mismatched).toEqual(['HOSPEDA_REVALIDATION_SECRET']);
        expect(JSON.stringify(report)).not.toContain('A"');
        expect(JSON.stringify(report)).not.toContain('B"');
    });

    it('does not block on an optional key absent from the local file', () => {
        const root = fixture();
        writeFileSync(join(root, 'apps/api/.env.example'), 'REQUIRED=placeholder\n# OPTIONAL=\n');
        writeFileSync(join(root, 'apps/web/.env.example'), '');
        writeFileSync(join(root, 'apps/admin/.env.example'), '');
        writeFileSync(join(root, 'docker/.env.example'), '');
        writeFileSync(join(root, 'apps/api/.env.local'), 'REQUIRED=value\n');

        const report = collectEnvDrift({ root });
        expect(report.clean).toBe(true);
        expect(report.files[0]?.missing).toEqual(['OPTIONAL']);
        expect(report.files[0]?.requiredMissing).toEqual([]);
        expect(report.files[0]?.optionalMissing).toEqual(['OPTIONAL']);
    });
});
