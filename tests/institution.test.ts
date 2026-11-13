import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  buildActaFileName,
  DEFAULT_INSTITUTION_PROFILE,
  resolveInstitutionProfile,
  resolveReportMetadata,
  sanitizeFileName,
  updateGroupReporting,
} from '../services/institution.ts';
import { Group } from '../types.ts';

const makeGroup = (overrides: Partial<Group> = {}): Group => ({
  id: 'group-1',
  name: '👨‍🏫 Enzimología A-L3 · Profesor',
  semester: '2026-A',
  scheduleSummary: 'Lun, Mié 10:00',
  students: [],
  sessions: [],
  color: '#4f46e5',
  archived: false,
  ...overrides,
});

describe('Institutional metadata resolution', () => {
  it('builds the official two-line header and cleans legacy group names', () => {
    const group = makeGroup({ reporting: { semesterLabel: '2026-B' } });
    const metadata = resolveReportMetadata(group, {
      institution: DEFAULT_INSTITUTION_PROFILE,
    });

    assert.strictEqual(metadata.subjectName, 'Enzimología A-L3');
    assert.strictEqual(metadata.laboratoryName, 'Laboratorio de Enzimología A-L3');
    assert.strictEqual(metadata.semesterLabel, '2026-B');
    assert.strictEqual(metadata.professorName, 'Carlos Montejo Dávila');
    assert.strictEqual(
      metadata.headerLine1,
      'UNIVERSIDAD AUTÓNOMA DE CIUDAD JUÁREZ · DCQB',
    );
    assert.strictEqual(
      metadata.headerLine2,
      'Laboratorio de Enzimología A-L3 · Semestre 2026-B · Prof. Carlos Montejo Dávila',
    );
  });

  it('honors per-group overrides without duplicating the laboratory prefix', () => {
    const group = makeGroup({
      reporting: {
        subjectName: 'Bioquímica Metabólica A-L1',
        laboratoryName: 'Laboratorio de Bioquímica Metabólica A-L1',
        semesterLabel: '2026-B',
        professorName: 'Dra. Docente Invitada',
      },
    });

    const metadata = resolveReportMetadata(group, {
      institution: DEFAULT_INSTITUTION_PROFILE,
    });

    assert.strictEqual(metadata.subjectName, 'Bioquímica Metabólica A-L1');
    assert.strictEqual(
      metadata.laboratoryName,
      'Laboratorio de Bioquímica Metabólica A-L1',
    );
    assert.strictEqual(metadata.professorName, 'Dra. Docente Invitada');
  });

  it('does not duplicate the prefix when the subject already includes it', () => {
    const group = makeGroup({ name: 'Laboratorio de Enzimología A-L3' });
    const metadata = resolveReportMetadata(group, {
      institution: DEFAULT_INSTITUTION_PROFILE,
    });
    assert.strictEqual(metadata.laboratoryName, 'Laboratorio de Enzimología A-L3');
  });

  it('uses the group semester when no override exists', () => {
    const metadata = resolveReportMetadata(makeGroup({ semester: '2026-B' }), {
      institution: DEFAULT_INSTITUTION_PROFILE,
    });
    assert.strictEqual(metadata.semesterLabel, '2026-B');
  });

  it('keeps explicitly cleared profile values instead of re-seeding them', () => {
    const profile = resolveInstitutionProfile({
      institution: {
        university: '',
        institute: '',
        laboratoryPrefix: 'Laboratorio de',
        professor: '',
        semesterDefault: '2026-B',
      },
    });
    assert.strictEqual(profile.university, '');
    assert.strictEqual(profile.institute, '');
    assert.strictEqual(profile.professor, '');
    assert.strictEqual(profile.semesterDefault, '2026-B');
  });

  it('sanitizes accents and hyphens for official file names', () => {
    assert.strictEqual(sanitizeFileName('Enzimología A-L3'), 'Enzimologia_AL3');
    assert.strictEqual(
      sanitizeFileName('Bioquímica Metabólica A-L1'),
      'Bioquimica_Metabolica_AL1',
    );
    assert.strictEqual(
      buildActaFileName(
        makeGroup({
          name: '👨‍🏫 Enzimología A-L3 · Profesor',
          reporting: { semesterLabel: '2026-B' },
        }),
        { institution: DEFAULT_INSTITUTION_PROFILE },
      ),
      'Acta_Oficial_Enzimologia_AL3_2026B.xlsx',
    );
  });

  it('removes a per-group override when the teacher clears the field', () => {
    const group = makeGroup({
      reporting: { subjectName: 'Nombre viejo', semesterLabel: '2026-B' },
    });
    const updated = updateGroupReporting(group, {
      subjectName: undefined,
      semesterLabel: '2026-C',
    });
    assert.strictEqual(updated.reporting?.subjectName, undefined);
    assert.strictEqual(updated.reporting?.semesterLabel, '2026-C');
  });
});
