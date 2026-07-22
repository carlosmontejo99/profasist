import React, { useState, useRef } from 'react';
import { 
  Upload, FileSpreadsheet, Clipboard, AlertCircle, CheckCircle2, 
  HelpCircle, RefreshCw, Check, X, ArrowRight, UserPlus, Info, Trash2
} from 'lucide-react';
import { Student, Group } from '../../types';
import * as Utils from '../../services/utils';
import * as XLSX from 'xlsx';

interface StudentImporterProps {
  group: Group;
  onImport: (students: Student[], mode: 'merge' | 'replace') => void;
  onClose: () => void;
  onNotification: (msg: string) => void;
}

interface ParsedRow {
  selected: boolean;
  name: string;
  rollNumber: string;
  email: string;
  status: 'new' | 'update' | 'duplicate' | 'invalid';
  originalId?: string; // If updating an existing student
}

export const StudentImporter: React.FC<StudentImporterProps> = ({
  group,
  onImport,
  onClose,
  onNotification
}) => {
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [duplicatePolicy, setDuplicatePolicy] = useState<'update' | 'ignore'>('update');
  const [activeSource, setActiveSource] = useState<'file' | 'paste'>('file');
  
  // File drag & drop states
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Copy & Paste raw input state
  const [pastedText, setPastedText] = useState('');
  
  // Parsing states
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isParsed, setIsParsed] = useState(false);
  const [selectedHeaders, setSelectedHeaders] = useState({
    nameCol: '',
    rollCol: '',
    emailCol: ''
  });
  const [rawSheetData, setRawSheetData] = useState<any[]>([]);
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);

  // Reset helper
  const handleReset = () => {
    setParsedRows([]);
    setIsParsed(false);
    setPastedText('');
    setRawSheetData([]);
    setSheetHeaders([]);
    setSelectedHeaders({ nameCol: '', rollCol: '', emailCol: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Helper: Try to smart-match headers from Excel/CSV columns
  const autoDetectColumns = (headers: string[]) => {
    let nameCol = '';
    let rollCol = '';
    let emailCol = '';

    headers.forEach(h => {
      const lower = h.toLowerCase().trim();
      
      // Name patterns
      if (
        lower.includes('nombre') || 
        lower.includes('name') || 
        lower.includes('alumno') || 
        lower.includes('completo') ||
        lower.includes('estudiante')
      ) {
        if (!nameCol) nameCol = h;
      }
      
      // Roll number patterns
      if (
        lower.includes('matricula') || 
        lower.includes('matrícula') || 
        lower.includes('control') || 
        lower.includes('roll') || 
        lower.includes('id') || 
        lower.includes('registro') ||
        lower.includes('código') ||
        lower.includes('codigo')
      ) {
        if (!rollCol) rollCol = h;
      }
      
      // Email patterns
      if (
        lower.includes('correo') || 
        lower.includes('email') || 
        lower.includes('mail') || 
        lower.includes('contacto')
      ) {
        if (!emailCol) emailCol = h;
      }
    });

    // Fallbacks if not detected
    if (!nameCol && headers.length > 0) nameCol = headers[0];
    if (!rollCol && headers.length > 1) {
      rollCol = headers.find(h => h !== nameCol) || '';
    }
    if (!emailCol && headers.length > 2) {
      emailCol = headers.find(h => h !== nameCol && h !== rollCol) || '';
    }

    return { nameCol, rollCol, emailCol };
  };

  // Process raw sheets or table rows into ParsedRow items
  const buildParsedRows = (
    rawData: any[], 
    mappings: { nameCol: string; rollCol: string; emailCol: string }
  ) => {
    const { nameCol, rollCol, emailCol } = mappings;
    const parsed: ParsedRow[] = [];

    rawData.forEach(row => {
      let name = '';
      let rollNumber = '';
      let email = '';

      if (typeof row === 'object' && row !== null) {
        name = row[nameCol] ? String(row[nameCol]).trim() : '';
        rollNumber = row[rollCol] ? String(row[rollCol]).trim() : '';
        email = row[emailCol] ? String(row[emailCol]).trim() : '';
      }

      // Skip completely empty rows
      if (!name && !rollNumber && !email) return;

      // Status checks
      let status: 'new' | 'update' | 'duplicate' | 'invalid' = 'new';
      let originalId: string | undefined;

      if (!name) {
        status = 'invalid';
      } else {
        // Look for matches in existing group students
        const existingByRoll = rollNumber 
          ? group.students.find(s => s.rollNumber && s.rollNumber.toLowerCase() === rollNumber.toLowerCase())
          : null;
        
        const existingByName = group.students.find(s => s.name.toLowerCase() === name.toLowerCase());
        const match = existingByRoll || existingByName;

        if (match) {
          originalId = match.id;
          if (duplicatePolicy === 'update') {
            status = 'update';
          } else {
            status = 'duplicate';
          }
        }
      }

      parsed.push({
        selected: status !== 'invalid' && status !== 'duplicate',
        name,
        rollNumber,
        email,
        status,
        originalId
      });
    });

    setParsedRows(parsed);
    setIsParsed(true);
  };

  // Parse Excel / CSV files
  const handleFileParse = (file: File) => {
    const reader = new FileReader();
    
    if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        // Parse CSV using robust local logic
        const lines = text.split(/\r?\n/);
        if (lines.length === 0) {
          onNotification('El archivo CSV está vacío.');
          return;
        }

        // Detect separator
        const firstLine = lines[0];
        let separator = ',';
        if (firstLine.includes('\t')) separator = '\t';
        else if (firstLine.includes(';')) separator = ';';

        // Parse cells helper
        const parseCSVLine = (line: string) => {
          const cells: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === separator && !inQuotes) {
              cells.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          cells.push(current.trim());
          return cells;
        };

        const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
        const rawData: any[] = [];

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const cells = parseCSVLine(lines[i]);
          const obj: Record<string, string> = {};
          headers.forEach((header, index) => {
            if (header) {
              obj[header] = cells[index] !== undefined ? cells[index].replace(/^"|"$/g, '').trim() : '';
            }
          });
          rawData.push(obj);
        }

        if (rawData.length === 0) {
          onNotification('No se encontraron registros de alumnos en el CSV.');
          return;
        }

        setSheetHeaders(headers);
        setRawSheetData(rawData);
        
        const maps = autoDetectColumns(headers);
        setSelectedHeaders(maps);
        buildParsedRows(rawData, maps);
      };
      reader.readAsText(file);
    } else {
      // XLSX Excel handler
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          if (rawData.length === 0) {
            onNotification('La hoja de cálculo está vacía.');
            return;
          }

          // Get headers
          const headers = Object.keys(rawData[0] as object);
          setSheetHeaders(headers);
          setRawSheetData(rawData);

          const maps = autoDetectColumns(headers);
          setSelectedHeaders(maps);
          buildParsedRows(rawData, maps);
        } catch (error) {
          onNotification('Error al leer el archivo de Excel.');
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileParse(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileParse(file);
    }
  };

  // Parse Copy/Paste multi-line text input
  const handlePasteParse = () => {
    if (!pastedText.trim()) {
      onNotification('Ingresa o pega información antes de continuar.');
      return;
    }

    const lines = pastedText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const parsedData: any[] = [];
    
    lines.forEach(line => {
      // Try to split on common delimiters: Tab, Comma, Semicolon, vertical bar, or multiple spaces (>=2)
      let pieces = line.split(/\t|,|;|\|/);
      if (pieces.length <= 1) {
        pieces = line.split(/\s{2,}/); // fallback split by multiple spaces
      }
      pieces = pieces.map(p => p.trim()).filter(p => p.length > 0);

      let name = '';
      let rollNumber = '';
      let email = '';

      // Smart identify columns based on content
      pieces.forEach(p => {
        // Is email?
        if (p.includes('@')) {
          email = p;
        } 
        // Is typical student roll number (digits, or letters+digits of specific size, e.g., 6 to 15 chars)
        else if (/^[A-Za-z0-9-]{6,15}$/.test(p) && /\d/.test(p)) {
          rollNumber = p;
        } 
        // Likely a name
        else if (p.length > 2) {
          if (!name) name = p;
          else name += ' ' + p; // merge remaining fragments
        }
      });

      // If we couldn't split neatly, do fallback regex extractions
      if (pieces.length === 1) {
        const raw = pieces[0];
        // Match email
        const emailMatch = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) {
          email = emailMatch[0];
        }
        // Match standard roll numbers (e.g., 8-10 digit numbers)
        const rollMatch = raw.match(/\b\d{7,12}\b/) || raw.match(/\b[A-Za-z]\d{7,10}\b/);
        if (rollMatch) {
          rollNumber = rollMatch[0];
        }
        
        // Name is whatever is left that are letters and spaces
        let nameRaw = raw.replace(email, '').replace(rollNumber, '').trim();
        nameRaw = nameRaw.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '').trim();
        if (nameRaw.length > 3) {
          name = nameRaw;
        }
      }

      parsedData.push({
        'Nombre': name || 'ALUMNO SIN NOMBRE',
        'Matrícula': rollNumber || '',
        'Correo': email || ''
      });
    });

    setSheetHeaders(['Nombre', 'Matrícula', 'Correo']);
    setRawSheetData(parsedData);
    const maps = { nameCol: 'Nombre', rollCol: 'Matrícula', emailCol: 'Correo' };
    setSelectedHeaders(maps);
    buildParsedRows(parsedData, maps);
  };

  // Re-run the parsing row evaluation if settings change
  const handleRefreshRows = (policy: 'update' | 'ignore') => {
    if (rawSheetData.length === 0) return;
    
    const parsed: ParsedRow[] = [];
    rawSheetData.forEach(row => {
      const name = row[selectedHeaders.nameCol] ? String(row[selectedHeaders.nameCol]).trim() : '';
      const rollNumber = row[selectedHeaders.rollCol] ? String(row[selectedHeaders.rollCol]).trim() : '';
      const email = row[selectedHeaders.emailCol] ? String(row[selectedHeaders.emailCol]).trim() : '';

      if (!name && !rollNumber && !email) return;

      let status: 'new' | 'update' | 'duplicate' | 'invalid' = 'new';
      let originalId: string | undefined;

      if (!name) {
        status = 'invalid';
      } else {
        const existingByRoll = rollNumber 
          ? group.students.find(s => s.rollNumber && s.rollNumber.toLowerCase() === rollNumber.toLowerCase())
          : null;
        const existingByName = group.students.find(s => s.name.toLowerCase() === name.toLowerCase());
        const match = existingByRoll || existingByName;

        if (match) {
          originalId = match.id;
          status = policy === 'update' ? 'update' : 'duplicate';
        }
      }

      parsed.push({
        selected: status !== 'invalid' && status !== 'duplicate',
        name,
        rollNumber,
        email,
        status,
        originalId
      });
    });

    setParsedRows(parsed);
  };

  // Toggle selection state for a row
  const toggleRowSelection = (index: number) => {
    setParsedRows(prev => prev.map((r, idx) => idx === index ? { ...r, selected: !r.selected } : r));
  };

  // Toggle all selectable rows
  const toggleAllSelection = (checked: boolean) => {
    setParsedRows(prev => prev.map(r => r.status !== 'invalid' ? { ...r, selected: checked } : r));
  };

  // Execute the final database import
  const handleExecuteImport = () => {
    const toImport = parsedRows.filter(r => r.selected && r.status !== 'invalid');
    if (toImport.length === 0) {
      onNotification('No hay alumnos seleccionados para importar.');
      return;
    }

    const compiledStudentsList: Student[] = [];

    if (importMode === 'replace') {
      // Start fresh
      toImport.forEach((r, idx) => {
        compiledStudentsList.push({
          id: `st_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
          name: r.name,
          rollNumber: r.rollNumber || undefined,
          email: r.email || undefined
        });
      });
    } else {
      // Merge mode
      // Start with all existing students
      const currentListMap = new Map<string, Student>();
      group.students.forEach(s => currentListMap.set(s.id, s));

      toImport.forEach((r, idx) => {
        if (r.status === 'update' && r.originalId && currentListMap.has(r.originalId)) {
          // Update the existing student details
          const existing = currentListMap.get(r.originalId)!;
          currentListMap.set(r.originalId, {
            ...existing,
            name: r.name,
            rollNumber: r.rollNumber || existing.rollNumber,
            email: r.email || existing.email
          });
        } else {
          // Create a new record
          const newId = `st_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`;
          currentListMap.set(newId, {
            id: newId,
            name: r.name,
            rollNumber: r.rollNumber || undefined,
            email: r.email || undefined
          });
        }
      });

      compiledStudentsList.push(...Array.from(currentListMap.values()));
    }

    onImport(compiledStudentsList, importMode);
    onNotification(`Se han importado/actualizado los alumnos del grupo.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* MODAL HEADER */}
        <header className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
              <UserPlus size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Importador Académico Inteligente</h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Inserta listas oficiales en segundos desde plantillas, CSV o portales escolares.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-white rounded-xl transition">
            <X size={16} />
          </button>
        </header>

        {/* WORKSPACE AREA */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!isParsed ? (
            /* SOURCE INPUT AND SETTINGS CHOOSE */
            <div className="space-y-6">
              
              {/* SOURCE SELECTOR */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-max gap-1">
                <button 
                  onClick={() => setActiveSource('file')}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition flex items-center gap-2 ${
                    activeSource === 'file' 
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' 
                      : 'text-slate-500'
                  }`}
                >
                  <FileSpreadsheet size={14} /> Archivo Excel o CSV
                </button>
                <button 
                  onClick={() => setActiveSource('paste')}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition flex items-center gap-2 ${
                    activeSource === 'paste' 
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' 
                      : 'text-slate-500'
                  }`}
                >
                  <Clipboard size={14} /> Copiar y Pegar Lista
                </button>
              </div>

              {/* INPUT CONTAINER */}
              {activeSource === 'file' ? (
                /* FILE UPLOAD ZONE (DRAG AND DROP) */
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-10 border-2 border-dashed rounded-[2rem] text-center cursor-pointer transition-all ${
                    isDragging 
                      ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20' 
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/20 hover:border-indigo-400 dark:hover:border-indigo-500'
                  }`}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    accept=".xlsx,.xls,.csv" 
                    className="hidden" 
                    onChange={handleFileChange}
                  />
                  <div className="space-y-3">
                    <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-[1.5rem] flex items-center justify-center mx-auto shadow-sm">
                      <Upload size={24} className="animate-bounce" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">Arrastra o selecciona tu archivo Excel o CSV</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Soporta plantillas institucionales, formatos de control escolar y registros escolares.</p>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono flex items-center justify-center gap-1.5 pt-2">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">XLSX</span>
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">XLS</span>
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">CSV</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* COPY PASTE TEXT AREA */
                <div className="space-y-4">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-2.5">
                    <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-normal">
                      Pega directamente una columna de nombres de alumnos o filas copiadas desde Excel o Word. Intentaremos descifrar automáticamente la <strong>Matrícula</strong>, el <strong>Nombre</strong> y el <strong>Correo electrónico</strong>.
                    </p>
                  </div>
                  
                  <textarea
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Ejemplo:&#10;20210459 Juan Pérez López juan.perez@uni.edu&#10;20210460 Maria Torres G. maria.t@uni.edu"
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white dark:text-white"
                  />

                  <button 
                    onClick={handlePasteParse}
                    className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-1.5 transition ml-auto"
                  >
                    Procesar Lista <ArrowRight size={14} />
                  </button>
                </div>
              )}

              {/* IMPORT SETTINGS PANEL */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-50 dark:border-slate-800">
                <div className="p-5 bg-slate-50/50 dark:bg-slate-850/40 rounded-3xl space-y-3 border border-slate-100 dark:border-slate-850">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Acción en el Grupo</label>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setImportMode('merge')}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        importMode === 'merge' 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <UserPlus size={14} /> Fusionar Alumnos
                    </button>
                    <button 
                      onClick={() => setImportMode('replace')}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        importMode === 'replace' 
                          ? 'bg-rose-600 text-white shadow-sm' 
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Trash2 size={14} /> Reemplazar Lista
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">
                    {importMode === 'merge' 
                      ? 'Conserva los alumnos actuales y añade los nuevos de la lista.' 
                      : 'Elimina los alumnos del grupo actual y los reemplaza por completo con los nuevos.'}
                  </p>
                </div>

                <div className="p-5 bg-slate-50/50 dark:bg-slate-850/40 rounded-3xl space-y-3 border border-slate-100 dark:border-slate-850">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tratamiento de Duplicados</label>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setDuplicatePolicy('update'); handleRefreshRows('update'); }}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        duplicatePolicy === 'update' 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Actualizar Datos
                    </button>
                    <button 
                      onClick={() => { setDuplicatePolicy('ignore'); handleRefreshRows('ignore'); }}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        duplicatePolicy === 'ignore' 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Ignorar / Omitir
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">
                    {duplicatePolicy === 'update' 
                      ? 'Actualiza el nombre o correo del alumno existente si coincide su matrícula.' 
                      : 'Conserva el registro exacto existente y descarta el duplicado de la lista importada.'}
                  </p>
                </div>
              </div>

            </div>
          ) : (
            /* PREVIEW WORKSPACE */
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* HEADER INFO & HEADER MAPS IF EXCEL/CSV */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 dark:bg-slate-850 p-5 rounded-3xl">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1.5">
                    <CheckCircle2 size={16} className="text-emerald-500" /> Vista Previa de Registros Detectados
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    Encontramos {parsedRows.length} registros. Por favor, revisa el mapeo de columnas y desmarca los que no deseas importar.
                  </p>
                </div>

                <div className="flex gap-2 text-[10px] font-black uppercase">
                  <span className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 rounded-lg">
                    {parsedRows.filter(r => r.selected && r.status === 'new').length} Nuevos
                  </span>
                  <span className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 rounded-lg">
                    {parsedRows.filter(r => r.selected && r.status === 'update').length} Actualizar
                  </span>
                  <span className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 rounded-lg">
                    {parsedRows.filter(r => r.status === 'invalid').length} No Válidos
                  </span>
                </div>
              </div>

              {/* COLUMN MAPPER DROPDOWNS (ONLY SHOW IF COLUMNS/HEADERS ARE DEFINED) */}
              {sheetHeaders.length > 0 && activeSource === 'file' && (
                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Ajustar Asociación de Columnas</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 mb-1 block">Columna del Nombre (Requerido)</label>
                      <select 
                        value={selectedHeaders.nameCol}
                        onChange={(e) => {
                          const updated = { ...selectedHeaders, nameCol: e.target.value };
                          setSelectedHeaders(updated);
                          buildParsedRows(rawSheetData, updated);
                        }}
                        className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border-none px-3 py-2 rounded-xl focus:ring-1 focus:ring-indigo-500 dark:text-white"
                      >
                        {sheetHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-500 mb-1 block">Columna de Matrícula</label>
                      <select 
                        value={selectedHeaders.rollCol}
                        onChange={(e) => {
                          const updated = { ...selectedHeaders, rollCol: e.target.value };
                          setSelectedHeaders(updated);
                          buildParsedRows(rawSheetData, updated);
                        }}
                        className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border-none px-3 py-2 rounded-xl focus:ring-1 focus:ring-indigo-500 dark:text-white"
                      >
                        <option value="">-- Omitir Matrícula --</option>
                        {sheetHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-500 mb-1 block">Columna de Correo</label>
                      <select 
                        value={selectedHeaders.emailCol}
                        onChange={(e) => {
                          const updated = { ...selectedHeaders, emailCol: e.target.value };
                          setSelectedHeaders(updated);
                          buildParsedRows(rawSheetData, updated);
                        }}
                        className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border-none px-3 py-2 rounded-xl focus:ring-1 focus:ring-indigo-500 dark:text-white"
                      >
                        <option value="">-- Omitir Correo --</option>
                        {sheetHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* RECORD TABLE PREVIEW */}
              <div className="border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden bg-white dark:bg-slate-900">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                      <tr>
                        <th className="p-3.5 w-12 text-center">
                          <input 
                            type="checkbox" 
                            checked={parsedRows.length > 0 && parsedRows.every(r => r.selected || r.status === 'invalid')}
                            onChange={(e) => toggleAllSelection(e.target.checked)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 rounded"
                          />
                        </th>
                        <th className="p-3.5 w-32">Matrícula</th>
                        <th className="p-3.5">Nombre Completo</th>
                        <th className="p-3.5">Correo Electrónico</th>
                        <th className="p-3.5 text-right w-36">Estatus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-850">
                      {parsedRows.map((row, idx) => (
                        <tr key={idx} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition ${row.status === 'invalid' ? 'bg-rose-50/10' : ''}`}>
                          <td className="p-3.5 text-center">
                            <input 
                              type="checkbox" 
                              disabled={row.status === 'invalid'}
                              checked={row.selected}
                              onChange={() => toggleRowSelection(idx)}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 rounded"
                            />
                          </td>
                          <td className="p-3.5 font-mono font-bold text-slate-700 dark:text-slate-300">
                            {row.rollNumber || <span className="text-slate-300 dark:text-slate-600 font-normal italic">No asignado</span>}
                          </td>
                          <td className="p-3.5 font-black text-slate-850 dark:text-white uppercase">
                            {row.name}
                          </td>
                          <td className="p-3.5 text-slate-500 dark:text-slate-400 font-medium">
                            {row.email || <span className="text-slate-300 dark:text-slate-600 italic">-</span>}
                          </td>
                          <td className="p-3.5 text-right">
                            <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                              row.status === 'new' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' :
                              row.status === 'update' ? 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400' :
                              row.status === 'duplicate' ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500' :
                              'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'
                            }`}>
                              {row.status === 'new' ? 'Nuevo' :
                               row.status === 'update' ? 'Modifica' :
                               row.status === 'duplicate' ? 'Ignorado' : 'Sin Nombre'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ACTION ROW IN PREVIEW */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-50 dark:border-slate-800">
                <button 
                  onClick={handleReset}
                  className="px-5 py-3 border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-300 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition"
                >
                  <RefreshCw size={14} /> Cargar Otro
                </button>

                <button 
                  onClick={handleExecuteImport}
                  className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition shadow-lg active:scale-[0.98]"
                >
                  <Check size={14} /> Importar {parsedRows.filter(r => r.selected).length} Alumnos
                </button>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
};
