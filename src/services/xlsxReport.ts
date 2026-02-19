/**
 * XLSX Report Generator using ExcelJS
 */
import ExcelJS from 'exceljs';
import type { ValidationResult, ValidationIssue } from '@/types';

export async function generateXlsxReport(result: ValidationResult): Promise<Blob> {
    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();
    workbook.modified = new Date();

    // ===== Summary Sheet =====
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
        { header: 'Field', key: 'field', width: 25 },
        { header: 'Value', key: 'value', width: 50 },
    ];

    const summaryData = [
        { field: 'Model Name', value: result.modelName },
        { field: 'Validation Timestamp', value: result.timestamp },
        { field: 'IFC Schema', value: result.schema },
        { field: 'Rule Pack', value: result.rulePackName },
        { field: 'Rule Pack Version', value: result.rulePackVersion },
        { field: 'Total Elements', value: result.totalElements },
        { field: 'Total Issues', value: result.totalIssues },
        { field: 'Errors', value: result.errors },
        { field: 'Warnings', value: result.warnings },
        { field: 'Passed', value: result.passed },
    ];

    summaryData.forEach((row) => summarySheet.addRow(row));

    // Style summary header
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1976D2' },
    };
    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // ===== Issues Sheet =====
    const issuesSheet = workbook.addWorksheet('Issues');
    issuesSheet.columns = [
        { header: 'Discipline', key: 'discipline', width: 15 },
        { header: 'ElementId', key: 'elementId', width: 25 },
        { header: 'GlobalId', key: 'globalId', width: 25 },
        { header: 'IFC Class', key: 'ifcClass', width: 22 },
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Level', key: 'level', width: 20 },
        { header: 'Zone', key: 'zone', width: 20 },
        { header: 'RuleId', key: 'ruleId', width: 20 },
        { header: 'RuleName', key: 'ruleName', width: 30 },
        { header: 'IssueType', key: 'issueType', width: 18 },
        { header: 'PropertyPath', key: 'propertyPath', width: 30 },
        { header: 'Expected', key: 'expected', width: 30 },
        { header: 'Actual', key: 'actual', width: 25 },
        { header: 'Severity', key: 'severity', width: 12 },
        { header: 'SuggestedFix', key: 'suggestedFix', width: 30 },
    ];

    result.issues.forEach((issue: ValidationIssue) => {
        const row = issuesSheet.addRow({
            discipline: issue.discipline,
            elementId: issue.elementId,
            globalId: issue.globalId,
            ifcClass: issue.ifcClass,
            name: issue.name,
            level: issue.level,
            zone: issue.zone,
            ruleId: issue.ruleId,
            ruleName: issue.ruleName,
            issueType: issue.issueType,
            propertyPath: issue.propertyPath,
            expected: issue.expected,
            actual: issue.actual,
            severity: issue.severity,
            suggestedFix: issue.suggestedFix || '',
        });

        // Color code severity
        const severityCell = row.getCell('severity');
        if (issue.severity === 'Error') {
            severityCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFF4444' },
            };
            severityCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        } else if (issue.severity === 'Warning') {
            severityCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFBB33' },
            };
            severityCell.font = { bold: true };
        }
    });

    // Style issues header
    issuesSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    issuesSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1976D2' },
    };

    // Auto-filter
    issuesSheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: result.issues.length + 1, column: 15 },
    };

    // Freeze header row
    issuesSheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
}

export async function downloadXlsxReport(result: ValidationResult, filename?: string): Promise<void> {
    const blob = await generateXlsxReport(result);
    const name = filename || `${result.modelName.replace('.ifc', '')}_validation_${new Date().toISOString().slice(0, 10)}.xlsx`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
}
