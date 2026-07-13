import { describe, expect, it } from 'vitest';
import type { FixtureWriteIO, PoiFixture } from '../../scripts/poi-pipeline/emit.js';
import { writePoiFixtures } from '../../scripts/poi-pipeline/emit.js';

function fixture(slug: string): PoiFixture {
    return {
        slug,
        lat: null,
        long: null,
        type: 'OTHER',
        icon: null,
        description: 'd',
        nameI18n: { es: 'n', en: null, pt: null },
        descriptionI18n: { es: 'd', en: null, pt: null },
        translationMeta: {},
        address: 'a',
        keywords: [],
        hasOwnPage: false,
        isBuiltin: true,
        isFeatured: false,
        displayWeight: 50,
        verified: false,
        verifiedAt: null,
        source: null,
        notes: null,
        lifecycleState: 'ACTIVE',
        categories: [{ slug: 'other', isPrimary: true }]
    };
}

/** In-memory FixtureWriteIO capturing written files. */
function memoryIO(): FixtureWriteIO & { files: Map<string, string>; dirs: string[] } {
    const files = new Map<string, string>();
    const dirs: string[] = [];
    return {
        files,
        dirs,
        ensureDir: (dir) => dirs.push(dir),
        writeFile: (filePath, contents) => files.set(filePath, contents)
    };
}

describe('writePoiFixtures', () => {
    it('writes one <slug>.json per fixture into the output dir', () => {
        // Arrange
        const io = memoryIO();

        // Act
        const count = writePoiFixtures({
            fixtures: [fixture('b_poi'), fixture('a_poi')],
            outputDir: '/out',
            io
        });

        // Assert
        expect(count).toBe(2);
        expect(io.dirs).toContain('/out');
        expect([...io.files.keys()].sort()).toEqual(['/out/a_poi.json', '/out/b_poi.json']);
    });

    it('pretty-prints and trailing-newlines each fixture (clean diffs)', () => {
        // Arrange
        const io = memoryIO();

        // Act
        writePoiFixtures({ fixtures: [fixture('x')], outputDir: '/out', io });

        // Assert
        const contents = io.files.get('/out/x.json') ?? '';
        expect(contents.endsWith('}\n')).toBe(true);
        expect(contents).toContain('\n  "slug": "x"');
    });
});
