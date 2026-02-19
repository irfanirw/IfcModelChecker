import { describe, it, expect, vi } from 'vitest';
import type { ValidationResult } from '@/types';

// Mock ExcelJS to avoid needing actual library in tests
vi.mock('exceljs', () => {
    const mockCell = {
        font: {},
        fill: {},
        alignment: {},
        border: {},
        value: '',
    };

    const mockRow = {
        eachCell: vi.fn(),
        getCell: vi.fn(() => mockCell),
        font: {},
        fill: {},
        alignment: {},
        height: 20,
    };

    const mockSheet = {
        addRow: vi.fn(() => mockRow),
        getRow: vi.fn(() => mockRow),
        getColumn: vi.fn(() => ({ width: 10 })),
        columns: [],
        autoFilter: null,
        views: [],
        mergeCells: vi.fn(),
    };

    const mockWorkbook = {
        addWorksheet: vi.fn(() => mockSheet),
        xlsx: {
            writeBuffer: vi.fn(async () => new ArrayBuffer(100)),
        },
        creator: '',
        created: new Date(),
    };

    return {
        default: {
            Workbook: vi.fn(() => mockWorkbook),
        },
        Workbook: vi.fn(() => mockWorkbook),
    };
});

describe('XLSX Report', () => {
    const mockResult: ValidationResult = {
        modelName: 'TestModel.ifc',
        timestamp: '2024-01-01T00:00:00.000Z',
        schema: 'IFC4',
        rulePackName: 'IFC+SG v1.0',
        rulePackVersion: '1.0',
        totalElements: 100,
        totalIssues: 5,
        errors: 3,
        warnings: 2,
        passed: 95,
        issues: [
            {
                id: '1-rule1-FireRating',
                discipline: 'Architecture',
                elementId: 'W001',
                globalId: 'abc-123',
                expressID: 1,
                ifcClass: 'IfcWall',
                name: 'Wall 001',
                level: 'Level 1',
                zone: '',
                ruleId: 'rule1',
                ruleName: 'Wall FireRating',
                issueType: 'MissingValue',
                propertyPath: 'Pset_WallCommon.FireRating',
                expected: 'Value should not be empty',
                actual: '(empty)',
                severity: 'Warning',
            },
        ],
    };

    it('should generate XLSX report', async () => {
        const { generateXlsxReport } = await import('@/services/xlsxReport');
        const blob = await generateXlsxReport(mockResult);
        expect(blob).toBeDefined();
        expect(blob instanceof Blob).toBe(true);
    });
});
