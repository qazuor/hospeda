/**
 * @file benefit-usage-confirmation.ts
 * @description The confirmation form message of `confirm_benefit_usage` and
 * `reject_benefit_usage` (HOS-2247, spec §5.7).
 *
 * Server facts (the answer, its consequences, the date) come first. The
 * provider's name is a quoted one-line label, and the declarant's note and the
 * rejection note are blocks: all three are third-party or model-supplied text
 * that must not be able to change the message's structure
 * (`confirmation-text.ts`).
 */

import { blockForConfirmation, quoteForConfirmation } from '../confirmation-text';

/** Cap of a note shown in the form, in characters (the schema allows more). */
const NOTE_MAX_LENGTH = 600;

/**
 * The text the client's confirmation form shows the human.
 *
 * @param args - The answer, the usage as read, and the rejection note to send
 * @returns The Spanish form message
 */
export function benefitUsageConfirmationMessage(args: {
    readonly action: 'confirm' | 'reject';
    readonly providerName: string | null;
    readonly servicedAt: string;
    readonly declarantNote: string | null;
    readonly rejectionNote: string | null;
}): string {
    const confirming = args.action === 'confirm';
    const head = confirming
        ? [
              'Vas a CONFIRMAR un uso de beneficio en Hospeda.',
              'Cuenta en los contadores públicos del proveedor y no se puede deshacer.'
          ]
        : [
              'Vas a RECHAZAR un uso de beneficio en Hospeda.',
              'La otra parte no podrá volver a declarar uno con vos; podés revertirlo después.'
          ];
    const facts = [
        `Fecha del servicio: ${args.servicedAt}`,
        args.providerName === null
            ? 'Proveedor: sin nombre'
            : `Proveedor: ${quoteForConfirmation({ text: args.providerName })}`
    ];
    const declarant =
        args.declarantNote === null
            ? []
            : [
                  'Nota de quien lo declaró:',
                  blockForConfirmation({ text: args.declarantNote, maxLength: NOTE_MAX_LENGTH })
              ];
    const rejection = confirming
        ? []
        : args.rejectionNote === null
          ? ['Sin nota de rechazo.']
          : [
                'Nota de rechazo que va a recibir la otra parte:',
                blockForConfirmation({ text: args.rejectionNote, maxLength: NOTE_MAX_LENGTH })
            ];
    return [
        ...head,
        'La otra parte recibe un email.',
        ...facts,
        ...declarant,
        ...rejection,
        confirming ? '¿Confirmás el uso?' : '¿Confirmás el rechazo?'
    ].join('\n');
}
