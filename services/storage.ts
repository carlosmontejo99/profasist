
import { AppData, Group, Student, Session, AttendanceRecord, AppSettings, BackupFile, ViewState, AudioRecording, InstitutionProfile } from '../types';
import { buildInstitutionProfile } from './institution';

const STORAGE_KEY = 'profasist_v1_data';
const UI_STATE_KEY = 'profasist_v1_ui_state';
export const APP_DATA_VERSION = 2;

// Calculate default semester dynamically based on today's date
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth(); // 0-11
const semesterSuffix = currentMonth <= 6 ? 'A' : 'B'; // Jan-Jul = A, Aug-Dec = B
const defaultSemester = `${currentYear}-${semesterSuffix}`;

export const getDemoGroup = (): Group => {
  const students: Student[] = Array.from({ length: 14 }, (_, index) => ({
    id: `demo_student_${index + 1}`,
    name: `Alumno de ejemplo ${String(index + 1).padStart(2, '0')}`,
    rollNumber: `DEMO${String(index + 1).padStart(4, '0')}`
  }));

  const todayStr = new Date().toISOString().split('T')[0];

  const session1: Session = {
    id: 'sess_1',
    date: '2026-07-20',
    startTime: '10:00',
    endTime: '12:00',
    topic: 'Sobreexpresión de enzimas y purificación',
    attendance: {
      'st_1': { studentId: 'st_1', status: 'present', timestamp: Date.now() },
      'st_2': { studentId: 'st_2', status: 'present', timestamp: Date.now() },
      'st_3': { studentId: 'st_3', status: 'present', timestamp: Date.now() },
      'st_4': { studentId: 'st_4', status: 'present', timestamp: Date.now() },
      'st_5': { studentId: 'st_5', status: 'present', timestamp: Date.now() },
      'st_6': { studentId: 'st_6', status: 'late', timestamp: Date.now() },
      'st_7': { studentId: 'st_7', status: 'present', timestamp: Date.now() },
      'st_8': { studentId: 'st_8', status: 'present', timestamp: Date.now() },
      'st_9': { studentId: 'st_9', status: 'absent', timestamp: Date.now() },
      'st_10': { studentId: 'st_10', status: 'present', timestamp: Date.now() },
      'st_11': { studentId: 'st_11', status: 'present', timestamp: Date.now() },
      'st_12': { studentId: 'st_12', status: 'present', timestamp: Date.now() },
      'st_13': { studentId: 'st_13', status: 'excused', timestamp: Date.now() },
      'st_14': { studentId: 'st_14', status: 'present', timestamp: Date.now() }
    },
    totalPresent: 12,
    totalStudents: 14
  };

  const session2: Session = {
    id: 'sess_2',
    date: todayStr,
    startTime: '10:00',
    endTime: '12:00',
    topic: 'Análisis espectrofotométrico',
    attendance: {
      'st_1': { studentId: 'st_1', status: 'present', timestamp: Date.now() },
      'st_2': { studentId: 'st_2', status: 'present', timestamp: Date.now() },
      'st_3': { studentId: 'st_3', status: 'present', timestamp: Date.now() },
      'st_4': { studentId: 'st_4', status: 'present', timestamp: Date.now() },
      'st_5': { studentId: 'st_5', status: 'present', timestamp: Date.now() },
      'st_6': { studentId: 'st_6', status: 'present', timestamp: Date.now() },
      'st_7': { studentId: 'st_7', status: 'present', timestamp: Date.now() },
      'st_8': { studentId: 'st_8', status: 'present', timestamp: Date.now() },
      'st_9': { studentId: 'st_9', status: 'present', timestamp: Date.now() },
      'st_10': { studentId: 'st_10', status: 'present', timestamp: Date.now() },
      'st_11': { studentId: 'st_11', status: 'present', timestamp: Date.now() },
      'st_12': { studentId: 'st_12', status: 'present', timestamp: Date.now() },
      'st_13': { studentId: 'st_13', status: 'present', timestamp: Date.now() },
      'st_14': { studentId: 'st_14', status: 'present', timestamp: Date.now() }
    },
    totalPresent: 14,
    totalStudents: 14
  };

  return {
    id: 'group_demo_bioquimica',
    name: 'Materia de ejemplo',
    semester: defaultSemester,
    scheduleSummary: 'Lun, Mié 10:00 - 12:00',
    students,
    sessions: [session1, session2],
    color: '#4f46e5',
    archived: false
  };
};

export const buildDefaultInstitution = (settings: AppSettings = {}): InstitutionProfile =>
  buildInstitutionProfile(settings);

const initialData: AppData = {
  version: APP_DATA_VERSION,
  settings: {
    currentSemester: defaultSemester,
    teacherName: '',
    institution: buildDefaultInstitution({
      currentSemester: defaultSemester,
      teacherName: '',
    }),
  },
  groups: [],
};

const migrateGroup = (raw: any): Group => {
  const group = (raw || {}) as Group;
  if (!Array.isArray(group.students)) group.students = [];
  if (!Array.isArray(group.sessions)) group.sessions = [];
  if (typeof group.archived === 'undefined') group.archived = false;
  if (!group.color) group.color = '#4f46e5';
  if (!group.scheduleSummary) group.scheduleSummary = '';
  if (typeof group.name !== 'string') group.name = '';
  if (typeof group.semester !== 'string' || !group.semester) {
    group.semester = defaultSemester;
  }
  return group;
};

/**
 * Pure, idempotent migration from the v1 payload to AppData v2.
 * It never deletes groups, students, sessions, evaluations or closure config.
 */
export const migrateData = (input: unknown): { data: AppData; changed: boolean } => {
  let changed = false;

  if (!input || typeof input !== 'object') {
    return { data: { ...initialData, groups: [] }, changed: true };
  }

  const parsed = input as AppData;

  if (!Array.isArray(parsed.groups)) {
    parsed.groups = [];
    changed = true;
  }

  if (!parsed.settings || typeof parsed.settings !== 'object') {
    parsed.settings = {};
    changed = true;
  }

  if (typeof parsed.version !== 'number') {
    parsed.version = 1;
    changed = true;
  }

  const normalizedInstitution = buildDefaultInstitution(parsed.settings);
  if (
    !parsed.settings.institution ||
    JSON.stringify(normalizedInstitution) !== JSON.stringify(parsed.settings.institution)
  ) {
    parsed.settings.institution = normalizedInstitution;
    changed = true;
  }

  if (!parsed.settings.currentSemester) {
    parsed.settings.currentSemester = parsed.settings.institution.semesterDefault || defaultSemester;
    changed = true;
  }

  parsed.groups = parsed.groups.map(migrateGroup);

  if (parsed.version !== APP_DATA_VERSION) {
    parsed.version = APP_DATA_VERSION;
    changed = true;
  }

  return { data: parsed, changed };
};

export const loadData = (): AppData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh: AppData = JSON.parse(JSON.stringify(initialData));
      saveData(fresh);
      return fresh;
    }

    const parsed = JSON.parse(raw);
    const { data, changed } = migrateData(parsed);

    if (changed) saveData(data);

    return data;
  } catch (e) {
    console.error("Failed to load data", e);
    return initialData;
  }
};

const saveData = (data: AppData): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save data", e);
  }
};

// --- BACKUP & RESTORE SYSTEM ---

export const createBackupPayload = (): BackupFile => {
  const currentData = loadData();
  return {
    version: "1.0",
    createdAt: new Date().toISOString(),
    app: "AsistenciaDocente",
    data: currentData
  };
};

export const restoreFromBackup = (jsonContent: string): { success: boolean, message: string } => {
  try {
    const backup: any = JSON.parse(jsonContent);

    // 1. Validate Structure
    if (!backup || typeof backup !== 'object') {
      return { success: false, message: "El archivo no es un JSON válido." };
    }

    // 2. Validate App Identifier
    if (backup.app !== "AsistenciaDocente") {
      return { success: false, message: "Este archivo no pertenece a la app 'AsistenciaDocente'." };
    }

    // 3. Validate Data Presence
    if (!backup.data || !Array.isArray(backup.data.groups)) {
      return { success: false, message: "El archivo de respaldo está corrupto o incompleto." };
    }

    // 4. Perform Restore
    saveData(backup.data as AppData);
    
    return { success: true, message: "Datos restaurados correctamente." };

  } catch (e) {
    console.error(e);
    return { success: false, message: "Error al leer el archivo. Verifica el formato." };
  }
};

export const mergeFromBackup = (jsonContent: string): { success: boolean, message: string, addedCount: number, updatedCount: number } => {
  try {
    const backup: any = JSON.parse(jsonContent);

    // 1. Validate Structure
    if (!backup || typeof backup !== 'object') {
      return { success: false, message: "El archivo no es un JSON válido.", addedCount: 0, updatedCount: 0 };
    }

    // 2. Validate App Identifier
    if (backup.app !== "AsistenciaDocente") {
      return { success: false, message: "Este archivo no pertenece a la app 'AsistenciaDocente'.", addedCount: 0, updatedCount: 0 };
    }

    // 3. Validate Data Presence
    if (!backup.data || !Array.isArray(backup.data.groups)) {
      return { success: false, message: "El archivo de respaldo está corrupto o incompleto.", addedCount: 0, updatedCount: 0 };
    }

    const localData = loadData();
    let addedCount = 0;
    let updatedCount = 0;

    backup.data.groups.forEach((backupGroup: Group) => {
      const localGroupIndex = localData.groups.findIndex(g => g.id === backupGroup.id);

      if (localGroupIndex === -1) {
        // No existe localmente: Añadir directamente
        localData.groups.push(backupGroup);
        addedCount++;
      } else {
        // Ya existe el ID localmente. ¿Pertenece a otro semestre o tiene datos distintos?
        const localGroup = localData.groups[localGroupIndex];
        
        // Si tienen diferente semestre pero mismo ID (por alguna inconsistencia extraña), le generamos un nuevo ID para que no colisionen
        if (localGroup.semester !== backupGroup.semester) {
          const newGroup: Group = {
            ...backupGroup,
            id: `${backupGroup.id}_restored_${Date.now()}`,
            name: `${backupGroup.name} (Copia Semestre ${backupGroup.semester})`
          };
          localData.groups.push(newGroup);
          addedCount++;
        } else {
          // Mismo semestre, mismo ID. Evaluamos cuál tiene datos más completos (mayor número de sesiones de asistencia)
          const localSessionsCount = localGroup.sessions?.length || 0;
          const backupSessionsCount = backupGroup.sessions?.length || 0;
          
          if (backupSessionsCount > localSessionsCount) {
            // El respaldo es más completo: lo actualizamos
            localData.groups[localGroupIndex] = backupGroup;
            updatedCount++;
          }
          // Si el local es más completo o igual, lo dejamos intacto para evitar sobrescribir progreso más reciente
        }
      }
    });

    // Conservamos las configuraciones locales pero actualizamos si faltan claves
    if (backup.data.settings) {
      localData.settings = {
        ...backup.data.settings,
        ...localData.settings // Priorizar settings locales actuales
      };
    }

    saveData(localData);
    return { 
      success: true, 
      message: `Fusión completada: se añadieron ${addedCount} clases nuevas y se actualizaron ${updatedCount} con datos más recientes.`,
      addedCount,
      updatedCount
    };

  } catch (e) {
    console.error(e);
    return { success: false, message: "Error al fusionar el archivo de respaldo.", addedCount: 0, updatedCount: 0 };
  }
};

// --- SETTINGS / SEMESTER MANAGEMENT ---

export const updateSettings = (settings: Partial<AppSettings>): void => {
  const data = loadData();
  data.settings = { ...data.settings, ...settings };
  saveData(data);
};

export const getSemesters = (): string[] => {
  const data = loadData();
  const semesters = new Set<string>();
  data.groups.forEach(g => semesters.add(g.semester));
  return Array.from(semesters).sort().reverse();
};

export const createSemester = (semesterName: string): void => {
  updateSettings({ currentSemester: semesterName });
};

// --- GROUP MANAGEMENT ---

export const saveGroup = (group: Group): void => {
  const data = loadData();
  const index = data.groups.findIndex(g => g.id === group.id);
  
  // ASEGURAR ORDEN ALFABÉTICO (A-Z) SIEMPRE AL GUARDAR
  if (group.students && group.students.length > 0) {
    group.students.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  }

  // Update totalStudents across all sessions in group
  if (group.sessions && group.sessions.length > 0) {
    group.sessions.forEach(s => {
      s.totalStudents = group.students.length;
    });
  }

  if (index >= 0) {
    data.groups[index] = group;
  } else {
    data.groups.push(group);
  }
  saveData(data);
};

export const deleteGroup = (groupId: string): void => {
  const data = loadData();
  data.groups = data.groups.filter(g => g.id !== groupId);
  saveData(data);
};

export const getGroupsBySemester = (semester: string): Group[] => {
  const data = loadData();
  return data.groups.filter(g => g.semester === semester && !g.archived);
};

// --- STUDENT MANAGEMENT ---

export const addStudentToGroup = (groupId: string, student: Student): void => {
  const data = loadData();
  const group = data.groups.find(g => g.id === groupId);
  if (!group) return;

  group.students.push(student);
  
  // Sort alphabetically by name (es)
  group.students.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  
  saveData(data);
};

export const updateStudentInGroup = (groupId: string, updatedStudent: Student): void => {
  const data = loadData();
  const group = data.groups.find(g => g.id === groupId);
  if (!group) return;

  const index = group.students.findIndex(s => s.id === updatedStudent.id);
  if (index !== -1) {
    group.students[index] = updatedStudent;
    // Re-sort alphabetically
    group.students.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    saveData(data);
  }
};

export const removeStudentFromGroup = (groupId: string, studentId: string): void => {
  const data = loadData();
  const group = data.groups.find(g => g.id === groupId);
  if (!group) return;

  group.students = group.students.filter(s => s.id !== studentId);
  
  group.sessions.forEach(session => {
    if (session.attendance[studentId]) {
      delete session.attendance[studentId];
      const presentCount = Object.values(session.attendance).filter(r => r.status === 'present' || r.status === 'late').length;
      session.totalPresent = presentCount;
    }
  });

  saveData(data);
};

// --- ATTENDANCE MANAGEMENT ---

export const saveSessionAttendance = (
  groupId: string, 
  sessionId: string, 
  attendanceMap: Record<string, AttendanceRecord>
): void => {
  const data = loadData();
  const group = data.groups.find(g => g.id === groupId);
  if (!group) return;

  const session = group.sessions.find(s => s.id === sessionId);
  if (!session) return;

  session.attendance = attendanceMap;
  
  const presentCount = Object.values(attendanceMap).filter(r => r.status === 'present' || r.status === 'late').length;
  session.totalPresent = presentCount;
  session.totalStudents = group.students.length;

  saveData(data);
};

// --- RECORDING MANAGEMENT ---

export const addSessionRecording = (
    groupId: string,
    sessionId: string,
    recording: AudioRecording
): void => {
    const data = loadData();
    const group = data.groups.find(g => g.id === groupId);
    if (!group) return;

    const session = group.sessions.find(s => s.id === sessionId);
    if (!session) return;

    if (!session.recordings) {
        session.recordings = [];
    }
    
    session.recordings.push(recording);
    saveData(data);
};
