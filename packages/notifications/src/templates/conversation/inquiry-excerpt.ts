/**
 * Safe previews of guest-typed inquiry data for the verification email (HOS-2568).
 *
 * The verification email goes to an address that has NOT been verified yet, and the guest
 * only has to type that address. Rendering their free text verbatim would let anyone make
 * Hospeda send arbitrary text, links included, to any inbox. So the email shows structured
 * fields plus a short plain-text excerpt in which links, email addresses and phone-like
 * numbers are replaced by neutral markers. The full text stays server-side until the owner
 * of the address clicks the link.
 *
 * @module templates/conversation/inquiry-excerpt
 */

/** Maximum visible length of the excerpt, ellipsis included. */
export const INQUIRY_EXCERPT_MAX_LENGTH = 120;

/** Marker that replaces a link (Spanish copy, like the rest of the template). */
export const INQUIRY_LINK_MARKER = '[enlace]';
/** Marker that replaces an email address. */
export const INQUIRY_EMAIL_MARKER = '[email]';
/** Marker that replaces a phone-like number. */
export const INQUIRY_PHONE_MARKER = '[teléfono]';

const EMAIL_PATTERN = /[^\s@<>()[\]]+@[^\s@<>()[\]]+\.[^\s@<>()[\]]+/g;
const SCHEME_URL_PATTERN = /\b(?:[a-z][a-z0-9+.-]*:\/\/|www\.)\S+/gi;
const BARE_DOMAIN_PATTERN = /\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b(?:[/?#]\S*)?/gi;
/** Seven or more digits, optionally separated by spaces, dots, dashes or parentheses. */
const PHONE_PATTERN = /\+?\d(?:[\s().-]?\d){6,}/g;

/**
 * Builds the plain-text excerpt of an inquiry message for the verification email.
 *
 * Order matters: emails first (they contain dots that would read as domains), then links,
 * then phone-like sequences. Whitespace is collapsed, and the result is cut to at most
 * {@link INQUIRY_EXCERPT_MAX_LENGTH} characters ending in an ellipsis when shortened. A
 * marker is never cut in half.
 *
 * @param input - `{ message }` the raw guest text.
 * @returns `{ excerpt }` neutralized, single-line text; empty when the message is blank.
 *
 * @example
 * ```ts
 * buildInquiryExcerpt({ message: 'Escribime a ana@x.com o entrá a http://evil.test' });
 * // { excerpt: 'Escribime a [email] o entrá a [enlace]' }
 * ```
 */
export function buildInquiryExcerpt({ message }: { readonly message: string }): {
    readonly excerpt: string;
} {
    const neutralized = message
        .replace(EMAIL_PATTERN, INQUIRY_EMAIL_MARKER)
        .replace(SCHEME_URL_PATTERN, INQUIRY_LINK_MARKER)
        .replace(BARE_DOMAIN_PATTERN, INQUIRY_LINK_MARKER)
        .replace(PHONE_PATTERN, INQUIRY_PHONE_MARKER)
        // biome-ignore lint/suspicious/noControlCharactersInRegex: strips control characters on purpose
        .replace(/[\u0000-\u001f\u007f]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (neutralized.length <= INQUIRY_EXCERPT_MAX_LENGTH) {
        return { excerpt: neutralized };
    }

    let cut = neutralized.slice(0, INQUIRY_EXCERPT_MAX_LENGTH - 1);
    // Do not leave half a marker ("[enla") at the cut.
    const lastOpen = cut.lastIndexOf('[');
    if (lastOpen !== -1 && cut.indexOf(']', lastOpen) === -1) {
        cut = cut.slice(0, lastOpen);
    }
    return { excerpt: `${cut.trimEnd()}…` };
}

/**
 * Masks a phone number so only its last three digits remain.
 *
 * @param input - `{ phone }` the declared phone, as typed.
 * @returns `{ masked }` e.g. `'*** *** 567'`; empty when there are no digits.
 *
 * @example
 * ```ts
 * maskPhone({ phone: '+54 3442 123456' }); // { masked: '*** 456' }
 * ```
 */
export function maskPhone({ phone }: { readonly phone: string }): { readonly masked: string } {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 0) {
        return { masked: '' };
    }
    return { masked: `*** ${digits.slice(-3)}` };
}
