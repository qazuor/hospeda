/**
 * HOS-141 T-003 — POI CSV loader (pipeline stage 1: Load).
 *
 * Parses the consolidated POI CSV into typed {@link RawCsvRow} objects. The
 * source CSV is verified single-line-per-row (no embedded newlines) with no
 * escaped `""` quotes, so a small hand-rolled quote-aware splitter is
 * sufficient — no CSV dependency is pulled in (KISS; the file is one-time
 * migration input, not a general parser target).
 */
import { readFileSync } from 'node:fs';
import { CSV_COLUMNS, type RawCsvRow } from './types.js';

/** Unicode byte-order-mark code point that may prefix the CSV header line. */
const BOM_CODE_POINT = 0xfeff;

/**
 * Strips a leading UTF-8 BOM from CSV text, if present. Detected by code point
 * (`U+FEFF`) rather than a literal glyph so it is robust to editor/encoding
 * quirks around the (invisible) BOM character.
 *
 * @param text - Raw CSV text.
 * @returns The text without a leading BOM.
 */
function stripBom(text: string): string {
    return text.charCodeAt(0) === BOM_CODE_POINT ? text.slice(1) : text;
}

/**
 * Splits a single CSV line into raw field values, honoring double-quoted
 * fields that contain commas.
 *
 * Assumes the well-formed shape verified for this dataset: no embedded
 * newlines and no escaped (`""`) quotes inside a field. A quote character is
 * only treated as a field delimiter when it opens/closes a field (i.e. at a
 * field boundary); quotes are stripped from the emitted value.
 *
 * @param line - One physical CSV line (already stripped of its BOM/newline).
 * @returns The ordered raw field values.
 */
export function parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
        if (char === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (char === ',' && !inQuotes) {
            fields.push(current);
            current = '';
            continue;
        }
        current += char;
    }
    fields.push(current);
    return fields;
}

/**
 * Splits a semicolon-separated multi-value CSV cell (e.g. `categorySlugs`,
 * `keywords`, `nearbyDestinationSlugs`) into trimmed, non-empty parts.
 *
 * @param raw - The raw cell value.
 * @returns The trimmed parts, in source order; `[]` for an empty cell.
 */
export function splitSemicolon(raw: string): string[] {
    return raw
        .split(';')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
}

/**
 * Maps an ordered array of raw field values to a {@link RawCsvRow}, keyed by
 * {@link CSV_COLUMNS} order.
 *
 * @param fields - Raw field values for one row.
 * @param lineNumber - 1-based source line number (for error messages).
 * @returns The typed raw row.
 * @throws {Error} If the field count does not match {@link CSV_COLUMNS}.
 */
function toRawRow(fields: readonly string[], lineNumber: number): RawCsvRow {
    if (fields.length !== CSV_COLUMNS.length) {
        throw new Error(
            `POI CSV line ${lineNumber}: expected ${CSV_COLUMNS.length} columns, got ${fields.length}.`
        );
    }
    const row = Object.fromEntries(
        CSV_COLUMNS.map((column, index) => [column, fields[index] ?? ''])
    );
    return row as unknown as RawCsvRow;
}

/**
 * Parses raw CSV text into typed rows, validating the header against
 * {@link CSV_COLUMNS}.
 *
 * @param params.text - Full CSV file contents (may start with a BOM).
 * @param params.expectedRows - When provided, the loader fails loud if the
 *   parsed data-row count differs (runtime guard for the real input; omit for
 *   inline-fixture parsing).
 * @returns The parsed data rows (header excluded).
 * @throws {Error} If the header does not match the expected columns, a row has
 *   the wrong field count, or `expectedRows` is set and not met.
 */
export function parseCsv(params: {
    readonly text: string;
    readonly expectedRows?: number;
}): RawCsvRow[] {
    const { text, expectedRows } = params;
    const lines = stripBom(text)
        .split('\n')
        .map((line) => line.replace(/\r$/, ''))
        .filter((line) => line.length > 0);

    if (lines.length === 0) {
        throw new Error('POI CSV is empty.');
    }

    const header = parseCsvLine(lines[0] as string);
    if (header.length !== CSV_COLUMNS.length || header.some((col, i) => col !== CSV_COLUMNS[i])) {
        throw new Error(
            `POI CSV header mismatch.\n  expected: ${CSV_COLUMNS.join(',')}\n  got:      ${header.join(',')}`
        );
    }

    const rows = lines.slice(1).map((line, index) => toRawRow(parseCsvLine(line), index + 2));

    if (expectedRows !== undefined && rows.length !== expectedRows) {
        throw new Error(
            `POI CSV row count mismatch: expected ${expectedRows} data rows, got ${rows.length}.`
        );
    }

    return rows;
}

/**
 * Reads and parses a POI CSV file from disk.
 *
 * @param params.path - Absolute path to the CSV file.
 * @param params.expectedRows - Optional fail-loud row-count guard (see
 *   {@link parseCsv}).
 * @returns The parsed data rows.
 */
export function loadCsv(params: {
    readonly path: string;
    readonly expectedRows?: number;
}): RawCsvRow[] {
    const { path, expectedRows } = params;
    const text = readFileSync(path, 'utf8');
    return parseCsv({ text, expectedRows });
}
