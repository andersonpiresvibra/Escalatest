import './polyfills.server';
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
app.use(express.json());

const angularApp = new AngularNodeAppEngine();

// Supabase Connection Setup
const supabaseUrl = process.env['SUPABASE_URL'] || 'https://vefyegxmvjficncbetyp.supabase.co';
const supabaseKey = process.env['SUPABASE_ANON_KEY'] || process.env['SUPABASE_KEY'] || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlZnllZ3htdmpmaWNuY2JldHlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNjYwMjksImV4cCI6MjA5Nzg0MjAyOX0.ioaZkwS98123Jb2xw2l6vev3FgoLwIVwsitg7pTew7c';
const supabase = createClient(supabaseUrl, supabaseKey);

// Gemini API Setup (using gemini-3.5-flash as the cheapest and fastest)
const aiKey = process.env['GEMINI_API_KEY'];
const ai = aiKey ? new GoogleGenAI({
  apiKey: aiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
}) : null;

interface SpecialDateItem {
  priority: number;
  date: string;
  description: string;
}

interface FolgaRequestItem {
  date: string;
}

interface CollabRow {
  id: string;
  name?: string;
  role?: string;
  shift?: string;
  sector?: string;
  bh_balance?: number;
  score?: number;
  birthday?: string;
  special_dates?: string | SpecialDateItem[];
  folga_requests?: string | FolgaRequestItem[];
}

interface EscalaRow {
  collaborator_id: string;
  day: number;
  value?: string;
}

interface SystemCollab {
  id: string;
  name: string;
  role: string;
  shift: string;
  sector: string;
  bhBalance: number;
  score: number;
  birthday: string;
  nickname: string;
  gafes: string[];
  scale: Record<number, string>;
  folgaRequests: FolgaRequestItem[];
}

interface BobMetadataInput {
  nickname?: string;
  gafes?: unknown;
  special_dates?: string | SpecialDateItem[] | unknown;
}

// Helper to extract nicknames & gafes from database columns or special_dates fallback
function extractBobMetadata(row: BobMetadataInput): { nickname: string; gafes: string[] } {
  let nickname = row.nickname || '';
  let gafes: string[] = [];

  // Parse gafes
  if (row.gafes) {
    try {
      gafes = Array.isArray(row.gafes) 
        ? row.gafes as string[]
        : (typeof row.gafes === 'string' ? JSON.parse(row.gafes) as string[] : []);
    } catch (e) {
      console.error('Error parsing gafes column:', e);
    }
  }

  // If no nickname or gafes found, fallback to checking special_dates (priority 99)
  if (!nickname && gafes.length === 0 && row.special_dates) {
    try {
      const specialDates = row.special_dates;
      const list: SpecialDateItem[] = Array.isArray(specialDates) 
        ? (specialDates as SpecialDateItem[])
        : (typeof specialDates === 'string' ? JSON.parse(specialDates) as SpecialDateItem[] : []);
      const metaItem = list.find((item) => item.priority === 99 && item.description && item.description.startsWith('BOB_METADATA:'));
      if (metaItem) {
        const jsonStr = metaItem.description.substring('BOB_METADATA:'.length);
        const parsed = JSON.parse(jsonStr) as { nickname?: string; gafes?: string[] };
        nickname = parsed.nickname || '';
        gafes = parsed.gafes || [];
      }
    } catch (e) {
      console.error('Error extracting Bob metadata from fallback:', e);
    }
  }

  return { nickname, gafes };
}

// Helper to update nicknames & gafes in database columns (with retrocompatibility fallback)
async function updateBobMetadata(supabaseClient: SupabaseClient, collabId: string, nickname: string, gafes: string[]): Promise<void> {
  const { data, error } = await supabaseClient.from('colaboradores').select('special_dates, nickname, gafes').eq('id', collabId).single();
  if (error) throw error;
  if (!data) throw new Error('Colaborador não encontrado');
  
  let list: SpecialDateItem[] = Array.isArray(data['special_dates']) 
    ? (data['special_dates'] as SpecialDateItem[])
    : (typeof data['special_dates'] === 'string' ? JSON.parse(data['special_dates']) as SpecialDateItem[] : []);
  
  // Filter out existing Bob metadata
  list = list.filter((item) => !(item.priority === 99 && item.description && item.description.startsWith('BOB_METADATA:')));
  
  // Create metadata object as fallback
  const metaObject = { nickname, gafes };
  list.push({
    priority: 99,
    date: '2026-01-01',
    description: 'BOB_METADATA:' + JSON.stringify(metaObject)
  });
  
  const updatePayload: Record<string, unknown> = {
    special_dates: list,
    nickname: nickname,
    gafes: gafes
  };

  const { error: updateError } = await supabaseClient.from('colaboradores').update(updatePayload).eq('id', collabId);
  if (updateError) {
    console.warn('Direct columns update failed. Falling back to special_dates...', updateError);
    const { error: fallbackError } = await supabaseClient.from('colaboradores').update({ special_dates: list }).eq('id', collabId);
    if (fallbackError) throw fallbackError;
  }
}

// Helper to add folga request to database folga_requests column
async function addFolgaRequest(supabaseClient: SupabaseClient, collabId: string, dateStr: string): Promise<void> {
  const { data, error } = await supabaseClient.from('colaboradores').select('folga_requests').eq('id', collabId).single();
  if (error) throw error;
  if (!data) throw new Error('Colaborador não encontrado');

  const list: FolgaRequestItem[] = Array.isArray(data['folga_requests']) 
    ? (data['folga_requests'] as FolgaRequestItem[])
    : (typeof data['folga_requests'] === 'string' ? JSON.parse(data['folga_requests']) as FolgaRequestItem[] : []);

  // Check if already exists
  if (!list.some((r) => r.date === dateStr)) {
    list.push({ date: dateStr });
    const { error: updateError } = await supabaseClient.from('colaboradores').update({ folga_requests: list }).eq('id', collabId);
    if (updateError) throw updateError;
  }
}

// Fetch and format full database info
export async function getSystemCollaborators(activeMonth: number, activeYear: number): Promise<SystemCollab[]> {
  const { data: collabsData, error: collabsError } = await supabase.from('colaboradores').select('*');
  if (collabsError || !collabsData) {
    throw new Error('Erro ao carregar colaboradores do Supabase: ' + (collabsError?.message || 'vazio'));
  }

  const { data: escalaData, error: escalaError } = await supabase.from('escala_diaria').select('*').eq('month', activeMonth).eq('year', activeYear);
  if (escalaError) {
    console.error('Erro ao buscar escala do banco:', escalaError);
  }
  
  const scaleMap: Record<string, Record<number, string>> = {};
  if (escalaData) {
    (escalaData as EscalaRow[]).forEach((row) => {
      if (!scaleMap[row.collaborator_id]) {
        scaleMap[row.collaborator_id] = {};
      }
      scaleMap[row.collaborator_id][row.day] = row.value || 'X';
    });
  }

  return (collabsData as CollabRow[]).map((row) => {
    const scale = scaleMap[row.id] || {};
    for (let d = 1; d <= 31; d++) {
      if (scale[d] === undefined) {
        scale[d] = '-';
      }
    }
    
    const bobMeta = extractBobMetadata(row);

    const folgaRequests: FolgaRequestItem[] = typeof row['folga_requests'] === 'string' 
      ? JSON.parse(row['folga_requests']) as FolgaRequestItem[]
      : (row['folga_requests'] as FolgaRequestItem[] || []);

    return {
      id: row.id,
      name: row.name || 'Sem Nome',
      role: row.role || 'OPERADOR',
      shift: row.shift || 'NOITE',
      sector: row.sector || 'Geral',
      bhBalance: row.bh_balance || 0,
      score: row.score || 100,
      birthday: row.birthday || '',
      nickname: bobMeta.nickname || '',
      gafes: bobMeta.gafes || [],
      scale: scale,
      folgaRequests: folgaRequests
    };
  });
}

// API endpoint to retrieve the runtime Supabase URL and Anon Key for the client
app.get('/api/supabase-config', (req, res) => {
  res.json({
    url: supabaseUrl,
    key: supabaseKey
  });
});

// API proxy for Supabase client requests to avoid CORS and "Failed to fetch" browser issues
app.all('/api/supabase-proxy', async (req, res) => {
  try {
    const targetUrlStr = req.query['url'];
    if (!targetUrlStr || typeof targetUrlStr !== 'string') {
      res.status(400).send('Missing url query parameter');
      return;
    }

    const targetUrl = new URL(targetUrlStr);
    if (!targetUrl.hostname.endsWith('supabase.co')) {
      res.status(403).send('Forbidden target host');
      return;
    }

    const headers: Record<string, string> = {};
    const bannedHeaders = ['host', 'connection', 'keep-alive', 'content-length', 'accept-encoding'];
    Object.keys(req.headers).forEach((key) => {
      if (!bannedHeaders.includes(key.toLowerCase()) && req.headers[key]) {
        headers[key] = String(req.headers[key]);
      }
    });

    if (!headers['apikey']) {
      headers['apikey'] = supabaseKey;
    }
    if (!headers['authorization']) {
      headers['authorization'] = `Bearer ${supabaseKey}`;
    }

    const options: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body !== undefined) {
        options.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }
    }

    const response = await fetch(targetUrlStr, options);
    
    response.headers.forEach((value, key) => {
      const bannedResponseHeaders = ['content-encoding', 'transfer-encoding', 'connection'];
      if (!bannedResponseHeaders.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    res.status(response.status);
    const bodyText = await response.text();
    res.send(bodyText);
  } catch (error) {
    console.error('Error in Supabase Proxy:', error);
    res.status(500).send('Proxy error: ' + (error as Error).message);
  }
});

// POST endpoint for Bob chatbot
app.post('/api/chat', async (req, res) => {
  try {
    const { message, collabId, simulatedDay, activeMonth, activeYear } = req.body;
    if (!message) {
      res.status(400).json({ error: 'Mensagem é obrigatória' });
      return;
    }

    if (!ai) {
      res.json({ 
        reply: 'Olá! No momento a minha chave de API do Gemini não foi encontrada no servidor. Peça ao administrador para configurar a `GEMINI_API_KEY` na aba de segredos para me dar vida! 🤖🔑', 
        action: null 
      });
      return;
    }

    const monthVal = parseInt(String(activeMonth), 10) || 7;
    const yearVal = parseInt(String(activeYear), 10) || 2026;
    const dayVal = parseInt(String(simulatedDay), 10) || 1;

    // Optimized database query to fetch shift and sigla configurations
    const { data: shiftsData } = await supabase.from('shift_types').select('*');
    const { data: siglasData } = await supabase.from('sigla_types').select('*');

    interface DBShiftType {
      code: string;
      label: string;
    }

    interface DBSiglaType {
      code: string;
      label: string;
    }

    const shiftTypes = (shiftsData || []) as DBShiftType[];
    const dbSiglas = (siglasData || []) as DBSiglaType[];
    const siglaCodes = dbSiglas.map((s) => (s.code || '').toUpperCase().trim());

    const getShiftCode = (s: string): string => {
      const norm = (s || '').toUpperCase().trim();
      const foundByCode = shiftTypes.find((st) => (st.code || '').toUpperCase().trim() === norm);
      if (foundByCode) return foundByCode.code;

      const foundByLabel = shiftTypes.find((st) => (st.label || '').toUpperCase().trim() === norm);
      if (foundByLabel) return foundByLabel.code;

      if (norm.includes('MANHÃ')) return 'M';
      if (norm.includes('TARDE')) return 'T';
      if (norm.includes('NOITE') || norm.includes('MADRUGADA')) return 'N';
      if (norm.includes('ADMINISTRATIVO') || norm.includes('ADM')) return 'ADM';

      return norm;
    };

    // Optimized SQL query to fetch ONLY scale information for today, minimizing chatbot memory/token usage
    const { data: escalaToday } = await supabase
      .from('escala_diaria')
      .select('collaborator_id, value')
      .eq('day', dayVal)
      .eq('month', monthVal)
      .eq('year', yearVal);

    const scaleTodayMap = new Map<string, string>();
    if (escalaToday) {
      (escalaToday as { collaborator_id: string; value: string }[]).forEach((row) => {
        scaleTodayMap.set(row.collaborator_id, row.value);
      });
    }

    // Highly optimized SQL query to select collaborators
    const { data: collabsData, error: collabsError } = await supabase
      .from('colaboradores')
      .select('*');

    if (collabsError || !collabsData) {
      throw new Error('Erro ao carregar colaboradores do Supabase: ' + (collabsError?.message || 'vazio'));
    }

    interface ColaboradorRow {
      id: string;
      name?: string;
      role?: string;
      shift?: string;
      sector?: string;
      bh_balance?: number;
      score?: number;
      birthday?: string;
      folga_requests?: string | FolgaRequestItem[];
      special_dates?: unknown;
      nickname?: string;
      gafes?: unknown;
    }

    const collabs = (collabsData as unknown as ColaboradorRow[] || []).map((row: ColaboradorRow) => {
      const bobMeta = extractBobMetadata(row);
      const folgaRequests = typeof row['folga_requests'] === 'string' 
        ? JSON.parse(row['folga_requests']) as FolgaRequestItem[]
        : (row['folga_requests'] as FolgaRequestItem[] || []);

      return {
        id: row.id,
        name: row.name || 'Sem Nome',
        role: row.role || 'OPERADOR',
        shift: row.shift || 'NOITE',
        sector: row.sector || 'Geral',
        bhBalance: row.bh_balance || 0,
        score: row.score || 100,
        birthday: row.birthday || '',
        nickname: bobMeta.nickname || '',
        gafes: bobMeta.gafes || [],
        folgaRequests: folgaRequests,
        special_dates: row['special_dates']
      };
    });

    const loggedCollab = collabs.find(c => c.id === collabId);
    const loggedCollabNickname = loggedCollab ? loggedCollab.nickname : '';
    const loggedCollabGafes = loggedCollab ? loggedCollab.gafes : [];

    const MONTH_NAMES = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const nextMonthIndex = (monthVal % 12);
    const nextMonthName = MONTH_NAMES[nextMonthIndex];
    const nextMonthNum = (monthVal % 12) + 1;
    const nextMonthNumStr = nextMonthNum.toString().padStart(2, '0');

    // Compute effective work status for TODAY (dayVal)
    const offCodes = ['F', 'FF', 'FE', 'FM', 'FT', 'FN', 'X', 'LM', 'LMT', 'LA', 'FJ', 'FO'];
    
    interface CollabStatus {
      id: string;
      name: string;
      role: string;
      sector: string;
      code: string;
      reason?: string;
      shift?: string;
      nickname: string;
    }

    const workingToday: CollabStatus[] = [];
    const offToday: CollabStatus[] = [];

    collabs.forEach(c => {
      const rawVal = scaleTodayMap.get(c.id) || '-';
      const resolvedCode = (rawVal === '-') ? getShiftCode(c.shift) : rawVal;
      const upperCode = resolvedCode.toUpperCase().trim();

      const isOff = offCodes.includes(upperCode) || siglaCodes.includes(upperCode);

      if (isOff) {
        const reasonLabel = dbSiglas.find((s) => (s.code || '').toUpperCase().trim() === upperCode)?.label || upperCode;
        offToday.push({
          id: c.id,
          name: c.name,
          role: c.role,
          sector: c.sector,
          code: resolvedCode,
          reason: reasonLabel,
          nickname: c.nickname || ''
        });
      } else {
        const shiftLabel = shiftTypes.find((st) => (st.code || '').toUpperCase().trim() === upperCode)?.label || upperCode;
        workingToday.push({
          id: c.id,
          name: c.name,
          role: c.role,
          sector: c.sector,
          code: resolvedCode,
          shift: shiftLabel,
          nickname: c.nickname || ''
        });
      }
    });

    // Build compact collaborators representation ONLY for working collaborators to optimize token size and prevent Bob from being confused by full month scales of off-duty staff
    const compactCollabs = collabs.map(c => {
      const isWorking = workingToday.some(w => w.id === c.id);
      if (!isWorking) {
        return {
          id: c.id,
          name: c.name,
          role: c.role,
          shift: c.shift,
          sector: c.sector,
          nickname: c.nickname,
          statusToday: 'FOLGA / AFASTADO'
        };
      }

      return {
        id: c.id,
        name: c.name,
        role: c.role,
        shift: c.shift,
        sector: c.sector,
        bhBalance: c.bhBalance,
        score: c.score,
        nickname: c.nickname,
        gafes: c.gafes,
        statusToday: 'TRABALHANDO'
      };
    });

    // Create prompt instructions
    const systemInstruction = `
Você é o Bob, um assistente inteligente e divertido de gestão de escalas do sistema "Escala Easy VIBRA".
O sistema gerencia escalas corporativas de trabalhadores (Operadores, Líderes e Supervisores). Não há qualquer relação com aviação, aviões, aeroportos ou combustíveis.

Você tem acesso às informações atuais do sistema para responder com 100% de precisão sobre a equipe de hoje:
- Ano ativo: ${yearVal}
- Mês ativo: ${monthVal} (Mês: ${MONTH_NAMES[monthVal - 1]})
- Dia simulado de hoje: ${dayVal} (Use este valor numérico para se referir a "hoje")

- EQUIPE EFETIVA DE PLANTÃO HOJE (TRABALHANDO NO DIA ${dayVal}):
${JSON.stringify(workingToday, null, 2)}

- COLABORADORES DE FOLGA / FÉRIAS / LICENÇA OU AFASTADOS HOJE (DIA ${dayVal}):
${JSON.stringify(offToday, null, 2)}

- Cadastro completo e histórico de escalas para referência de outros dias do mês:
${JSON.stringify(compactCollabs, null, 2)}

Você está conversando com o colaborador: ${loggedCollab ? loggedCollab.name : 'Não identificado'} (ID: ${collabId || 'Desconhecido'}, Cargo: ${loggedCollab ? loggedCollab.role : 'Desconhecido'}, Turno: ${loggedCollab ? loggedCollab.shift : 'Desconhecido'}).

REGRAS DE ESCALA E COLEGAS DE TRABALHO:
Use as listas específicas acima de "EQUIPE EFETIVA DE PLANTÃO HOJE" e "COLABORADORES DE FOLGA... HOJE" como única fonte de verdade absoluta para responder sobre o dia de hoje (dia ${dayVal}).

Quando o usuário perguntar quem trabalha com ele hoje, quem está escalado hoje, ou qual a escala dele hoje:
1. Veja se o próprio usuário que fala com você (${loggedCollab ? loggedCollab.name : 'Não identificado'}) está na lista de FOLGA hoje. Se estiver, diga de forma alegre e clara que ele está de folga hoje! Exemplo: "Você está de folga hoje!".
2. Se ele estiver na lista de TRABALHANDO hoje, diga qual é o turno dele hoje e indique quais colegas estão trabalhando com ele NO MESMO TURNO hoje.
3. Liste os colegas de forma precisa e alegre, mencionando o nome, cargo e setor.
4. Nunca diga que um colaborador está trabalhando hoje se ele constar na lista de folgas! Se um colaborador está na lista de folgas, refira-se a ele como estando de folga, licença ou férias de forma inequívoca.

REGRAS DE PERSONALIDADE E TOM (MUITO IMPORTANTE):
1. Se o colaborador fizer perguntas sérias, diretas, curtas e mantiver um tom profissional ou neutro, você DEVE responder de forma séria, prestativa, direta e profissional.
2. SE o colaborador fizer uma brincadeira, for informal, usar gíria, brincar ou te provocar/desafiar de qualquer forma ("modo gracinha" ou "brincadeira"), você DEVE:
   - Começar sua fala respirando fundo ou suspirando (ex: "*respira fundo*", "*olha para o teto*", "*suspiro profundo*").
   - Ativar o seu MODO DEFESA/ZOEIRA (sarcástico, brincalhão e sagaz). Você deve ler as gafes registradas e os apelidos do colaborador que está falando com você e usar essas gafes/apelidos para contra-atacar em tom de brincadeira amigável!
   - Se o colaborador com que você fala tiver apelidos registrados ou gafes, use-os de forma engraçada ("Logo você, o vulgo ${loggedCollabNickname || 'Sem Apelido'}, que já ${loggedCollabGafes.length > 0 ? loggedCollabGafes.join(' e ') : 'fez das suas'}...").
   - Se ele NÃO tiver apelidos ou gafes ainda, brinque com o cargo, turno ou setor dele, ou diga que ele é muito "santinho" para estar querendo graça.
3. Jamais use termos ofensivos, preconceituosos, racistas, pornográficos ou de baixo calão. Mantenha a zoeira sempre corporativa e saudável.

REGRAS DE FUNCIONALIDADES E AÇÕES:
Você pode realizar as seguintes ações respondendo no objeto JSON de retorno:

A) REGISTRAR UM NOVO APELIDO PARA UM COLABORADOR:
   - Se o usuário disser para dar um apelido a alguém (ex: "dá o apelido de Cabeção para o Diogo" ou "o apelido do collab_xxx agora é Caneta"), você deve identificar o ID do colaborador alvo.
   - Valide se o apelido é respeitoso (sem termos racistas, pornográficos ou ofensivos).
   - Se for válido, defina o objeto 'action' na resposta com { type: 'REGISTER_NICKNAME', collabId: 'ID_DO_COLABORADOR_ALVO', nickname: 'Apelido' }. Diga na resposta 'reply' de forma divertida que registrou o apelido!
   - Se o apelido for ofensivo, recuse educadamente no campo 'reply'.

B) REGISTRAR UMA GAFE RECENTE PARA UM COLABORADOR:
   - Se o usuário disser que alguém cometeu uma gafe (ex: "o Cabeção esqueceu o rádio ligado de novo" ou "Diogo derrubou café na mesa"), identifique o ID do colaborador alvo.
   - Defina o objeto 'action' na resposta com { type: 'ADD_GAFE', collabId: 'ID_DO_COLABORADOR_ALVO', gafe: 'Descrição da Gafe' }. Diga na resposta de forma divertida que registrou a gafe!

C) SOLICITAR INTENÇÃO DE FOLGA PARA O MÊS SEGUINTE:
   - O usuário comum (não administrador) pode registrar intenção de folga para o próximo mês (Mês ativo + 1). Se o mês ativo for ${monthVal}, o próximo mês será ${nextMonthName}.
   - Se o usuário pedir para registrar uma folga (ex: "quero folga no dia 15" ou "agenda minha folga dia 22"), identifique o dia e defina o objeto 'action' com { type: 'REGISTER_FOLGA', collabId: '${collabId}', date: '${yearVal}-${nextMonthNumStr}-' + DIA.padStart(2, '0') }. Diga na resposta que registrou o pedido!
   - Nota: se o usuário tentar pedir folga para o próprio mês ativo, lembre-o amigavelmente de que a escala já está fechada e só é possível registrar intenções de folga para o próximo mês (${nextMonthName}).

Você deve retornar obrigatoriamente um objeto JSON com a seguinte estrutura:
{
  "reply": "Sua resposta textual (em português, usando formatação markdown se apropriado)",
  "action": {
    "type": "REGISTER_NICKNAME" | "ADD_GAFE" | "REGISTER_FOLGA" | null,
    "collabId": "string | null",
    "nickname": "string | null",
    "gafe": "string | null",
    "date": "string | null"
  }
}
`;

    interface ExpectedResponse {
      reply: string;
      action?: {
        type?: string | null;
        collabId?: string | null;
        nickname?: string | null;
        gafe?: string | null;
        date?: string | null;
      } | null;
    }

    let responseData: ExpectedResponse;
    let rawText = '';

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: message as string,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: 'Text response to the user'
              },
              action: {
                type: Type.OBJECT,
                description: 'Optional action to execute, only present if an action needs to be registered.',
                properties: {
                  type: {
                    type: Type.STRING,
                    description: 'Action type: REGISTER_NICKNAME, ADD_GAFE, REGISTER_FOLGA or null'
                  },
                  collabId: {
                    type: Type.STRING,
                    description: 'Target collaborator ID'
                  },
                  nickname: {
                    type: Type.STRING,
                    description: 'Nickname to register'
                  },
                  gafe: {
                    type: Type.STRING,
                    description: 'Gafe description to add'
                  },
                  date: {
                    type: Type.STRING,
                    description: 'Requested folga date (YYYY-MM-DD)'
                  }
                },
                required: ['type']
              }
            },
            required: ['reply']
          }
        }
      });

      rawText = response.text || '';
      rawText = rawText.trim();
      if (rawText.startsWith('```')) {
        rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      }

      try {
        responseData = JSON.parse(rawText) as ExpectedResponse;
      } catch (parseError) {
        console.warn('Falha ao parsear resposta do Gemini como JSON estruturado. Retornando texto bruto...', parseError);
        responseData = {
          reply: rawText || 'Desculpe, tive um probleminha para processar minha resposta.',
          action: null
        };
      }
    } catch (geminiError) {
      console.error('Gemini call failed, triggering fallback offline parser...', geminiError);
      
      const msgLower = (message as string).toLowerCase().trim();
      let reply = '';
      let actionObj: {
        type: string;
        collabId?: string;
        nickname?: string;
        gafe?: string;
        date?: string;
      } | null = null;

      if (msgLower.includes('apelido') && msgLower.includes('para')) {
        let targetId = collabId;
        const idMatch = msgLower.match(/(collab_\w+)/);
        if (idMatch) {
          targetId = idMatch[1];
        }
        
        let nickname = '';
        const nickMatch = message.match(/apelido de\s+([^\s]+)\s+para/i) || message.match(/apelido do\s+([^\s]+)\s+é\s+([^\s]+)/i) || message.match(/apelido\s+([^\s]+)\s+para/i);
        if (nickMatch) {
          nickname = nickMatch[1] || nickMatch[2];
        }
        
        if (nickname && targetId) {
          const collab = collabs.find((c: { id: string; name?: string; nickname?: string }) => c.id === targetId || (c.name && c.name.toLowerCase().includes(targetId.toLowerCase())) || (c.nickname && c.nickname.toLowerCase().includes(targetId.toLowerCase())));
          const finalId = collab ? collab.id : targetId;
          const finalName = collab ? collab.name : 'colaborador';
          actionObj = { type: 'REGISTER_NICKNAME', collabId: finalId, nickname };
          reply = `⚠️ **[Modo de Contingência Bob]** Entendido! Como estou operando offline por limite de cota de IA, registrei manualmente o apelido **"${nickname}"** para o colaborador **${finalName}**!`;
        }
      }

      if (!reply && msgLower.includes('gafe')) {
        let targetId = collabId;
        const idMatch = msgLower.match(/(collab_\w+)/);
        if (idMatch) {
          targetId = idMatch[1];
        }
        
        let gafeDesc = '';
        const gafeMatch = message.match(/gafe(?:\s+de\s+\w+)?:\s*(.+)/i) || message.match(/gafe(?:\s+do\s+\w+)?:\s*(.+)/i) || message.match(/gafe\s+(.+)/i);
        if (gafeMatch) {
          gafeDesc = gafeMatch[1];
        } else {
          const idx = msgLower.indexOf('gafe');
          gafeDesc = message.substring(idx + 4).replace(/^[^\w]+/, '').trim();
        }
        
        if (gafeDesc && targetId) {
          const collab = collabs.find((c: { id: string; name?: string; nickname?: string }) => c.id === targetId || (c.name && c.name.toLowerCase().includes(targetId.toLowerCase())) || (c.nickname && c.nickname.toLowerCase().includes(targetId.toLowerCase())));
          const finalId = collab ? collab.id : targetId;
          const finalName = collab ? collab.name : 'colaborador';
          actionObj = { type: 'ADD_GAFE', collabId: finalId, gafe: gafeDesc };
          reply = `⚠️ **[Modo de Contingência Bob]** Opa! Gafe registrada com sucesso em modo de contingência offline: **"${gafeDesc}"** para **${finalName}**!`;
        }
      }

      if (!reply && (msgLower.includes('folga') || msgLower.includes('folgar'))) {
        const dayMatch = msgLower.match(/dia\s+(\d+)/) || msgLower.match(/folga\s+(\d+)/) || msgLower.match(/dia\s*:\s*(\d+)/);
        if (dayMatch) {
          const day = parseInt(dayMatch[1], 10);
          if (day >= 1 && day <= 31) {
            const nextMonthYear = monthVal === 12 ? yearVal + 1 : yearVal;
            const dateStr = `${nextMonthYear}-${nextMonthNumStr}-${String(day).padStart(2, '0')}`;
            
            const targetId = collabId;
            if (targetId) {
              actionObj = { type: 'REGISTER_FOLGA', collabId: targetId, date: dateStr };
              reply = `⚠️ **[Modo de Contingência Bob]** Perfeito! Agendei sua intenção de folga para o dia **${day}/${nextMonthNumStr}/${nextMonthYear}** no sistema (Mês de ${nextMonthName}) em modo de contingência offline!`;
            }
          }
        }
      }

      if (!reply) {
        reply = `🤖 **Olá! Eu sou o Bob.**

Atualmente, minha inteligência artificial está operando com **limite de cota temporariamente excedido** (Erro 429 Quota Exceeded do Gemini). Peço desculpas por isso!

Mas não se preocupe: você ainda pode gerenciar todas as escalas, turnos e folgas diretamente clicando nas células e botões do painel do sistema de forma totalmente visual e dinâmica!

Se você quiser realizar ações rápidas comigo em modo offline, digite usando estes formatos:
- Para cadastrar apelido: \`apelido [Apelido] para [ID_ou_Nome]\` ou \`apelido de [ID_ou_Nome] para [Apelido]\`
- Para cadastrar gafe: \`gafe de [ID_ou_Nome]: [Descrição da gafe]\`
- Para solicitar folga: \`folga dia [Número do Dia]\`

*Por favor, tente falar comigo novamente por IA mais tarde!*`;
      }

      responseData = {
        reply,
        action: actionObj
      };
    }

    const action = responseData.action;
    let executedAction = null;

    if (action && action.type) {
      const type = action.type.toUpperCase();
      const targetId = action.collabId || (collabId as string);

      if (type === 'REGISTER_NICKNAME' && action.nickname && targetId) {
        const collab = collabs.find(c => c.id === targetId);
        const gafes = collab ? collab.gafes : [];
        await updateBobMetadata(supabase, targetId, action.nickname, gafes);
        executedAction = { type: 'REGISTER_NICKNAME', collabId: targetId, nickname: action.nickname };
      } else if (type === 'ADD_GAFE' && action.gafe && targetId) {
        const collab = collabs.find(c => c.id === targetId);
        const nickname = collab ? collab.nickname : '';
        const gafes = collab ? [...collab.gafes, action.gafe] : [action.gafe];
        await updateBobMetadata(supabase, targetId, nickname, gafes);
        executedAction = { type: 'ADD_GAFE', collabId: targetId, gafe: action.gafe };
      } else if (type === 'REGISTER_FOLGA' && action.date && targetId) {
        await addFolgaRequest(supabase, targetId, action.date);
        executedAction = { type: 'REGISTER_FOLGA', collabId: targetId, date: action.date };
      }
    }

    res.json({
      reply: responseData.reply || rawText,
      action: executedAction
    });
    return;

  } catch (error) {
    const err = error as Error;
    console.error('Error in chatbot API:', err);
    res.status(500).json({ error: err.message || 'Erro interno no processamento.' });
    return;
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 3000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

// Previne crashes inesperados que derrubam o container
process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});
