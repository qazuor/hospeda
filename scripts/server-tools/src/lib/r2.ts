/**
 * Cloudflare R2 client wrapper for the hops toolkit.
 *
 * The daily Postgres backups (`scripts/backup/postgres-to-r2.sh`) live
 * in this same bucket, so anything we write/read here has to play
 * nicely with that naming convention. See `scripts/backup/README.md`.
 *
 * Layout in the bucket:
 *   hospeda-postgres-YYYY-MM-DD_HHMMSSZ.dump        (daily cron)
 *   manual/hospeda-postgres-YYYY-MM-DD_HHMMSSZ.dump (`hops db-backup-now`)
 *   manual/pre-restore-YYYY-MM-DD_HHMMSSZ.dump      (`hops db-restore` snapshot-first)
 *
 * Auth: R2 exposes an S3-compatible endpoint, so the AWS v3 SDK works
 * verbatim once the endpoint and region are pointed at R2. Region is
 * the literal string `auto` per Cloudflare's docs.
 */

import { Buffer } from 'node:buffer';
import {
    DeleteObjectCommand,
    GetBucketLifecycleConfigurationCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    PutBucketLifecycleConfigurationCommand,
    PutObjectCommand,
    S3Client
} from '@aws-sdk/client-s3';
import { type Target, getR2Config } from './target.ts';

/** Single object record returned by {@link R2Client.list}. */
export interface R2Object {
    /** Full bucket key, e.g. `manual/hospeda-postgres-2026-05-10_154500Z.dump`. */
    readonly key: string;
    /** Size in bytes. `null` when the SDK did not return a size. */
    readonly size: number | null;
    /** Last-modified timestamp from R2. `null` when missing. */
    readonly lastModified: Date | null;
}

/**
 * Thin client over the AWS S3 SDK pointed at the configured R2 bucket.
 * One instance per process is enough — the underlying client pools
 * connections internally.
 */
export class R2Client {
    private readonly client: S3Client;
    public readonly bucket: string;

    constructor(params: {
        readonly accountId: string;
        readonly accessKeyId: string;
        readonly secretAccessKey: string;
        readonly bucket: string;
        readonly region?: string;
    }) {
        this.bucket = params.bucket;
        this.client = new S3Client({
            region: params.region ?? 'auto',
            endpoint: `https://${params.accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: params.accessKeyId,
                secretAccessKey: params.secretAccessKey
            }
        });
    }

    /**
     * List all objects under `prefix` (or the whole bucket when no
     * prefix is supplied). Pages through the S3 ContinuationToken so
     * the caller gets the complete set in one array.
     */
    async list(prefix = ''): Promise<ReadonlyArray<R2Object>> {
        const out: Array<R2Object> = [];
        let continuationToken: string | undefined;

        do {
            const result = await this.client.send(
                new ListObjectsV2Command({
                    Bucket: this.bucket,
                    Prefix: prefix.length > 0 ? prefix : undefined,
                    ContinuationToken: continuationToken
                })
            );

            for (const obj of result.Contents ?? []) {
                if (!obj.Key) continue;
                out.push({
                    key: obj.Key,
                    size: typeof obj.Size === 'number' ? obj.Size : null,
                    lastModified: obj.LastModified ?? null
                });
            }

            continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
        } while (continuationToken);

        return out;
    }

    /**
     * Upload an in-memory buffer to the given key. Used for backups
     * that fit comfortably in RAM (Hospeda dumps are 2-5 MB today).
     * If we ever exceed ~100 MB we should switch to a multipart upload.
     */
    async putBuffer(
        key: string,
        body: Buffer,
        contentType = 'application/octet-stream'
    ): Promise<void> {
        await this.client.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: body,
                ContentType: contentType,
                ContentLength: body.length
            })
        );
    }

    /**
     * Download an object as a Buffer. Throws when the object is missing
     * or the body cannot be materialised.
     */
    async getBuffer(key: string): Promise<Buffer> {
        const result = await this.client.send(
            new GetObjectCommand({
                Bucket: this.bucket,
                Key: key
            })
        );
        if (!result.Body) {
            throw new Error(`R2 GET ${key}: empty body`);
        }
        // The SDK's Body is a Readable stream in Node — collect it into
        // a Buffer. transformToByteArray() is the AWS-blessed helper.
        const bytes = await result.Body.transformToByteArray();
        return Buffer.from(bytes);
    }

    /** Delete a single object by key. No-op if it does not exist. */
    async delete(key: string): Promise<void> {
        await this.client.send(
            new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: key
            })
        );
    }

    /**
     * Replace the bucket's lifecycle configuration with a single rule that
     * deletes objects under `prefix` after `expirationDays` days.
     *
     * Idempotent: existing rules on the bucket are REPLACED. R2 stores at
     * most one lifecycle config per bucket so the PUT is destructive but
     * predictable.
     */
    async setLifecycleRule(params: {
        readonly ruleId: string;
        readonly prefix: string;
        readonly expirationDays: number;
    }): Promise<void> {
        await this.client.send(
            new PutBucketLifecycleConfigurationCommand({
                Bucket: this.bucket,
                LifecycleConfiguration: {
                    Rules: [
                        {
                            ID: params.ruleId,
                            Status: 'Enabled',
                            Filter: { Prefix: params.prefix },
                            Expiration: { Days: params.expirationDays }
                        }
                    ]
                }
            })
        );
    }

    /**
     * Fetch the bucket's current lifecycle configuration. Returns
     * `undefined` when the bucket has no lifecycle rules configured (R2
     * returns a 404-equivalent for that case).
     */
    async getLifecycle(): Promise<
        ReadonlyArray<{ id: string; prefix: string; expirationDays: number }> | undefined
    > {
        try {
            const result = await this.client.send(
                new GetBucketLifecycleConfigurationCommand({ Bucket: this.bucket })
            );
            return (result.Rules ?? []).map((r) => ({
                id: r.ID ?? '(unnamed)',
                prefix: r.Filter && 'Prefix' in r.Filter ? (r.Filter.Prefix ?? '') : '',
                expirationDays: r.Expiration?.Days ?? -1
            }));
        } catch (err) {
            const name = err instanceof Error ? err.name : '';
            if (name === 'NoSuchLifecycleConfiguration') return undefined;
            throw err;
        }
    }
}

/**
 * Build an R2Client for the given target environment. Reads four env
 * vars from `.env.local` whose name prefix matches the target
 * (`R2_*` for prod, `R2_STAGING_*` for staging). Throws with a helpful
 * message if any of them is missing.
 *
 * Target-aware so the same `hops` invocation can list / restore against
 * the staging bucket without leaking prod credentials. Before this
 * signature change the function was target-blind and always used the
 * prod bucket, which made `hops db-restore --list --target=staging`
 * surface production backups (SPEC-103 T-095 reproduction case 2).
 */
export function createR2Client(target: Target): R2Client {
    const config = getR2Config(target);
    return new R2Client({
        accountId: config.accountId,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        bucket: config.bucket,
        region: 'auto'
    });
}

/**
 * Build a UTC timestamp string suitable for backup filenames.
 * Format: `YYYY-MM-DD_HHMMSSZ`. Matches the daily cron's naming.
 */
export function utcBackupTimestamp(date: Date = new Date()): string {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mi = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}_${hh}${mi}${ss}Z`;
}

/**
 * Format a byte count as a human-readable string (KB / MB / GB).
 * Used by the backup commands to print size summaries to the operator.
 */
export function humanSize(bytes: number | null): string {
    if (bytes === null) return '?';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
