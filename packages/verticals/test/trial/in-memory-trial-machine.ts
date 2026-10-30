import {
    TrialStatusEnum,
    VERTICAL_ACTIVATION_EVENTS,
    type Vertical,
    type VerticalActivationEvent
} from '@repo/schemas';
import { trialMachineLockKey } from '../../src/trial/trial-lock-key';
import type {
    TrialCampaignKind,
    TrialExpiryScanner,
    TrialMachineRow,
    TrialMachineTransaction,
    TrialMachineUnitOfWork
} from '../../src/trial/trial-machine-types';
import type { NewConsumedTrialRow } from '../../src/trial/trial-start-types';

interface Campaign {
    readonly userId: string;
    readonly vertical: Vertical;
    readonly campaign: TrialCampaignKind;
    readonly at: Date;
    readonly deadlinesVersion: number;
    readonly milestones: readonly Date[];
}

interface Redemption {
    readonly userId: string;
    readonly vertical: Vertical;
    readonly appliedDays: number;
    readonly appliedAt: Date;
}

interface AdminExtension {
    readonly trialId: string;
    readonly userId: string;
    readonly vertical: Vertical;
    readonly actorId: string;
    readonly reason: string;
    readonly days: number;
    readonly previousEndsAt: Date;
    readonly endsAt: Date;
    readonly occurredAt: Date;
}

function copyRow(row: TrialMachineRow): TrialMachineRow {
    return {
        ...row,
        startedAt: row.startedAt === null ? null : new Date(row.startedAt.getTime()),
        endsAt: row.endsAt === null ? null : new Date(row.endsAt.getTime())
    };
}

/** Builds a transactional in-memory trial machine with a real per-key mutex. */
export function createInMemoryTrialMachine() {
    let rows = new Map<string, TrialMachineRow>();
    let campaigns: Campaign[] = [];
    let redemptions = new Map<string, Redemption>();
    let adminExtensions: AdminExtension[] = [];
    const ceilingDays = new Map<Vertical, number>();
    const locks = new Map<string, Promise<void>>();
    const held = new Set<string>();
    const markExpiredFailures = new Set<string>();
    const ceilingReads: { readonly vertical: Vertical; readonly deadlinesVersion: number }[] = [];
    const log: string[] = [];
    let beforeWork: (() => void | Promise<void>) | undefined;
    let redemptionInsertConflict:
        | { readonly redemptionKey: string; readonly redemption: Redemption }
        | undefined;
    let failAdminRecord = false;
    const declaredEvents = new Map<Vertical, VerticalActivationEvent | null>();
    const planDays = new Map<Vertical, number | null>();
    const exercised = new Set<string>();
    let pseudonyms = new Map<string, string>();
    let insertConflict:
        | {
              readonly userId: string;
              readonly vertical: Vertical;
              readonly emailPseudonym: string;
              readonly conflict: 'USER_VERTICAL' | 'EMAIL_PSEUDONYM';
          }
        | undefined;

    const rowKey = (userId: string, vertical: Vertical) =>
        trialMachineLockKey({ userId, vertical }).key;

    const scanner: TrialExpiryScanner = {
        async findDueTrials({ now, limit }) {
            return [...rows.values()]
                .filter(
                    (row) =>
                        row.status === TrialStatusEnum.TRIAL_ACTIVE &&
                        row.endsAt !== null &&
                        row.endsAt <= now
                )
                .slice(0, limit)
                .map(({ userId, vertical }) => ({ userId, vertical }));
        }
    };

    const unitOfWork: TrialMachineUnitOfWork = {
        async runLocked(args, work) {
            const key = rowKey(args.userId, args.vertical);
            const prior = locks.get(key);
            let release: () => void = () => undefined;
            const gate = new Promise<void>((resolve) => {
                release = resolve;
            });
            locks.set(key, gate);
            if (prior !== undefined) await prior;
            held.add(key);
            try {
                await beforeWork?.();
                const draftRows = new Map([...rows].map(([id, row]) => [id, copyRow(row)]));
                const draftCampaigns = [...campaigns];
                const draftRedemptions = new Map(redemptions);
                const draftAdminExtensions = [...adminExtensions];
                const draftPseudonyms = new Map(pseudonyms);
                const rowById = (id: string) => {
                    const row = [...draftRows.values()].find((candidate) => candidate.id === id);
                    if (row === undefined) throw new Error('Trial row missing');
                    return row;
                };
                const transaction: TrialMachineTransaction = {
                    async findActivationEvent({ vertical }) {
                        return declaredEvents.has(vertical)
                            ? (declaredEvents.get(vertical) ?? null)
                            : VERTICAL_ACTIVATION_EVENTS.LISTING_PUBLISHED;
                    },
                    async findTrialPlan({ vertical }) {
                        const days = planDays.has(vertical) ? (planDays.get(vertical) ?? null) : 14;
                        return days === null
                            ? null
                            : {
                                  planId: `plan:${vertical}`,
                                  planVersionId: `version:${vertical}`,
                                  trialDays: days
                              };
                    },
                    async findTrialOfUser({ userId, vertical }) {
                        const row = draftRows.get(rowKey(userId, vertical));
                        return row ? { id: row.id } : null;
                    },
                    async findTrialByPseudonym({ emailPseudonym, vertical }) {
                        const userId = draftPseudonyms.get(`${vertical}:${emailPseudonym}`);
                        return userId === undefined ? null : { userId };
                    },
                    async insertTrial({ row }) {
                        if (
                            insertConflict?.userId === row.userId &&
                            insertConflict.vertical === row.vertical &&
                            insertConflict.emailPseudonym === row.emailPseudonym
                        ) {
                            return { inserted: false, conflict: insertConflict.conflict };
                        }
                        const pseudonymKey = `${row.vertical}:${row.emailPseudonym}`;
                        if (draftRows.has(rowKey(row.userId, row.vertical)))
                            return { inserted: false, conflict: 'USER_VERTICAL' };
                        if (draftPseudonyms.has(pseudonymKey))
                            return { inserted: false, conflict: 'EMAIL_PSEUDONYM' };
                        const consumed = row as NewConsumedTrialRow;
                        const id = crypto.randomUUID();
                        draftRows.set(rowKey(row.userId, row.vertical), {
                            id,
                            userId: row.userId,
                            vertical: row.vertical,
                            status: consumed.status,
                            startedAt: consumed.startedAt,
                            endsAt: consumed.endsAt,
                            deadlinesVersion: consumed.deadlinesVersion
                        });
                        draftPseudonyms.set(pseudonymKey, row.userId);
                        log.push('insertConsumedTrial');
                        return { inserted: true };
                    },
                    async hasExercisedActivationEvent({ userId, vertical }) {
                        log.push('hasExercised');
                        return exercised.has(rowKey(userId, vertical));
                    },
                    async findTrialForUpdate({ userId, vertical }) {
                        const row = draftRows.get(rowKey(userId, vertical));
                        return row === undefined ? null : copyRow(row);
                    },
                    async markConverted({ trialId }) {
                        log.push('markConverted');
                        const row = rowById(trialId);
                        draftRows.set(rowKey(row.userId, row.vertical), {
                            ...row,
                            status: TrialStatusEnum.TRIAL_CONVERTED
                        });
                    },
                    async markExpired({ trialId, deadlinesVersion }) {
                        log.push('markExpired');
                        if (markExpiredFailures.has(trialId))
                            throw new Error('Injected markExpired failure');
                        const row = rowById(trialId);
                        draftRows.set(rowKey(row.userId, row.vertical), {
                            ...row,
                            status: TrialStatusEnum.TRIAL_EXPIRED,
                            deadlinesVersion
                        });
                    },
                    async moveEndsAt({ trialId, endsAt }) {
                        log.push('moveEndsAt');
                        const row = rowById(trialId);
                        draftRows.set(rowKey(row.userId, row.vertical), { ...row, endsAt });
                    },
                    async scheduleExpiryCampaign({
                        userId,
                        vertical,
                        endsAt,
                        deadlinesVersion,
                        milestones
                    }) {
                        log.push('scheduleExpiry');
                        draftCampaigns.push({
                            userId,
                            vertical,
                            campaign: 'PRE_EXPIRY',
                            at: endsAt,
                            deadlinesVersion,
                            milestones
                        });
                    },
                    async scheduleRecoveryCampaign({
                        userId,
                        vertical,
                        expiredAt,
                        deadlinesVersion,
                        milestones
                    }) {
                        log.push('scheduleRecovery');
                        draftCampaigns.push({
                            userId,
                            vertical,
                            campaign: 'RECOVERY',
                            at: expiredAt,
                            deadlinesVersion,
                            milestones
                        });
                    },
                    async cancelCampaign({ userId, vertical, campaign }) {
                        log.push(`cancel:${campaign}`);
                        for (let i = draftCampaigns.length - 1; i >= 0; i--) {
                            const item = draftCampaigns[i];
                            if (
                                item?.userId === userId &&
                                item.vertical === vertical &&
                                item.campaign === campaign
                            ) {
                                draftCampaigns.splice(i, 1);
                            }
                        }
                    },
                    async findRedemption({ redemptionKey }) {
                        log.push('findRedemption');
                        const redemption = draftRedemptions.get(redemptionKey);
                        return redemption === undefined
                            ? null
                            : { userId: redemption.userId, vertical: redemption.vertical };
                    },
                    async insertRedemption({
                        userId,
                        vertical,
                        redemptionKey,
                        appliedDays,
                        appliedAt
                    }) {
                        log.push('insertRedemption');
                        if (redemptionInsertConflict?.redemptionKey === redemptionKey) {
                            draftRedemptions.set(
                                redemptionKey,
                                redemptionInsertConflict.redemption
                            );
                            return { inserted: false };
                        }
                        if (draftRedemptions.has(redemptionKey)) return { inserted: false };
                        draftRedemptions.set(redemptionKey, {
                            userId,
                            vertical,
                            appliedDays,
                            appliedAt
                        });
                        return { inserted: true };
                    },
                    async findTrialCeilingDays({ vertical, deadlinesVersion }) {
                        ceilingReads.push({ vertical, deadlinesVersion });
                        const ceiling = ceilingDays.get(vertical);
                        if (ceiling === undefined) throw new Error('Trial ceiling not configured');
                        return ceiling;
                    },
                    async recordAdminExtension(extension) {
                        log.push('recordAdmin');
                        if (failAdminRecord) throw new Error('Injected admin record failure');
                        draftAdminExtensions.push(extension);
                    }
                };
                const result = await work(transaction);
                rows = draftRows;
                campaigns = draftCampaigns;
                redemptions = draftRedemptions;
                adminExtensions = draftAdminExtensions;
                pseudonyms = draftPseudonyms;
                log.push('commit');
                return result;
            } catch (error) {
                log.push('rollback');
                throw error;
            } finally {
                held.delete(key);
                if (locks.get(key) === gate) locks.delete(key);
                release();
            }
        }
    };

    return {
        unitOfWork,
        scanner,
        log,
        get rows() {
            return new Map([...rows].map(([key, row]) => [key, copyRow(row)]));
        },
        get campaigns() {
            return [...campaigns];
        },
        get redemptions() {
            return new Map(redemptions);
        },
        get adminExtensions() {
            return [...adminExtensions];
        },
        get ceilingReads() {
            return [...ceilingReads];
        },
        seedRedemption(redemptionKey: string, redemption: Redemption) {
            redemptions.set(redemptionKey, redemption);
        },
        setRedemptionInsertConflict(redemptionKey: string, redemption: Redemption) {
            redemptionInsertConflict = { redemptionKey, redemption };
        },
        failRecordAdminExtension() {
            failAdminRecord = true;
        },
        seedTrial(row: TrialMachineRow) {
            rows.set(rowKey(row.userId, row.vertical), copyRow(row));
        },
        trialOf(userId: string, vertical: Vertical) {
            const row = rows.get(rowKey(userId, vertical));
            return row === undefined ? null : copyRow(row);
        },
        setCeilingDays(vertical: Vertical, days: number) {
            ceilingDays.set(vertical, days);
        },
        setDeclaredEvent(vertical: Vertical, event: VerticalActivationEvent | null) {
            declaredEvents.set(vertical, event);
        },
        setTrialPlanDays(vertical: Vertical, days: number | null) {
            planDays.set(vertical, days);
        },
        seedExercised(args: { readonly userId: string; readonly vertical: Vertical }) {
            exercised.add(rowKey(args.userId, args.vertical));
        },
        seedPseudonym(args: {
            readonly emailPseudonym: string;
            readonly vertical: Vertical;
            readonly userId: string;
        }) {
            pseudonyms.set(`${args.vertical}:${args.emailPseudonym}`, args.userId);
        },
        forceInsertConflict(args: {
            readonly userId: string;
            readonly vertical: Vertical;
            readonly emailPseudonym: string;
            readonly conflict: 'USER_VERTICAL' | 'EMAIL_PSEUDONYM';
        }) {
            insertConflict = args;
        },
        setBeforeWork(hook: (() => void | Promise<void>) | undefined) {
            beforeWork = hook;
        },
        failMarkExpiredFor(trialId: string) {
            markExpiredFailures.add(trialId);
        },
        isLocked(key: string) {
            return held.has(key);
        }
    };
}
