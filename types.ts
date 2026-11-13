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

export interface GroupReporting {
  subjectName?: string;      // Clean name for institutional reports (no emoji / "· Profesor")
  laboratoryName?: string;   // e.g. "Laboratorio de Enzimología A-L3"
  semesterLabel?: string;    // e.g. "2026-B"
  professorName?: string;
}

export interface GradeOverride {
  grade: number;
  reason: string;
  at: string; // ISO 8601
  actor: 'docente' | 'agente';
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
  closureConfig?: ClosureConfig; // Institutional closure rules (optional, per group)
  reporting?: GroupReporting; // Per-group overrides for institutional metadata
  finalOverrides?: Record<string, GradeOverride>; // Audited human resolution per student
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

// --- INSTITUTIONAL METADATA & GRADING CONTRACTS (v2) ---

export type GradingFormula = 'simple' | 'weighted';
export type RoundingRule = 'none' | 'round' | 'floor' | 'ceil' | 'mexican';
export type FinalStatus = 'Acreditado' | 'No Acreditado' | 'Pendiente' | 'Sin derecho';

export interface GradeWeights {
  p1: number;
  p2: number;
  p3: number;
}

/**
 * Persisted closure configuration. It is kept per group for backwards
 * compatibility, but the calculation itself lives in services/grading.ts.
 */
export interface ClosureConfig {
  universityName: string;
  formulaType: 'simple' | 'weighted' | 'custom';
  weights: GradeWeights;
  minAttendancePass: boolean;
  attendanceMinRate: number;
  roundingRule: RoundingRule;
  failIfAnyParcialFailed: boolean;
  customFormulaDesc?: string;
  teacherName?: string;
  minPass?: number; // Defaults to 7.0 (UACJ scale)
}

export interface InstitutionProfile {
  university: string;
  institute: string;
  laboratoryPrefix: string;
  professor: string;
  semesterDefault: string;
  email?: string;
  logoDataUrl?: string;
}

export interface GradingPolicy {
  formula: GradingFormula;
  weights: GradeWeights;
  rounding: RoundingRule;
  minPass: number;
  attendanceGate: { enabled: boolean; minRate: number };
  missingPolicy: 'renormalize' | 'zero';
}

export interface CategoryScore {
  value: number | null;
  gradedActivities: number;
  totalActivities: number;
}

export interface ParcialScore {
  value: number | null;
  coverage: number; // 0..1, graded activities / configured activities
  complete: boolean; // every configured category has at least one grade
  gradedWeight: number;
  totalWeight: number;
  categories: Record<string, CategoryScore>;
}

export interface FinalScoreResult {
  p1: number | null;
  p2: number | null;
  p3: number | null;
  final: number | null;
  rawFinal: number | null;
  status: FinalStatus;
  attendancePercentage: number;
  attendanceEligible: boolean;
  reason?: string;
  warnings: string[];
  complete: boolean;
  overridden: boolean;
  overrideReason?: string;
  parciares: {
    p1: ParcialScore;
    p2: ParcialScore;
    p3: ParcialScore;
  };
}

// --- DELIVERY AUDIT (v2) ---

export type DeliveryChannel = 'teams' | 'outlook' | 'whatsapp' | 'presencial' | 'usb' | 'otro';
export type DeliveryStatus = 'pendiente' | 'validada' | 'rechazada' | 'duplicada';

export interface DeliveryRecord {
  id: string;
  groupId: string;
  studentId: string;
  parcialId: 'parcial1' | 'parcial2' | 'parcial3';
  activityId: string;
  channel: DeliveryChannel;
  receivedAt: string; // ISO 8601
  evidenceRef: string;
  evidenceHash?: string;
  status: DeliveryStatus;
  grade?: number;
  note?: string;
  validatedAt?: string;
  actor: 'docente' | 'agente';
}

export interface AuditLogEntry {
  id: string;
  at: string;
  actor: 'docente' | 'agente';
  action: string;
  target: string;
  before?: string;
  after?: string;
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
  institution?: InstitutionProfile;
}

export interface AppData {
  version: number;
  settings: AppSettings;
  groups: Group[];
  deliveries?: DeliveryRecord[];
  auditLog?: AuditLogEntry[];
  syncMeta?: {
    lastPullAt?: string;
    lastPushAt?: string;
    source?: string;
    hash?: string;
  };
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