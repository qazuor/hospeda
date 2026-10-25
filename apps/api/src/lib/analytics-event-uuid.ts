import { createHash } from 'node:crypto';

/**
 * Stable UUIDv5 namespace for analytics event deduplication. Changing this
 * namespace breaks deduplication against events already sent to PostHog.
 */
const ANALYTICS_EVENT_NAMESPACE = '9b2a56d8-3357-5f6f-9e32-95d4fcdfd2e9';

export function uuidv5(name: string, namespace: string): string {
    const namespaceBytes = Buffer.from(namespace.replaceAll('-', ''), 'hex');
    const hash = createHash('sha1').update(namespaceBytes).update(name).digest();
    hash.writeUInt8((hash.readUInt8(6) & 0x0f) | 0x50, 6);
    hash.writeUInt8((hash.readUInt8(8) & 0x3f) | 0x80, 8);
    const hex = hash.subarray(0, 16).toString('hex');
    return (
        hex.slice(0, 8) +
        '-' +
        hex.slice(8, 12) +
        '-' +
        hex.slice(12, 16) +
        '-' +
        hex.slice(16, 20) +
        '-' +
        hex.slice(20)
    );
}

export function deriveAnalyticsEventUuid(input: { event: string; dedupeKey: string }): string {
    return uuidv5(`${input.event}:${input.dedupeKey}`, ANALYTICS_EVENT_NAMESPACE);
}
