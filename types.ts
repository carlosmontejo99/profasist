export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface Student {
  id: string;
  name: string;
  rollNumber?: string;
  email?: string;
  phone?: string;    // Direct WhatsApp phone number
  tag?: string;      // Custom Badge (e.g. 'Apoyo Especial', 'Becado', 'Excelencia')
  birthday?: string; // Birthday (MM-DD)
}

export interface AttendanceRecord {
  studentId: string;
  status: AttendanceStatus;
  timestamp: number;
}

export interface AudioRecording {
  id: string;
  fileName: string; // e.g. "Clase_Matemáticas_2024-05-20.m4a"
  path: string;     // Internal URI or Path
  durationMinutes: number;
  createdAt: number;
}

export interface Session {
  id: string;
  date: string; // ISO Date String YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  topic?: string; // Optional lesson topic
  attendance: Record<string, AttendanceRecord>; // Map studentId -> Record
  totalPresent: number;
  totalStudents: number;
  recordings?: AudioRecording[]; // New field for audio
}

export interface Group {
  id: string;
  name: string; // Subject Name
  semester: string; // e.g. "2024-A"
  scheduleSummary: string; // e.g., "Mon, Wed 10:00"
  students: Student[];
  sessions: Session[];
  color: string;
  archived: boolean; // Soft delete for old semesters
  evaluations?: GroupEvaluations; // Optional evaluation system
}

export interface Activity {
  id: string;
  name: string;
}

export interface EvaluationCategory {
  id: string;
  name: string;
  weight: number; // percentage, e.g., 20
  activities: Activity[];
}

export interface ParcialEvaluation {
  categories: EvaluationCategory[];
  // studentId -> activityId -> grade value (0-10)
  grades: Record<string, Record<string, number>>;
}

export interface GroupEvaluations {
  parcial1: ParcialEvaluation;
  parcial2: ParcialEvaluation;
  parcial3: ParcialEvaluation;
}

export type AppTheme = 'light' | 'dark' | 'solarized-dark' | 'solarized-light' | 'emerald' | 'nord';

export interface AppSettings {
  currentSemester?: string;
  teacherName?: string;
  darkMode?: boolean;
  theme?: AppTheme;
  gdriveClientId?: string;
  gdriveLastBackup?: string;
  gdriveAutoBackup?: boolean;
  biometricsEnabled?: boolean;
  biometricsPin?: string;
  soundEnabled?: boolean;
  hapticsEnabled?: boolean;
}

export interface AppData {
  version: number;
  settings: AppSettings;
  groups: Group[];
}

export interface BackupFile {
  version: "1.0";
  createdAt: string; // ISO date
  app: "AsistenciaDocente";
  data: AppData;
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  GROUP_DETAIL = 'GROUP_DETAIL',
  SESSION_ATTENDANCE = 'SESSION_ATTENDANCE',
  IMPORT_ICS = 'IMPORT_ICS'
}