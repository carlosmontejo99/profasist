import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateCategoryScore,
  calculateFinalScore,
  calculateParcialScore,
  cleanGroupName,
  DEFAULT_POLICY,
  formatGrade,
  normalizeText,
  resolveGradingPolicy,
  roundGrade,
} from '../services/grading.ts';
import { Group, GroupEvaluations, ParcialEvaluation } from '../types.ts';

const makeParcial = (): ParcialEvaluation => ({
  categories: [
    {
      id: 'cat_tareas',
      name: 'Tareas',
      weight: 20,
      activities: [
        { id: 'act_t1', name: 'Tarea 1' },
        { id: 'act_t2', name: 'Tarea 2' },
      ],
    },
    {
      id: 'cat_resumenes',
      name: 'Resúmenes',
      weight: 20,
      activities: [{ id: 'act_r1', name: 'Resumen 1' }],
    },
    {
      id: 'cat_reportes',
      name: 'Reportes Lab',
      weight: 20,
      activities: [{ id: 'act_l1', name: 'Reporte 1' }],
    },
    {
      id: 'cat_bitacora',
      name: 'Bitácora',
      weight: 40,
      activities: [{ id: 'act_b1', name: 'Bitácora' }],
    },
  ],
  grades: {
    'st-1': {
      act_t1: 8,
      act_t2: 10,
      act_r1: 9,
      act_l1: 10,
      act_b1: 10,
    },
  },
});

const makeEvaluations = (overrides: Partial<GroupEvaluations> = {}): GroupEvaluations => ({
  parcial1: makeParcial(),
  parcial2: makeParcial(),
  parcial3: makeParcial(),
  ...overrides,
});

const makeGroup = (overrides: Partial<Group> = {}): Group => ({
  id: 'group-1',
  name: 'Enzimología A-L3',
  semester: '2026-B',
  scheduleSummary: 'Lun, Mié 10:00',
  students: [
    { id: 'st-1', name: 'Ana García', rollNumber: '2026001' },
    { id: 'st-2', name: 'Luis Pérez', rollNumber: '2026002' },
  ],
  sessions: [],
  color: '#4f46e5',
  archived: false,
  evaluations: makeEvaluations(),
  ...overrides,
});

const emptyParcial = (): ParcialEvaluation => ({
  categories: [
    { id: 'cat_tareas', name: 'Tareas', weight: 20, activities: [] },
    { id: 'cat_resumenes', name: 'Resúmenes', weight: 20, activities: [] },
    { id: 'cat_reportes', name: 'Reportes Lab', weight: 20, activities: [] },
    { id: 'cat_bitacora', name: 'Bitácora', weight: 40, activities: [] },
  ],
  grades: {},
});

describe('Grading engine — determinism and missing-data policy', () => {
  it('rounds 6.95 to 7.0 and 6.94 to 6.9 without binary artefacts', () => {
    assert.strictEqual(roundGrade(6.95), 7.0);
    assert.strictEqual(roundGrade(6.94), 6.9);
    assert.strictEqual(roundGrade(6.949999999), 6.9);
    assert.strictEqual(roundGrade(9.466666, 'round'), 9.5);
    // Explicit half-up policy: 8.95 and 9.95 round away from zero.
    assert.strictEqual(roundGrade(8.95), 9.0);
    assert.strictEqual(roundGrade(9.95), 10.0);
  });

  it('applies floor, ceil and mexican rounding rules', () => {
    assert.strictEqual(roundGrade(7.19, 'floor'), 7.1);
    assert.strictEqual(roundGrade(7.11, 'ceil'), 7.2);
    assert.strictEqual(roundGrade(5.9, 'mexican'), 5);
    assert.strictEqual(roundGrade(6.4, 'mexican'), 6);
    assert.strictEqual(roundGrade(6.5, 'mexican'), 7);
    assert.strictEqual(roundGrade(8.5, 'none'), 8.5);
  });

  it('averages only graded activities inside a category', () => {
    const parcial = makeParcial();
    const result = calculateCategoryScore('st-1', parcial.categories[0], parcial.grades);
    assert.strictEqual(result.value, 9.0);
    assert.strictEqual(result.gradedActivities, 2);
    assert.strictEqual(result.totalActivities, 2);
  });

  it('returns null for a category with no grades instead of zero', () => {
    const parcial = makeParcial();
    const result = calculateCategoryScore('st-2', parcial.categories[0], parcial.grades);
    assert.strictEqual(result.value, null);
    assert.strictEqual(result.gradedActivities, 0);
  });

  it('re-normalizes weights when a category has no grades', () => {
    const parcial: ParcialEvaluation = {
      categories: [
        { id: 'a', name: 'Tareas', weight: 20, activities: [{ id: 'a1', name: 'A1' }] },
        { id: 'b', name: 'Resúmenes', weight: 20, activities: [{ id: 'b1', name: 'B1' }] },
        { id: 'c', name: 'Reportes', weight: 20, activities: [{ id: 'c1', name: 'C1' }] },
        { id: 'd', name: 'Bitácora', weight: 40, activities: [{ id: 'd1', name: 'D1' }] },
      ],
      grades: { 'st-1': { a1: 8, b1: 9 } },
    };

    const renormalized = calculateParcialScore('st-1', parcial, DEFAULT_POLICY);
    assert.strictEqual(renormalized.value, 8.5); // (8*20 + 9*20) / 40
    assert.strictEqual(renormalized.complete, false);
    assert.strictEqual(renormalized.coverage, 0.5);

    const zeroPolicy = { ...DEFAULT_POLICY, missingPolicy: 'zero' as const };
    const conservative = calculateParcialScore('st-1', parcial, zeroPolicy);
    assert.strictEqual(conservative.value, 3.4); // (8*20 + 9*20 + 0 + 0) / 100
  });

  it('returns a null parcial when no category is configured or graded', () => {
    const noActivities = calculateParcialScore('st-1', emptyParcial(), DEFAULT_POLICY);
    assert.strictEqual(noActivities.value, null);
    assert.strictEqual(noActivities.totalWeight, 0);

    const noGrades = makeParcial();
    noGrades.grades = {};
    const result = calculateParcialScore('st-1', noGrades, DEFAULT_POLICY);
    assert.strictEqual(result.value, null);
    assert.strictEqual(result.coverage, 0);
  });

  it('computes the official AL3-style final: 9.9, 10, 8.5 -> 9.5', () => {
    const group = makeGroup({
      evaluations: {
        parcial1: makeParcial(),
        parcial2: makeParcial(),
        parcial3: makeParcial(),
      },
    });
    group.evaluations!.parcial1.grades['st-1'] = { act_t1: 9.9, act_t2: 9.9, act_r1: 10, act_l1: 10, act_b1: 9.9 };
    group.evaluations!.parcial2.grades['st-1'] = { act_t1: 10, act_t2: 10, act_r1: 10, act_l1: 10, act_b1: 10 };
    group.evaluations!.parcial3.grades['st-1'] = { act_t1: 8.5, act_t2: 8.5, act_r1: 8.5, act_l1: 8.5, act_b1: 8.5 };

    const result = calculateFinalScore(group, 'st-1');
    assert.strictEqual(result.p1, 9.9);
    assert.strictEqual(result.p2, 10);
    assert.strictEqual(result.p3, 8.5);
    assert.strictEqual(result.final, 9.5);
    assert.strictEqual(result.status, 'Acreditado');
  });

  it('marks the final as Pendiente when a whole parcial has no grades', () => {
    const group = makeGroup({
      evaluations: makeEvaluations({ parcial2: emptyParcial() }),
    });

    const result = calculateFinalScore(group, 'st-1');
    assert.strictEqual(result.p2, null);
    assert.strictEqual(result.final, null);
    assert.strictEqual(result.status, 'Pendiente');
    assert.ok(result.warnings.some(w => w.includes('Parcial 2')));
  });

  it('honors an audited final override without changing the parcial breakdown', () => {
    const group = makeGroup({
      finalOverrides: {
        'st-1': {
          grade: 7.0,
          reason: 'Bitácoras validadas por el docente',
          at: '2026-11-13T00:00:00.000Z',
          actor: 'docente',
        },
      },
    });
    group.evaluations!.parcial1.grades['st-1'] = { act_t1: 7.8, act_t2: 7.8, act_r1: 7.8, act_l1: 7.8, act_b1: 7.8 };
    group.evaluations!.parcial2.grades['st-1'] = { act_t1: 7, act_t2: 7, act_r1: 7, act_l1: 7, act_b1: 7 };
    group.evaluations!.parcial3.grades['st-1'] = { act_t1: 6, act_t2: 6, act_r1: 6, act_l1: 6, act_b1: 6 };

    const result = calculateFinalScore(group, 'st-1');
    assert.strictEqual(result.p1, 7.8);
    assert.strictEqual(result.p2, 7);
    assert.strictEqual(result.p3, 6);
    assert.strictEqual(Number(result.rawFinal?.toFixed(1)), 6.9);
    assert.strictEqual(result.final, 7.0);
    assert.strictEqual(result.status, 'Acreditado');
    assert.strictEqual(result.overridden, true);
    assert.ok(result.warnings.some(w => w.includes('Bitácoras validadas')));
  });

  it('uses configured partial weights when formula is weighted', () => {
    const group = makeGroup({
      closureConfig: {
        universityName: 'UACJ',
        formulaType: 'weighted',
        weights: { p1: 30, p2: 30, p3: 40 },
        minAttendancePass: false,
        attendanceMinRate: 80,
        roundingRule: 'round',
        failIfAnyParcialFailed: false,
      },
    });
    group.evaluations!.parcial1.grades['st-1'] = { act_t1: 10, act_t2: 10, act_r1: 10, act_l1: 10, act_b1: 10 };
    group.evaluations!.parcial2.grades['st-1'] = { act_t1: 8, act_t2: 8, act_r1: 8, act_l1: 8, act_b1: 8 };
    group.evaluations!.parcial3.grades['st-1'] = { act_t1: 6, act_t2: 6, act_r1: 6, act_l1: 6, act_b1: 6 };

    const result = calculateFinalScore(group, 'st-1');
    assert.strictEqual(result.final, 7.8); // 10*.3 + 8*.3 + 6*.4 = 7.8
    assert.strictEqual(result.status, 'Acreditado');
  });

  it('applies the attendance gate and reports Sin derecho', () => {
    const sessions = Array.from({ length: 5 }, (_, index) => ({
      id: `s${index}`,
      date: `2026-08-0${index + 1}`,
      startTime: '10:00',
      endTime: '12:00',
      attendance: {
        'st-1': {
          studentId: 'st-1',
          status: index === 0 ? ('present' as const) : ('absent' as const),
          timestamp: 0,
        },
      },
      totalPresent: index === 0 ? 1 : 0,
      totalStudents: 1,
    }));

    const group = makeGroup({
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

    const result = calculateFinalScore(group, 'st-1');
    assert.strictEqual(result.attendancePercentage, 20);
    assert.strictEqual(result.status, 'Sin derecho');
    assert.strictEqual(result.final, 5.0);
  });

  it('fails all partials below the minimum when failIfAnyParcialFailed is enabled', () => {
    const group = makeGroup({
      closureConfig: {
        universityName: 'UACJ',
        formulaType: 'simple',
        weights: { p1: 30, p2: 30, p3: 40 },
        minAttendancePass: false,
        attendanceMinRate: 80,
        roundingRule: 'round',
        failIfAnyParcialFailed: true,
      },
    });
    group.evaluations!.parcial1.grades['st-1'] = { act_t1: 10, act_t2: 10, act_r1: 10, act_l1: 10, act_b1: 10 };
    group.evaluations!.parcial2.grades['st-1'] = { act_t1: 6, act_t2: 6, act_r1: 6, act_l1: 6, act_b1: 6 };
    group.evaluations!.parcial3.grades['st-1'] = { act_t1: 10, act_t2: 10, act_r1: 10, act_l1: 10, act_b1: 10 };

    const result = calculateFinalScore(group, 'st-1');
    assert.strictEqual(result.status, 'No Acreditado');
    assert.strictEqual(result.final, 5.0);
    assert.ok(result.reason?.includes('Parcial 2'));
  });

  it('resolves a safe default policy without closure configuration', () => {
    const policy = resolveGradingPolicy(makeGroup());
    assert.strictEqual(policy.formula, 'simple');
    assert.strictEqual(policy.rounding, 'round');
    assert.strictEqual(policy.minPass, 7.0);
    assert.strictEqual(policy.attendanceGate.enabled, false);
    assert.strictEqual(policy.missingPolicy, 'renormalize');
  });

  it('formats null as a dash, never as 0.0', () => {
    assert.strictEqual(formatGrade(null), '—');
    assert.strictEqual(formatGrade(9.5), '9.5');
  });

  it('cleans legacy group names for institutional reports', () => {
    assert.strictEqual(
      cleanGroupName('👨‍🏫 Enzimología A-L3 · Profesor'),
      'Enzimología A-L3',
    );
    assert.strictEqual(
      cleanGroupName('🧪 Bioquímica Metabólica A-L1 · Profesor'),
      'Bioquímica Metabólica A-L1',
    );
  });

  it('normalizes accents and casing for matching', () => {
    assert.strictEqual(normalizeText('  José  HERNÁNDEZ Pérez '), 'jose hernandez perez');
    assert.strictEqual(normalizeText('BIOQUÍMICA'), 'bioquimica');
  });
});
