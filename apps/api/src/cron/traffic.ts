import {
    GOVERNOR_MAX_WAIT_SAMPLES,
    type ProviderTrafficGovernor,
    runWithTrafficClass,
    type TrafficCounterSink
} from '@repo/payments';
import { getMercadoPagoTrafficGovernor } from '../utils/mp-traffic-governor';
import type { CronJobContext, CronJobDefinition, CronJobResult } from './types';

interface RunCounter {
    requests: number;
    status2xx: number;
    status429: number;
    status5xx: number;
    networkErrors: number;
    waitMs: number[];
    fastFailures: number;
    coolDowns: number;
    coolDownMs: number;
    unclassified: number;
    memoHits: number;
    redisFallbacks: number;
}

function createRunCounter(): RunCounter {
    return {
        requests: 0,
        status2xx: 0,
        status429: 0,
        status5xx: 0,
        networkErrors: 0,
        waitMs: [],
        fastFailures: 0,
        coolDowns: 0,
        coolDownMs: 0,
        unclassified: 0,
        memoHits: 0,
        redisFallbacks: 0
    };
}

function recordWaitSample(args: {
    readonly key: string;
    readonly waitMs: number;
    readonly counters: Map<string, RunCounter>;
    readonly waitSampleKeys: string[];
}): void {
    const counter = args.counters.get(args.key);
    if (!counter) return;
    counter.waitMs.push(args.waitMs);
    args.waitSampleKeys.push(args.key);
    if (args.waitSampleKeys.length > GOVERNOR_MAX_WAIT_SAMPLES) {
        const oldestKey = args.waitSampleKeys.shift();
        if (oldestKey !== undefined) args.counters.get(oldestKey)?.waitMs.shift();
    }
}

function createSink(injectedGovernor?: ProviderTrafficGovernor): {
    readonly sink: TrafficCounterSink;
    readonly counters: Map<string, RunCounter>;
    readonly governor?: ProviderTrafficGovernor;
} {
    const counters = new Map<string, RunCounter>();
    const waitSampleKeys: string[] = [];
    const governor = injectedGovernor ?? getMercadoPagoTrafficGovernor();
    const sink: TrafficCounterSink = {
        record: (args) => {
            const key = `${args.trafficClass}:${args.capability}`;
            let counter = counters.get(key);
            if (!counter) {
                counter = createRunCounter();
                counters.set(key, counter);
            }
            if (args.request) counter.requests += 1;
            if (args.memoHit) counter.memoHits += 1;
            if (args.redisFallback) counter.redisFallbacks += 1;
            if (args.memoHit)
                governor?.recordMemoHit({
                    trafficClass: args.trafficClass,
                    capability: args.capability
                });
            if (
                args.status === 200 ||
                (args.status !== undefined && args.status >= 200 && args.status < 300)
            )
                counter.status2xx += 1;
            if (args.status === 429) {
                counter.status429 += 1;
                counter.coolDowns += 1;
            }
            if (args.status !== undefined && args.status >= 500) counter.status5xx += 1;
            if (args.networkError) counter.networkErrors += 1;
            if (args.waitMs !== undefined)
                recordWaitSample({ key, waitMs: args.waitMs, counters, waitSampleKeys });
            if (args.fastFailure) counter.fastFailures += 1;
            if (args.coolDownMs !== undefined) counter.coolDownMs += args.coolDownMs;
            if (args.unclassified) counter.unclassified += 1;
        },
        toProviderTraffic: () => snapshotCounters(counters)
    };
    return { sink, counters, governor };
}

function snapshotCounters(
    counters: ReadonlyMap<string, RunCounter>
): Readonly<Record<string, unknown>> {
    const byCapability: Record<string, unknown> = {};
    const totals = createRunCounter();
    for (const [key, value] of counters) {
        const sorted = [...value.waitMs].sort((left, right) => left - right);
        byCapability[key] = {
            requests: value.requests,
            status2xx: value.status2xx,
            status429: value.status429,
            status5xx: value.status5xx,
            networkErrors: value.networkErrors,
            waitMs: {
                p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
                p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
                max: sorted[sorted.length - 1] ?? 0
            },
            fastFailures: value.fastFailures,
            coolDowns: value.coolDowns,
            coolDownMs: value.coolDownMs,
            unclassified: value.unclassified,
            memoHits: value.memoHits,
            redisFallbacks: value.redisFallbacks,
            snapshotHits: 0
        };
        totals.requests += value.requests;
        totals.status2xx += value.status2xx;
        totals.status429 += value.status429;
        totals.status5xx += value.status5xx;
        totals.networkErrors += value.networkErrors;
        totals.waitMs.push(...value.waitMs);
        totals.fastFailures += value.fastFailures;
        totals.coolDowns += value.coolDowns;
        totals.coolDownMs += value.coolDownMs;
        totals.unclassified += value.unclassified;
        totals.memoHits += value.memoHits;
        totals.redisFallbacks += value.redisFallbacks;
    }
    const sorted = [...totals.waitMs].sort((left, right) => left - right);
    const p50 = sorted.length === 0 ? 0 : (sorted[Math.ceil(sorted.length * 0.5) - 1] ?? 0);
    const p95 = sorted.length === 0 ? 0 : (sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0);
    const { waitMs: _waitSamples, ...counts } = totals;
    return {
        ...counts,
        waitMs: { p50, p95, max: sorted[sorted.length - 1] ?? 0 },
        memoHits: totals.memoHits,
        snapshotHits: 0,
        redisFallbacks: totals.redisFallbacks,
        byCapability
    };
}

/** Run one cron handler as background traffic and attach governed request counts. */
export async function runCronHandlerInBackground(args: {
    readonly job: Pick<CronJobDefinition, 'handler'>;
    readonly ctx: CronJobContext;
    readonly governor?: ProviderTrafficGovernor;
}): Promise<CronJobResult> {
    const { sink, counters } = createSink(args.governor);
    const result = await runWithTrafficClass({
        context: {
            trafficClass: 'background',
            signal: args.ctx.signal,
            deadlineAt: args.ctx.deadlineAt,
            counters: sink
        },
        fn: () => args.job.handler(args.ctx)
    });
    if (
        ![...counters.values()].some(
            (counter) => counter.requests > 0 || counter.fastFailures > 0 || counter.memoHits > 0
        )
    )
        return result;
    return {
        ...result,
        details: { ...result.details, providerTraffic: sink.toProviderTraffic() }
    };
}
