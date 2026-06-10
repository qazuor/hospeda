/**
 * @file ThemeControl.icon.test.ts
 * @description Source-level guard for BETA-18.
 *
 * The "system" (central) option used `SettingsIcon` (a gear), which read as
 * "settings" rather than "follow the OS preference". It now uses `MonitorIcon`.
 * This pins that choice (the rendered SVG itself is impractical to assert via
 * jsdom).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/preferences/ThemeControl.client.tsx'),
    'utf8'
);

describe('ThemeControl system option icon (BETA-18)', () => {
    it('uses MonitorIcon for the system option', () => {
        expect(src).toMatch(/value:\s*'system',\s*Icon:\s*MonitorIcon/);
    });

    it('no longer uses the ambiguous SettingsIcon', () => {
        expect(src).not.toMatch(/SettingsIcon/);
    });
});
