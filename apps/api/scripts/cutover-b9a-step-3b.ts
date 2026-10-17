/**
 * Run the B9a step 3b permanent grant tool:
 * --actor-user-id=<uuid> --beneficiary=<uuid> --beneficiary=<uuid>
 * --plan-id=<uuid> --floor-plan-version-id=<uuid> --includes-addons=true|false
 * with exactly one of --dry-run or --confirm.
 * Run with --dry-run first; then with --confirm.
 */
import { resolve } from 'node:path';
import { initializeDb } from '@repo/db';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { parseStep3bArgs } from '../src/services/cutover-b9a/step-3b.args.js';
import type { composeStep3bProcess } from '../src/services/cutover-b9a/step-3b.compose.js';
import { serviceErrorReason } from '../src/services/cutover-b9a/step-3b.errors.js';
import { env, validateApiEnv } from '../src/utils/env.js';

/** Executes the protected, explicitly confirmed B9a cutover operation. */
async function main(): Promise<void> {
    loadEnv({ path: resolve(import.meta.dirname, '..', '.env.local'), quiet: true });
    validateApiEnv();
    const parsed = parseStep3bArgs({ argv: process.argv.slice(2) });
    if (!parsed.ok) {
        console.error(parsed.reason);
        process.exitCode = 2;
        return;
    }
    const pool = new Pool({ connectionString: env.HOSPEDA_DATABASE_URL });
    let processComposition: ReturnType<typeof composeStep3bProcess> | undefined;
    try {
        initializeDb(pool);
        const [{ composeStep3bProcess, resolveCutoverOperatorActor }, { runStep3b }] =
            await Promise.all([
                import('../src/services/cutover-b9a/step-3b.compose.js'),
                import('../src/services/cutover-b9a/step-3b.service.js')
            ]);
        processComposition = composeStep3bProcess();
        const actor = await resolveCutoverOperatorActor({ userId: parsed.value.actorUserId });
        const result = await runStep3b({
            actor,
            beneficiaryUserIds: parsed.value.beneficiaryUserIds,
            planId: parsed.value.planId,
            floorPlanVersionId: parsed.value.floorPlanVersionId,
            includesAddons: parsed.value.includesAddons,
            dryRun: parsed.value.dryRun,
            ports: processComposition.ports
        });
        console.info(JSON.stringify(result));
        process.exitCode = result.status === 'failed' ? 1 : 0;
    } catch (error) {
        const { reason } = serviceErrorReason({ error });
        console.error(
            JSON.stringify({
                errorClass: error instanceof Error ? error.name : 'UnknownError',
                ...(reason ? { reason } : {}),
                message: error instanceof Error ? error.message : 'Unknown error'
            })
        );
        process.exitCode = 1;
    } finally {
        processComposition?.stop();
        await pool.end();
    }
}

main().catch((error: unknown) => {
    const { reason } = serviceErrorReason({ error });
    console.error(
        JSON.stringify({
            errorClass: error instanceof Error ? error.name : 'UnknownError',
            ...(reason ? { reason } : {}),
            message: error instanceof Error ? error.message : 'Unknown error'
        })
    );
    process.exitCode = 1;
});
