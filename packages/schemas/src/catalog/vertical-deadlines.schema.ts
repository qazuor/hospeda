import { z } from 'zod';

const positiveDays = z.number().int().positive();
const nonnegativeDays = z.number().int().nonnegative();

/** Complete, versioned snapshot of vertical deadlines (PLAZO:1–9). */
export const VerticalDeadlineValuesSchema = z
    .strictObject({
        '1': z.strictObject({ days: positiveDays }),
        '2': z.strictObject({ days: positiveDays }),
        '3': z.strictObject({ months: z.number().int().positive() }),
        '4': z.strictObject({ beforeArchiveDays: positiveDays, beforeDeletionDays: positiveDays }),
        '5': z.strictObject({
            daysBefore: z.tuple([
                nonnegativeDays,
                nonnegativeDays,
                nonnegativeDays,
                nonnegativeDays
            ])
        }),
        '6': z.strictObject({
            daysAfter: z.tuple([
                positiveDays,
                positiveDays,
                positiveDays,
                positiveDays,
                positiveDays
            ])
        }),
        '7': z.strictObject({ days: positiveDays }),
        '8': z.strictObject({ days: positiveDays }),
        '9': z.strictObject({ days: positiveDays })
    })
    .superRefine((values, ctx) => {
        if (values['1'].days >= values['2'].days) {
            ctx.addIssue({
                code: 'custom',
                path: ['1', 'days'],
                message: 'El archivado tiene que ser anterior al borrado'
            });
        }
        if (values['3'].months * 31 >= values['2'].days) {
            ctx.addIssue({
                code: 'custom',
                path: ['3', 'months'],
                message: 'El plazo en meses tiene que ser anterior al borrado'
            });
        }
        for (const key of ['beforeArchiveDays', 'beforeDeletionDays'] as const) {
            if (
                values['4'][key] >= values['1'].days ||
                values['4'][key] >= values['2'].days - values['1'].days
            ) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['4', key],
                    message: 'El aviso tiene que ser anterior al plazo correspondiente'
                });
            }
        }
        if (
            values['5'].daysBefore.some(
                (days, index, all) => index > 0 && days >= (all[index - 1] ?? 0)
            )
        ) {
            ctx.addIssue({
                code: 'custom',
                path: ['5', 'daysBefore'],
                message: 'Los avisos previos tienen que decrecer estrictamente'
            });
        }
        if (
            values['6'].daysAfter.some(
                (days, index, all) => index > 0 && days <= (all[index - 1] ?? 0)
            )
        ) {
            ctx.addIssue({
                code: 'custom',
                path: ['6', 'daysAfter'],
                message: 'Los avisos posteriores tienen que crecer estrictamente'
            });
        }
    });

/** One vertical deadline key. */
export const VerticalDeadlineKeySchema = z.coerce.number().int().min(1).max(9);

/** Request to publish a new vertical deadline version. */
export const ChangeVerticalDeadlineSchema = z.strictObject({
    key: VerticalDeadlineKeySchema,
    value: z.unknown(),
    expectedVersion: z.number().int().positive(),
    confirmed: z.literal(true)
});

/** Persisted complete snapshot of vertical deadlines. */
export type VerticalDeadlineValues = z.infer<typeof VerticalDeadlineValuesSchema>;
