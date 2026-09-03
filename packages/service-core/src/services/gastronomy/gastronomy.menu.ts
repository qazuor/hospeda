/**
 * gastronomy.menu.ts
 *
 * The venue's carta — read and whole-document write (HOS-895).
 *
 * ## Two operations, not eight
 *
 * The FAQ and media helpers next door expose one function per row operation
 * (add / update / remove / reorder). The carta deliberately does not, and the
 * reason is the one `gastronomy_media` states for going the OTHER way: a photo
 * is a Cloudinary asset that is BILLED from the moment it lands, so every photo
 * operation has to persist on its own or an abandoned form costs money.
 *
 * Sections and dishes are text. Nothing exists outside the database, so nothing
 * can be orphaned by a save that never happens — and what the carta has instead
 * is that it is edited as a WHOLE. Renaming a course, dragging a dish into it
 * and deleting two others is one thought; as four requests it can half-succeed
 * and leave a published menu in a state the owner never described. So the write
 * is one transaction: delete the listing's sections, insert what was submitted.
 *
 * ## Why delete-and-reinsert rather than a diff
 *
 * Item ids are not stable across a save, and callers are told so by the payload
 * schema, which carries no ids at all. That is a real cost — HOS-1045 will hang
 * photos off an item id, and HOS-1054's per-dish allergens likewise — and it is
 * the reason both are named here rather than discovered later: when either
 * lands, this function grows a diff that preserves the id of an item whose
 * position and name are unchanged. Until something REFERENCES an item, a diff
 * would be machinery with no consequence, and the reinsert is what makes the
 * transaction trivially correct.
 *
 * ## Permissions vs. entitlements
 *
 * This module answers PERMISSION only — `COMMERCE_EDIT_OWN` on your own
 * listing, `COMMERCE_EDIT_ALL` for staff, via the same
 * {@link checkGastronomyCanEditFaqs} gate the sibling helpers use. Whether the
 * caller's PLAN includes a structured carta is an entitlement
 * (`MANAGE_GASTRONOMY_MENU`) and is checked at the route, before this is
 * reached — the same split `brochure.ts` makes.
 *
 * @module gastronomy.menu
 */

import {
    GastronomyMenuItemModel,
    GastronomyMenuSectionModel,
    type GastronomyModel,
    withTransaction
} from '@repo/db';
import {
    type GastronomyMenuGetInput,
    GastronomyMenuGetInputSchema,
    type GastronomyMenuOutput,
    type GastronomyMenuReplaceInput,
    GastronomyMenuReplaceInputSchema,
    ServiceErrorCode
} from '@repo/schemas';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { checkGastronomyCanEditFaqs } from './gastronomy.permissions';

/**
 * Upper bound on the rows one read pulls back.
 *
 * `findAll` paginates, and the carta is read whole — so an unstated page size
 * would silently truncate a long menu rather than fail. Sized to the schema's
 * own ceilings (`30` sections × `100` dishes) with room to spare, so a menu
 * that passed validation on the way in can always be read back out.
 */
const MENU_READ_PAGE_SIZE = 4000;

/**
 * Loads a gastronomy listing by ID or throws NOT_FOUND.
 *
 * @param model - The GastronomyModel instance.
 * @param gastronomyId - UUID of the listing.
 * @param tx - Optional Drizzle transaction client.
 * @returns The gastronomy DB row.
 * @throws {ServiceError} NOT_FOUND when no matching row exists.
 */
async function requireGastronomy(
    model: GastronomyModel,
    gastronomyId: string,
    tx?: ServiceContext['tx']
) {
    const entity = await model.findById(gastronomyId, tx);
    if (!entity) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Gastronomy listing not found');
    }
    return entity;
}

/** Ascending by `displayOrder`, ties broken by name so the order is total. */
const byDisplayOrder = <T extends { displayOrder: number; name: string }>(a: T, b: T): number =>
    a.displayOrder === b.displayOrder
        ? a.name.localeCompare(b.name)
        : a.displayOrder - b.displayOrder;

/**
 * Reads a listing's menu in all three of its shapes.
 *
 * Open to any actor that can see the listing: a menu is public content, and the
 * caller-facing projection is the route's business, not this function's.
 *
 * The three shapes travel together deliberately — a venue with zero sections
 * and an uploaded PDF is NOT a venue without a menu, and a consumer that asked
 * only for sections would conclude that it is.
 *
 * @param model - GastronomyModel instance.
 * @param data - `{ gastronomyId }`.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<GastronomyMenuOutput>`.
 */
export async function getGastronomyMenu(
    model: GastronomyModel,
    data: GastronomyMenuGetInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<GastronomyMenuOutput>> {
    try {
        const parseResult = GastronomyMenuGetInputSchema.safeParse(data);
        if (!parseResult.success) {
            const messages = parseResult.error.issues
                .map((i) => `${i.path.join('.')}: ${i.message}`)
                .join('; ');
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: `Validation failed: ${messages}`
                }
            };
        }
        const { gastronomyId } = parseResult.data;

        const gastronomy = await requireGastronomy(model, gastronomyId, ctx?.tx);

        const sectionModel = new GastronomyMenuSectionModel();
        const itemModel = new GastronomyMenuItemModel();

        const { items: sectionRows } = await sectionModel.findAll(
            { gastronomyId },
            { pageSize: MENU_READ_PAGE_SIZE },
            undefined,
            ctx?.tx
        );

        // One read for EVERY dish of the listing, then grouped in memory —
        // rather than one read per section. This is why `gastronomy_id` is
        // denormalized onto the item table: without it this would be a query
        // per course, which is the classic N+1 on a page that renders the whole
        // menu at once.
        const { items: itemRows } = await itemModel.findAll(
            { gastronomyId },
            { pageSize: MENU_READ_PAGE_SIZE },
            undefined,
            ctx?.tx
        );

        const itemsBySection = new Map<string, typeof itemRows>();
        for (const item of itemRows) {
            const bucket = itemsBySection.get(item.sectionId);
            if (bucket) {
                bucket.push(item);
            } else {
                itemsBySection.set(item.sectionId, [item]);
            }
        }

        const sections = [...sectionRows].sort(byDisplayOrder).map((section) => ({
            ...section,
            items: [...(itemsBySection.get(section.id) ?? [])].sort(byDisplayOrder)
        }));

        // `url` and `kind` are reported as ONE object or as `null`, never as a
        // URL with an unknown kind: a consumer has to choose between an <img>
        // and a document link, and half an attachment gives it nothing to
        // choose with.
        const file =
            gastronomy.menuFileUrl && gastronomy.menuFileKind
                ? { url: gastronomy.menuFileUrl, kind: gastronomy.menuFileKind }
                : null;

        return {
            data: {
                sections,
                file,
                externalUrl: gastronomy.menuUrl ?? null
            }
        };
    } catch (err) {
        if (err instanceof ServiceError) {
            return { error: { code: err.code, message: err.message } };
        }
        return {
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: err instanceof Error ? err.message : 'Failed to read gastronomy menu'
            }
        };
    }
}

/**
 * Replaces a listing's structured carta with the submitted document.
 *
 * Permission: `COMMERCE_EDIT_OWN` (listing owner) or `COMMERCE_EDIT_ALL`
 * (staff). The `MANAGE_GASTRONOMY_MENU` entitlement is the route's gate, not
 * this one's.
 *
 * An EMPTY `sections` array is a legitimate submission and deletes the carta:
 * an owner who has fallen back to a photo needs a way to take the typed version
 * down, and refusing the empty document would leave them with no way to say it.
 *
 * `displayOrder` is assigned from ARRAY POSITION, never read from the payload —
 * so the order a client sees is the order it sent, and two dishes cannot be
 * given the same place.
 *
 * @param model - GastronomyModel instance.
 * @param actor - The actor performing the action.
 * @param data - `{ gastronomyId, menu }`.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<GastronomyMenuOutput>` with the carta as now stored.
 */
export async function replaceGastronomyMenu(
    model: GastronomyModel,
    actor: Actor,
    data: GastronomyMenuReplaceInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<GastronomyMenuOutput>> {
    try {
        const parseResult = GastronomyMenuReplaceInputSchema.safeParse(data);
        if (!parseResult.success) {
            const messages = parseResult.error.issues
                .map((i) => `${i.path.join('.')}: ${i.message}`)
                .join('; ');
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: `Validation failed: ${messages}`
                }
            };
        }
        const validated = parseResult.data;
        const { gastronomyId } = validated;

        const gastronomy = await requireGastronomy(model, gastronomyId, ctx?.tx);
        checkGastronomyCanEditFaqs(actor, gastronomy);

        const sectionModel = new GastronomyMenuSectionModel();
        const itemModel = new GastronomyMenuItemModel();

        // ONE transaction for the whole document. A carta half-written — the
        // old courses gone and the new ones not yet in — is a published menu
        // the owner never described, and it is exactly what per-row endpoints
        // would allow. Enlists in the caller's transaction when there is one.
        const runInTx = async (tx: ServiceContext['tx']): Promise<void> => {
            // CASCADE on `gastronomy_menu_items.section_id` takes the dishes
            // with the sections, so the items are not deleted explicitly. That
            // is a property of the SCHEMA, not of this call order.
            await sectionModel.hardDelete({ gastronomyId }, tx);

            for (const [sectionIndex, section] of validated.menu.sections.entries()) {
                const createdSection = await sectionModel.create(
                    {
                        gastronomyId,
                        name: section.name,
                        // `''` and `undefined` both mean "no blurb"; stored as
                        // NULL so the read has one absent value, not two.
                        description: section.description || null,
                        displayOrder: sectionIndex,
                        createdById: actor.id,
                        updatedById: actor.id
                    },
                    tx
                );

                for (const [itemIndex, item] of section.items.entries()) {
                    await itemModel.create(
                        {
                            sectionId: createdSection.id,
                            gastronomyId,
                            name: item.name,
                            description: item.description || null,
                            // `?? null` and NOT `|| null`: `0` is a real price
                            // (a free item on a tasting menu), and `||` would
                            // turn it into "a consultar".
                            priceCents: item.priceCents ?? null,
                            isAvailable: item.isAvailable,
                            displayOrder: itemIndex,
                            createdById: actor.id,
                            updatedById: actor.id
                        },
                        tx
                    );
                }
            }
        };

        if (ctx?.tx) {
            await runInTx(ctx.tx);
        } else {
            await withTransaction(async (tx) => {
                await runInTx(tx);
            });
        }

        return await getGastronomyMenu(model, { gastronomyId }, ctx);
    } catch (err) {
        if (err instanceof ServiceError) {
            return { error: { code: err.code, message: err.message } };
        }
        return {
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: err instanceof Error ? err.message : 'Failed to replace gastronomy menu'
            }
        };
    }
}
