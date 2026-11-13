import { describe, it } from 'node:test';
import assert from 'node:assert';
import { APP_DATA_VERSION, buildDefaultInstitution, migrateData } from '../services/storage.ts';

const v1Group = {
  id: 'group-1',
  name: '👨‍🏫 Enzimología A-L3 · Profesor',
  semester: '2026-A',
  scheduleSummary: 'Lun, Mié 10:00',
  students: [{ id: 'st-1', name: 'Ana García', rollNumber: '2026001' }],
  sessions: [
    {
      id: 's1',
      date: '2026-08-01',
      startTime: '10:00',
      endTime: '12:00',
      attendance: { 'st-1': { studentId: 'st-1', status: 'present', timestamp: 1 } },
      totalPresent: 1,
      totalStudents: 1,
    },
  ],
  color: '#4f46e5',
  archived: false,
  evaluations: {
    parcial1: { categories: [], grades: { 'st-1': { act_1: 9.5 } } },
    parcial2: { categories: [], grades: {} },
    parcial3: { categories: [], grades: {} },
  },
  closureConfig: {
    universityName: 'UNIVERSIDAD AUTÓNOMA DE CIUDAD JUÁREZ · DCQB',
    formulaType: 'simple',
    weights: { p1: 30, p2: 30, p3: 40 },
    minAttendancePass: false,
    attendanceMinRate: 80,
    roundingRule: 'round',
    failIfAnyParcialFailed: false,
    teacherName: 'Carlos Montejo Dávila',
  },
};

describe('Storage migration v1 -> v2', () => {
  it('adds the institution profile and preserves every academic record', () => {
    const input = {
      version: 1,
      settings: { currentSemester: '2026-A', teacherName: 'Carlos Montejo Dávila' },
      groups: [v1Group],
    };

    const { data, changed } = migrateData(input);

    assert.strictEqual(changed, true);
    assert.strictEqual(data.version, APP_DATA_VERSION);
    assert.ok(data.settings.institution);
    assert.strictEqual(data.settings.institution?.professor, 'Carlos Montejo Dávila');
    assert.strictEqual(data.settings.institution?.semesterDefault, '2026-A');
    assert.strictEqual(data.groups.length, 1);
    assert.strictEqual(data.groups[0].students.length, 1);
    assert.strictEqual(data.groups[0].sessions.length, 1);
    assert.deepStrictEqual(data.groups[0].evaluations, v1Group.evaluations);
    assert.deepStrictEqual(data.groups[0].closureConfig, v1Group.closureConfig);
  });

  it('is idempotent: a second migration does not change the payload', () => {
    const input = {
      version: 1,
      settings: { currentSemester: '2026-A', teacherName: 'Carlos Montejo Dávila' },
      groups: [v1Group],
    };

    const first = migrateData(input);
    const snapshot = JSON.stringify(first.data);
    const second = migrateData(first.data);

    assert.strictEqual(second.changed, false);
    assert.strictEqual(JSON.stringify(second.data), snapshot);
  });

  it('repairs a missing groups array without deleting settings', () => {
    const { data } = migrateData({ version: 1, settings: { teacherName: 'Docente' } });
    assert.deepStrictEqual(data.groups, []);
    assert.strictEqual(data.settings.teacherName, 'Docente');
    assert.strictEqual(data.version, APP_DATA_VERSION);
  });

  it('builds a generic institution profile without hardcoded personal data', () => {
    const profile = buildDefaultInstitution({ currentSemester: '2026-B' });
    assert.strictEqual(profile.university, '');
    assert.strictEqual(profile.institute, '');
    assert.strictEqual(profile.laboratoryPrefix, 'Laboratorio de');
    assert.strictEqual(profile.professor, '');
    assert.strictEqual(profile.semesterDefault, '2026-B');
  });
});
