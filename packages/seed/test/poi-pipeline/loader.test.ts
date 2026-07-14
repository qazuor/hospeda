import { describe, expect, it } from 'vitest';
import {
    loadCsv,
    parseCsv,
    parseCsvLine,
    splitSemicolon
} from '../../scripts/poi-pipeline/loader.js';

const HEADER =
    'id,destinationSlug,destinationName,destinationTier,relation,name,description,priority,address,lat,lng,verified,source,verifiedAt,notes,categorySlugs,categoryNames,keywords,nearbyDestinationSlugs,nearbyDestinationNames';

const ROW_QUOTED =
    'cdu__plaza,cdu,Concepcion,HIGH,PRIMARY,Plaza,Una plaza historica,HIGH,"Calle A, Calle B, CDU",-32.4,-58.2,False,https://x.tur.ar/,,Carga inicial,SQUARE; HISTORIC_SITE; PARK,Square; Historic Site; Park,plaza; centro; historia,,';

/** Explicit U+FEFF byte-order mark (escape, never a literal glyph). */
const BOM = String.fromCharCode(0xfeff);

describe('parseCsvLine', () => {
    it('splits a plain line into fields', () => {
        // Arrange / Act
        const fields = parseCsvLine('a,b,c');

        // Assert
        expect(fields).toEqual(['a', 'b', 'c']);
    });

    it('keeps commas inside a double-quoted field intact and strips the quotes', () => {
        // Arrange / Act
        const fields = parseCsvLine('x,"Calle A, Calle B, CDU",y');

        // Assert
        expect(fields).toEqual(['x', 'Calle A, Calle B, CDU', 'y']);
    });

    it('emits an empty trailing field', () => {
        // Arrange / Act
        const fields = parseCsvLine('a,b,');

        // Assert
        expect(fields).toEqual(['a', 'b', '']);
    });
});

describe('splitSemicolon', () => {
    it('trims and drops empty parts', () => {
        expect(splitSemicolon('SQUARE; HISTORIC_SITE ; PARK')).toEqual([
            'SQUARE',
            'HISTORIC_SITE',
            'PARK'
        ]);
    });

    it('returns an empty array for an empty cell', () => {
        expect(splitSemicolon('')).toEqual([]);
    });
});

describe('parseCsv', () => {
    it('strips a leading U+FEFF BOM and maps fields to a typed row', () => {
        // Arrange
        const text = `${BOM}${HEADER}\n${ROW_QUOTED}`;

        // Act
        const rows = parseCsv({ text });

        // Assert
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row?.id).toBe('cdu__plaza');
        expect(row?.destinationSlug).toBe('cdu');
        expect(row?.address).toBe('Calle A, Calle B, CDU');
        expect(row?.categorySlugs).toBe('SQUARE; HISTORIC_SITE; PARK');
        expect(row?.verifiedAt).toBe('');
        expect(row?.nearbyDestinationNames).toBe('');
    });

    it('strips a trailing CR (CRLF line endings) from the last field', () => {
        // Arrange
        const text = `${HEADER}\r\n${ROW_QUOTED}\r\n`;

        // Act
        const rows = parseCsv({ text });

        // Assert
        expect(rows).toHaveLength(1);
        expect(rows[0]?.nearbyDestinationNames).toBe('');
    });

    it('the parsed multi-value cells split cleanly downstream', () => {
        // Arrange
        const rows = parseCsv({ text: `${HEADER}\n${ROW_QUOTED}` });

        // Act
        const categories = splitSemicolon(rows[0]?.categorySlugs ?? '');

        // Assert
        expect(categories).toEqual(['SQUARE', 'HISTORIC_SITE', 'PARK']);
    });

    it('throws on a header that does not match the expected columns', () => {
        // Arrange
        const text = 'id,wrongColumn\n1,2';

        // Act & Assert
        expect(() => parseCsv({ text })).toThrow(/header mismatch/i);
    });

    it('throws on a row with the wrong field count', () => {
        // Arrange
        const text = `${HEADER}\ntoo,few,fields`;

        // Act & Assert
        expect(() => parseCsv({ text })).toThrow(/expected 20 columns, got 3/);
    });

    it('fails loud when expectedRows is set and not met', () => {
        // Arrange
        const text = `${HEADER}\n${ROW_QUOTED}`;

        // Act & Assert
        expect(() => parseCsv({ text, expectedRows: 914 })).toThrow(
            /row count mismatch: expected 914 data rows, got 1/
        );
    });

    it('passes the expectedRows guard when the count matches', () => {
        // Arrange
        const text = `${HEADER}\n${ROW_QUOTED}`;

        // Act
        const rows = parseCsv({ text, expectedRows: 1 });

        // Assert
        expect(rows).toHaveLength(1);
    });
});

describe('loadCsv', () => {
    it('is exported for reading a CSV file from disk', () => {
        // Guard: the on-disk read path exists (exercised operationally against
        // the real ~/Downloads CSV, not in CI — see HOS-141 test strategy).
        expect(typeof loadCsv).toBe('function');
    });
});
