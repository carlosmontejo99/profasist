import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildInstitutionalWorkbook } from '../services/institutionalExport.ts';
import { DEFAULT_INSTITUTION_PROFILE } from '../services/institution.ts';
import { Group, ParcialEvaluation } from '../types.ts';

const category = (
  id: string,
  name: string,
  weight: number,
  activities: string[],
) => ({
  id,
  name,
  weight,
  activities: activities.map((activity, index) => ({
    id: `${id}_a${index}`,
    name: activity,
  })),
});

const makeParcial = (prefix: string, values: number[]): ParcialEvaluation => ({
  categories: [
    category(`${prefix}_t`, 'Tareas', 20, ['Tarea 1', 'Tarea 2']),
    category(`${prefix}_r`, 'Resúmenes', 20, ['Resumen 1']),
    category(`${prefix}_l`, 'Reportes Lab', 20, ['Reporte 1']),
    category(`${prefix}_b`, 'Bitácora', 40, ['Bitácora']),
  ],
  grades: {
    'st-1': {
      [`${prefix}_t_a0`]: values[0],
      [`${prefix}_t_a1`]: values[1],
      [`${prefix}_r_a0`]: values[2],
      [`${prefix}_l_a0`]: values[3],
      [`${prefix}_b_a0`]: values[4],
    },
  },
});

const makeGroup = (overrides: Partial<Group> = {}): Group => ({
  id: 'group-1',
  name: '👨‍🏫 Enzimología A-L3 · Profesor',
  semester: '2026-A',
  scheduleSummary: '',
  color: '#4f46e5',
  archived: false,
  reporting: { semesterLabel: '2026-B' },
  students: [
    { id: 'st-1', name: 'ARANZA HERNÁNDEZ DE LA ROSA', rollNumber: '224233' },
    { id: 'st-2', name: 'ALUMNO PENDIENTE', rollNumber: '999999' },
  ],
  sessions: [],
  evaluations: {
    parcial1: makeParcial('p1', [9.9, 9.9, 10, 10, 9.9]),
    parcial2: makeParcial('p2', [10, 10, 10, 10, 10]),
    parcial3: makeParcial('p3', [8.5, 8.5, 8.5, 8.5, 8.5]),
  },
  ...overrides,
});

const settings = { institution: DEFAULT_INSTITUTION_PROFILE };

describe('Institutional XLSX export — structure and formulas', () => {
  it('creates the four official sheets in the required order', async () => {
    const workbook = await buildInstitutionalWorkbook(makeGroup(), settings);
    assert.deepStrictEqual(
      workbook.worksheets.map((sheet) => sheet.name),
      ['Resumen Semestral', 'Parcial 1', 'Parcial 2', 'Parcial 3'],
    );
    assert.strictEqual(workbook.calcProperties.fullCalcOnLoad, true);
  });

  it('writes the official two-line header and cleans the legacy name', async () => {
    const workbook = await buildInstitutionalWorkbook(makeGroup(), settings);
    const summary = workbook.getWorksheet('Resumen Semestral')!;
    assert.strictEqual(
      summary.getCell('A1').value,
      'UNIVERSIDAD AUTÓNOMA DE CIUDAD JUÁREZ · DCQB',
    );
    assert.strictEqual(
      summary.getCell('A2').value,
      'Laboratorio de Enzimología A-L3 · Semestre 2026-B · Prof. Carlos Montejo Dávila',
    );
  });

  it('writes native formulas with re-normalized category weights', async () => {
    const workbook = await buildInstitutionalWorkbook(makeGroup(), settings);
    const summary = workbook.getWorksheet('Resumen Semestral')!;
    const parcial1 = workbook.getWorksheet('Parcial 1')!;

    const finalFormula = String((summary.getCell('G5').value as any).formula);
    assert.ok(finalFormula.includes('AVERAGE(D5:F5)'));

    const totalFormula = String((parcial1.getCell('M6').value as any).formula);
    assert.ok(totalFormula.includes('IF(ISNUMBER(F6),F6*20,0)'));
    assert.ok(totalFormula.includes('IF(ISNUMBER(F6),20,0)'));
    assert.ok(totalFormula.includes('IF(ISNUMBER(L6),L6*40,0)'));

    const categoryFormula = String((parcial1.getCell('F6').value as any).formula);
    assert.ok(categoryFormula.includes('COUNT(D6:E6)'));
    assert.ok(categoryFormula.includes('AVERAGE(D6:E6)'));
  });

  it('caches the AL3 official values: 9.9 / 10 / 8.5 -> 9.5', async () => {
    const workbook = await buildInstitutionalWorkbook(makeGroup(), settings);
    const summary = workbook.getWorksheet('Resumen Semestral')!;
    assert.strictEqual((summary.getCell('D5').value as any).result, 9.9);
    assert.strictEqual((summary.getCell('E5').value as any).result, 10);
    assert.strictEqual((summary.getCell('F5').value as any).result, 8.5);
    assert.strictEqual((summary.getCell('G5').value as any).result, 9.5);
    assert.strictEqual((summary.getCell('H5').value as any).result, 'Acreditado');
  });

  it('marks a missing parcial as Pendiente and paints the official semaphore', async () => {
    const group = makeGroup({
      evaluations: {
        parcial1: makeParcial('p1', [9.9, 9.9, 10, 10, 9.9]),
        parcial2: { categories: [], grades: {} },
        parcial3: makeParcial('p3', [8.5, 8.5, 8.5, 8.5, 8.5]),
      },
    });
    const workbook = await buildInstitutionalWorkbook(group, settings);
    const summary = workbook.getWorksheet('Resumen Semestral')!;

    assert.strictEqual((summary.getCell('G5').value as any).result, 'Pendiente');
    assert.strictEqual((summary.getCell('H5').value as any).result, 'Pendiente');
    assert.strictEqual(summary.getCell('H5').fill, undefined);
    assert.strictEqual((summary.getCell('H6').value as any).result, 'Pendiente');
  });

  it('applies the green and red institutional fills', async () => {
    const approved = await buildInstitutionalWorkbook(makeGroup(), settings);
    const approvedSummary = approved.getWorksheet('Resumen Semestral')!;
    assert.strictEqual((approvedSummary.getCell('H5').fill as any).fgColor.argb, 'FFDCFCE7');

    const failing = makeGroup({
      students: [{ id: 'st-1', name: 'ALUMNO NO ACREDITADO', rollNumber: '000002' }],
      evaluations: {
        parcial1: makeParcial('p1', [3, 3, 4, 4, 4]),
        parcial2: makeParcial('p2', [4, 4, 4, 4, 4]),
        parcial3: makeParcial('p3', [4, 4, 4, 4, 4]),
      },
    });
    const failingWorkbook = await buildInstitutionalWorkbook(failing, settings);
    const failingSummary = failingWorkbook.getWorksheet('Resumen Semestral')!;
    assert.strictEqual((failingSummary.getCell('H5').value as any).result, 'No Acreditado');
    assert.strictEqual((failingSummary.getCell('H5').fill as any).fgColor.argb, 'FFFEE2E2');
  });

  it('freezes the header and hides the audit columns', async () => {
    const workbook = await buildInstitutionalWorkbook(makeGroup(), settings);
    const summary = workbook.getWorksheet('Resumen Semestral')!;
    const parcial = workbook.getWorksheet('Parcial 1')!;

    assert.deepStrictEqual(summary.views?.[0], {
      state: 'frozen',
      xSplit: 2,
      ySplit: 4,
      topLeftCell: 'C5',
      activeCell: 'C5',
    });
    assert.deepStrictEqual(parcial.views?.[0], {
      state: 'frozen',
      xSplit: 2,
      ySplit: 5,
      topLeftCell: 'C6',
      activeCell: 'C6',
    });
    assert.strictEqual(summary.getColumn(9).hidden, true);
    assert.strictEqual(summary.getColumn(10).hidden, true);
    assert.strictEqual(summary.getColumn(11).hidden, true);
  });

  it('keeps an audited override in hidden columns and honors it in the final formula', async () => {
    const group = makeGroup({
      students: [{ id: 'st-1', name: 'EVELYN ARIADNA GONZALEZ URIBE', rollNumber: '237348' }],
      evaluations: {
        parcial1: makeParcial('p1', [7.8, 7.8, 7.8, 7.8, 7.8]),
        parcial2: makeParcial('p2', [7, 7, 7, 7, 7]),
        parcial3: makeParcial('p3', [6, 6, 6, 6, 6]),
      },
      finalOverrides: {
        'st-1': {
          grade: 7.0,
          reason: 'Bitácoras validadas por el docente',
          at: '2026-11-13T00:00:00.000Z',
          actor: 'docente',
        },
      },
    });
    const workbook = await buildInstitutionalWorkbook(group, settings);
    const summary = workbook.getWorksheet('Resumen Semestral')!;

    assert.strictEqual((summary.getCell('G5').value as any).result, 7.0);
    assert.strictEqual((summary.getCell('H5').value as any).result, 'Acreditado');
    assert.strictEqual(summary.getCell('J5').value, 7.0);
    assert.strictEqual(summary.getCell('K5').value, 'Bitácoras validadas por el docente');
    assert.ok(String((summary.getCell('G5').value as any).formula).includes('J5<>""'));
  });

  it('applies the attendance gate as Sin derecho with a 5.0 final', async () => {
    const sessions = Array.from({ length: 10 }, (_, index) => ({
      id: `s${index}`,
      date: `2026-08-${String(index + 1).padStart(2, '0')}`,
      startTime: '10:00',
      endTime: '12:00',
      attendance: {
        'st-1': {
          studentId: 'st-1',
          status: index < 2 ? ('present' as const) : ('absent' as const),
          timestamp: 0,
        },
      },
      totalPresent: index < 2 ? 1 : 0,
      totalStudents: 1,
    }));

    const group = makeGroup({
      students: [{ id: 'st-1', name: 'ALUMNO CON FALTAS', rollNumber: '000001' }],
      sessions,
      closureConfig: {
        universityName: 'UACJ',
        formulaType: 'simple',
        weights: { p1: 30, p2: 30, p3: 40 },
        minAttendancePass: true,
        attendanceMinRate: 80,
        roundingRule: 'round',
        failIfAnyParcialFailed: false,
      },
    });

    const workbook = await buildInstitutionalWorkbook(group, settings);
    const summary = workbook.getWorksheet('Resumen Semestral')!;
    assert.strictEqual((summary.getCell('G5').value as any).result, 5.0);
    assert.strictEqual((summary.getCell('H5').value as any).result, 'Sin derecho');
    assert.ok(String((summary.getCell('G5').value as any).formula).includes('I5<80'));
    assert.ok(String((summary.getCell('H5').value as any).formula).includes('Sin derecho'));
  });
});
