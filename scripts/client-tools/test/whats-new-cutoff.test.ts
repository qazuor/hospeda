import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    CUTOFF_FILE_PATH,
    parseCutoffFile,
    readCutoffSha
} from '../src/commands/whats-new/cutoff.ts';

const REPO_ROOT = join(import.meta.dir, '..', '..', '..');

describe('parseCutoffFile', () => {
    it('should return null for a file with only comments', () => {
        expect(parseCutoffFile({ content: '# a comment\n# another\n' })).toBeNull();
    });

    it('should return null for an empty file', () => {
        expect(parseCutoffFile({ content: '' })).toBeNull();
    });

    it('should return the first non-comment, non-blank line', () => {
        expect(parseCutoffFile({ content: '# header\n\nabc123def456\n# trailing\n' })).toBe(
            'abc123def456'
        );
    });

    it('should trim surrounding whitespace on the SHA line', () => {
        expect(parseCutoffFile({ content: '  abc123  \n' })).toBe('abc123');
    });

    it('should ignore blank lines between comments and the value', () => {
        expect(parseCutoffFile({ content: '\n\n# c\n\nsha-value\n' })).toBe('sha-value');
    });
});

describe('readCutoffSha', () => {
    it('should return null when the file does not exist at the given root', () => {
        expect(readCutoffSha({ repoRoot: '/definitely/not/a/real/path/xyz' })).toBeNull();
    });

    it('should read null (unconfigured) from the real repo cutoff file today', () => {
        // Locks in the documented "explicit unset" state (HOS-1214 block 2):
        // the workflow that will populate this file does not exist yet.
        const path = join(REPO_ROOT, CUTOFF_FILE_PATH);
        expect(existsSync(path)).toBe(true);
        expect(readCutoffSha({ repoRoot: REPO_ROOT })).toBeNull();
    });

    it('should have the real file readable as UTF-8 text (sanity check on the fixture path)', () => {
        const path = join(REPO_ROOT, CUTOFF_FILE_PATH);
        const content = readFileSync(path, 'utf8');
        expect(content.length).toBeGreaterThan(0);
    });
});
