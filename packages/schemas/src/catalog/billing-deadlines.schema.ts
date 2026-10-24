import { z } from 'zod';

const positiveMinutes = z.number().int().positive();
const positiveDays = z.number().int().positive();

/** The closed billing half of the configurable deadline catalog (PLAZO:10–20). */
export const BillingDeadlineValuesSchema = z
    .strictObject({
        '10': z.strictObject({ cardHours: positiveMinutes, manualDays: positiveDays }),
        '11': z.strictObject({
            noticeDays: positiveDays,
            contactDays: z.tuple([positiveDays, positiveDays])
        }),
        '12': z.strictObject({
            noticeDays: positiveDays,
            contactDays: z.tuple([positiveDays, positiveDays])
        }),
        '13': z.strictObject({ daysBefore: z.tuple([positiveDays, positiveDays]) }),
        '14': z.strictObject({ daysBefore: positiveDays }),
        '15': z.strictObject({ hoursRemaining: positiveMinutes }),
        '16': z.strictObject({ days: positiveDays }),
        '17': z.strictObject({ days: positiveDays }),
        '18': z.strictObject({ days: positiveDays }),
        '19': z.strictObject({ minutes: positiveMinutes }),
        '20': z.strictObject({ daysBefore: z.array(positiveDays).min(1).max(5) }).optional()
    })
    .superRefine((values, ctx) => {
        for (const key of ['11', '12'] as const) {
            const deadline = values[key];
            if (deadline.noticeDays < 60) {
                ctx.addIssue({
                    code: 'custom',
                    path: [key, 'noticeDays'],
                    message: 'El aviso no puede ser menor que 60 días'
                });
            }
            if (deadline.contactDays.some((days) => days >= deadline.noticeDays)) {
                ctx.addIssue({
                    code: 'custom',
                    path: [key, 'contactDays'],
                    message: 'Cada contacto debe ser anterior al aviso'
                });
            }
        }
        if (
            values['20'] &&
            new Set(values['20'].daysBefore).size !== values['20'].daysBefore.length
        ) {
            ctx.addIssue({
                code: 'custom',
                path: ['20', 'daysBefore'],
                message: 'Los días no pueden repetirse'
            });
        }
    });

/** One billing deadline key, including grace reminders 20. */
export const BillingDeadlineKeySchema = z.coerce.number().int().min(10).max(19);

/** Request to publish a new billing deadline version. */
export const ChangeBillingDeadlineSchema = z.strictObject({
    key: BillingDeadlineKeySchema,
    value: z.unknown(),
    expectedVersion: z.number().int().positive(),
    confirmed: z.literal(true)
});

/** Persisted complete snapshot of billing deadlines. */
export type BillingDeadlineValues = z.infer<typeof BillingDeadlineValuesSchema>;
