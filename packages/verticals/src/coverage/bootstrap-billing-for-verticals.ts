/** Bootstrap implementation of the full forward contract. */
import {
    CoverageArgsSchema,
    CoverageChangedEventSchema,
    CoverageResponseSchema,
    type BillingForVerticals,
    type ContractListener,
    type CoverageChangedEvent
} from '@repo/billing-verticals-contract';
import {
    bootstrapAddonAnswer,
    bootstrapCanChargeAnswer,
    bootstrapCourtesyAnswer,
    bootstrapGrantAnswer,
    bootstrapRetentionStoppedAnswer,
    bootstrapSubscriptionAnswer
} from './bootstrap-billing-answers';
import {
    resolveTrialAndBaseSources,
    type BootstrapCoverageReader
} from './trial-and-base-sources';

/** The contract plus the post-commit event entry point for trial transitions. */
export interface BootstrapBillingForVerticals extends BillingForVerticals {
    /** Emit after the write that changed coverage commits. */
    emitCoverageChanged(event: CoverageChangedEvent): Promise<void>;
}

/** Assemble bootstrap coverage, billing answers, and the event listener registry. */
export function createBootstrapBillingForVerticals(args: {
    readonly reader: BootstrapCoverageReader;
}): BootstrapBillingForVerticals {
    const listeners = new Set<ContractListener<CoverageChangedEvent>>();
    return {
        async coverage(input) {
            const parsed = CoverageArgsSchema.parse(input);
            const resolved = await resolveTrialAndBaseSources({ reader: args.reader, input: parsed });
            return CoverageResponseSchema.parse({
                covered: resolved.covered,
                sources: [
                    ...resolved.sources,
                    ...bootstrapSubscriptionAnswer(),
                    ...bootstrapCourtesyAnswer(),
                    ...bootstrapGrantAnswer(),
                    ...bootstrapAddonAnswer()
                ]
            });
        },
        async retentionStopped(input) {
            return bootstrapRetentionStoppedAnswer(input);
        },
        async canCharge(input) {
            return bootstrapCanChargeAnswer(input);
        },
        onCoverageChanged(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        async emitCoverageChanged(event) {
            const parsed = CoverageChangedEventSchema.parse(event);
            await Promise.all([...listeners].map((listener) => listener(parsed)));
        }
    };
}
