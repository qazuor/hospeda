/**
 * @fileoverview
 * Historical no-op for 0047. The structural migration 0085_known_agent_zero.sql
 * already rewrote the affected production rows; the later HOS-1481 structural
 * migration removes the partner commercial columns entirely. This migration
 * keeps its ledger name and reports zero because there is no remaining field to
 * rewrite.
 */
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0047-hos-294-retire-bronze-tier',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Historical rewrite already happened in SQL migration 0085; no rows remain to update. */
export async function up(_ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    return {
        summary: 'No-op: the structural migration already rewrote the historical partner rows.',
        counts: { partnersRetiered: 0 }
    };
}
