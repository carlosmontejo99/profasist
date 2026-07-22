import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { Group } from '../types';

const samplesDir = path.join(process.cwd(), 'export_samples');
if (!fs.existsSync(samplesDir)) {
  fs.mkdirSync(samplesDir, { recursive: true });
}

// 1. Generate Sample XLSX (Asistencia y Parciales)
const sampleGroup: Group = {
  id: 'grp-sample-100',
  name: 'Bioquímica Clínica y Diagnóstico',
  semester: '2026-A',
  scheduleSummary: 'Lun, Mié 08:00 - 10:00',
  color: '#4f46e5',
  archived: false,
  students: Array.from({ length: 60 }, (_, i) => ({
    id: `st-${i + 1}`,
    name: `Alumno ${String(i + 1).padStart(2, '0')} - ${['Álvarez', 'Benítez', 'Castillo', 'Domínguez', 'Escobar', 'Fernández'][i % 6]} ${['González', 'Hernández', 'Ibarra', 'Juárez'][i % 4]}`,
    rollNumber: `2026${String(i + 1).padStart(4, '0')}`
  })),
  sessions: Array.from({ length: 15 }, (_, i) => ({
    id: `sess-${i + 1}`,
    date: `2026-08-${String(i + 1).padStart(2, '0')}`,
    startTime: '08:00',
    endTime: '10:00',
    totalPresent: 55,
    totalStudents: 60,
    attendance: {}
  }))
};

// Populate attendance records
sampleGroup.students.forEach((st, idx) => {
  sampleGroup.sessions.forEach((sess, sIdx) => {
    const status = (idx + sIdx) % 10 === 0 ? 'absent' : (idx + sIdx) % 15 === 0 ? 'late' : 'present';
    sess.attendance[st.id] = { studentId: st.id, status, timestamp: Date.UTC(2026, 7, sIdx + 1, 8, 5) };
  });
});

// Build XLSX sheet
const headers = [
  ['PROFASIST - REGISTRO DE ASISTENCIA Y EVALUACIÓN DE MUESTRA'],
  ['Materia:', sampleGroup.name, 'Ciclo:', sampleGroup.semester],
  ['Total Alumnos:', sampleGroup.students.length, 'Fecha:', new Date().toISOString().split('T')[0]],
  []
];

const tableHeaders = ['Matrícula', 'Nombre Completo', 'Asistencias', 'Retardos', 'Faltas', '% Asistencia', ...sampleGroup.sessions.map(s => s.date)];
const rows = sampleGroup.students.map(st => {
  const p = sampleGroup.sessions.filter(s => s.attendance[st.id]?.status === 'present').length;
  const r = sampleGroup.sessions.filter(s => s.attendance[st.id]?.status === 'late').length;
  const f = sampleGroup.sessions.filter(s => s.attendance[st.id]?.status === 'absent').length;
  const pct = Math.round(((p + r) / sampleGroup.sessions.length) * 100);
  const sessionCols = sampleGroup.sessions.map(s => s.attendance[st.id]?.status === 'present' ? 'P' : s.attendance[st.id]?.status === 'late' ? 'R' : 'F');
  return [st.rollNumber, st.name, p, r, f, pct / 100, ...sessionCols];
});

const ws = XLSX.utils.aoa_to_sheet([...headers, tableHeaders, ...rows]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Asistencia 60 Alumnos');

const xlsxPath = path.join(samplesDir, 'Asistencia_60_Alumnos_Sample.xlsx');
XLSX.writeFile(wb, xlsxPath);

console.log(`✓ Sample XLSX generated at: ${xlsxPath}`);

// 2. Generate Sample JSON Backup
const backupData = {
  schemaVersion: 2,
  appVersion: '3.0.0',
  exportDate: new Date().toISOString(),
  groups: [sampleGroup],
  settings: {
    theme: 'nord',
    audioQuality: '128',
    hapticsEnabled: true,
    audioEnabled: true
  }
};

const backupPath = path.join(samplesDir, 'ProfAsist_Backup_Sample_v3.json');
fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
console.log(`✓ Sample JSON backup generated at: ${backupPath}`);
