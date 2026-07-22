import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { Group } from './types';
import { BarChart3, Info } from 'lucide-react';

interface AttendanceChartProps {
  group: Group;
}

export const AttendanceChart: React.FC<AttendanceChartProps> = ({ group }) => {
  // Aggregate stats over all sessions
  let totalPresent = 0;
  let totalAbsent = 0;
  let totalLate = 0;
  let totalExcused = 0;

  group.sessions.forEach(session => {
    (Object.values(session.attendance) as any[]).forEach(record => {
      if (record.status === 'present') totalPresent++;
      else if (record.status === 'absent') totalAbsent++;
      else if (record.status === 'late') totalLate++;
      else if (record.status === 'excused') totalExcused++;
    });
  });

  const totalRecords = totalPresent + totalAbsent + totalLate + totalExcused;

  const data = [
    {
      name: 'Presentes',
      cantidad: totalPresent,
      color: '#10b981', // emerald-500
      pct: totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0
    },
    {
      name: 'Retardos',
      cantidad: totalLate,
      color: '#f59e0b', // amber-500
      pct: totalRecords > 0 ? Math.round((totalLate / totalRecords) * 100) : 0
    },
    {
      name: 'Justificados',
      cantidad: totalExcused,
      color: '#3b82f6', // blue-500
      pct: totalRecords > 0 ? Math.round((totalExcused / totalRecords) * 100) : 0
    },
    {
      name: 'Faltas',
      cantidad: totalAbsent,
      color: '#f43f5e', // rose-500
      pct: totalRecords > 0 ? Math.round((totalAbsent / totalRecords) * 100) : 0
    }
  ];

  // Custom tooltip component to match app aesthetic
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-3 rounded-2xl shadow-lg">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">{item.name}</p>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-sm font-black text-slate-800 dark:text-white">{item.cantidad}</span>
            <span className="text-xs text-slate-400">({item.pct}%)</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="text-indigo-600 dark:text-indigo-400" size={20} />
        <h3 className="font-bold text-slate-900 dark:text-white">Distribución de Asistencias del Grupo</h3>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
        Visualización del acumulado total de registros de asistencia tomados en todas las sesiones de esta materia.
      </p>

      {totalRecords === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-4">
          <Info size={24} className="text-slate-400 mb-2" />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Sin datos acumulados</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            Realiza el pase de lista en tus sesiones para ver la distribución aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800/60" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} 
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} 
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.4)' }} />
                <Bar 
                  dataKey="cantidad" 
                  radius={[8, 8, 0, 0]}
                  maxBarSize={50}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Grid de porcentajes y cantidades */}
          <div className="grid grid-cols-4 gap-3">
            {data.map((item) => (
              <div 
                key={item.name} 
                className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/50 flex flex-col items-center justify-center text-center"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{item.name}</span>
                </div>
                <span className="text-lg font-black text-slate-800 dark:text-white leading-tight">{item.cantidad}</span>
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">{item.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
