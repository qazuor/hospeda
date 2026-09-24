import { describe, expect, it } from 'bun:test';
import { runEngram } from '../src/commands/engram/engram.ts';

describe('engram wrapper guards', () => {
    it('requires confirmation for export and nested consolidation', async () => {
        expect(await runEngram({ argv: ['export'] })).toBe(2);
        expect(await runEngram({ argv: ['projects', 'consolidate'] })).toBe(2);
        expect(await runEngram({ argv: ['conflicts', 'scan', '--apply'] })).toBe(2);
        expect(await runEngram({ argv: ['conflicts', 'deferred', '--replay'] })).toBe(2);
    });
});
