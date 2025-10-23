import { describe, expect, it } from 'vitest';
import {
    professionalServiceOrderRelations,
    professionalServiceOrders
} from '../../../src/schemas/services/professionalServiceOrder.dbschema';

describe('PROFESSIONAL_SERVICE_ORDER Database Schema - Etapa 2.8', () => {
    describe('schema compilation', () => {
        it('should import professionalServiceOrder schema without errors', () => {
            expect(professionalServiceOrders).toBeDefined();
            expect(typeof professionalServiceOrders).toBe('object');
        });

        it('should import professionalServiceOrder relations without errors', () => {
            expect(professionalServiceOrderRelations).toBeDefined();
            expect(typeof professionalServiceOrderRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(professionalServiceOrders).toBeDefined();
            expect(typeof professionalServiceOrders).toBe('object');
            // Basic validation that it's a proper table definition
            expect(professionalServiceOrders).toHaveProperty('id');
        });

        it('should have expected columns for professional service order', () => {
            expect(professionalServiceOrders).toHaveProperty('id');
            expect(professionalServiceOrders).toHaveProperty('clientId');
            expect(professionalServiceOrders).toHaveProperty('serviceTypeId');
            expect(professionalServiceOrders).toHaveProperty('pricingPlanId');
            expect(professionalServiceOrders).toHaveProperty('status');
            expect(professionalServiceOrders).toHaveProperty('orderedAt');
            expect(professionalServiceOrders).toHaveProperty('deliveryDate');
            expect(professionalServiceOrders).toHaveProperty('completedAt');
            expect(professionalServiceOrders).toHaveProperty('notes');
            expect(professionalServiceOrders).toHaveProperty('clientRequirements');
            expect(professionalServiceOrders).toHaveProperty('deliverables');
            expect(professionalServiceOrders).toHaveProperty('createdAt');
            expect(professionalServiceOrders).toHaveProperty('updatedAt');
            expect(professionalServiceOrders).toHaveProperty('createdById');
            expect(professionalServiceOrders).toHaveProperty('updatedById');
            expect(professionalServiceOrders).toHaveProperty('deletedAt');
            expect(professionalServiceOrders).toHaveProperty('deletedById');
            expect(professionalServiceOrders).toHaveProperty('adminInfo');
        });
    });
});
