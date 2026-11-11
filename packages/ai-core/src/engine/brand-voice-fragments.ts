/**
 * Brand-voice fragments shared by the default prompts and rules (HOS-789).
 *
 * Split out of `default-prompts.ts` by HOS-2100 (file-length limit). The strings
 * are unchanged; `default-rules-equivalence.test.ts` proves the composed prompts
 * did not move.
 *
 * @module ai-core/engine/brand-voice-fragments
 */

// ---------------------------------------------------------------------------
// Brand-voice fragments (HOS-789)
//
// Three product invariants the model kept breaking. Each one exists TWICE, on
// purpose: a `_GUIDANCE` half phrased as positive instruction that goes into
// DEFAULT_PROMPTS (the editable content), and a `_RULE` half phrased as a hard
// prohibition that goes into DEFAULT_RULES (the guardrail block).
//
// The duplication is deliberate belt-and-suspenders, not an oversight. An admin
// editing a prompt from the panel replaces `content` but never `rules`
// (`prompt-resolver.ts` resolves the two independently), so the `_RULE` half
// survives any rewording done from the admin UI. The two halves are worded
// differently rather than copy-pasted so the composed prompt
// (`content + "\n\n" + rules`) reads as instruction-then-boundary instead of
// the same paragraph twice.
//
// They are per-concern rather than one blob so each feature composes only what
// applies to it — `search` and `accommodation_import` emit JSON, not Spanish
// prose, so a voseo instruction there would be noise the model has to ignore.
// ---------------------------------------------------------------------------

/**
 * Register instruction: the product speaks rioplatense Spanish (voseo).
 *
 * Every human-authored string in the platform voseas ("Elegí qué querés editar",
 * "Subí fotos", "Mejorá tu plan"). Before HOS-789 the AI was the only surface
 * that switched to neutral/Iberian tuteo ("Imagina", "Ven", "déjate") — and its
 * output is what gets published on a host's listing.
 */
export const VOSEO_GUIDANCE = `When you write in Spanish, write RIOPLATENSE Spanish using VOSEO — the register the rest of this product uses. \
Write "imaginate", "vení", "dejate", "elegí", "descubrí", "conocé", "reservá", "disfrutá" instead of "imagina", "ven", "déjate", "elige", "descubre", "conoce", "reserva", "disfruta". \
Address the reader as "vos".`;

/**
 * Guardrail half of {@link VOSEO_GUIDANCE}. Survives an admin prompt rewrite.
 *
 * HOS-2102: the scope sentence at the end keeps the voseo examples inside
 * Spanish answers — the residual sweep on gpt-5.4-nano caught the model
 * carrying rule wording like "podés" / "confirmalo" into English and
 * Portuguese answers.
 */
export const VOSEO_RULE = `Spanish output MUST use the rioplatense voseo register: "imaginate" / "vení" / "dejate" / "elegí" / "descubrí", NEVER "imagina" / "ven" / "déjate" / "elige" / "descubre". \
Never address the reader with "tú", "ti", "contigo", or any "vosotros" form. \
These voseo examples apply ONLY when the answer is written in Spanish: never copy any of them into an answer written in English or Portuguese.`;

/**
 * Identity instruction: a proper name is data, not translatable prose.
 *
 * The bug that motivated this (HOS-789) translated the descriptive words INSIDE
 * a listing's commercial name — "Cheroga Casa Quinta" became "Cheroga Country
 * House" in English while Portuguese kept it intact. Same field, same call, two
 * opposite criteria. The name is how a guest searches for the place and what is
 * painted on its sign; translating it makes it a different business.
 */
export const PROPER_NAME_GUIDANCE = `Treat the proper name of an accommodation, destination, business, or person as a fixed identifier: reproduce it exactly as given, in every language. \
This includes the descriptive words inside the name — "Cheroga Casa Quinta" stays "Cheroga Casa Quinta" in English and in Portuguese, it does not become "Cheroga Country House".`;

/**
 * Guardrail half of {@link PROPER_NAME_GUIDANCE}. Survives an admin prompt rewrite.
 */
export const PROPER_NAME_RULE = `You MUST NOT translate, localize, adapt, or otherwise alter a proper noun. \
The commercial name of an accommodation, the name of a destination, a business name, and a person's name are reproduced verbatim in every target language, including any descriptive words they contain (e.g. "Casa Quinta", "El Mirador", "Cabañas del Río").`;

/**
 * Vocabulary instruction: "destino" is a taken word in this product.
 *
 * A destination is a concrete entity with its own page (Colón, Concepción del
 * Uruguay, Federación) and the basic-information form has a required field
 * literally labelled "Destino". Calling an individual accommodation a "destino"
 * collides with that meaning in front of the host who is about to fill the field.
 */
export const DESTINO_GUIDANCE = `On this platform a "destino" is a specific geographic place with its own section — Colón, Concepción del Uruguay, Federación — and the accommodation form has a required field with that exact name. \
Refer to an individual accommodation by what it is ("el alojamiento", "la cabaña", "la casa", "el departamento"), never as "el destino".`;

/**
 * Guardrail half of {@link DESTINO_GUIDANCE}. Survives an admin prompt rewrite.
 */
export const DESTINO_RULE = `You MUST NOT use the word "destino" (or "destination") to refer to an individual accommodation — on this platform that word denotes a geographic destination entity and nothing else.`;

/**
 * Identity instruction: a URL is a destination address, not translatable
 * prose (HOS-1030).
 *
 * The bug this guards against: the model reads the PATH segment of a URL as
 * ordinary text and "translates" it — `misitio.com/reservas` came back as
 * `misitio.com/bookings` in English, a path that does not exist on the
 * host's server, so the link 404s. A visible link's anchor TEXT is prose and
 * should be translated; the address it points to is an opaque identifier and
 * must never change, in any target language.
 *
 * This is DEFENSE IN DEPTH ONLY — the primary defense is the URL-placeholder
 * substitution in `apps/api/src/services/ai-translate.service.ts`
 * (`protectUrls`/`restoreUrls`), which removes every URL from the text
 * before the model ever sees it, so there is nothing left for this
 * instruction to actually need to stop. This rule exists in case that
 * substitution is ever bypassed or extended to a path that doesn't call it.
 */
export const URL_GUIDANCE = `Treat any URL, link, or web address in the text as a fixed identifier: reproduce its host, path, query string, and fragment exactly as given, character for character, in every language. \
Only the visible link TEXT (what a reader sees and clicks) is prose to translate — never the destination address itself, even when a path segment looks like an ordinary word (e.g. "misitio.com/reservas" stays "misitio.com/reservas", it does not become "misitio.com/bookings").`;

/**
 * Guardrail half of {@link URL_GUIDANCE}. Survives an admin prompt rewrite.
 */
export const URL_RULE = `You MUST NOT translate, localize, adapt, or otherwise alter any URL, link, or web address — its scheme, host, path, query string, and fragment MUST be reproduced verbatim in every target language, even when a path segment resembles a translatable word.`;
