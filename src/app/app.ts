import { Component, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScaleService, Collaborator, ShiftType, SpecialDate, FolgaRequest } from './scale.service';
import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

// Safe localStorage helper to prevent SecurityError/DOMException crashes in iframe/webview environments
function safeGetLocalStorage(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage !== null) {
      return window.localStorage.getItem(key);
    }
  } catch (e) {
    console.warn(`localStorage.getItem blocked for ${key}:`, e);
  }
  return null;
}

function safeSetLocalStorage(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage !== null) {
      window.localStorage.setItem(key, value);
    }
  } catch (e) {
    console.warn(`localStorage.setItem blocked for ${key}:`, e);
  }
}

// Safe localStorage helper to prevent SecurityError/DOMException crashes in iframe/webview environments
function safeRemoveLocalStorage(key: string): void {
  try {
    if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage !== null) {
      window.localStorage.removeItem(key);
    }
  } catch (e) {
    console.warn(`localStorage.removeItem blocked for ${key}:`, e);
  }
}

// Safe sessionStorage helpers
function safeGetSessionStorage(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && 'sessionStorage' in window && window.sessionStorage !== null) {
      return window.sessionStorage.getItem(key);
    }
  } catch (e) {
    console.warn(`sessionStorage.getItem blocked for ${key}:`, e);
  }
  return null;
}

function safeSetSessionStorage(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && 'sessionStorage' in window && window.sessionStorage !== null) {
      window.sessionStorage.setItem(key, value);
    }
  } catch (e) {
    console.warn(`sessionStorage.setItem blocked for ${key}:`, e);
  }
}

function safeRemoveSessionStorage(key: string): void {
  try {
    if (typeof window !== 'undefined' && 'sessionStorage' in window && window.sessionStorage !== null) {
      window.sessionStorage.removeItem(key);
    }
  } catch (e) {
    console.warn(`sessionStorage.removeItem blocked for ${key}:`, e);
  }
}

interface AppNotification {
  id: string;
  type: 'publish' | 'alert' | 'trade';
  message: string;
  timestamp: string;
  read: boolean;
}

export interface HourlyWeatherItem {
  timeIso: string;
  timeLabel: string;
  dateLabel: string;
  hour: number;
  temp: number;
  rainProb: number;
  humidity: number;
  wind: number;
  weatherCode: number;
  conditionText: string;
  icon: string;
  isNight: boolean;
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
  public turnVacationTab = signal<'work' | 'vacation'>('work');

  public setPortalSequenceTab(tab: 'weeks' | 'stretches'): void {
    this.portalSequenceTab.set(tab);
  }

  public setPortalWidgetTab(tab: 'trabalho' | 'semanas'): void {
    this.portalWidgetTab.set(tab);
  }

  public setTurnVacationTab(tab: 'work' | 'vacation'): void {
    this.turnVacationTab.set(tab);
    const logged = this.getLoggedCollab();
    if (logged) {
      const currentDay = this.selectedCalendarDay();
      if (tab === 'work') {
        const workDays = this.getCollabWorkDays(logged);
        if (workDays.length > 0 && !workDays.includes(currentDay)) {
          this.selectedCalendarDay.set(workDays[0]);
        }
      } else {
        const vacationDays = this.getCollabOffDays(logged);
        if (vacationDays.length > 0 && !vacationDays.includes(currentDay)) {
          this.selectedCalendarDay.set(vacationDays[0]);
        }
      }
    }
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

  // Sub tab navigation: 'matrix' | 'ger.turnos' | 'siglas' | 'team' | 'team-mgmt' | 'portal' | 'dashboard' | 'escala' | 'perfil' | 'equipe' | 'indicadores'
  public activeSubTab = signal<'matrix' | 'ger.turnos' | 'siglas' | 'team' | 'team-mgmt' | 'portal' | 'dashboard' | 'escala' | 'perfil' | 'equipe' | 'indicadores' | 'solicitacoes'>('portal');
  
  public teamViewMode = signal<'gallery' | 'mgmt'>('gallery');
  public editingCollab = signal<Collaborator | null>(null);
  public isPortalCollabListOpen = signal<boolean>(false);
  public isPortalRulesOpen = signal<boolean>(false);
  public isPortalEditingDates = signal<boolean>(false);
  public isProfileEditOpen = signal<boolean>(false);
  public teamDailyTab = signal<'trabalhando' | 'folgando'>('trabalhando');

  // Login e Fluxo de Primeiro Acesso
  public loginNameInput = signal<string>('');
  public loginPasswordInput = signal<string>('');
  public confirmPasswordInput = signal<string>('');
  public loginError = signal<string | null>(null);
  public matchedCollab = signal<Collaborator | null>(null);
  public isFirstAccess = signal<boolean>(false);
  
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

  // Simulated Day of Month (1 to 31) for Folga request window check. Defaults to today's date.
  simulatedDayOfMonth = signal<number>(new Date().getDate());

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
  public hidePastDays = signal<boolean>(true);
  public coworkersFilter = signal<'MEU_TURNO' | 'TURNO_ANTERIOR' | 'TURNO_POSTERIOR' | 'TODOS'>('MEU_TURNO');

  // Weather Sub-Header Signals & Methods (Guarulhos Base)
  public rawHourlyWeather = signal<HourlyWeatherItem[]>([]);
  public weatherLoading = signal<boolean>(false);
  public weatherError = signal<string | null>(null);
  public weatherSelectedShift = signal<'AUTO' | 'MANHA' | 'TARDE' | 'NOITE' | 'ADM' | 'PROXIMAS'>('AUTO');
  public weatherExpanded = signal<boolean>(true);
  public selectedWeatherHourIdx = signal<number | null>(null);

  public weatherChartData = computed(() => {
    const list = this.shiftWeatherList();
    if (list.length === 0) {
      return {
        points: [],
        linePath: '',
        areaPath: '',
        minTemp: 0,
        maxTemp: 0
      };
    }

    const temps = list.map(item => item.temp);
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const tempDiff = maxTemp - minTemp;

    // Expand bounds for visual padding
    const tempMinLimit = minTemp - (tempDiff > 0 ? tempDiff * 0.25 : 4);
    const tempMaxLimit = maxTemp + (tempDiff > 0 ? tempDiff * 0.25 : 4);
    const limitDiff = tempMaxLimit - tempMinLimit || 1;

    const points = list.map((item, i) => {
      // 1000px width total, 40px margin on each side, so 920px usable span
      const x = (list.length > 1) ? (i / (list.length - 1)) * 920 + 40 : 500;
      // 110px height total. We'll map temperatures to y-values between 45 (top) and 80 (bottom)
      const y = 80 - ((item.temp - tempMinLimit) / limitDiff) * 35;
      
      const rainHeight = (item.rainProb / 100) * 25;
      const rainY = 90 - rainHeight;

      return {
        item,
        index: i,
        x,
        y,
        temp: item.temp,
        rainHeight,
        rainY
      };
    });

    let linePath = '';
    let areaPath = '';
    if (points.length > 0) {
      linePath = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const p0 = points[i - 1];
        const p1 = points[i];
        const cpX1 = p0.x + (p1.x - p0.x) / 2;
        const cpY1 = p0.y;
        const cpX2 = p0.x + (p1.x - p0.x) / 2;
        const cpY2 = p1.y;
        linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
      }
      areaPath = linePath + ` L ${points[points.length - 1].x} 90 L ${points[0].x} 90 Z`;
    }

    return {
      points,
      linePath,
      areaPath,
      minTemp,
      maxTemp
    };
  });

  public activeWeatherItem = computed(() => {
    const list = this.shiftWeatherList();
    if (list.length === 0) return null;
    const idx = this.selectedWeatherHourIdx();
    if (idx !== null && idx >= 0 && idx < list.length) {
      return list[idx];
    }
    return list[0];
  });

  public async fetchWeatherForecast(): Promise<void> {
    this.weatherLoading.set(true);
    this.weatherError.set(null);
    try {
      const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-23.4356&longitude=-46.4731&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m&forecast_days=2&timezone=America%2FSao_Paulo');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      if (data && data.hourly && Array.isArray(data.hourly.time)) {
        const times: string[] = data.hourly.time;
        const temps: number[] = data.hourly.temperature_2m || [];
        const humidities: number[] = data.hourly.relative_humidity_2m || [];
        const rainProbs: number[] = data.hourly.precipitation_probability || [];
        const codes: number[] = data.hourly.weather_code || [];
        const winds: number[] = data.hourly.wind_speed_10m || [];

        const items: HourlyWeatherItem[] = times.map((t, idx) => {
          const dateObj = new Date(t);
          const hour = dateObj.getHours();
          const timeLabel = `${String(hour).padStart(2, '0')}:00`;
          const dateLabel = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
          
          const code = codes[idx] ?? 0;
          const { text, icon } = this.getWmoWeatherDetails(code, hour);

          return {
            timeIso: t,
            timeLabel,
            dateLabel,
            hour,
            temp: Math.round(temps[idx] ?? 20),
            rainProb: Math.round(rainProbs[idx] ?? 0),
            humidity: Math.round(humidities[idx] ?? 50),
            wind: Math.round(winds[idx] ?? 10),
            weatherCode: code,
            conditionText: text,
            icon,
            isNight: hour < 6 || hour >= 18
          };
        });

        this.rawHourlyWeather.set(items);
      } else {
        throw new Error('Formato de resposta inválido');
      }
    } catch (err: unknown) {
      console.warn('Weather fetch warning, falling back to simulated weather:', err);
      this.rawHourlyWeather.set(this.generateFallbackWeather());
    } finally {
      this.weatherLoading.set(false);
    }
  }

  public getWmoWeatherDetails(code: number, hour: number): { text: string; icon: string } {
    const isNightTime = hour < 6 || hour >= 18;
    switch (code) {
      case 0:
        return { text: 'Céu Limpo', icon: isNightTime ? 'nights_stay' : 'wb_sunny' };
      case 1:
        return { text: 'Predominantemente Limpo', icon: isNightTime ? 'nights_stay' : 'wb_sunny' };
      case 2:
        return { text: 'Parcialmente Nublado', icon: isNightTime ? 'nights_stay' : 'partly_cloudy_day' };
      case 3:
        return { text: 'Nublado', icon: 'cloud' };
      case 45:
      case 48:
        return { text: 'Nevoeiro', icon: 'foggy' };
      case 51:
      case 53:
      case 55:
        return { text: 'Garoa Leve', icon: 'grain' };
      case 61:
      case 63:
        return { text: 'Chuva', icon: 'water_drop' };
      case 65:
        return { text: 'Chuva Forte', icon: 'water_drop' };
      case 80:
      case 81:
      case 82:
        return { text: 'Pancadas de Chuva', icon: 'umbrella' };
      case 95:
      case 96:
      case 99:
        return { text: 'Tempestade com Raios', icon: 'thunderstorm' };
      default:
        return { text: 'Parcialmente Nublado', icon: isNightTime ? 'nights_stay' : 'partly_cloudy_day' };
    }
  }

  public generateFallbackWeather(): HourlyWeatherItem[] {
    const items: HourlyWeatherItem[] = [];
    const now = new Date();
    for (let i = 0; i < 48; i++) {
      const d = new Date(now.getTime() + i * 3600000);
      const hour = d.getHours();
      const isNight = hour < 6 || hour >= 18;
      const temp = isNight ? 16 + (i % 3) : 22 + (i % 5);
      const rainProb = (hour >= 14 && hour <= 18) ? 30 : 5;
      const { text, icon } = this.getWmoWeatherDetails(rainProb > 25 ? 61 : 1, hour);
      items.push({
        timeIso: d.toISOString(),
        timeLabel: `${String(hour).padStart(2, '0')}:00`,
        dateLabel: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        hour,
        temp,
        rainProb,
        humidity: 60,
        wind: 12,
        weatherCode: rainProb > 25 ? 61 : 1,
        conditionText: text,
        icon,
        isNight
      });
    }
    return items;
  }

  public getShiftHoursInfo(shiftStr?: string): { startHour: number; endHour: number; label: string } {
    const norm = (shiftStr || '').toUpperCase().trim();
    if (norm.includes('NOITE') || norm.includes('3ª') || norm.includes('3º') || norm.includes('NIGHT') || norm === 'N1' || norm === 'N2') {
      return { startHour: 21, endHour: 6, label: 'Turno Noite (21h00 às 06h00)' };
    }
    if (norm.includes('MANHÃ') || norm.includes('MANHA') || norm.includes('1ª') || norm.includes('1º') || norm === 'T1' || norm === 'M1') {
      return { startHour: 6, endHour: 15, label: 'Turno Manhã (06h00 às 15h00)' };
    }
    if (norm.includes('TARDE') || norm.includes('2ª') || norm.includes('2º') || norm === 'T2') {
      return { startHour: 15, endHour: 0, label: 'Turno Tarde (15h00 às 00h00)' };
    }
    if (norm.includes('ADM') || norm.includes('ADMIN') || norm.includes('7H20')) {
      return { startHour: 8, endHour: 17, label: 'Turno ADM (08h00 às 17h00)' };
    }
    return { startHour: 21, endHour: 6, label: 'Turno Operacional (21h00 às 06h00)' };
  }

  public shiftWeatherList = computed(() => {
    const raw = this.rawHourlyWeather();
    if (raw.length === 0) return [];

    const mode = this.weatherSelectedShift();
    const logged = this.getLoggedCollab();

    let startHour = 21;
    let endHour = 6;

    if (mode === 'NOITE') {
      startHour = 21; endHour = 6;
    } else if (mode === 'MANHA') {
      startHour = 6; endHour = 15;
    } else if (mode === 'TARDE') {
      startHour = 15; endHour = 0;
    } else if (mode === 'ADM') {
      startHour = 8; endHour = 17;
    } else if (mode === 'PROXIMAS') {
      const currentHour = new Date().getHours();
      let startIdx = raw.findIndex(item => item.hour === currentHour);
      if (startIdx === -1) startIdx = 0;
      return raw.slice(startIdx, startIdx + 12);
    } else {
      const shiftStr = logged ? logged.shift : '';
      const parsed = this.getShiftHoursInfo(shiftStr);
      startHour = parsed.startHour;
      endHour = parsed.endHour;
    }

    let startIdx = raw.findIndex(item => item.hour === startHour);
    if (startIdx === -1) startIdx = 0;

    let totalItems = 10;
    if (startHour > endHour) {
      totalItems = (24 - startHour) + endHour + 1;
    } else {
      totalItems = (endHour - startHour) + 1;
    }

    return raw.slice(startIdx, startIdx + totalItems);
  });

  public currentWeatherOverview = computed(() => {
    const list = this.shiftWeatherList();
    if (list.length === 0) {
      return { temp: '--', condition: 'Carregando...', icon: 'cloud', rainProb: 0, humidity: 0, wind: 0 };
    }
    const first = list[0];
    return {
      temp: `${first.temp}°C`,
      condition: first.conditionText,
      icon: first.icon,
      rainProb: first.rainProb,
      humidity: first.humidity,
      wind: first.wind
    };
  });

  public getLoggedCollabShiftLabel(): string {
    const logged = this.getLoggedCollab();
    const mode = this.weatherSelectedShift();
    if (mode === 'MANHA') return 'Visão: Turno Manhã (06h00 às 15h00)';
    if (mode === 'TARDE') return 'Visão: Turno Tarde (15h00 às 00h00)';
    if (mode === 'NOITE') return 'Visão: Turno Noite (21h00 às 06h00)';
    if (mode === 'ADM') return 'Visão: Turno ADM (08h00 às 17h00)';
    if (mode === 'PROXIMAS') return 'Visão: Próximas 12 Horas';
    if (logged) {
      const parsed = this.getShiftHoursInfo(logged.shift);
      return `Seu Turno: ${logged.shift} (${parsed.startHour.toString().padStart(2, '0')}h00 às ${parsed.endHour.toString().padStart(2, '0')}h00)`;
    }
    return 'Turno Noite (21h00 às 06h00)';
  }

  // Chatbot Bob Signals & Methods
  public isBobChatOpen = signal<boolean>(false);
  public bobChatMessages = signal<{ sender: 'user' | 'bob'; text: string; timestamp: Date }[]>([]);
  public bobChatInput = signal<string>('');
  public isBobTyping = signal<boolean>(false);

  public scrollBobChatToBottom() {
    const scroll = () => {
      const chatEl = document.getElementById('bob_chat_body');
      if (chatEl) {
        chatEl.scrollTop = chatEl.scrollHeight;
        const lastMsg = chatEl.lastElementChild;
        if (lastMsg) {
          lastMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    };
    scroll();
    setTimeout(scroll, 30);
    setTimeout(scroll, 100);
    setTimeout(scroll, 250);
    setTimeout(scroll, 500);
  }

  public toggleBobChat() {
    const nextVal = !this.isBobChatOpen();
    this.isBobChatOpen.set(nextVal);
    if (nextVal) {
      if (this.bobChatMessages().length === 0) {
        const logged = this.getLoggedCollab();
        const welcomeText = logged
          ? `Olá, **${logged.name}**! Eu sou o **Bob**, o seu assistente de escala inteligente do Escala Easy VIBRA. 🤖🗓️\n\nComo posso te ajudar hoje? Você pode me perguntar sobre as suas folgas, com quem você trabalha hoje, ou pedir folga para o próximo mês!`
          : `Olá! Eu sou o **Bob**, o assistente de escala do Escala Easy VIBRA. Por favor, faça login para conversarmos!`;
        this.bobChatMessages.set([{ sender: 'bob', text: welcomeText, timestamp: new Date() }]);
      }
      this.scrollBobChatToBottom();
    }
  }

  async sendChatMessageToBob() {
    const text = this.bobChatInput().trim();
    if (!text) return;

    this.bobChatInput.set('');

    const timestamp = new Date();
    this.bobChatMessages.update(msgs => [...msgs, { sender: 'user', text, timestamp }]);
    this.scrollBobChatToBottom();
    
    this.isBobTyping.set(true);
    this.scrollBobChatToBottom();

    try {
      const logged = this.getLoggedCollab();
      const payload = {
        message: text,
        collabId: logged ? logged.id : null,
        simulatedDay: this.simulatedDayOfMonth(),
        activeMonth: this.scaleService.activeMonth(),
        activeYear: this.scaleService.activeYear()
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Falha na comunicação com o Bob.');
      }

      const data = await response.json();
      
      this.bobChatMessages.update(msgs => [...msgs, { 
        sender: 'bob', 
        text: data.reply || 'Desculpe, tive um probleminha para processar sua mensagem.', 
        timestamp: new Date() 
      }]);
      this.scrollBobChatToBottom();

      if (data.action) {
        console.log('Bob executed an action on Supabase:', data.action);
        this.showToast(`Bob: Ação executada com sucesso!`);
        await this.scaleService.syncSupabase();
      }

    } catch (error) {
      console.error(error);
      this.bobChatMessages.update(msgs => [...msgs, { 
        sender: 'bob', 
        text: 'Ocorreu um erro ao falar com o Bob. Por favor, verifique sua conexão ou a chave de API.', 
        timestamp: new Date() 
      }]);
      this.scrollBobChatToBottom();
    } finally {
      this.isBobTyping.set(false);
      this.scrollBobChatToBottom();
    }
  }

  formatMarkdown(text: string): string {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/^\s*-[\s]+(.*?)$/gm, '<li class="ml-4 list-disc">$1</li>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

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

  getCollabPhoto(collab: unknown): string {
    const c = collab as { photoUrl?: string; photo?: string } | null;
    if (c && c.photoUrl) return c.photoUrl;
    if (c && c.photo) return c.photo;

    const isLight = this.isLightTheme();

    const delicateAvatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="softBgLight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F8FAFC"/>
      <stop offset="100%" stop-color="#E2E8F0"/>
    </linearGradient>
    <linearGradient id="softBgDark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F172A"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="avatarGradLight" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#94A3B8"/>
      <stop offset="100%" stop-color="#64748B"/>
    </linearGradient>
    <linearGradient id="avatarGradDark" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#64748B"/>
      <stop offset="100%" stop-color="#475569"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="${isLight ? 'url(#softBgLight)' : 'url(#softBgDark)'}"/>
  <rect x="1" y="1" width="98" height="98" fill="none" stroke="${isLight ? '#CBD5E1' : '#1E293B'}" stroke-width="1.5" opacity="0.6"/>
  <g opacity="0.88">
    <circle cx="50" cy="37" r="14.5" fill="${isLight ? 'url(#avatarGradLight)' : 'url(#avatarGradDark)'}"/>
    <path d="M 50 53 C 32 53, 21 68, 21 84 C 21 86, 23 88, 25 88 L 75 88 C 77 88, 79 86, 79 84 C 79 68, 68 53, 50 53 Z" fill="${isLight ? 'url(#avatarGradLight)' : 'url(#avatarGradDark)'}"/>
  </g>
</svg>`;

    return 'data:image/svg+xml;utf8,' + encodeURIComponent(delicateAvatarSvg);
  }

  // Signal & Estado do Modal de Recorte de Foto (Crop)
  public isCropModalOpen = signal<boolean>(false);
  public cropImageSrc = signal<string | null>(null);
  public cropZoom = signal<number>(1);
  public cropOffsetX = signal<number>(0);
  public cropOffsetY = signal<number>(0);

  private isDraggingCrop = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartOffsetX = 0;
  private dragStartOffsetY = 0;

  // Método de seleção de arquivo
  onProfilePhotoSelectedForCrop(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      if (e.target?.result) {
        this.cropImageSrc.set(e.target.result as string);
        this.cropZoom.set(1);
        this.cropOffsetX.set(0);
        this.cropOffsetY.set(0);
        this.isCropModalOpen.set(true);
      }
      if (input) input.value = '';
    };
    reader.readAsDataURL(file);
  }

  closeCropModal() {
    this.isCropModalOpen.set(false);
    this.cropImageSrc.set(null);
    this.cropZoom.set(1);
    this.cropOffsetX.set(0);
    this.cropOffsetY.set(0);
  }

  zoomInCrop() {
    this.cropZoom.update(z => Math.min(3.5, +(z + 0.15).toFixed(2)));
  }

  zoomOutCrop() {
    this.cropZoom.update(z => Math.max(0.5, +(z - 0.15).toFixed(2)));
  }

  resetCrop() {
    this.cropZoom.set(1);
    this.cropOffsetX.set(0);
    this.cropOffsetY.set(0);
  }

  // Drag / Arrasto da Foto
  startCropDrag(event: MouseEvent | TouchEvent) {
    this.isDraggingCrop = true;
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    this.dragStartX = clientX;
    this.dragStartY = clientY;
    this.dragStartOffsetX = this.cropOffsetX();
    this.dragStartOffsetY = this.cropOffsetY();
  }

  onCropDrag(event: MouseEvent | TouchEvent) {
    if (!this.isDraggingCrop) return;
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    const deltaX = clientX - this.dragStartX;
    const deltaY = clientY - this.dragStartY;
    this.cropOffsetX.set(this.dragStartOffsetX + deltaX);
    this.cropOffsetY.set(this.dragStartOffsetY + deltaY);
  }

  endCropDrag() {
    this.isDraggingCrop = false;
  }

  // Aplica o recorte e gera imagem em alta resolução num Canvas
  applyPhotoCrop() {
    const imgSrc = this.cropImageSrc();
    if (!imgSrc) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const CROP_SIZE = 240;
      canvas.width = CROP_SIZE;
      canvas.height = CROP_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);

      const baseScale = Math.max(CROP_SIZE / img.width, CROP_SIZE / img.height);
      const scale = baseScale * this.cropZoom();

      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;

      const centerX = CROP_SIZE / 2 + this.cropOffsetX();
      const centerY = CROP_SIZE / 2 + this.cropOffsetY();

      const drawX = centerX - drawWidth / 2;
      const drawY = centerY - drawHeight / 2;

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.88);

      const logged = this.getLoggedCollab();
      if (logged) {
        const updatedCollab: Collaborator = {
          ...logged,
          photo: croppedDataUrl,
          photoUrl: croppedDataUrl
        };
        this.scaleService.updateCollaborator(updatedCollab);
        this.showToast('Foto de perfil atualizada e recortada com sucesso!');
      }

      this.closeCropModal();
    };
    img.src = imgSrc;
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
  public showWelcomeModal = signal<boolean>(!safeGetLocalStorage('welcome_modal_dismissed'));

  // Print prevention states
  public showPrintWarningModal = signal<boolean>(false);
  public printWarningSource = signal<string>('');

  public triggerPrintWarning(source: string) {
    this.printWarningSource.set(source);
    this.showPrintWarningModal.set(true);
  }

  public async confirmPrintWarning() {
    this.showPrintWarningModal.set(false);
    const source = this.printWarningSource() || 'Captura de tela/Impressão';
    const logged = this.getLoggedCollab();
    const userName = logged ? logged.name : 'USUÁRIO NÃO LOGADO';
    const description = `Usuário ${userName} confirmou tentativa de print/impressão via: ${source}.`;
    await this.scaleService.addAuditHistory('TENTATIVA_PRINT', description);
    this.showToast('Tentativa registrada no histórico de auditoria com sucesso!');
  }

  public cancelPrintWarning() {
    this.showPrintWarningModal.set(false);
    this.showToast('Ação cancelada pelo usuário.');
  }

  public closeWelcomeModal() {
    safeSetLocalStorage('welcome_modal_dismissed', 'true');
    this.showWelcomeModal.set(false);
  }

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
  editingRowScaleDraft = signal<Record<number, string>>({});

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
    const counts: Record<string, number> = { 'MANHÃ': 0, 'TARDE': 0, 'MADRUGADA': 0, 'ADMINISTRATIVO': 0, 'NOITE': 0 };
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
    
    const availableCountByDay: Record<number, number> = {};
    
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
    const working: {collab: any, shift: any, val: string, energy: number}[] = [];
    const absent: {collab: any, sigla: any, val: string}[] = [];
    const unknown: {collab: any, val: string}[] = [];

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

    const workingByShift: Record<string, { shift: any, items: typeof working }> = {};
    working.forEach(w => {
      const code = w.shift ? w.shift.code : w.val;
      if (!workingByShift[code]) {
        workingByShift[code] = { shift: w.shift, items: [] };
      }
      workingByShift[code].items.push(w);
    });

    const absentBySigla: Record<string, { sigla: any, items: typeof absent }> = {};
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
    const counts: Record<string, number> = {
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

  // --- Direct Edit Dates Logic ---
  public readonly daysOptions = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  public readonly monthsOptions = [
    { value: '01', name: 'Jan' },
    { value: '02', name: 'Fev' },
    { value: '03', name: 'Mar' },
    { value: '04', name: 'Abr' },
    { value: '05', name: 'Mai' },
    { value: '06', name: 'Jun' },
    { value: '07', name: 'Jul' },
    { value: '08', name: 'Ago' },
    { value: '09', name: 'Set' },
    { value: '10', name: 'Out' },
    { value: '11', name: 'Nov' },
    { value: '12', name: 'Dez' }
  ];

  public editingSpecialDates = signal<{date: string, description: string, priority: number}[]>([]);

  public openDaySelectorForIndex = signal<number | null>(null);
  public openMonthSelectorForIndex = signal<number | null>(null);
  public specialDateToDeleteIndex = signal<number | null>(null);

  isMonthDisabled(month: string, day: string): boolean {
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    if (d === 31) {
      return [2, 4, 6, 9, 11].includes(m);
    }
    if (d === 30) {
      return m === 2;
    }
    return false;
  }

  clearSpecialDates() {
    this.editingSpecialDates.set([]);
  }

  openEditSpecialDates() {
    this.isPortalEditingDates.set(true);
    const logged = this.getLoggedCollab();
    if (logged) {
       const currentDates = JSON.parse(JSON.stringify(logged.specialDates || []))
         .filter((d: any) => d && d.description && !d.description.startsWith('BOB_METADATA:'));
       this.editingSpecialDates.set(currentDates);
    }
  }

  updateSpecialDateDay(index: number, dayValue: string) {
    this.editingSpecialDates.update(dates => {
      const newDates = [...dates];
      if (index >= 0 && index < newDates.length) {
        const currentVal = newDates[index].date || '2026-01-01';
        const parts = currentVal.split('-');
        const year = parts[0] || '2026';
        const month = parts[1] || '01';
        const newDay = dayValue.padStart(2, '0');
        // If we selected 31, but month doesn't support it, maybe change month? No, the rule is to disable months when 31 is selected.
        // Wait, if we change the day to 31, and current month is Feb, we should probably change the month to Jan so we don't have an invalid date.
        let newMonth = month;
        if (this.isMonthDisabled(month, newDay)) {
           newMonth = '01'; // Default to Jan if current month is disabled
        }

        newDates[index] = {
          ...newDates[index],
          date: `${year}-${newMonth}-${newDay}`
        };
      }
      this.openDaySelectorForIndex.set(null);
      return newDates;
    });
  }

  updateSpecialDateMonth(index: number, monthValue: string) {
    this.editingSpecialDates.update(dates => {
      const newDates = [...dates];
      if (index >= 0 && index < newDates.length) {
        const currentVal = newDates[index].date || '2026-01-01';
        const parts = currentVal.split('-');
        const year = parts[0] || '2026';
        const day = parts[2] || '01';
        
        if (this.isMonthDisabled(monthValue, day)) {
            // Cannot select this month! Wait, we disable it in UI so user can't click it. But just in case:
            return newDates;
        }

        newDates[index] = {
          ...newDates[index],
          date: `${year}-${monthValue.padStart(2, '0')}-${day}`
        };
      }
      this.openMonthSelectorForIndex.set(null);
      return newDates;
    });
  }

  updateSpecialDateRow(index: number, field: 'date' | 'description', value: string) {
    this.editingSpecialDates.update(dates => {
      const newDates = [...dates];
      newDates[index] = { ...newDates[index], [field]: value };
      return newDates;
    });
  }

  addSpecialDateRow() {
    this.editingSpecialDates.update(dates => [...dates, { date: '2026-01-01', description: '', priority: 1 }]);
  }

  removeSpecialDateRow(index: number) {
    this.specialDateToDeleteIndex.set(index);
  }

  confirmDeleteSpecialDate() {
    const index = this.specialDateToDeleteIndex();
    if (index !== null) {
      this.editingSpecialDates.update(dates => {
        const newDates = [...dates];
        newDates.splice(index, 1);
        return newDates;
      });
      this.specialDateToDeleteIndex.set(null);
    }
  }

  cancelDeleteSpecialDate() {
    this.specialDateToDeleteIndex.set(null);
  }

  saveSpecialDates() {
    const logged = this.getLoggedCollab();
    if (!logged) return;
    const validDates = this.editingSpecialDates().filter(d => d.date && d.description);
    const metaDates = (logged.specialDates || []).filter(d => d && d.description && d.description.startsWith('BOB_METADATA:'));
    const updated = {
       ...logged,
       specialDates: [...validDates, ...metaDates]
    };
    this.scaleService.updateCollaborator(updated);
    this.isPortalEditingDates.set(false);
    this.showToast('Datas importantes atualizadas com sucesso!');
  }

  getImportantDatesForCollab(collab: any): { dateLabel: string; day: string; monthLabel: string; label: string; icon: string; color: string; details: string; priorityLabel?: string; rawDate: string; isBirthday?: boolean; priorityValue?: number }[] {
    if (!collab) return [];
    const dates: { dateLabel: string; day: string; monthLabel: string; label: string; icon: string; color: string; details: string; priorityLabel?: string; rawDate: string; isBirthday?: boolean; priorityValue?: number }[] = [];
    
    // Birthday
    if (collab.birthday) {
      const parts = collab.birthday.split('-');
      if (parts.length === 3) {
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        
        dates.push({
          dateLabel: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
          day: String(d).padStart(2, '0'),
          monthLabel: monthNames[m - 1],
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
        if (!sd.date || !sd.description || sd.description.startsWith('BOB_METADATA:')) continue;
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
            day: String(d).padStart(2, '0'),
            monthLabel: monthNames[m - 1],
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
    const counts: Record<number, number> = {};
    
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
      id: 'n_update_1',
      type: 'publish',
      message: 'Atualização de melhorias realizada em 23/07/2026 às 20:00: Novo visual do dashboard e otimização do gráfico de temperatura.',
      timestamp: '23/07/2026, 20:00',
      read: false
    },
    {
      id: 'n_update_2',
      type: 'publish',
      message: 'Conexão em tempo real estabelecida com sucesso com o banco de dados Supabase.',
      timestamp: '23/07/2026, 16:54',
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
  newShiftTransparentBg = signal<boolean>(false);
  newShiftDarkColor = signal<string>('#3b82f6');
  newShiftDarkTextColor = signal<string>('#ffffff');
  newShiftDarkTransparentBg = signal<boolean>(false);
  editingShiftCode = signal<string | null>(null);
  activeShiftThemeTab = signal<'light' | 'dark'>('light');

  // Sigla manager editing state
  newSiglaCode = signal<string>('');
  newSiglaLabel = signal<string>('');
  newSiglaColor = signal<string>('#64748b');
  newSiglaTextColor = signal<string>('#ffffff');
  newSiglaDescription = signal<string>('');
  newSiglaComputaAusencia = signal<boolean>(false);
  newSiglaTransparentBg = signal<boolean>(false);
  newSiglaDarkColor = signal<string>('#64748b');
  newSiglaDarkTextColor = signal<string>('#ffffff');
  newSiglaDarkTransparentBg = signal<boolean>(false);
  editingSiglaCode = signal<string | null>(null);
  activeSiglaThemeTab = signal<'light' | 'dark'>('light');

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
  isPortalDayEditModalOpen = signal<boolean>(false);
  portalEditSelectedDay = signal<number>(1);

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

  public isHoracio(collab: Collaborator | null): boolean {
    if (!collab) return false;
    const nameNorm = collab.name
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    const isHoracioName = nameNorm === 'HORACIO' || nameNorm.startsWith('HORACIO') || nameNorm.includes('HORACIO');
    const isAdminRole = collab.role.toUpperCase() === 'ADMINISTRADOR' || collab.role.toUpperCase() === 'ADMIN';
    return collab.id === '058' || isHoracioName || isAdminRole;
  }

  public isAdmin(collab: Collaborator | null): boolean {
    if (!collab) return false;
    return !!collab.isAdmin || this.isHoracio(collab);
  }

  public canEdit(): boolean {
    const logged = this.getLoggedCollab();
    if (logged && this.isAdmin(logged)) {
      return true;
    }
    return this.scaleService.currentRole() !== 'OPERADOR';
  }

  private inactivityTimeoutId: any = null;

  public resetInactivityTimer() {
    if (typeof window === 'undefined') return;
    
    const loggedId = this.selectedSimulatedCollabId();
    if (loggedId) {
      safeSetLocalStorage('lastActivityTime', Date.now().toString());

      if (this.inactivityTimeoutId) {
        clearTimeout(this.inactivityTimeoutId);
      }

      this.inactivityTimeoutId = setTimeout(() => {
        this.logoutDueToInactivity();
      }, 5 * 60 * 1000); // 5 minutes inactivity
    }
  }

  private logoutDueToInactivity() {
    if (this.selectedSimulatedCollabId()) {
      this.logout();
      this.showToast('Sessão encerrada por inatividade de 5 minutos.');
    }
  }

  constructor() {
    effect(() => {
      const loggedId = this.selectedSimulatedCollabId();
      this.scaleService.selectedSimulatedCollabId.set(loggedId);
    });

    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      this.activeSubTab.set('portal');
    }
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);
    this.fetchWeatherForecast();
    this.showToast('Escala Easy VIBRA - Protótipo MVP Pronto');
    if (typeof document !== 'undefined') {
      document.body.classList.add('light-theme');
    }

    if (typeof window !== 'undefined') {
      const reset = () => this.resetInactivityTimer();
      ['click', 'mousemove', 'keydown', 'scroll', 'touchstart'].forEach(event => {
        window.addEventListener(event, reset, { passive: true });
      });
      this.resetInactivityTimer();

      // Interceptar atalhos de impressão/screenshot
      window.addEventListener('keydown', (event: KeyboardEvent) => {
        // Ctrl+P ou Cmd+P
        if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
          event.preventDefault();
          this.triggerPrintWarning('Atalho de Impressão (Ctrl+P / Cmd+P)');
        }
        // PrintScreen key
        if (event.key === 'PrintScreen') {
          event.preventDefault();
          this.triggerPrintWarning('Tecla PrintScreen (Captura de Tela)');
        }
      });

      // Interceptar antes de imprimir
      window.addEventListener('beforeprint', () => {
        this.triggerPrintWarning('Diálogo de Impressão do Navegador');
      });
    }

    // Enforce permission limits for logged-in non-admin users
    effect(() => {
      const logged = this.getLoggedCollab();
      const currentTab = this.activeSubTab();
      if (logged && !this.isAdmin(logged)) {
        const adminTabs = ['matrix', 'ger.turnos', 'siglas', 'team', 'team-mgmt'];
        if (adminTabs.includes(currentTab)) {
          setTimeout(() => {
            this.activeSubTab.set('portal');
            this.showToast('Acesso restrito. Redirecionado para o seu Portal.');
          }, 0);
        }
      }
    });

    // Restore session from localStorage once collaborators are loaded
    effect(() => {
      const collabs = this.scaleService.collaborators();
      if (collabs.length > 0 && !this.selectedSimulatedCollabId() && !this.hasInitiallyLogged()) {
        this.hasInitiallyLogged.set(true); // Ensure this block runs only once
        
        // Detect if running in development mode (AI Studio, localhost, or inside an iframe)
        const isDevelopment = typeof window !== 'undefined' && (
          window.location.hostname === 'localhost' ||
          window.location.hostname.includes('127.0.0.1') ||
          window.location.hostname.includes('ais-dev') ||
          window.location.hostname.includes('aistudio') ||
          window.location.hostname.includes('googleusercontent') ||
          window.location.hostname.includes('cloudshell') ||
          window.location.hostname.includes('web-preview') ||
          (window.location.hostname.includes('run.app') && !window.location.hostname.includes('prod')) ||
          (window.location.hostname.includes('run.app') && window.location.hostname.includes('-dev-')) ||
          (window.self !== window.top) // If we are inside an iframe (AI Studio preview iframe)
        );
        
        const devLoggedOut = safeGetSessionStorage('dev_logged_out') === 'true';

        if (isDevelopment && !devLoggedOut) {
          // Dev Mode Auto-Login: Find first administrator/supervisor or fall back to first collaborator
          const devCollab = collabs.find(c => this.isAdmin(c)) || collabs[0];
          if (devCollab) {
            this.selectedSimulatedCollabId.set(devCollab.id);
            this.scaleService.selectedCollabName.set(devCollab.name);
            this.scaleService.currentRole.set(devCollab.role);
            safeSetLocalStorage('selectedSimulatedCollabId', devCollab.id);
            safeSetLocalStorage('lastActivityTime', Date.now().toString());
            safeSetSessionStorage('session_active', 'true');
            this.resetInactivityTimer();
            const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
            if (this.isAdmin(devCollab) && !isMobile) {
              this.activeSubTab.set('matrix');
            } else {
              this.activeSubTab.set('portal');
              this.autoSelectTodayTabForLoggedCollab(devCollab);
            }
            this.showToast(`Modo Desenvolvimento: Auto-login como ${devCollab.name} (${devCollab.role})`);
            return;
          }
        }

        const restoredId = safeGetLocalStorage('selectedSimulatedCollabId');
        const lastActivity = safeGetLocalStorage('lastActivityTime');
        const sessionActive = safeGetSessionStorage('session_active');
        
        // Browser tab / window close check with modern, resilient fallback:
        // if sessionStorage does not have 'session_active' marker, but we have a restoredId from localStorage,
        // we check if the last activity was very recent (within 45 seconds). If it was, this is considered
        // a page reload, application code update, or quick container reboot, so we preserve the session
        // and re-initialize 'session_active'. If it was longer, the tab/browser was likely closed and reopened later,
        // so we clear the session.
        if (restoredId && !sessionActive) {
          const isRecentRefresh = lastActivity && (Date.now() - parseInt(lastActivity, 10) < 45 * 1000);
          if (isRecentRefresh) {
            safeSetSessionStorage('session_active', 'true');
          } else {
            safeRemoveLocalStorage('selectedSimulatedCollabId');
            safeRemoveLocalStorage('lastActivityTime');
            return;
          }
        }

        if (restoredId && lastActivity) {
          const elapsed = Date.now() - parseInt(lastActivity, 10);
          if (elapsed > 5 * 60 * 1000) {
            // Expired (5 minutes of inactivity)
            safeRemoveLocalStorage('selectedSimulatedCollabId');
            safeRemoveLocalStorage('lastActivityTime');
            safeRemoveSessionStorage('session_active');
          } else {
            const collab = collabs.find(c => c.id === restoredId);
            if (collab) {
              this.selectedSimulatedCollabId.set(restoredId);
              this.scaleService.selectedCollabName.set(collab.name);
              this.scaleService.currentRole.set(collab.role);
              this.resetInactivityTimer();
              const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
              if (this.isAdmin(collab) && !isMobile) {
                this.activeSubTab.set('matrix');
              } else {
                this.activeSubTab.set('portal');
                this.autoSelectTodayTabForLoggedCollab(collab);
              }
            }
          }
        }
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const month = this.selectedMonthIndex() + 1;
      this.scaleService.activeMonth.set(month);
      this.scaleService.activeYear.set(this.currentYear()); // Standard this.currentYear() year for UI
      if (this.scaleService.activeDb() === 'supabase') {
        this.scaleService.syncSupabase();
      }
    }, { allowSignalWrites: true });

    // Auto-match collaborator for first access detection dynamically as they type
    effect(() => {
      const name = this.loginNameInput().trim();
      if (!name) {
        this.matchedCollab.set(null);
        this.isFirstAccess.set(false);
        return;
      }
      const typedName = name.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const collabs = this.scaleService.collaborators();
      const found = collabs.find(c => {
        const normName = c.name.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return normName === typedName || normName.includes(typedName);
      });
      if (found) {
        this.matchedCollab.set(found);
        this.isFirstAccess.set(!found.password || found.password.trim() === '');
      } else {
        this.matchedCollab.set(null);
        this.isFirstAccess.set(false);
      }
    }, { allowSignalWrites: true });

    // Efeito para forçar o RBAC: Colaboradores normais ficam estritamente travados no Portal do Colaborador
    effect(() => {
      const logged = this.getLoggedCollab();
      if (logged && !this.isAdmin(logged)) {
        if (this.activeSubTab() !== 'portal') {
          this.activeSubTab.set('portal');
        }
      }
    });
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

  normalizeShift(s: string): string {
    const upper = (s || '').toUpperCase().trim();
    if (upper === 'M' || upper === 'MANHÃ' || upper === 'MANHA') return 'M';
    if (upper === 'T' || upper === 'TARDE') return 'T';
    if (upper === 'N' || upper === 'NOITE' || upper === 'MADRUGADA') return 'N';
    if (upper === 'ADM' || upper === 'ADMINISTRATIVO') return 'ADM';
    return upper;
  }

  normalizeRole(r: string): string {
    const upper = (r || '').toUpperCase().trim();
    if (upper === 'LIDER' || upper === 'LÍDER' || upper === 'LÍDER DE TURNO') return 'LIDER';
    return upper;
  }

  // Presentation Mode: Focus only on Night Shift ("Noite / Madrugada / N")
  onlyNightShift = signal<boolean>(false);

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

      const matchesSearch = !query || 
        (c.name || '').toLowerCase().includes(query) || 
        (c.group || '').toLowerCase().includes(query) ||
        (c.role || '').toLowerCase().includes(query) ||
        (c.shift || '').toLowerCase().includes(query) ||
        (c.sector || '').toLowerCase().includes(query);

      const matchesRole = role === 'TODOS' || 
        this.normalizeRole(c.role) === this.normalizeRole(role);
      const normCollabSector = (c.sector || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const normFilterSector = sector.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const matchesSector = sector === 'TODOS' || normCollabSector === normFilterSector;
      const matchesShift = shift === 'TODOS' || 
        this.normalizeShift(c.shift) === this.normalizeShift(shift);
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
      return (a.name || '').localeCompare(b.name || '', 'pt-BR');
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

    const list = this.scaleService.collaborators().filter(c => {
      const matchesSearch = !query || 
        (c.name || '').toLowerCase().includes(query) || 
        (c.role || '').toLowerCase().includes(query) || 
        (c.shift || '').toLowerCase().includes(query) || 
        (c.sector || '').toLowerCase().includes(query);

      const matchesRole = role === 'TODOS' || 
        this.normalizeRole(c.role) === this.normalizeRole(role);
      const matchesShift = shift === 'TODOS' || 
        this.normalizeShift(c.shift) === this.normalizeShift(shift);

      return matchesSearch && matchesRole && matchesShift;
    });

    list.sort((a, b) => {
      const nameA = (a.name || '').localeCompare(b.name || '', 'pt-BR');
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

  getFilteredCollabOffDays(collab: any): number[] {
    const days = this.getCollabOffDays(collab);
    if (this.hidePastDays()) {
      return days.filter(day => !this.isPastDay(day));
    }
    return days;
  }

  getCollabWorkDays(collab: any): number[] {
    if (!collab) return [];
    return this.daysInMonth().filter(day => this.isWorkDay(collab, day));
  }

  getFilteredCollabWorkDays(collab: any): number[] {
    const days = this.getCollabWorkDays(collab);
    if (this.hidePastDays()) {
      return days.filter(day => !this.isPastDay(day));
    }
    return days;
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

  getEnergyPercent(seqStats: any, collab?: any): number {
    if (!collab) {
      collab = this.getLoggedCollab();
    }
    if (collab) {
      const chargingState = this.getDescansoChargingState(collab);
      if (chargingState.isRecharging) {
        return chargingState.percent;
      }
    }
    if (!seqStats) return 100;
    if (!seqStats.isWorking) return 100;
    return Math.max(20, 100 - (seqStats.streak - 1) * 20);
  }

  getDescansoChargingState(collab: any): { isRecharging: boolean; percent: number; statusLabel: string; hoursToStart: number; descText: string } {
    if (!collab) {
      return { isRecharging: false, percent: 100, statusLabel: 'Carregada', hoursToStart: 0, descText: '' };
    }

    const seqStats = this.getConsecutiveWorkStats(collab);
    const now = new Date();
    const currentHour = now.getHours();
    
    // Find next shift start:
    const parsedShift = this.getShiftHoursInfo(collab.shift);
    const startHour = parsedShift.startHour;
    const endHour = parsedShift.endHour;

    let nextShiftStart: Date | null = null;
    let lastShiftEnd: Date | null = null;

    const maxDay = this.daysInMonth().length;
    const currentDay = now.getDate();

    // 1. Find next shift start
    for (let d = currentDay; d <= currentDay + 7; d++) {
      const targetDayNum = d > maxDay ? d - maxDay : d;
      const targetMonthOffset = d > maxDay ? 1 : 0;
      
      const targetYear = now.getFullYear();
      const targetMonth = now.getMonth() + targetMonthOffset;
      
      if (this.isWorkDay(collab, targetDayNum)) {
        if (d === currentDay && currentHour >= startHour) {
          continue; // next shift will be tomorrow or later
        }
        
        nextShiftStart = new Date(targetYear, targetMonth, targetDayNum, startHour, 0, 0, 0);
        break;
      }
    }

    // 2. Find last shift end
    for (let d = currentDay; d >= currentDay - 7; d--) {
      const targetDayNum = d <= 0 ? maxDay + d : d;
      const targetMonthOffset = d <= 0 ? -1 : 0;
      
      const targetYear = now.getFullYear();
      const targetMonth = now.getMonth() + targetMonthOffset;

      if (this.isWorkDay(collab, targetDayNum)) {
        if (d === currentDay && currentHour < endHour) {
          continue; // last shift was yesterday or earlier
        }
        
        const shiftInfo = this.getShiftHoursInfo(collab.shift);
        lastShiftEnd = new Date(targetYear, targetMonth, targetDayNum, shiftInfo.endHour, 0, 0, 0);
        break;
      }
    }

    // Fallbacks if not found
    if (!nextShiftStart) {
      nextShiftStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, startHour, 0, 0, 0);
    }
    if (!lastShiftEnd) {
      lastShiftEnd = new Date(now.getTime() - 12 * 3600 * 1000);
    }

    const diffMs = nextShiftStart.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    let isCurrentlyOnShift = false;
    if (this.isWorkDay(collab, currentDay)) {
      if (startHour < endHour) {
        isCurrentlyOnShift = currentHour >= startHour && currentHour < endHour;
      } else {
        isCurrentlyOnShift = currentHour >= startHour || currentHour < endHour;
      }
    }

    if (isCurrentlyOnShift) {
      return {
        isRecharging: false,
        percent: Math.max(20, 100 - (seqStats.streak - 1) * 20),
        statusLabel: seqStats.fatigueLevel,
        hoursToStart: 0,
        descText: seqStats.alertMessage
      };
    }

    // They are off-duty / resting (recharging)
    const targetTimeMs = nextShiftStart.getTime() - 2 * 3600 * 1000;
    const nowTimeMs = now.getTime();

    let percent = 100;
    let statusLabel = 'Carregada';

    if (nowTimeMs >= targetTimeMs) {
      percent = 100;
      statusLabel = 'Carregada';
    } else {
      const totalRestTimeMs = targetTimeMs - lastShiftEnd.getTime();
      const elapsedRestTimeMs = nowTimeMs - lastShiftEnd.getTime();
      
      if (totalRestTimeMs > 0 && elapsedRestTimeMs > 0) {
        percent = Math.floor((elapsedRestTimeMs / totalRestTimeMs) * 100);
      } else {
        const remainingHours = diffHours - 2;
        percent = Math.floor(Math.max(10, Math.min(100, 100 - (remainingHours / 12) * 100)));
      }
      
      percent = Math.max(10, Math.min(100, percent));
      
      if (percent < 100) {
        statusLabel = `Carregando ${percent}%`;
      } else {
        statusLabel = 'Carregada';
      }
    }

    const roundedHours = Math.max(0, Math.round(diffHours * 10) / 10);
    const descText = percent >= 100 
      ? `Descanso completo. Prontidão total para o turno (${roundedHours}h restantes).`
      : `Bateria biológica em recuperação. Faltam ${roundedHours}h para o início do turno.`;

    return {
      isRecharging: true,
      percent,
      statusLabel,
      hoursToStart: diffHours,
      descText
    };
  }

  getArcStrokeColor(arcIndex: number, collab: any): string {
    if (!collab) return this.isLightTheme() ? '#e2e8f0' : '#223147';
    
    const seqStats = this.getConsecutiveWorkStats(collab);
    const chargingState = this.getDescansoChargingState(collab);
    
    if (chargingState.isRecharging) {
      const requiredPercent = arcIndex * 20;
      if (chargingState.percent >= requiredPercent) {
        return '#10b981'; // emerald-500
      } else {
        return this.isLightTheme() ? '#e2e8f0' : '#223147';
      }
    } else {
      if (arcIndex === 1) {
        return '#10b981';
      } else if (arcIndex === 2) {
        return (seqStats.streak >= 2) ? '#3b82f6' : (this.isLightTheme() ? '#e2e8f0' : '#223147');
      } else if (arcIndex === 3) {
        return (seqStats.streak >= 3) ? '#eab308' : (this.isLightTheme() ? '#e2e8f0' : '#223147');
      } else if (arcIndex === 4) {
        return (seqStats.streak >= 4) ? '#f97316' : (this.isLightTheme() ? '#e2e8f0' : '#223147');
      } else {
        return (seqStats.streak >= 5) ? '#ef4444' : (this.isLightTheme() ? '#e2e8f0' : '#223147');
      }
    }
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
    if (!this.canEdit()) {
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
    if (!this.canEdit()) {
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
    if (!this.canEdit()) {
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
    this.newShiftTransparentBg.set(!!shift.transparentBg);
    this.newShiftDarkColor.set(shift.darkColor || shift.color);
    this.newShiftDarkTextColor.set(shift.darkTextColor || shift.textColor || '#ffffff');
    this.newShiftDarkTransparentBg.set(shift.darkTransparentBg !== undefined ? !!shift.darkTransparentBg : !!shift.transparentBg);
    this.activeShiftThemeTab.set('light');
    
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
    this.newShiftTransparentBg.set(false);
    this.newShiftDarkColor.set('#3b82f6');
    this.newShiftDarkTextColor.set('#ffffff');
    this.newShiftDarkTransparentBg.set(false);
    this.activeShiftThemeTab.set('light');
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
          transparentBg: this.newShiftTransparentBg(),
          darkColor: this.newShiftDarkColor(),
          darkTextColor: this.newShiftDarkTextColor(),
          darkTransparentBg: this.newShiftDarkTransparentBg(),
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
        transparentBg: this.newShiftTransparentBg(),
        darkColor: this.newShiftDarkColor(),
        darkTextColor: this.newShiftDarkTextColor(),
        darkTransparentBg: this.newShiftDarkTransparentBg(),
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
    const scUpper = shiftCode.toUpperCase().trim();
    return this.scaleService.collaborators().filter(c => {
      const cCode = this.getShiftCode(c.shift).toUpperCase().trim();
      return cCode === scUpper || this.normalizeShift(c.shift) === this.normalizeShift(shiftCode);
    }).length;
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
    this.newSiglaTransparentBg.set(!!sigla.transparentBg);
    this.newSiglaDarkColor.set(sigla.darkColor || sigla.color);
    this.newSiglaDarkTextColor.set(sigla.darkTextColor || sigla.textColor || '#ffffff');
    this.newSiglaDarkTransparentBg.set(sigla.darkTransparentBg !== undefined ? !!sigla.darkTransparentBg : !!sigla.transparentBg);
    this.activeSiglaThemeTab.set('light');
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
    this.newSiglaTransparentBg.set(false);
    this.newSiglaDarkColor.set('#64748b');
    this.newSiglaDarkTextColor.set('#ffffff');
    this.newSiglaDarkTransparentBg.set(false);
    this.activeSiglaThemeTab.set('light');
  }

  async saveSiglaType() {
    const code = this.newSiglaCode().trim().toUpperCase();
    const label = this.newSiglaLabel().trim();
    const color = this.newSiglaColor();
    const textColor = this.newSiglaTextColor();
    const desc = this.newSiglaDescription().trim();
    const computaAusencia = this.newSiglaComputaAusencia();
    const transparentBg = this.newSiglaTransparentBg();
    const darkColor = this.newSiglaDarkColor();
    const darkTextColor = this.newSiglaDarkTextColor();
    const darkTransparentBg = this.newSiglaDarkTransparentBg();

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
          await this.scaleService.updateSiglaTypeCode(oldCode, { 
            code, 
            label, 
            color, 
            description: desc, 
            textColor, 
            computaAusencia, 
            transparentBg,
            darkColor,
            darkTextColor,
            darkTransparentBg
          });
          this.scaleService.addAuditHistory('EDICAO_SIGLA_CODIGO', `Sigla "${oldCode}" renomeada para "${code}" pelo gestor.`);
          this.showToast(`Sigla "${oldCode}" alterada para "${code}" com sucesso.`);
        } else {
          // Standard edit of existing sigla
          const updatedSigla = {
            code: code,
            label: label,
            color: color,
            description: desc,
            textColor: textColor,
            computaAusencia: computaAusencia,
            transparentBg: transparentBg,
            darkColor: darkColor,
            darkTextColor: darkTextColor,
            darkTransparentBg: darkTransparentBg
          };
          this.scaleService.isProcessing.set(true);
          await this.scaleService.saveSiglaType(updatedSigla);
          this.scaleService.addAuditHistory('EDICAO_SIGLA', `Sigla "${code}" editada pelo gestor.`);
          this.showToast(`Sigla "${code}" actualizada com sucesso.`);
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
        const newSigla = {
          code: code,
          label: label,
          color: color,
          description: desc,
          textColor: textColor,
          computaAusencia: computaAusencia,
          transparentBg: transparentBg,
          darkColor: darkColor,
          darkTextColor: darkTextColor,
          darkTransparentBg: darkTransparentBg
        };
        this.scaleService.isProcessing.set(true);
        await this.scaleService.saveSiglaType(newSigla);
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

  isShiftOrSiglaTransparent(code: string): boolean {
    const upperCode = (code || '-').toUpperCase().trim();
    if (upperCode === '-' || upperCode === '?') return false;

    const sigla = this.scaleService.siglaTypes().find(s => s.code.trim().toUpperCase() === upperCode);
    if (sigla) {
      if (this.isLightTheme()) {
        return !!sigla.transparentBg;
      } else {
        return sigla.darkTransparentBg !== undefined ? !!sigla.darkTransparentBg : !!sigla.transparentBg;
      }
    }

    const shift = this.scaleService.shiftTypes().find(s => s.code.trim().toUpperCase() === upperCode || s.label.trim().toUpperCase() === upperCode);
    if (shift) {
      if (this.isLightTheme()) {
        return !!shift.transparentBg;
      } else {
        return shift.darkTransparentBg !== undefined ? !!shift.darkTransparentBg : !!shift.transparentBg;
      }
    }

    return false;
  }

  getShiftOrSiglaBorderColor(code: string): string {
    const upperCode = (code || '-').toUpperCase().trim();
    if (upperCode === '-' || upperCode === '?') return 'rgba(0, 0, 0, 0.1)';

    const sigla = this.scaleService.siglaTypes().find(s => s.code.trim().toUpperCase() === upperCode);
    if (sigla) {
      if (this.isLightTheme()) {
        return sigla.color;
      } else {
        return sigla.darkColor || sigla.color;
      }
    }

    const shift = this.scaleService.shiftTypes().find(s => s.code.trim().toUpperCase() === upperCode || s.label.trim().toUpperCase() === upperCode);
    if (shift) {
      if (this.isLightTheme()) {
        return shift.color;
      } else {
        return shift.darkColor || shift.color;
      }
    }

    return this.isLightTheme() ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
  }

  // Dynamic colors for matrix rendering
  getShiftOrSiglaColor(code: string, day?: number): string {
    const upperCode = (code || '-').toUpperCase().trim();
    if (this.isShiftOrSiglaTransparent(upperCode)) {
      return 'transparent';
    }

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
      return shift.darkColor || shift.color;
    }

    // Try finding in siglaTypes
    const sigla = this.scaleService.siglaTypes().find(s => s.code.trim().toUpperCase() === upperCode);
    if (sigla) {
      if (this.isLightTheme()) {
        return sigla.color;
      }
      return sigla.darkColor || sigla.color;
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
      if (upperCode === 'X') return '#ecfdf5';
      if (upperCode === 'F') return '#f59e0b';
      if (upperCode === 'LM') return '#ef4444';
      if (upperCode.startsWith('M')) return '#10b981';
      if (upperCode.startsWith('T')) return '#3b82f6';
      if (upperCode.startsWith('N')) return '#8b5cf6';
      if (upperCode === 'ADM') return '#06b6d4';
      return '#10b981';
    } else {
      if (upperCode === 'X') return '#061d15';
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

    if (this.isShiftOrSiglaTransparent(upperCode)) {
      const sigla = this.scaleService.siglaTypes().find(s => s.code.trim().toUpperCase() === upperCode);
      if (sigla) {
        if (this.isLightTheme()) {
          return sigla.textColor || sigla.color || '#ffffff';
        } else {
          return sigla.darkTextColor || sigla.darkColor || sigla.textColor || sigla.color || '#ffffff';
        }
      }
      const shift = this.scaleService.shiftTypes().find(s => s.code.trim().toUpperCase() === upperCode || s.label.trim().toUpperCase() === upperCode);
      if (shift) {
        if (this.isLightTheme()) {
          return shift.textColor || shift.color || '#ffffff';
        } else {
          return shift.darkTextColor || shift.darkColor || shift.textColor || shift.color || '#ffffff';
        }
      }
    }

    // Try finding in shiftTypes first
    const shift = this.scaleService.shiftTypes().find(s => s.code.trim().toUpperCase() === upperCode || s.label.trim().toUpperCase() === upperCode);
    if (shift) {
      if (this.isLightTheme()) {
        return shift.textColor || '#ffffff';
      }
      return shift.darkTextColor || shift.textColor || '#ffffff';
    }

    // Try finding in siglaTypes
    const sigla = this.scaleService.siglaTypes().find(s => s.code.trim().toUpperCase() === upperCode);
    if (sigla) {
      if (this.isLightTheme()) {
        return sigla.textColor || '#ffffff';
      }
      return sigla.darkTextColor || sigla.textColor || '#ffffff';
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

  // Métodos de autenticação real integrada ao Supabase

  public checkLoginName() {
    this.loginError.set(null);
    const rawInput = this.loginNameInput().trim();
    if (!rawInput) {
      this.loginError.set('Por favor, insira o seu nome.');
      return;
    }
    const typedName = rawInput.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const collabs = this.scaleService.collaborators();
    // Procurar por correspondência de nome exato ou contido
    const found = collabs.find(c => {
      const normName = c.name.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return normName === typedName || normName.includes(typedName);
    });

    if (!found) {
      this.loginError.set('Colaborador não encontrado. Por favor, digite seu nome exatamente como cadastrado no sistema.');
      return;
    }

    this.matchedCollab.set(found);
    if (!found.password || found.password.trim() === '') {
      this.isFirstAccess.set(true);
    } else {
      this.isFirstAccess.set(false);
    }
  }

  public handleLoginSubmit() {
    this.loginError.set(null);
    const collab = this.matchedCollab();
    if (!collab) return;

    const pin = this.loginPasswordInput().trim();
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      this.loginError.set('A senha de acesso deve possuir exatamente 4 dígitos numéricos.');
      return;
    }

    if (this.isFirstAccess()) {
      const confirmPin = this.confirmPasswordInput().trim();
      if (pin !== confirmPin) {
        this.loginError.set('As senhas digitadas não coincidem. Por favor, redigite e confirme.');
        return;
      }

      // Cadastrar nova senha de 4 dígitos no Supabase
      const updatedCollab = { ...collab, password: pin };
      this.scaleService.updateCollaborator(updatedCollab);
      
      // Realizar login oficial
      this.selectedSimulatedCollabId.set(collab.id);
      this.scaleService.selectedCollabName.set(collab.name);
      this.scaleService.currentRole.set(collab.role);
      
      safeSetLocalStorage('selectedSimulatedCollabId', collab.id);
      safeSetLocalStorage('lastActivityTime', Date.now().toString());
      safeSetSessionStorage('session_active', 'true');
      this.resetInactivityTimer();

      this.showToast(`Senha de 4 dígitos cadastrada com sucesso! Bem-vindo, ${collab.name}.`);
      this.clearLoginInputs();
      
      // Redirecionar dependendo de quem logou (Administradores para grid, restante para portal)
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      if (this.isAdmin(collab) && !isMobile) {
        this.activeSubTab.set('matrix');
      } else {
        this.activeSubTab.set('portal');
        this.autoSelectTodayTabForLoggedCollab(collab);
      }
    } else {
      // Login com senha existente
      if (collab.password === pin) {
        this.selectedSimulatedCollabId.set(collab.id);
        this.scaleService.selectedCollabName.set(collab.name);
        this.scaleService.currentRole.set(collab.role);
        
        safeSetLocalStorage('selectedSimulatedCollabId', collab.id);
        safeSetLocalStorage('lastActivityTime', Date.now().toString());
        safeSetSessionStorage('session_active', 'true');
        this.resetInactivityTimer();

        this.showToast(`Bem-vindo de volta, ${collab.name}!`);
        this.clearLoginInputs();
        
        const isMobileLogin = typeof window !== 'undefined' && window.innerWidth < 768;
        if (this.isAdmin(collab) && !isMobileLogin) {
          this.activeSubTab.set('matrix');
        } else {
          this.activeSubTab.set('portal');
          this.autoSelectTodayTabForLoggedCollab(collab);
        }
      } else {
        this.loginError.set('Senha incorreta de 4 dígitos. Por favor, tente novamente.');
      }
    }
  }

  public resetLoginState() {
    this.matchedCollab.set(null);
    this.isFirstAccess.set(false);
    this.loginPasswordInput.set('');
    this.confirmPasswordInput.set('');
    this.loginError.set(null);
  }

  private clearLoginInputs() {
    this.loginNameInput.set('');
    this.loginPasswordInput.set('');
    this.confirmPasswordInput.set('');
    this.matchedCollab.set(null);
    this.isFirstAccess.set(false);
    this.loginError.set(null);
  }

  // Auth Portal Simulation legacy wrapper
  openAuthModal(mode: 'LOGIN' | 'SIGNUP') {
    this.resetLoginState();
  }

  logout() {
    this.scaleService.selectedCollabName.set(null);
    this.selectedSimulatedCollabId.set(null);
    safeRemoveLocalStorage('selectedSimulatedCollabId');
    safeRemoveLocalStorage('lastActivityTime');
    safeRemoveSessionStorage('session_active');
    safeSetSessionStorage('dev_logged_out', 'true');
    if (this.inactivityTimeoutId) {
      clearTimeout(this.inactivityTimeoutId);
    }
    this.showToast('Sessão encerrada.');
    this.resetLoginState();
  }

  loginAsCollab(id: string) {
    const currentLogged = this.getLoggedCollab();
    if (currentLogged && !this.isAdmin(currentLogged) && currentLogged.id !== id) {
      this.showToast('Os avatares dos colegas são apenas informativos. Acesso restrito à sessão de outros colaboradores.');
      return;
    }
    this.selectedSimulatedCollabId.set(id);
    const collab = this.scaleService.collaborators().find(c => c.id === id);
    if (collab) {
      this.scaleService.selectedCollabName.set(collab.name);
      this.scaleService.currentRole.set(collab.role);
      
      safeSetLocalStorage('selectedSimulatedCollabId', collab.id);
      safeSetLocalStorage('lastActivityTime', Date.now().toString());
      safeSetSessionStorage('session_active', 'true');
      this.resetInactivityTimer();

      this.showToast(`Sessão simulada como ${collab.name}!`);
      if (this.isAdmin(collab)) {
        this.activeSubTab.set('matrix');
      } else {
        this.activeSubTab.set('portal');
        this.autoSelectTodayTabForLoggedCollab(collab);
      }
    } else {
      this.selectedSimulatedCollabId.set(null);
      this.scaleService.selectedCollabName.set('');
      this.scaleService.currentRole.set('SUPERVISOR');
      safeRemoveLocalStorage('selectedSimulatedCollabId');
      safeRemoveLocalStorage('lastActivityTime');
      safeRemoveSessionStorage('session_active');
    }
  }

  navigateToCollabPortal(id: string): void {
    const logged = this.getLoggedCollab();
    if (logged && !this.isAdmin(logged) && logged.id !== id) {
      this.showToast('Os avatares dos colegas são apenas informativos. Acesso restrito à sessão de outros colaboradores.');
      return;
    }
    this.loginAsCollab(id);
    this.isDayDetailsModalOpen.set(false);
    this.activeSubTab.set('portal');
  }

  isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 768;
  }

  getBaseShift(shift: string): string {
    if (!shift) return '';
    const s = shift.toUpperCase();
    if (s.includes('MANHÃ') || s.includes('MANHA')) return 'MANHÃ';
    if (s.includes('TARDE')) return 'TARDE';
    if (s.includes('NOITE')) return 'NOITE';
    if (s.includes('MADRUGADA')) return 'MADRUGADA';
    if (s.includes('ADMINISTRATIVO')) return 'ADMINISTRATIVO';
    return s;
  }

  getCollabTeamMembers(): Collaborator[] {
    const logged = this.getLoggedCollab();
    if (!logged) return [];
    const baseShift = this.getBaseShift(logged.shift);
    return this.scaleService.collaborators().filter(c => {
      return this.getBaseShift(c.shift) === baseShift;
    });
  }

  saveProfileChanges(collab: Collaborator, name: string, birthday: string, phone: string, photoUrl?: string) {
    if (!name || !name.trim()) {
      this.showToast('O nome não pode estar vazio.');
      return;
    }
    const updated: Collaborator = {
      ...collab,
      name: name.trim(),
      birthday: birthday ? birthday : collab.birthday,
      phone: phone.trim() || undefined,
      photoUrl: photoUrl && photoUrl.trim() ? photoUrl.trim() : collab.photoUrl
    };
    this.scaleService.updateCollaborator(updated);
    this.isProfileEditOpen.set(false);
    this.showToast('Perfil atualizado com sucesso!');
  }

  formatBirthday(birthday?: string): string {
    if (!birthday) return 'Não informada';
    const parts = birthday.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return birthday;
  }

  prevCalendarDay(): void {
    const cur = this.selectedCalendarDay();
    if (cur > 1) {
      this.selectedCalendarDay.set(cur - 1);
    }
  }

  nextCalendarDay(): void {
    const cur = this.selectedCalendarDay();
    const max = this.daysInMonth().length;
    if (cur < max) {
      this.selectedCalendarDay.set(cur + 1);
    }
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
    sd5Desc?: string, sd5Date?: string,
    isAdmin?: boolean,
    nickname?: string,
    gafesStr?: string
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

    const parsedGafes = gafesStr ? gafesStr.split('\n').map(g => g.trim()).filter(g => g.length > 0) : [];

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
      specialDates,
      undefined,
      isAdmin,
      nickname,
      parsedGafes
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
        if (!sd.date || !sd.description || sd.description.startsWith('BOB_METADATA:')) continue;
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

  onPortalCalendarDayClick(day: number): void {
    this.selectCalendarDay(day);
    this.openPortalDayEditModal(day);
  }

  openPortalDayEditModal(day: number): void {
    this.portalEditSelectedDay.set(day);
    this.isPortalDayEditModalOpen.set(true);
  }

  setPortalDayScale(code: string): void {
    const logged = this.getLoggedCollab();
    const day = this.portalEditSelectedDay();
    if (!logged || !day) return;

    const updatedScale = { ...logged.scale };
    const oldCode = updatedScale[day] || '-';
    updatedScale[day] = code;

    const updatedCollab = {
      ...logged,
      scale: updatedScale
    };

    this.scaleService.updateCollaborator(updatedCollab);
    
    // Find label for sigla or shift code
    const siglaObj = this.scaleService.siglaTypes().find(s => s.code.toUpperCase().trim() === code.toUpperCase().trim());
    const label = code === 'F' ? 'Folga' : (siglaObj?.label || code);
    const actionLabel = `Definida a escala do dia ${day} como "${label}" (${code}).`;
    this.showToast(actionLabel);

    // Register in audit history
    this.scaleService.addAuditHistory(
      'ALTERACAO_PORTAL',
      `Colaborador ${logged.name} alterou sua própria escala no dia ${day} via portal: de "${oldCode}" para "${code}"`
    );

    this.isPortalDayEditModalOpen.set(false);
  }

  togglePortalDayOff(day: number): void {
    const logged = this.getLoggedCollab();
    if (!logged) return;

    const dayInfo = this.getCollaboratorDayScheduleInfo(logged, day);
    const updatedScale = { ...logged.scale };

    let actionLabel = '';
    if (dayInfo.status === 'folga') {
      // Remove day off -> set to standard shift
      const shiftCode = logged.shift || 'ADM';
      updatedScale[day] = shiftCode;
      actionLabel = `Removida folga do dia ${day}. Definido turno de trabalho "${shiftCode}".`;
    } else {
      // Insert day off -> set to 'F'
      updatedScale[day] = 'F';
      actionLabel = `Inserida folga no dia ${day}.`;
    }

    const updatedCollab = {
      ...logged,
      scale: updatedScale
    };

    this.scaleService.updateCollaborator(updatedCollab);
    this.showToast(actionLabel);

    // Register in audit history
    this.scaleService.addAuditHistory(
      'ALTERACAO_PORTAL',
      `Colaborador ${logged.name} alterou sua própria escala no dia ${day} via portal: ${actionLabel}`
    );
  }

  sortCollaboratorsWithLoggedFirst(collabsList: any[]): any[] {
    const logged = this.getLoggedCollab();
    
    const getRank = (c: any) => {
      if (logged && c.id === logged.id) return 0;
      if (c.role === 'SUPERVISOR') return 1;
      if (c.role === 'LIDER') return 2;
      if (c.role === 'OPERADOR') return 3;
      return 4;
    };

    return [...collabsList].sort((a, b) => {
      const rA = getRank(a);
      const rB = getRank(b);
      if (rA !== rB) return rA - rB;
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  getPreviousShiftLabel(): string {
    const logged = this.getLoggedCollab();
    if (!logged) return 'ANTERIOR';
    const shift = (logged.shift || '').trim().toUpperCase();
    if (shift === 'MANHÃ' || shift === 'MANHA') return 'NOITE';
    if (shift === 'TARDE') return 'MANHÃ';
    if (shift === 'NOITE') return 'TARDE';
    return 'MANHÃ'; // Fallback
  }

  getPosteriorShiftLabel(): string {
    const logged = this.getLoggedCollab();
    if (!logged) return 'POSTERIOR';
    const shift = (logged.shift || '').trim().toUpperCase();
    if (shift === 'MANHÃ' || shift === 'MANHA') return 'TARDE';
    if (shift === 'TARDE') return 'NOITE';
    if (shift === 'NOITE') return 'MANHÃ';
    return 'TARDE'; // Fallback
  }

  getTodayTeamCollaborators(): any[] {
    const logged = this.getLoggedCollab();
    if (!logged) return [];
    
    const day = this.selectedCalendarDay();
    const myShiftCode = this.getCollabEffectiveShiftForDay(logged, day);
    const filter = this.coworkersFilter();
    
    const filtered = this.scaleService.collaborators().filter(c => {
      // Must be scheduled to work on that day
      if (!this.isWorkDay(c, day)) return false;
      
      const cBaseShift = (c.shift || '').trim().toUpperCase();
      const loggedBaseShift = (logged.shift || '').trim().toUpperCase();

      if (filter === 'MEU_TURNO') {
        return cBaseShift === loggedBaseShift || (loggedBaseShift === 'MANHÃ' && cBaseShift === 'MANHA') || (loggedBaseShift === 'MANHA' && cBaseShift === 'MANHÃ');
      } else if (filter === 'TURNO_ANTERIOR') {
        const prevShift = this.getPreviousShiftLabel().toUpperCase();
        return cBaseShift === prevShift || (prevShift === 'MANHÃ' && cBaseShift === 'MANHA') || (prevShift === 'MANHA' && cBaseShift === 'MANHÃ');
      } else if (filter === 'TURNO_POSTERIOR') {
        const postShift = this.getPosteriorShiftLabel().toUpperCase();
        return cBaseShift === postShift || (postShift === 'MANHÃ' && cBaseShift === 'MANHA') || (postShift === 'MANHA' && cBaseShift === 'MANHÃ');
      }

      // 'TODOS'
      return true;
    });

    return this.sortCollaboratorsWithLoggedFirst(filtered);
  }

  getCollaboratorsOnVacationForDay(day: number): any[] {
    const logged = this.getLoggedCollab();
    if (!logged) return [];
    
    const filter = this.coworkersFilter();
    
    const filtered = this.scaleService.collaborators().filter(c => {
      // Must not be scheduled to work on that day
      if (this.isWorkDay(c, day)) return false;

      const cBaseShift = (c.shift || '').trim().toUpperCase();
      const loggedBaseShift = (logged.shift || '').trim().toUpperCase();

      if (filter === 'MEU_TURNO') {
        return cBaseShift === loggedBaseShift || (loggedBaseShift === 'MANHÃ' && cBaseShift === 'MANHA') || (loggedBaseShift === 'MANHA' && cBaseShift === 'MANHÃ');
      } else if (filter === 'TURNO_ANTERIOR') {
        const prevShift = this.getPreviousShiftLabel().toUpperCase();
        return cBaseShift === prevShift || (prevShift === 'MANHÃ' && cBaseShift === 'MANHA') || (prevShift === 'MANHA' && cBaseShift === 'MANHÃ');
      } else if (filter === 'TURNO_POSTERIOR') {
        const postShift = this.getPosteriorShiftLabel().toUpperCase();
        return cBaseShift === postShift || (postShift === 'MANHÃ' && cBaseShift === 'MANHA') || (postShift === 'MANHA' && cBaseShift === 'MANHÃ');
      }

      // 'TODOS'
      return true;
    });
    return this.sortCollaboratorsWithLoggedFirst(filtered);
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
      return this.sortCollaboratorsWithLoggedFirst(allScheduled);
    }

    const myShiftCode = this.getCollabEffectiveShiftForDay(collab, day);
    if (tab === 'seu_turno') {
      const filtered = allScheduled.filter(c => this.getCollabEffectiveShiftForDay(c, day) === myShiftCode);
      return this.sortCollaboratorsWithLoggedFirst(filtered);
    }

    if (tab === 'turno_posterior') {
      const nextShiftCode = this.getNextShiftCode(myShiftCode);
      if (!nextShiftCode) return [];
      const filtered = allScheduled.filter(c => this.getCollabEffectiveShiftForDay(c, day) === nextShiftCode);
      return this.sortCollaboratorsWithLoggedFirst(filtered);
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
   * Retorna as classes CSS do Tailwind de forma dinâmica para renderizar os cards do calendário (estático/apenas representativo).
   */
  getCollaboratorCalendarDayStaticClass(collab: any, day: number, count: number): string {
    const base = 'p-1.5 sm:p-3 border rounded-lg sm:rounded-xl flex flex-col justify-between gap-1 sm:gap-1.5 min-h-[54px] sm:min-h-[96px] w-full text-left shadow-sm duration-200 select-none relative overflow-hidden cursor-default';
    
    if (!collab) {
      return `${base} bg-slate-900/30 border-slate-800 text-slate-500`;
    }

    if (this.isToday(day)) {
      if (this.isLightTheme()) {
        return `${base} bg-emerald-100/95 border-emerald-600 border-2 text-emerald-950 shadow-[0_4px_16px_rgba(16,185,129,0.3)] z-10`;
      } else {
        return `${base} bg-[#032e18] border-emerald-400 border-2 text-emerald-100 shadow-[0_0_25px_rgba(16,185,129,0.55),_inset_0_0_10px_rgba(16,185,129,0.3)] z-10`;
      }
    }

    const cellValRaw = collab.scale && collab.scale[day] !== undefined ? collab.scale[day] : '-';
    const cellVal = (cellValRaw === '-') ? (collab.shift || '-') : cellValRaw;
    const upperCode = cellVal.toUpperCase().trim();

    const isFolga = ['F', 'FF', 'FE', 'FM', 'FT', 'FN', 'X'].includes(upperCode);
    const isAbsence = ['LM', 'LMT', 'LA'].includes(upperCode);

    if (isFolga) {
      if (this.isLightTheme()) {
        return `${base} bg-emerald-50/80 border-emerald-400 text-emerald-800 shadow-emerald-100/50`;
      } else {
        return `${base} bg-gradient-to-br from-emerald-950/20 to-[#030a14] border-emerald-500/50 text-emerald-200 shadow-emerald-950/10`;
      }
    } else if (isAbsence) {
      if (this.isLightTheme()) {
        return `${base} bg-rose-50 border-rose-300 text-rose-800`;
      } else {
        return `${base} bg-gradient-to-br from-red-950/20 to-[#030a14] border-rose-500/40 text-rose-200`;
      }
    } else {
      if (this.isLightTheme()) {
        return `${base} bg-white border-slate-200 text-slate-700`;
      } else {
        return `${base} bg-[#041021]/80 border-[#10213b] text-slate-300`;
      }
    }
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
    if (id) {
      const found = this.scaleService.collaborators().find(c => c.id === id);
      if (found) return found;
    }

    // Fallback auto-login in development/preview environments to NEVER request login/password
    const isDevelopment = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname.includes('127.0.0.1') ||
      window.location.hostname.includes('ais-dev') ||
      window.location.hostname.includes('aistudio') ||
      window.location.hostname.includes('googleusercontent') ||
      window.location.hostname.includes('cloudshell') ||
      window.location.hostname.includes('web-preview') ||
      window.location.hostname.includes('run.app') || // Always treat run.app preview environments as dev for convenience
      (window.self !== window.top) // If inside an iframe (AI Studio preview iframe)
    );

    if (isDevelopment) {
      const collabs = this.scaleService.collaborators();
      if (collabs.length > 0) {
        const devCollab = collabs.find(c => this.isAdmin(c)) || collabs[0];
        if (devCollab) {
          setTimeout(() => {
            if (!this.selectedSimulatedCollabId()) {
              this.selectedSimulatedCollabId.set(devCollab.id);
              this.scaleService.selectedCollabName.set(devCollab.name);
              this.scaleService.currentRole.set(devCollab.role);
            }
          }, 0);
          return devCollab;
        }
      }
    }

    return null;
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
    let currentShift = (currentShiftRaw === '-') ? this.getShiftCode(current.shift) : currentShiftRaw;
    if (this.isSiglaAbsence(currentShift)) {
      currentShift = this.getShiftCode(current.shift);
    }

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
                 const tempXs: number[] = [];
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
      for (const codeStr of codes) {
        const code = codeStr.toUpperCase().trim();
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
    sd5Desc?: string, sd5Date?: string,
    isAdmin?: boolean,
    nickname?: string,
    gafesStr?: string
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

    const parsedGafes = gafesStr ? gafesStr.split('\n').map(g => g.trim()).filter(g => g.length > 0) : [];

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
      scale: updatedScale,
      isAdmin: isAdmin !== undefined ? isAdmin : target.isAdmin,
      nickname: nickname !== undefined ? nickname : target.nickname,
      gafes: gafesStr !== undefined ? parsedGafes : target.gafes
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

  public toggleCollabAdmin(collab: Collaborator, isAdmin: boolean) {
    const updatedCollab: Collaborator = {
      ...collab,
      isAdmin
    };
    this.scaleService.updateCollaborator(updatedCollab);
    this.showToast(`Nível de acesso de "${collab.name}" alterado para ${isAdmin ? 'Administrador' : 'Usuário'}.`);
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

  onPortalPhotoSelected(event: Event) {
    this.onProfilePhotoSelectedForCrop(event);
  }

  getAbbreviatedName(name: string): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    const first = parts[0];
    const last = parts[parts.length - 1];
    return `${first} ${last[0]}.`;
  }

  getFolgaCountdownState(collab: Collaborator | null | undefined) {
    this.currentTimeString(); // Register reactivity dependency for signals!
    if (!collab) return { showCountdown: false, countdownText: '', isReady: false };

    // Only run if we are looking at the current month and year
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    if (this.selectedMonthIndex() !== currentMonth || this.currentYear() !== currentYear) {
      return { showCountdown: false, countdownText: '', isReady: false };
    }

    const dayToAnalyze = today.getDate();
    const isTodayWork = this.isWorkDay(collab, dayToAnalyze);
    const isTomorrowWork = dayToAnalyze < 31 ? this.isWorkDay(collab, dayToAnalyze + 1) : false;

    // Shift times
    let entryTime = '08:00';
    let exitTime = '17:00';
    
    const hours = collab.hours || '';
    if (hours.includes('-')) {
      const parts = hours.split('-');
      if (parts.length === 2) {
        entryTime = parts[0].trim();
        exitTime = parts[1].trim();
      }
    } else {
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
    }

    const [entryHour, entryMin] = entryTime.split(':').map(Number);
    const [exitHour, exitMin] = exitTime.split(':').map(Number);

    const isOvernight = exitHour < entryHour;

    const shiftStart = new Date(today);
    let shiftEnd = new Date(today);

    if (isOvernight) {
      if (today.getHours() >= entryHour) {
        shiftStart.setHours(entryHour, entryMin, 0, 0);
        shiftEnd = new Date(today);
        shiftEnd.setDate(today.getDate() + 1);
        shiftEnd.setHours(exitHour, exitMin, 0, 0);
      } else if (today.getHours() < exitHour) {
        shiftStart.setDate(today.getDate() - 1);
        shiftStart.setHours(entryHour, entryMin, 0, 0);
        shiftEnd.setHours(exitHour, exitMin, 0, 0);
      } else {
        shiftStart.setHours(entryHour, entryMin, 0, 0);
        shiftEnd = new Date(today);
        shiftEnd.setDate(today.getDate() + 1);
        shiftEnd.setHours(exitHour, exitMin, 0, 0);
      }
    } else {
      shiftStart.setHours(entryHour, entryMin, 0, 0);
      shiftEnd.setHours(exitHour, exitMin, 0, 0);
    }

    let onFolga = false;
    let countdownText = '';
    let showCountdown = false;

    if (!isTodayWork) {
      if (isOvernight && today.getHours() < exitHour) {
        showCountdown = true;
        const diffMs = shiftEnd.getTime() - today.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        countdownText = `${String(diffHrs).padStart(2, '0')}h ${String(diffMins).padStart(2, '0')}m`;
      } else {
        onFolga = true;
      }
    } else {
      if (!isTomorrowWork) {
        if (today.getTime() < shiftEnd.getTime()) {
          showCountdown = true;
          const diffMs = shiftEnd.getTime() - today.getTime();
          const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
          const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          countdownText = `${String(diffHrs).padStart(2, '0')}h ${String(diffMins).padStart(2, '0')}m`;
        } else {
          onFolga = true;
        }
      }
    }

    return {
      showCountdown,
      countdownText,
      isReady: onFolga
    };
  }

  getReturnDay(collab: any): string {
    if (!collab) return '';
    const today = new Date();
    const dayToAnalyze = today.getDate();
    const maxDay = this.daysInMonth().length;
    
    // Find the end of the consecutive off days starting from today
    let endDay = dayToAnalyze;
    while (endDay < maxDay && !this.isWorkDay(collab, endDay + 1)) {
      endDay++;
    }
    
    const returnDay = endDay + 1;
    if (returnDay <= maxDay) {
      return `Dia ${returnDay}`;
    } else {
      return `Dia 1`;
    }
  }

  getReturnDayNumber(collab: any): number {
    if (!collab) return 1;
    const today = new Date();
    const dayToAnalyze = today.getDate();
    const maxDay = this.daysInMonth().length;
    
    let endDay = dayToAnalyze;
    while (endDay < maxDay && !this.isWorkDay(collab, endDay + 1)) {
      endDay++;
    }
    
    const returnDay = endDay + 1;
    return returnDay <= maxDay ? returnDay : 1;
  }

  autoSelectTodayTabForLoggedCollab(logged: Collaborator | null | undefined) {
    if (!logged) return;
    const today = new Date();
    const currentDayNum = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    if (this.selectedMonthIndex() === currentMonth && this.currentYear() === currentYear) {
      const isWork = this.isWorkDay(logged, currentDayNum);
      if (isWork) {
        this.turnVacationTab.set('work');
      } else {
        this.turnVacationTab.set('vacation');
      }
      this.selectedCalendarDay.set(currentDayNum);
    }
  }
}
