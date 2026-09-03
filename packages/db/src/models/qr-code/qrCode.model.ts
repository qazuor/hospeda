import type { QrCode } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { qrCodes } from '../../schemas/qr-code/qr_code.dbschema.ts';

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

    protected getTableName(): string {
        return 'qrCodes';
    }
}

/** Singleton instance of QrCodeModel for use across the application. */
export const qrCodeModel = new QrCodeModel();
