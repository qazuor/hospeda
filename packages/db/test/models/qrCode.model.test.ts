/**
 * `QrCodeModel` — the `render_options` merge (HOS-981 PR 3).
 *
 * The defect this file exists for produces no error and no log line. An
 * operator opens a QR code that was configured with a red foreground, changes
 * the margin, saves, and the code is black. `render_options` is ONE `jsonb`
 * column, so a patch written with a plain `SET` replaces the whole document —
 * the five settings the form did not touch are gone, and the only place the
 * loss shows up is the printed sticker.
 *
 * Two independent pieces have to hold for a partial edit to survive, and each
 * of them is silent on its own:
 *
 *   1. `QrCodeUpdateInputSchema` must not complete the patch with defaults, or
 *      the merge below dutifully merges `foregroundColor: '#000000'` over the
 *      stored red.
 *   2. `QrCodeModel.mergeableJsonbColumns` must name `renderOptions`, or the
 *      write is a replacement and the siblings are dropped outright.
 *
 * So the load-bearing test here is the COMPOSED one: it feeds a real
 * schema-parsed patch into the real `buildMergeSetClause` against the real
 * `qr_codes` table, using the model's own declared column list. Either piece
 * reverting turns it red.
 *
 * @module test/models/qrCode.model
 */

import { QrCodeUpdateInputSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { QrCodeModel } from '../../src/models/qr-code/qrCode.model';
import { qrCodes } from '../../src/schemas/qr-code/qr_code.dbschema';
import { buildMergeSetClause } from '../../src/utils/jsonb-merge';

const model = new QrCodeModel();

/** The model's declared merge list, read the way `BaseModel.update()` reads it. */
function declaredMergeableColumns(): readonly string[] {
    return (model as unknown as { mergeableJsonbColumns: readonly string[] }).mergeableJsonbColumns;
}

describe('QrCodeModel', () => {
    it('maps the qr_codes table', () => {
        expect(model.entityName).toBe('qr_codes');
        expect((model as unknown as { getTableName: () => string }).getTableName()).toBe('qrCodes');
    });

    describe('mergeableJsonbColumns', () => {
        it('declares render_options as mergeable', () => {
            expect(declaredMergeableColumns()).toContain('renderOptions');
        });

        /**
         * `buildMergeSetClause` guards on `key in table`, so a column named here
         * that does not exist would miss the merge branch and fall through to a
         * plain assignment against a column that is not there. The list is
         * pinned exactly rather than checked for containment for that reason.
         */
        it('names nothing that is not a real jsonb column on the table', () => {
            expect(declaredMergeableColumns()).toStrictEqual(['renderOptions']);
            for (const column of declaredMergeableColumns()) {
                expect(column in qrCodes).toBe(true);
            }
        });
    });

    /**
     * THE COMPOSED ASSERTION — schema patch → merge clause.
     *
     * `buildMergeSetClause` emits `existing || <patch>::jsonb`, and the patch is
     * serialised into the fragment's `queryChunks` as a JSON string. Reading that
     * string back is what lets this test say something about the VALUE that will
     * be written, not merely about the shape of the clause.
     */
    describe('a margin-only PATCH does not repaint the code', () => {
        /** The patch exactly as it leaves the update schema. */
        const patch = QrCodeUpdateInputSchema.parse({ renderOptions: { margin: 8 } });

        /** Pulls the serialised patch JSON out of the emitted SQL fragment. */
        function serialisedPatch(): string {
            const clause = buildMergeSetClause(
                patch as Record<string, unknown>,
                qrCodes,
                declaredMergeableColumns()
            );

            const fragment = clause.renderOptions as { queryChunks?: unknown[] };

            // A plain value here means the merge branch was not taken at all —
            // i.e. the column left `mergeableJsonbColumns`. Say so instead of
            // failing later on an undefined.
            expect(Array.isArray(fragment?.queryChunks)).toBe(true);

            const json = (fragment.queryChunks as unknown[]).find(
                (chunk) => typeof chunk === 'string' && chunk.trim().startsWith('{')
            );
            expect(typeof json).toBe('string');
            return json as string;
        }

        it('writes only the margin', () => {
            expect(JSON.parse(serialisedPatch())).toStrictEqual({ margin: 8 });
        });

        /**
         * Named on its own because this is the field whose loss is invisible: a
         * black QR code looks entirely normal until it is compared with the one
         * already printed.
         */
        it('never mentions the foreground colour it was not asked to change', () => {
            expect(serialisedPatch()).not.toContain('foregroundColor');
        });
    });
});
