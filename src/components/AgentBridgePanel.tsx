import React, { useEffect, useState } from 'react';
import {
  Bot,
  Clock,
  Database,
  Download,
  RefreshCw,
  Smartphone,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { AppData } from '../../types';
import * as Storage from '../../services/storage';
import * as Utils from '../../services/utils';
import {
  deleteSnapshot,
  getAutoSnapshotEnabled,
  getSnapshot,
  listSnapshots,
  saveSnapshot,
  setAutoSnapshotEnabled,
  SnapshotMeta,
} from '../../services/snapshotDb';

interface AgentBridgePanelProps {
  data: AppData;
  onRefresh: () => void;
  onNotification: (message: string) => void;
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
};

export const AgentBridgePanel: React.FC<AgentBridgePanelProps> = ({
  data,
  onRefresh,
  onNotification,
}) => {
  const [autoSnapshot, setAutoSnapshot] = useState(getAutoSnapshotEnabled());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<SnapshotMeta | null>(null);

  const loadHistory = async () => {
    const list = await listSnapshots();
    setSnapshots(list);
  };

  useEffect(() => {
    if (historyOpen) void loadHistory();
  }, [historyOpen]);

  const handleExportSnapshot = () => {
    const payload = Storage.createBackupPayload();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    void Utils.triggerDownload(`profasist_snapshot_${stamp}.json`, blob);
    onNotification('Snapshot exportado para el agente.');
  };

  const handleManualSnapshot = async () => {
    setIsBusy(true);
    try {
      const meta = await saveSnapshot(Storage.loadData(), 'manual');
      if (meta) {
        onNotification('Snapshot interno creado.');
        await loadHistory();
      } else {
        onNotification('El almacenamiento de snapshots no está disponible.');
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleAuto = () => {
    const next = !autoSnapshot;
    setAutoSnapshot(next);
    setAutoSnapshotEnabled(next);
    onNotification(
      next
        ? 'Snapshot automático activado (máx. 20 copias).'
        : 'Snapshot automático desactivado.',
    );
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setIsBusy(true);
    try {
      const record = await getSnapshot(restoreTarget.id);
      if (!record) {
        onNotification('No se encontró el snapshot seleccionado.');
        return;
      }
      Storage.replaceData(record.data);
      onRefresh();
      setRestoreTarget(null);
      setHistoryOpen(false);
      onNotification('Estado restaurado desde el snapshot.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteSnapshot = async (snapshot: SnapshotMeta) => {
    await deleteSnapshot(snapshot.id);
    await loadHistory();
    onNotification('Snapshot eliminado.');
  };

  return (
    <div className="p-5 bg-slate-50 dark:bg-slate-850 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl">
          <Bot size={18} />
        </div>
        <div>
          <h4 className="font-black text-xs uppercase tracking-widest text-slate-700 dark:text-slate-200">
            Modo Agente / Exocórtex
          </h4>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Sincronización directa por ADB con la APK <strong>agent</strong>. La APK
            release normal no expone el socket de depuración.
          </p>
        </div>
      </div>

      <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1.5">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <Smartphone size={12} /> Conexión determinista
        </p>
        <code className="block text-[9px] font-mono text-slate-600 dark:text-slate-300 break-all">
          adb shell pidof com.carlos.profasist
        </code>
        <code className="block text-[9px] font-mono text-slate-600 dark:text-slate-300 break-all">
          adb forward tcp:9223 localabstract:webview_devtools_remote_&lt;PID&gt;
        </code>
        <code className="block text-[9px] font-mono text-slate-600 dark:text-slate-300 break-all">
          python3 tools/adb_bridge/cli.py doctor
        </code>
        <p className="text-[9px] text-slate-400">
          Última sincronización:{' '}
          {data.syncMeta?.lastPushAt ? formatDate(data.syncMeta.lastPushAt) : 'sin registro'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          onClick={handleExportSnapshot}
          className="py-3 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1.5"
        >
          <Download size={14} /> Exportar snapshot
        </button>
        <button
          onClick={handleManualSnapshot}
          disabled={isBusy}
          className="py-3 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5"
        >
          <Database size={14} /> Crear snapshot
        </button>
        <button
          onClick={() => setHistoryOpen(true)}
          className="py-3 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1.5"
        >
          <Clock size={14} /> Historial ({snapshots.length || '—'})
        </button>
        <button
          onClick={handleToggleAuto}
          className={`py-3 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider border flex items-center justify-center gap-1.5 ${
            autoSnapshot
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500'
          }`}
        >
          <RefreshCw size={14} /> Auto: {autoSnapshot ? 'ON' : 'OFF'}
        </button>
      </div>

      {historyOpen && (
        <div className="fixed inset-0 z-[240] flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 shadow-2xl max-h-[88vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <Database size={16} /> Historial de snapshots
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  Máximo 20 copias automáticas en IndexedDB.
                </p>
              </div>
              <button onClick={() => setHistoryOpen(false)} className="text-slate-300">
                <X size={22} />
              </button>
            </div>

            {snapshots.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">
                Todavía no hay snapshots. Crea uno o modifica una calificación.
              </p>
            ) : (
              <div className="space-y-2">
                {snapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black text-slate-700 dark:text-slate-200">
                        {formatDate(snapshot.createdAt)}
                      </p>
                      <p className="text-[9px] text-slate-400 font-mono">
                        {snapshot.reason} · {snapshot.groups} materias · {snapshot.students} alumnos ·{' '}
                        {formatBytes(snapshot.size)}
                      </p>
                    </div>
                    <button
                      onClick={() => setRestoreTarget(snapshot)}
                      className="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-300 rounded-lg text-[9px] font-black uppercase tracking-wider"
                    >
                      Restaurar
                    </button>
                    <button
                      onClick={() => handleDeleteSnapshot(snapshot)}
                      className="p-1.5 text-slate-300 hover:text-rose-500"
                      title="Eliminar snapshot"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {restoreTarget && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2">
                <p className="text-[11px] font-bold text-amber-800 dark:text-amber-200">
                  ¿Reemplazar el estado actual con el snapshot del{' '}
                  {formatDate(restoreTarget.createdAt)}?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRestoreTarget(null)}
                    className="flex-1 py-2.5 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleRestore}
                    disabled={isBusy}
                    className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase"
                  >
                    Restaurar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
