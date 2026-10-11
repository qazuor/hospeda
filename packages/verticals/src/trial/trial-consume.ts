import { CoverageArgsSchema, type CoverageResponse } from '@repo/billing-verticals-contract';
import { TrialStatusEnum, type Vertical, type VerticalActivationEvent } from '@repo/schemas';
import { findConvertingTitle } from './trial-conversion';
import { InvalidTrialMachineInputError } from './trial-machine-types';
import type { NewConsumedTrialRow, TrialConsumeTransaction } from './trial-start-types';

/** Reasons T6 or T8 can decline to consume a trial row. */
export type TrialConsumeDeniedReason =
    | 'NO_CONVERTING_TITLE'
    | 'EVENT_NOT_DECLARED_BY_VERTICAL'
    | 'TRIAL_DAYS_NOT_POSITIVE'
    | 'USER_ALREADY_HAS_TRIAL_ROW'
    | 'EMAIL_PSEUDONYM_ALREADY_USED';

type TrialConsumeInput = {
    readonly userId: string;
    readonly vertical: Vertical;
    readonly emailPseudonym: string;
    readonly expectedEvent: VerticalActivationEvent | null;
};

type TrialConsumeReader = Pick<
    TrialConsumeTransaction,
    'findActivationEvent' | 'findTrialPlan' | 'findTrialOfUser' | 'findTrialByPseudonym'
>;

/** Evaluates the shared T6/T8 guards in their required first-failure order. */
export async function evaluateTrialConsume(args: {
    readonly reader: TrialConsumeReader;
    readonly coverage: CoverageResponse;
    readonly input: TrialConsumeInput;
}): Promise<
    | { readonly consumes: true }
    | { readonly consumes: false; readonly reason: TrialConsumeDeniedReason }
> {
    if (findConvertingTitle({ coverage: args.coverage }).source === null) {
        return { consumes: false, reason: 'NO_CONVERTING_TITLE' };
    }
    const declaredEvent = await args.reader.findActivationEvent({ vertical: args.input.vertical });
    if (
        declaredEvent === null ||
        (args.input.expectedEvent !== null && declaredEvent !== args.input.expectedEvent)
    ) {
        return { consumes: false, reason: 'EVENT_NOT_DECLARED_BY_VERTICAL' };
    }
    const plan = await args.reader.findTrialPlan({ vertical: args.input.vertical });
    if (plan === null || plan.trialDays <= 0) {
        return { consumes: false, reason: 'TRIAL_DAYS_NOT_POSITIVE' };
    }
    const trial = await args.reader.findTrialOfUser({
        userId: args.input.userId,
        vertical: args.input.vertical
    });
    if (trial !== null) return { consumes: false, reason: 'USER_ALREADY_HAS_TRIAL_ROW' };
    const pseudonymOwner = await args.reader.findTrialByPseudonym({
        emailPseudonym: args.input.emailPseudonym,
        vertical: args.input.vertical
    });
    if (pseudonymOwner !== null) {
        return { consumes: false, reason: 'EMAIL_PSEUDONYM_ALREADY_USED' };
    }
    return { consumes: true };
}

/** Evaluates and writes T6/T8 consumption inside the caller's transaction. */
export async function consumeTrialInTransaction(args: {
    readonly tx: TrialConsumeTransaction;
    readonly coverage: CoverageResponse;
    readonly input: TrialConsumeInput;
}): Promise<
    | { readonly consumed: true; readonly row: NewConsumedTrialRow }
    | { readonly consumed: false; readonly reason: TrialConsumeDeniedReason }
> {
    if (
        !CoverageArgsSchema.safeParse({
            userId: args.input.userId,
            vertical: args.input.vertical
        }).success
    ) {
        throw new InvalidTrialMachineInputError({ field: 'userId' });
    }
    if (findConvertingTitle({ coverage: args.coverage }).source === null) {
        return { consumed: false, reason: 'NO_CONVERTING_TITLE' };
    }
    if (!/^[0-9a-f]{64}$/.test(args.input.emailPseudonym)) {
        throw new InvalidTrialMachineInputError({ field: 'emailPseudonym' });
    }
    const decision = await evaluateTrialConsume({
        reader: args.tx,
        coverage: args.coverage,
        input: args.input
    });
    if (!decision.consumes) return { consumed: false, reason: decision.reason };

    const row: NewConsumedTrialRow = {
        userId: args.input.userId,
        vertical: args.input.vertical,
        status: TrialStatusEnum.TRIAL_CONVERTED,
        emailPseudonym: args.input.emailPseudonym,
        trialPlanId: null,
        floorEntitlementsVersionId: null,
        floorLimitsVersionId: null,
        floorTrialPlanVersionId: null,
        startedAt: null,
        endsAt: null,
        deadlinesVersion: null
    };
    const inserted = await args.tx.insertTrial({ row });
    if (inserted.inserted) return { consumed: true, row };
    return {
        consumed: false,
        reason:
            inserted.conflict === 'USER_VERTICAL'
                ? 'USER_ALREADY_HAS_TRIAL_ROW'
                : 'EMAIL_PSEUDONYM_ALREADY_USED'
    };
}
