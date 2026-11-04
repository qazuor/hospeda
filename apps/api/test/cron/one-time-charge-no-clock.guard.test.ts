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
    it('restricts charge calls to the one-time service and keeps crons disconnected', () => {
        const files = [...sourceFiles(cronRoot), ...sourceFiles(serviceRoot)];
        expect(files.length).toBeGreaterThan(50);
        const sources = files.map((file) => ({
            path: relative(root, file).replaceAll('\\', '/'),
            source: readFileSync(file, 'utf8')
        }));
        expect(
            sources.filter(({ source }) => /\.charge\(/.test(source)).map(({ path }) => path)
        ).toEqual([]);
        expect(
            sources.filter(({ source }) => /\.chargeOnce\(/.test(source)).map(({ path }) => path)
        ).toEqual([
            'packages/service-core/src/services/billing/addon/send-one-time-order.service.ts'
        ]);
        expect(
            sources
                .filter(
                    ({ path, source }) =>
                        path.startsWith('apps/api/src/cron/') &&
                        /sendOneTimeOrder|send-one-time-order/.test(source)
                )
                .map(({ path }) => path)
        ).toEqual([]);
    });
});
