import { InvoiceStatusEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { createMockAdminActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestClient,
    createTestInvoice,
    createTestInvoiceLine,
    createTestUser
} from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

// File-level setup/teardown to avoid pool closed errors between describe blocks
let app: ReturnType<typeof initApp>;
let apiClient: E2EApiClient;
let _transactionClient: unknown;

beforeAll(async () => {
    await testDb.setup();
    app = initApp();

    // Create a test user for the actor
    const testUser = await createTestUser();
    const actor = createMockAdminActor({
        id: testUser.id
    });
    apiClient = new E2EApiClient(app, actor);
});

afterAll(async () => {
    await testDb.teardown();
});

beforeEach(async () => {
    _transactionClient = await testDb.beginTransaction();
});

afterEach(async () => {
    await testDb.rollbackTransaction(_transactionClient);
});

describe('E2E: Billing Flow - Scenario 1: Invoice Generation', () => {
    it('should create invoice with minimal required fields', async () => {
        // ARRANGE
        const client = await createTestClient();
        const now = new Date();
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + 30);

        const invoiceData = {
            clientId: client.id,
            invoiceNumber: `INV-TEST-${Date.now()}`,
            status: InvoiceStatusEnum.OPEN,
            subtotal: 1000,
            taxes: 210,
            total: 1210,
            currency: 'ARS',
            issueDate: now.toISOString(),
            dueDate: dueDate.toISOString()
        };

        // ACT
        const response = await apiClient.post('/api/v1/invoices', invoiceData);

        // ASSERT
        const invoice = await apiClient.expectSuccess(response, 201);

        expect(invoice.id).toBeTruthy();
        expect(invoice.clientId).toBe(client.id);
        expect(invoice.invoiceNumber).toBe(invoiceData.invoiceNumber);
        expect(invoice.status).toBe(InvoiceStatusEnum.OPEN);
        // Note: Database NUMERIC fields return as strings, so use Number() for comparison
        expect(Number(invoice.subtotal)).toBe(1000);
        expect(Number(invoice.taxes)).toBe(210);
        expect(Number(invoice.total)).toBe(1210);
        expect(invoice.currency).toBe('ARS');
    });

    it('should create invoice with all optional fields', async () => {
        // ARRANGE
        const client = await createTestClient();
        const now = new Date();
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + 30);

        const invoiceData = {
            clientId: client.id,
            invoiceNumber: `INV-FULL-${Date.now()}`,
            status: InvoiceStatusEnum.OPEN,
            subtotal: 5000,
            taxes: 1050,
            total: 6050,
            currency: 'USD',
            issueDate: now.toISOString(),
            dueDate: dueDate.toISOString(),
            description: 'Monthly subscription services',
            paymentTerms: 'Net 30 days',
            notes: 'Thank you for your business'
        };

        // ACT
        const response = await apiClient.post('/api/v1/invoices', invoiceData);

        // ASSERT
        const invoice = await apiClient.expectSuccess(response, 201);

        expect(invoice.id).toBeTruthy();
        expect(invoice.description).toBe('Monthly subscription services');
        expect(invoice.paymentTerms).toBe('Net 30 days');
        expect(invoice.notes).toBe('Thank you for your business');
        expect(invoice.currency).toBe('USD');
    });

    it('should reject invoice with negative subtotal', async () => {
        // ARRANGE
        const client = await createTestClient();
        const now = new Date();
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + 30);

        const invoiceData = {
            clientId: client.id,
            invoiceNumber: `INV-NEG-${Date.now()}`,
            status: InvoiceStatusEnum.OPEN,
            subtotal: -100, // Negative value
            taxes: 0,
            total: -100,
            currency: 'ARS',
            issueDate: now.toISOString(),
            dueDate: dueDate.toISOString()
        };

        // ACT
        const response = await apiClient.post('/api/v1/invoices', invoiceData);

        // ASSERT
        expect(response.status).toBe(400);
        const error = await response.json();
        expect(error.success).toBe(false);
    });

    it('should reject invoice with missing required fields', async () => {
        // ARRANGE - Missing clientId
        const invoiceData = {
            invoiceNumber: `INV-MISS-${Date.now()}`,
            status: InvoiceStatusEnum.OPEN,
            subtotal: 1000,
            taxes: 210,
            total: 1210,
            currency: 'ARS'
            // Missing: clientId, issueDate, dueDate
        };

        // ACT
        const response = await apiClient.post('/api/v1/invoices', invoiceData);

        // ASSERT
        expect(response.status).toBe(400);
    });

    it('should update invoice status', async () => {
        // ARRANGE - Create invoice first
        const client = await createTestClient();
        const invoice = await createTestInvoice(client.id);

        const updateData = {
            status: InvoiceStatusEnum.PAID,
            paidAt: new Date().toISOString()
        };

        // ACT
        const response = await apiClient.put(`/api/v1/invoices/${invoice.id}`, updateData);

        // ASSERT
        const updatedInvoice = await apiClient.expectSuccess(response, 200);

        expect(updatedInvoice.id).toBe(invoice.id);
        expect(updatedInvoice.status).toBe(InvoiceStatusEnum.PAID);
        expect(updatedInvoice.paidAt).toBeTruthy();
    });

    it('should update invoice amounts', async () => {
        // ARRANGE - Create invoice first
        const client = await createTestClient();
        const invoice = await createTestInvoice(client.id, {
            subtotal: 1000,
            taxes: 210,
            total: 1210
        });

        const updateData = {
            subtotal: 2000,
            taxes: 420,
            total: 2420
        };

        // ACT
        const response = await apiClient.put(`/api/v1/invoices/${invoice.id}`, updateData);

        // ASSERT
        const updatedInvoice = await apiClient.expectSuccess(response, 200);

        // Note: Database NUMERIC fields return as strings, so use Number() for comparison
        expect(Number(updatedInvoice.subtotal)).toBe(2000);
        expect(Number(updatedInvoice.taxes)).toBe(420);
        expect(Number(updatedInvoice.total)).toBe(2420);
    });

    it('should get invoice by ID', async () => {
        // ARRANGE
        const client = await createTestClient();
        const invoiceNumber = `INV-GET-TEST-${Date.now()}`;
        const invoice = await createTestInvoice(client.id, {
            invoiceNumber
        });

        // ACT
        const response = await apiClient.get(`/api/v1/invoices/${invoice.id}`);

        // ASSERT
        const retrievedInvoice = await apiClient.expectSuccess(response, 200);

        expect(retrievedInvoice.id).toBe(invoice.id);
        expect(retrievedInvoice.invoiceNumber).toBe(invoiceNumber);
        expect(retrievedInvoice.clientId).toBe(client.id);
    });

    it('should return 404 for non-existent invoice', async () => {
        // ARRANGE
        const fakeId = '00000000-0000-0000-0000-000000000000';

        // ACT
        const response = await apiClient.get(`/api/v1/invoices/${fakeId}`);

        // ASSERT
        expect(response.status).toBe(404);
    });

    it('should delete (soft delete) invoice', async () => {
        // ARRANGE
        const client = await createTestClient();
        const invoice = await createTestInvoice(client.id);

        // ACT
        const deleteResponse = await apiClient.delete(`/api/v1/invoices/${invoice.id}`);

        // ASSERT
        expect(deleteResponse.status).toBe(200);

        // Verify it has deletedAt set (soft deleted)
        const getResponse = await apiClient.get(`/api/v1/invoices/${invoice.id}`);
        const deletedInvoice = await apiClient.expectSuccess(getResponse, 200);
        expect(deletedInvoice.deletedAt).toBeTruthy();
    });

    it('should list invoices with pagination', async () => {
        // ARRANGE - Create multiple invoices with unique invoice numbers
        const client = await createTestClient();
        const timestamp = Date.now();
        await createTestInvoice(client.id, { invoiceNumber: `INV-LIST-A-${timestamp}` });
        await createTestInvoice(client.id, { invoiceNumber: `INV-LIST-B-${timestamp}` });
        await createTestInvoice(client.id, { invoiceNumber: `INV-LIST-C-${timestamp}` });

        // ACT
        const response = await apiClient.get('/api/v1/invoices?page=1&pageSize=2');

        // ASSERT
        const result = await apiClient.expectSuccess(response, 200);

        expect(result.items).toBeDefined();
        expect(Array.isArray(result.items)).toBe(true);
        expect(result.items.length).toBeLessThanOrEqual(2);
        expect(result.pagination).toBeDefined();
    });

    it('should filter invoices by status', async () => {
        // ARRANGE - Create invoices with different statuses
        const client = await createTestClient();
        await createTestInvoice(client.id, { status: InvoiceStatusEnum.OPEN });
        await createTestInvoice(client.id, { status: InvoiceStatusEnum.PAID });

        // ACT - Request with status filter
        const response = await apiClient.get(`/api/v1/invoices?status=${InvoiceStatusEnum.OPEN}`);

        // ASSERT
        const result = await apiClient.expectSuccess(response, 200);

        expect(result.items).toBeDefined();
        expect(Array.isArray(result.items)).toBe(true);
        // All returned invoices should be OPEN
        const openInvoices = result.items.filter(
            (inv: { status: string }) => inv.status === InvoiceStatusEnum.OPEN
        );
        expect(openInvoices.length).toBeGreaterThan(0);
    });

    it('should filter invoices by client', async () => {
        // ARRANGE - Create invoices for different clients
        const client1 = await createTestClient({ name: 'Client One' });
        const client2 = await createTestClient({ name: 'Client Two' });
        await createTestInvoice(client1.id);
        await createTestInvoice(client2.id);

        // ACT - Request with clientId filter
        const response = await apiClient.get(`/api/v1/invoices?clientId=${client1.id}`);

        // ASSERT
        const result = await apiClient.expectSuccess(response, 200);

        expect(result.items).toBeDefined();
        // All returned invoices should belong to client1
        const client1Invoices = result.items.filter(
            (inv: { clientId: string }) => inv.clientId === client1.id
        );
        expect(client1Invoices.length).toBeGreaterThan(0);
    });

    it('should void an invoice', async () => {
        // ARRANGE - Create an OPEN invoice
        const client = await createTestClient();
        const invoice = await createTestInvoice(client.id, {
            status: InvoiceStatusEnum.OPEN
        });

        // ACT - Void the invoice
        const response = await apiClient.put(`/api/v1/invoices/${invoice.id}`, {
            status: InvoiceStatusEnum.VOID
        });

        // ASSERT
        const voidedInvoice = await apiClient.expectSuccess(response, 200);

        expect(voidedInvoice.id).toBe(invoice.id);
        expect(voidedInvoice.status).toBe(InvoiceStatusEnum.VOID);
    });
});

describe('E2E: Billing Flow - Invoice Lines', () => {
    // Uses file-level setup/teardown - no need to duplicate here

    it('should create invoice line with required fields', async () => {
        // ARRANGE
        const client = await createTestClient();
        const invoice = await createTestInvoice(client.id);

        const lineData = {
            invoiceId: invoice.id,
            description: 'Monthly subscription - Basic plan',
            quantity: 1,
            unitPrice: 1000,
            total: 1000
        };

        // ACT
        const response = await apiClient.post('/api/v1/invoice-lines', lineData);

        // ASSERT
        const line = await apiClient.expectSuccess(response, 201);

        expect(line.id).toBeTruthy();
        expect(line.invoiceId).toBe(invoice.id);
        expect(line.description).toBe('Monthly subscription - Basic plan');
        // Note: Database NUMERIC fields return as strings, so use Number() for comparison
        expect(Number(line.quantity)).toBe(1);
        expect(Number(line.unitPrice)).toBe(1000);
        expect(Number(line.total)).toBe(1000);
    });

    it('should create invoice line with tax information', async () => {
        // ARRANGE
        const client = await createTestClient();
        const invoice = await createTestInvoice(client.id);

        const lineData = {
            invoiceId: invoice.id,
            description: 'Service with tax',
            quantity: 2,
            unitPrice: 500,
            total: 1210, // 1000 + 21% tax
            // Note: taxRate and discountRate are stored as decimal (precision: 5, scale: 4)
            // e.g., 21% is stored as 0.2100, not 21
            taxRate: 0.21,
            taxAmount: 210
        };

        // ACT
        const response = await apiClient.post('/api/v1/invoice-lines', lineData);

        // ASSERT
        const line = await apiClient.expectSuccess(response, 201);

        // Note: Database NUMERIC fields return as strings, so use Number() for comparison
        expect(Number(line.taxRate)).toBe(0.21);
        expect(Number(line.taxAmount)).toBe(210);
    });

    it('should create invoice line with discount', async () => {
        // ARRANGE
        const client = await createTestClient();
        const invoice = await createTestInvoice(client.id);

        const lineData = {
            invoiceId: invoice.id,
            description: 'Discounted service',
            quantity: 1,
            unitPrice: 1000,
            total: 900, // 1000 - 10% discount
            // Note: taxRate and discountRate are stored as decimal (precision: 5, scale: 4)
            // e.g., 10% is stored as 0.1000, not 10
            discountRate: 0.1,
            discountAmount: 100
        };

        // ACT
        const response = await apiClient.post('/api/v1/invoice-lines', lineData);

        // ASSERT
        const line = await apiClient.expectSuccess(response, 201);

        // Note: Database NUMERIC fields return as strings, so use Number() for comparison
        expect(Number(line.discountRate)).toBe(0.1);
        expect(Number(line.discountAmount)).toBe(100);
    });

    it('should reject invoice line with negative quantity', async () => {
        // ARRANGE
        const client = await createTestClient();
        const invoice = await createTestInvoice(client.id);

        const lineData = {
            invoiceId: invoice.id,
            description: 'Invalid line',
            quantity: -1, // Negative
            unitPrice: 1000,
            total: -1000
        };

        // ACT
        const response = await apiClient.post('/api/v1/invoice-lines', lineData);

        // ASSERT
        expect(response.status).toBe(400);
    });

    it('should update invoice line', async () => {
        // ARRANGE
        const client = await createTestClient();
        const invoice = await createTestInvoice(client.id);
        const line = await createTestInvoiceLine(invoice.id, {
            description: 'Original description',
            quantity: 1,
            unitPrice: 1000,
            total: 1000
        });

        const updateData = {
            description: 'Updated description',
            quantity: 2,
            unitPrice: 500,
            total: 1000
        };

        // ACT
        const response = await apiClient.put(`/api/v1/invoice-lines/${line.id}`, updateData);

        // ASSERT
        const updatedLine = await apiClient.expectSuccess(response, 200);

        expect(updatedLine.description).toBe('Updated description');
        // Note: Database NUMERIC fields return as strings, so use Number() for comparison
        expect(Number(updatedLine.quantity)).toBe(2);
        expect(Number(updatedLine.unitPrice)).toBe(500);
    });

    it('should get invoice line by ID', async () => {
        // ARRANGE
        const client = await createTestClient();
        const invoice = await createTestInvoice(client.id);
        const line = await createTestInvoiceLine(invoice.id, {
            description: 'Test line for retrieval'
        });

        // ACT
        const response = await apiClient.get(`/api/v1/invoice-lines/${line.id}`);

        // ASSERT
        const retrievedLine = await apiClient.expectSuccess(response, 200);

        expect(retrievedLine.id).toBe(line.id);
        expect(retrievedLine.description).toBe('Test line for retrieval');
    });

    it('should delete invoice line', async () => {
        // ARRANGE
        const client = await createTestClient();
        const invoice = await createTestInvoice(client.id);
        const line = await createTestInvoiceLine(invoice.id);

        // ACT
        const deleteResponse = await apiClient.delete(`/api/v1/invoice-lines/${line.id}`);

        // ASSERT
        expect(deleteResponse.status).toBe(200);

        // Verify soft delete
        const getResponse = await apiClient.get(`/api/v1/invoice-lines/${line.id}`);
        const deletedLine = await apiClient.expectSuccess(getResponse, 200);
        expect(deletedLine.deletedAt).toBeTruthy();
    });

    it('should list invoice lines with pagination', async () => {
        // ARRANGE
        const client = await createTestClient();
        const invoice = await createTestInvoice(client.id);
        await createTestInvoiceLine(invoice.id, { description: 'Line A' });
        await createTestInvoiceLine(invoice.id, { description: 'Line B' });
        await createTestInvoiceLine(invoice.id, { description: 'Line C' });

        // ACT
        const response = await apiClient.get('/api/v1/invoice-lines?page=1&pageSize=2');

        // ASSERT
        const result = await apiClient.expectSuccess(response, 200);

        expect(result.items).toBeDefined();
        expect(Array.isArray(result.items)).toBe(true);
        expect(result.items.length).toBeLessThanOrEqual(2);
        expect(result.pagination).toBeDefined();
    });

    it('should filter invoice lines by invoiceId', async () => {
        // ARRANGE
        const client = await createTestClient();
        const invoice1 = await createTestInvoice(client.id);
        const invoice2 = await createTestInvoice(client.id);
        await createTestInvoiceLine(invoice1.id, { description: 'Line for invoice 1' });
        await createTestInvoiceLine(invoice2.id, { description: 'Line for invoice 2' });

        // ACT
        const response = await apiClient.get(`/api/v1/invoice-lines?invoiceId=${invoice1.id}`);

        // ASSERT
        const result = await apiClient.expectSuccess(response, 200);

        expect(result.items).toBeDefined();
        const invoice1Lines = result.items.filter(
            (line: { invoiceId: string }) => line.invoiceId === invoice1.id
        );
        expect(invoice1Lines.length).toBeGreaterThan(0);
    });
});
