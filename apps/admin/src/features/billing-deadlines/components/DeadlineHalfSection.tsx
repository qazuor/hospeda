import type { TranslationKey } from '@repo/i18n';
import { useState } from 'react';
import { useTranslations } from '@/hooks/use-translations';
import { DEADLINE_HALVES } from '../config/deadline-halves';
import type { DeadlineHalf } from '../hooks/useDeadlines';
import { useDeadlineVersion } from '../hooks/useDeadlines';
import { toFormFields } from '../lib/deadline-value-form';
import { DeadlineChangeForm } from './DeadlineChangeForm';

/** Loads and renders one independently failing deadline half. */
export function DeadlineHalfSection({ half }: { readonly half: DeadlineHalf }) {
    const { t } = useTranslations();
    const translate = (key: string, values?: Record<string, string | number>) =>
        t(key as TranslationKey, values);
    const query = useDeadlineVersion({ half });
    const [editing, setEditing] = useState<number | null>(null);
    const prefix = 'admin-billing.deadlinesEditor';

    return (
        <section
            data-testid={`deadlines-${half}`}
            className="space-y-4 rounded-lg border p-5"
        >
            <h2 className="font-semibold text-xl">{translate(`${prefix}.sections.${half}`)}</h2>
            {query.isLoading && <p>{translate(`${prefix}.loading`)}</p>}
            {query.isError && <p role="alert">{translate(`${prefix}.errors.load`)}</p>}
            {query.data && (
                <>
                    <p>{translate(`${prefix}.version`, { version: query.data.version })}</p>
                    <div className="space-y-3">
                        {DEADLINE_HALVES[half].keys.map((keyNumber) => {
                            const key = String(keyNumber);
                            const value = query.data.values[key];
                            const fields = toFormFields({ value });
                            return (
                                <article
                                    key={key}
                                    data-testid={`deadline-row-${key}`}
                                    className="space-y-2 border-t pt-3"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <h3 className="font-medium">
                                                {translate(`${prefix}.keyLabel`, { key })}:{' '}
                                                {translate(`${prefix}.keys.${key}`)}
                                            </h3>
                                            {fields.length ? (
                                                <dl className="flex flex-wrap gap-x-4">
                                                    {fields.map((field) => (
                                                        <div
                                                            key={field.name}
                                                            className="flex gap-1"
                                                        >
                                                            <dt>
                                                                {translate(
                                                                    `${prefix}.fields.${field.name}`
                                                                )}
                                                                :
                                                            </dt>
                                                            <dd>{field.text}</dd>
                                                        </div>
                                                    ))}
                                                </dl>
                                            ) : (
                                                <p>{translate(`${prefix}.noValue`)}</p>
                                            )}
                                        </div>
                                        {fields.length > 0 && editing !== keyNumber && (
                                            <button
                                                type="button"
                                                className="underline"
                                                onClick={() => setEditing(keyNumber)}
                                            >
                                                {translate(`${prefix}.edit`)}
                                            </button>
                                        )}
                                    </div>
                                    {editing === keyNumber && query.data && (
                                        <DeadlineChangeForm
                                            half={half}
                                            keyNumber={keyNumber}
                                            current={query.data}
                                            onCancel={() => setEditing(null)}
                                        />
                                    )}
                                </article>
                            );
                        })}
                    </div>
                </>
            )}
        </section>
    );
}
