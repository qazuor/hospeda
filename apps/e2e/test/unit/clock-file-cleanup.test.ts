import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { removeE2eClockFile } from '../../fixtures/clock-file-cleanup.ts';

describe('TEST:V4:23 support clock file cleanup', () => {
    let directory = '';

    afterEach(() => {
        if (directory) rmSync(directory, { recursive: true, force: true });
        directory = '';
    });

    it('removes the existing clock file', () => {
        directory = mkdtempSync(path.join(tmpdir(), 'clock-file-'));
        const clockPath = path.join(directory, 'clock.json');
        writeFileSync(clockPath, '{"now":"2026-10-12T00:00:00.000Z"}');
        removeE2eClockFile({ path: clockPath });
        expect(() => readFileSync(clockPath)).toThrow();
    });

    it('does not throw when the clock file is absent', () => {
        directory = mkdtempSync(path.join(tmpdir(), 'clock-file-'));
        expect(() =>
            removeE2eClockFile({ path: path.join(directory, 'absent.json') })
        ).not.toThrow();
    });
});
