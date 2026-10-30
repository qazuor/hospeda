import type { Page } from '@playwright/test';
import { execSQL } from './db-helpers.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';

const START_SUBSCRIPTION_PATH = '/api/v1/protected/billing/subscriptions';
const FAKE_APPROVAL_HOST = 'payments-fake.invalid';
const CHECKOUT_STUB_HTML = '<!doctype html><html><body>Fake provider checkout</body></html>';

/** The successful body of `POST /billing/subscriptions` the web checkout navigates with. */
export type SignupCheckoutConfirmation = {
    readonly subscriptionId: string;
    readonly authorizationId: string;
    readonly checkoutUrl: string;
    readonly vertical: string;
    readonly authorizationWindowEndsAt: string;
};

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

/**
 * Confirms an open signup checkout and reads the start response, instead of the
 * pending screen HOS-1896 removed from the happy path.
 *
 * The provider checkout navigation is answered with a local stub: the fake
 * provider's `approvalUrl` (`https://payments-fake.invalid/approve/<id>`,
 * M10's `?activation` already sanitized by the API) is not a page the suite can
 * load.
 *
 * @param options.page - The page already sitting on the signup checkout
 * @returns The start response fields every signup spec used to read from the screen
 */
export async function confirmSignupCheckout(options: {
    readonly page: Page;
}): Promise<SignupCheckoutConfirmation> {
    const { page } = options;
    const isFakeApprovalUrl = (url: URL): boolean => url.hostname === FAKE_APPROVAL_HOST;
    const isStartUrl = (url: URL): boolean => url.pathname === START_SUBSCRIPTION_PATH;

    // The island navigates away as soon as the start response lands, and the
    // browser then drops that response's body: `waitForResponse(...).json()`
    // fails with "No resource with given identifier found". So the body is read
    // here, while the request is still ours, and handed back unchanged.
    let resolveStart: (value: { readonly status: number; readonly text: string }) => void = () =>
        undefined;
    const startCaptured = new Promise<{ readonly status: number; readonly text: string }>(
        (resolve) => {
            resolveStart = resolve;
        }
    );
    await page.route(isStartUrl, async (route) => {
        if (route.request().method() !== 'POST') {
            await route.continue();
            return;
        }
        const fetched = await route.fetch();
        const text = await fetched.text();
        resolveStart({ status: fetched.status(), text });
        await route.fulfill({ response: fetched, body: text });
    });
    await page.route(isFakeApprovalUrl, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: CHECKOUT_STUB_HTML
        })
    );
    try {
        await page.getByTestId('signup-checkout-confirm').click();
        const response = await startCaptured;
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`Signup start failed (${response.status}): ${response.text}`);
        }
        const body = JSON.parse(response.text) as {
            readonly data?: Partial<SignupCheckoutConfirmation>;
        };
        const data = body.data;
        if (!data?.subscriptionId || !data.checkoutUrl || !data.authorizationWindowEndsAt) {
            throw new Error(
                'Signup start response is missing subscriptionId, checkoutUrl or authorizationWindowEndsAt.'
            );
        }
        await page.waitForURL((url) => url.href === data.checkoutUrl);
        return {
            subscriptionId: data.subscriptionId,
            authorizationId: data.authorizationId ?? '',
            checkoutUrl: data.checkoutUrl,
            vertical: data.vertical ?? '',
            authorizationWindowEndsAt: data.authorizationWindowEndsAt
        };
    } finally {
        await page.unroute(isFakeApprovalUrl);
        await page.unroute(isStartUrl);
    }
}
