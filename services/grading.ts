import {
  CategoryScore,
  EvaluationCategory,
  FinalScoreResult,
  FinalStatus,
  GradingPolicy,
  Group,
  GroupEvaluations,
  ParcialEvaluation,
  ParcialScore,
  RoundingRule,
} from '../types';
import { calculateStudentStats } from './utils';

/**
 * Single source of truth for ProfAsist grade calculations.
 *
 * Invariants:
 * - A missing activity grade is NOT a zero. Only activities with a finite
 *   numeric grade participate in an average.
 * - A category with no grades is excluded from the parcial and the remaining
 *   weights are re-normalized (missingPolicy = 'renormalize').
 * - A parcial with no configured activities, or with no grades at all, is
 *   null. A null parcial makes the final grade null and the status
 *   "Pendiente" instead of a false "No Acreditado".
 * - Reported parcial grades are rounded to one decimal before the final
 *   average, so the app, the XLSX and the official acta always agree.
 * - Rounding uses a decimal-epsilon guard to avoid 6.95 -> 6.9 artefacts.
 */

export const DEFAULT_WEIGHTS = { p1: 30, p2: 30, p3: 40 };
export const DEFAULT_MIN_PASS = 7.0;
export const DEFAULT_ATTENDANCE_RATE = 80;
export const GRADE_DECIMALS = 1;

export const DEFAULT_POLICY: GradingPolicy = {
  formula: 'simple',
  weights: { ...DEFAULT_WEIGHTS },
  rounding: 'round',
  minPass: DEFAULT_MIN_PASS,
  attendanceGate: { enabled: false, minRate: DEFAULT_ATTENDANCE_RATE },
  missingPolicy: 'renormalize',
};

const DECIMAL_FACTOR = 10 ** GRADE_DECIMALS;

/**
 * Deterministic rounding to one decimal (half-up).
 *
 * The official 2026-B actas were generated with Python's binary float
 * rounding, which can differ by 0.1 at exact .x5 boundaries (e.g. 9.95 -> 9.9
 * in Python vs 10.0 here). ProfAsist uses an explicit half-up rule so the app
 * and the live Excel formulas always agree. The historical difference is
 * documented in KNOWN_LIMITATIONS.md.
 *
 * 'mexican' follows the UACJ-style integer rule used by the closure screen:
 * below 6.0 it floors, from 6.0 it goes to the nearest integer.
 */
export const roundGrade = (
  value: number,
  rule: RoundingRule = 'round',
  decimals: number = GRADE_DECIMALS,
): number => {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** decimals;

  switch (rule) {
    case 'none':
      return value;
    case 'floor':
      return Math.floor(value * factor + 1e-9) / factor;
    case 'ceil':
      return Math.ceil(value * factor - 1e-9) / factor;
    case 'mexican': {
      if (value < 6.0) return Math.floor(value + 1e-9);
      const lower = Math.floor(value + 1e-9);
      return value - lower >= 0.5 ? lower + 1 : lower;
    }
    case 'round':
    default:
      return Math.round((value + Number.EPSILON) * factor) / factor;
  }
};

/** Clamp a user-entered grade to the valid 0..10 range. */
export const clampGrade = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(10, Math.max(0, value));
};

/** A numeric grade that can safely participate in an average. */
const toGrade = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 0 || value > 10) return null;
  return value;
};

const average = (values: number[]): number | null => {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const sum = (values: number[]): number =>
  values.reduce((total, value) => total + value, 0);

const round1 = (value: number): number =>
  Math.round((value + Number.EPSILON) * DECIMAL_FACTOR) / DECIMAL_FACTOR;

/** Resolve the effective policy for a group. */
export const resolveGradingPolicy = (
  group: Pick<Group, 'closureConfig'>,
  attendanceThreshold: number = DEFAULT_ATTENDANCE_RATE,
): GradingPolicy => {
  const config = group.closureConfig;
  const configuredWeights = config?.weights || DEFAULT_WEIGHTS;
  const weights = {
    p1: Number.isFinite(configuredWeights.p1) ? configuredWeights.p1 : DEFAULT_WEIGHTS.p1,
    p2: Number.isFinite(configuredWeights.p2) ? configuredWeights.p2 : DEFAULT_WEIGHTS.p2,
    p3: Number.isFinite(configuredWeights.p3) ? configuredWeights.p3 : DEFAULT_WEIGHTS.p3,
  };

  return {
    formula: config?.formulaType === 'weighted' ? 'weighted' : 'simple',
    weights,
    rounding: config?.roundingRule || 'round',
    minPass:
      config?.minPass !== undefined && Number.isFinite(config.minPass)
        ? config.minPass
        : DEFAULT_MIN_PASS,
    attendanceGate: {
      enabled: config?.minAttendancePass === true,
      minRate:
        config?.attendanceMinRate !== undefined && Number.isFinite(config.attendanceMinRate)
          ? config.attendanceMinRate
          : attendanceThreshold,
    },
    missingPolicy: 'renormalize',
  };
};

export const calculateCategoryScore = (
  studentId: string,
  category: EvaluationCategory,
  grades: Record<string, Record<string, number>>,
): CategoryScore => {
  const studentGrades = grades[studentId] || {};
  const values = category.activities
    .map((activity) => toGrade(studentGrades[activity.id]))
    .filter((value): value is number => value !== null);

  return {
    value: average(values),
    gradedActivities: values.length,
    totalActivities: category.activities.length,
  };
};

export const calculateParcialScore = (
  studentId: string,
  parcial: ParcialEvaluation | undefined,
  policy: GradingPolicy = DEFAULT_POLICY,
): ParcialScore => {
  if (!parcial) {
    return {
      value: null,
      coverage: 0,
      complete: false,
      gradedWeight: 0,
      totalWeight: 0,
      categories: {},
    };
  }

  // Categories without activities are "not configured": they do not count
  // towards the weight, otherwise an empty P2 would silently be a zero.
  const activeCategories = parcial.categories.filter(
    (category) => category.activities.length > 0,
  );

  const categories: Record<string, CategoryScore> = {};
  activeCategories.forEach((category) => {
    categories[category.id] = calculateCategoryScore(
      studentId,
      category,
      parcial.grades,
    );
  });

  const totalActivities = activeCategories.reduce(
    (total, category) => total + category.activities.length,
    0,
  );
  const gradedActivities = activeCategories.reduce(
    (total, category) => total + (categories[category.id]?.gradedActivities || 0),
    0,
  );

  const totalWeight = sum(activeCategories.map((category) => category.weight));
  const categoriesWithGrades = activeCategories.filter(
    (category) => categories[category.id]?.value !== null,
  );

  if (activeCategories.length === 0 || categoriesWithGrades.length === 0) {
    return {
      value: null,
      coverage: 0,
      complete: false,
      gradedWeight: 0,
      totalWeight,
      categories,
    };
  }

  const gradedWeight = sum(
    categoriesWithGrades.map((category) => category.weight),
  );

  const numerator = sum(
    categoriesWithGrades.map(
      (category) => (categories[category.id]?.value as number) * category.weight,
    ),
  );

  let denominator: number;
  let value: number | null;

  if (policy.missingPolicy === 'zero') {
    // Conservative mode: missing categories count as zero and keep their weight.
    denominator = totalWeight;
    const zeroNumerator = sum(
      activeCategories.map(
        (category) => (categories[category.id]?.value ?? 0) * category.weight,
      ),
    );
    value = denominator > 0 ? zeroNumerator / denominator : null;
  } else {
    denominator = gradedWeight;
    value = denominator > 0 ? numerator / denominator : null;
  }

  return {
    value,
    coverage: totalActivities > 0 ? gradedActivities / totalActivities : 0,
    complete: categoriesWithGrades.length === activeCategories.length,
    gradedWeight,
    totalWeight,
    categories,
  };
};

const warningForParcial = (label: string, score: ParcialScore): string[] => {
  const warnings: string[] = [];
  if (score.value === null) {
    warnings.push(`${label}: sin calificaciones registradas`);
    return warnings;
  }
  if (!score.complete) {
    warnings.push(`${label}: hay categorías sin calificar (promedio re-normalizado)`);
  }
  if (score.coverage < 1) {
    const missing = Math.round((1 - score.coverage) * 100);
    warnings.push(`${label}: ${missing}% de actividades sin nota`);
  }
  return warnings;
};

export const calculateFinalScore = (
  group: Pick<Group, 'students' | 'sessions' | 'evaluations' | 'closureConfig' | 'finalOverrides'>,
  studentId: string,
  policy: GradingPolicy = resolveGradingPolicy(group),
): FinalScoreResult => {
  const evaluations: GroupEvaluations | undefined = group.evaluations;

  const parcialScores = {
    p1: calculateParcialScore(studentId, evaluations?.parcial1, policy),
    p2: calculateParcialScore(studentId, evaluations?.parcial2, policy),
    p3: calculateParcialScore(studentId, evaluations?.parcial3, policy),
  };

  // Reported parcials are rounded exactly once, with the configured rule.
  // 'mexican' is an integer rule intended for the final grade; partials use
  // normal one-decimal rounding so the breakdown stays readable.
  const parcialRounding: RoundingRule =
    policy.rounding === 'mexican' ? 'round' : policy.rounding;

  const p1 =
    parcialScores.p1.value === null ? null : roundGrade(parcialScores.p1.value, parcialRounding);
  const p2 =
    parcialScores.p2.value === null ? null : roundGrade(parcialScores.p2.value, parcialRounding);
  const p3 =
    parcialScores.p3.value === null ? null : roundGrade(parcialScores.p3.value, parcialRounding);

  const stats = calculateStudentStats(group as Group, studentId);
  const attendancePercentage = stats.percentage;
  const attendanceEligible = !policy.attendanceGate.enabled
    ? true
    : attendancePercentage >= policy.attendanceGate.minRate;

  const warnings = [
    ...warningForParcial('Parcial 1', parcialScores.p1),
    ...warningForParcial('Parcial 2', parcialScores.p2),
    ...warningForParcial('Parcial 3', parcialScores.p3),
  ];

  let rawFinal: number | null = null;
  if (p1 !== null && p2 !== null && p3 !== null) {
    const weightSum = policy.weights.p1 + policy.weights.p2 + policy.weights.p3;
    if (policy.formula === 'weighted' && weightSum > 0) {
      rawFinal =
        (p1 * policy.weights.p1 + p2 * policy.weights.p2 + p3 * policy.weights.p3) /
        weightSum;
    } else {
      rawFinal = (p1 + p2 + p3) / 3;
    }
  }

  let final: number | null =
    rawFinal === null ? null : roundGrade(rawFinal, policy.rounding);
  const override = group.finalOverrides?.[studentId];
  let overrideReason: string | undefined;
  let overridden = false;

  if (final !== null && override && Number.isFinite(override.grade)) {
    final = clampGrade(override.grade);
    overridden = true;
    overrideReason = override.reason;
    warnings.push(`Resolución docente: ${override.reason}`);
  }

  let status: FinalStatus = 'Pendiente';
  let reason: string | undefined;

  if (final !== null) {
    status = final >= policy.minPass ? 'Acreditado' : 'No Acreditado';

    if (!attendanceEligible) {
      status = 'Sin derecho';
      reason = `Asistencia ${attendancePercentage}% < ${policy.attendanceGate.minRate}%`;
      // Institutional convention: no right is reported with 5.0.
      final = 5.0;
    } else if (
      group.closureConfig?.failIfAnyParcialFailed &&
      (p1 as number) < policy.minPass
    ) {
      status = 'No Acreditado';
      reason = 'Parcial 1 por debajo de la calificación mínima';
      final = 5.0;
    } else if (
      group.closureConfig?.failIfAnyParcialFailed &&
      (p2 as number) < policy.minPass
    ) {
      status = 'No Acreditado';
      reason = 'Parcial 2 por debajo de la calificación mínima';
      final = 5.0;
    } else if (
      group.closureConfig?.failIfAnyParcialFailed &&
      (p3 as number) < policy.minPass
    ) {
      status = 'No Acreditado';
      reason = 'Parcial 3 por debajo de la calificación mínima';
      final = 5.0;
    }
  } else {
    warnings.push('Calificación final pendiente: falta al menos un parcial completo');
  }

  return {
    p1,
    p2,
    p3,
    final,
    rawFinal,
    status,
    attendancePercentage,
    attendanceEligible,
    reason,
    warnings,
    complete: p1 !== null && p2 !== null && p3 !== null,
    overridden,
    overrideReason,
    parciares: parcialScores,
  };
};

/** Display helper: null is not zero. */
export const formatGrade = (value: number | null, fallback = '—'): string =>
  value === null ? fallback : value.toFixed(GRADE_DECIMALS);

export const formatStatus = (status: FinalStatus): string => {
  switch (status) {
    case 'Acreditado':
      return 'Acreditado';
    case 'No Acreditado':
      return 'No Acreditado';
    case 'Sin derecho':
      return 'Sin derecho (S/D)';
    case 'Pendiente':
    default:
      return 'Pendiente';
  }
};

/** Accent-insensitive, case-insensitive text normalization for matching. */
export const normalizeText = (value: string): string =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Remove emoji and the legacy "· Profesor" suffix from group names before
 * using them in institutional headers and file names.
 */
export const cleanGroupName = (name: string): string =>
  (name || '')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/[·|]\s*profesor\s*$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s·|-]+|[\s·|-]+$/g, '')
    .trim();

/** Effective semester label for reports. */
export const resolveSemesterLabel = (group: Group, fallback?: string): string =>
  group.reporting?.semesterLabel || group.semester || fallback || '';

/** Effective subject name for reports. */
export const resolveSubjectName = (group: Group): string =>
  group.reporting?.subjectName || cleanGroupName(group.name) || 'Materia sin nombre';
