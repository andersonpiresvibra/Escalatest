import { Component, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScaleService, Collaborator, ShiftType, SpecialDate, FolgaRequest } from './scale.service';
import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

interface AppNotification {
  id: string;
  type: 'publish' | 'alert' | 'trade';
  message: string;
  timestamp: string;
  read: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
  host: {
    '(document:fullscreenchange)': 'onFullscreenChange()',
    '(document:click)': 'onDocumentClick($event)',
    '(window:resize)': 'onResize()'
  }
})
export class App {

  onResize() {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      if (this.activeSubTab() !== 'portal') {
        this.activeSubTab.set('portal');
      }
    }
  }
  public scaleService = inject(ScaleService);

  // Theme & Fullscreen states
  public isLightTheme = signal<boolean>(true);
  public isFullscreen = signal<boolean>(false);
  public portalSequenceTab = signal<'weeks' | 'stretches'>('weeks');
  public portalWidgetTab = signal<'trabalho' | 'semanas'>('trabalho');

  public setPortalSequenceTab(tab: 'weeks' | 'stretches'): void {
    this.portalSequenceTab.set(tab);
  }

  public setPortalWidgetTab(tab: 'trabalho' | 'semanas'): void {
    this.portalWidgetTab.set(tab);
  }

  public toggleTheme(): void {
    const val = !this.isLightTheme();
    this.isLightTheme.set(val);
    if (val) {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }

  public onFullscreenChange(): void {
    this.isFullscreen.set(!!document.fullscreenElement);
  }

  public onDocumentClick(event: MouseEvent): void {
    this.isDropdownOpen.set(false);
    this.isMonthPickerOpen.set(false);
    this.isMatrixOptionsOpen.set(false);
    this.isNotificationOpen.set(false);
  }

  public toggleNotificationMenu(event: MouseEvent): void {
    event.stopPropagation();
    const current = this.isNotificationOpen();
    this.isDropdownOpen.set(false);
    this.isMonthPickerOpen.set(false);
    this.isMatrixOptionsOpen.set(false);
    this.isNotificationOpen.set(!current);
  }

  public toggleDropdownMenu(event: MouseEvent): void {
    event.stopPropagation();
    const current = this.isDropdownOpen();
    this.isMonthPickerOpen.set(false);
    this.isMatrixOptionsOpen.set(false);
    this.isNotificationOpen.set(false);
    this.isDropdownOpen.set(!current);
  }

  public toggleMonthPickerMenu(event: MouseEvent): void {
    event.stopPropagation();
    const current = this.isMonthPickerOpen();
    this.isDropdownOpen.set(false);
    this.isMatrixOptionsOpen.set(false);
    this.isNotificationOpen.set(false);
    this.isMonthPickerOpen.set(!current);
  }

  public toggleMatrixOptionsMenu(event: MouseEvent): void {
    event.stopPropagation();
    const current = this.isMatrixOptionsOpen();
    this.isDropdownOpen.set(false);
    this.isMonthPickerOpen.set(false);
    this.isNotificationOpen.set(false);
    this.isMatrixOptionsOpen.set(!current);
  }

  public toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request failed:', err);
        // Fallback toggle
        this.isFullscreen.set(!this.isFullscreen());
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.warn('Exit fullscreen failed:', err);
      });
    }
  }

  // Sub tab navigation: 'matrix' | 'ger.turnos' | 'siglas' | 'team' | 'team-mgmt' | 'portal' | 'dashboard'
  public activeSubTab = signal<'matrix' | 'ger.turnos' | 'siglas' | 'team' | 'team-mgmt' | 'portal' | 'dashboard'>('matrix');
  
  public teamViewMode = signal<'gallery' | 'mgmt'>('gallery');
  public editingCollab = signal<Collaborator | null>(null);
  public isPortalCollabListOpen = signal<boolean>(false);
  public isPortalRulesOpen = signal<boolean>(false);
  public isPortalEditingDates = signal<boolean>(false);
  
  public daysArray = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  public monthsArray = [
    { value: '01', label: 'Jan' },
    { value: '02', label: 'Fev' },
    { value: '03', label: 'Mar' },
    { value: '04', label: 'Abr' },
    { value: '05', label: 'Mai' },
    { value: '06', label: 'Jun' },
    { value: '07', label: 'Jul' },
    { value: '08', label: 'Ago' },
    { value: '09', label: 'Set' },
    { value: '10', label: 'Out' },
    { value: '11', label: 'Nov' },
    { value: '12', label: 'Dez' }
  ];

  public getDayFromDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return parts[2];
    } else if (parts.length === 2) {
      return parts[1];
    }
    return '';
  }

  public getMonthFromDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return parts[1];
    } else if (parts.length === 2) {
      return parts[0];
    }
    return '';
  }
  public isCollabModalOpen = signal<boolean>(false);
  public isNewSectorMode = signal<boolean>(false);
  public isNewRoleMode = signal<boolean>(false);
  public newCollabPhotoData = signal<string | null>(null);

  public openCreateCollabModal(): void {
    this.editingCollab.set(null);
    this.newCollabPhotoData.set(null);
    this.isCollabModalOpen.set(true);
    this.isNewSectorMode.set(false);
    this.isNewRoleMode.set(false);
  }

  // Simulated Day of Month (1 to 30) for Folga request window check
  simulatedDayOfMonth = signal<number>(5);

  // New Collaborator Registration Fields
  newCollabBirthday = signal<string>('');
  newCollabSpecialDates = signal<SpecialDate[]>([
    { description: '', date: '', priority: 1 },
    { description: '', date: '', priority: 2 },
    { description: '', date: '', priority: 3 },
    { description: '', date: '', priority: 4 },
    { description: '', date: '', priority: 5 }
  ]);

  // Selected collaborator for detailed profile view
  selectedProfileCollabId = signal<string | null>(null);

  // Modal for day details and scheduled list
  public isDayDetailsModalOpen = signal<boolean>(false);
  public selectedDetailDay = signal<number | null>(null);
  public selectedDetailCollab = signal<any | null>(null);
  public dayDetailsActiveTab = signal<'seu_turno' | 'turno_posterior' | 'geral'>('seu_turno');
  public selectedCalendarDay = signal<number>(new Date().getDate());

  public openCollabProfile(id: string): void {
    this.selectedProfileCollabId.set(id);
    this.teamViewMode.set('gallery');
    this.activeSubTab.set('team');
  }

  // Computes the active collaborator, falling back to the first one in the list
  selectedProfileCollab = computed<any>(() => {
    const list = this.scaleService.collaborators();
    if (list.length === 0) return null;
    const id = this.selectedProfileCollabId();
    if (id) {
      const found = list.find(c => c.id === id);
      if (found) return found;
    }
    return list[0]; // fallback to first
  });

  // Dynamically computes stats, fatigue indexes, and shift hours for the selected collaborator
  collabStats = computed(() => {
    return this.calculateStatsForCollab(this.selectedProfileCollab());
  });

  // Dynamically computes team-wide fatigue and energy statistics for the entire organization
  teamStats = computed(() => {
    const list = this.scaleService.collaborators();
    if (list.length === 0) {
      return {
        avgEnergy: 0,
        critCount: 0,
        limitCount: 0,
        totalHours: 0
      };
    }
    
    let totalEnergy = 0;
    let critCount = 0;
    let limitCount = 0;
    let totalHours = 0;
    
    list.forEach(collab => {
      const data = this.scaleService.calculateEnergyAndFatigue(collab);
      totalEnergy += data.energy;
      totalHours += data.totalHoursWorked;
      if (data.energy < 30) {
        critCount++;
      }
      if (data.alertaLimite) {
        limitCount++;
      }
    });
    
    return {
      avgEnergy: Math.round(totalEnergy / list.length),
      critCount,
      limitCount,
      totalHours: parseFloat(totalHours.toFixed(1))
    };
  });

  isSiglaAbsence(val: string): boolean {
    const upper = (val || '').toUpperCase().trim();
    if (!upper || upper === '-' || upper === '?') return false;
    
    // Base standard rest codes
    if (upper === 'X' || upper === 'BH' || upper === 'F' || upper === 'LM' || upper === 'CP' || upper === 'AT' || upper === 'W' || upper === 'FO' || upper === 'P' || upper === 'R' || upper === 'EX') {
      return true;
    }
    
    // Dynamic check
    const sigla = this.scaleService.siglaTypes().find(s => s.code.toUpperCase().trim() === upper);
    if (sigla && sigla.computaAusencia) {
      return true;
    }
    
    return false;
  }

  // Reusable method to calculate stats for any collaborator
  calculateStatsForCollab(collab: Collaborator | null) {
    if (!collab) return null;

    const scale = collab.scale || {};
    let workDays = 0;
    let offDays = 0;
    
    // Calculate sequences
    let currentWorkStreak = 0;
    let maxWorkStreak = 0;
    
    let currentOffStreak = 0;
    let maxOffStreak = 0;

    const defaultCode = this.getShiftCode(collab.shift);
    for (let d = 1; d <= 30; d++) {
      const rawVal = scale[d] || '-';
      const val = (rawVal === '-') ? defaultCode : rawVal;
      
      // Use dynamic absence check
      const isRest = this.isSiglaAbsence(val);
      
      if (!isRest) {
        workDays++;
        currentWorkStreak++;
        maxWorkStreak = Math.max(maxWorkStreak, currentWorkStreak);
        
        currentOffStreak = 0;
      } else {
        offDays++;
        currentOffStreak++;
        maxOffStreak = Math.max(maxOffStreak, currentOffStreak);
        
        currentWorkStreak = 0;
      }
    }

    // Fatigue classification
    let fatigueRisk: 'Baixo' | 'Moderado' | 'Crítico' = 'Baixo';
    let fatigueColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    let fatigueDescription = 'Ciclo de descanso balanceado. Excelente recuperação biológica.';

    if (maxWorkStreak >= 6) {
      fatigueRisk = 'Crítico';
      fatigueColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20 animate-pulse';
      fatigueDescription = 'Risco elevado de fadiga acumulada. Sequência contínua de ' + maxWorkStreak + ' dias no pátio. Recomenda-se escala de folga imediata para evitar incidentes operacionais.';
    } else if (maxWorkStreak === 5) {
      fatigueRisk = 'Moderado';
      fatigueColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      fatigueDescription = 'Atenção. Sequência de 5 dias trabalhados. Nível de alerta operacional intermediário.';
    }

    // Map shift to times dynamically
    let entryTime = '07:00';
    let exitTime = '15:20';
    const sCode = (collab.shift || '').trim().toUpperCase();
    const shiftType = this.scaleService.shiftTypes().find(s => 
      s.code.trim().toUpperCase() === sCode || 
      s.label.trim().toUpperCase() === sCode
    );
    if (shiftType && shiftType.startTime && shiftType.endTime) {
      entryTime = shiftType.startTime;
      exitTime = shiftType.endTime;
    } else {
      if (sCode === 'MANHÃ' || sCode === 'M') {
        entryTime = '06:00';
        exitTime = '14:00';
      } else if (sCode === 'TARDE' || sCode === 'T') {
        entryTime = '14:00';
        exitTime = '22:00';
      } else if (sCode === 'MADRUGADA' || sCode === 'NOITE' || sCode === 'N') {
        entryTime = '22:00';
        exitTime = '06:00';
      } else if (sCode === 'ADMINISTRATIVO' || sCode === 'ADM') {
        entryTime = '08:00';
        exitTime = '17:00';
      }
    }

    return {
      workDays,
      offDays,
      maxWorkStreak,
      maxOffStreak,
      fatigueRisk,
      fatigueColor,
      fatigueDescription,
      entryTime,
      exitTime
    };
  }

  getShiftCode(s: string): string {
    const norm = (s || '').toUpperCase().trim();
    const foundByCode = this.scaleService.shiftTypes().find(st => st.code.toUpperCase().trim() === norm);
    if (foundByCode) return foundByCode.code;

    const foundByLabel = this.scaleService.shiftTypes().find(st => st.label.toUpperCase().trim() === norm);
    if (foundByLabel) return foundByLabel.code;

    return norm;
  }

    getShiftLabel(collab: any): string {
    if (!collab || !collab.shift) return '-';
    const sCode = collab.shift.trim().toUpperCase();
    const shiftType = this.scaleService.shiftTypes().find(s => 
      s.code.trim().toUpperCase() === sCode || 
      s.label.trim().toUpperCase() === sCode
    );
    return shiftType ? shiftType.label : collab.shift;
  }

  getCollabHours(collab: any): string {
    if (collab && collab.hours) {
      return collab.hours;
    }
    if (!collab) return '07:00-15:20';
    const sCode = (collab.shift || '').trim().toUpperCase();
    const shiftType = this.scaleService.shiftTypes().find(s => 
      s.code.trim().toUpperCase() === sCode || 
      s.label.trim().toUpperCase() === sCode
    );
    if (shiftType && shiftType.startTime && shiftType.endTime) {
      return `${shiftType.startTime}-${shiftType.endTime}`;
    }
    
    if (sCode === 'MANHÃ' || sCode === 'M') {
      return '06:00-14:00';
    } else if (sCode === 'TARDE' || sCode === 'T') {
      return '14:00-22:00';
    } else if (sCode === 'MADRUGADA' || sCode === 'NOITE' || sCode === 'N') {
      return '22:00-06:00';
    } else if (sCode === 'ADMINISTRATIVO' || sCode === 'ADM') {
      return '08:00-17:00';
    }
    return '07:00-15:20';
  }

  getCollabScheduleRange(collab: any): string {
    if (!collab) return '';
    const hours = collab.hours || '';
    if (hours.includes('-')) {
      return hours.replace('-', 'às');
    }
    return hours;
  }

  getCollabPhoto(collab: any): string {
    if (collab && (collab.photoUrl || collab.photo)) {
      return collab.photoUrl || collab.photo;
    }
    const isLight = this.isLightTheme();
    const bgFill = isLight ? '#f1f5f9' : '#0b1a30';
    const borderStroke = isLight ? '#cbd5e1' : '#10213b';
    
    const msnAvatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="50" fill="${bgFill}" stroke="${borderStroke}" stroke-width="1.5" />
  <g transform="translate(0, 4)">
    <circle cx="40" cy="38" r="12" fill="#0080C0" />
    <path d="M 40 38 A 12 12 0 0 1 52 38 A 9 9 0 0 0 40 38 Z" fill="#3399FF" opacity="0.5"/>
    <path d="M 40 52 C 22 52, 16 78, 16 84 L 64 84 C 64 78, 58 52, 40 52 Z" fill="#0080C0" />
    <path d="M 40 52 C 27 52, 20 68, 18 78 C 25 65, 36 56, 40 56 C 44 56, 55 65, 62 78 C 60 68, 53 52, 40 52 Z" fill="#3399FF" opacity="0.5"/>
    <circle cx="62" cy="44" r="12" fill="#74C322" />
    <path d="M 62 44 A 12 12 0 0 1 74 44 A 9 9 0 0 0 62 44 Z" fill="#9CE146" opacity="0.6"/>
    <path d="M 62 58 C 44 58, 38 84, 38 90 L 86 90 C 86 84, 80 58, 62 58 Z" fill="#74C322" stroke="${bgFill}" stroke-width="2" />
    <path d="M 62 58 C 44 58, 42 74, 40 84 C 47 71, 58 62, 62 62 C 66 62, 77 71, 84 84 C 82 74, 75 58, 62 58 Z" fill="#9CE146" opacity="0.5"/>
  </g>
</svg>`;

    return 'data:image/svg+xml;utf8,' + encodeURIComponent(msnAvatarSvg);
  }

  // Real-time aviation clock
  currentTimeString = signal<string>('');

  // Dropdowns & Modals states
  public isDropdownOpen = signal<boolean>(false);
  public isMatrixOptionsOpen = signal<boolean>(false);
  public isNotificationOpen = signal<boolean>(false);
  public isAuthModalOpen = signal<boolean>(false);
  public authMode = signal<'LOGIN' | 'SIGNUP'>('LOGIN');
  public isImportModalOpen = signal<boolean>(false);
  public isDbModalOpen = signal<boolean>(false);
  public isSolicitarFolgaModalOpen = signal<boolean>(false);
  public folgaModalSelectedDay = signal<number | null>(null);

  isFolgaRequestPeriodOpen(): boolean {
    const today = this.simulatedDayOfMonth();
    return today >= 1 && today <= 10;
  }

  getNextMonthIndex(): number {
    return (this.selectedMonthIndex() + 1) % 12;
  }

  getNextMonthYear(): number {
    return this.selectedMonthIndex() === 11 ? this.currentYear() + 1 : this.currentYear();
  }

  getNextMonthCalendarDays(): any[] {
    const year = this.getNextMonthYear();
    const month = this.getNextMonthIndex();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday
    
    const days = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ empty: true });
    }
    
    const dateStrPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    const collabs = this.scaleService.collaborators();
    const logged = this.getLoggedCollab();
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = dateStrPrefix + String(d).padStart(2, '0');
      
      const requesters = collabs.filter(c => 
        (c.folgaRequests || []).some(r => r.date === dateStr)
      );
      
      const hasRequested = logged ? requesters.some(r => r.id === logged.id) : false;
      
      days.push({
        empty: false,
        day: d,
        dateStr: dateStr,
        requesters: requesters,
        hasRequested: hasRequested,
        isFull: requesters.length >= 3 && !hasRequested,
        count: requesters.length
      });
    }
    
    return days;
  }

  // Database Connection Indicator
  dbStatus = signal<'checking' | 'connected' | 'error'>('connected');

  // Toast System
  toastMessage = signal<string | null>(null);

  // Paintbrush Mass Edit Mode
  showPaintbrushPanel = signal<boolean>(false);
  activePaintbrush = signal<string | null>(null);

  // Row-level inline editing signals
  editingRowCollabId = signal<string | null>(null);
  editingRowScaleDraft = signal<{ [day: number]: string }>({});

  // Filter systems
  collabSearchQuery = signal<string>('');
  selectedFilterRole = signal<string>('TODOS');
  selectedFilterSector = signal<string>('TODOS');
  selectedFilterShift = signal<string>('TODOS');

  // Dynamic database-driven filter options (Single Source of Truth)
  availableSectors = computed(() => {
    const collabs = this.scaleService.collaborators();
    const sectorsSet = new Set<string>(['Geral']);
    collabs.forEach(c => {
      if (c.sector) {
        const s = c.sector.trim();
        if (s) sectorsSet.add(s);
      }
    });
    return Array.from(sectorsSet).sort((a, b) => a.localeCompare(b));
  });

  availableRoles = computed(() => {
    const collabs = this.scaleService.collaborators();
    const rolesSet = new Set<string>(['OPERADOR', 'LIDER', 'SUPERVISOR']);
    collabs.forEach(c => {
      if (c.role) {
        const r = c.role.trim();
        if (r) rolesSet.add(r);
      }
    });
    return Array.from(rolesSet).sort((a, b) => a.localeCompare(b));
  });

  availableShifts = computed(() => {
    return this.scaleService.shiftTypes();
  });

  // Dedicated filters and sorting for "Quadro de Colaboradores" admin table
  adminSearchQuery = signal<string>('');
  adminFilterRole = signal<string>('TODOS');
  adminFilterShift = signal<string>('TODOS');
  adminSortOrder = signal<'asc' | 'desc'>('asc');

  // Computed stats counters
  collaboratorsCountByShift = computed(() => {
    const collabs = this.scaleService.collaborators();
    const counts: { [key: string]: number } = { 'MANHÃ': 0, 'TARDE': 0, 'MADRUGADA': 0, 'ADMINISTRATIVO': 0, 'NOITE': 0 };
    collabs.forEach(c => {
      const s = (c.shift || '').toUpperCase().trim();
      if (s.startsWith('MANHÃ') || s.startsWith('MANHA') || s === 'M') {
        counts['MANHÃ']++;
      } else if (s.startsWith('TARDE') || s === 'T') {
        counts['TARDE']++;
      } else if (s.startsWith('MADRUGADA') || s.startsWith('NOITE') || s === 'N') {
        counts['NOITE']++;
      } else if (s.startsWith('ADMINISTRATIVO') || s === 'ADM') {
        counts['ADMINISTRATIVO']++;
      } else {
        if (s in counts) {
          counts[s]++;
        } else {
          counts['MANHÃ']++;
        }
      }
    });
    return counts;
  });

  dailyAvailableCollaborators = computed(() => {
    const days = this.daysInMonth();
    const collabs = this.filteredCollaborators();
    
    const availableCountByDay: { [day: number]: number } = {};
    
    days.forEach(day => {
      let count = 0;
      collabs.forEach(c => {
        const val = c.scale[day] || '-';
        // Only count as available if it's NOT an absence AND NOT a blank day ('-')
        const isAbsence = this.isSiglaAbsence(val);
        const isBlank = val === '-';
        if (!isAbsence && !isBlank) {
          count++;
        }
      });
      availableCountByDay[day] = count;
    });
    
    return availableCountByDay;
  });

  public selectedDailyDashDay = signal<number>(new Date().getDate());

  dailyDashSummary = computed(() => {
    const day = this.selectedDailyDashDay();
    const collabs = this.scaleService.collaborators();
    const shifts = this.scaleService.shiftTypes();
    const siglas = this.scaleService.siglaTypes();
    
    // Grouping
    const working: Array<{collab: any, shift: any, val: string, energy: number}> = [];
    const absent: Array<{collab: any, sigla: any, val: string}> = [];
    const unknown: Array<{collab: any, val: string}> = [];

    const getEnergy = (collab: any, targetDay: number) => {
      let streak = 0;
      for (let d = targetDay; d >= 1; d--) {
        const v = collab.scale[d] || '-';
        if (!this.isSiglaAbsence(v) && v !== '-') {
          streak++;
        } else {
          break;
        }
      }
      return Math.max(10, 100 - ((streak - 1) * 20));
    };

    collabs.forEach(c => {
      const val = (c.scale[day] || '-').trim().toUpperCase();
      if (val === '-') {
        unknown.push({collab: c, val});
      } else if (this.isSiglaAbsence(val)) {
        const sigla = siglas.find(s => s.code.toUpperCase() === val) || null;
        absent.push({collab: c, sigla, val});
      } else {
        const shift = shifts.find(s => s.code.toUpperCase() === val) || null;
        working.push({collab: c, shift, val, energy: getEnergy(c, day)});
      }
    });

    const workingByShift: { [shiftCode: string]: { shift: any, items: typeof working } } = {};
    working.forEach(w => {
      const code = w.shift ? w.shift.code : w.val;
      if (!workingByShift[code]) {
        workingByShift[code] = { shift: w.shift, items: [] };
      }
      workingByShift[code].items.push(w);
    });

    const absentBySigla: { [siglaCode: string]: { sigla: any, items: typeof absent } } = {};
    absent.forEach(a => {
      const code = a.sigla ? a.sigla.code : a.val;
      if (!absentBySigla[code]) {
        absentBySigla[code] = { sigla: a.sigla, items: [] };
      }
      absentBySigla[code].items.push(a);
    });

    return {
      day,
      working,
      absent,
      unknown,
      workingByShift: Object.values(workingByShift).sort((a,b) => (a.shift?.code || '').localeCompare(b.shift?.code || '')),
      absentBySigla: Object.values(absentBySigla).sort((a,b) => (a.sigla?.code || '').localeCompare(b.sigla?.code || ''))
    };
  });

  collaboratorsCountBySector = computed(() => {
    const collabs = this.scaleService.collaborators();
    const counts: { [key: string]: number } = {
      'GERAL': 0,
      'GESTÃO': 0,
      'CENTRAL': 0,
      'AERÓDROMO': 0,
      'VIP': 0,
      'TESTE': 0,
      'MANUTENÇÃO': 0
    };
    collabs.forEach(c => {
      let s = (c.sector || '').toUpperCase().trim();
      if (s === 'GESTAO') s = 'GESTÃO';
      if (s === 'MANUTENCAO') s = 'MANUTENÇÃO';
      if (s === 'AERODROMO') s = 'AERÓDROMO';
      if (s) {
        if (s in counts) {
          counts[s]++;
        } else {
          counts[s] = 1;
        }
      }
    });
    return counts;
  });

  // Signals and helper methods for selected collaborator details (Important Dates, Folgas, Team of the Day)
  selectedCollabTeamDayTab = signal<'today' | 'tomorrow' | 'other'>('today');
  selectedCollabTeamDayOther = signal<number>(new Date().getDate());

  // --- Long Press Edit Dates Logic ---
  private datesLongPressTimer: any;
  public editingSpecialDates = signal<{date: string, description: string, priority: number}[]>([]);

  onImportantDatesPointerDown(event: Event) {
    this.datesLongPressTimer = setTimeout(() => {
      this.isPortalEditingDates.set(true);
      const logged = this.getLoggedCollab();
      if (logged) {
         const currentDates = JSON.parse(JSON.stringify(logged.specialDates || []));
         this.editingSpecialDates.set(currentDates);
      }
    }, 2000);
  }

  onImportantDatesPointerUp() {
    if (this.datesLongPressTimer) {
      clearTimeout(this.datesLongPressTimer);
    }
  }

  updateSpecialDateRow(index: number, field: 'date' | 'description', value: string) {
    this.editingSpecialDates.update(dates => {
      const newDates = [...dates];
      newDates[index] = { ...newDates[index], [field]: value };
      return newDates;
    });
  }

  addSpecialDateRow() {
    this.editingSpecialDates.update(dates => [...dates, { date: '', description: '', priority: 1 }]);
  }

  removeSpecialDateRow(index: number) {
    this.editingSpecialDates.update(dates => {
      const newDates = [...dates];
      newDates.splice(index, 1);
      return newDates;
    });
  }

  saveSpecialDates() {
    const logged = this.getLoggedCollab();
    if (!logged) return;
    const validDates = this.editingSpecialDates().filter(d => d.date && d.description);
    const updated = {
       ...logged,
       specialDates: validDates
    };
    this.scaleService.updateCollaborator(updated);
    this.isPortalEditingDates.set(false);
    this.showToast('Datas importantes atualizadas com sucesso!');
  }

  getImportantDatesForCollab(collab: any): { dateLabel: string; label: string; icon: string; color: string; details: string; priorityLabel?: string; rawDate: string; isBirthday?: boolean; priorityValue?: number }[] {
    if (!collab) return [];
    const dates: { dateLabel: string; label: string; icon: string; color: string; details: string; priorityLabel?: string; rawDate: string; isBirthday?: boolean; priorityValue?: number }[] = [];
    
    // Birthday
    if (collab.birthday) {
      const parts = collab.birthday.split('-');
      if (parts.length === 3) {
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        
        dates.push({
          dateLabel: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
          label: 'Aniversário',
          icon: 'cake',
          color: 'text-rose-500 bg-rose-500/10 border-rose-500/20 text-rose-500',
          details: 'Folga regulamentar assegurada',
          rawDate: collab.birthday,
          isBirthday: true,
          priorityValue: 0 // Highest priority
        });
      }
    }

    // Special dates
    if (collab.specialDates && Array.isArray(collab.specialDates)) {
      for (const sd of collab.specialDates) {
        if (!sd.date || !sd.description) continue;
        const parts = sd.date.split('-');
        if (parts.length === 3) {
          const m = parseInt(parts[1], 10);
          const d = parseInt(parts[2], 10);
          const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
          
          const descLower = sd.description.toLowerCase();
          let icon = 'celebration';
          let color = 'text-amber-500 bg-amber-500/10 border-amber-500/20 text-amber-500';
          
          if (descLower.includes('casamento') || descLower.includes('aliança') || descLower.includes('alianca') || descLower.includes('wedding') || descLower.includes('bodas') || descLower.includes('marido') || descLower.includes('esposa') || descLower.includes('conjuge') || descLower.includes('cônjuge') || descLower.includes('noivado')) {
            icon = 'favorite';
            color = 'text-red-500 bg-red-500/10 border-red-500/20 text-red-500';
          } else if (descLower.includes('filho') || descLower.includes('filha') || descLower.includes('criança') || descLower.includes('crianca') || descLower.includes('bebe') || descLower.includes('bebê') || descLower.includes('nascimento') || descLower.includes('child') || descLower.includes('baby') || descLower.includes('maternidade') || descLower.includes('paternidade')) {
            icon = 'child_care';
            color = 'text-blue-500 bg-blue-500/10 border-blue-500/20 text-blue-500';
          }

          dates.push({
            dateLabel: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
            label: sd.description,
            icon,
            color,
            details: 'Preferência de escala',
            priorityLabel: `P${sd.priority || 1}`,
            rawDate: sd.date,
            isBirthday: false,
            priorityValue: sd.priority || 1
          });
        }
      }
    }

    return dates.sort((a, b) => (a.priorityValue || 0) - (b.priorityValue || 0));
  }

  getRequestedFolgasForCollab(collab: any): { day: number; formattedDate: string; isApproved: boolean; count: number; details: string }[] {
    if (!collab || !collab.folgaRequests || !Array.isArray(collab.folgaRequests)) return [];
    
    const result: { day: number; formattedDate: string; isApproved: boolean; count: number; details: string }[] = [];
    
    for (const fr of collab.folgaRequests) {
      if (!fr.date) continue;
      const parts = fr.date.split('-');
      if (parts.length === 3) {
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        const count = this.getFolgaRequestCount(d);
        const scaleVal = collab.scale ? (collab.scale[d] || 'X') : 'X';
        const isApproved = scaleVal === 'F';
        
        if (isApproved) continue; // Do not show approved ones
        
        result.push({
          day: d,
          formattedDate: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
          isApproved,
          count,
          details: 'Pendente'
        });
      }
    }
    
    return result.sort((a, b) => a.day - b.day);
  }

  getFolgaRequestSlots(collab: any) {
    const requests = this.getRequestedFolgasForCollab(collab);
    const slots = [];
    for (let i = 0; i < 3; i++) {
      if (i < requests.length) {
        slots.push({ ...requests[i], isEmpty: false, id: `req-${requests[i].day}` });
      } else {
        slots.push({ isEmpty: true, id: `empty-${i}` });
      }
    }
    return slots;
  }

  getCollabTeamForDay(collab: any, dayOffset: number | 'other'): any[] {
    if (!collab) return [];
    
    let targetDay = new Date().getDate();
    if (dayOffset === 'other') {
      targetDay = this.selectedCollabTeamDayOther();
    } else {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + dayOffset);
      targetDay = targetDate.getDate();
    }
    
    const myShiftCode = this.getCollabEffectiveShiftForDay(collab, targetDay);
    if (!myShiftCode || myShiftCode === 'FOLGA' || !this.isWorkDay(collab, targetDay)) {
      const baseShift = (collab.shift || '').trim().toUpperCase();
      return this.scaleService.collaborators().filter(c => {
        if (!this.isWorkDay(c, targetDay)) return false;
        return this.getCollabEffectiveShiftForDay(c, targetDay) === baseShift;
      });
    }
    
    return this.scaleService.collaborators().filter(c => {
      if (!this.isWorkDay(c, targetDay)) return false;
      return this.getCollabEffectiveShiftForDay(c, targetDay) === myShiftCode;
    });
  }

  getCollabTeamShiftLabelForDay(collab: any, dayOffset: number | 'other'): string {
    if (!collab) return '';
    let targetDay = new Date().getDate();
    if (dayOffset === 'other') {
      targetDay = this.selectedCollabTeamDayOther();
    } else {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + dayOffset);
      targetDay = targetDate.getDate();
    }
    
    const myShiftCode = this.getCollabEffectiveShiftForDay(collab, targetDay);
    const code = (myShiftCode && myShiftCode !== 'FOLGA') ? myShiftCode : (collab.shift || '').trim().toUpperCase();
    const shiftType = this.scaleService.shiftTypes().find(s => s.code.trim().toUpperCase() === code);
    return shiftType ? `${shiftType.label} (${shiftType.code})` : code;
  }

  // Month Selection and Navigation System
  monthsList = [
    { name: 'Janeiro', shortName: 'JAN' },
    { name: 'Fevereiro', shortName: 'FEV' },
    { name: 'Março', shortName: 'MAR' },
    { name: 'Abril', shortName: 'ABR' },
    { name: 'Maio', shortName: 'MAI' },
    { name: 'Junho', shortName: 'JUN' },
    { name: 'Julho', shortName: 'JUL' },
    { name: 'Agosto', shortName: 'AGO' },
    { name: 'Setembro', shortName: 'SET' },
    { name: 'Outubro', shortName: 'OUT' },
    { name: 'Novembro', shortName: 'NOV' },
    { name: 'Dezembro', shortName: 'DEZ' }
  ];

  selectedMonthIndex = signal<number>(new Date().getMonth());
  currentYear = signal<number>(new Date().getFullYear());
  isMonthPickerOpen = signal<boolean>(false);
  showFilters = signal<boolean>(false);

  // Computed properties for the active month
  currentMonthName = computed(() => this.monthsList[this.selectedMonthIndex()].name);
  
  activeFiltersCount = computed(() => {
    let count = 0;
    if (this.collabSearchQuery().trim() !== '') count++;
    if (this.selectedFilterRole() !== 'TODOS') count++;
    if (this.selectedFilterSector() !== 'TODOS') count++;
    if (this.selectedFilterShift() !== 'TODOS') count++;
    return count;
  });

  // Days list for the selected month dynamically calculated as a signal
  daysInMonth = computed(() => {
    const year = this.currentYear();
    const month = this.selectedMonthIndex();
    const count = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => i + 1);
  });

  isWorkStatus(code: string | undefined | null): boolean {
    if (!code) return false;
    const upper = code.trim().toUpperCase();
    if (upper === '-' || upper === '' || upper === '?') return false;
    
    // If it is marked as an absence sigla, it is not a working status
    if (this.isSiglaAbsence(upper)) {
      return false;
    }
    
    // Numbers or shift abbreviations (e.g., M, T, N, ADM) are considered present
    return true;
  }

  dailyWorkingCounts = computed(() => {
    const collabs = this.filteredCollaborators();
    const days = this.daysInMonth();
    const counts: { [day: number]: number } = {};
    
    days.forEach(day => {
      let count = 0;
      collabs.forEach(collab => {
        const rawVal = collab.scale[day] || '-';
        const val = (rawVal === '-') ? this.getShiftCode(collab.shift) : rawVal;
        if (this.isWorkStatus(val)) {
          count++;
        }
      });
      counts[day] = count;
    });
    return counts;
  });

  prevMonth(): void {
    if (this.selectedMonthIndex() === 0) {
      this.selectedMonthIndex.set(11);
      this.currentYear.set(this.currentYear() - 1);
    } else {
      this.selectedMonthIndex.set(this.selectedMonthIndex() - 1);
    }
    this.isMonthPickerOpen.set(false);
  }

  nextMonth(): void {
    if (this.selectedMonthIndex() === 11) {
      this.selectedMonthIndex.set(0);
      this.currentYear.set(this.currentYear() + 1);
    } else {
      this.selectedMonthIndex.set(this.selectedMonthIndex() + 1);
    }
    this.isMonthPickerOpen.set(false);
  }

  selectMonth(index: number): void {
    this.selectedMonthIndex.set(index);
    this.isMonthPickerOpen.set(false);
  }

  // Notifications State
  notifications = signal<AppNotification[]>([
    {
      id: 'n_1',
      type: 'publish',
      message: 'Escala oficial de trabalho publicada para Junho de this.currentYear().',
      timestamp: 'Hoje, 10:15',
      read: false
    },
    {
      id: 'n_2',
      type: 'alert',
      message: 'Aviso: Baixo efetivo no turno da Noite para o Setor Aeródromo.',
      timestamp: 'Hoje, 08:30',
      read: false
    },
    {
      id: 'n_3',
      type: 'trade',
      message: 'Everton Souza solicitou uma permuta de turno com Carlos Alberto para o dia 12.',
      timestamp: 'Ontem, 16:45',
      read: true
    }
  ]);

  // Unread notifications counter
  unreadNotificationsCount = computed(() => {
    return this.notifications().filter(n => !n.read).length;
  });

  // Shift manager editing state
  newShiftCode = signal<string>('');
  newShiftLabel = signal<string>('');
  newShiftHours = signal<string>('7h20');
  newShiftColor = signal<string>('#3b82f6');
  newShiftTextColor = signal<string>('#ffffff');
  editingShiftCode = signal<string | null>(null);

  // Sigla manager editing state
  newSiglaCode = signal<string>('');
  newSiglaLabel = signal<string>('');
  newSiglaColor = signal<string>('#64748b');
  newSiglaTextColor = signal<string>('#ffffff');
  newSiglaDescription = signal<string>('');
  newSiglaComputaAusencia = signal<boolean>(false);
  editingSiglaCode = signal<string | null>(null);

  // Lists for hour and minute dropdowns
  hoursList = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  minutesList = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  // Hour/Minute selectors for shift creation/editing
  startHour = signal<string>('07');
  startMinute = signal<string>('00');
  endHour = signal<string>('16');
  endMinute = signal<string>('00');

  // Computed signal to calculate shift duration automatically (Entrance vs Exit)
  calculatedShiftHours = computed(() => {
    const sH = parseInt(this.startHour(), 10) || 0;
    const sM = parseInt(this.startMinute(), 10) || 0;
    const eH = parseInt(this.endHour(), 10) || 0;
    const eM = parseInt(this.endMinute(), 10) || 0;

    let totalMinutes = 0;
    const startTotal = sH * 60 + sM;
    const endTotal = eH * 60 + eM;

    if (endTotal >= startTotal) {
      totalMinutes = endTotal - startTotal;
    } else {
      // Crosses midnight (e.g. 22:00 to 06:00)
      totalMinutes = (24 * 60 - startTotal) + endTotal;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const padMin = minutes.toString().padStart(2, '0');
    return `${hours}h${padMin}`;
  });

  // Selected collaborator and target shift for quick reallocation
  assignmentCollabId = signal<string>('');
  assignmentShiftCode = signal<string>('');

  // Portal do Colaborador (Frente C)
  selectedSimulatedCollabId = signal<string | null>(null);
  hasInitiallyLogged = signal<boolean>(false);
  collaboratorProfileDarkMode = signal<boolean>(true);

  // Permuta (Trade Shift) simulation state
  isPermutaModalOpen = signal<boolean>(false);
  permutaSelectedDay = signal<number>(1);
  permutaTargetCollabId = signal<string>('');
  permutaStatusMessage = signal<string>('');

  // Gemini Upload & Scan
  importingState = signal<'idle' | 'processing' | 'done'>('idle');
  scannedTextResult = signal<string>('');
  scannedDataParsed = signal<any[]>([]);
  unrecognizedCodes = signal<string[]>([]);

  constructor() {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      this.activeSubTab.set('portal');
    }
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);
    this.showToast('Escala Easy VIBRA - Protótipo MVP Pronto');
    if (typeof document !== 'undefined') {
      document.body.classList.add('light-theme');
    }
    effect(() => {
      const month = this.selectedMonthIndex() + 1;
      this.scaleService.activeMonth.set(month);
      this.scaleService.activeYear.set(this.currentYear()); // Standard this.currentYear() year for UI
      if (this.scaleService.activeDb() === 'supabase') {
        this.scaleService.syncSupabase();
      }
    }, { allowSignalWrites: true });
  }

  // Clock Update Function
  private updateClock() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    this.currentTimeString.set(`${hh}:${mm}:${ss} BRT`);
  }

  // Toast Functionality
  showToast(msg: string) {
    this.toastMessage.set(msg);
    setTimeout(() => {
      if (this.toastMessage() === msg) {
        this.toastMessage.set(null);
      }
    }, 4000);
  }

  // Role Simulator
  

  changeRole(role: 'SUPERVISOR' | 'LIDER' | 'OPERADOR') {
    this.scaleService.currentRole.set(role);
    this.showToast(`Perfil alterado para: ${role === 'LIDER' ? 'LÍDER DE TURNO' : role}`);
  }

  // Presentation Mode: Focus only on Night Shift ("Noite / Madrugada / N")
  onlyNightShift = signal<boolean>(true);

  unlockAllShifts(pin: string) {
    const cleanPin = (pin || '').trim().toLowerCase();
    if (cleanPin === 'vibra' || cleanPin === 'admin' || cleanPin === '1234' || cleanPin === 'noite') {
      this.onlyNightShift.set(false);
      this.showToast('Sucesso: Escalas de todos os turnos liberadas!');
    } else {
      this.showToast('Erro: PIN incorreto. Dica: Tente "vibra", "admin" ou "1234".');
    }
  }

  lockToNightShift() {
    this.onlyNightShift.set(true);
    this.showToast('Visualização restrita ao turno da Noite.');
  }

  // Filters computed list with custom ordering: LTs, Aeródromo, VIP's
  filteredCollaborators = computed(() => {
    const query = this.collabSearchQuery().toLowerCase().trim();
    const role = this.selectedFilterRole();
    const sector = this.selectedFilterSector();
    const shift = this.selectedFilterShift();
    const onlyNight = this.onlyNightShift();

    const filtered = this.scaleService.collaborators().filter(c => {
      // If presentation mode is restricted, filter only Night Shift
      if (onlyNight) {
        const cShift = (c.shift || '').toUpperCase().trim();
        const isNight = cShift === 'MADRUGADA' || cShift === 'NOITE' || cShift === 'N';
        if (!isNight) return false;
      }

      const matchesSearch = c.name.toLowerCase().includes(query) || c.group.toLowerCase().includes(query);
      const matchesRole = role === 'TODOS' || 
        (c.role || '').toUpperCase().trim() === role.toUpperCase().trim();
      const normCollabSector = (c.sector || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const normFilterSector = sector.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const matchesSector = sector === 'TODOS' || normCollabSector === normFilterSector;
      const matchesShift = shift === 'TODOS' || 
        (c.shift || '').toUpperCase().trim() === shift.toUpperCase().trim();
      return matchesSearch && matchesRole && matchesSector && matchesShift;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      const getWeight = (c: any) => {
        if (c.role === 'LIDER') return 1; // LTs first
        const sec = (c.sector || '').toUpperCase().trim();
        if (sec === 'GERAL') return 2;
        if (sec === 'GESTÃO' || sec === 'GESTAO') return 3;
        if (sec === 'CENTRAL') return 4;
        if (sec === 'AERÓDROMO' || sec === 'AERODROMO' || sec === 'OPERACIONAL') return 5;
        if (sec === 'VIP') return 6;
        if (sec === 'TESTE') return 7;
        if (sec === 'MANUTENÇÃO' || sec === 'MANUTENCAO') return 8;
        return 9; // Others
      };
      const wA = getWeight(a);
      const wB = getWeight(b);
      if (wA !== wB) return wA - wB;
      // Secondary sort alphabetically
      return a.name.localeCompare(b.name, 'pt-BR');
    });

    return sorted;
  });

  filteredCounts = computed(() => {
    const list = this.filteredCollaborators();
    const operadores = list.filter(c => c.role === 'OPERADOR').length;
    const lts = list.filter(c => c.role === 'LIDER').length;
    const vips = list.filter(c => {
      const sec = (c.sector || '').toUpperCase();
      return sec === 'VIP';
    }).length;
    return { operadores, lts, vips };
  });

  getCollabFunction(collab: any): string {
    if (!collab) return 'Operador';
    if (collab.role === 'LIDER') return 'LT';
    if (collab.role === 'SUPERVISOR') return 'Supervisor';
    if (collab.sector) {
      const sec = collab.sector.trim();
      if (sec.toUpperCase() === 'VIP') return 'VIP';
      return sec.charAt(0).toUpperCase() + sec.slice(1);
    }
    return collab.role || 'Operador';
  }

  getFunctionBadgeClass(collab: any): string {
    if (!collab) return 'text-slate-400';
    const isLight = this.isLightTheme();
    if (collab.role === 'LIDER') {
      return isLight ? 'text-amber-700' : 'text-amber-400';
    }
    if (collab.role === 'SUPERVISOR') {
      return isLight ? 'text-purple-700' : 'text-purple-400';
    }
    const sec = (collab.sector || '').toUpperCase().trim();
    if (sec === 'VIP') {
      return isLight ? 'text-cyan-700' : 'text-cyan-400';
    }
    if (sec === 'AERÓDROMO' || sec === 'AERODROMO' || sec === 'OPERACIONAL') {
      return isLight ? 'text-emerald-700' : 'text-emerald-400';
    }
    if (sec === 'GESTÃO' || sec === 'GESTAO') {
      return isLight ? 'text-blue-700' : 'text-blue-400';
    }
    if (sec === 'CENTRAL') {
      return isLight ? 'text-indigo-700' : 'text-indigo-400';
    }
    if (sec === 'GERAL') {
      return isLight ? 'text-teal-700' : 'text-teal-400';
    }
    if (sec === 'TESTE') {
      return isLight ? 'text-rose-700' : 'text-rose-400';
    }
    if (sec === 'MANUTENÇÃO' || sec === 'MANUTENCAO') {
      return isLight ? 'text-orange-700' : 'text-orange-400';
    }
    return isLight ? 'text-slate-700' : 'text-slate-300';
  }

  // Filters computed list for Login Selection
  loginCollaborators = computed(() => {
    const onlyNight = this.onlyNightShift();
    return this.scaleService.collaborators().filter(c => {
      if (onlyNight) {
        const cShift = (c.shift || '').toUpperCase().trim();
        return cShift === 'MADRUGADA' || cShift === 'NOITE' || cShift === 'N';
      }
      return true;
    });
  });

  // Filters computed list for Admin Management with sorting, searching, and custom filters
  adminCollaborators = computed(() => {
    const query = this.adminSearchQuery().toLowerCase().trim();
    const role = this.adminFilterRole();
    const shift = this.adminFilterShift();
    const sort = this.adminSortOrder();
    const onlyNight = this.onlyNightShift();

    let list = this.scaleService.collaborators().filter(c => {
      if (onlyNight) {
        const cShift = (c.shift || '').toUpperCase().trim();
        const isNight = cShift === 'MADRUGADA' || cShift === 'NOITE' || cShift === 'N';
        if (!isNight) return false;
      }

      const matchesSearch = !query || 
        c.name.toLowerCase().includes(query) || 
        c.role.toLowerCase().includes(query) || 
        c.shift.toLowerCase().includes(query) || 
        c.sector.toLowerCase().includes(query);

      const matchesRole = role === 'TODOS' || 
        (c.role || '').toUpperCase().trim() === role.toUpperCase().trim();
      const matchesShift = shift === 'TODOS' || 
        (c.shift || '').toUpperCase().trim() === shift.toUpperCase().trim();

      return matchesSearch && matchesRole && matchesShift;
    });

    list.sort((a, b) => {
      const nameA = a.name.localeCompare(b.name, 'pt-BR');
      return sort === 'asc' ? nameA : -nameA;
    });

    return list;
  });

  // Get Day of Week Name
  getDayOfWeekLabel(day: number): string {
    const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    const startDay = new Date(this.currentYear(), this.selectedMonthIndex(), 1).getDay();
    const index = (day - 1 + startDay) % 7; 
    return weekDays[index];
  }

  isDayWeekend(day: number): boolean {
    const startDay = new Date(this.currentYear(), this.selectedMonthIndex(), 1).getDay();
    const index = (day - 1 + startDay) % 7;
    return index === 6 || index === 0; // Saturday & Sunday
  }

  isDayHoliday(day: number): boolean {
    const month = this.selectedMonthIndex(); // 0-indexed (0 = Jan, 11 = Dec)
    if (month === 0 && day === 1) return true; // Ano Novo
    if (month === 3 && (day === 3 || day === 21)) return true; // Sexta-feira Santa, Tiradentes
    if (month === 4 && day === 1) return true; // Dia do Trabalho
    if (month === 5 && day === 4) return true; // Corpus Christi
    if (month === 8 && day === 7) return true; // Independência
    if (month === 9 && day === 12) return true; // Padroeira do Brasil
    if (month === 10 && (day === 2 || day === 15 || day === 20)) return true; // Finados, Proclamação da República, Consciência Negra
    if (month === 11 && day === 25) return true; // Natal
    return false;
  }

  isDaySpecial(day: number): boolean {
    return this.isDayWeekend(day) || this.isDayHoliday(day);
  }

  isToday(day: number): boolean {
    const today = new Date();
    return today.getDate() === day &&
           today.getMonth() === this.selectedMonthIndex() &&
           today.getFullYear() === this.currentYear();
  }

  isPastDay(day: number): boolean {
    const today = new Date();
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const calendarDate = new Date(this.currentYear(), this.selectedMonthIndex(), day);
    return calendarDate.getTime() < todayZero.getTime();
  }

  getLoggedCollabOffDays(): number[] {
    const collab = this.getLoggedCollab();
    if (!collab) return [];
    return this.daysInMonth().filter(day => !this.isWorkDay(collab, day));
  }

  getCollabOffDays(collab: any): number[] {
    if (!collab) return [];
    return this.daysInMonth().filter(day => !this.isWorkDay(collab, day));
  }

  getCollabWorkDays(collab: any): number[] {
    if (!collab) return [];
    return this.daysInMonth().filter(day => this.isWorkDay(collab, day));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getWeeklyWorkSequences(collab: any): any[] {
    if (!collab) return [];
    
    const weeks: any[] = [];
    const totalDays = this.daysInMonth().length;
    
    const weekBlocks = [
      { num: 1, start: 1, end: 7 },
      { num: 2, start: 8, end: 14 },
      { num: 3, start: 15, end: 21 },
      { num: 4, start: 22, end: 28 },
      { num: 5, start: 29, end: totalDays }
    ];
    
    for (const wb of weekBlocks) {
      if (wb.start > totalDays) continue;
      const endDay = Math.min(wb.end, totalDays);
      const daysList: any[] = [];
      let workCount = 0;
      const workedDaysNumbers: number[] = [];
      
      for (let d = wb.start; d <= endDay; d++) {
        const working = this.isWorkDay(collab, d);
        if (working) {
          workCount++;
          workedDaysNumbers.push(d);
        }
        daysList.push({
          day: d,
          isWork: working,
          label: working ? 'Trabalho' : 'Folga'
        });
      }
      
      let maxConsecInside = 0;
      let tempConsec = 0;
      for (let d = wb.start; d <= endDay; d++) {
        if (this.isWorkDay(collab, d)) {
          tempConsec++;
          if (tempConsec > maxConsecInside) {
            maxConsecInside = tempConsec;
          }
        } else {
          tempConsec = 0;
        }
      }
      
      let severity: 'normal' | 'warning' | 'critical' = 'normal';
      let severityColor = 'text-emerald-400 bg-emerald-950/40 border-emerald-500/20';
      let severityText = 'Estável';
      
      if (maxConsecInside >= 6 || workCount >= 6) {
        severity = 'critical';
        severityColor = 'text-rose-400 bg-rose-950/40 border-rose-500/20';
        severityText = 'Crítica';
      } else if (maxConsecInside === 5 || workCount === 5) {
        severity = 'warning';
        severityColor = 'text-amber-400 bg-amber-950/40 border-amber-500/20';
        severityText = 'Alerta';
      }
      
      const totalDaysInWeek = endDay - wb.start + 1;
      const percentage = Math.round((workCount / totalDaysInWeek) * 100);

      weeks.push({
        weekNum: wb.num,
        label: `${wb.num}ª Sem`,
        range: `Dias ${wb.start} a ${endDay}`,
        daysList,
        workCount,
        workedDaysNumbers,
        workedDaysStr: workedDaysNumbers.join(' '),
        maxConsecInside,
        severity,
        severityColor,
        severityText,
        totalDaysInWeek,
        percentage
      });
    }
    
    return weeks;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getContinuousWorkStretches(collab: any): any[] {
    if (!collab) return [];
    const stretches: any[] = [];
    const days = this.daysInMonth();
    let currentStretch: number[] = [];
    
    for (const d of days) {
      if (this.isWorkDay(collab, d)) {
        currentStretch.push(d);
      } else {
        if (currentStretch.length > 0) {
          stretches.push(this.createStretchObject(currentStretch, stretches.length + 1));
          currentStretch = [];
        }
      }
    }
    if (currentStretch.length > 0) {
      stretches.push(this.createStretchObject(currentStretch, stretches.length + 1));
    }
    return stretches;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createStretchObject(daysList: number[], index: number): any {
    const daysCount = daysList.length;
    let severity: 'normal' | 'warning' | 'critical' = 'normal';
    let severityColor = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
    let severityText = 'Estável';
    let badgeClass = 'bg-emerald-600 text-white';

    if (daysCount >= 6) {
      severity = 'critical';
      severityColor = 'bg-rose-500/10 border-rose-500/20 text-rose-400 animate-pulse';
      severityText = 'Crítico (Fadiga)';
      badgeClass = 'bg-rose-600 text-white';
    } else if (daysCount === 5) {
      severity = 'warning';
      severityColor = 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      severityText = 'Fadiga Moderada';
      badgeClass = 'bg-amber-500 text-slate-900';
    }

    return {
      id: index,
      startDay: daysList[0],
      endDay: daysList[daysList.length - 1],
      daysCount,
      daysList,
      severity,
      severityColor,
      severityText,
      badgeClass
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMostCriticalWeek(collab: any): any {
    const weeks = this.getWeeklyWorkSequences(collab);
    if (weeks.length === 0) return null;
    return weeks.reduce((prev, current) => (current.workCount > prev.workCount) ? current : prev, weeks[0]);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMostCriticalStretch(collab: any): any {
    const stretches = this.getContinuousWorkStretches(collab);
    if (stretches.length === 0) return null;
    return stretches.reduce((prev, current) => (current.daysCount > prev.daysCount) ? current : prev, stretches[0]);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getArray(n: number): number[] {
    return Array.from({length: Math.max(1, n)}, (_, i) => i + 1);
  }

  getBarColor(index: number, currentStreak: number, isWorking: boolean): string {
    if (!isWorking) return '#cbd5e1'; // cinza claro
    if (index > currentStreak) return '#cbd5e1'; // cinza claro quando não atingida ainda
    
    switch(index) {
      case 1: return '#10b981'; // emerald-500
      case 2: return '#3b82f6'; // blue-500
      case 3: return '#eab308'; // yellow-500
      case 4: return '#f97316'; // orange-500
      default: return '#ef4444'; // red-500
    }
  }

  getEnergyPercent(seqStats: any): number {
    if (!seqStats) return 100;
    if (!seqStats.isWorking) return 100;
    return Math.max(20, 100 - (seqStats.streak - 1) * 20);
  }

  getDonutColor(streak: number, isWorking: boolean): string {
    if (!isWorking) return '#10b981'; // emerald-500
    switch(streak) {
      case 1: return '#10b981'; // emerald-500
      case 2: return '#3b82f6'; // blue-500
      case 3: return '#eab308'; // yellow-500
      case 4: return '#f97316'; // orange-500
      default: return '#ef4444'; // red-500
    }
  }

  getFeedbackCardClass(seqStats: any): string {
    if (!seqStats) return '';
    const light = this.isLightTheme();
    if (!seqStats.isWorking) {
      return light ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800' : 'bg-emerald-950/10 border-emerald-500/20 text-emerald-400';
    }
    switch(seqStats.streak) {
      case 1:
        return light ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800' : 'bg-emerald-950/10 border-emerald-500/20 text-emerald-400';
      case 2:
        return light ? 'bg-blue-50/70 border-blue-200 text-blue-800' : 'bg-blue-950/10 border-blue-500/20 text-blue-400';
      case 3:
        return light ? 'bg-amber-50/70 border-amber-200 text-amber-800' : 'bg-amber-950/10 border-amber-500/20 text-amber-400';
      case 4:
        return light ? 'bg-orange-50/70 border-[#F59E0B] text-orange-800' : 'bg-[#F59E0B]/5 border-[#F59E0B] text-[#F59E0B]';
      default:
        return light ? 'bg-rose-50/70 border-rose-200 text-rose-800' : 'bg-rose-950/10 border-rose-500/20 text-rose-400';
    }
  }

  getConsecutiveWorkStats(collab: any) {
    if (!collab) return { isWorking: false, currentDay: 1, streak: 0, totalStreak: 0, energyColor: 'text-emerald-400', energyBg: 'bg-emerald-500', borderCol: 'border-emerald-500/20', textCol: 'text-emerald-400', textBg: 'bg-emerald-950/40', fatigueLevel: 'Em Folga / Descanso', alertMessage: 'Aproveite para recarregar as energias!' };
    
    const today = new Date();
    let dayToAnalyze = today.getDate();
    
    const isCurrentMonth = today.getMonth() === this.selectedMonthIndex() && today.getFullYear() === this.currentYear();
    if (!isCurrentMonth) {
      const totalDays = this.daysInMonth().length;
      dayToAnalyze = Math.min(dayToAnalyze, totalDays);
    }
    
    const isTodayWorking = this.isWorkDay(collab, dayToAnalyze);
    
    let currentWorkStreak = 0;
    if (isTodayWorking) {
      for (let d = dayToAnalyze; d >= 1; d--) {
        if (this.isWorkDay(collab, d)) {
          currentWorkStreak++;
        } else {
          break;
        }
      }
    }
    
    let totalStreakLength = 0;
    if (isTodayWorking) {
      let startDay = dayToAnalyze;
      while (startDay > 1 && this.isWorkDay(collab, startDay - 1)) {
        startDay--;
      }
      let endDay = dayToAnalyze;
      const maxDay = this.daysInMonth().length;
      while (endDay < maxDay && this.isWorkDay(collab, endDay + 1)) {
        endDay++;
      }
      totalStreakLength = (endDay - startDay) + 1;
    }
    
    let energyColor = 'text-emerald-400';
    let energyBg = 'bg-emerald-500';
    let borderCol = 'border-emerald-500/20';
    let textCol = 'text-emerald-400';
    let textBg = 'bg-emerald-950/40';
    let fatigueLevel = 'Altamente Descansado';
    let alertMessage = 'Início de ciclo - Excelente nível de energia!';
    
    if (!isTodayWorking) {
      energyColor = 'text-emerald-400';
      energyBg = 'bg-emerald-500';
      borderCol = 'border-emerald-500/20';
      textCol = 'text-emerald-400';
      textBg = 'bg-emerald-950/40';
      fatigueLevel = 'Em Folga / Descanso';
      alertMessage = 'Aproveite para recarregar as energias!';
    } else {
      if (currentWorkStreak === 1) {
        energyColor = 'text-emerald-400';
        energyBg = 'bg-emerald-500';
        borderCol = 'border-emerald-500/20';
        textCol = 'text-emerald-400';
        textBg = 'bg-emerald-950/40';
        fatigueLevel = 'Energia Plena';
        alertMessage = 'Bom início de jornada! Bateria 100% recarregada.';
      } else if (currentWorkStreak === 2) {
        energyColor = 'text-sky-400';
        energyBg = 'bg-sky-500';
        borderCol = 'border-sky-500/20';
        textCol = 'text-sky-400';
        textBg = 'bg-sky-950/40';
        fatigueLevel = 'Bom Ritmo';
        alertMessage = 'Ritmo seguro e estável. Hidrate-se e mantenha o foco.';
      } else if (currentWorkStreak === 3) {
        energyColor = 'text-amber-400';
        energyBg = 'bg-amber-500';
        borderCol = 'border-amber-500/20';
        textCol = 'text-amber-400';
        textBg = 'bg-amber-950/40';
        fatigueLevel = 'Fadiga Leve';
        alertMessage = 'Atenção moderada. Metade do ciclo concluída.';
      } else {
        energyColor = 'text-red-400';
        energyBg = 'bg-red-500';
        borderCol = 'border-red-500/20';
        textCol = 'text-red-400';
        textBg = 'bg-red-950/40';
        fatigueLevel = 'Atenção Redobrada';
        alertMessage = 'Fadiga acumulada elevada! Risco de fadiga aumentado, redobre os cuidados.';
      }
    }
    
    return {
      isWorking: isTodayWorking,
      currentDay: dayToAnalyze,
      streak: currentWorkStreak,
      totalStreak: totalStreakLength,
      energyColor,
      energyBg,
      borderCol,
      textCol,
      textBg,
      fatigueLevel,
      alertMessage
    };
  }

  getFolgaLabel(count: number): string {
    if (count === 1) return 'FOLGA SECA! 🏖️';
    if (count === 2) return 'DOBRADINHA! 🏖️';
    if (count === 3) return 'TRINCA! 🏖️';
    if (count === 4) return 'QUADRA! 🏖️';
    if (count === 5) return 'QUINA! 🏖️';
    if (count === 6) return 'SENA! 🏖️';
    return 'FOLGA PROLONGADA! 🏖️';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDaysUntilNextOff(collab: any) {
    if (!collab) return { days: 0, isOffToday: false, nextOffDays: [] as number[], isDouble: false };
    
    const today = new Date();
    let dayToAnalyze = today.getDate();
    const isCurrentMonth = today.getMonth() === this.selectedMonthIndex() && today.getFullYear() === this.currentYear();
    if (!isCurrentMonth) {
      const totalDays = this.daysInMonth().length;
      dayToAnalyze = Math.min(dayToAnalyze, totalDays);
    }
    
    if (!this.isWorkDay(collab, dayToAnalyze)) {
      let startDay = dayToAnalyze;
      while (startDay > 1 && !this.isWorkDay(collab, startDay - 1)) {
        startDay--;
      }
      let endDay = dayToAnalyze;
      const maxDay = this.daysInMonth().length;
      while (endDay < maxDay && !this.isWorkDay(collab, endDay + 1)) {
        endDay++;
      }
      const currentOffBlock: number[] = [];
      for (let d = startDay; d <= endDay; d++) {
        currentOffBlock.push(d);
      }
      return {
        days: 0,
        isOffToday: true,
        nextOffDays: currentOffBlock,
        isDouble: currentOffBlock.length >= 2
      };
    }
    
    const maxDay = this.daysInMonth().length;
    let nextOffDay = -1;
    for (let d = dayToAnalyze + 1; d <= maxDay; d++) {
      if (!this.isWorkDay(collab, d)) {
        nextOffDay = d;
        break;
      }
    }
    
    if (nextOffDay === -1) {
      return { days: 999, isOffToday: false, nextOffDays: [] as number[], isDouble: false };
    }
    
    const daysRemaining = nextOffDay - dayToAnalyze;
    
    const nextOffBlock: number[] = [nextOffDay];
    let checkDay = nextOffDay + 1;
    while (checkDay <= maxDay && !this.isWorkDay(collab, checkDay)) {
      nextOffBlock.push(checkDay);
      checkDay++;
    }
    
    return {
      days: daysRemaining,
      isOffToday: false,
      nextOffDays: nextOffBlock,
      isDouble: nextOffBlock.length >= 2
    };
  }

  getOffsetDaysArray(): number[] {
    const startDay = new Date(this.currentYear(), this.selectedMonthIndex(), 1).getDay();
    return Array.from({ length: startDay }, (_, i) => i);
  }

  /**
   * Verifica eventos especiais como datas comemorativas ou aniversários.
   */
  getSpecialEventsForDay(collab: any, day: number): any[] {
    const events: any[] = [];
    if (!collab) return events;

    if (collab.birthday) {
      const parts = collab.birthday.split('-');
      if (parts.length === 3) {
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (m === (this.selectedMonthIndex() + 1) && d === day) {
          events.push({
            icon: 'cake',
            color: '#f43f5e',
            tooltip: `Aniversário de ${collab.name}`,
            shortLabel: 'Aniversário'
          });
        }
      }
    }
    if (collab.folgaRequests) {
      const dateStr = `${this.currentYear()}-${String(this.selectedMonthIndex() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (collab.folgaRequests.some((r: any) => r.date === dateStr)) {
        events.push({
          icon: 'event_busy',
          color: '#10b981',
          tooltip: 'Intenção de folga',
          shortLabel: 'Folga'
        });
      }
    }
    return events;
  }

  // Notification methods
  markAllNotificationsAsRead() {
    this.notifications.set(this.notifications().map(n => ({ ...n, read: true })));
    this.showToast('Todas as notificações marcadas como lidas.');
  }

  markNotificationAsRead(id: string) {
    this.notifications.set(this.notifications().map(n => n.id === id ? { ...n, read: true } : n));
  }

  // Paintbrush logic
  togglePaintbrushPanel() {
    this.showPaintbrushPanel.set(!this.showPaintbrushPanel());
    if (!this.showPaintbrushPanel()) {
      this.activePaintbrush.set(null);
      if (this.editingRowCollabId() !== null) {
        this.cancelRowScale();
      }
    } else {
      this.showToast('Modo de Pintura Ativado: Clique em uma sigla e depois na célula da escala');
    }
  }

  selectPaintbrush(code: string) {
    this.activePaintbrush.set(code);
    if (code === '-') {
      this.showToast('Borracha ativada: Clique nas células da escala para limpar siglas ou turnos customizados.');
    } else {
      this.showToast(`Pincel ativo: ${code}. Clique nas células para aplicar.`);
    }
  }

  applyPaintbrush(collabId: string, day: number) {
    if (this.scaleService.currentRole() === 'OPERADOR') {
      this.showToast('Acesso negado: Apenas Líder ou Supervisor pode alterar escalas.');
      return;
    }

    const brush = this.activePaintbrush();
    if (!brush) return;

    const collab = this.scaleService.collaborators().find(c => c.id === collabId);
    if (collab) {
      const updatedCollab = {
        ...collab,
        scale: { ...collab.scale, [day]: brush }
      };
      this.scaleService.updateCollaborator(updatedCollab);
    }
  }

  // Row-level inline scale editing methods
  startRowScaleEdit(collab: Collaborator) {
    if (this.scaleService.currentRole() === 'OPERADOR') {
      this.showToast('Acesso negado: Apenas Líder ou Supervisor pode alterar escalas.');
      return;
    }
    // Automatically open the paintbrush panel so the user has the acronyms toolbar visible at the top
    this.showPaintbrushPanel.set(true);

    this.editingRowCollabId.set(collab.id);
    this.editingRowScaleDraft.set({ ...collab.scale });
    this.showToast(`Edição da linha de ${collab.name}. Selecione uma sigla no painel do topo e clique nos dias correspondentes.`);
  }

  cancelRowScale() {
    this.editingRowCollabId.set(null);
    this.editingRowScaleDraft.set({});
    this.showToast('Edição de linha cancelada.');
  }

  updateDraftCell(day: number, value: string) {
    this.editingRowScaleDraft.update(draft => ({ ...draft, [day]: value }));
  }

  paintDraftCell(day: number) {
    const active = this.activePaintbrush();
    if (!active) {
      this.showToast('Selecione um turno ou sigla no painel do topo para pintar.');
      return;
    }
    this.updateDraftCell(day, active);
  }

  saveRowScale(collab: Collaborator) {
    if (this.scaleService.currentRole() === 'OPERADOR') {
      this.showToast('Acesso negado.');
      return;
    }

    const draft = this.editingRowScaleDraft();
    const updatedCollab = {
      ...collab,
      scale: draft
    };

    this.scaleService.updateCollaborator(updatedCollab);
    this.editingRowCollabId.set(null);
    this.editingRowScaleDraft.set({});
    this.showToast(`Escala da linha de ${collab.name} salva com sucesso!`);

    this.scaleService.addAuditHistory(
      'EDITAR_ESCALA_LINHA',
      `Escala mensal do colaborador ${collab.name} editada via controle de linha direta.`
    );
  }

  // Manage custom shifts
  startEditingShift(shift: ShiftType) {
    this.editingShiftCode.set(shift.code);
    this.newShiftCode.set(shift.code);
    this.newShiftLabel.set(shift.label);
    this.newShiftHours.set(shift.hours);
    this.newShiftColor.set(shift.color);
    this.newShiftTextColor.set(shift.textColor || '#ffffff');
    
    // Parse startTime & endTime
    if (shift.startTime) {
      const parts = shift.startTime.split(':');
      if (parts.length === 2) {
        this.startHour.set(parts[0]);
        this.startMinute.set(parts[1]);
      }
    } else {
      this.startHour.set('07');
      this.startMinute.set('00');
    }

    if (shift.endTime) {
      const parts = shift.endTime.split(':');
      if (parts.length === 2) {
        this.endHour.set(parts[0]);
        this.endMinute.set(parts[1]);
      }
    } else {
      this.endHour.set('16');
      this.endMinute.set('00');
    }

    this.showToast(`Editando o turno "${shift.code}". Modifique os campos desejados.`);
  }

  cancelEditingShift() {
    this.editingShiftCode.set(null);
    this.newShiftCode.set('');
    this.newShiftLabel.set('');
    this.newShiftHours.set('7h20');
    this.newShiftColor.set('#3b82f6');
    this.newShiftTextColor.set('#ffffff');
    this.startHour.set('07');
    this.startMinute.set('00');
    this.endHour.set('16');
    this.endMinute.set('00');
  }

  saveShiftType() {
    const code = this.newShiftCode().trim().toUpperCase();
    const label = this.newShiftLabel().trim();
    if (!code || !label) {
      this.showToast('Erro: Código e Nome do turno são obrigatórios.');
      return;
    }

    const calculatedHours = this.calculatedShiftHours();
    const sTime = `${this.startHour()}:${this.startMinute()}`;
    const eTime = `${this.endHour()}:${this.endMinute()}`;

    const editCode = this.editingShiftCode();
    if (editCode) {
      // Edit existing shift type
      const targetShift = this.scaleService.shiftTypes().find(s => s.code.trim().toUpperCase() === editCode);
      if (targetShift) {
        const updatedShift: ShiftType = {
          ...targetShift,
          label,
          hours: calculatedHours,
          color: this.newShiftColor(),
          textColor: this.newShiftTextColor(),
          startTime: sTime,
          endTime: eTime
        };
        this.scaleService.saveShiftType(updatedShift);
      }
      this.cancelEditingShift();
      this.showToast(`Turno "${code}" atualizado com sucesso.`);
      this.scaleService.addAuditHistory('EDITAR_TURNO', `Turno "${code}" editado pelo gestor.`);
    } else {
      // Create new shift type
      const exists = this.scaleService.shiftTypes().some(s => s.code.trim().toUpperCase() === code);
      if (exists) {
        this.showToast('Erro: Código de turno já cadastrado.');
        return;
      }

      const newShift: ShiftType = {
        code,
        label,
        hours: calculatedHours,
        color: this.newShiftColor(),
        textColor: this.newShiftTextColor(),
        startTime: sTime,
        endTime: eTime
      };

      this.scaleService.saveShiftType(newShift);
      this.cancelEditingShift();
      this.showToast(`Novo turno "${code}" criado com sucesso.`);
      this.scaleService.addAuditHistory('CRIAR_TURNO', `Novo turno "${code}" criado pelo gestor.`);
    }
  }

  removeShiftType(code: string) {
    // Check if any collaborator is currently assigned to this shift as their primary default shift
    const assignedCollabCount = this.getCollaboratorCountForShift(code);
    if (assignedCollabCount > 0) {
      this.showToast(`Erro: Há ${assignedCollabCount} colaborador(es) alocado(s) neste turno. Realoque-os primeiro.`);
      return;
    }

    this.scaleService.removeShiftType(code);
    this.showToast(`Sigla "${code}" removida.`);
    this.scaleService.addAuditHistory('REMOCAO_TURNO', `Turno com código "${code}" removido.`);
  }

  // Get real-time statistics for shift types
  getCollaboratorCountForShift(shiftCode: string): number {
    return this.scaleService.collaborators().filter(c => c.shift === shiftCode).length;
  }

  getScheduledDaysCountForShift(shiftCode: string): number {
    let count = 0;
    const days = this.daysInMonth();
    this.scaleService.collaborators().forEach(c => {
      const defaultCode = this.getShiftCode(c.shift);
      days.forEach(day => {
        const rawVal = c.scale[day] || '-';
        const val = (rawVal === '-') ? defaultCode : rawVal;
        if (val.trim().toUpperCase() === shiftCode.trim().toUpperCase()) {
          count++;
        }
      });
    });
    return count;
  }

  // Sigla management methods
  startEditingSigla(sigla: any) {
    this.editingSiglaCode.set(sigla.code);
    this.newSiglaCode.set(sigla.code);
    this.newSiglaLabel.set(sigla.label);
    this.newSiglaColor.set(sigla.color);
    this.newSiglaTextColor.set(sigla.textColor || '#ffffff');
    this.newSiglaDescription.set(sigla.description || '');
    this.newSiglaComputaAusencia.set(!!sigla.computaAusencia);
    this.showToast(`Editando a sigla "${sigla.code}". Modifique os campos desejados.`);
  }

  cancelEditingSigla() {
    this.editingSiglaCode.set(null);
    this.newSiglaCode.set('');
    this.newSiglaLabel.set('');
    this.newSiglaColor.set('#64748b');
    this.newSiglaTextColor.set('#ffffff');
    this.newSiglaDescription.set('');
    this.newSiglaComputaAusencia.set(false);
  }

  async saveSiglaType() {
    const code = this.newSiglaCode().trim().toUpperCase();
    const label = this.newSiglaLabel().trim();
    const color = this.newSiglaColor();
    const textColor = this.newSiglaTextColor();
    const desc = this.newSiglaDescription().trim();
    const computaAusencia = this.newSiglaComputaAusencia();

    if (!code || !label) {
      this.showToast('Erro: Código e Nome da sigla são obrigatórios.');
      return;
    }

    const oldCode = this.editingSiglaCode();

    try {
      if (oldCode) {
        // Edit existing
        if (oldCode !== code) {
          // Code changed! Check if new code already exists
          const codeExists = this.scaleService.siglaTypes().some(s => s.code.trim().toUpperCase() === code) ||
                             this.scaleService.shiftTypes().some(sh => sh.code.trim().toUpperCase() === code);
          if (codeExists) {
            this.showToast(`Erro: O código "${code}" já está em uso por outra sigla ou turno.`);
            return;
          }

          this.scaleService.isProcessing.set(true);
          // Call service to rename the code and update all reference scales
          await this.scaleService.updateSiglaTypeCode(oldCode, { code, label, color, description: desc, textColor, computaAusencia });
          this.scaleService.addAuditHistory('EDICAO_SIGLA_CODIGO', `Sigla "${oldCode}" renomeada para "${code}" pelo gestor.`);
          this.showToast(`Sigla "${oldCode}" alterada para "${code}" com sucesso.`);
        } else {
          // Standard edit of existing sigla
          const sigla = this.scaleService.siglaTypes().find(s => s.code.trim().toUpperCase() === oldCode);
          if (sigla) {
            const updatedSigla = { ...sigla, label, color, description: desc, textColor, computaAusencia };
            this.scaleService.isProcessing.set(true);
            await this.scaleService.saveSiglaType(updatedSigla);
            this.scaleService.addAuditHistory('EDICAO_SIGLA', `Sigla "${code}" editada pelo gestor.`);
            this.showToast(`Sigla "${code}" atualizada com sucesso.`);
          }
        }
        this.cancelEditingSigla();
      } else {
        // Create new
        const codeExists = this.scaleService.siglaTypes().some(s => s.code.trim().toUpperCase() === code) ||
                           this.scaleService.shiftTypes().some(sh => sh.code.trim().toUpperCase() === code);
        if (codeExists) {
          this.showToast('Erro: Código de sigla já cadastrado ou em uso por um turno.');
          return;
        }
        this.scaleService.isProcessing.set(true);
        await this.scaleService.addSiglaType(code, label, color, desc, textColor, computaAusencia);
        this.scaleService.addAuditHistory('CADASTRO_SIGLA', `Nova sigla "${code}" cadastrada.`);
        this.cancelEditingSigla();
        this.showToast(`Sigla "${code}" criada com sucesso.`);
      }
    } catch (err: any) {
      console.error('Error in saveSiglaType:', err);
      this.showToast(`Erro ao salvar sigla: ${err.message || err}`);
    } finally {
      this.scaleService.isProcessing.set(false);
    }
  }

  async removeSiglaType(code: string) {
    // Check if any scheduled days contain this sigla
    let count = 0;
    this.scaleService.collaborators().forEach(c => {
      Object.values(c.scale).forEach(val => {
        if (val === code) count++;
      });
    });

    if (count > 0) {
      const confirmForce = window.confirm(
        `A sigla "${code}" está sendo usada em ${count} dia(s) na escala atual.\n\n` +
        `Se você confirmar a exclusão, todos esses dias serão redefinidos para "-" (vazio/escala comum) e a sigla será removida definitivamente.\n\n` +
        `Deseja continuar com a exclusão?`
      );
      if (!confirmForce) return;

      this.scaleService.isProcessing.set(true);
      try {
        // Remove the sigla type itself and clear all references in the DB
        await this.scaleService.removeSiglaType(code, true);

        // Also ensure local collaborator scale states are updated
        const updatedCollabs = this.scaleService.collaborators().map(collab => {
          const updatedScale = { ...collab.scale };
          let changed = false;
          for (let d = 1; d <= 31; d++) {
            if (updatedScale[d] === code) {
              updatedScale[d] = '-';
              changed = true;
            }
          }
          return changed ? { ...collab, scale: updatedScale } : collab;
        });
        this.scaleService.collaborators.set(updatedCollabs);

        this.scaleService.addAuditHistory('REMOCAO_SIGLA_EM_USO', `Sigla "${code}" excluída e ${count} referências limpas na escala.`);
        this.showToast(`Sigla "${code}" e suas ${count} referências na escala foram excluídas com sucesso.`);
      } catch (err: any) {
        console.error('Error removing sigla in use:', err);
        this.showToast(`Erro ao excluir sigla: ${err.message || err}`);
      } finally {
        this.scaleService.isProcessing.set(false);
      }
    } else {
      const confirmDelete = window.confirm(`Deseja realmente excluir a sigla "${code}"?`);
      if (!confirmDelete) return;

      this.scaleService.isProcessing.set(true);
      try {
        await this.scaleService.removeSiglaType(code, false);
        this.scaleService.addAuditHistory('REMOCAO_SIGLA', `Sigla "${code}" excluída do sistema.`);
        this.showToast(`Sigla "${code}" excluída com sucesso.`);
      } catch (err: any) {
        console.error('Error removing sigla:', err);
        this.showToast(`Erro ao excluir sigla: ${err.message || err}`);
      } finally {
        this.scaleService.isProcessing.set(false);
      }
    }
  }

  // Dynamic colors for matrix rendering
  getShiftOrSiglaColor(code: string, day?: number): string {
    const upperCode = (code || '-').toUpperCase().trim();
    if (upperCode === '-' || upperCode === '?') {
      if (this.isLightTheme()) {
        return 'transparent';
      }
      return '#091524';
    }

    // Try finding in shiftTypes first
    const shift = this.scaleService.shiftTypes().find(s => s.code.trim().toUpperCase() === upperCode || s.label.trim().toUpperCase() === upperCode);
    if (shift) {
      if (this.isLightTheme()) {
        return this.getLightVibrantColor(shift.color, upperCode);
      }
      return shift.color;
    }

    // Try finding in siglaTypes
    const sigla = this.scaleService.siglaTypes().find(s => s.code.trim().toUpperCase() === upperCode);
    if (sigla) {
      return sigla.color;
    }

    // Is it a numeric code like "7", "2", etc?
    const isNum = /^\d+$/.test(upperCode) || /^\d+[:.,hH]\d+$/.test(upperCode);
    if (isNum) {
      if (this.isLightTheme()) {
        return '#d1fae5'; // light emerald-100
      }
      return '#064e3b'; // dark emerald-900
    }

    // Standard Fallbacks if not registered in DB
    if (this.isLightTheme()) {
      if (upperCode === 'X') return '#f1f5f9';
      if (upperCode === 'F') return '#f59e0b';
      if (upperCode === 'LM') return '#ef4444';
      if (upperCode.startsWith('M')) return '#10b981';
      if (upperCode.startsWith('T')) return '#3b82f6';
      if (upperCode.startsWith('N')) return '#8b5cf6';
      if (upperCode === 'ADM') return '#06b6d4';
      return '#10b981';
    } else {
      if (upperCode === 'X') return '#475569';
      if (upperCode === 'F') return '#a855f7';
      if (upperCode === 'LM') return '#ef4444';
      return '#1e293b';
    }
  }

  getLightVibrantColor(dbColor: string, code: string): string {
    const hex = dbColor.replace('#', '').trim();
    // If database color is too dark, generate a beautiful vibrant one based on code name
    if (hex === '020813' || hex === '030a14' || hex === '071426' || hex === '000000' || hex.startsWith('0') || hex.startsWith('1')) {
      const upper = code.toUpperCase().trim();
      if (upper.startsWith('M')) return '#10b981';
      if (upper.startsWith('T')) return '#3b82f6';
      if (upper.startsWith('N')) return '#8b5cf6';
      if (upper === 'ADM') return '#06b6d4';
      if (upper === 'F') return '#f59e0b';
      if (upper === 'LM') return '#ef4444';
      
      let hash = 0;
      for (let i = 0; i < code.length; i++) {
        hash = code.charCodeAt(i) + ((hash << 5) - hash);
      }
      const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#14b8a6', '#f43f5e'];
      return colors[Math.abs(hash) % colors.length];
    }
    return dbColor;
  }

  getShiftOrSiglaTextColor(code: string): string {
    const upperCode = (code || '-').toUpperCase().trim();
    if (upperCode === '-') {
      return '#475569';
    }
    if (upperCode === '?') {
      return '#ef4444';
    }

    // Try finding in shiftTypes first
    const shift = this.scaleService.shiftTypes().find(s => s.code.trim().toUpperCase() === upperCode || s.label.trim().toUpperCase() === upperCode);
    if (shift && shift.textColor) {
      return shift.textColor;
    }

    // Try finding in siglaTypes
    const sigla = this.scaleService.siglaTypes().find(s => s.code.trim().toUpperCase() === upperCode);
    if (sigla && sigla.textColor) {
      return sigla.textColor;
    }

    // Is it a numeric code?
    const isNum = /^\d+$/.test(upperCode) || /^\d+[:.,hH]\d+$/.test(upperCode);
    if (isNum) {
      if (this.isLightTheme()) {
        return '#065f46'; // dark emerald text
      }
      return '#34d399'; // bright emerald text
    }

    if (this.isLightTheme()) {
      if (!sigla && !shift && upperCode === 'X') return '#334155';
    }

    return '#ffffff';
  }

  // Multi-employee Assignment & Movement logic
  assignEmployeeToShift() {
    const collabId = this.assignmentCollabId();
    const shiftCode = this.assignmentShiftCode();

    if (!collabId || !shiftCode) {
      this.showToast('Erro: Selecione um colaborador e o novo turno.');
      return;
    }

    const collab = this.scaleService.collaborators().find(c => c.id === collabId);
    const shiftType = this.scaleService.shiftTypes().find(s => s.code.trim().toUpperCase() === shiftCode);

    if (!collab || !shiftType) {
      this.showToast('Erro: Seleção inválida.');
      return;
    }

    const oldShiftCode = collab.shift;

    const updatedScale = { ...collab.scale };
    for (let day = 1; day <= 30; day++) {
      if (updatedScale[day] === oldShiftCode) {
        updatedScale[day] = shiftCode;
      }
    }
    const updatedCollab = {
      ...collab,
      shift: shiftCode,
      hours: shiftType.hours,
      scale: updatedScale
    };

    this.scaleService.updateCollaborator(updatedCollab);
    this.showToast(`Colaborador ${collab.name} foi movido com sucesso para o turno "${shiftType.label}"!`);

    // Log this action to the official audit history
    this.scaleService.addAuditHistory(
      'ALOCACAO_TURNO',
      `Colaborador ${collab.name} movido do turno "${oldShiftCode}" para o turno "${shiftCode}" (${shiftType.hours}).`
    );

    // Reset fields
    this.assignmentCollabId.set('');
    this.assignmentShiftCode.set('');
  }

  // Auth Portal Simulation
  openAuthModal(mode: 'LOGIN' | 'SIGNUP') {
    this.authMode.set(mode);
    this.isAuthModalOpen.set(true);
  }

  submitAuth(nameInput: string, emailInput: string) {
    this.isAuthModalOpen.set(false);
    this.scaleService.selectedCollabName.set(nameInput || 'Anderson Pires');
    this.showToast(`Bem-vindo, ${nameInput || 'Anderson Pires'}! Autenticado com sucesso.`);
  }

  logout() {
    this.scaleService.selectedCollabName.set(null);
    this.selectedSimulatedCollabId.set(null);
    this.showToast('Sessão encerrada.');
  }

  loginAsCollab(id: string) {
    this.selectedSimulatedCollabId.set(id);
    const collab = this.scaleService.collaborators().find(c => c.id === id);
    if (collab) {
      this.scaleService.selectedCollabName.set(collab.name);
      this.scaleService.currentRole.set(collab.role);
      this.showToast(`Sessão simulada como ${collab.name}!`);
    } else {
      this.selectedSimulatedCollabId.set(null);
      this.scaleService.selectedCollabName.set('');
      this.scaleService.currentRole.set('SUPERVISOR');
    }
  }

  navigateToCollabPortal(id: string): void {
    this.loginAsCollab(id);
    this.isDayDetailsModalOpen.set(false);
    this.activeSubTab.set('portal');
  }

  registerCollaborator(
    name: string,
    role: string,
    group: string,
    shift: string,
    sector: string,
    bh: number,
    score: number,
    photo?: string,
    birthday?: string,
    sd1Desc?: string, sd1Date?: string,
    sd2Desc?: string, sd2Date?: string,
    sd3Desc?: string, sd3Date?: string,
    sd4Desc?: string, sd4Date?: string,
    sd5Desc?: string, sd5Date?: string
  ) {
    const specialDates: SpecialDate[] = [];
    if (sd1Desc && sd1Date) specialDates.push({ description: sd1Desc, date: sd1Date, priority: 1 });
    if (sd2Desc && sd2Date) specialDates.push({ description: sd2Desc, date: sd2Date, priority: 2 });
    if (sd3Desc && sd3Date) specialDates.push({ description: sd3Desc, date: sd3Date, priority: 3 });
    if (sd4Desc && sd4Date) specialDates.push({ description: sd4Desc, date: sd4Date, priority: 4 });
    if (sd5Desc && sd5Date) specialDates.push({ description: sd5Desc, date: sd5Date, priority: 5 });

    const getShiftCode = (s: string): string => {
      const norm = (s || '').toUpperCase().trim();
      const st = this.scaleService.shiftTypes().find(x => x.code.toUpperCase().trim() === norm || x.label.toUpperCase().trim() === norm);
      return st ? st.code : norm;
    };

    const newShiftCode = getShiftCode(shift);
    const shiftType = this.scaleService.shiftTypes().find(s => s.code.trim().toUpperCase() === newShiftCode);
    const newHours = shiftType ? shiftType.hours : (newShiftCode === 'ADM' ? '8h00' : '7h20');

    this.scaleService.addCollaborator(
      name,
      role,
      newHours,
      group,
      shift,
      sector,
      bh,
      score,
      photo,
      birthday,
      specialDates
    );
    this.isCollabModalOpen.set(false);
    this.isNewSectorMode.set(false);
    this.isNewRoleMode.set(false);
  }

  getUnifiedAgenda(): {
    day: number;
    type: string;
    label: string;
    icon: string;
    color: string;
    details: string;
  }[] {
    const collab = this.getLoggedCollab();
    if (!collab) return [];

    const agenda: {
      day: number;
      type: string;
      label: string;
      icon: string;
      color: string;
      details: string;
    }[] = [];

    const monthNum = this.selectedMonthIndex() + 1;
    const year = this.currentYear();

    // 1. Check Birthday
    if (collab.birthday) {
      const parts = collab.birthday.split('-');
      if (parts.length === 3) {
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (m === monthNum) {
          agenda.push({
            day: d,
            type: 'birthday',
            label: 'Seu Aniversário',
            icon: 'cake',
            color: '#f43f5e',
            details: 'Folga Automática Garantida! 🎂'
          });
        }
      }
    }

    // 2. Check Special Dates
    if (collab.specialDates && Array.isArray(collab.specialDates)) {
      for (const sd of collab.specialDates) {
        if (!sd.date || !sd.description) continue;
        const parts = sd.date.split('-');
        if (parts.length === 3) {
          const m = parseInt(parts[1], 10);
          const d = parseInt(parts[2], 10);
          if (m === monthNum) {
            const descLower = sd.description.toLowerCase();
            let icon = 'celebration';
            let color = '#f59e0b'; // amber
            
            if (descLower.includes('casamento') || descLower.includes('aliança') || descLower.includes('alianca') || descLower.includes('wedding') || descLower.includes('bodas') || descLower.includes('marido') || descLower.includes('esposa') || descLower.includes('conjuge') || descLower.includes('cônjuge') || descLower.includes('noivado')) {
              icon = 'favorite';
              color = '#e11d48'; // red
            } else if (descLower.includes('filho') || descLower.includes('filha') || descLower.includes('criança') || descLower.includes('crianca') || descLower.includes('bebe') || descLower.includes('bebê') || descLower.includes('nascimento') || descLower.includes('child') || descLower.includes('baby') || descLower.includes('maternidade') || descLower.includes('paternidade')) {
              icon = 'child_care';
              color = '#3b82f6'; // blue
            }

            agenda.push({
              day: d,
              type: 'special_date',
              label: sd.description,
              icon: icon,
              color: color,
              details: `Data Magna (Prioridade P${sd.priority})`
            });
          }
        }
      }
    }

    // 3. Check Folga Requests (Chosen Days Off)
    if (collab.folgaRequests && Array.isArray(collab.folgaRequests)) {
      for (const fr of collab.folgaRequests) {
        if (!fr.date) continue;
        const parts = fr.date.split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          const d = parseInt(parts[2], 10);
          if (y === year && m === monthNum) {
            const count = this.getFolgaRequestCount(d);
            const scaleVal = collab.scale ? (collab.scale[d] || 'X') : 'X';
            const isApproved = scaleVal === 'F';
            
            agenda.push({
              day: d,
              type: isApproved ? 'folga_approved' : 'folga_requested',
              label: isApproved ? 'Folga Confirmada' : 'Folga Solicitada',
              icon: isApproved ? 'verified' : 'radio_button_checked',
              color: isApproved ? '#10b981' : '#10b981',
              details: isApproved ? 'Folga aprovada e confirmada na escala!' : `Status: Pendente (${count}/2 vagas ocupadas)`
            });
          }
        }
      }
    }

    // Sort chronologically by day
    agenda.sort((a, b) => a.day - b.day);

    return agenda;
  }

  savePortalSpecialDates(birthday: string, specialDates: SpecialDate[]) {
    const collab = this.getLoggedCollab();
    if (!collab) {
      this.showToast('Selecione um colaborador na simulação primeiro.');
      return;
    }

    const validDates = specialDates.filter(d => d.date && d.description.trim());

    const updatedCollab: Collaborator = {
      ...collab,
      birthday: birthday || '',
      specialDates: validDates
    };

    this.scaleService.updateCollaborator(updatedCollab);
    this.showToast('Datas especiais atualizadas com sucesso!');
  }

  requestPortalFolga(date: string) {
    const collab = this.getLoggedCollab();
    if (!collab) {
      this.showToast('Selecione um colaborador na simulação primeiro.');
      return;
    }
    const result = this.scaleService.requestFolga(collab.id, date, this.simulatedDayOfMonth());
    this.showToast(result.message);
  }

  removePortalFolga(date: string) {
    const collab = this.getLoggedCollab();
    if (!collab) {
      this.showToast('Selecione um colaborador na simulação primeiro.');
      return;
    }
    const result = this.scaleService.removeFolga(collab.id, date, this.simulatedDayOfMonth());
    this.showToast(result.message);
  }

  getFolgaRequestCount(day: number): number {
    const dateStr = `${this.currentYear()}-${String(this.selectedMonthIndex() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    let count = 0;
    for (const collab of this.scaleService.collaborators()) {
      if (collab.folgaRequests) {
        if (collab.folgaRequests.some(r => r.date === dateStr)) {
          count++;
        }
      }
    }
    return count;
  }

  getCollaboratorsForFolga(day: number): string[] {
    const dateStr = `${this.currentYear()}-${String(this.selectedMonthIndex() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const names: string[] = [];
    for (const collab of this.scaleService.collaborators()) {
      if (collab.folgaRequests && collab.folgaRequests.some(r => r.date === dateStr)) {
        names.push(collab.name);
      }
    }
    return names;
  }

  isChosenByLogged(day: number): boolean {
    const collab = this.getLoggedCollab();
    if (!collab || !collab.folgaRequests) return false;
    const dateStr = `${this.currentYear()}-${String(this.selectedMonthIndex() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return collab.folgaRequests.some(r => r.date === dateStr);
  }

  isPreSelectedByLogged(day: number): boolean {
    const collab = this.getLoggedCollab();
    if (!collab || !collab.folgaRequests) return false;
    const dateStr = `${this.currentYear()}-${String(this.selectedMonthIndex() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return collab.folgaRequests.some(r => r.date === dateStr && r.isPreSelected);
  }

  getCalendarDayClass(isChosenByMe: boolean, count: number): string {
    const base = 'p-2.5 border rounded-lg flex flex-col justify-between gap-1 transition-all cursor-pointer h-16 min-w-0 outline-none text-left shadow-sm';
    if (this.isLightTheme()) {
      if (isChosenByMe) {
        return `${base} bg-emerald-600 border-emerald-700 text-white shadow-md shadow-emerald-500/10`;
      } else if (count >= 2) {
        return `${base} bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100/70`;
      } else {
        return `${base} bg-white border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-700`;
      }
    } else {
      if (isChosenByMe) {
        return `${base} bg-emerald-950/40 border-emerald-500 text-white`;
      } else if (count >= 2) {
        return `${base} bg-red-950/20 border-red-950/50 text-slate-300`;
      } else {
        return `${base} bg-[#071426] border-[#10213b] hover:border-slate-400 text-slate-300`;
      }
    }
  }

  isWorkDay(collab: any, d: number): boolean {
    if (!collab) return false;
    const cellValRaw = collab.scale && collab.scale[d] !== undefined ? collab.scale[d] : '-';
    const cellVal = (cellValRaw === '-') ? this.getShiftCode(collab.shift) : cellValRaw;
    const upperCode = cellVal.toUpperCase().trim();
    
    if (upperCode === '' || upperCode === '-') return true; // Default shift is a work day
    
    // Is it a folga / leave / absence code?
    const offCodes = ['F', 'FF', 'FE', 'FM', 'FT', 'FN', 'X', 'LM', 'LMT', 'LA'];
    if (offCodes.includes(upperCode)) return false;
    
    // Check if it exists in siglaTypes
    const sigla = this.scaleService.siglaTypes().find(s => s.code.trim().toUpperCase() === upperCode);
    if (sigla) {
      return false; // Any registered sigla is generally an absence/folga/leave
    }
    
    return true;
  }

  getWorkSequenceString(collab: any, day: number): string {
    if (!this.isWorkDay(collab, day)) {
      return '';
    }
    
    let count = 0;
    for (let d = day; d >= 1; d--) {
      if (this.isWorkDay(collab, d)) {
        count++;
      } else {
        break;
      }
    }
    return `S${count}`;
  }

  openDayDetailsModal(collab: any, day: number) {
    this.selectedDetailCollab.set(collab);
    this.selectedDetailDay.set(day);
    this.dayDetailsActiveTab.set('seu_turno');
    this.isDayDetailsModalOpen.set(true);
  }

  getSortedShiftTypes(): ShiftType[] {
    return [...this.scaleService.shiftTypes()].sort((a, b) => {
      const timeA = a.startTime || '';
      const timeB = b.startTime || '';
      if (!timeA && !timeB) return a.code.localeCompare(b.code);
      if (!timeA) return 1;
      if (!timeB) return -1;
      return timeA.localeCompare(timeB);
    });
  }

  getNextShiftCode(currentShiftCode: string): string {
    const sortedShifts = this.getSortedShiftTypes();
    if (sortedShifts.length === 0) return '';
    const currentIndex = sortedShifts.findIndex(s => s.code.trim().toUpperCase() === currentShiftCode.trim().toUpperCase());
    if (currentIndex === -1) {
      return sortedShifts[0].code;
    }
    const nextIndex = (currentIndex + 1) % sortedShifts.length;
    return sortedShifts[nextIndex].code;
  }

  getCollabEffectiveShiftForDay(collab: any, day: number): string {
    if (!collab) return '';
    const code = this.getCollabShiftOnDay(collab, day);
    const upper = code.toUpperCase().trim();
    
    // If it's an off code (folga/absence/leave)
    const offCodes = ['F', 'FF', 'FE', 'FM', 'FT', 'FN', 'X', 'LM', 'LMT', 'LA'];
    const isOff = offCodes.includes(upper) || this.scaleService.siglaTypes().some(s => s.code.trim().toUpperCase() === upper);
    
    if (isOff) {
      return this.getShiftCode(collab.shift).toUpperCase().trim();
    }
    return upper;
  }

  selectCalendarDay(day: number): void {
    this.selectedCalendarDay.set(day);
  }

  getTodayTeamCollaborators(): any[] {
    const logged = this.getLoggedCollab();
    if (!logged) return [];
    
    const day = this.selectedCalendarDay();
    const myShiftCode = this.getCollabEffectiveShiftForDay(logged, day);
    
    return this.scaleService.collaborators().filter(c => {
      // Must be scheduled to work on that day
      if (!this.isWorkDay(c, day)) return false;
      // Must match the same shift code
      return this.getCollabEffectiveShiftForDay(c, day) === myShiftCode;
    });
  }

  getTodayTeamShiftLabel(): string {
    const logged = this.getLoggedCollab();
    if (!logged) return '';
    const day = this.selectedCalendarDay();
    const myShiftCode = this.getCollabEffectiveShiftForDay(logged, day);
    const shiftType = this.scaleService.shiftTypes().find(s => s.code.trim().toUpperCase() === myShiftCode);
    return shiftType ? `${shiftType.label} (${shiftType.code})` : myShiftCode;
  }

  getTodayDay(): number {
    return new Date().getDate();
  }

  getCollaboratorsForDetailTab(tab: 'seu_turno' | 'turno_posterior' | 'geral'): any[] {
    const day = this.selectedDetailDay();
    const collab = this.selectedDetailCollab();
    if (day === null || !collab) return [];

    const allScheduled = this.getCollaboratorsScheduledForDay(day);
    if (tab === 'geral') {
      return allScheduled;
    }

    const myShiftCode = this.getCollabEffectiveShiftForDay(collab, day);
    if (tab === 'seu_turno') {
      return allScheduled.filter(c => this.getCollabEffectiveShiftForDay(c, day) === myShiftCode);
    }

    if (tab === 'turno_posterior') {
      const nextShiftCode = this.getNextShiftCode(myShiftCode);
      if (!nextShiftCode) return [];
      return allScheduled.filter(c => this.getCollabEffectiveShiftForDay(c, day) === nextShiftCode);
    }

    return [];
  }

  getCollaboratorsScheduledForDay(day: number | null): any[] {
    if (day === null) return [];
    return this.scaleService.collaborators().filter(collab => this.isWorkDay(collab, day));
  }

  getCollabShiftOnDay(collab: any, day: number): string {
    if (!collab) return '';
    const cellValRaw = collab.scale && collab.scale[day] !== undefined ? collab.scale[day] : '-';
    const cellVal = (cellValRaw === '-') ? this.getShiftCode(collab.shift) : cellValRaw;
    return cellVal.toUpperCase().trim();
  }

  /**
   * Obtém informações detalhadas de status, rótulo e horários para um colaborador específico no dia selecionado.
   */
  getCollaboratorDayScheduleInfo(collab: any, day: number): {
    status: 'trabalho' | 'folga' | 'afastamento' | 'licenca';
    label: string;
    subLabel: string;
    hours: string;
    color: string;
    borderColor: string;
    textColor: string;
    icon: string;
  } {
    if (!collab) {
      return {
        status: 'trabalho',
        label: '-',
        subLabel: 'Sem escala',
        hours: '',
        color: 'bg-[#071426]',
        borderColor: 'border-[#10213b]',
        textColor: 'text-slate-400',
        icon: 'help_outline'
      };
    }

    const cellValRaw = collab.scale && collab.scale[day] !== undefined ? collab.scale[day] : '-';
    const cellVal = (cellValRaw === '-') ? (collab.shift || '-') : cellValRaw;
    const upperCode = cellVal.toUpperCase().trim();

    // Verifica siglas de afastamento ou folga oficiais
    const isFolgaCode = ['F', 'FF', 'FE', 'FM', 'FT', 'FN', 'X'].includes(upperCode);
    const isLicencaCode = ['LM', 'LMT', 'LA'].includes(upperCode);

    if (isFolgaCode || upperCode === 'X') {
      return {
        status: 'folga',
        label: upperCode,
        subLabel: 'Folga Escalonada',
        hours: 'Descanso Oficial',
        color: this.isLightTheme() ? 'bg-emerald-50/80' : 'bg-emerald-950/25',
        borderColor: 'border-emerald-500/80',
        textColor: 'text-emerald-400',
        icon: 'nights_stay'
      };
    } else if (isLicencaCode) {
      return {
        status: 'licenca',
        label: upperCode,
        subLabel: 'Afastamento Médico',
        hours: 'Afastado',
        color: this.isLightTheme() ? 'bg-rose-50' : 'bg-rose-950/20',
        borderColor: 'border-rose-500/60',
        textColor: 'text-rose-400',
        icon: 'medical_services'
      };
    }

    // Retorna dia letivo / de trabalho normal
    return {
      status: 'trabalho',
      label: upperCode,
      subLabel: 'Dia de Trabalho',
      hours: 'Escala Normal',
      color: this.isLightTheme() ? 'bg-slate-50' : 'bg-[#071426]/30',
      borderColor: this.isLightTheme() ? 'border-slate-200' : 'border-[#10213b]',
      textColor: this.isLightTheme() ? 'text-slate-700' : 'text-slate-300',
      icon: 'work'
    };
  }

  /**
   * Retorna as classes CSS do Tailwind de forma dinâmica para renderizar os cards do calendário.
   */
  getCollaboratorCalendarDayClass(collab: any, day: number, count: number): string {
    const base = 'p-1.5 sm:p-3 border rounded-lg sm:rounded-xl flex flex-col justify-between gap-1 sm:gap-1.5 transition-all cursor-pointer min-h-[54px] sm:min-h-[96px] w-full text-left shadow-sm hover:scale-[1.02] hover:shadow-md duration-200 outline-none select-none relative overflow-hidden';
    
    if (!collab) {
      return `${base} bg-slate-900/30 border-slate-800 text-slate-500`;
    }

    const cellValRaw = collab.scale && collab.scale[day] !== undefined ? collab.scale[day] : '-';
    const cellVal = (cellValRaw === '-') ? (collab.shift || '-') : cellValRaw;
    const upperCode = cellVal.toUpperCase().trim();

    const isFolga = ['F', 'FF', 'FE', 'FM', 'FT', 'FN', 'X'].includes(upperCode);
    const isAbsence = ['LM', 'LMT', 'LA'].includes(upperCode);

    if (isFolga) {
      if (this.isLightTheme()) {
        return `${base} bg-emerald-50/80 border-emerald-400 hover:border-emerald-500 text-emerald-800 shadow-emerald-100/50`;
      } else {
        return `${base} bg-gradient-to-br from-emerald-950/20 to-[#030a14] border-emerald-500/50 hover:border-emerald-400 text-emerald-200 shadow-emerald-950/10`;
      }
    } else if (isAbsence) {
      if (this.isLightTheme()) {
        return `${base} bg-rose-50 border-rose-300 hover:border-rose-500 text-rose-800`;
      } else {
        return `${base} bg-gradient-to-br from-red-950/20 to-[#030a14] border-rose-500/40 hover:border-rose-400 text-rose-200`;
      }
    } else {
      if (this.isLightTheme()) {
        return `${base} bg-white border-slate-200 hover:border-slate-400 text-slate-700`;
      } else {
        return `${base} bg-[#041021]/80 border-[#10213b] hover:border-slate-500 text-slate-300`;
      }
    }
  }

  requestPortalFolgaDay(day: number) {
    const dateStr = `${this.currentYear()}-${String(this.selectedMonthIndex() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    this.requestPortalFolga(dateStr);
  }

  removePortalFolgaDay(day: number) {
    const dateStr = `${this.currentYear()}-${String(this.selectedMonthIndex() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    this.removePortalFolga(dateStr);
  }

  isChosenByCollab(collab: Collaborator, day: number): boolean {
    if (!collab || !collab.folgaRequests) return false;
    const dateStr = `${this.currentYear()}-${String(this.selectedMonthIndex() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return collab.folgaRequests.some(r => r.date === dateStr);
  }

  isPreSelectedByCollab(collab: Collaborator, day: number): boolean {
    if (!collab || !collab.folgaRequests) return false;
    const dateStr = `${this.currentYear()}-${String(this.selectedMonthIndex() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return collab.folgaRequests.some(r => r.date === dateStr && r.isPreSelected);
  }

  requestCollabFolgaDay(collab: Collaborator, day: number) {
    const dateStr = `${this.currentYear()}-${String(this.selectedMonthIndex() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const result = this.scaleService.requestFolga(collab.id, dateStr, this.simulatedDayOfMonth());
    if (!result.success) {
      this.showToast(result.message);
    } else {
      this.showToast(`Folga adicionada para ${collab.name}!`);
      this.folgaModalSelectedDay.set(null);
    }
  }

  removeCollabFolgaDay(collab: Collaborator, day: number) {
    const dateStr = `${this.currentYear()}-${String(this.selectedMonthIndex() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const result = this.scaleService.removeFolga(collab.id, dateStr, this.simulatedDayOfMonth());
    if (!result.success) {
      this.showToast(result.message);
    } else {
      this.showToast(`Folga removida para ${collab.name}!`);
      this.folgaModalSelectedDay.set(null);
    }
  }

  requestCollabFolgaDayForNextMonth(collab: Collaborator, day: number) {
    const dateStr = `${this.getNextMonthYear()}-${String(this.getNextMonthIndex() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const result = this.scaleService.requestFolga(collab.id, dateStr, this.simulatedDayOfMonth());
    if (!result.success) {
      this.showToast(result.message);
    } else {
      this.showToast('Folga solicitada com sucesso!');
      this.folgaModalSelectedDay.set(null);
    }
  }

  removeCollabFolgaDayFromNextMonth(collab: Collaborator, day: number) {
    const dateStr = `${this.getNextMonthYear()}-${String(this.getNextMonthIndex() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const result = this.scaleService.removeFolga(collab.id, dateStr, this.simulatedDayOfMonth());
    if (!result.success) {
      this.showToast(result.message);
    } else {
      this.showToast('Solicitação cancelada.');
      this.folgaModalSelectedDay.set(null);
    }
  }

  assignPortalCollabShift(collabId: string, shiftCode: string) {
    if (!collabId || !shiftCode) {
      this.showToast('Erro: Selecione um novo turno.');
      return;
    }

    const collab = this.scaleService.collaborators().find(c => c.id === collabId);
    const shiftType = this.scaleService.shiftTypes().find(s => s.code.trim().toUpperCase() === shiftCode);

    if (!collab || !shiftType) {
      this.showToast('Erro: Seleção de turno inválida.');
      return;
    }

    const oldShiftCode = collab.shift;
    if (oldShiftCode === shiftCode) {
      this.showToast(`O colaborador já está alocado no turno "${shiftCode}".`);
      return;
    }

    const updatedScale = { ...collab.scale };
    for (let day = 1; day <= 30; day++) {
      if (updatedScale[day] === oldShiftCode) {
        updatedScale[day] = shiftCode;
      }
    }
    const updatedCollab = {
      ...collab,
      shift: shiftCode,
      hours: shiftType.hours,
      scale: updatedScale
    };

    this.scaleService.updateCollaborator(updatedCollab);
    this.showToast(`Turno de ${collab.name} atualizado com sucesso para "${shiftType.label}"!`);

    this.scaleService.addAuditHistory(
      'ALOCACAO_TURNO',
      `Turno de ${collab.name} alterado de "${oldShiftCode}" para "${shiftCode}" (${shiftType.hours}) via Portal.`
    );
  }

  // Simulated Portal Collaborator Info
  getLoggedCollab(): Collaborator | null {
    const id = this.selectedSimulatedCollabId();
    if (!id) return null;
    return this.scaleService.collaborators().find(c => c.id === id) || null;
  }

  // Shift swaps / Permutas logic
  openPermutaModal(day: number) {
    this.permutaSelectedDay.set(day);
    this.permutaTargetCollabId.set('');
    this.permutaStatusMessage.set('');
    this.isPermutaModalOpen.set(true);
  }

  // Colleagues matching same day sector but maybe different shift
  getPermutaCandidates(): Collaborator[] {
    const current = this.getLoggedCollab();
    if (!current) return [];
    return this.scaleService.collaborators().filter(c => c.id !== current.id && c.sector === current.sector);
  }

  requestPermuta() {
    const current = this.getLoggedCollab();
    const targetId = this.permutaTargetCollabId();
    const day = this.permutaSelectedDay();

    if (!current || !targetId) {
      this.permutaStatusMessage.set('Selecione um colega para permuta.');
      return;
    }

    const target = this.scaleService.collaborators().find(c => c.id === targetId);
    if (!target) return;

    const currentShiftRaw = current.scale[day] || '-';
    const currentShift = (currentShiftRaw === '-') ? this.getShiftCode(current.shift) : currentShiftRaw;

    const targetShiftRaw = target.scale[day] || '-';
    const targetShift = (targetShiftRaw === '-') ? this.getShiftCode(target.shift) : targetShiftRaw;

    if (currentShift === targetShift) {
      this.permutaStatusMessage.set('Erro: Vocês já possuem a mesma escala neste dia.');
      return;
    }

    const updatedCurrent = { ...current, scale: { ...current.scale, [day]: targetShift } };
    const updatedTarget = { ...target, scale: { ...target.scale, [day]: currentShift } };

    this.scaleService.updateCollaborator(updatedCurrent);
    this.scaleService.updateCollaborator(updatedTarget);
    this.isPermutaModalOpen.set(false);
    this.showToast(`Permuta realizada! Você assumiu o turno "${targetShift}" e ${target.name} assumiu "${currentShift}".`);

    // Add audit logs & notification
    this.scaleService.addAuditHistory(
      'PERMUTA_TURNO',
      `Permuta de escala no dia ${day}/06: ${current.name} (${currentShift} ⇄ ${targetShift}) com ${target.name}.`
    );

    const newNotif: AppNotification = {
      id: 'n_permuta_' + Math.random().toString(36).substring(2, 6),
      type: 'trade',
      message: `Permuta concluída: ${current.name} trocou o dia ${day} com ${target.name}.`,
      timestamp: 'Agora mesmo',
      read: false
    };
    this.notifications.set([newNotif, ...this.notifications()]);
  }

  // Simulated peer workers on same shift & day
  getConcomitantColegues(day: number): Collaborator[] {
    const current = this.getLoggedCollab();
    if (!current) return [];
    
    const currentShiftRaw = current.scale[day] || '-';
    const currentShift = (currentShiftRaw === '-') ? this.getShiftCode(current.shift) : currentShiftRaw;
    if (this.isSiglaAbsence(currentShift)) return []; // Off duty

    return this.scaleService.collaborators().filter(c => {
      if (c.id === current.id) return false;
      if (c.sector !== current.sector) return false;
      const cShiftRaw = c.scale[day] || '-';
      const cShift = (cShiftRaw === '-') ? this.getShiftCode(c.shift) : cShiftRaw;
      return cShift === currentShift;
    });
  }

  openDbConfigModal() {
    this.isDbModalOpen.set(true);
  }

  openSolicitarFolgaModal() {
    this.isSolicitarFolgaModalOpen.set(true);
  }

  // Gemini IA Image Scaling Import Simulation
  openImportModal() {
    this.isImportModalOpen.set(true);
    this.importingState.set('idle');
    this.scannedTextResult.set('');
    this.scannedDataParsed.set([]);
    this.unrecognizedCodes.set([]);
  }

  async triggerAIScan(event: any) {
    const file = event.target?.files?.[0];
    if (!file) return;

    this.importingState.set('processing');
    this.showToast('IA lendo o arquivo de escala...');

    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const text = e.target?.result as string || '';
      const parsed: any[] = [];
      const lines = text.split('\n');
      const rawLines: string[] = [];
      
      const collabs = this.scaleService.collaborators();
      const validSiglas = new Set(this.scaleService.siglaTypes().map(s => s.code.toUpperCase()));
      validSiglas.add('X');
      validSiglas.add('-');
      validSiglas.add('F');
      validSiglas.add('LM');
      
      const validShifts = new Set(this.scaleService.shiftTypes().map(s => s.code.toUpperCase()));
      const unrecognizedSet = new Set<string>();

      const isKnown = (token: string): boolean => {
        const u = token.toUpperCase().trim();
        return u === '-' || u === '' || u === '?' || validSiglas.has(u) || validShifts.has(u);
      };
      
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        rawLines.push(trimmed);

        const lowerLine = trimmed.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        let matchedCollab: Collaborator | null = null;
        for (const collab of collabs) {
          const collabLower = collab.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (lowerLine.includes(collabLower)) {
            matchedCollab = collab;
            break;
          }
        }
        
        if (!matchedCollab) {
           for (const collab of collabs) {
             const parts = collab.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(' ');
             if (parts.length >= 2) {
               const first = parts[0];
               const last = parts[parts.length - 1];
               if (lowerLine.includes(first) && lowerLine.includes(last)) {
                 matchedCollab = collab;
                 break;
               }
             }
           }
        }

        if (matchedCollab) {
          const scaleUpdates: { day: number, value: string }[] = [];
          
          if (trimmed.includes('|')) {
             const tokens = trimmed.split('|').map(s => s.trim().toUpperCase());
             // tokens[0] is name info. tokens[1..31] are the days.
             for(let d = 1; d <= 31 && d < tokens.length; d++) {
                let token = tokens[d];
                if (token === '' || token === '-') {
                  token = this.getShiftCode(matchedCollab.shift);
                } else {
                  // Check parts of this token to see if they are unrecognized
                  const parts = token.split(/[\s/,\-]+/).filter((p: string) => p !== '');
                  parts.forEach((p: string) => {
                    const u = p.toUpperCase().trim();
                    const isNum = /^\d+$/.test(u) || /^\d+[:.,hH]\d+$/.test(u);
                    if (u !== '-' && u !== '' && u !== '?' && !isNum && !validSiglas.has(u) && !validShifts.has(u)) {
                      unrecognizedSet.add(u);
                    }
                  });
                }
                scaleUpdates.push({ day: d, value: token });
             }
          } else {
             const tokens = trimmed.split(/[,;\t|\s]+/);
             let day = 1;
             for (let i = 0; i < tokens.length; i++) {
               let token = tokens[i].toUpperCase();
               
               // Allow anything that is a valid sigla, OR any 1-4 letter string if it looks like a symbol, or numeric code
               const isNum = /^\d+$/.test(token) || /^\d+[:.,hH]\d+$/.test(token);
               if (validSiglas.has(token) || isNum || (token.length >= 1 && token.length <= 4 && /^[A-Z0-9\-]+$/.test(token))) {
                  // Only take up to 31 tokens. 
                  // Heuristic: scale values usually come after name.
                  if (day <= 31) {
                    if (token === '' || token === '-') {
                      token = this.getShiftCode(matchedCollab.shift);
                    }
                    const parts = token.split(/[\s/,\-]+/).filter((p: string) => p !== '');
                    parts.forEach((p: string) => {
                      const u = p.toUpperCase().trim();
                      const isPartNum = /^\d+$/.test(u) || /^\d+[:.,hH]\d+$/.test(u);
                      if (u !== '-' && u !== '' && u !== '?' && !isPartNum && !validSiglas.has(u) && !validShifts.has(u)) {
                        unrecognizedSet.add(u);
                      }
                    });
                    scaleUpdates.push({ day, value: token });
                    day++;
                  }
               }
             }
          }
          
          if (scaleUpdates.length > 0) {
            parsed.push({
              collab: matchedCollab,
              updates: scaleUpdates
            });
          }
        }
      });
      
      this.unrecognizedCodes.set(Array.from(unrecognizedSet).sort());
      
      if (parsed.length === 0) {
        const rawLog = `[PROCESSO DE LEITURA]
Arquivo carregado: ${file.name} (${Math.round(file.size / 1024)} KB)

Aviso: Nenhum colaborador cadastrado foi encontrado nas linhas do arquivo.
O leitor requer um arquivo contendo os nomes dos colaboradores já cadastrados no banco de dados e os dados da escala na mesma linha.
Verifique se os nomes no PDF correspondem aos nomes no sistema.`;

        this.scannedTextResult.set(rawLog);
        this.scannedDataParsed.set([]);
        this.showToast('Nenhum colaborador válido encontrado no arquivo.');
      } else {
        const summary = parsed.map(p => `- ${p.collab.name}: ${p.updates.length} dias lidos`).join('\n');
        this.scannedTextResult.set(
          `[LEITURA DINÂMICA CONCLUÍDA]:\nArquivo processado: ${file.name}\nTotal de linhas lidas: ${lines.length}\nColaboradores extraídos: ${parsed.length}\n\nResumo:\n${summary}`
        );
        this.scannedDataParsed.set(parsed);
      }
      
      this.importingState.set('done');
      this.showToast('Escala importada e processada com sucesso!');
    };
    
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const arrayBufferReader = new FileReader();
      arrayBufferReader.onload = async (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
          let text = '';
          let dayXs: number[] = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            
            const lineMap = new Map<number, any[]>();
            content.items.forEach((item: any) => {
              if (item.str && item.str.trim() !== '') {
                const y = Math.round(item.transform[5] / 2) * 2;
                if (!lineMap.has(y)) {
                  lineMap.set(y, []);
                }
                lineMap.get(y)!.push(item);
              }
            });

            const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
            
            sortedYs.forEach(y => {
              const items = lineMap.get(y)!;
              items.sort((a, b) => a.transform[4] - b.transform[4]);
              const strs = items.map(i => i.str.trim()).filter(s => s !== '');
              
              if (strs.includes('1') && strs.includes('15') && strs.includes('31')) {
                 let currentDay = 1;
                 let tempXs: number[] = [];
                 for(let i=0; i<items.length; i++) {
                    if (items[i].str.trim() === currentDay.toString()) {
                       tempXs[currentDay] = items[i].transform[4];
                       currentDay++;
                    }
                 }
                 if (currentDay > 31) {
                    dayXs = tempXs; 
                 }
              }
            });

            sortedYs.forEach(y => {
              const itemsOnLine = lineMap.get(y)!;
              itemsOnLine.sort((a, b) => a.transform[4] - b.transform[4]);
              
              if (dayXs.length === 32) {
                 const infoItems = itemsOnLine.filter(item => item.transform[4] < dayXs[1] - 10);
                 const infoStr = infoItems.map(i => i.str.trim()).join(' ').trim();
                 
                 if (infoStr.length > 2) {
                    const dayValues: string[] = [];
                    for(let d=1; d<=31; d++) {
                       const targetX = dayXs[d];
                       const itemForDay = itemsOnLine.find(item => Math.abs(item.transform[4] - targetX) < 12);
                       if (itemForDay && itemForDay.str.trim() !== '') {
                         dayValues.push(itemForDay.str.trim());
                       } else {
                         dayValues.push('-');
                       }
                    }
                    text += infoStr + ' | ' + dayValues.join(' | ') + '\n';
                 } else {
                    text += itemsOnLine.map(item => item.str.trim()).join('   ') + '\n';
                 }
              } else {
                 text += itemsOnLine.map(item => item.str.trim()).join('   ') + '\n';
              }
            });
          }
          // Pass the extracted text to the existing reader logic
          reader.onload!({ target: { result: text } } as any);
        } catch (err) {
          console.error('Error reading PDF:', err);
          reader.onload!({ target: { result: '' } } as any);
        }
      };
      arrayBufferReader.readAsArrayBuffer(file);
    } else if (file.type === 'text/plain' || file.type === 'text/csv' || file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      reader.readAsText(file);
    } else {
      setTimeout(() => {
        reader.onload!({ target: { result: '' } } as any);
      }, 1800);
    }
  }

  async commitAIScannedUsers() {
    const parsedData = this.scannedDataParsed();
    if (parsedData.length === 0) return;

    this.showToast(`Atualizando escala para ${parsedData.length} colaboradores...`);

    const registeredSiglas = new Set(this.scaleService.siglaTypes().map(s => s.code.toUpperCase()));
    registeredSiglas.add('X');
    registeredSiglas.add('-');
    registeredSiglas.add('F');
    registeredSiglas.add('LM');
    const registeredShifts = new Set(this.scaleService.shiftTypes().map(s => s.code.toUpperCase()));
    
    // We will collect the updated collabs and bulk save them
    const updatedCollabs = this.scaleService.collaborators().map(collab => {
      const match = parsedData.find(p => p.collab.id === collab.id);
      if (match) {
        const newScale = { ...collab.scale };
        match.updates.forEach((upd: any) => {
          let val = (upd.value || '').toUpperCase().trim();
          if (val === '-' || val === '') {
            val = this.getShiftCode(collab.shift);
          }
          if (val !== '-' && val !== '' && val !== '?') {
            const parts = val.split(/[\s/,\-]+/).filter((p: string) => p !== '');
            const allKnown = parts.every((p: string) => {
              const u = p.trim();
              const isNum = /^\d+$/.test(u) || /^\d+[:.,hH]\d+$/.test(u);
              return u === '-' || u === '' || u === '?' || isNum || registeredSiglas.has(u) || registeredShifts.has(u);
            });
            if (!allKnown) {
              val = '?';
            }
          }
          newScale[upd.day] = val;
        });
        return { ...collab, scale: newScale };
      }
      return collab;
    });

    await this.scaleService.saveUpdatedListToDb(updatedCollabs, 'IMPORTACAO_ESCALA', 'Importação em lote de arquivo da escala.');

    this.isImportModalOpen.set(false);
    this.showToast(`A escala de ${parsedData.length} colaboradores foi atualizada com sucesso!`);
  }

  async registerUnrecognizedCodes() {
    const codes = this.unrecognizedCodes();
    if (codes.length === 0) return;

    this.showToast(`Cadastrando ${codes.length} sigla(s) no dicionário...`);

    const colors = [
      '#ef4444', // Red
      '#ec4899', // Pink
      '#f59e0b', // Amber/Orange
      '#3b82f6', // Blue
      '#8b5cf6', // Violet
      '#06b6d4', // Cyan
      '#14b8a6', // Teal
      '#10b981', // Emerald
      '#a855f7'  // Purple
    ];

    try {
      for (let i = 0; i < codes.length; i++) {
        const code = codes[i].toUpperCase().trim();
        // Generate a random pleasant color based on index or code
        let hash = 0;
        for (let j = 0; j < code.length; j++) {
          hash = code.charCodeAt(j) + ((hash << 5) - hash);
        }
        const color = colors[Math.abs(hash) % colors.length];

        const newSigla = {
          code: code,
          label: `Importada (${code})`,
          color: color,
          description: 'Gerada automaticamente via Leitor Inteligente de PDF.',
          textColor: '#ffffff'
        };

        await this.scaleService.saveSiglaType(newSigla);
      }

      this.unrecognizedCodes.set([]); // Clear unrecognized list
      this.showToast('Siglas cadastradas com sucesso! Dicionário de Siglas atualizado.');
    } catch (err: any) {
      console.error('Error auto-registering siglas:', err);
      this.showToast(`Falha ao cadastrar: ${err.message || err}`);
    }
  }

  startEditingCollab(collab: Collaborator) {
    this.editingCollab.set(collab);
    this.newCollabPhotoData.set(collab.photo || null);
    this.isCollabModalOpen.set(true);
    this.isNewSectorMode.set(false);
    this.isNewRoleMode.set(false);
    this.showToast(`Modo Edição: Editando ${collab.name}`);
  }

  cancelEditingCollab() {
    this.editingCollab.set(null);
    this.newCollabPhotoData.set(null);
    this.isCollabModalOpen.set(false);
    this.isNewSectorMode.set(false);
    this.isNewRoleMode.set(false);
  }

  saveEditedCollaborator(
    id: string,
    name: string,
    role: string,
    group: string,
    shift: string,
    sector: string,
    bh: number,
    score: number,
    photo?: string | null,
    birthday?: string,
    sd1Desc?: string, sd1Date?: string,
    sd2Desc?: string, sd2Date?: string,
    sd3Desc?: string, sd3Date?: string,
    sd4Desc?: string, sd4Date?: string,
    sd5Desc?: string, sd5Date?: string
  ) {
    if (!name.trim()) {
      this.showToast('O nome completo do colaborador é obrigatório.');
      return;
    }

    const specialDates: SpecialDate[] = [];
    if (sd1Desc && sd1Date) specialDates.push({ description: sd1Desc, date: sd1Date, priority: 1 });
    if (sd2Desc && sd2Date) specialDates.push({ description: sd2Desc, date: sd2Date, priority: 2 });
    if (sd3Desc && sd3Date) specialDates.push({ description: sd3Desc, date: sd3Date, priority: 3 });
    if (sd4Desc && sd4Date) specialDates.push({ description: sd4Desc, date: sd4Date, priority: 4 });
    if (sd5Desc && sd5Date) specialDates.push({ description: sd5Desc, date: sd5Date, priority: 5 });

    const target = this.scaleService.collaborators().find(c => c.id === id);
    if (!target) {
      this.showToast('Erro: Colaborador não encontrado.');
      return;
    }

    const getShiftCode = (s: string): string => {
      const norm = (s || '').toUpperCase().trim();
      const st = this.scaleService.shiftTypes().find(x => x.code.toUpperCase().trim() === norm || x.label.toUpperCase().trim() === norm);
      return st ? st.code : norm;
    };

    const oldShiftCode = getShiftCode(target.shift);
    const newShiftCode = getShiftCode(shift);
    const shiftType = this.scaleService.shiftTypes().find(s => s.code.trim().toUpperCase() === newShiftCode);
    const newHours = shiftType ? shiftType.hours : (newShiftCode === 'ADM' ? '8h00' : '7h20');

    const updatedScale = { ...target.scale };
    let shiftReallocated = false;

    if (oldShiftCode !== newShiftCode) {
      shiftReallocated = true;
      for (let day = 1; day <= 31; day++) {
        if (updatedScale[day] === oldShiftCode) {
          updatedScale[day] = newShiftCode;
        }
      }
    }

    const updatedCollab: Collaborator = {
      ...target,
      name,
      role,
      group,
      shift,
      hours: newHours,
      sector,
      bhBalance: bh,
      score,
      photo: photo || target.photo,
      birthday: birthday || '',
      specialDates,
      scale: updatedScale
    };

    this.scaleService.updateCollaborator(updatedCollab);

    if (shiftReallocated) {
      this.scaleService.addAuditHistory(
        'ALOCACAO_TURNO',
        `Colaborador ${target.name} reallocado do turno "${target.shift}" para "${shift}" (${newHours}) via atualização cadastral.`
      );
      this.showToast(`Colaborador atualizado e reallocado para o turno "${shift}"!`);
    } else {
      this.showToast('Colaborador atualizado com sucesso!');
    }

    this.cancelEditingCollab();
  }

  onCollabPhotoSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 120;
        const MAX_HEIGHT = 120;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          this.newCollabPhotoData.set(dataUrl);
        } else {
          this.newCollabPhotoData.set(e.target.result);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  onPortalPhotoSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    const collab = this.getLoggedCollab();
    if (!collab) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 120;
        const MAX_HEIGHT = 120;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          const updatedCollab: Collaborator = {
            ...collab,
            photo: dataUrl,
            photoUrl: dataUrl
          };
          this.scaleService.updateCollaborator(updatedCollab);
          this.showToast('Foto de perfil atualizada com sucesso!');
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}
