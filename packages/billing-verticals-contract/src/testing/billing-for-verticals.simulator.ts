/**
 * The simulator of the billing side (contract §7.1, item 3): a programmable
 * in-memory fake of `BillingForVerticals`, so verticals is tested whole
 * without billing.
 *
 * Every answer crosses the validation gate: a programmed answer that does not
 * validate is NOT delivered (the call rejects with `ContractValidationError`).
 *
 * Unprogrammed answers are the ones the bootstrap implementation gives for
 * billing (contract §5.1, §6.1): no coverage, retention not stopped with no
 * instants, and nothing left that can charge.
 */
import type { CoverageArgs, CoverageResponse } from '../coverage.schema';
import type {
    CanChargeArgs,
    CanChargeResponse,
    CoverageChangedEvent,
    RetentionStoppedArgs,
    RetentionStoppedResponse
} from '../forward.schema';
import type { BillingForVerticals, ContractListener, Unsubscribe } from '../interfaces';
import type { UserVerticalArgs } from '../primitives.schema';
import { validateBillingForVerticals } from '../validation';
import { createListenerRegistry } from './listeners';

/** One call the simulator received, for assertions. */
export interface BillingSimulatorCall {
    readonly operation: 'coverage' | 'retentionStopped' | 'canCharge';
    readonly args: unknown;
}

const keyOf = ({ userId, vertical }: UserVerticalArgs): string => `${userId}\u0000${vertical}`;

/**
 * Programmable fake of the billing side.
 *
 * @example
 * const billing = new BillingForVerticalsSimulator();
 * billing.setCoverage({ userId, vertical, response: { covered: false, sources: [] } });
 * await billing.coverage({ userId, vertical });
 */
export class BillingForVerticalsSimulator implements BillingForVerticals {
    readonly #coverage = new Map<string, CoverageResponse>();
    readonly #retention = new Map<string, RetentionStoppedResponse>();
    readonly #canCharge = new Map<string, CanChargeResponse>();
    readonly #calls: BillingSimulatorCall[] = [];
    readonly #coverageChanged = createListenerRegistry<CoverageChangedEvent>().registry;
    readonly #gate: BillingForVerticals;

    constructor() {
        const calls = this.#calls;
        const raw: BillingForVerticals = {
            coverage: async (args) => {
                calls.push({ operation: 'coverage', args });
                return this.#coverage.get(keyOf(args)) ?? { covered: false, sources: [] };
            },
            retentionStopped: async (args) => {
                calls.push({ operation: 'retentionStopped', args });
                return (
                    this.#retention.get(keyOf(args)) ?? {
                        stopped: false,
                        pauseEndedAt: null,
                        coverageLostAt: null
                    }
                );
            },
            canCharge: async (args) => {
                calls.push({ operation: 'canCharge', args });
                return this.#canCharge.get(args.userId) ?? { canCharge: false };
            },
            onCoverageChanged: (listener) => this.#coverageChanged.add(listener)
        };
        this.#gate = validateBillingForVerticals({ implementation: raw }).validated;
    }

    /** The calls received so far, in order. */
    get calls(): readonly BillingSimulatorCall[] {
        return [...this.#calls];
    }

    /**
     * Programs the `coverage` answer for `(userId, vertical)`. The value is NOT
     * validated here: an invalid one makes `coverage` reject, which is the gate.
     */
    setCoverage(args: UserVerticalArgs & { readonly response: CoverageResponse }): void {
        this.#coverage.set(keyOf(args), args.response);
    }

    /** Programs the `retentionStopped` answer for `(userId, vertical)`. */
    setRetentionStopped(
        args: UserVerticalArgs & { readonly response: RetentionStoppedResponse }
    ): void {
        this.#retention.set(keyOf(args), args.response);
    }

    /** Programs the `canCharge` answer for `userId`. */
    setCanCharge(args: { readonly userId: string; readonly response: CanChargeResponse }): void {
        this.#canCharge.set(args.userId, args.response);
    }

    /**
     * Emits the coverage-changed notice to every listener and waits for them.
     * Call it AFTER programming the new answer: that is the after-commit rule
     * (contract §3), so a listener that re-reads sees the new state.
     */
    async emitCoverageChanged(args: { readonly event: CoverageChangedEvent }): Promise<void> {
        await this.#coverageChanged.deliver({ event: args.event });
    }

    /** @see BillingForVerticals.coverage */
    coverage(args: CoverageArgs): Promise<CoverageResponse> {
        return this.#gate.coverage(args);
    }

    /** @see BillingForVerticals.retentionStopped */
    retentionStopped(args: RetentionStoppedArgs): Promise<RetentionStoppedResponse> {
        return this.#gate.retentionStopped(args);
    }

    /** @see BillingForVerticals.canCharge */
    canCharge(args: CanChargeArgs): Promise<CanChargeResponse> {
        return this.#gate.canCharge(args);
    }

    /** @see BillingForVerticals.onCoverageChanged */
    onCoverageChanged(listener: ContractListener<CoverageChangedEvent>): Unsubscribe {
        return this.#gate.onCoverageChanged(listener);
    }
}
