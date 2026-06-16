/**
 * commerce-owner-provisioning.service.ts
 *
 * Provisions a new COMMERCE_OWNER user account for an approved commerce lead
 * (SPEC-239 T-040).
 *
 * ## Design decisions
 *
 * 1. **Better Auth port injection**: Better Auth's `betterAuth()` instance
 *    lives in `apps/api/src/lib/auth.ts`.  Services in `@repo/service-core`
 *    must remain app-agnostic and cannot import that file.  The
 *    `CreateUserPort` callback interface is injected by the API route layer;
 *    this service has zero compile-time dependency on Better Auth.
 *
 * 2. **`must_change_password = true`**: Provisioned accounts are created with
 *    a server-generated random password and the `mustChangePassword` flag set
 *    so the owner is forced to choose their own password on first login.
 *
 * 3. **Notification port**: Email delivery (credentials email) is optional —
 *    inject a `ProvisioningNotificationPort` to enable it.  Failures are
 *    logged and suppressed; they never abort the provisioning.
 *
 * 4. **No billing calls**: This service creates the user row only.
 *    Subscription creation is handled separately by billing routes after
 *    provisioning returns.
 *
 * @module commerce-owner-provisioning.service
 */

import { randomBytes } from 'node:crypto';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { CommerceLead } from '@repo/schemas';
import { z } from 'zod';
import { BaseService } from '../../base/base.service';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils/permission';

// ---------------------------------------------------------------------------
// Port interfaces (injected by callers)
// ---------------------------------------------------------------------------

/**
 * Result returned by the `CreateUserPort` after successfully creating a user.
 */
export interface CreateUserPortResult {
    /** UUID of the newly created user row. */
    readonly id: string;
    /** Email address of the created user. */
    readonly email: string;
    /** Display name of the created user. */
    readonly name: string;
}

/**
 * Port for creating a new platform user via Better Auth.
 *
 * Implemented in `apps/api` where the `betterAuth()` instance is available.
 * The signature mirrors Better Auth's admin user-creation API so the
 * implementation stays trivial:
 *
 * ```ts
 * // In apps/api/src/lib/commerce-ports.ts:
 * import { auth } from './auth';
 *
 * const createUserPort: CreateUserPort = async ({ email, password, name, role }) => {
 *   const user = await auth.api.createUser({
 *     body: { email, password, name, role, data: { mustChangePassword: true } }
 *   });
 *   return { id: user.user.id, email: user.user.email, name: user.user.name };
 * };
 * ```
 */
export type CreateUserPort = (input: {
    /** Email address for the new account. */
    readonly email: string;
    /** Temporary server-generated password (min 12 chars). */
    readonly password: string;
    /** Display name derived from the lead's `contactName`. */
    readonly name: string;
    /** Role to assign to the new user. */
    readonly role: RoleEnum;
    /** Whether the user must change their password on first login. */
    readonly mustChangePassword: boolean;
}) => Promise<CreateUserPortResult>;

/**
 * Port for notifying the provisioned owner of their credentials.
 *
 * Inject via the service constructor to enable credential delivery.
 * Omitting this port silences credential emails (useful in tests / preview envs).
 */
export interface ProvisioningNotificationPort {
    /**
     * Sends the account credentials email to the provisioned owner.
     *
     * @param input - Recipient details and temporary password.
     */
    notifyOwnerCredentials: (input: {
        readonly email: string;
        readonly name: string;
        readonly temporaryPassword: string;
        readonly leadId: string;
    }) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

/**
 * Input for provisioning a new commerce owner.
 */
export interface ProvisionCommerceOwnerInput {
    /**
     * The approved commerce lead that triggered this provisioning.
     * The lead's `email`, `contactName`, and `id` are used to create
     * the user account and send credentials.
     */
    readonly lead: CommerceLead;
}

/**
 * Result of a successful `provisionCommerceOwner` call.
 */
export interface ProvisionCommerceOwnerResult {
    /** UUID of the newly created user. */
    readonly userId: string;
    /** Email address of the provisioned user. */
    readonly email: string;
    /** Display name of the provisioned user. */
    readonly name: string;
    /**
     * The server-generated temporary password.
     *
     * **SECURITY NOTE**: this field exists only so the caller can optionally
     * log it to a secure audit trail.  It must never be stored in plain text
     * and must not be returned in API responses.
     */
    readonly temporaryPassword: string;
}

// ---------------------------------------------------------------------------
// Validation schema (internal)
// ---------------------------------------------------------------------------

const provisionInputSchema = z.object({
    lead: z.object({
        id: z.string().uuid(),
        email: z.string().email(),
        contactName: z.string().min(1),
        domain: z.string().min(1)
    })
});

// ---------------------------------------------------------------------------
// Password generation
// ---------------------------------------------------------------------------

/**
 * Generates a cryptographically secure temporary password.
 * Uses 18 random bytes → 24-char base64url string (no padding ambiguity).
 */
function generateTemporaryPassword(): string {
    return randomBytes(18).toString('base64url');
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Provisions a new `COMMERCE_OWNER` user account for an approved commerce lead.
 *
 * ## Requires
 * - `COMMERCE_EDIT_ALL` permission on the acting admin.
 * - A `CreateUserPort` implementation injected at construction time.
 *
 * ## Does NOT
 * - Create a subscription (billing routes handle that).
 * - Import or depend on Better Auth directly.
 * - Store the temporary password anywhere.
 *
 * @example
 * ```ts
 * const provisioningService = new CommerceOwnerProvisioningService(
 *   { logger },
 *   createUserPort,    // injected by API layer
 *   notificationPort,  // optional
 * );
 *
 * const result = await provisioningService.provisionCommerceOwner(adminActor, { lead });
 * if (result.data) {
 *   logger.info({ userId: result.data.userId }, 'Commerce owner provisioned');
 * }
 * ```
 */
export class CommerceOwnerProvisioningService extends BaseService {
    private readonly _createUser: CreateUserPort;
    private readonly _notifier: ProvisioningNotificationPort | null;

    constructor(
        config: ServiceConfig,
        createUserPort: CreateUserPort,
        notifier?: ProvisioningNotificationPort | null
    ) {
        super(config, 'commerceOwnerProvisioning');
        this._createUser = createUserPort;
        this._notifier = notifier ?? null;
    }

    // -----------------------------------------------------------------------
    // provisionCommerceOwner
    // -----------------------------------------------------------------------

    /**
     * Creates a new `COMMERCE_OWNER` user account for an approved lead.
     *
     * Steps:
     * 1. Permission check (`COMMERCE_EDIT_ALL`).
     * 2. Generate a temporary 24-char password via `crypto.randomBytes`.
     * 3. Invoke the injected `CreateUserPort` to create the user in Better Auth.
     * 4. Best-effort credential notification via the injected
     *    `ProvisioningNotificationPort` (failures are logged and suppressed).
     * 5. Return the provisioning result.
     *
     * @param actor - The admin performing the provisioning.
     * @param input - `{ lead }` — the approved commerce lead to provision.
     * @param ctx - Optional service execution context.
     * @returns `ServiceOutput<ProvisionCommerceOwnerResult>`.
     *
     * @throws `FORBIDDEN` when the actor lacks `COMMERCE_EDIT_ALL`.
     * @throws `INTERNAL_ERROR` when `CreateUserPort` rejects unexpectedly.
     *
     * @example
     * ```ts
     * const output = await service.provisionCommerceOwner(adminActor, { lead });
     * if (output.data) {
     *   // The userId can now be linked to the newly created gastronomy entity
     *   await gastronomyService.create(adminActor, { ownerId: output.data.userId, ... });
     * }
     * ```
     */
    public async provisionCommerceOwner(
        actor: Actor,
        input: ProvisionCommerceOwnerInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<ProvisionCommerceOwnerResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'provisionCommerceOwner',
            input: { actor, lead: input.lead },
            schema: provisionInputSchema,
            ctx,
            execute: async (validated, a, _execCtx) => {
                // Permission gate
                if (!hasPermission(a, PermissionEnum.COMMERCE_EDIT_ALL)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: COMMERCE_EDIT_ALL required to provision commerce owners'
                    );
                }

                const { lead } = validated;
                const temporaryPassword = generateTemporaryPassword();

                // Create user via the injected Better Auth port
                let created: CreateUserPortResult;
                try {
                    created = await this._createUser({
                        email: lead.email,
                        password: temporaryPassword,
                        name: lead.contactName,
                        role: RoleEnum.COMMERCE_OWNER,
                        mustChangePassword: true
                    });
                } catch (err) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        `Failed to create user account for lead ${lead.id}: ${err instanceof Error ? err.message : String(err)}`,
                        err
                    );
                }

                // Best-effort credential notification — never blocks provisioning
                if (this._notifier) {
                    try {
                        await this._notifier.notifyOwnerCredentials({
                            email: created.email,
                            name: created.name,
                            temporaryPassword,
                            leadId: lead.id
                        });
                    } catch (err) {
                        this.logger.warn(
                            { err, userId: created.id, leadId: lead.id },
                            // TODO(SPEC-239): Wire credential email notification channel
                            '[commerce-owner-provisioning] Credential notification failed (non-blocking)'
                        );
                    }
                } else {
                    this.logger.debug(
                        { userId: created.id, leadId: lead.id },
                        // TODO(SPEC-239): Wire credential email notification channel
                        '[commerce-owner-provisioning] No notifier configured; credential email not sent'
                    );
                }

                return {
                    userId: created.id,
                    email: created.email,
                    name: created.name,
                    temporaryPassword
                };
            }
        });
    }
}
