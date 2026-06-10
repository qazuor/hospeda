import { and, count, eq, getDb, isNull } from '@repo/db';
import { contentModerationTerms, contentModerationThresholds } from '@repo/db';
import type { DrizzleClient } from '@repo/db';
import { logger } from '../utils/logger.js';

function parseCsv(raw: string | undefined): string[] {
    if (!raw) return [];
    return [
        ...new Set(
            raw
                .split(',')
                .map((value) => value.trim().toLowerCase())
                .filter(Boolean)
        )
    ];
}

/**
 * Seeds the content moderation bootstrap data (SPEC-195).
 *
 * - Inserts the default threshold row exactly once.
 * - Imports the legacy env-var blocklists into `content_moderation_terms`
 *   exactly once, skipping the import if any active term row already exists.
 */
export async function seedContentModerationData(tx?: DrizzleClient): Promise<void> {
    const db = tx ?? getDb();

    const [defaultThreshold] = await db
        .select({ count: count() })
        .from(contentModerationThresholds)
        .where(
            and(
                eq(contentModerationThresholds.context, 'default'),
                isNull(contentModerationThresholds.deletedAt)
            )
        );

    if (Number(defaultThreshold?.count ?? 0) === 0) {
        await db.insert(contentModerationThresholds).values({
            context: 'default',
            pending: 0.5,
            reject: 0.85,
            createdById: null,
            updatedById: null
        });
        logger.info('[seed] inserted default content moderation threshold row');
    }

    const [existingTerms] = await db
        .select({ count: count() })
        .from(contentModerationTerms)
        .where(isNull(contentModerationTerms.deletedAt));

    if (Number(existingTerms?.count ?? 0) > 0) {
        logger.info('[seed] content moderation terms already exist — skipping env import');
        return;
    }

    const words = parseCsv(process.env.HOSPEDA_MESSAGING_BLOCKED_WORDS);
    const domains = parseCsv(process.env.HOSPEDA_MESSAGING_BLOCKED_DOMAINS);

    const rows = [
        ...words.map((term) => ({
            term,
            kind: 'word' as const,
            category: 'other',
            severity: 1,
            enabled: true,
            createdById: null,
            updatedById: null
        })),
        ...domains.map((term) => ({
            term,
            kind: 'domain' as const,
            category: 'other',
            severity: 1,
            enabled: true,
            createdById: null,
            updatedById: null
        }))
    ];

    if (rows.length === 0) {
        logger.info('[seed] no moderation env blocklist values found — import skipped');
        return;
    }

    await db.insert(contentModerationTerms).values(rows);
    logger.info({ count: rows.length }, '[seed] imported content moderation terms from env');
}
