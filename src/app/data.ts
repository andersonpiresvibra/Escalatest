export interface Training {
  id?: number;
  title: string;
  completion_date: string;
  expiration_date?: string | null;
  status: 'CONCLUÍDO' | 'EXPIRADO' | 'EM_CURSO';
}

export interface Course {
  id?: number;
  name: string;
  institution: string;
  issue_date: string;
  certificate_code?: string | null;
}

export interface Collaborator {
  id: string;
  name: string;
  role: string;
  schedule: string;
  group: 'Manhã' | 'Tarde' | 'Madrugada' | 'Líderes' | 'Treinamento' | 'VIP';
  shift: 'MANHÃ' | 'TARDE' | 'MADRUGADA' | 'ADMINISTRATIVO' | 'NOITE' | 'TESTE';
  sector: string;
  bhBalance: number;
  score: number;
  importantDates: { label: string; date: string; priority: number }[];
  trainings?: Training[];
  courses?: Course[];
}

export interface ShiftCell {
  collaboratorId: string;
  day: number;
  month: number;
  year: number;
  value: string;
}

export interface TradeRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requestedDay: number;
  targetId: string;
  targetName: string;
  targetDay: number;
  status: 'SOLICITADO' | 'COLEGA_ACEITOU' | 'LT_VALIDOU' | 'SUPERVISOR_HOMOLOGADO' | 'REJEITADO';
  timestamp: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
}

export interface ShiftType {
  code: string;
  label: string;
  color: string;
  discounts: boolean;
  category?: 'FOLGAS' | 'FERIAS' | 'CURSOS_TREINAMENTO' | 'REUNIOES' | 'AFASTAMENTO_SAUDE' | 'AUSENCIA_INJUSTIFICADA' | 'TURNO';
  cannotDelete?: boolean;
  colorName?: string;
}

export function getSiglaColor(code: string, siglaTypes: ShiftType[] = []): string {
  if (!code) return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/50';
  if (code.includes(' ')) return 'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-900 border-blue-300 font-bold';
  const found = siglaTypes.find(s => s.code === code);
  if (found) return found.color;
  if (!isNaN(Number(code))) return 'bg-violet-100 text-violet-800 border-violet-300 font-semibold';
  return 'bg-slate-100 text-slate-700 border-slate-300';
}

export function getSiglaLabel(code: string, siglaTypes: ShiftType[] = []): string {
  if (!code) return 'Trabalho Normal';
  if (code.includes(' ')) return `Histórico Duplo: ${code}`;
  const found = siglaTypes.find(s => s.code === code);
  if (found) return found.label;
  if (!isNaN(Number(code))) return `Troca de horário: Turno ${code}h`;
  return code;
}

export function generateInitialGrid(collaborators: Collaborator[], year = new Date().getFullYear(), month = new Date().getMonth() + 1): ShiftCell[] {
  const g: ShiftCell[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  collaborators.forEach(col => {
    for (let day = 1; day <= daysInMonth; day++) {
      g.push({
        collaboratorId: col.id,
        day,
        month,
        year,
        value: ''
      });
    }
  });
  return g;
}

export function isWeekday(day: number, month = new Date().getMonth() + 1, year = new Date().getFullYear()): boolean {
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  return dayOfWeek !== 0 && dayOfWeek !== 6; 
}

export function isHoliday(day: number, month = new Date().getMonth() + 1, year = new Date().getFullYear()): boolean {
  if (month === 3) {
    const holidays = [6, 25]; 
    return holidays.includes(day);
  }
  return false;
}

export function getHolidayName(day: number, month = new Date().getMonth() + 1, year = new Date().getFullYear()): string | null {
  if (month === 3) {
    if (day === 6) return 'Feriado: Data Magna (PE)';
    if (day === 25) return 'Feriado: Data Magna (CE)';
  }
  return null;
}

export function normalizeCellValue(value: string | null | undefined): string {
  return (value || '').trim().toUpperCase();
}

export function isAlternativeWorkHour(value: string | null | undefined): boolean {
  const val = normalizeCellValue(value);
  return ['5', '7', '21'].includes(val);
}

export function isRegularWork(value: string | null | undefined): boolean {
  const val = normalizeCellValue(value);
  return val === '' || val === 'T';
}

export function isActiveCellValue(value: string | null | undefined): boolean {
  const val = normalizeCellValue(value);
  if (val === '' || val === 'T') return true;
  if (['5', '7', '21'].includes(val)) return true;
  return false;
}

export function isFixedAbsenceValue(value: string | null | undefined): boolean {
  const val = normalizeCellValue(value);
  const fixed = ['F', 'AT', 'EX', 'FO', 'CP', 'TA', 'LI', 'W', 'CV'];
  if (fixed.includes(val)) return true;
  if (val.includes(' ')) return true;
  if (['5', '7', '21'].includes(val)) return true;
  return false;
}

export function isRestDayForTarget(value: string | null | undefined): boolean {
  const val = normalizeCellValue(value);
  if (['X', 'F', 'AT', 'FO', 'BH', 'EX'].includes(val)) return true;
  if (val.includes('X') || val.includes('FO') || val.includes('BH') || val.includes('AT') || val.includes('F')) return true;
  return false;
}

export function isWorkDayForFatigue(value: string | null | undefined): boolean {
  return isActiveCellValue(value);
}

export function checkContingentViolation(
  day: number,
  month: number,
  year: number,
  grid: ShiftCell[],
  collaborators: Collaborator[],
  shiftFilter = 'MANHÃ'
): { activeCount: number; required: number; isViolated: boolean } {
  let normalizedFilter = (shiftFilter || 'MANHÃ').toUpperCase();
  if (normalizedFilter === 'MADRUGADA') normalizedFilter = 'NOITE';
  if (normalizedFilter === 'ADMINISTRATIVO') normalizedFilter = 'TESTE';
  
  let targetCollabs = normalizedFilter === 'TODOS'
    ? collaborators
    : collaborators.filter(c => {
        const cShift = c.shift === 'MADRUGADA' ? 'NOITE' : (c.shift === 'ADMINISTRATIVO' ? 'TESTE' : c.shift);
        return cShift === normalizedFilter;
      });
      
  targetCollabs = targetCollabs.filter(c => c.role !== 'LIDER' && c.sector !== 'VIP');
      
  const targetCollabIds = new Set(targetCollabs.map(c => c.id));
  
  let activeCount = 0;
  grid.forEach(cell => {
    if (cell.day === day && cell.month === month && cell.year === year && targetCollabIds.has(cell.collaboratorId)) {
      if (isActiveCellValue(cell.value)) {
        activeCount++;
      }
    }
  });

  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay(); 
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  let required = 0;
  if (normalizedFilter === 'NOITE' || normalizedFilter === 'MADRUGADA') {
    required = (dayOfWeek === 6) ? 5 : 6;
  } else if (normalizedFilter === 'MANHÃ') {
    required = isWeekend ? 18 : 22;
  } else if (normalizedFilter === 'TARDE') {
    required = isWeekend ? 12 : 15;
  } else if (normalizedFilter === 'TESTE' || normalizedFilter === 'ADMINISTRATIVO') {
    required = isWeekend ? 0 : 2;
  } else {
    required = isWeekend ? 35 : 43;
  }
  
  const isViolated = activeCount < required;
  return { activeCount, required, isViolated };
}
