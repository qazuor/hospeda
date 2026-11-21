/**
 * @file my-plan-reader.ts
 * @description The owner's plan per vertical, read once for every assistant
 * surface that shows it (HOS-2328, spec HOS-2335 §6.3, C-6): `get_my_plan`,
 * the `subscription` block of `get_owner_summary` (AC-C33), and HOS-2184
 * phase B AC-16 when it is built. They import {@link readMyPlan}; none of them
 * has a second implementation (AC-C15b).
 *
 * A thin adapter over existing reads, never raw tables:
 * - subscriptions: `readOwnPlanState` (service-core), the reader behind
 *   `GET /protected/billing-subscription/`;
 * - trial: `readTrialSummary`, the service behind
 *   `GET /protected/publish/trial-summary/{vertical}`, plus `readOwnTrialPlan`
 *   for the trial plan's catalog row;
 * - includes: the cached effective set (`getListingAccessPorts().effectiveSet`
 *   and `toEffectiveSetView`), so a catalog change shows with no code change;
 * - add-ons: `readOwnerAddonHoldings`, the read behind
 *   `GET /billing-addon/instances`;
 * - inherited Tourist VIP (HOS-2398): the cached TOURIST effective set read the
 *   same way, shown apart as `inheritedTouristVip` when the set says it is
 *   inherited (`inheritsTouristVip`), never mixed into an owner item's includes;
 * - the trial's «a paid plan also brings Tourist VIP» line (HOS-2398): the
 *   sellable catalog the plans pages read (`readSellablePlanCatalog`);
 * - courtesy and permanent grant: billing's own `coverage(user, vertical)`
 *   (`getListingAccessPorts().billing.coverage`, contract §2), its `COURTESY`
 *   and `GRANT` sources, plus `readPlanOfVersion` for the plan they point at.
 *
 * One item per vertical, by this precedence (AC-C16):
 * 1. a live principal subscription, unless a courtesy is what pauses it;
 * 2. a permanent grant (it never ends, and it is the floor the effective set uses);
 * 3. a courtesy (it ends on a date);
 * 4. a running trial;
 * 5. a courtesy-paused subscription whose courtesy billing no longer reports
 *    (shown as the `PAUSED` subscription it is).
 *
 * Labels come from `@repo/i18n` in the caller's locale. Plan names come from
 * the catalog row, never from a code map (HOS-1967).
 */

import type { CoverageSource } from '@repo/billing-verticals-contract';
import type { Locale } from '@repo/i18n';
import type { PortalDestination } from '@repo/portal-routes';
import { buildPortalUrl, type PortalLocale } from '@repo/portal-routes';
import { OwnSubscriptionsResponseSchema, TrialStatusEnum, VerticalEnum } from '@repo/schemas';
import { readOwnPlanState } from '@repo/service-core';
import {
    type OwnerAddonHolding,
    readOwnerAddonHoldings
} from '../../../services/billing-addon/owner-recurring-addons.service';
import { isTrialRunning } from '../../../services/listing-notices/listing-notices.builder';
import {
    readOwnTrialPlan,
    readTrialSummary
} from '../../../services/listing-notices/listing-notices.service';
import { readPlanOfVersion } from '../../../services/plan-catalog/plan-of-version.service';
import { env } from '../../../utils/env';
import { toEffectiveSetView } from '../../../utils/listing-access/effective-set-view';
import { getListingAccessPorts } from '../../../utils/listing-access/ports';
import { apiLogger } from '../../../utils/logger';
import { label, labelView } from './my-plan-labels';
import { readInheritedTouristVip, readTouristVipOnUpgrade } from './my-plan-tourist-vip';
import {
    MY_PLAN_VERTICALS,
    type MyPlanAddon,
    type MyPlanIncludes,
    type MyPlanItem,
    type MyPlanPlan,
    type MyPlanPlansLink,
    type MyPlanResult,
    type MyPlanVertical
} from './my-plan-types';

const DAY_MS = 86_400_000;

/**
 * The status contract of Mi suscripción. The live set itself is the plan-state
 * reader's (registered in the live-term inventory); this only narrows its
 * `varchar` to the statuses the response contract declares.
 */
const OwnSubscriptionStatusSchema =
    OwnSubscriptionsResponseSchema.shape.subscriptions.element.shape.status;

/** Verticals with a plans page in the portal. */
const PLANS_PAGE_VERTICALS = ['accommodation', 'venue', 'experience'] as const;

function portalUrl(destination: PortalDestination, locale: PortalLocale): string {
    return buildPortalUrl({ destination, locale, siteUrl: env.HOSPEDA_SITE_URL });
}

function isSubscriptionStatus(status: string): status is MyPlanItem['status'] {
    return OwnSubscriptionStatusSchema.safeParse(status).success;
}

/** The effective set of a vertical, as labelled includes; `null` when it cannot be read. */
async function readIncludes(input: {
    readonly userId: string;
    readonly vertical: MyPlanVertical;
    readonly locale: Locale;
}): Promise<MyPlanIncludes | null> {
    const { userId, vertical, locale } = input;
    try {
        const effective = await getListingAccessPorts().effectiveSet({ userId, vertical });
        return labelView(toEffectiveSetView({ effective, userId, vertical }), locale);
    } catch (error) {
        apiLogger.warn(
            { userId, vertical, error: error instanceof Error ? error.message : String(error) },
            'get_my_plan: effective set could not be read'
        );
        return null;
    }
}

function toAddon(holding: OwnerAddonHolding, locale: Locale): MyPlanAddon {
    return {
        name: label({ key: `billing.addon.${holding.slug}.name`, locale, fallback: holding.name }),
        status: holding.status,
        endsAt: holding.endsAt?.toISOString() ?? null,
        // Only a live recurring add-on renews with the subscription; one whose
        // checkout is still open has not started, so it renews with nothing yet.
        renewsWithSubscription: holding.status === 'ACTIVE' && holding.endsAt === null,
        ...(holding.listingGone ? { listingGone: true as const } : {})
    };
}

function planOf(input: {
    readonly slug: string;
    readonly name: string;
    readonly version: string | null;
    readonly locale: Locale;
}): MyPlanPlan {
    return {
        slug: input.slug,
        name: label({
            key: `billing.plan.${input.slug}.name`,
            locale: input.locale,
            fallback: input.name
        }),
        version: input.version
    };
}

/** The title part of an item (everything but includes, add-ons and links), or `null` without one. */
type TitlePart = Pick<
    MyPlanItem,
    | 'plan'
    | 'status'
    | 'trialState'
    | 'statusLabel'
    | 'nextChargeAt'
    | 'serviceEndsAt'
    | 'graceEndsAt'
    | 'trialDaysLeft'
    | 'coverageEndsAt'
>;

/** A running trial of the vertical as a title, or `null` when there is none. */
async function readTrialTitle(input: {
    readonly userId: string;
    readonly vertical: MyPlanVertical;
    readonly locale: Locale;
    readonly now: Date;
}): Promise<TitlePart | null> {
    const { userId, vertical, locale, now } = input;
    const summary = await readTrialSummary({ userId, vertical });
    if (summary.status === 'NONE') {
        return null;
    }
    const endsAt = summary.endsAt ? new Date(summary.endsAt) : null;
    // The rule of Mi cuenta row 2: TRIAL_ACTIVE and its clock not ended yet.
    const { running } = isTrialRunning({
        trial: {
            status: summary.status,
            startedAt: summary.startedAt ? new Date(summary.startedAt) : null,
            endsAt
        },
        now
    });
    if (!running) {
        return null;
    }
    const trialPlan = await readOwnTrialPlan({ userId, vertical });
    return {
        plan: trialPlan
            ? planOf({
                  slug: trialPlan.slug,
                  name: trialPlan.name,
                  version: trialPlan.planVersionId,
                  locale
              })
            : null,
        status: 'TRIAL',
        trialState: TrialStatusEnum.TRIAL_ACTIVE,
        statusLabel: label({ key: 'account.subscription.statusTrial', locale, fallback: 'TRIAL' }),
        nextChargeAt: null,
        serviceEndsAt: null,
        graceEndsAt: null,
        trialDaysLeft: endsAt
            ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS))
            : null,
        coverageEndsAt: null
    };
}

/** Billing's sources for the vertical; empty (and logged) when they cannot be read. */
async function readCoverageSources(input: {
    readonly userId: string;
    readonly vertical: MyPlanVertical;
}): Promise<readonly CoverageSource[]> {
    try {
        // Exactly the contract's keys: its strict gate rejects any extra one (HOS-2397).
        const coverage = await getListingAccessPorts().billing.coverage({
            userId: input.userId,
            vertical: input.vertical
        });
        return coverage.sources;
    } catch (error) {
        apiLogger.warn(
            {
                userId: input.userId,
                vertical: input.vertical,
                error: error instanceof Error ? error.message : String(error)
            },
            'get_my_plan: coverage could not be read'
        );
        return [];
    }
}

/**
 * A permanent grant or a courtesy of the vertical as a title (AC-C16), the
 * grant first; `null` when billing reports neither.
 */
async function readGrantedTitle(input: {
    readonly userId: string;
    readonly vertical: MyPlanVertical;
    readonly locale: Locale;
}): Promise<TitlePart | null> {
    const { locale } = input;
    const sources = await readCoverageSources(input);
    const source =
        sources.find((candidate) => candidate.type === 'GRANT') ??
        sources.find((candidate) => candidate.type === 'COURTESY');
    if (source?.reference.kind !== 'PLAN_VERSION') {
        return null;
    }
    const planVersionId = source.reference.planVersionId;
    const catalogPlan = await readPlanOfVersion({ planVersionId });
    const status = source.type === 'GRANT' ? 'PERMANENT_GRANT' : 'COURTESY';
    return {
        plan: catalogPlan
            ? planOf({
                  slug: catalogPlan.slug,
                  name: catalogPlan.name,
                  version: planVersionId,
                  locale
              })
            : null,
        status,
        trialState: null,
        statusLabel: label({
            key: `account.subscription.mine.status.${status}`,
            locale,
            fallback: status
        }),
        nextChargeAt: null,
        serviceEndsAt: null,
        graceEndsAt: null,
        trialDaysLeft: null,
        coverageEndsAt: source.until instanceof Date ? source.until.toISOString() : null
    };
}

/**
 * Reads the owner's plan per vertical.
 *
 * The caller checks `BILLING_VIEW_OWN` first: this reader decides nothing about
 * who may read it, and only ever reads the given owner's rows.
 *
 * @param input.userId - The owner.
 * @param input.vertical - Only this vertical; all of them when omitted.
 * @param input.locale - Locale of labels and links (`es` when omitted).
 * @param input.now - The caller's clock instant.
 * @returns One item per vertical with a live subscription, a permanent grant,
 *   a courtesy or a running trial (precedence in the file header); with none,
 *   an empty list and the plans pages (AC-C15).
 */
export async function readMyPlan(input: {
    readonly userId: string;
    readonly vertical?: MyPlanVertical;
    readonly locale?: PortalLocale;
    readonly now: Date;
}): Promise<MyPlanResult> {
    const { userId, now } = input;
    const locale = input.locale ?? 'es';
    const verticals: readonly MyPlanVertical[] = input.vertical
        ? [input.vertical]
        : MY_PLAN_VERTICALS;

    const [planState, holdings] = await Promise.all([
        readOwnPlanState({ userId, now }),
        readOwnerAddonHoldings({ userId })
    ]);

    const titles = await Promise.all(
        verticals.map(async (vertical): Promise<TitlePart | null> => {
            // The newest live principal subscription of the vertical wins,
            // unless a courtesy is what pauses it (precedence in the file header).
            const subscription = planState.subscriptions
                .filter((row) => row.vertical === vertical && isSubscriptionStatus(row.status))
                .at(-1);
            const courtesyPaused =
                subscription?.status === 'PAUSED' && subscription.pause?.reason === 'COURTESY';
            const subscriptionTitle = (): TitlePart | null => {
                if (!subscription || !isSubscriptionStatus(subscription.status)) {
                    return null;
                }
                return {
                    plan: planOf({
                        slug: subscription.plan.slug,
                        name: subscription.plan.name,
                        version: subscription.planVersionId,
                        locale
                    }),
                    status: subscription.status,
                    trialState: null,
                    statusLabel: label({
                        key: `account.subscription.mine.status.${subscription.status}`,
                        locale,
                        fallback: subscription.status
                    }),
                    nextChargeAt: subscription.nextCharge?.at.toISOString() ?? null,
                    serviceEndsAt: subscription.serviceEndsAt?.toISOString() ?? null,
                    graceEndsAt: subscription.graceEndsAt?.toISOString() ?? null,
                    trialDaysLeft: null,
                    coverageEndsAt: null
                };
            };
            if (subscription && !courtesyPaused) {
                return subscriptionTitle();
            }
            return (
                (await readGrantedTitle({ userId, vertical, locale })) ??
                (await readTrialTitle({ userId, vertical, locale, now })) ??
                subscriptionTitle()
            );
        })
    );

    const held = verticals.flatMap((vertical, index) => {
        const title = titles[index];
        return title ? [{ vertical, title }] : [];
    });
    const items = await Promise.all(
        held.map(async ({ vertical, title }): Promise<MyPlanItem> => {
            const addons = holdings
                .filter((holding) => holding.verticals.includes(vertical))
                .map((holding) => toAddon(holding, locale));
            const onUpgrade =
                title.status === 'TRIAL'
                    ? await readTouristVipOnUpgrade({ vertical, locale })
                    : undefined;
            return {
                vertical,
                verticalLabel: label({
                    key: `account.subscription.mine.vertical.${vertical}`,
                    locale,
                    fallback: vertical
                }),
                ...title,
                includes: await readIncludes({ userId, vertical, locale }),
                addons,
                actionUrl: portalUrl({ kind: 'subscription' }, locale),
                ...(addons.length > 0 ? { addonsUrl: portalUrl({ kind: 'addons' }, locale) } : {}),
                ...(onUpgrade ? { touristVipOnUpgrade: onUpgrade } : {})
            };
        })
    );

    // A charged add-on is never hidden: one in scope that no item shows (it belongs
    // to no vertical, or none of its verticals has a title) is listed apart, once.
    const shownVerticals = new Set<string>(items.map((item) => item.vertical));
    const unattributed = holdings
        .filter(
            (holding) =>
                holding.verticals.length === 0 ||
                holding.verticals.some((vertical) =>
                    (verticals as readonly string[]).includes(vertical)
                )
        )
        .filter((holding) => !holding.verticals.some((vertical) => shownVerticals.has(vertical)))
        .map((holding) => toAddon(holding, locale));
    const unattributedPart =
        unattributed.length > 0
            ? { unattributedAddons: unattributed, addonsUrl: portalUrl({ kind: 'addons' }, locale) }
            : {};
    // A listed tourist item already shows the inherited benefits in its includes.
    const inherited = shownVerticals.has(VerticalEnum.TOURIST)
        ? undefined
        : await readInheritedTouristVip({ userId, locale });
    const inheritedPart = inherited ? { inheritedTouristVip: inherited } : {};
    if (items.length > 0) {
        return { items, ...unattributedPart, ...inheritedPart };
    }
    const plans: MyPlanPlansLink[] = PLANS_PAGE_VERTICALS.filter((vertical) =>
        (verticals as readonly string[]).includes(vertical)
    ).map((vertical) => ({ vertical, url: portalUrl({ kind: 'plans', vertical }, locale) }));
    return { items, plans, ...unattributedPart, ...inheritedPart };
}
