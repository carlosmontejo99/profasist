import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  Download,
  FileSpreadsheet,
  MapPin,
  RotateCcw,
  Save,
  User,
} from 'lucide-react';
import { AppSettings, Group, GroupReporting, InstitutionProfile } from '../../types';
import {
  DEFAULT_INSTITUTION_PROFILE,
  resolveInstitutionProfile,
  resolveReportMetadata,
} from '../../services/institution';

interface InstitutionSettingsProps {
  settings: AppSettings;
  groups: Group[];
  onSaveProfile: (profile: InstitutionProfile) => void;
  onSaveReporting: (group: Group, reporting: GroupReporting) => void;
  onExportBatch?: (groups: Group[]) => void | Promise<void>;
  isExporting?: boolean;
  onNotification: (message: string) => void;
}

const cleanOptional = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}> = ({ label, value, onChange, placeholder, icon }) => (
  <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1.5">
      {icon} {label}
    </label>
    <input
      className="w-full bg-transparent border-none focus:ring-0 font-bold text-slate-800 dark:text-white p-0 text-xs placeholder:text-slate-400"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  </div>
);

export const InstitutionSettings: React.FC<InstitutionSettingsProps> = ({
  settings,
  groups,
  onSaveProfile,
  onSaveReporting,
  onExportBatch,
  isExporting = false,
  onNotification,
}) => {
  const [profile, setProfile] = useState<InstitutionProfile>(() =>
    resolveInstitutionProfile(settings),
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || '');
  const [reporting, setReporting] = useState<GroupReporting>({});
  const [selectedForExport, setSelectedForExport] = useState<Record<string, boolean>>(
    () => Object.fromEntries(groups.map((group) => [group.id, true])),
  );

  useEffect(() => {
    setProfile(resolveInstitutionProfile(settings));
  }, [settings.institution]);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || groups[0],
    [groups, selectedGroupId],
  );

  useEffect(() => {
    setReporting(selectedGroup?.reporting || {});
  }, [selectedGroup?.id, selectedGroup?.reporting]);

  const previewGroup: Group = selectedGroup || {
    id: 'preview',
    name: 'Enzimología A-L3',
    semester: profile.semesterDefault,
    scheduleSummary: '',
    students: [],
    sessions: [],
    color: '#4f46e5',
    archived: false,
  };

  const preview = resolveReportMetadata(previewGroup, {
    ...settings,
    institution: profile,
  });

  const handleSave = () => {
    onSaveProfile(profile);
    onNotification('Perfil institucional guardado. Los reportes usarán estos datos.');
  };

  const handleSaveReporting = () => {
    if (!selectedGroup) return;
    onSaveReporting(selectedGroup, {
      subjectName: cleanOptional(reporting.subjectName || ''),
      laboratoryName: cleanOptional(reporting.laboratoryName || ''),
      semesterLabel: cleanOptional(reporting.semesterLabel || ''),
      professorName: cleanOptional(reporting.professorName || ''),
    });
    onNotification(`Datos de reporte actualizados para "${selectedGroup.name}".`);
  };

  const selectedGroups = groups.filter((group) => selectedForExport[group.id]);

  return (
    <div className="space-y-6">
      <div className="p-5 bg-gradient-to-br from-indigo-500/10 via-sky-500/10 to-emerald-500/10 border border-indigo-500/20 rounded-[2rem]">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shrink-0">
            <Building2 size={18} />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900 dark:text-white">
              Datos Institucionales del Reporte
            </h3>
            <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 mt-0.5">
              Universidad · Instituto · Laboratorio · Semestre · Profesor
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
              Estos campos alimentan el encabezado de las actas de 4 pestañas.
              Cada materia puede sobrescribirlos sin tocar el perfil global.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field
          label="Universidad"
          value={profile.university}
          onChange={(value) => setProfile({ ...profile, university: value })}
          placeholder="UNIVERSIDAD AUTÓNOMA DE CIUDAD JUÁREZ"
          icon={<Building2 size={12} />}
        />
        <Field
          label="Instituto / Departamento"
          value={profile.institute}
          onChange={(value) => setProfile({ ...profile, institute: value })}
          placeholder="DCQB"
          icon={<MapPin size={12} />}
        />
        <Field
          label="Prefijo de laboratorio"
          value={profile.laboratoryPrefix}
          onChange={(value) => setProfile({ ...profile, laboratoryPrefix: value })}
          placeholder="Laboratorio de"
          icon={<FileSpreadsheet size={12} />}
        />
        <Field
          label="Semestre por defecto"
          value={profile.semesterDefault}
          onChange={(value) => setProfile({ ...profile, semesterDefault: value })}
          placeholder="2026-B"
        />
        <Field
          label="Profesor"
          value={profile.professor}
          onChange={(value) => setProfile({ ...profile, professor: value })}
          placeholder="Nombre completo"
          icon={<User size={12} />}
        />
        <Field
          label="Correo institucional (opcional)"
          value={profile.email || ''}
          onChange={(value) => setProfile({ ...profile, email: value })}
          placeholder="docente@universidad.edu.mx"
        />
      </div>

      <div className="rounded-[2rem] border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-3 bg-slate-100 dark:bg-slate-800 flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Vista previa del encabezado
          </span>
          <span className="text-[9px] font-mono text-slate-400">
            {preview.semesterLabel || 'sin semestre'}
          </span>
        </div>
        <div className="p-5 bg-white dark:bg-slate-900 space-y-2">
          <p className="text-sm font-black text-[#1E3A8A] dark:text-indigo-300 uppercase tracking-tight">
            {preview.headerLine1 || 'UNIVERSIDAD · INSTITUTO'}
          </p>
          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            {preview.headerLine2 || 'Laboratorio · Semestre · Profesor'}
          </p>
          <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-[9px] font-black uppercase tracking-wider text-slate-400">
            <span>No. · Matrícula</span>
            <span>Nombre del Alumno</span>
            <span className="text-right">P1 · P2 · P3 · Final · Estatus</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={handleSave}
          className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Save size={15} /> Guardar perfil institucional
        </button>
        <button
          onClick={() => {
            setProfile({ ...DEFAULT_INSTITUTION_PROFILE });
            onNotification('Valores oficiales restaurados. Pulsa Guardar para aplicarlos.');
          }}
          className="py-3.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
        >
          <RotateCcw size={15} /> Oficiales
        </button>
      </div>

      <div className="p-5 bg-slate-50 dark:bg-slate-850 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-4">
        <div>
          <h4 className="font-black text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Sobrescritura por materia
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Déjalo vacío para heredar el perfil global. Útil cuando el nombre de la
            materia incluye emoji o el semestre real difiere del ciclo de la app.
          </p>
        </div>

        {groups.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No hay materias registradas.</p>
        ) : (
          <>
            <select
              value={selectedGroup?.id || ''}
              onChange={(event) => setSelectedGroupId(event.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white"
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} · {group.semester}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="Nombre para acta"
                value={reporting.subjectName || ''}
                onChange={(value) => setReporting({ ...reporting, subjectName: value })}
                placeholder={selectedGroup ? resolveReportMetadata(selectedGroup, settings).subjectName : 'Enzimología A-L3'}
              />
              <Field
                label="Laboratorio completo"
                value={reporting.laboratoryName || ''}
                onChange={(value) => setReporting({ ...reporting, laboratoryName: value })}
                placeholder={selectedGroup ? resolveReportMetadata(selectedGroup, settings).laboratoryName : 'Laboratorio de Enzimología A-L3'}
              />
              <Field
                label="Semestre del acta"
                value={reporting.semesterLabel || ''}
                onChange={(value) => setReporting({ ...reporting, semesterLabel: value })}
                placeholder={selectedGroup?.semester || profile.semesterDefault}
              />
              <Field
                label="Profesor del acta"
                value={reporting.professorName || ''}
                onChange={(value) => setReporting({ ...reporting, professorName: value })}
                placeholder={profile.professor}
              />
            </div>

            <button
              onClick={handleSaveReporting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Check size={15} /> Guardar datos de esta materia
            </button>

            <p className="text-[10px] text-slate-400 font-mono">
              Archivo esperado: {selectedGroup ? resolveReportMetadata(selectedGroup, { ...settings, institution: profile }).laboratoryName : '—'} ·{' '}
              {selectedGroup ? resolveReportMetadata(selectedGroup, { ...settings, institution: profile }).semesterLabel : '—'}
            </p>
          </>
        )}
      </div>

      {onExportBatch && groups.length > 0 && (
        <div className="p-5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-[2rem] border border-emerald-200/60 dark:border-emerald-900/40 space-y-3">
          <div className="flex items-start gap-2">
            <FileSpreadsheet size={16} className="text-emerald-600 mt-0.5" />
            <div>
              <h4 className="font-black text-xs uppercase tracking-widest text-emerald-800 dark:text-emerald-300">
                Actas del semestre
              </h4>
              <p className="text-[11px] text-emerald-900/70 dark:text-emerald-200/70 mt-0.5">
                Genera un libro de 4 pestañas por materia seleccionada.
              </p>
            </div>
          </div>

          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {groups.map((group) => (
              <label
                key={group.id}
                className="flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-900/60 rounded-lg px-2.5 py-1.5"
              >
                <input
                  type="checkbox"
                  checked={selectedForExport[group.id] !== false}
                  onChange={(event) =>
                    setSelectedForExport((previous) => ({
                      ...previous,
                      [group.id]: event.target.checked,
                    }))
                  }
                />
                <span className="truncate">{group.name}</span>
                <span className="ml-auto text-[9px] font-mono text-slate-400">
                  {group.semester}
                </span>
              </label>
            ))}
          </div>

          <button
            disabled={isExporting || selectedGroups.length === 0}
            onClick={() => onExportBatch(selectedGroups)}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-2xl font-black text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Download size={15} />
            {isExporting
              ? 'Generando actas...'
              : `Exportar ${selectedGroups.length} acta${selectedGroups.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
    </div>
  );
};
