import type { QrCode } from '@repo/schemas';
import { and, asc, isNotNull, isNull } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { qrCodes } from '../../schemas/qr-code/qr_code.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';
import { QR_CODE_RAW_UTM_CAMPAIGN_SQL } from './qrCode.filters.ts';

/**
 * Model for `qr_codes` (HOS-981).
 *
 * Soft delete by default, per `BaseModelImpl`. Note the `slug` UNIQUE index is
 * over the whole table rather than over live rows: a slug that has been printed
 * must never be reissued, deleted row or not.
 */
export class QrCodeModel extends BaseModelImpl<QrCode> {
    protected table = qrCodes;
    public entityName = 'qr_codes';

    /**
     * `render_options` is shallow-MERGED on update, never replaced (HOS-981 PR 3).
     *
     * The column is one `jsonb` document holding six independent drawing
     * settings, and the admin panel edits them one at a time. On the plain
     * replacement path a `PATCH {renderOptions: {margin: 8}}` writes exactly
     * `{"margin": 8}` — a code stored with `foregroundColor: '#ff0000'` comes
     * back with no colour at all, and nothing anywhere raises an error.
     * Merging with PostgreSQL's `||` keeps every key the patch did not mention.
     *
     * This is one half of the fix; the other lives in `QrCodeUpdateInputSchema`,
     * which re-declares the sub-object `.partial()` so the patch that arrives
     * here is as small as the caller wrote it. Either half alone still loses
     * data: a merge fed a defaults-completed object overwrites the siblings with
     * defaults, and a genuinely partial patch written with a plain `SET` drops
     * them outright.
     */
    protected override readonly mergeableJsonbColumns = ['renderOptions'] as const;

    protected getTableName(): string {
        return 'qrCodes';
    }

    /**
     * Every distinct `utm_campaign` stored on a live code's target, RAW — still
     * percent-encoded, exactly as the URL spells it (HOS-2679).
     *
     * Feeds the campaign dropdown of the admin list. Decoding is the caller's job
     * because SQL has no `decodeURIComponent`; two spellings of one campaign
     * (`a%20b` and `a+b`) therefore come back as two rows, and the service folds
     * them after decoding.
     *
     * @param tx - Optional transaction client.
     * @returns Raw campaign values, sorted, without nulls.
     */
    async findDistinctRawUtmCampaigns(tx?: DrizzleClient): Promise<string[]> {
        const db = this.getClient(tx);
        const logContext = {};
        try {
            const rows = await db
                .selectDistinct({ campaign: QR_CODE_RAW_UTM_CAMPAIGN_SQL })
                .from(qrCodes)
                .where(and(isNull(qrCodes.deletedAt), isNotNull(QR_CODE_RAW_UTM_CAMPAIGN_SQL)))
                .orderBy(asc(QR_CODE_RAW_UTM_CAMPAIGN_SQL));
            const campaigns = rows.flatMap((row) => (row.campaign ? [row.campaign] : []));
            logQuery(this.entityName, 'findDistinctRawUtmCampaigns', logContext, {
                count: campaigns.length
            });
            return campaigns;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findDistinctRawUtmCampaigns', logContext, err);
            throw new DbError(
                this.entityName,
                'findDistinctRawUtmCampaigns',
                logContext,
                err.message
            );
        }
    }
}

/** Singleton instance of QrCodeModel for use across the application. */
export const qrCodeModel = new QrCodeModel();
