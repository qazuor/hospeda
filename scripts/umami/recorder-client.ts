import { z } from 'zod';
import { type UmamiClientConfig, umamiRequest } from './client.js';
import {
    normalizeReplayConfig,
    REPLAY_CONFIG_KEYS,
    type ReplayConfig,
    withRecorderDefaults
} from './recorder-definitions.js';

/**
 * Recorder step of the Umami setup (HOS-2347). Reads the website, compares the
 * declared recorder config against the stored one (both normalized and
 * defaulted, exactly as the recorder GET would answer), and writes only on a
 * difference.
 *
 * The write sends ONLY `replayConfig` with the declared keys. Umami merges it
 * over the stored config, so a key Umami keeps but this script does not declare
 * is preserved. `name`, `domain` and every other website field are never sent.
 */

/** The website fields the recorder step reads. Other fields pass through untouched. */
export const websiteRecorderSchema = z
    .object({
        id: z.string(),
        recorderEnabled: z.boolean().nullable().optional(),
        replayConfig: z.unknown().optional()
    })
    .passthrough();

/** A website as read by the recorder step. */
export type UmamiWebsiteRecorder = z.infer<typeof websiteRecorderSchema>;

/** One planned change of a recorder field. */
export interface RecorderFieldChange {
    /** `recorderEnabled`, or `replayConfig.<key>`. */
    readonly field: string;
    readonly from: unknown;
    readonly to: unknown;
}

/** Outcome of {@link planRecorderChange}. */
export interface RecorderPlan {
    readonly action: 'updated' | 'unchanged';
    readonly changes: readonly RecorderFieldChange[];
    /** Keys present in the stored `replay_config` that this script does not declare. */
    readonly unmanagedKeys: readonly string[];
}

/**
 * Pure diff between the stored recorder columns and the declared config.
 *
 * @param input.website - The website as read from `GET /api/websites/:id`
 * @param input.desired - The declared, fully defaulted config
 * @returns The planned action, the per-field changes and the unmanaged keys
 */
export function planRecorderChange(input: {
    readonly website: UmamiWebsiteRecorder;
    readonly desired: ReplayConfig;
}): RecorderPlan {
    const { website, desired } = input;
    const stored = withRecorderDefaults({
        config: normalizeReplayConfig({ raw: website.replayConfig ?? null })
    });
    const changes: RecorderFieldChange[] = [];
    // Umami derives `recorderEnabled` from the config; a read that omits it is
    // judged by the same rule, so it never produces a false "updated".
    const storedEnabled =
        typeof website.recorderEnabled === 'boolean'
            ? website.recorderEnabled
            : stored.replayEnabled || stored.heatmapEnabled;
    const desiredEnabled = desired.replayEnabled || desired.heatmapEnabled;
    if (storedEnabled !== desiredEnabled) {
        changes.push({ field: 'recorderEnabled', from: storedEnabled, to: desiredEnabled });
    }
    for (const key of REPLAY_CONFIG_KEYS) {
        if (stored[key] !== desired[key]) {
            changes.push({ field: `replayConfig.${key}`, from: stored[key], to: desired[key] });
        }
    }
    const declared = new Set<string>(REPLAY_CONFIG_KEYS);
    const raw = website.replayConfig;
    const unmanagedKeys =
        raw !== null && typeof raw === 'object' && !Array.isArray(raw)
            ? Object.keys(raw).filter((key) => !declared.has(key))
            : [];
    return { action: changes.length === 0 ? 'unchanged' : 'updated', changes, unmanagedKeys };
}

/**
 * Reads the website, plans the recorder change and, unless `config.dryRun`,
 * writes the declared config with one `POST /api/websites/:id`.
 *
 * @param input.config - Client configuration (dry-run aware)
 * @param input.websiteId - The WEB website id
 * @param input.desired - The declared config
 * @returns The plan that was applied (or would be, in dry-run)
 * @throws {UmamiApiError} On a failed read or write
 */
export async function upsertRecorderConfig(input: {
    readonly config: UmamiClientConfig;
    readonly websiteId: string;
    readonly desired: ReplayConfig;
}): Promise<RecorderPlan> {
    const { config, websiteId, desired } = input;
    const path = `/api/websites/${encodeURIComponent(websiteId)}`;
    const website = await umamiRequest({
        config,
        method: 'GET',
        path,
        schema: websiteRecorderSchema
    });
    const plan = planRecorderChange({ website, desired });
    if (plan.action === 'unchanged' || config.dryRun === true) return plan;
    await umamiRequest({
        config,
        method: 'POST',
        path,
        body: { replayConfig: { ...desired } },
        schema: websiteRecorderSchema
    });
    return plan;
}
