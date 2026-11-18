/**
 * MCP Audit Retention Job (HOS-2335 D-13; HOS-2348, HOS-2349)
 *
 * Deletes the `mcp.tool.call` rows of `audit_log_entries` older than 12
 * months, the retention the owner set for the assistant activity. Nothing
 * else: `mcp.connection.revoked` and every admin and security row keep their
 * current (no purge) behaviour. See `McpActivityService.purgeExpired` for the
 * scoped, batched delete.
 *
 * A dry run reports how many rows it would delete and deletes nothing.
 * Idempotent: a second run over the same instant finds nothing to delete.
 *
 * Schedule: daily at 4:20 Buenos Aires time, inside the off-peak maintenance
 * band and 20 minutes after `cron-run-purge`.
 *
 * @module cron/jobs/mcp-audit-retention
 */

import { MCP_AUDIT_RETENTION_MONTHS } from '@repo/schemas';
import { apiLogger } from '../../utils/logger.js';
import type { CronJobDefinition } from '../types.js';

/** Job definition. */
export const mcpAuditRetentionJob: CronJobDefinition = {
    name: 'mcp-audit-retention',
    description: 'Delete mcp.tool.call audit rows older than 12 months (HOS-2335 D-13)',
    schedule: '20 4 * * *',
    enabled: true,
    timeoutMs: 120_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        try {
            // Lazy import keeps the DB singleton out of module top-level (Vitest
            // fork contamination, same as ai-listing-questions-retention).
            const { McpActivityService } = await import('@repo/service-core');
            const service = new McpActivityService({ logger: apiLogger });
            const { cutoff, deleted, wouldDelete } = await service.purgeExpired({
                now: startedAt,
                dryRun
            });
            const details = {
                dryRun,
                cutoff: cutoff.toISOString(),
                retentionMonths: MCP_AUDIT_RETENTION_MONTHS,
                deleted,
                wouldDelete
            };

            logger.info('MCP audit retention completed', details);

            return {
                success: true,
                message: dryRun
                    ? `Dry run - would delete ${wouldDelete} mcp.tool.call rows older than ${MCP_AUDIT_RETENTION_MONTHS} months`
                    : `Deleted ${deleted} mcp.tool.call rows older than ${MCP_AUDIT_RETENTION_MONTHS} months`,
                processed: deleted,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('MCP audit retention failed', { error: errorMessage });
            return {
                success: false,
                message: `MCP audit retention failed: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: errorMessage }
            };
        }
    }
};
