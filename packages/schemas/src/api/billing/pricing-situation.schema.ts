import { z } from 'zod';
import { PublicPlanCatalogVerticalSchema } from './public-plan-catalog.schema.js';

/** Verticals whose pricing page can read a person's subscription situation. */
export const PricingSituationVerticalSchema = PublicPlanCatalogVerticalSchema;
export type PricingSituationVertical = z.infer<typeof PricingSituationVerticalSchema>;

/** The person can publish and start the vertical trial. */
const FirstUseSchema = z.object({
    /** The backend publication destination predicate allows starting the trial. */
    situation: z.literal('FIRST_USE'),
    trialDays: z.number().int().positive()
});
/** A trial is already running in this vertical. */
const TrialSchema = z.object({
    /** The backend publication destination and trial reader report running coverage. */
    situation: z.literal('TRIAL')
});
/** Checkout is allowed by the backend subscription checks. */
const CheckoutSchema = z.object({
    /** The backend publication destination or sellable tourist catalog allows checkout. */
    situation: z.literal('CHECKOUT')
});
/** A live subscription commitment exists in this vertical. */
const SubscribedSchema = z.object({
    /** The backend live-commitment lookup found this subscription. */
    situation: z.literal('SUBSCRIBED'),
    status: z.enum([
        'PENDING_AUTHORIZATION',
        'ACTIVE',
        'GRACE_PERIOD',
        'PAUSED',
        'SUSPENDED',
        'CANCEL_SCHEDULED'
    ]),
    planVersionId: z.string().uuid(),
    billingOptionId: z.string().uuid()
});
/** Existing benefits cover the vertical without a running trial. */
const CoveredSchema = z.object({
    /** The backend publication destination reports coverage without a running trial. */
    situation: z.literal('COVERED')
});
/** The backend has no sellable plan for this vertical. */
const NoPlansSchema = z.object({
    /** The backend publication destination or sellable catalog has no plans. */
    situation: z.literal('NO_PLANS')
});
/** An inherited tourist VIP blocks a second purchase. */
const TouristVipInheritedSchema = z.object({
    /** The backend S1 inheritance port reports inherited tourist VIP. */
    situation: z.literal('TOURIST_VIP_INHERITED')
});

/** A pricing situation resolved by the backend composition layer. */
export const PricingSituationResponseSchema = z.discriminatedUnion('situation', [
    FirstUseSchema,
    TrialSchema,
    CheckoutSchema,
    SubscribedSchema,
    CoveredSchema,
    NoPlansSchema,
    TouristVipInheritedSchema
]);
export type PricingSituationResponse = z.infer<typeof PricingSituationResponseSchema>;
