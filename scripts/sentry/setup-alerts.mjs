#!/usr/bin/env node
/**
 * Sentry alert-rules provisioner (infrastructure-as-code).
 *
 * The Sentry MCP server cannot create alert rules, so this script provisions
 * them via the Sentry REST API. It does NOT create duplicates: existing rules
 * (matched by exact name) are skipped, so it is safe to re-run. It does NOT
 * update existing rules if their parameters changed in this file — to change
 * an existing rule, delete it in the Sentry UI and re-run the script.
 *
 * Usage:
 *   SENTRY_AUTH_TOKEN=<org-token-with-alerts:write> node scripts/sentry/setup-alerts.mjs
 *   SENTRY_AUTH_TOKEN=... node scripts/sentry/setup-alerts.mjs --dry-run
 *
 * Generate the token at:
 *   https://qazuor.sentry.io/settings/auth-tokens/  (Organization Auth Token)
 *   Required scopes: alerts:write, project:read, org:read
 *
 * The token is read from the environment and never persisted.
 *
 * Optional env vars:
 *   SENTRY_NOTIFY_USER_ID  Sentry member ID to notify (default: 3609705,
 *                          leandro asrilevich / qazuor@gmail.com).
 */

const ORG = 'qazuor';
const REGION_BASE = 'https://us.sentry.io/api/0';

// Email notification target: the Sentry member who receives every alert.
// User ID resolved from the org (leandro asrilevich / qazuor@gmail.com).
// Override via SENTRY_NOTIFY_USER_ID if provisioning for a different member.
// biome-ignore lint/suspicious/noUndeclaredEnvVars: standalone ops script, not run under turbo
const NOTIFY_USER_ID = Number(process.env.SENTRY_NOTIFY_USER_ID ?? 3609705);

// biome-ignore lint/suspicious/noUndeclaredEnvVars: standalone ops script, not run under turbo
const TOKEN = process.env.SENTRY_AUTH_TOKEN;
const DRY_RUN = process.argv.includes('--dry-run');

if (!TOKEN) {
    console.error('❌ SENTRY_AUTH_TOKEN is not set. See the header of this file.');
    process.exit(1);
}

/** Email action: notify a specific member (arrives in their Sentry email). */
const emailAction = {
    id: 'sentry.mail.actions.NotifyEmailAction',
    targetType: 'Member',
    targetIdentifier: NOTIFY_USER_ID
};

/** Condition: an issue is seen for the first time. */
const firstSeen = { id: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition' };

/** Filter: event level is >= error (40 = error, 50 = fatal). */
const levelErrorOrAbove = {
    id: 'sentry.rules.filters.level.LevelFilter',
    match: 'gte',
    level: '40'
};

/** Condition: an issue exceeds `value` events within `interval`. */
const spike = (value, interval = '1h') => ({
    id: 'sentry.rules.conditions.event_frequency.EventFrequencyCondition',
    interval,
    value,
    comparisonType: 'count'
});

/**
 * Rule set. `environment: 'production'` keeps alerts out of staging noise —
 * staging errors are still captured and visible in the dashboard, they just
 * don't page you by email.
 */
const RULES = [
    // --- API ---
    {
        project: 'hospeda-api',
        name: '🔴 [api] New error in production',
        environment: 'production',
        frequency: 30,
        conditions: [firstSeen],
        filters: [levelErrorOrAbove]
    },
    {
        project: 'hospeda-api',
        name: '🔴 [api] Error spike in production (>20/1h)',
        environment: 'production',
        frequency: 60,
        conditions: [spike(20)],
        filters: [levelErrorOrAbove]
    },
    // --- WEB ---
    {
        project: 'hospeda-web',
        name: '🔴 [web] New error in production',
        environment: 'production',
        frequency: 30,
        conditions: [firstSeen],
        filters: [levelErrorOrAbove]
    },
    {
        project: 'hospeda-web',
        name: '🟡 [web] Error spike in production (>50/1h)',
        environment: 'production',
        frequency: 60,
        conditions: [spike(50)],
        filters: [levelErrorOrAbove]
    },
    // --- ADMIN ---
    {
        project: 'hospeda-admin',
        name: '🔴 [admin] New error in production',
        environment: 'production',
        frequency: 30,
        conditions: [firstSeen],
        filters: [levelErrorOrAbove]
    },
    {
        project: 'hospeda-admin',
        name: '🟡 [admin] Error spike in production (>20/1h)',
        environment: 'production',
        frequency: 60,
        conditions: [spike(20)],
        filters: [levelErrorOrAbove]
    }
];

const headers = {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
};

async function listExistingRuleNames(project) {
    const res = await fetch(`${REGION_BASE}/projects/${ORG}/${project}/rules/`, { headers });
    if (!res.ok) {
        throw new Error(`List rules failed for ${project}: ${res.status} ${await res.text()}`);
    }
    const rules = await res.json();
    return new Set(rules.map((r) => r.name));
}

async function createRule(rule) {
    const body = {
        name: rule.name,
        actionMatch: 'all',
        filterMatch: 'all',
        frequency: rule.frequency,
        environment: rule.environment,
        conditions: rule.conditions,
        filters: rule.filters ?? [],
        actions: [emailAction]
    };
    const res = await fetch(`${REGION_BASE}/projects/${ORG}/${rule.project}/rules/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        throw new Error(`Create failed for "${rule.name}": ${res.status} ${await res.text()}`);
    }
    return res.json();
}

async function main() {
    console.log(`Sentry alert provisioner — org=${ORG}${DRY_RUN ? ' (dry-run)' : ''}\n`);
    const byProject = new Map();
    for (const rule of RULES) {
        if (!byProject.has(rule.project)) {
            byProject.set(rule.project, await listExistingRuleNames(rule.project));
        }
        const existing = byProject.get(rule.project);
        if (existing.has(rule.name)) {
            console.log(`⏭️  exists (not updated — delete in Sentry UI to recreate)  ${rule.name}`);
            continue;
        }
        if (DRY_RUN) {
            console.log(`➕ would create  ${rule.name}`);
            continue;
        }
        await createRule(rule);
        console.log(`✅ created  ${rule.name}`);
    }
    console.log('\nDone.');
}

main().catch((err) => {
    console.error(`\n❌ ${err.message}`);
    process.exit(1);
});
