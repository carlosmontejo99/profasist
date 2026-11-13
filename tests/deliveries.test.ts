import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  applyDeliveryGrade,
  draftToRecord,
  findDuplicateDelivery,
  getDeliveryCoverage,
  parseDeliveryImport,
  validateDeliveryDraft,
} from '../services/deliveries.ts';
import { DeliveryRecord, Group } from '../types.ts';

const makeGroup = (): Group => ({
  id: 'group-1',
  name: 'Enzimología A-L3',
  semester: '2026-B',
  scheduleSummary: '',
  color: '#4f46e5',
  archived: false,
  students: [
    { id: 'st-1', name: 'José Hernández Pérez', rollNumber: '2026-001' },
    { id: 'st-2', name: 'María del Carmen Álvarez', rollNumber: '2026-002' },
  ],
  sessions: [],
  evaluations: {
    parcial1: {
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
          id: 'cat_bitacora',
          name: 'Bitácora',
          weight: 80,
          activities: [{ id: 'act_b1', name: 'Bitácora' }],
        },
      ],
      grades: { 'st-1': { act_t1: 8 } },
    },
    parcial2: { categories: [], grades: {} },
    parcial3: { categories: [], grades: {} },
  },
});

const makeRecord = (overrides: Partial<DeliveryRecord> = {}): DeliveryRecord => ({
  id: 'delivery-1',
  groupId: 'group-1',
  studentId: 'st-1',
  parcialId: 'parcial1',
  activityId: 'act_t1',
  channel: 'teams',
  receivedAt: '2026-11-13T12:00:00.000Z',
  evidenceRef: 'Tarea1_Jose.pdf',
  status: 'pendiente',
  actor: 'docente',
  ...overrides,
});

describe('Delivery audit — parsing, validation and coverage', () => {
  it('parses a semicolon CSV with accents, dd/mm/yyyy dates and comma decimals', () => {
    const csv = `Matrícula;Nombre;Parcial;Actividad;Canal;Fecha;Evidencia;Nota;Estado
2026-001;José Hernández Pérez;P1;Tarea 1;Teams;13/11/2026;Tarea1_Jose.pdf;8,5;pendiente
2026-002;María del Carmen Álvarez;Parcial 1;Tarea 2;Correo;2026-11-12;Tarea2_Maria.pdf;9;validada`;

    const result = parseDeliveryImport(csv, makeGroup());
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.unresolved.length, 0);
    assert.strictEqual(result.drafts.length, 2);
    assert.strictEqual(result.drafts[0].studentId, 'st-1');
    assert.strictEqual(result.drafts[0].activityId, 'act_t1');
    assert.strictEqual(result.drafts[0].channel, 'teams');
    assert.strictEqual(result.drafts[0].grade, 8.5);
    assert.strictEqual(result.drafts[0].receivedAt.slice(0, 10), '2026-11-13');
    assert.strictEqual(result.drafts[1].channel, 'outlook');
    assert.strictEqual(result.drafts[1].status, 'validada');
  });

  it('infers the parcial when the CSV omits it and the activity is unique', () => {
    const csv = `Matrícula;Actividad;Evidencia;Fecha
2026-001;Bitácora;Bitacora_Jose.pdf;2026-11-13`;
    const result = parseDeliveryImport(csv, makeGroup());
    assert.strictEqual(result.drafts.length, 1);
    assert.strictEqual(result.drafts[0].parcialId, 'parcial1');
    assert.strictEqual(result.drafts[0].activityId, 'act_b1');
  });

  it('reports unresolved students and activities without creating drafts', () => {
    const csv = `Matrícula;Nombre;Actividad;Evidencia;Fecha
999999;Alumno Fantasma;Tarea 1;x.pdf;2026-11-13
2026-001;José Hernández Pérez;Actividad Inexistente;y.pdf;2026-11-13`;
    const result = parseDeliveryImport(csv, makeGroup());
    assert.strictEqual(result.drafts.length, 0);
    assert.strictEqual(result.unresolved.length, 2);
    assert.ok(result.unresolved[0].message.includes('alumno'));
    assert.ok(result.unresolved[1].message.includes('actividad'));
  });

  it('flags a duplicate when the same evidence is imported twice', () => {
    const csv = `Matrícula;Actividad;Evidencia;Fecha
2026-001;Tarea 1;Tarea1_Jose.pdf;2026-11-13`;
    const existing = [makeRecord()];
    const result = parseDeliveryImport(csv, makeGroup(), existing);
    assert.strictEqual(result.drafts.length, 0);
    assert.strictEqual(result.duplicates.length, 1);
  });

  it('detects duplicates by student, activity and same day even with a different file', () => {
    const duplicate = findDuplicateDelivery(
      {
        studentId: 'st-1',
        activityId: 'act_t1',
        receivedAt: '2026-11-13T18:00:00.000Z',
        evidenceRef: 'otro_nombre.pdf',
      },
      [makeRecord()],
    );
    assert.ok(duplicate);
    assert.strictEqual(duplicate?.id, 'delivery-1');
  });

  it('computes coverage and lists every missing student/activity pair', () => {
    const group = makeGroup();
    const coverage = getDeliveryCoverage(group, [makeRecord()], 'parcial1');
    assert.strictEqual(coverage.expected, 6); // 2 students x 3 activities
    assert.strictEqual(coverage.covered, 1);
    assert.strictEqual(coverage.percentage, 17);
    assert.strictEqual(coverage.gaps.length, 5);
  });

  it('applies a grade without touching other grades or activities', () => {
    const group = makeGroup();
    const delivery = makeRecord({ activityId: 'act_t2', grade: 9.5, status: 'validada' });
    const { group: updated, previousGrade } = applyDeliveryGrade(group, delivery);

    assert.strictEqual(previousGrade, undefined);
    assert.strictEqual(updated.evaluations?.parcial1.grades['st-1'].act_t1, 8);
    assert.strictEqual(updated.evaluations?.parcial1.grades['st-1'].act_t2, 9.5);
    // Original group remains immutable.
    assert.strictEqual(group.evaluations?.parcial1.grades['st-1'].act_t2, undefined);
  });

  it('returns the previous grade when overwriting an existing one', () => {
    const group = makeGroup();
    const delivery = makeRecord({ activityId: 'act_t1', grade: 10 });
    const { group: updated, previousGrade } = applyDeliveryGrade(group, delivery);
    assert.strictEqual(previousGrade, 8);
    assert.strictEqual(updated.evaluations?.parcial1.grades['st-1'].act_t1, 10);
  });

  it('rejects grades outside 0..10 and empty evidence', () => {
    const draft = {
      groupId: 'group-1',
      studentId: 'st-1',
      parcialId: 'parcial1' as const,
      activityId: 'act_t1',
      channel: 'teams' as const,
      receivedAt: '2026-11-13T12:00:00.000Z',
      evidenceRef: '',
      status: 'pendiente' as const,
      grade: 12,
      actor: 'docente' as const,
    };
    const errors = validateDeliveryDraft(draft, makeGroup());
    assert.ok(errors.some((error) => error.includes('evidencia')));
    assert.ok(errors.some((error) => error.includes('0.0 y 10.0')));
  });

  it('imports the same payload from JSON', () => {
    const json = JSON.stringify([
      {
        matricula: '2026-001',
        nombre: 'José Hernández Pérez',
        parcial: 'parcial1',
        actividad: 'Tarea 2',
        canal: 'WhatsApp',
        fecha: '2026-11-13T12:00:00.000Z',
        evidencia: 'Tarea2_Jose.pdf',
        nota: 7.5,
        estado: 'pendiente',
      },
    ]);
    const result = parseDeliveryImport(json, makeGroup());
    assert.strictEqual(result.drafts.length, 1);
    assert.strictEqual(result.drafts[0].channel, 'whatsapp');
    assert.strictEqual(result.drafts[0].grade, 7.5);
  });

  it('creates a stable record with a generated id and validated timestamp', () => {
    const draft = {
      groupId: 'group-1',
      studentId: 'st-1',
      parcialId: 'parcial1' as const,
      activityId: 'act_t1',
      channel: 'teams' as const,
      receivedAt: '2026-11-13T12:00:00.000Z',
      evidenceRef: '  archivo.pdf  ',
      status: 'validada' as const,
      grade: 9,
      actor: 'docente' as const,
    };
    const record = draftToRecord(draft);
    assert.ok(record.id.length > 10);
    assert.strictEqual(record.evidenceRef, 'archivo.pdf');
    assert.ok(record.validatedAt);
  });
});
