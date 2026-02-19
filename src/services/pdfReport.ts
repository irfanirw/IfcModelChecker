/**
 * PDF Report Generator using pdf-lib
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { ValidationResult, ValidationIssue } from '@/types';

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const LINE_HEIGHT = 14;
const FONT_SIZE = 9;
const HEADER_FONT_SIZE = 16;
const SUBHEADER_FONT_SIZE = 12;

export async function generatePdfReport(result: ValidationResult): Promise<Blob> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // ===== Summary Page =====
    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;

    // Title
    page.drawText('IFC Model Validation Report', {
        x: MARGIN,
        y,
        size: HEADER_FONT_SIZE,
        font: boldFont,
        color: rgb(0.098, 0.463, 0.824), // #1976D2
    });
    y -= 30;

    // Separator line
    page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_WIDTH - MARGIN, y },
        thickness: 1,
        color: rgb(0.098, 0.463, 0.824),
    });
    y -= 20;

    // Summary fields
    const summaryFields = [
        ['Model Name:', result.modelName],
        ['Timestamp:', result.timestamp],
        ['IFC Schema:', result.schema],
        ['Rule Pack:', `${result.rulePackName} v${result.rulePackVersion}`],
        ['Total Elements:', String(result.totalElements)],
        ['Total Issues:', String(result.totalIssues)],
        ['Errors:', String(result.errors)],
        ['Warnings:', String(result.warnings)],
        ['Passed:', String(result.passed)],
    ];

    for (const [label, value] of summaryFields) {
        page.drawText(label, {
            x: MARGIN,
            y,
            size: FONT_SIZE + 1,
            font: boldFont,
        });
        page.drawText(value, {
            x: MARGIN + 120,
            y,
            size: FONT_SIZE + 1,
            font,
        });
        y -= LINE_HEIGHT + 4;
    }

    y -= 20;

    // Summary chart area (text-based)
    page.drawText('Issue Summary', {
        x: MARGIN,
        y,
        size: SUBHEADER_FONT_SIZE,
        font: boldFont,
    });
    y -= 20;

    const passRate = result.totalElements > 0
        ? ((result.passed / result.totalElements) * 100).toFixed(1)
        : '0';

    page.drawText(`Pass Rate: ${passRate}% (${result.passed}/${result.totalElements} elements)`, {
        x: MARGIN,
        y,
        size: FONT_SIZE + 1,
        font,
    });
    y -= LINE_HEIGHT + 8;

    // Error bar
    if (result.errors > 0) {
        const errorWidth = Math.min((result.errors / result.totalIssues) * 300, 300);
        page.drawRectangle({
            x: MARGIN,
            y: y - 2,
            width: errorWidth,
            height: 12,
            color: rgb(1, 0.267, 0.267),
        });
        page.drawText(`${result.errors} Errors`, {
            x: MARGIN + errorWidth + 5,
            y,
            size: FONT_SIZE,
            font,
        });
        y -= 20;
    }

    // Warning bar
    if (result.warnings > 0) {
        const warnWidth = Math.min((result.warnings / result.totalIssues) * 300, 300);
        page.drawRectangle({
            x: MARGIN,
            y: y - 2,
            width: warnWidth,
            height: 12,
            color: rgb(1, 0.733, 0.2),
        });
        page.drawText(`${result.warnings} Warnings`, {
            x: MARGIN + warnWidth + 5,
            y,
            size: FONT_SIZE,
            font,
        });
        y -= 30;
    }

    // ===== Issues Pages =====
    page.drawText('Issue Details', {
        x: MARGIN,
        y,
        size: SUBHEADER_FONT_SIZE,
        font: boldFont,
    });
    y -= 20;

    // Table header
    const columns = [
        { label: '#', width: 25 },
        { label: 'Severity', width: 50 },
        { label: 'Element', width: 80 },
        { label: 'Class', width: 65 },
        { label: 'Level', width: 55 },
        { label: 'Rule', width: 80 },
        { label: 'Property', width: 85 },
        { label: 'Actual', width: 55 },
    ];

    function drawTableHeader(currentPage: any, currentY: number): number {
        let x = MARGIN;
        for (const col of columns) {
            currentPage.drawText(col.label, {
                x,
                y: currentY,
                size: FONT_SIZE,
                font: boldFont,
                color: rgb(1, 1, 1),
            });
            x += col.width;
        }
        currentPage.drawRectangle({
            x: MARGIN - 2,
            y: currentY - 3,
            width: PAGE_WIDTH - 2 * MARGIN + 4,
            height: LINE_HEIGHT + 2,
            color: rgb(0.098, 0.463, 0.824),
            opacity: 0.9,
        });
        // Redraw text over rectangle
        x = MARGIN;
        for (const col of columns) {
            currentPage.drawText(col.label, {
                x,
                y: currentY,
                size: FONT_SIZE,
                font: boldFont,
                color: rgb(1, 1, 1),
            });
            x += col.width;
        }
        return currentY - LINE_HEIGHT - 6;
    }

    y = drawTableHeader(page, y);

    for (let i = 0; i < result.issues.length; i++) {
        if (y < MARGIN + LINE_HEIGHT) {
            page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
            y = PAGE_HEIGHT - MARGIN;
            y = drawTableHeader(page, y);
        }

        const issue = result.issues[i];

        // Alternate row bg
        if (i % 2 === 0) {
            page.drawRectangle({
                x: MARGIN - 2,
                y: y - 3,
                width: PAGE_WIDTH - 2 * MARGIN + 4,
                height: LINE_HEIGHT,
                color: rgb(0.95, 0.95, 0.95),
            });
        }

        const rowData = [
            String(i + 1),
            issue.severity,
            truncate(issue.elementId, 14),
            truncate(issue.ifcClass, 11),
            truncate(issue.level, 9),
            truncate(issue.ruleName, 14),
            truncate(issue.propertyPath, 15),
            truncate(issue.actual, 9),
        ];

        let x = MARGIN;
        for (let c = 0; c < columns.length; c++) {
            const color = c === 1
                ? (issue.severity === 'Error' ? rgb(0.8, 0, 0) : rgb(0.8, 0.5, 0))
                : rgb(0, 0, 0);

            page.drawText(rowData[c], {
                x,
                y,
                size: FONT_SIZE,
                font: c === 1 ? boldFont : font,
                color,
            });
            x += columns[c].width;
        }

        y -= LINE_HEIGHT;
    }

    // Footer on last page
    y -= 20;
    if (y > MARGIN) {
        page.drawText(`Generated: ${new Date().toISOString()} — IFC Model Checker`, {
            x: MARGIN,
            y: MARGIN / 2,
            size: 7,
            font,
            color: rgb(0.5, 0.5, 0.5),
        });
    }

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
}

function truncate(str: string, maxLen: number): string {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen - 1) + '…' : str;
}

export async function downloadPdfReport(result: ValidationResult, filename?: string): Promise<void> {
    const blob = await generatePdfReport(result);
    const name = filename || `${result.modelName.replace('.ifc', '')}_validation_${new Date().toISOString().slice(0, 10)}.pdf`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
}
