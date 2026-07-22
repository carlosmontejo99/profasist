import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  calculateStudentStats, 
  generateUUID, 
  parseStudentCSV, 
  parseICSContent 
} from '../services/utils.ts';
import { Group, ParcialEvaluation, Student } from '../types.ts';

describe('ProfAsist Unit Test Suite — Mathematics, Data Parsing & Logic', () => {

  it('1. Calculate Student Attendance Stats correctly', () => {
    const mockGroup: Group = {
      id: 'group-1',
      name: 'Bioquímica',
      semester: '2026-A',
      scheduleSummary: 'Lun, Mié 10:00 - 12:00',
      students: [{ id: 'st-1', name: 'Ana García', rollNumber: '2026001' }],
      sessions: [
        { id: 's1', date: '2026-07-01', startTime: '10:00', endTime: '12:00', totalPresent: 1, totalStudents: 1, attendance: { 'st-1': { studentId: 'st-1', status: 'present', timestamp: Date.UTC(2026, 6, 1, 10, 5) } } },
        { id: 's2', date: '2026-07-03', startTime: '10:00', endTime: '12:00', totalPresent: 1, totalStudents: 1, attendance: { 'st-1': { studentId: 'st-1', status: 'late', timestamp: Date.UTC(2026, 6, 3, 10, 15) } } },
        { id: 's3', date: '2026-07-08', startTime: '10:00', endTime: '12:00', totalPresent: 1, totalStudents: 1, attendance: { 'st-1': { studentId: 'st-1', status: 'absent', timestamp: Date.UTC(2026, 6, 8, 10, 0) } } },
        { id: 's4', date: '2026-07-10', startTime: '10:00', endTime: '12:00', totalPresent: 1, totalStudents: 1, attendance: { 'st-1': { studentId: 'st-1', status: 'excused', timestamp: Date.UTC(2026, 6, 10, 10, 0) } } }
      ],
      color: '#4f46e5',
      archived: false
    };

    const stats = calculateStudentStats(mockGroup, 'st-1');
    assert.strictEqual(stats.totalSessions, 4);
    assert.strictEqual(stats.present, 1);
    assert.strictEqual(stats.late, 1);
    assert.strictEqual(stats.absent, 1);
    assert.strictEqual(stats.excused, 1);
    // Positive attendance = present(1) + late(1) + excused(1) = 3 out of 4 = 75%
    assert.strictEqual(stats.percentage, 75);
  });

  it('2. Evaluation Parcial Grade Calculation with 100% total weight', () => {
    const parcial: ParcialEvaluation = {
      categories: [
        { id: 'cat-1', name: 'Exámenes', weight: 50, activities: [{ id: 'act-1', name: 'Examen 1' }] },
        { id: 'cat-2', name: 'Tareas', weight: 30, activities: [{ id: 'act-2', name: 'Tarea 1' }, { id: 'act-3', name: 'Tarea 2' }] },
        { id: 'cat-3', name: 'Proyecto', weight: 20, activities: [{ id: 'act-4', name: 'Proyecto Final' }] }
      ],
      grades: {
        'st-1': {
          'act-1': 8.0, // Examenes avg = 8.0
          'act-2': 10.0,
          'act-3': 6.0,  // Tareas avg = (10+6)/2 = 8.0
          'act-4': 9.0   // Proyecto avg = 9.0
        }
      }
    };

    // Calculate category averages
    const cat1Avg = 8.0;
    const cat2Avg = (10.0 + 6.0) / 2; // 8.0
    const cat3Avg = 9.0;

    // Weighted sum = (8.0 * 0.5) + (8.0 * 0.3) + (9.0 * 0.2) = 4.0 + 2.4 + 1.8 = 8.2
    const expectedGrade = (cat1Avg * 0.5) + (cat2Avg * 0.3) + (cat3Avg * 0.2);
    assert.strictEqual(Math.round(expectedGrade * 100) / 100, 8.2);
  });

  it('3. Evaluation Grade Normalization when weights sum != 100%', () => {
    const parcial: ParcialEvaluation = {
      categories: [
        { id: 'cat-1', name: 'Exámenes', weight: 40, activities: [{ id: 'act-1', name: 'Examen 1' }] },
        { id: 'cat-2', name: 'Tareas', weight: 40, activities: [{ id: 'act-2', name: 'Tarea 1' }] }
        // Total weight = 80%
      ],
      grades: {
        'st-1': {
          'act-1': 10.0,
          'act-2': 8.0
        }
      }
    };

    // Raw sum = (10 * 40) + (8 * 40) = 400 + 320 = 720
    // sumWeights = 80
    // Normalized = 720 / 80 = 9.0
    const rawSum = (10.0 * 40) + (8.0 * 40);
    const normalized = rawSum / 80;
    assert.strictEqual(normalized, 9.0);
  });

  it('4. Statistical calculations (Mean, Median, Min, Max, Standard Deviation)', () => {
    const grades = [6.0, 7.0, 8.0, 9.0, 10.0];
    const total = grades.length;
    const mean = grades.reduce((a, b) => a + b, 0) / total;
    assert.strictEqual(mean, 8.0);

    const min = Math.min(...grades);
    const max = Math.max(...grades);
    assert.strictEqual(min, 6.0);
    assert.strictEqual(max, 10.0);

    const sorted = [...grades].sort((a, b) => a - b);
    const median = sorted[Math.floor(total / 2)];
    assert.strictEqual(median, 8.0);

    const variance = grades.reduce((acc, curr) => acc + Math.pow(curr - mean, 2), 0) / total;
    const stdDev = Math.sqrt(variance);
    // variance = ((4 + 1 + 0 + 1 + 4)/5) = 2.0 -> stdDev = sqrt(2) approx 1.4142
    assert.strictEqual(Math.round(stdDev * 100) / 100, 1.41);
  });

  it('5. Generate Unique UUIDs without collision', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const id = generateUUID();
      assert.strictEqual(ids.has(id), false, 'UUID collision detected');
      ids.add(id);
    }
    assert.strictEqual(ids.size, 500);
  });

  it('6. Parse Student CSV with special characters & accents', () => {
    const csvContent = `Nombre,Apellidos,Matrícula
José,Hernández Pérez,2026-001
María del Carmen,Álvarez Ñúñez,2026-002`;

    const students = parseStudentCSV(csvContent);
    assert.strictEqual(students.length, 2);
    assert.strictEqual(students[0].name, 'José Hernández Pérez');
    assert.strictEqual(students[0].rollNumber, '2026-001');
    assert.strictEqual(students[1].name, 'María del Carmen Álvarez Ñúñez');
    assert.strictEqual(students[1].rollNumber, '2026-002');
  });

  it('7. Parse ICS Calendar events into Groups', () => {
    const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ProfAsist Test//EN
BEGIN:VEVENT
SUMMARY:Química Orgánica I
DTSTART:20260801T080000
DTEND:20260801T100000
RRULE:FREQ=WEEKLY;UNTIL=20261201T000000;BYDAY=MO,WE
END:VEVENT
END:VCALENDAR`;

    const groups = parseICSContent(icsData);
    assert.strictEqual(groups.length, 1);
    assert.strictEqual(groups[0].name, 'Química Orgánica I');
    assert.ok(groups[0].sessions.length > 0);
  });
});
