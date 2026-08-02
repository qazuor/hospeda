/**
 * @file setup.ts
 * @description Idempotent PostHog setup scaffold for Hospeda dashboards, insights, cohorts, and optional annotations.
 */

import {
    ensureAnnotation,
    ensureCohort,
    ensureDashboard,
    ensureInsight,
    listDashboards,
    resolveConfig
} from './client.js';
import { COHORTS, DASHBOARDS, INSIGHTS } from './data.js';

async function main(): Promise<void> {
    const { host, projectId } = resolveConfig();
    const failures: string[] = [];

    console.log(`PostHog host: ${host}`);
    console.log(`PostHog project: ${projectId}`);
    console.log('Ensuring dashboards...');

    for (const dashboard of DASHBOARDS) {
        try {
            const result = await ensureDashboard(dashboard);
            console.log(`- dashboard: ${result.name} (#${result.id})`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            failures.push(`dashboard:${dashboard.name}: ${message}`);
            console.error(`- dashboard FAILED: ${dashboard.name}`);
            console.error(message);
        }
    }

    const ensuredDashboards = await listDashboards();

    console.log('Ensuring starter insights...');

    for (const insight of INSIGHTS) {
        try {
            const dashboard = ensuredDashboards.find((item) => item.name === insight.dashboardName);
            if (!dashboard) {
                throw new Error(`Dashboard not found after ensure: ${insight.dashboardName}`);
            }
            const result = await ensureInsight({ dashboardId: dashboard.id, definition: insight });
            console.log(
                `- insight: ${result.name ?? result.derived_name ?? `#${result.id}`} -> ${dashboard.name}`
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            failures.push(`insight:${insight.dashboardName}/${insight.name}: ${message}`);
            console.error(`- insight FAILED: ${insight.dashboardName} / ${insight.name}`);
            console.error(message);
        }
    }

    console.log('Ensuring cohorts...');

    for (const cohort of COHORTS) {
        try {
            const result = await ensureCohort(cohort);
            console.log(`- cohort: ${result.name} (#${result.id})`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            failures.push(`cohort:${cohort.name}: ${message}`);
            console.error(`- cohort FAILED: ${cohort.name}`);
            console.error(message);
        }
    }

    try {
        const annotation = await ensureAnnotation();
        if (annotation) {
            console.log(`- annotation: ${annotation.content} (#${annotation.id})`);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`annotation: ${message}`);
        console.error('- annotation FAILED');
        console.error(message);
    }

    console.log('PostHog setup scaffold completed.');
    console.log(
        'Note: dashboards, starter insights, and cohort placeholders are created idempotently in this phase.'
    );

    if (failures.length > 0) {
        console.error(`Completed with ${failures.length} failure(s):`);
        for (const failure of failures) {
            console.error(`  - ${failure}`);
        }
        process.exitCode = 1;
    }
}

void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
