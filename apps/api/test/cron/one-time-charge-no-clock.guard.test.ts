import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '../../../..');
const cronRoot = join(root, 'apps/api/src/cron');
const serviceRoot = join(root, 'packages/service-core/src');

function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return sourceFiles(path);
        return entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
    });
}

describe('HOS-1554 TEST:B6:9 no local charge clock', () => {
    it('no cron or service calls `charge`, and the card order charge is gone (HOS-2179 T-7)', () => {
        // Arrange
        const files = [...sourceFiles(cronRoot), ...sourceFiles(serviceRoot)];
        expect(files.length).toBeGreaterThan(50);
        const sources = files.map((file) => ({
            path: relative(root, file).replaceAll('\\', '/'),
            source: readFileSync(file, 'utf8')
        }));

        // Act
        const calling = (pattern: RegExp) =>
            sources.filter(({ source }) => pattern.test(source)).map(({ path }) => path);

        // Assert
        expect(calling(/\.charge\(/)).toEqual([]);
        expect(calling(/\.chargeOnce\(/)).toEqual([]);
        expect(calling(/sendOneTimeOrder|send-one-time-order/)).toEqual([]);
    });
});
