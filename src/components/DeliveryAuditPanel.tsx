import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Inbox,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { DeliveryChannel, DeliveryRecord, DeliveryStatus, Group } from '../../types';
import * as Storage from '../../services/storage';
import * as Utils from '../../services/utils';
import { generateUUID } from '../../services/utils';
import {
  applyDeliveryGrade,
  DeliveryDraft,
  DeliveryImportResult,
  DELIVERY_CHANNELS,
  DELIVERY_STATUSES,
  draftToRecord,
  findDuplicateDelivery,
  getDeliveryCoverage,
  parseDeliveryImport,
  ParcialId,
  validateDeliveryDraft,
} from '../../services/deliveries';

interface DeliveryAuditPanelProps {
  group: Group;
  onSaveGroup: (group: Group) => void;
  onNotification: (message: string) => void;
}

const PARCIAL_LABELS: Record<ParcialId, string> = {
  parcial1: 'Parcial 1',
  parcial2: 'Parcial 2',
  parcial3: 'Parcial 3',
};

const channelLabel = (channel: DeliveryChannel): string =>
  DELIVERY_CHANNELS.find((item) => item.id === channel)?.label || channel;

const statusLabel = (status: DeliveryStatus): string =>
  DELIVERY_STATUSES.find((item) => item.id === status)?.label || status;

const statusClasses = (status: DeliveryStatus): string => {
  switch (status) {
    case 'validada':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900';
    case 'rechazada':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900';
    case 'duplicada':
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    case 'pendiente':
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900';
  }
};

const todayInput = (): string => new Date().toISOString().slice(0, 10);

const dateInputToIso = (value: string): string => {
  const date = new Date(`${value || todayInput()}T12:00:00`);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const emptyDraft = (group: Group): DeliveryDraft => ({
  groupId: group.id,
  studentId: group.students[0]?.id || '',
  parcialId: 'parcial1',
  activityId: '',
  channel: 'teams',
  receivedAt: dateInputToIso(todayInput()),
  evidenceRef: '',
  status: 'pendiente',
  actor: 'docente',
});

const auditEntry = (
  action: string,
  target: string,
  before?: string,
  after?: string,
) => ({
  id: generateUUID(),
  at: new Date().toISOString(),
  actor: 'docente' as const,
  action,
  target,
  before,
  after,
});

export const DeliveryAuditPanel: React.FC<DeliveryAuditPanelProps> = ({
  group,
  onSaveGroup,
  onNotification,
}) => {
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>(() =>
    Storage.getDeliveries(group.id),
  );
  const [activeParcial, setActiveParcial] = useState<ParcialId>('parcial1');
  const [statusFilter, setStatusFilter] = useState<'todas' | DeliveryStatus>('todas');
  const [activityFilter, setActivityFilter] = useState<string>('todas');
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [form, setForm] = useState<DeliveryDraft>(() => emptyDraft(group));
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importResult, setImportResult] = useState<DeliveryImportResult | null>(null);
  const [showGaps, setShowGaps] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    tone: 'primary' | 'danger';
    onConfirm: () => void;
  } | null>(null);
  const [rejectRecord, setRejectRecord] = useState<DeliveryRecord | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const refresh = () => setDeliveries(Storage.getDeliveries(group.id));

  useEffect(() => {
    setDeliveries(Storage.getDeliveries(group.id));
  }, [group.id]);

  const activities = useMemo(
    () =>
      (group.evaluations?.[activeParcial]?.categories || []).flatMap((category) =>
        category.activities.map((activity) => ({
          ...activity,
          categoryName: category.name,
        })),
      ),
    [group.evaluations, activeParcial],
  );

  const allActivityOptions = useMemo(
    () =>
      (['parcial1', 'parcial2', 'parcial3'] as ParcialId[]).flatMap((parcialId) =>
        (group.evaluations?.[parcialId]?.categories || []).flatMap((category) =>
          category.activities.map((activity) => ({
            value: `${parcialId}:${activity.id}`,
            label: `${PARCIAL_LABELS[parcialId]} · ${category.name} · ${activity.name}`,
            parcialId,
            activityId: activity.id,
            activityName: activity.name,
          })),
        ),
      ),
    [group.evaluations],
  );

  const studentById = useMemo(
    () => new Map(group.students.map((student) => [student.id, student])),
    [group.students],
  );

  const coverage = useMemo(
    () => getDeliveryCoverage(group, deliveries, activeParcial),
    [group, deliveries, activeParcial],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return deliveries
      .filter((record) => record.parcialId === activeParcial)
      .filter((record) => statusFilter === 'todas' || record.status === statusFilter)
      .filter((record) => activityFilter === 'todas' || record.activityId === activityFilter)
      .filter((record) => {
        if (!query) return true;
        const student = studentById.get(record.studentId);
        const activity = activities.find((item) => item.id === record.activityId);
        return [student?.name, activity?.name, record.evidenceRef, record.channel]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  }, [
    deliveries,
    activeParcial,
    statusFilter,
    activityFilter,
    search,
    studentById,
    activities,
  ]);

  const openNewForm = (prefill?: { studentId?: string; activityId?: string; parcialId?: ParcialId }) => {
    setEditingId(undefined);
    setForm({
      ...emptyDraft(group),
      studentId: prefill?.studentId || group.students[0]?.id || '',
      parcialId: prefill?.parcialId || activeParcial,
      activityId: prefill?.activityId || '',
    });
    setIsFormOpen(true);
  };

  const openEditForm = (record: DeliveryRecord) => {
    setEditingId(record.id);
    setForm({
      groupId: group.id,
      studentId: record.studentId,
      parcialId: record.parcialId,
      activityId: record.activityId,
      channel: record.channel,
      receivedAt: record.receivedAt,
      evidenceRef: record.evidenceRef,
      status: record.status,
      grade: record.grade,
      note: record.note,
      actor: record.actor,
    });
    setIsFormOpen(true);
  };

  const handleSaveForm = () => {
    const errors = validateDeliveryDraft(form, group);
    if (errors.length > 0) {
      onNotification(errors.join(' '));
      return;
    }

    const candidate = draftToRecord(form, editingId);
    const duplicate = findDuplicateDelivery(
      candidate,
      deliveries.filter((record) => record.id !== editingId),
    );
    if (duplicate) {
      onNotification(
        `Entrega duplicada: ya existe "${duplicate.evidenceRef}" para ese alumno y actividad.`,
      );
      return;
    }

    Storage.saveDelivery(candidate);
    Storage.appendAuditLog(
      auditEntry(
        editingId ? 'editar_entrega' : 'registrar_entrega',
        `${studentById.get(candidate.studentId)?.name || candidate.studentId} · ${candidate.evidenceRef}`,
        editingId ? 'registro previo' : undefined,
        candidate.status,
      ),
    );
    refresh();
    setIsFormOpen(false);
    onNotification(
      editingId ? 'Entrega actualizada.' : 'Entrega registrada en la auditoría.',
    );
  };

  const handleApplyGrade = (record: DeliveryRecord) => {
    if (record.grade === undefined) {
      onNotification('La entrega no tiene una calificación para aplicar.');
      return;
    }

    try {
      const { group: updatedGroup, previousGrade } = applyDeliveryGrade(group, record);

      const commit = () => {
        const validated: DeliveryRecord = {
          ...record,
          status: 'validada',
          validatedAt: new Date().toISOString(),
        };
        Storage.saveDelivery(validated);
        Storage.appendAuditLog(
          auditEntry(
            'aplicar_calificacion',
            `${studentById.get(record.studentId)?.name || record.studentId} · ${record.evidenceRef}`,
            previousGrade === undefined ? 'sin nota' : String(previousGrade),
            String(record.grade),
          ),
        );
        onSaveGroup(updatedGroup);
        refresh();
        onNotification('Calificación aplicada y entrega validada.');
      };

      if (previousGrade !== undefined && previousGrade !== record.grade) {
        setConfirmDialog({
          title: 'Sobrescribir calificación',
          message: `La actividad ya tiene ${previousGrade.toFixed(1)}. ¿Sobrescribir con ${record.grade.toFixed(1)}?`,
          confirmLabel: 'Sobrescribir',
          tone: 'primary',
          onConfirm: commit,
        });
        return;
      }

      commit();
    } catch (error: any) {
      onNotification(error?.message || 'No se pudo aplicar la calificación.');
    }
  };

  const commitStatus = (record: DeliveryRecord, status: DeliveryStatus, note?: string) => {
    const updated: DeliveryRecord = {
      ...record,
      status,
      note,
      validatedAt: status === 'validada' ? new Date().toISOString() : undefined,
    };
    Storage.saveDelivery(updated);
    Storage.appendAuditLog(
      auditEntry(
        'cambiar_estado_entrega',
        `${studentById.get(record.studentId)?.name || record.studentId} · ${record.evidenceRef}`,
        record.status,
        status,
      ),
    );
    refresh();
    onNotification(`Entrega marcada como ${statusLabel(status).toLowerCase()}.`);
  };

  const handleSetStatus = (record: DeliveryRecord, status: DeliveryStatus) => {
    if (status === 'rechazada') {
      setRejectRecord(record);
      setRejectReason(record.note || '');
      return;
    }
    commitStatus(record, status, record.note);
  };

  const handleDelete = (record: DeliveryRecord) => {
    setConfirmDialog({
      title: 'Eliminar registro de auditoría',
      message: 'La nota ya aplicada no se modifica. ¿Eliminar solo el registro de entrega?',
      confirmLabel: 'Eliminar',
      tone: 'danger',
      onConfirm: () => {
        Storage.deleteDelivery(record.id);
        Storage.appendAuditLog(
          auditEntry(
            'eliminar_entrega',
            `${studentById.get(record.studentId)?.name || record.studentId} · ${record.evidenceRef}`,
            record.status,
            'eliminada',
          ),
        );
        refresh();
        onNotification('Registro de entrega eliminado.');
      },
    });
  };

  const confirmReject = () => {
    if (!rejectRecord) return;
    commitStatus(rejectRecord, 'rechazada', rejectReason.trim() || 'Sin motivo especificado');
    setRejectRecord(null);
    setRejectReason('');
  };

  const handleAnalyzeImport = (text: string, fileName: string) => {
    setImportText(text);
    setImportFileName(fileName);
    const result = parseDeliveryImport(text, group, deliveries);
    setImportResult(result);
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleAnalyzeImport(String(reader.result || ''), file.name);
    reader.onerror = () => onNotification('No se pudo leer el archivo.');
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (!importResult || importResult.drafts.length === 0) return;
    const records = importResult.drafts.map((draft) => draftToRecord(draft));
    Storage.saveDeliveries(records);
    Storage.appendAuditLogs(
      records.map((record) =>
        auditEntry(
          'importar_entrega',
          `${studentById.get(record.studentId)?.name || record.studentId} · ${record.evidenceRef}`,
          undefined,
          `${record.channel} · ${record.status}`,
        ),
      ),
    );
    refresh();
    setIsImportOpen(false);
    setImportResult(null);
    setImportText('');
    setImportFileName('');
    onNotification(`${records.length} entrega${records.length === 1 ? '' : 's'} importada${records.length === 1 ? '' : 's'}.`);
  };

  const downloadTemplate = () => {
    const csv = [
      'Matrícula,Nombre,Parcial,Actividad,Canal,Fecha,Evidencia,Nota,Estado,Motivo',
      '2026-001,José Hernández Pérez,Parcial 1,Tarea 1,Teams,2026-11-13,Tarea1_Jose.pdf,8.5,pendiente,Entregada en el chat',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    Utils.triggerDownload(`Plantilla_Entregas_${group.name.replace(/[^a-zA-Z0-9]+/g, '_')}.csv`, blob);
  };

  const visibleGaps = showGaps ? coverage.gaps.slice(0, 40) : [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Cobertura</p>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {coverage.percentage}%
          </p>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${coverage.percentage}%` }}
            />
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Recibidas</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {coverage.covered}
          </p>
          <p className="text-[10px] text-slate-400 font-bold">de {coverage.expected}</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Huecos</p>
          <p className="text-2xl font-black text-rose-500 mt-1">{coverage.gaps.length}</p>
          <button
            onClick={() => setShowGaps((previous) => !previous)}
            className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 mt-1 uppercase tracking-wider"
          >
            {showGaps ? 'Ocultar' : 'Ver detalle'}
          </button>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Registros</p>
          <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">{deliveries.length}</p>
          <p className="text-[10px] text-slate-400 font-bold">en esta materia</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
          {(['parcial1', 'parcial2', 'parcial3'] as ParcialId[]).map((parcialId) => (
            <button
              key={parcialId}
              onClick={() => {
                setActiveParcial(parcialId);
                setActivityFilter('todas');
              }}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition ${
                activeParcial === parcialId
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {PARCIAL_LABELS[parcialId]}
            </button>
          ))}
        </div>

        <button
          onClick={() => openNewForm()}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition"
        >
          <Plus size={14} /> Registrar entrega
        </button>
        <button
          onClick={() => setIsImportOpen(true)}
          className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition border border-emerald-200/50 dark:border-emerald-900/40"
        >
          <Upload size={14} /> Importar Teams / Outlook
        </button>
        <button
          onClick={downloadTemplate}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition"
        >
          <Download size={14} /> Plantilla CSV
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar alumno, actividad o evidencia..."
            className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
        <select
          value={activityFilter}
          onChange={(event) => setActivityFilter(event.target.value)}
          className="px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200"
        >
          <option value="todas">Todas las actividades</option>
          {activities.map((activity) => (
            <option key={activity.id} value={activity.id}>
              {activity.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as 'todas' | DeliveryStatus)}
          className="px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200"
        >
          <option value="todas">Todos los estados</option>
          {DELIVERY_STATUSES.map((status) => (
            <option key={status.id} value={status.id}>
              {status.label}
            </option>
          ))}
        </select>
      </div>

      {showGaps && (
        <div className="p-4 bg-rose-50/40 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
              <AlertTriangle size={14} /> Huecos de entrega · {coverage.gaps.length}
            </h4>
            {coverage.gaps.length > 40 && (
              <span className="text-[9px] text-rose-500 font-bold">Mostrando 40</span>
            )}
          </div>
          {visibleGaps.length === 0 ? (
            <p className="text-xs text-emerald-600 font-bold flex items-center gap-1.5">
              <CheckCircle2 size={14} /> No hay huecos en este parcial.
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto divide-y divide-rose-100/60 dark:divide-rose-900/20">
              {visibleGaps.map((gap, index) => (
                <div
                  key={`${gap.studentId}:${gap.activityId}`}
                  className="flex items-center gap-2 py-1.5"
                >
                  <span className="text-[9px] text-slate-400 font-mono w-5">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">
                      {gap.studentName}
                    </p>
                    <p className="text-[9px] text-slate-400 truncate">
                      {gap.categoryName} · {gap.activityName}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      openNewForm({
                        studentId: gap.studentId,
                        activityId: gap.activityId,
                        parcialId: activeParcial,
                      })
                    }
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/40 rounded-lg text-[9px] font-black uppercase text-rose-600 dark:text-rose-300"
                  >
                    Registrar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 text-center space-y-2">
          <Inbox size={28} className="mx-auto text-slate-300" />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            No hay entregas registradas con estos filtros.
          </p>
          <p className="text-[10px] text-slate-400">
            Registra una entrega o importa el listado de Teams/Outlook.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((record) => {
            const student = studentById.get(record.studentId);
            const activity = activities.find((item) => item.id === record.activityId);
            return (
              <div
                key={record.id}
                className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs"
              >
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {student?.name || record.studentId}
                      </p>
                      <span
                        className={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider ${statusClasses(record.status)}`}
                      >
                        {statusLabel(record.status)}
                      </span>
                      {record.grade !== undefined && (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-300 text-[9px] font-black">
                          Nota {record.grade.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-1">
                      {activity?.name || record.activityId}
                      <span className="text-slate-400 font-medium"> · {channelLabel(record.channel)}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono mt-1 truncate">
                      {new Date(record.receivedAt).toLocaleDateString('es-MX')} · {record.evidenceRef}
                    </p>
                    {record.note && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-300 mt-1 italic">
                        {record.note}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {record.grade !== undefined && (
                      <button
                        onClick={() => handleApplyGrade(record)}
                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider"
                      >
                        Aplicar nota
                      </button>
                    )}
                    {record.status !== 'validada' && (
                      <button
                        onClick={() => handleSetStatus(record, 'validada')}
                        className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-[9px] font-black uppercase tracking-wider border border-emerald-200/60 dark:border-emerald-900/40"
                      >
                        Validar
                      </button>
                    )}
                    {record.status !== 'rechazada' && (
                      <button
                        onClick={() => handleSetStatus(record, 'rechazada')}
                        className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 rounded-lg text-[9px] font-black uppercase tracking-wider border border-rose-200/60 dark:border-rose-900/40"
                      >
                        Rechazar
                      </button>
                    )}
                    <button
                      onClick={() => openEditForm(record)}
                      className="p-1.5 text-slate-400 hover:text-indigo-500"
                      title="Editar entrega"
                    >
                      <Clock size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(record)}
                      className="p-1.5 text-slate-300 hover:text-rose-500"
                      title="Eliminar registro"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                {editingId ? 'Editar entrega' : 'Registrar entrega'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-300">
                <X size={22} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 space-y-1">
                Alumno
                <select
                  value={form.studentId}
                  onChange={(event) => setForm({ ...form, studentId: event.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white"
                >
                  {group.students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 space-y-1">
                Actividad
                <select
                  value={`${form.parcialId}:${form.activityId}`}
                  onChange={(event) => {
                    const [parcialId, activityId] = event.target.value.split(':') as [ParcialId, string];
                    setForm({ ...form, parcialId, activityId });
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white"
                >
                  <option value=":">Selecciona una actividad</option>
                  {allActivityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 space-y-1">
                Canal
                <select
                  value={form.channel}
                  onChange={(event) =>
                    setForm({ ...form, channel: event.target.value as DeliveryChannel })
                  }
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white"
                >
                  {DELIVERY_CHANNELS.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 space-y-1">
                Fecha
                <input
                  type="date"
                  value={(form.receivedAt || new Date().toISOString()).slice(0, 10)}
                  onChange={(event) =>
                    setForm({ ...form, receivedAt: dateInputToIso(event.target.value) })
                  }
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white"
                />
              </label>

              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 space-y-1 sm:col-span-2">
                Evidencia (archivo, URL o referencia)
                <input
                  value={form.evidenceRef}
                  onChange={(event) => setForm({ ...form, evidenceRef: event.target.value })}
                  placeholder="Ej. Tarea1_Jose.pdf o mensaje de Teams"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white"
                />
              </label>

              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 space-y-1">
                Calificación (opcional)
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={form.grade ?? ''}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      grade: event.target.value === '' ? undefined : Number(event.target.value),
                    })
                  }
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white"
                />
              </label>

              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 space-y-1">
                Estado
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value as DeliveryStatus })
                  }
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white"
                >
                  {DELIVERY_STATUSES.filter((status) => status.id !== 'duplicada').map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 space-y-1 sm:col-span-2">
                Motivo / nota
                <input
                  value={form.note || ''}
                  onChange={(event) => setForm({ ...form, note: event.target.value })}
                  placeholder="Ej. Entregada por Teams tras falla de red"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white"
                />
              </label>
            </div>

            <button
              onClick={handleSaveForm}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider active:scale-95 transition flex items-center justify-center gap-2"
            >
              <Check size={15} /> {editingId ? 'Guardar cambios' : 'Registrar entrega'}
            </button>
          </div>
        </div>
      )}

      {isImportOpen && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet size={16} /> Importar entregas
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  CSV o JSON exportado de Teams, Outlook o WhatsApp.
                </p>
              </div>
              <button onClick={() => setIsImportOpen(false)} className="text-slate-300">
                <X size={22} />
              </button>
            </div>

            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-center">
              <input
                type="file"
                accept=".csv,.json,text/csv,application/json"
                onChange={(event) => handleFile(event.target.files?.[0])}
                className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-indigo-50 file:text-indigo-600 file:text-[10px] file:font-black file:uppercase"
              />
              {importFileName && (
                <p className="text-[10px] text-slate-400 mt-2 font-mono">{importFileName}</p>
              )}
            </div>

            <textarea
              value={importText}
              onChange={(event) => {
                setImportText(event.target.value);
                setImportResult(null);
              }}
              placeholder="O pega aquí el CSV/JSON..."
              className="w-full h-28 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-[11px] font-mono text-slate-700 dark:text-slate-200"
            />

            <button
              onClick={() => handleAnalyzeImport(importText, importFileName || 'pegado')}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-black text-xs uppercase tracking-wider"
            >
              Analizar contenido
            </button>

            {importResult && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-center">
                    <p className="text-lg font-black text-emerald-600">{importResult.drafts.length}</p>
                    <p className="text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-300">Listas</p>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-center">
                    <p className="text-lg font-black text-rose-600">{importResult.errors.length}</p>
                    <p className="text-[9px] font-black uppercase text-rose-700 dark:text-rose-300">Errores</p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-center">
                    <p className="text-lg font-black text-amber-600">{importResult.unresolved.length}</p>
                    <p className="text-[9px] font-black uppercase text-amber-700 dark:text-amber-300">No resueltas</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-center">
                    <p className="text-lg font-black text-slate-600 dark:text-slate-300">{importResult.duplicates.length}</p>
                    <p className="text-[9px] font-black uppercase text-slate-500">Duplicadas</p>
                  </div>
                </div>

                {(importResult.errors.length > 0 || importResult.unresolved.length > 0) && (
                  <div className="max-h-40 overflow-y-auto space-y-1 bg-rose-50/40 dark:bg-rose-950/10 rounded-xl p-3">
                    {[...importResult.errors, ...importResult.unresolved].slice(0, 12).map((issue, index) => (
                      <p key={`${issue.line}-${index}`} className="text-[10px] text-rose-700 dark:text-rose-300">
                        Línea {issue.line}: {issue.message}
                      </p>
                    ))}
                  </div>
                )}

                <button
                  disabled={importResult.drafts.length === 0}
                  onClick={handleConfirmImport}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <Check size={15} /> Importar {importResult.drafts.length} entrega{importResult.drafts.length === 1 ? '' : 's'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-[240] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-2xl space-y-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              confirmDialog.tone === 'danger'
                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300'
                : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-300'
            }`}>
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {confirmDialog.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {confirmDialog.message}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-black text-[10px] uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  action();
                }}
                className={`flex-1 py-3 text-white rounded-xl font-black text-[10px] uppercase tracking-wider ${
                  confirmDialog.tone === 'danger' ? 'bg-rose-600' : 'bg-indigo-600'
                }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectRecord && (
        <div className="fixed inset-0 z-[240] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-300 flex items-center justify-center">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Rechazar entrega
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {studentById.get(rejectRecord.studentId)?.name || rejectRecord.studentId} ·{' '}
                {rejectRecord.evidenceRef}
              </p>
            </div>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Motivo del rechazo"
              className="w-full h-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-200"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setRejectRecord(null);
                  setRejectReason('');
                }}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-black text-[10px] uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                onClick={confirmReject}
                className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase tracking-wider"
              >
                Rechazar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
