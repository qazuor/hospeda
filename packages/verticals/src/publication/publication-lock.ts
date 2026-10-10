import type {
    PublicationTransaction,
    PublicationUnitOfWork,
    PublicationVertical
} from './publication-types';

/** Runs a publication transition under the shared user and vertical lock. */
export async function withPublicationLock<T>(args: {
    readonly unitOfWork: PublicationUnitOfWork;
    readonly userId: string;
    readonly vertical: PublicationVertical;
    readonly work: (tx: PublicationTransaction) => Promise<T>;
}): Promise<T> {
    return args.unitOfWork.runLocked({ userId: args.userId, vertical: args.vertical }, args.work);
}

/** Runs independent effects after commit; failures become warnings. */
export async function publicationAfterCommit(args: {
    readonly tasks: readonly {
        readonly warning:
            | 'COVERAGE_NOTICE_FAILED'
            | 'CACHE_INVALIDATION_FAILED'
            | 'REVALIDATION_FAILED';
        readonly run: () => Promise<void>;
    }[];
}): Promise<
    readonly ('COVERAGE_NOTICE_FAILED' | 'CACHE_INVALIDATION_FAILED' | 'REVALIDATION_FAILED')[]
> {
    const warnings: (
        | 'COVERAGE_NOTICE_FAILED'
        | 'CACHE_INVALIDATION_FAILED'
        | 'REVALIDATION_FAILED'
    )[] = [];
    for (const task of args.tasks) {
        try {
            await task.run();
        } catch {
            warnings.push(task.warning);
        }
    }
    return warnings;
}
