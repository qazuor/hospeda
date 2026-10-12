import type { Page } from '@playwright/test';
import { execSQL } from './db-helpers.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';

async function monthlyOptionForSlug(slug: 'owner-basico' | 'tourist-vip'): Promise<string> {
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

export async function seedInheritingPlanHolder(options: {
    readonly userId: string;
}): Promise<void> {
    const optionId = await monthlyOptionForSlug('owner-basico');
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
        throw new Error('seedInheritingPlanHolder: current owner-basico catalog version not found');
    }
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
}
