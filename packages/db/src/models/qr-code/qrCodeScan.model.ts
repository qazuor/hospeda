import type { QrCodeScan } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { qrCodeScans } from '../../schemas/qr-code/qr_code_scan.dbschema.ts';

/**
 * Model for `qr_code_scans` (HOS-981).
 *
 * Append-only: a scan is an event, so there is nothing to update and no soft
 * delete. See the table's own comment for why the row carries no IP address and
 * no user-agent.
 */
export class QrCodeScanModel extends BaseModelImpl<QrCodeScan> {
    protected table = qrCodeScans;
    public entityName = 'qr_code_scans';

    protected getTableName(): string {
        return 'qrCodeScans';
    }
}

/** Singleton instance of QrCodeScanModel for use across the application. */
export const qrCodeScanModel = new QrCodeScanModel();
