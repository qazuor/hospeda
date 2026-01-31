export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'bounced' | 'skipped';

export interface DeliveryResult {
    success: boolean;
    messageId?: string;
    error?: string;
    status: DeliveryStatus;
    skippedReason?: string;
}
