import {
  DeliveryChannel,
  DeliveryRecord,
  DeliveryStatus,
  Group,
  ParcialEvaluation,
} from '../types';
import { normalizeText } from './grading';
import { generateUUID } from './utils';

export const DELIVERY_CHANNELS: Array<{ id: DeliveryChannel; label: string }> = [
  { id: 'teams', label: 'Teams' },
  { id: 'outlook', label: 'Outlook' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'presencial', label: 'Presencial' },
  { id: 'usb', label: 'USB / Local' },
  { id: 'otro', label: 'Otro' },
];

export const DELIVERY_STATUSES: Array<{ id: DeliveryStatus; label: string }> = [
  { id: 'pendiente', label: 'Pendiente' },
  { id: 'validada', label: 'Validada' },
  { id: 'rechazada', label: 'Rechazada' },
  { id: 'duplicada', label: 'Duplicada' },
];

export type ParcialId = 'parcial1' | 'parcial2' | 'parcial3';

export interface DeliveryDraft {
  groupId: string;
  studentId: string;
  parcialId: ParcialId;
  activityId: string;
  channel: DeliveryChannel;
  receivedAt: string;
  evidenceRef: string;
  status: DeliveryStatus;
  grade?: number;
  note?: string;
  actor: 'docente' | 'agente';
}

export interface ImportIssue {
  line: number;
  message: string;
  raw?: string;
}

export interface DeliveryImportResult {
  drafts: DeliveryDraft[];
  errors: ImportIssue[];
  unresolved: ImportIssue[];
  duplicates: ImportIssue[];
}

export interface DeliveryCoverage {
  expected: number;
  covered: number;
  percentage: number;
  gaps: Array<{
    studentId: string;
    studentName: string;
    activityId: string;
    activityName: string;
    categoryName: string;
  }>;
}

const CHANNEL_ALIASES: Record<string, DeliveryChannel> = {
  teams: 'teams',
  team: 'teams',
  microsoft_teams: 'teams',
  chat: 'teams',
  outlook: 'outlook',
  correo: 'outlook',
  email: 'outlook',
  mail: 'outlook',
  whatsapp: 'whatsapp',
  wa: 'whatsapp',
  presencial: 'presencial',
  clase: 'presencial',
  fisico: 'presencial',
  usb: 'usb',
  local: 'usb',
  memoria: 'usb',
  otro: 'otro',
  otros: 'otro',
};

const STATUS_ALIASES: Record<string, DeliveryStatus> = {
  pendiente: 'pendiente',
  pending: 'pendiente',
  recibida: 'pendiente',
  validada: 'validada',
  validado: 'validada',
  aprobada: 'validada',
  rechazada: 'rechazada',
  rechazado: 'rechazada',
  duplicada: 'duplicada',
  duplicado: 'duplicada',
};

const normalizeKey = (value: string): string =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeRoll = (value: string): string =>
  (value || '').replace(/[\s.\-]/g, '').toLowerCase();

const HEADER_ALIASES: Record<string, string> = {
  matricula: 'matricula',
  matrícula: 'matricula',
  roll: 'matricula',
  rollnumber: 'matricula',
  no_control: 'matricula',
  numero_control: 'matricula',
  nombre: 'nombre',
  alumno: 'nombre',
  nombre_del_alumno: 'nombre',
  name: 'nombre',
  parcial: 'parcial',
  parcial_id: 'parcial',
  p: 'parcial',
  actividad: 'actividad',
  actividad_id: 'actividad',
  activity: 'actividad',
  canal: 'canal',
  channel: 'canal',
  medio: 'canal',
  fecha: 'fecha',
  fecha_recepcion: 'fecha',
  received_at: 'fecha',
  fecha_entrega: 'fecha',
  evidencia: 'evidencia',
  archivo: 'evidencia',
  url: 'evidencia',
  referencia: 'evidencia',
  evidence: 'evidencia',
  nota: 'nota',
  calificacion: 'nota',
  calificación: 'nota',
  grade: 'nota',
  estado: 'estado',
  status: 'estado',
  motivo: 'motivo',
  nota_texto: 'motivo',
  comentario: 'motivo',
  observaciones: 'motivo',
};

const detectDelimiter = (line: string): string => {
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestCount = -1;
  for (const candidate of candidates) {
    let count = 0;
    let inQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') {
        if (inQuotes && line[index + 1] === '"') {
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === candidate && !inQuotes) {
        count += 1;
      }
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
};

const parseLine = (line: string, delimiter: string): string[] => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
};

const parseDate = (value: string): string | null => {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const date = new Date(
      Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]), 12),
    );
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const parseParcial = (value: string): ParcialId | null => {
  const key = normalizeKey(value);
  if (!key) return null;
  if (['1', 'p1', 'parcial_1', 'parcial1', 'uno'].includes(key)) return 'parcial1';
  if (['2', 'p2', 'parcial_2', 'parcial2', 'dos'].includes(key)) return 'parcial2';
  if (['3', 'p3', 'parcial_3', 'parcial3', 'tres'].includes(key)) return 'parcial3';
  return null;
};

const parseNumber = (value: string): number | null => {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const listActivities = (parcial: ParcialEvaluation | undefined) =>
  (parcial?.categories || []).flatMap((category) =>
    category.activities.map((activity) => ({
      ...activity,
      categoryName: category.name,
    })),
  );

const resolveParcialAndActivity = (
  group: Group,
  rawParcial: string,
  rawActivity: string,
): { parcialId: ParcialId; activityId: string; activityName: string; categoryName: string } | null => {
  const explicitParcial = parseParcial(rawParcial);
  const activityKey = normalizeText(rawActivity);

  const search = (parcialId: ParcialId) => {
    const activity = listActivities(group.evaluations?.[parcialId]).find(
      (item) =>
        item.id === rawActivity.trim() ||
        normalizeText(item.name) === activityKey,
    );
    return activity
      ? {
          parcialId,
          activityId: activity.id,
          activityName: activity.name,
          categoryName: activity.categoryName,
        }
      : null;
  };

  if (explicitParcial) return search(explicitParcial);
  if (!activityKey) return null;

  const matches = (['parcial1', 'parcial2', 'parcial3'] as ParcialId[])
    .map(search)
    .filter((match): match is NonNullable<typeof match> => match !== null);

  return matches.length === 1 ? matches[0] : null;
};

const resolveStudent = (
  group: Group,
  rawRoll: string,
  rawName: string,
): { studentId: string; studentName: string } | null => {
  const rollKey = normalizeRoll(rawRoll);
  const nameKey = normalizeText(rawName);

  if (rollKey) {
    const byRoll = group.students.filter(
      (student) => normalizeRoll(student.rollNumber || '') === rollKey,
    );
    if (byRoll.length === 1) {
      return { studentId: byRoll[0].id, studentName: byRoll[0].name };
    }
    if (byRoll.length > 1) return null;
  }

  if (nameKey) {
    const byName = group.students.filter(
      (student) => normalizeText(student.name) === nameKey,
    );
    if (byName.length === 1) {
      return { studentId: byName[0].id, studentName: byName[0].name };
    }
  }

  return null;
};

const toChannel = (value: string): DeliveryChannel => {
  const key = normalizeKey(value);
  return CHANNEL_ALIASES[key] || 'otro';
};

const toStatus = (value: string): DeliveryStatus => {
  const key = normalizeKey(value);
  return STATUS_ALIASES[key] || 'pendiente';
};

export const validateDeliveryDraft = (
  draft: DeliveryDraft,
  group: Group,
): string[] => {
  const errors: string[] = [];
  const student = group.students.find((item) => item.id === draft.studentId);
  if (!student) errors.push('El alumno no existe en la materia.');

  const parcial = group.evaluations?.[draft.parcialId];
  const activity = listActivities(parcial).find((item) => item.id === draft.activityId);
  if (!activity) errors.push('La actividad no existe en el parcial seleccionado.');

  if (!draft.evidenceRef.trim()) errors.push('La referencia de evidencia es obligatoria.');
  if (!draft.receivedAt || Number.isNaN(new Date(draft.receivedAt).getTime())) {
    errors.push('La fecha de recepción no es válida.');
  } else if (new Date(draft.receivedAt).getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    errors.push('La fecha de recepción está en el futuro.');
  }

  if (draft.grade !== undefined) {
    if (!Number.isFinite(draft.grade) || draft.grade < 0 || draft.grade > 10) {
      errors.push('La calificación debe estar entre 0.0 y 10.0.');
    }
  }

  return errors;
};

export const draftToRecord = (
  draft: DeliveryDraft,
  existingId?: string,
): DeliveryRecord => ({
  id: existingId || generateUUID(),
  groupId: draft.groupId,
  studentId: draft.studentId,
  parcialId: draft.parcialId,
  activityId: draft.activityId,
  channel: draft.channel,
  receivedAt: draft.receivedAt,
  evidenceRef: draft.evidenceRef.trim(),
  status: draft.status,
  grade: draft.grade,
  note: draft.note?.trim() || undefined,
  validatedAt: draft.status === 'validada' ? new Date().toISOString() : undefined,
  actor: draft.actor,
});

const sameDay = (left: string, right: string): boolean => {
  const a = new Date(left);
  const b = new Date(right);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
};

export const findDuplicateDelivery = (
  candidate: Pick<
    DeliveryRecord,
    'studentId' | 'activityId' | 'receivedAt' | 'evidenceRef'
  >,
  existing: DeliveryRecord[],
): DeliveryRecord | undefined =>
  existing.find((record) => {
    if (record.status === 'rechazada') return false;
    if (record.studentId !== candidate.studentId) return false;
    if (record.activityId !== candidate.activityId) return false;
    const sameEvidence =
      normalizeText(record.evidenceRef) === normalizeText(candidate.evidenceRef);
    return sameEvidence || sameDay(record.receivedAt, candidate.receivedAt);
  });

export const getDeliveryCoverage = (
  group: Group,
  deliveries: DeliveryRecord[],
  parcialId: ParcialId,
): DeliveryCoverage => {
  const activities = listActivities(group.evaluations?.[parcialId]);
  const expected = group.students.length * activities.length;
  const receivedKeys = new Set(
    deliveries
      .filter(
        (record) =>
          record.parcialId === parcialId && record.status !== 'rechazada',
      )
      .map((record) => `${record.studentId}:${record.activityId}`),
  );

  const gaps: DeliveryCoverage['gaps'] = [];
  group.students.forEach((student) => {
    activities.forEach((activity) => {
      if (!receivedKeys.has(`${student.id}:${activity.id}`)) {
        gaps.push({
          studentId: student.id,
          studentName: student.name,
          activityId: activity.id,
          activityName: activity.name,
          categoryName: activity.categoryName,
        });
      }
    });
  });

  const covered = expected - gaps.length;
  return {
    expected,
    covered,
    percentage: expected === 0 ? 0 : Math.round((covered / expected) * 100),
    gaps,
  };
};

export const applyDeliveryGrade = (
  group: Group,
  delivery: DeliveryRecord,
): { group: Group; previousGrade: number | undefined } => {
  const activity = listActivities(group.evaluations?.[delivery.parcialId]).find(
    (item) => item.id === delivery.activityId,
  );
  if (!activity) {
    throw new Error('La actividad de la entrega ya no existe en la materia.');
  }
  if (delivery.grade === undefined || !Number.isFinite(delivery.grade)) {
    throw new Error('La entrega no tiene una calificación para aplicar.');
  }

  const evaluations = JSON.parse(
    JSON.stringify(group.evaluations || {}),
  ) as Group['evaluations'];
  if (!evaluations) {
    throw new Error('La materia no tiene un esquema de evaluación.');
  }

  const parcial = evaluations[delivery.parcialId];
  if (!parcial) {
    throw new Error('El parcial de la entrega no existe.');
  }

  parcial.grades[delivery.studentId] = parcial.grades[delivery.studentId] || {};
  const previousGrade = parcial.grades[delivery.studentId][delivery.activityId];
  parcial.grades[delivery.studentId][delivery.activityId] = delivery.grade;

  return {
    group: { ...group, evaluations },
    previousGrade,
  };
};

const readJsonRows = (text: string): { rows: Record<string, string>[]; errors: ImportIssue[] } => {
  try {
    const parsed = JSON.parse(text);
    const source = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.deliveries)
        ? parsed.deliveries
        : Array.isArray(parsed?.rows)
          ? parsed.rows
          : null;

    if (!source) {
      return {
        rows: [],
        errors: [{ line: 0, message: 'El JSON debe ser un arreglo o contener "deliveries".' }],
      };
    }

    return {
      rows: source.map((item: any) => ({
        matricula: String(item.matricula || item.rollNumber || ''),
        nombre: String(item.nombre || item.studentName || ''),
        parcial: String(item.parcial || item.parcialId || ''),
        actividad: String(item.actividad || item.activityId || item.activity || ''),
        canal: String(item.canal || item.channel || ''),
        fecha: String(item.fecha || item.receivedAt || item.date || ''),
        evidencia: String(item.evidencia || item.evidenceRef || item.evidence || ''),
        nota: String(item.nota ?? item.calificacion ?? item.grade ?? ''),
        estado: String(item.estado || item.status || ''),
        motivo: String(item.motivo || item.note || ''),
      })),
      errors: [],
    };
  } catch (error: any) {
    return {
      rows: [],
      errors: [{ line: 0, message: `JSON inválido: ${error?.message || 'formato desconocido'}` }],
    };
  }
};

export const parseDeliveryImport = (
  text: string,
  group: Group,
  existing: DeliveryRecord[] = [],
): DeliveryImportResult => {
  const trimmed = (text || '').trim();
  const result: DeliveryImportResult = {
    drafts: [],
    errors: [],
    unresolved: [],
    duplicates: [],
  };

  if (!trimmed) {
    result.errors.push({ line: 0, message: 'El archivo está vacío.' });
    return result;
  }

  let rows: Record<string, string>[] = [];
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const json = readJsonRows(trimmed);
    rows = json.rows;
    result.errors.push(...json.errors);
  } else {
    const lines = trimmed
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
      result.errors.push({ line: 0, message: 'El CSV no tiene filas de datos.' });
      return result;
    }

    const delimiter = detectDelimiter(lines[0]);
    const headers = parseLine(lines[0], delimiter).map((header) => {
      const key = normalizeKey(header);
      return HEADER_ALIASES[key] || key;
    });

    rows = lines.slice(1).map((line) => {
      const cells = parseLine(line, delimiter);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = cells[index] || '';
      });
      return row;
    });
  }

  rows.forEach((row, index) => {
    const line = index + 2;
    const rawLabel = `${row.matricula || ''} ${row.nombre || ''} ${row.actividad || ''}`.trim();

    const student = resolveStudent(group, row.matricula || '', row.nombre || '');
    if (!student) {
      result.unresolved.push({
        line,
        message: `No se pudo identificar al alumno (${row.matricula || 'sin matrícula'} / ${row.nombre || 'sin nombre'}).`,
        raw: rawLabel,
      });
      return;
    }

    const activity = resolveParcialAndActivity(
      group,
      row.parcial || '',
      row.actividad || '',
    );
    if (!activity) {
      result.unresolved.push({
        line,
        message: `No se pudo identificar la actividad "${row.actividad || 'sin actividad'}".`,
        raw: rawLabel,
      });
      return;
    }

    const receivedAt = parseDate(row.fecha || '') || new Date().toISOString();
    const grade = parseNumber(row.nota || '');
    if (grade !== null && (grade < 0 || grade > 10)) {
      result.errors.push({
        line,
        message: `Calificación fuera de rango (${grade}).`,
        raw: rawLabel,
      });
      return;
    }

    const draft: DeliveryDraft = {
      groupId: group.id,
      studentId: student.studentId,
      parcialId: activity.parcialId,
      activityId: activity.activityId,
      channel: toChannel(row.canal || ''),
      receivedAt,
      evidenceRef: (row.evidencia || '').trim() || `${student.studentName} · ${activity.activityName}`,
      status: toStatus(row.estado || ''),
      grade: grade === null ? undefined : grade,
      note: row.motivo || undefined,
      actor: 'docente',
    };

    const errors = validateDeliveryDraft(draft, group);
    if (errors.length > 0) {
      result.errors.push({ line, message: errors.join(' '), raw: rawLabel });
      return;
    }

    const duplicate = findDuplicateDelivery(draftToRecord(draft), existing);
    if (duplicate) {
      result.duplicates.push({
        line,
        message: `Duplicado de una entrega existente (${duplicate.evidenceRef}).`,
        raw: rawLabel,
      });
      return;
    }

    result.drafts.push(draft);
  });

  return result;
};
