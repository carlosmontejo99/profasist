import type { Workbook, Worksheet } from 'exceljs';
import {
  AppSettings,
  EvaluationCategory,
  Group,
  GradingPolicy,
  ParcialEvaluation,
} from '../types';
import {
  calculateCategoryScore,
  calculateFinalScore,
  calculateParcialScore,
  resolveGradingPolicy,
  roundGrade,
} from './grading';
import {
  buildActaFileName,
  ReportMetadata,
  resolveReportMetadata,
} from './institution';
import * as Utils from './utils';

/**
 * Institutional XLSX export (4 sheets):
 *   Resumen Semestral, Parcial 1, Parcial 2, Parcial 3
 *
 * Design rules:
 * - Formulas are native Excel formulas, not static copies.
 * - `fullCalcOnLoad` forces Excel/LibreOffice to recalculate on open.
 * - Missing grades are blank cells, never zeros.
 * - Category weights are re-normalized exactly like services/grading.ts.
 * - Green/red status fills match the official actas (#DCFCE7 / #FEE2E2).
 */

const FONT = 'Arial';
const TITLE_COLOR = 'FF1E3A8A';
const CATEGORY_COLOR = 'FF0D9488';
const BORDER_COLOR = 'FFCBD5E1';
const HEADER_FILL = 'FF1E3A8A';
const CATEGORY_FILL = 'FF0D9488';
const AVERAGE_FILL = 'FFF1F5F9';
const TOTAL_FILL = 'FFE0E7FF';
const APPROVED_FILL = 'FFDCFCE7';
const FAILED_FILL = 'FFFEE2E2';
const NO_RIGHT_FILL = 'FFFEF3C7';
const PENDING_FONT = 'FF64748B';

const EXCEL_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const solidFill = (argb: string) => ({
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb },
});

const thinBorder = {
  top: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
  left: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
  bottom: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
  right: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
};

const baseFont = {
  name: FONT,
  size: 9,
  color: { argb: 'FF1E293B' },
};

const centered = {
  horizontal: 'center' as const,
  vertical: 'middle' as const,
  wrapText: true,
};

const leftAligned = {
  horizontal: 'left' as const,
  vertical: 'middle' as const,
  wrapText: false,
};

const columnLetter = (column: number): string => {
  let result = '';
  let current = column;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
};

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

interface CategoryLayout {
  category: EvaluationCategory;
  activityColumns: number[];
  averageColumn: number;
}

interface ParcialLayout {
  sheetName: string;
  totalColumnLetter: string;
  dataStartRow: number;
  lastColumn: number;
}

const loadExcelJS = async (): Promise<any> => {
  const module: any = await import('exceljs');
  return module.default || module;
};

const styleCell = (
  cell: any,
  options: {
    font?: any;
    fill?: any;
    alignment?: any;
    border?: any;
    numFmt?: string;
  },
) => {
  if (!cell || typeof cell !== 'object') return;
  // ExcelJS returns MergedCell instances for slave cells. Only the master
  // (top-left) cell owns the style; assigning to a slave is a no-op or a throw.
  if (cell.master && cell.master.address && cell.address && cell.master.address !== cell.address) {
    return;
  }
  if (options.font) cell.font = options.font;
  if (options.fill) cell.fill = options.fill;
  if (options.alignment) cell.alignment = options.alignment;
  if (options.border) cell.border = options.border;
  if (options.numFmt) cell.numFmt = options.numFmt;
};

const styleDataRange = (
  ws: Worksheet,
  firstRow: number,
  lastRow: number,
  firstColumn: number,
  lastColumn: number,
  options: {
    font?: any;
    fill?: any;
    alignment?: any;
    numFmt?: string;
  } = {},
) => {
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      styleCell(ws.getCell(row, column), {
        font: options.font || baseFont,
        fill: options.fill,
        alignment: options.alignment || centered,
        border: thinBorder,
        numFmt: options.numFmt,
      });
    }
  }
};

const buildParcialSheet = async (
  workbook: Workbook,
  group: Group,
  metadata: ReportMetadata,
  parcialKey: 'parcial1' | 'parcial2' | 'parcial3',
  index: 1 | 2 | 3,
  policy: GradingPolicy,
): Promise<ParcialLayout> => {
  const parcial: ParcialEvaluation =
    group.evaluations?.[parcialKey] || { categories: [], grades: {} };
  const activeCategories = parcial.categories.filter(
    (category) => category.activities.length > 0,
  );

  const ws = workbook.addWorksheet(`Parcial ${index}`);
  const layouts: CategoryLayout[] = [];
  let column = 4;

  activeCategories.forEach((category) => {
    const activityColumns = category.activities.map(() => {
      const current = column;
      column += 1;
      return current;
    });
    const averageColumn = column;
    column += 1;
    layouts.push({ category, activityColumns, averageColumn });
  });

  const totalColumn = column;
  const lastColumn = column;
  const dataStartRow = 6;
  const dataEndRow = dataStartRow + Math.max(group.students.length, 0) - 1;

  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 13;
  ws.getColumn(3).width = 36;
  layouts.forEach((layout) => {
    layout.activityColumns.forEach((activityColumn) => {
      ws.getColumn(activityColumn).width = 16;
    });
    ws.getColumn(layout.averageColumn).width = 14;
  });
  ws.getColumn(totalColumn).width = 16;

  // Titles
  ws.getCell(1, 1).value = metadata.headerLine1;
  ws.mergeCells(1, 1, 1, lastColumn);
  styleCell(ws.getCell(1, 1), {
    font: { name: FONT, size: 13, bold: true, color: { argb: TITLE_COLOR } },
    alignment: centered,
  });
  ws.getRow(1).height = 24;

  ws.getCell(2, 1).value = `Detalle Evaluativo · Parcial ${index} · ${metadata.laboratoryName} · ${metadata.semesterLabel}`;
  ws.mergeCells(2, 1, 2, lastColumn);
  styleCell(ws.getCell(2, 1), {
    font: { name: FONT, size: 9, color: { argb: 'FF475569' } },
    alignment: centered,
  });
  ws.getRow(2).height = 18;

  // Header rows
  ws.getCell(4, 1).value = 'No.';
  ws.getCell(4, 2).value = 'Matrícula';
  ws.getCell(4, 3).value = 'Nombre del Alumno';
  ws.getCell(5, 1).value = '';
  ws.getCell(5, 2).value = '';
  ws.getCell(5, 3).value = '';

  layouts.forEach((layout) => {
    const firstActivityColumn = layout.activityColumns[0] || layout.averageColumn;
    ws.getCell(4, firstActivityColumn).value =
      `${layout.category.name} (${layout.category.weight}%)`;
    ws.mergeCells(4, firstActivityColumn, 4, layout.averageColumn);
    layout.category.activities.forEach((activity, activityIndex) => {
      ws.getCell(5, layout.activityColumns[activityIndex]).value = activity.name;
    });
    ws.getCell(5, layout.averageColumn).value = `Prom ${layout.category.name}`;
  });

  ws.getCell(4, totalColumn).value = `Calificación Parcial ${index}`;
  ws.mergeCells(4, totalColumn, 5, totalColumn);

  // Header styles
  for (let currentColumn = 1; currentColumn <= lastColumn; currentColumn += 1) {
    styleCell(ws.getCell(4, currentColumn), {
      font: { name: FONT, size: 9, bold: true, color: { argb: 'FFFFFFFF' } },
      fill: solidFill(HEADER_FILL),
      alignment: centered,
      border: thinBorder,
    });
    styleCell(ws.getCell(5, currentColumn), {
      font: { name: FONT, size: 9, bold: true, color: { argb: 'FFFFFFFF' } },
      fill: solidFill(CATEGORY_FILL),
      alignment: centered,
      border: thinBorder,
    });
  }
  ws.getRow(4).height = 24;
  ws.getRow(5).height = 36;

  // Student data
  group.students.forEach((student, studentIndex) => {
    const row = dataStartRow + studentIndex;
    ws.getCell(row, 1).value = studentIndex + 1;
    ws.getCell(row, 2).value = student.rollNumber || 'S/M';
    ws.getCell(row, 3).value = student.name;

    const parcialScore = calculateParcialScore(student.id, parcial, policy);

    layouts.forEach((layout) => {
      const categoryScore = calculateCategoryScore(
        student.id,
        layout.category,
        parcial.grades,
      );

      layout.activityColumns.forEach((activityColumn, activityIndex) => {
        const activity = layout.category.activities[activityIndex];
        const value = parcial.grades[student.id]?.[activity.id];
        if (typeof value === 'number' && Number.isFinite(value)) {
          ws.getCell(row, activityColumn).value = value;
        }
      });

      const firstActivityColumn = layout.activityColumns[0];
      const lastActivityColumn =
        layout.activityColumns[layout.activityColumns.length - 1];
      const range = `${columnLetter(firstActivityColumn)}${row}:${columnLetter(lastActivityColumn)}${row}`;
      ws.getCell(row, layout.averageColumn).value = {
        formula: `IF(COUNT(${range})=0,"",ROUND(AVERAGE(${range}),1))`,
        result:
          categoryScore.value === null
            ? ''
            : roundGrade(categoryScore.value, 'round'),
      };
      ws.getCell(row, layout.averageColumn).numFmt = '0.0';
    });

    if (layouts.length > 0) {
      const averageRefs = layouts.map(
        (layout) => `${columnLetter(layout.averageColumn)}${row}`,
      );
      const numerator = layouts
        .map((layout) => {
          const reference = `${columnLetter(layout.averageColumn)}${row}`;
          return `IF(ISNUMBER(${reference}),${reference}*${layout.category.weight},0)`;
        })
        .join('+');
      const denominator =
        policy.missingPolicy === 'zero'
          ? String(layouts.reduce((total, layout) => total + layout.category.weight, 0))
          : layouts
              .map((layout) => {
                const reference = `${columnLetter(layout.averageColumn)}${row}`;
                return `IF(ISNUMBER(${reference}),${layout.category.weight},0)`;
              })
              .join('+');

      ws.getCell(row, totalColumn).value = {
        formula: `IF(COUNT(${averageRefs.join(',')})=0,"",ROUND((${numerator})/(${denominator}),1))`,
        result:
          parcialScore.value === null
            ? ''
            : roundGrade(parcialScore.value, 'round'),
      };
      ws.getCell(row, totalColumn).numFmt = '0.0';
    }
  });

  if (group.students.length > 0) {
    styleDataRange(ws, dataStartRow, dataEndRow, 1, lastColumn, {
      font: baseFont,
      alignment: centered,
      numFmt: '0.0',
    });

    for (let row = dataStartRow; row <= dataEndRow; row += 1) {
      styleCell(ws.getCell(row, 3), {
        font: baseFont,
        alignment: leftAligned,
        border: thinBorder,
        numFmt: '@',
      });
      styleCell(ws.getCell(row, 1), {
        font: baseFont,
        alignment: centered,
        border: thinBorder,
        numFmt: '0',
      });
      styleCell(ws.getCell(row, 2), {
        font: { ...baseFont, bold: true },
        alignment: centered,
        border: thinBorder,
        numFmt: '@',
      });
      layouts.forEach((layout) => {
        styleCell(ws.getCell(row, layout.averageColumn), {
          font: { ...baseFont, bold: true },
          fill: solidFill(AVERAGE_FILL),
          alignment: centered,
          border: thinBorder,
          numFmt: '0.0',
        });
      });
      styleCell(ws.getCell(row, totalColumn), {
        font: { ...baseFont, bold: true, color: { argb: 'FF4338CA' } },
        fill: solidFill(TOTAL_FILL),
        alignment: centered,
        border: thinBorder,
        numFmt: '0.0',
      });
    }
  }

  ws.views = [
    {
      state: 'frozen',
      xSplit: 2,
      ySplit: 5,
      topLeftCell: 'C6',
      activeCell: 'C6',
    },
  ];
  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
    printTitlesRow: '4:5',
    printArea: `A1:${columnLetter(lastColumn)}${Math.max(dataEndRow, 5)}`,
  };
  ws.headerFooter.oddFooter =
    '&LProfAsist&C&Página &P de &N&RActa institucional de 4 pestañas';

  return {
    sheetName: ws.name,
    totalColumnLetter: columnLetter(totalColumn),
    dataStartRow,
    lastColumn,
  };
};

const buildSummarySheet = async (
  ws: Worksheet,
  group: Group,
  metadata: ReportMetadata,
  layouts: { p1: ParcialLayout; p2: ParcialLayout; p3: ParcialLayout },
  policy: GradingPolicy,
): Promise<void> => {
  const dataStartRow = 5;
  const dataEndRow = dataStartRow + Math.max(group.students.length, 0) - 1;
  const lastColumn = 11; // A-H visible; I-K hidden audit columns

  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 13;
  ws.getColumn(3).width = 36;
  ws.getColumn(4).width = 12;
  ws.getColumn(5).width = 12;
  ws.getColumn(6).width = 12;
  ws.getColumn(7).width = 18;
  ws.getColumn(8).width = 16;
  ws.getColumn(9).width = 12;
  ws.getColumn(10).width = 14;
  ws.getColumn(11).width = 40;

  // Hidden audit columns, keeping the official 8-column visual layout.
  ws.getColumn(9).hidden = true;
  ws.getColumn(10).hidden = true;
  ws.getColumn(11).hidden = true;

  ws.getCell(1, 1).value = metadata.headerLine1;
  ws.mergeCells(1, 1, 1, lastColumn);
  styleCell(ws.getCell(1, 1), {
    font: { name: FONT, size: 13, bold: true, color: { argb: TITLE_COLOR } },
    alignment: centered,
  });
  ws.getRow(1).height = 24;

  ws.getCell(2, 1).value = metadata.headerLine2;
  ws.mergeCells(2, 1, 2, lastColumn);
  styleCell(ws.getCell(2, 1), {
    font: { name: FONT, size: 9, color: { argb: 'FF475569' } },
    alignment: centered,
  });
  ws.getRow(2).height = 18;

  const headers = [
    'No.',
    'Matrícula',
    'Nombre del Alumno',
    'Parcial 1',
    'Parcial 2',
    'Parcial 3',
    'Calificación Final',
    'Estatus',
    'Asistencia %',
    'Resolución docente',
    'Motivo de la resolución',
  ];
  headers.forEach((header, index) => {
    ws.getCell(4, index + 1).value = header;
    styleCell(ws.getCell(4, index + 1), {
      font: { name: FONT, size: 9, bold: true, color: { argb: 'FFFFFFFF' } },
      fill: solidFill(HEADER_FILL),
      alignment: centered,
      border: thinBorder,
    });
  });
  ws.getRow(4).height = 24;

  const weightSum =
    policy.weights.p1 + policy.weights.p2 + policy.weights.p3;
  const weightedFinal =
    policy.formula === 'weighted' && weightSum > 0
      ? `ROUND((D${'{row}'}*${policy.weights.p1}+E${'{row}'}*${policy.weights.p2}+F${'{row}'}*${policy.weights.p3})/${weightSum},1)`
      : `ROUND(AVERAGE(D${'{row}'}:F${'{row}'}),1)`;

  group.students.forEach((student, studentIndex) => {
    const row = dataStartRow + studentIndex;
    const result = calculateFinalScore(group, student.id, policy);
    const override = group.finalOverrides?.[student.id];

    ws.getCell(row, 1).value = studentIndex + 1;
    ws.getCell(row, 2).value = student.rollNumber || 'S/M';
    ws.getCell(row, 3).value = student.name;

    const reference = (layout: ParcialLayout) =>
      `'${layout.sheetName}'!${layout.totalColumnLetter}${layout.dataStartRow + studentIndex}`;

    ws.getCell(row, 4).value = {
      formula: `IF(${reference(layouts.p1)}="","",${reference(layouts.p1)})`,
      result: result.p1 === null ? '' : result.p1,
    };
    ws.getCell(row, 5).value = {
      formula: `IF(${reference(layouts.p2)}="","",${reference(layouts.p2)})`,
      result: result.p2 === null ? '' : result.p2,
    };
    ws.getCell(row, 6).value = {
      formula: `IF(${reference(layouts.p3)}="","",${reference(layouts.p3)})`,
      result: result.p3 === null ? '' : result.p3,
    };

    const attendanceGuard = policy.attendanceGate.enabled
      ? `I${row}<${policy.attendanceGate.minRate}`
      : 'FALSE';
    const failGuard = group.closureConfig?.failIfAnyParcialFailed
      ? `OR(D${row}<${policy.minPass},E${row}<${policy.minPass},F${row}<${policy.minPass})`
      : 'FALSE';

    const coreFinal = weightedFinal.replace(/\{row\}/g, String(row));
    let gatedFinal = `IF(J${row}<>"",J${row},${coreFinal})`;
    if (group.closureConfig?.failIfAnyParcialFailed) {
      gatedFinal = `IF(${failGuard},5,${gatedFinal})`;
    }
    if (policy.attendanceGate.enabled) {
      gatedFinal = `IF(${attendanceGuard},5,${gatedFinal})`;
    }

    ws.getCell(row, 7).value = {
      formula: `IF(OR(D${row}="",E${row}="",F${row}=""),"Pendiente",${gatedFinal})`,
      result: result.final === null ? 'Pendiente' : result.final,
    };

    ws.getCell(row, 8).value = {
      formula: `IF(G${row}="Pendiente","Pendiente",IF(${attendanceGuard},"Sin derecho",IF(${failGuard},"No Acreditado",IF(G${row}>=${policy.minPass},"Acreditado","No Acreditado"))))`,
      result: result.status,
    };

    ws.getCell(row, 9).value = result.attendancePercentage;
    ws.getCell(row, 9).numFmt = '0"%"';
    ws.getCell(row, 10).value = override ? override.grade : '';
    ws.getCell(row, 10).numFmt = '0.0';
    ws.getCell(row, 11).value = override ? override.reason : '';

    for (let column = 1; column <= lastColumn; column += 1) {
      styleCell(ws.getCell(row, column), {
        font: baseFont,
        alignment: column === 3 ? leftAligned : centered,
        border: thinBorder,
        numFmt:
          column >= 4 && column <= 7
            ? '0.0'
            : column === 9
              ? '0"%"'
              : column === 10
                ? '0.0'
                : undefined,
      });
    }

    styleCell(ws.getCell(row, 2), {
      font: { ...baseFont, bold: true },
      alignment: centered,
      border: thinBorder,
    });
    styleCell(ws.getCell(row, 7), {
      font: { ...baseFont, bold: true, color: { argb: 'FF4338CA' } },
      fill: solidFill(TOTAL_FILL),
      alignment: centered,
      border: thinBorder,
      numFmt: '0.0',
    });

    const statusFill =
      result.status === 'Acreditado'
        ? APPROVED_FILL
        : result.status === 'No Acreditado'
          ? FAILED_FILL
          : result.status === 'Sin derecho'
            ? NO_RIGHT_FILL
            : undefined;

    styleCell(ws.getCell(row, 8), {
      font: {
        ...baseFont,
        bold: true,
        color: {
          argb:
            result.status === 'Pendiente'
              ? PENDING_FONT
              : result.status === 'Acreditado'
                ? 'FF14532D'
                : result.status === 'No Acreditado'
                  ? 'FF7F1D1D'
                  : 'FF78350F',
        },
      },
      fill: statusFill ? solidFill(statusFill) : undefined,
      alignment: centered,
      border: thinBorder,
    });
  });

  if (group.students.length > 0) {
    ws.getRow(dataStartRow).height = 20;
  }

  ws.views = [
    {
      state: 'frozen',
      xSplit: 2,
      ySplit: 4,
      topLeftCell: 'C5',
      activeCell: 'C5',
    },
  ];
  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
    printTitlesRow: '4:4',
    printArea: `A1:H${Math.max(dataEndRow, 4)}`,
  };
  ws.headerFooter.oddFooter =
    '&LProfAsist&C&Página &P de &N&RActa oficial · Resumen Semestral';
};

export const buildInstitutionalWorkbook = async (
  group: Group,
  settings: AppSettings = {},
  options: { policy?: GradingPolicy } = {},
): Promise<Workbook> => {
  const ExcelJS = await loadExcelJS();
  const workbook: Workbook = new ExcelJS.Workbook();
  workbook.calcProperties.fullCalcOnLoad = true;
  workbook.creator = 'ProfAsist';
  workbook.lastModifiedBy = 'ProfAsist';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.title = `Acta Oficial · ${group.name}`;
  workbook.subject = 'Evaluación semestral · 4 pestañas';
  workbook.company =
    settings.institution?.institute ||
    'ProfAsist · Gestión docente local';

  const metadata = resolveReportMetadata(group, settings);
  const policy = options.policy || resolveGradingPolicy(group);

  const summary = workbook.addWorksheet('Resumen Semestral');
  const p1 = await buildParcialSheet(workbook, group, metadata, 'parcial1', 1, policy);
  const p2 = await buildParcialSheet(workbook, group, metadata, 'parcial2', 2, policy);
  const p3 = await buildParcialSheet(workbook, group, metadata, 'parcial3', 3, policy);

  await buildSummarySheet(summary, group, metadata, { p1, p2, p3 }, policy);

  return workbook;
};

export interface InstitutionalFile {
  fileName: string;
  blob: Blob;
}

export const writeInstitutionalWorkbook = async (
  group: Group,
  settings: AppSettings = {},
): Promise<InstitutionalFile> => {
  const workbook = await buildInstitutionalWorkbook(group, settings);
  const buffer = await workbook.xlsx.writeBuffer();
  return {
    fileName: buildActaFileName(group, settings),
    blob: new Blob([buffer as ArrayBuffer], { type: EXCEL_MIME }),
  };
};

export const exportInstitutionalWorkbook = async (
  group: Group,
  settings: AppSettings = {},
): Promise<void> => {
  const { fileName, blob } = await writeInstitutionalWorkbook(group, settings);
  await Utils.triggerDownload(fileName, blob);
};

export const exportSemesterWorkbooks = async (
  groups: Group[],
  settings: AppSettings = {},
): Promise<{ exported: string[]; failed: { group: string; error: string }[] }> => {
  const exported: string[] = [];
  const failed: { group: string; error: string }[] = [];

  for (const group of groups) {
    try {
      const { fileName, blob } = await writeInstitutionalWorkbook(group, settings);
      await Utils.triggerDownload(fileName, blob);
      exported.push(fileName);
      // Android's native save bridge is asynchronous (FileReader -> Java).
      // Give it time before the next file so downloads are not lost.
      await delay(900);
    } catch (error: any) {
      failed.push({
        group: group.name,
        error: error?.message || 'Error desconocido al generar el acta',
      });
    }
  }

  return { exported, failed };
};
