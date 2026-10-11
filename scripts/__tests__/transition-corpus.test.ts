import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    checkAnchoring,
    loadCorpus,
    parseCatalog,
    type TransitionCorpus,
    validateCorpus
} from '../transition-corpus';

const ROOT = path.resolve(import.meta.dirname, '../..');
function copyCorpus(): TransitionCorpus {
    return JSON.parse(JSON.stringify(loadCorpus({ root: ROOT }))) as TransitionCorpus;
}
describe('TEST:V4:16/17 - transition corpus shape and catalog anchoring', () => {
    it('accepts the real vertical declarations and validates their shape', () => {
        const corpus = loadCorpus({ root: ROOT });
        expect(validateCorpus({ corpus })).toEqual([]);
        expect(
            checkAnchoring({
                corpus,
                catalog: parseCatalog({ root: ROOT }),
                machines: ['trial', 'publication', 'partner_application']
            })
        ).toEqual([]);
        expect(Object.keys(corpus.machines)).toHaveLength(10);
        expect(corpus.transitions).toHaveLength(23);
        expect(
            corpus.transitions.filter((row) => row.machine === 'trial').map((row) => row.id)
        ).toEqual([
            'TRANS:V:T1',
            'TRANS:V:T2',
            'TRANS:V:T3',
            'TRANS:V:T4',
            'TRANS:V:T5',
            'TRANS:V:T6',
            'TRANS:V:T8'
        ]);
        expect(
            Object.values(corpus.machines).filter((machine) => machine.table !== null)
        ).toHaveLength(8);
        for (const name of ['grace', 'pause'])
            expect(corpus.machines[name]).toMatchObject({
                table: null,
                subStateOf: 'subscription',
                stateColumn: null,
                states: []
            });
    });
    it.each([
        [
            'reads without a dot',
            (corpus: TransitionCorpus) => {
                (corpus.transitions[0] as { reads: readonly string[] }).reads = ['trialstatus'];
            }
        ],
        [
            'input without a prefix',
            (corpus: TransitionCorpus) => {
                (corpus.transitions[0] as { inputs: readonly string[] }).inputs = ['covered'];
            }
        ],
        [
            'unknown state',
            (corpus: TransitionCorpus) => {
                (corpus.transitions[0] as { from: readonly string[] }).from = ['NO_SUCH_STATE'];
            }
        ],
        [
            'duplicate id',
            (corpus: TransitionCorpus) => {
                (corpus.transitions[1] as { id: string }).id = corpus.transitions[0]!.id;
            }
        ]
    ])('rejects %s', (_label, mutate) => {
        const corpus = copyCorpus();
        mutate(corpus);
        expect(validateCorpus({ corpus }).length).toBeGreaterThan(0);
    });
    it.each([
        [
            'extra row',
            (corpus: TransitionCorpus) => {
                (corpus.transitions as unknown as { id: string }[]).push({
                    ...corpus.transitions[0]!,
                    id: 'TRANS:V:ZZ99'
                });
            }
        ],
        [
            'missing PB7',
            (corpus: TransitionCorpus) => {
                (corpus.transitions as unknown as { id: string }[]).splice(
                    corpus.transitions.findIndex((row) => row.id === 'TRANS:V:PB7'),
                    1
                );
            }
        ],
        [
            'wrong T3 from',
            (corpus: TransitionCorpus) => {
                (
                    corpus.transitions.find((row) => row.id === 'TRANS:V:T3') as {
                        from: readonly string[];
                    }
                ).from = ['PRE_TRIAL'];
            }
        ],
        [
            'wrong T6 to',
            (corpus: TransitionCorpus) => {
                (corpus.transitions.find((row) => row.id === 'TRANS:V:T6') as { to: string }).to =
                    'TRIAL_ACTIVE';
            }
        ],
        [
            'wrong PP1 machine',
            (corpus: TransitionCorpus) => {
                (
                    corpus.transitions.find((row) => row.id === 'TRANS:V:PP1') as {
                        machine: string;
                    }
                ).machine = 'trial';
            }
        ]
    ])('detects anchoring drift: %s', (_label, mutate) => {
        const corpus = copyCorpus();
        mutate(corpus);
        expect(
            checkAnchoring({
                corpus,
                catalog: parseCatalog({ root: ROOT }),
                machines: ['trial', 'publication', 'partner_application']
            }).length
        ).toBeGreaterThan(0);
    });
});

describe('TEST:V4:9 (segunda mitad) - the trial table has no TRIAL_* -> SUSPENDED row', () => {
    it('has no SUSPENDED destination and does not declare it as a trial state', () => {
        const corpus = copyCorpus();
        const noForbiddenRow = () =>
            !corpus.transitions.some((row) => row.machine === 'trial' && row.to === 'SUSPENDED') &&
            !corpus.machines.trial.states.includes('SUSPENDED');
        expect(noForbiddenRow()).toBe(true);
        (corpus.machines.trial.states as string[]).push('SUSPENDED');
        (
            corpus.transitions as unknown as {
                machine: string;
                from: string[];
                events: string[];
                to: string;
                guard: Record<string, boolean>;
                id: string;
                reads: string[];
                inputs: string[];
                writes: string[];
            }[]
        ).push({
            ...corpus.transitions[0]!,
            id: 'TRANS:V:TEST_SUSPENDED',
            from: ['TRIAL_ACTIVE'],
            events: ['suspend_trial'],
            to: 'SUSPENDED',
            guard: {},
            reads: [],
            inputs: [],
            writes: ['trial.status', 'domain_event.changes']
        });
        expect(noForbiddenRow()).toBe(false);
    });
});
