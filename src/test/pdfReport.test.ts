import { describe, it, expect, vi } from 'vitest';
import type { ValidationResult } from '@/types';

// Mock pdf-lib
vi.mock('pdf-lib', () => {
    const mockPage = {
        getSize: vi.fn(() => ({ width: 595.28, height: 841.89 })),
        drawText: vi.fn(),
        drawRectangle: vi.fn(),
        drawLine: vi.fn(),
    };

    const mockFont = {
        widthOfTextAtSize: vi.fn(() => 50),
        heightAtSize: vi.fn(() => 12),
    };

    const mockDoc = {
        addPage: vi.fn(() => mockPage),
        embedFont: vi.fn(async () => mockFont),
        save: vi.fn(async () => new Uint8Array(100)),
    };

    return {
        PDFDocument: {
            create: vi.fn(async () => mockDoc),
        },
        StandardFonts: {
            Helvetica: 'Helvetica',
            HelveticaBold: 'Helvetica-Bold',
        },
        rgb: vi.fn(() => ({ r: 0, g: 0, b: 0 })),
    };
});

describe('PDF Report', () => {
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

    it('should generate PDF report', async () => {
        const { generatePdfReport } = await import('@/services/pdfReport');
        const blob = await generatePdfReport(mockResult);
        expect(blob).toBeDefined();
        expect(blob instanceof Blob).toBe(true);
    });
});
