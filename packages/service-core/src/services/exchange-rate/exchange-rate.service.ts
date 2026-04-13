import { ExchangeRateModel } from '@repo/db';
import type {
    ExchangeRate,
    ExchangeRateCreateInput,
    ExchangeRateTypeEnum,
    PriceCurrencyEnum
} from '@repo/schemas';
import {
    ExchangeRateCreateInputSchema,
    ExchangeRateSearchInputSchema,
    ExchangeRateSourceEnum,
    ExchangeRateUpdateInputSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type { Actor, ServiceConfig, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import { calculateInverseRate } from './exchange-rate.helpers.js';
import { normalizeCreateInput, normalizeUpdateInput } from './exchange-rate.normalizers.js';
import {
    checkCanCountExchangeRate,
    checkCanCreateExchangeRate,
    checkCanDeleteExchangeRate,
    checkCanListExchangeRate,
    checkCanSearchExchangeRate,
    checkCanUpdateExchangeRate,
    checkCanViewExchangeRate
} from './exchange-rate.permissions.js';

/**
 * Service for managing exchange rates.
 * Implements business logic, permissions, and hooks for ExchangeRate entities.
 * @extends BaseCrudService
 */
export class ExchangeRateService extends BaseCrudService<
    ExchangeRate,
    ExchangeRateModel,
    typeof ExchangeRateCreateInputSchema,
    typeof ExchangeRateUpdateInputSchema,
    typeof ExchangeRateSearchInputSchema
> {
    static readonly ENTITY_NAME = 'exchange-rate';
    protected readonly entityName = ExchangeRateService.ENTITY_NAME;

    /**
     * The database model for ExchangeRate.
     */
    protected readonly model: ExchangeRateModel;

    /**
     * Zod schema for exchange rate creation.
     */
    protected readonly createSchema = ExchangeRateCreateInputSchema;

    /**
     * Zod schema for exchange rate updates.
     */
    protected readonly updateSchema = ExchangeRateUpdateInputSchema;

    /**
     * Zod schema for exchange rate search/filtering.
     */
    protected readonly searchSchema = ExchangeRateSearchInputSchema;

    protected getDefaultListRelations() {
        return undefined;
    }

    protected normalizers = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput
    };

    /**
     * Initializes a new instance of the ExchangeRateService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional ExchangeRateModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceConfig, model?: ExchangeRateModel) {
        super(ctx, ExchangeRateService.ENTITY_NAME);
        this.model = model ?? new ExchangeRateModel();
    }

    // ============================================================================
    // Permission Hooks (All 10 Required)
    // ============================================================================

    protected _canCreate(actor: Actor, _data: ExchangeRateCreateInput): void {
        checkCanCreateExchangeRate(actor);
    }

    protected _canUpdate(actor: Actor, _entity: ExchangeRate): void {
        checkCanUpdateExchangeRate(actor);
    }

    protected _canSoftDelete(actor: Actor, _entity: ExchangeRate): void {
        checkCanDeleteExchangeRate(actor);
    }

    protected _canHardDelete(actor: Actor, _entity: ExchangeRate): void {
        checkCanDeleteExchangeRate(actor);
    }

    protected _canRestore(actor: Actor, _entity: ExchangeRate): void {
        checkCanUpdateExchangeRate(actor);
    }

    protected _canView(actor: Actor, _entity: ExchangeRate): void {
        checkCanViewExchangeRate(actor);
    }

    protected _canList(actor: Actor): void {
        checkCanListExchangeRate(actor);
    }

    protected _canSearch(actor: Actor): void {
        checkCanSearchExchangeRate(actor);
    }

    protected _canCount(actor: Actor): void {
        checkCanCountExchangeRate(actor);
    }

    protected _canUpdateVisibility(
        actor: Actor,
        _entity: ExchangeRate,
        _newVisibility: unknown
    ): void {
        checkCanUpdateExchangeRate(actor);
    }

    // ============================================================================
    // Abstract Methods Implementation
    // ============================================================================

    /**
     * Executes the database search for exchange rates.
     * @param params The validated and processed search parameters (filters, pagination, sorting).
     * @param _actor The actor performing the search.
     * @returns A paginated list of exchange rates matching the criteria.
     */
    protected async _executeSearch(
        params: z.infer<typeof ExchangeRateSearchInputSchema> & {
            page?: number;
            pageSize?: number;
        },
        _actor: Actor
    ) {
        const { page = 1, pageSize = 10, ...searchParams } = params;

        const results = await this.model.findAllWithDateRange(searchParams, {
            page,
            pageSize
        });

        return {
            items: results.items,
            total: results.total
        };
    }

    /**
     * Executes the database count for exchange rates.
     * @param params The validated and processed search parameters (filters, pagination, sorting).
     * @param _actor The actor performing the count.
     * @returns An object containing the total count of exchange rates matching the criteria.
     */
    protected async _executeCount(
        params: z.infer<typeof ExchangeRateSearchInputSchema>,
        _actor: Actor
    ) {
        const { ...filterParams } = params;
        const count = await this.model.count(filterParams);
        return { count };
    }

    // ============================================================================
    // Custom Methods
    // ============================================================================

    /**
     * Gets the latest exchange rate for a specific currency pair and rate type.
     * Delegates to model's findLatestRate which orders by fetchedAt DESC.
     * @param actor - The actor performing the action.
     * @param params - Currency pair and rate type parameters.
     * @returns ServiceOutput with the latest ExchangeRate or null.
     */
    public async getLatestRate(
        actor: Actor,
        params: {
            fromCurrency: PriceCurrencyEnum;
            toCurrency: PriceCurrencyEnum;
            rateType?: ExchangeRateTypeEnum;
        }
    ): Promise<ServiceOutput<ExchangeRate | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getLatestRate',
            input: { actor, ...params },
            schema: ExchangeRateSearchInputSchema.partial(),
            execute: async () => {
                checkCanViewExchangeRate(actor);

                return this.model.findLatestRate({
                    fromCurrency: params.fromCurrency,
                    toCurrency: params.toCurrency,
                    rateType: params.rateType
                });
            }
        });
    }

    /**
     * Gets all latest exchange rates (one per currency pair/rate type combination).
     * Delegates to model's findLatestRates which deduplicates by combination.
     * @param actor - The actor performing the action.
     * @returns ServiceOutput with an array of latest ExchangeRates.
     */
    public async getLatestRates(actor: Actor): Promise<ServiceOutput<ExchangeRate[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getLatestRates',
            input: { actor },
            schema: ExchangeRateSearchInputSchema.partial(),
            execute: async () => {
                checkCanListExchangeRate(actor);

                return this.model.findLatestRates();
            }
        });
    }

    /**
     * Creates a manual override exchange rate.
     * Sets source to MANUAL, isManualOverride to true, and calculates inverseRate.
     * @param actor - The actor performing the action.
     * @param data - Exchange rate creation data.
     * @returns ServiceOutput with the created ExchangeRate.
     */
    public async createManualOverride(
        actor: Actor,
        data: ExchangeRateCreateInput
    ): Promise<ServiceOutput<ExchangeRate>> {
        return this.runWithLoggingAndValidation({
            methodName: 'createManualOverride',
            input: { actor, ...data },
            schema: ExchangeRateCreateInputSchema,
            execute: async (validated) => {
                checkCanCreateExchangeRate(actor);

                // Normalize the input first
                const normalized = await normalizeCreateInput(validated, actor);

                // Override specific fields for manual overrides
                const manualData: ExchangeRateCreateInput = {
                    ...normalized,
                    source: ExchangeRateSourceEnum.MANUAL,
                    isManualOverride: true,
                    fetchedAt: new Date(),
                    inverseRate: calculateInverseRate({ rate: normalized.rate })
                };

                // Create via base service
                const result = await this.create(actor, manualData);

                if (!result.data) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to create manual override'
                    );
                }

                return result.data;
            }
        });
    }

    /**
     * Removes a manual override exchange rate.
     * Verifies that the rate is indeed a manual override before deleting.
     * @param actor - The actor performing the action.
     * @param params - ID of the exchange rate to remove.
     * @returns ServiceOutput with void on success.
     */
    public async removeManualOverride(
        actor: Actor,
        params: { id: string }
    ): Promise<ServiceOutput<void>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeManualOverride',
            input: { actor, ...params },
            schema: z.object({ id: z.string().uuid() }),
            execute: async (validated) => {
                checkCanDeleteExchangeRate(actor);

                // Fetch the rate to verify it's a manual override
                const rate = await this.model.findById(validated.id);

                if (!rate) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Exchange rate not found');
                }

                if (!rate.isManualOverride) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'Can only remove manual override rates'
                    );
                }

                // Hard delete the manual override
                await this.hardDelete(actor, validated.id);
            }
        });
    }
}
