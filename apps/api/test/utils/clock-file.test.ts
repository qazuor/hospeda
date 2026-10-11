/** TEST:B3:43 (soporte): a built API can follow the file-driven E2E clock. */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app';
import { createFileClock, getClock, systemClock } from '../../src/utils/clock';
import { validateApiEnv } from '../../src/utils/env';

const dirs: string[] = [];
function filePath() {
    const dir = mkdtempSync(path.join(tmpdir(), 'hospeda-clock-'));
    dirs.push(dir);
    return path.join(dir, 'clock.json');
}
afterEach(() => {
    vi.unstubAllEnvs();
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('createFileClock (TEST:B3:43 soporte)', () => {
    it('uses system time when absent, follows rewrites, and rejects invalid contents', () => {
        const target = filePath();
        const fileClock = createFileClock({ path: target });
        expect(fileClock.now().getTime()).toBeGreaterThan(0);
        writeFileSync(target, JSON.stringify({ now: '2026-10-01T03:00:00.000Z' }));
        expect(fileClock.now()).toEqual(new Date('2026-10-01T03:00:00.000Z'));
        writeFileSync(target, JSON.stringify({ now: '2026-10-11T03:00:00.000Z' }));
        expect(fileClock.now()).toEqual(new Date('2026-10-11T03:00:00.000Z'));
        writeFileSync(target, '{');
        expect(() => fileClock.now()).toThrow();
        writeFileSync(target, JSON.stringify({ now: 'invalid' }));
        expect(() => fileClock.now()).toThrow();
    });

    it('selects the file clock only for a local site', () => {
        const target = filePath();
        writeFileSync(target, JSON.stringify({ now: '2026-10-11T03:00:00.000Z' }));
        vi.stubEnv('HOSPEDA_E2E_CLOCK_FILE', target);
        vi.stubEnv('HOSPEDA_SITE_URL', 'http://localhost:4321');
        validateApiEnv();
        initApp();
        expect(getClock().clock.now()).toEqual(new Date('2026-10-11T03:00:00.000Z'));
        vi.stubEnv('HOSPEDA_SITE_URL', 'https://hospeda.com.ar');
        validateApiEnv();
        expect(() => initApp()).toThrow(/only allowed.*localhost/i);
        expect(systemClock.now()).toBeInstanceOf(Date);
    });
});
