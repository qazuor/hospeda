import type { Page } from '@playwright/test';
import { execSQL } from './db-helpers.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';

/** The 0144 catalog plans these fixtures hold a monthly option of. */
export type CatalogSlug =
    | 'owner-basico'
    | 'owner-pro'
    | 'owner-premium'
    | 'tourist-vip'
    | 'partner-silver';

/**
 * Reads a limit value from the current version of a catalog plan without writing.
 *
 * @param options.slug - Catalog plan slug to read
 * @param options.key - Limit key to return
 * @returns The configured numeric limit; throws when the current version has no row
 */
export async function readCurrentPlanLimit(options: {
    readonly slug: CatalogSlug;
    readonly key: string;
}): Promise<number> {
    const rows = await execSQL<{ value: number }>(
        `SELECT plan_version_limit.value
           FROM plan
           JOIN plan_version ON plan_version.plan_id = plan.id
           JOIN plan_version_limit ON plan_version_limit.plan_version_id = plan_version.id
          WHERE plan.slug = $1 AND plan_version.current = true AND plan_version_limit.key = $2
          LIMIT 1`,
        [options.slug, options.key]
    );
    const value = rows[0]?.value;
    if (value === undefined) {
        throw new Error(
            `signup-checkout: current ${options.slug} catalog version has no ${options.key} limit`
        );
    }
    return value;
}

/**
 * The monthly billing option of the current catalog version of `slug`,
 * inserted when the 0144 catalog has none (it seeds no billing options).
 *
 * @param slug - The 0144 catalog plan
 * @returns The billing option id
 */
export async function monthlyOptionForSlug(slug: CatalogSlug): Promise<string> {
    const rows = await execSQL<{ id: string }>(
        `WITH current_version AS (
             SELECT plan_version.id
               FROM plan
               JOIN plan_version ON plan_version.plan_id = plan.id
              WHERE plan.slug = $1
                AND plan_version.current = true
              LIMIT 1
         ), inserted_option AS (
             INSERT INTO billing_option (plan_version_id, cycle, amount, currency)
             SELECT id, 'monthly', 250000, 'ARS' FROM current_version
             ON CONFLICT (plan_version_id, cycle) DO NOTHING
             RETURNING id
         )
         SELECT id FROM inserted_option
         UNION ALL
         SELECT billing_option.id
           FROM billing_option
           JOIN current_version ON billing_option.plan_version_id = current_version.id
          WHERE billing_option.cycle = 'monthly'
         LIMIT 1`,
        [slug]
    );
    const id = rows[0]?.id;
    if (!id) {
        throw new Error(
            `signup-checkout: current catalog version or monthly option missing for ${slug}`
        );
    }
    return id;
}

/**
 * The annual billing option of the current catalog version of `slug`,
 * inserted when the 0144 catalog has none.
 *
 * @param slug - The 0144 catalog plan
 * @returns The billing option id
 */
export async function annualOptionForSlug(slug: CatalogSlug): Promise<string> {
    const rows = await execSQL<{ id: string }>(
        `WITH current_version AS (
             SELECT plan_version.id
               FROM plan
               JOIN plan_version ON plan_version.plan_id = plan.id
              WHERE plan.slug = $1
                AND plan_version.current = true
              LIMIT 1
         ), inserted_option AS (
             INSERT INTO billing_option (plan_version_id, cycle, amount, currency)
             SELECT id, 'annual', 2400000, 'ARS' FROM current_version
             ON CONFLICT (plan_version_id, cycle) DO NOTHING
             RETURNING id
         )
         SELECT id FROM inserted_option
         UNION ALL
         SELECT billing_option.id
           FROM billing_option
           JOIN current_version ON billing_option.plan_version_id = current_version.id
          WHERE billing_option.cycle = 'annual'
         LIMIT 1`,
        [slug]
    );
    const id = rows[0]?.id;
    if (!id) {
        throw new Error(
            `signup-checkout: current catalog version or annual option missing for ${slug}`
        );
    }
    return id;
}

/**
 * Seeds an `ACTIVE` `PRINCIPAL` `CARD` subscription of the person, anchored to
 * the current catalog version of `slug` through its monthly option (inserted
 * when missing). No preapproval and no `provider_link`: the subscription covers
 * through the real coverage of B4 and grants that version's keys.
 *
 * @param options.userId - The subscriber
 * @param options.slug - The 0144 catalog plan to anchor to
 * @returns The id of the seeded subscription
 */
export async function seedActivePlanHolder(options: {
    readonly userId: string;
    readonly slug: CatalogSlug;
}): Promise<{ readonly subscriptionId: string }> {
    const optionId = await monthlyOptionForSlug(options.slug);
    const rows = await execSQL<{ id: string }>(
        `INSERT INTO subscription (
             user_id, vertical, plan_version_id, billing_option_id,
             payment_method, status, class
         )
         SELECT $1, plan_version.vertical, plan_version.id, $2,
                'CARD', 'ACTIVE', 'PRINCIPAL'
           FROM plan_version
          WHERE plan_version.id = (SELECT plan_version_id FROM billing_option WHERE id = $2)
            AND plan_version.current = true
         RETURNING id`,
        [options.userId, optionId]
    );
    if (!rows[0]) {
        throw new Error(`seedActivePlanHolder: current ${options.slug} catalog version not found`);
    }
    return { subscriptionId: rows[0].id };
}

/** Seeds a suspended principal title with the grace timestamps written by S6. */
export async function seedSuspendedPlanHolder(options: {
    readonly userId: string;
    readonly slug: CatalogSlug;
}): Promise<{ readonly subscriptionId: string }> {
    const seeded = await seedActivePlanHolder(options);
    const suspendedAt = new Date();
    await execSQL(
        `UPDATE subscription
            SET status = 'SUSPENDED', grace_started_at = $2, grace_ends_at = $3
          WHERE id = $1`,
        [seeded.subscriptionId, suspendedAt, suspendedAt]
    );
    return seeded;
}

/**
 * Seeds an `ACTIVE` `owner-basico` subscription, whose version inherits Tourist
 * VIP (TEST:B3:29/30). Delegates to {@link seedActivePlanHolder}.
 *
 * @param options.userId - The subscriber
 */
export async function seedInheritingPlanHolder(options: {
    readonly userId: string;
}): Promise<void> {
    await seedActivePlanHolder({ userId: options.userId, slug: 'owner-basico' });
}

export async function touristVipMonthlyOptionId(): Promise<string> {
    return monthlyOptionForSlug('tourist-vip');
}

export async function attachSession(page: Page, sessionCookie: string): Promise<void> {
    const cookies = sessionCookie.split('; ').flatMap((cookie) => {
        const [name, ...valueParts] = cookie.split('=');
        return name ? [{ name, value: valueParts.join('='), domain: 'localhost', path: '/' }] : [];
    });
    await page.context().addCookies(cookies);
}

export async function openSignupCheckout(options: {
    readonly page: Page;
    readonly webUrl?: string;
    readonly billingOptionId: string;
}): Promise<void> {
    const baseUrl = options.webUrl ?? WEB_URL;
    await options.page.goto(
        `${baseUrl}/es/suscriptores/checkout/?opcion=${encodeURIComponent(options.billingOptionId)}`
    );
    // The island is server-rendered: wait until React has attached (HOS-1890).
    await options.page.locator('[data-testid="signup-checkout"][data-hydrated="true"]').waitFor();
}
