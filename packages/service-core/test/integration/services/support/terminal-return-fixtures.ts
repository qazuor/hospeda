import { reconciliationTerminalReturnModel } from '@repo/db';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { vi } from 'vitest';
import {
    seedSubscription,
    trackSeededReconciliationRow
} from '../reconciliation-sweep-fixtures.js';

const terminalReturnIds = new Set<string>();

export async function seedTerminalRow(input: {
    readonly status: string;
    readonly fake: FakePaymentProvider;
    readonly withLink?: boolean;
}) {
    const seeded = await seedSubscription({
        status: input.status,
        withLink: input.withLink ?? true,
        fake: input.fake
    });
    terminalReturnIds.add(seeded.subscription.id);
    trackSeededReconciliationRow(seeded.subscription.id);
    return seeded;
}

export function resetSeededTerminalReturnInventory(): void {
    terminalReturnIds.clear();
}

/** Restricts the terminal population to this file's test rows and re-applies keyset paging. */
export async function withSeededTerminalReturnInventory<T>(run: () => Promise<T>): Promise<T> {
    const original = reconciliationTerminalReturnModel.listTerminalReturnPage.bind(
        reconciliationTerminalReturnModel
    );
    const spy = vi.spyOn(reconciliationTerminalReturnModel, 'listTerminalReturnPage');
    spy.mockImplementation(async (input) => {
        const rows = await original({ ...input, limit: 10_000, afterSubscriptionId: undefined });
        const owned = rows.filter(({ subscription }) => terminalReturnIds.has(subscription.id));
        const after =
            input.afterSubscriptionId === undefined
                ? owned
                : owned.filter(({ subscription }) => subscription.id > input.afterSubscriptionId!);
        return after.slice(0, input.limit);
    });
    try {
        return await run();
    } finally {
        spy.mockRestore();
    }
}
