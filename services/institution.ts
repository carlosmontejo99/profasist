import {
  AppSettings,
  Group,
  GroupReporting,
  InstitutionProfile,
} from '../types';
import { cleanGroupName } from './grading';

/**
 * Official institutional seed for this build. Every field remains editable in
 * Ajustes > Institución; the seed only provides the UACJ defaults that the
 * official actas already use.
 */
const currentYear = new Date().getFullYear();
const currentSuffix = new Date().getMonth() <= 6 ? 'A' : 'B';
export const CURRENT_SEMESTER = `${currentYear}-${currentSuffix}`;

export const DEFAULT_INSTITUTION_PROFILE: InstitutionProfile = {
  university: 'UNIVERSIDAD AUTÓNOMA DE CIUDAD JUÁREZ',
  institute: 'DCQB',
  laboratoryPrefix: 'Laboratorio de',
  professor: 'Carlos Montejo Dávila',
  semesterDefault: CURRENT_SEMESTER,
};

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const joinNonEmpty = (parts: Array<string | undefined>, separator: string): string =>
  parts.map(text).filter(Boolean).join(separator);

/**
 * Build a complete profile from persisted settings. Missing keys fall back to
 * the official seed; explicitly cleared values are preserved as empty strings.
 */
export const buildInstitutionProfile = (
  settings: AppSettings = {},
): InstitutionProfile => {
  const stored = settings.institution;
  return {
    university: stored?.university ?? DEFAULT_INSTITUTION_PROFILE.university,
    institute: stored?.institute ?? DEFAULT_INSTITUTION_PROFILE.institute,
    laboratoryPrefix:
      stored?.laboratoryPrefix ?? DEFAULT_INSTITUTION_PROFILE.laboratoryPrefix,
    professor:
      stored?.professor ??
      (text(settings.teacherName) || DEFAULT_INSTITUTION_PROFILE.professor),
    semesterDefault:
      stored?.semesterDefault ||
      text(settings.currentSemester) ||
      DEFAULT_INSTITUTION_PROFILE.semesterDefault,
    email: stored?.email,
    logoDataUrl: stored?.logoDataUrl,
  };
};

export const resolveInstitutionProfile = buildInstitutionProfile;

export interface ReportMetadata {
  university: string;
  institute: string;
  subjectName: string;
  laboratoryName: string;
  semesterLabel: string;
  professorName: string;
  headerLine1: string;
  headerLine2: string;
}

/**
 * Resolve the two official header lines for a group:
 *   UNIVERSIDAD · INSTITUTO
 *   Laboratorio de Materia · Semestre 2026-B · Prof. Nombre
 */
export const resolveReportMetadata = (
  group: Group,
  settings: AppSettings = {},
): ReportMetadata => {
  const profile = resolveInstitutionProfile(settings);
  const subjectName =
    text(group.reporting?.subjectName) ||
    cleanGroupName(group.name) ||
    'Materia sin nombre';

  const prefix = text(profile.laboratoryPrefix);
  const subjectAlreadyLabelled =
    prefix.length > 0 &&
    subjectName.toLowerCase().startsWith(prefix.toLowerCase());

  const laboratoryName =
    text(group.reporting?.laboratoryName) ||
    (subjectAlreadyLabelled
      ? subjectName
      : joinNonEmpty([prefix, subjectName], ' '));

  const semesterLabel =
    text(group.reporting?.semesterLabel) ||
    text(group.semester) ||
    text(profile.semesterDefault);

  const professorName =
    text(group.reporting?.professorName) ||
    text(profile.professor) ||
    text(settings.teacherName);

  return {
    university: text(profile.university),
    institute: text(profile.institute),
    subjectName,
    laboratoryName,
    semesterLabel,
    professorName,
    headerLine1: joinNonEmpty([profile.university, profile.institute], ' · '),
    headerLine2: joinNonEmpty(
      [
        laboratoryName,
        semesterLabel ? `Semestre ${semesterLabel}` : '',
        professorName ? `Prof. ${professorName}` : '',
      ],
      ' · ',
    ),
  };
};

/** Safe file name for institutional workbooks. */
export const sanitizeFileName = (value: string): string =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/-/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

export const buildActaFileName = (
  group: Group,
  settings: AppSettings = {},
): string => {
  const metadata = resolveReportMetadata(group, settings);
  const subject = sanitizeFileName(metadata.subjectName) || 'Materia';
  const semester = sanitizeFileName(metadata.semesterLabel) || 'Semestre';
  return `Acta_Oficial_${subject}_${semester}.xlsx`;
};

/** Merge a per-group reporting override without dropping other fields. */
export const updateGroupReporting = (
  group: Group,
  patch: GroupReporting,
): Group => {
  const next: GroupReporting = { ...(group.reporting || {}) };
  (Object.keys(patch) as Array<keyof GroupReporting>).forEach((key) => {
    const value = patch[key];
    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
  });
  return { ...group, reporting: next };
};
