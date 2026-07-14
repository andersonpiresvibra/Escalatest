-- =====================================================================
-- SCRIPT COMPLETO DE CRIAÇÃO E CARGA DE DADOS - ESCALA EASY VIBRA
-- Execute este script no SQL Editor do seu painel do Supabase
-- =====================================================================

-- 1. ADICIONA COLUNAS CASO A TABELA "colaboradores" JÁ EXISTA SEM ELAS
-- Isso resolve o erro: ERROR: column "birthday" of relation "colaboradores" does not exist
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS special_dates JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS folga_requests JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS bh_balance INT DEFAULT 0;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS score INT DEFAULT 90;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS schedule VARCHAR(50);
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS grupo VARCHAR(100);
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS shift VARCHAR(100);
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS sector VARCHAR(100);

-- ADICIONA COLUNAS DE COR DA FONTE NAS TABELAS DE TURNOS E SIGLAS SE NÃO EXISTIREM
ALTER TABLE public.sigla_types ADD COLUMN IF NOT EXISTS "textColor" VARCHAR(50) DEFAULT '#ffffff';
ALTER TABLE public.shift_types ADD COLUMN IF NOT EXISTS "textColor" VARCHAR(50) DEFAULT '#ffffff';

-- 2. GARANTE A EXISTÊNCIA DE TODAS AS TABELAS COM A ESTRUTURA COMPLETA
CREATE TABLE IF NOT EXISTS public.colaboradores (
  id VARCHAR(100) PRIMARY KEY, -- ID com prefixo 'collab_'
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL, -- 'OPERADOR', 'LIDER', 'SUPERVISOR'
  schedule VARCHAR(50) NOT NULL, -- Horário de trabalho
  grupo VARCHAR(100) NOT NULL, -- Grupo/Turno visual
  shift VARCHAR(100) NOT NULL, -- 'MANHÃ', 'TARDE', 'MADRUGADA', 'ADMINISTRATIVO'
  sector VARCHAR(100) NOT NULL, -- 'AERÓDROMO', 'VIP'
  bh_balance INT DEFAULT 0,
  score INT DEFAULT 90,
  birthday DATE,
  special_dates JSONB DEFAULT '[]'::jsonb,
  folga_requests JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.escala_diaria (
  collaborator_id VARCHAR(100) REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  day INT NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  value VARCHAR(50) NOT NULL, -- M, T, N, ADM, F, etc.
  PRIMARY KEY (collaborator_id, day, month, year)
);

CREATE TABLE IF NOT EXISTS public.sigla_types (
  code VARCHAR(50) PRIMARY KEY,
  label VARCHAR(255) NOT NULL,
  color VARCHAR(50) NOT NULL,
  "textColor" VARCHAR(50) DEFAULT '#ffffff',
  description TEXT
);

CREATE TABLE IF NOT EXISTS public.shift_types (
  code VARCHAR(50) PRIMARY KEY,
  label VARCHAR(255) NOT NULL,
  hours VARCHAR(50) NOT NULL,
  color VARCHAR(50) NOT NULL,
  "textColor" VARCHAR(50) DEFAULT '#ffffff',
  "startTime" VARCHAR(50),
  "endTime" VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS public.audit_history (
  id VARCHAR(100) PRIMARY KEY,
  timestamp VARCHAR(100) NOT NULL,
  author VARCHAR(255) NOT NULL,
  action VARCHAR(255) NOT NULL,
  description TEXT NOT NULL
);

-- 3. LIMPEZA DE DADOS EXISTENTES PARA EVITAR DUPLICIDADE E ERROS DE CONFLITO
TRUNCATE TABLE public.escala_diaria CASCADE;
TRUNCATE TABLE public.colaboradores CASCADE;
TRUNCATE TABLE public.sigla_types CASCADE;
TRUNCATE TABLE public.shift_types CASCADE;

-- 4. INSERÇÃO DOS TIPOS DE SIGLAS PADRÃO
INSERT INTO public.sigla_types (code, label, color, description) VALUES
('M', 'Manhã', '#0ea5e9', 'Turno padrão matutino'),
('T', 'Tarde', '#f59e0b', 'Turno padrão vespertino'),
('N', 'Noite/Madrugada', '#6366f1', 'Turno padrão noturno'),
('ADM', 'Administrativo', '#10b981', 'Horário comercial administrativo'),
('X', 'Folga', '#475569', 'Folga semanal programada'),
('F', 'Férias', '#a855f7', 'Período de férias regulamentares'),
('LM', 'Licença Médica', '#ef4444', 'Afastamento por atestado ou recomendação médica'),
('TR', 'Treinamento', '#06b6d4', 'Capacitação ou treinamento interno corporativo')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, color = EXCLUDED.color, description = EXCLUDED.description;

-- 5. INSERÇÃO DOS TURNOS PADRÃO
INSERT INTO public.shift_types (code, label, hours, color, "startTime", "endTime") VALUES
('M', 'Manhã', '7h20', '#0ea5e9', '06:00', '15:00'),
('T', 'Tarde', '7h20', '#f59e0b', '14:42', '23:30'),
('N', 'Noite/Madrugada', '7h20', '#6366f1', '21:12', '06:00'),
('ADM', 'Administrativo', '8h00', '#10b981', '08:00', '17:00')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, hours = EXCLUDED.hours, color = EXCLUDED.color, "startTime" = EXCLUDED."startTime", "endTime" = EXCLUDED."endTime";

-- 6. CARGA DOS 82 COLABORADORES ATIVOS (JULHO/2026 ATUALIZADA)
INSERT INTO public.colaboradores (id, name, role, schedule, grupo, shift, sector, bh_balance, score, birthday, special_dates, folga_requests) VALUES
-- 05:00 – 14:00 (5 Operadores - Aeródromo)
('collab_1', 'MICHEL (AD)', 'OPERADOR', '05:00 - 14:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 0, 95, '1992-04-12', '[]'::jsonb, '[]'::jsonb),
('collab_2', 'JOAO (AD)', 'OPERADOR', '05:00 - 14:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 2, 90, '1995-08-22', '[]'::jsonb, '[]'::jsonb),
('collab_3', 'ADAUTO (AD)', 'OPERADOR', '05:00 - 14:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', -1, 92, '1990-11-05', '[]'::jsonb, '[]'::jsonb),
('collab_4', 'PAULO (AA)', 'OPERADOR', '05:00 - 14:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 0, 98, '1988-02-14', '[]'::jsonb, '[]'::jsonb),
('collab_5', 'EWERTON', 'OPERADOR', '05:00 - 14:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 4, 91, '1994-07-30', '[]'::jsonb, '[]'::jsonb),

-- 06:00 – 15:00 (24 Operadores - Aeródromo)
('collab_6', 'ALEX BARBOSA', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 0, 94, '1993-01-15', '[]'::jsonb, '[]'::jsonb),
('collab_7', 'DOUGLAS (AA)', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', -3, 88, '1991-09-18', '[]'::jsonb, '[]'::jsonb),
('collab_8', 'TAVARES', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 1, 95, '1987-12-01', '[]'::jsonb, '[]'::jsonb),
('collab_9', 'JULIO', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 0, 90, '1989-05-25', '[]'::jsonb, '[]'::jsonb),
('collab_10', 'SANDRO (AA)', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 2, 93, '1990-03-14', '[]'::jsonb, '[]'::jsonb),
('collab_11', 'CLÉBER (AD)', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', -1, 92, '1992-06-11', '[]'::jsonb, '[]'::jsonb),
('collab_12', 'JOSE (AD)', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 0, 96, '1985-04-20', '[]'::jsonb, '[]'::jsonb),
('collab_13', 'CALAZANS', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 5, 89, '1994-10-31', '[]'::jsonb, '[]'::jsonb),
('collab_14', 'SILVA', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', -2, 91, '1991-02-08', '[]'::jsonb, '[]'::jsonb),
('collab_15', 'GUILHERME (AA)', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 0, 97, '1996-07-24', '[]'::jsonb, '[]'::jsonb),
('collab_16', 'ILDO (AD)', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 1, 90, '1988-11-13', '[]'::jsonb, '[]'::jsonb),
('collab_17', 'PETERSON (AA)', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 0, 94, '1993-05-05', '[]'::jsonb, '[]'::jsonb),
('collab_18', 'RENILSON (AD)', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', -1, 87, '1990-08-30', '[]'::jsonb, '[]'::jsonb),
('collab_19', 'RAMOS', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 3, 92, '1992-12-19', '[]'::jsonb, '[]'::jsonb),
('collab_20', 'VAGNER', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 0, 95, '1986-03-27', '[]'::jsonb, '[]'::jsonb),
('collab_21', 'EVANDRO', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 2, 89, '1991-06-03', '[]'::jsonb, '[]'::jsonb),
('collab_22', 'CESAR JC', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 0, 93, '1989-10-14', '[]'::jsonb, '[]'::jsonb),
('collab_23', 'FLAVIO', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', -4, 91, '1994-01-28', '[]'::jsonb, '[]'::jsonb),
('collab_24', 'CARLOS', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 1, 96, '1987-05-17', '[]'::jsonb, '[]'::jsonb),
('collab_25', 'BELENTANI (AD)', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 0, 92, '1995-11-20', '[]'::jsonb, '[]'::jsonb),
('collab_26', 'EULES', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 2, 90, '1992-09-09', '[]'::jsonb, '[]'::jsonb),
('collab_27', 'SOUZA', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', -1, 94, '1990-07-12', '[]'::jsonb, '[]'::jsonb),
('collab_28', 'LUNA', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 0, 95, '1993-03-24', '[]'::jsonb, '[]'::jsonb),
('collab_29', 'HUAN', 'OPERADOR', '06:00 - 15:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 3, 93, '1996-12-05', '[]'::jsonb, '[]'::jsonb),

-- 06:00 – 16:00 (3 Operadores - Aeródromo)
('collab_30', 'LUIS 06-15', 'OPERADOR', '06:00 - 16:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 0, 95, '1991-10-10', '[]'::jsonb, '[]'::jsonb),
('collab_31', 'CAIO 06-15', 'OPERADOR', '06:00 - 16:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', 1, 92, '1994-02-15', '[]'::jsonb, '[]'::jsonb),
('collab_32', 'IDENILSON 06-15', 'OPERADOR', '06:00 - 16:00', 'Manhã', 'MANHÃ', 'AERÓDROMO', -2, 89, '1988-06-21', '[]'::jsonb, '[]'::jsonb),

-- 14:42 – 23:30 (7 Operadores - Aeródromo)
('collab_33', 'RODOLFO (AA)', 'OPERADOR', '14:42 - 23:30', 'Tarde', 'TARDE', 'AERÓDROMO', 0, 93, '1993-07-07', '[]'::jsonb, '[]'::jsonb),
('collab_34', 'LEONARDO (AD)', 'OPERADOR', '14:42 - 23:30', 'Tarde', 'TARDE', 'AERÓDROMO', -1, 94, '1995-11-11', '[]'::jsonb, '[]'::jsonb),
('collab_35', 'JUNIOR (AD)', 'OPERADOR', '14:42 - 23:30', 'Tarde', 'TARDE', 'AERÓDROMO', 2, 91, '1990-01-02', '[]'::jsonb, '[]'::jsonb),
('collab_36', 'KLEYSSON', 'OPERADOR', '14:42 - 23:30', 'Tarde', 'TARDE', 'AERÓDROMO', 0, 96, '1989-08-14', '[]'::jsonb, '[]'::jsonb),
('collab_37', 'LUCAS', 'OPERADOR', '14:42 - 23:30', 'Tarde', 'TARDE', 'AERÓDROMO', 3, 90, '1996-05-19', '[]'::jsonb, '[]'::jsonb),
('collab_38', 'WESLEY (AD)', 'OPERADOR', '14:42 - 23:30', 'Tarde', 'TARDE', 'AERÓDROMO', -3, 88, '1992-03-31', '[]'::jsonb, '[]'::jsonb),
('collab_39', 'PETTINELLI', 'OPERADOR', '14:42 - 23:30', 'Tarde', 'TARDE', 'AERÓDROMO', 1, 95, '1987-12-25', '[]'::jsonb, '[]'::jsonb),

-- 15:15 – 00:00 (17 Operadores - Aeródromo)
('collab_40', 'FREDISON', 'OPERADOR', '15:15 - 00:00', 'Tarde', 'TARDE', 'AERÓDROMO', 0, 94, '1994-09-09', '[]'::jsonb, '[]'::jsonb),
('collab_41', 'ALVES', 'OPERADOR', '15:15 - 00:00', 'Tarde', 'TARDE', 'AERÓDROMO', -2, 90, '1991-05-15', '[]'::jsonb, '[]'::jsonb),
('collab_42', 'LEANDRO EUFRA (AA)', 'OPERADOR', '15:15 - 00:00', 'Tarde', 'TARDE', 'AERÓDROMO', 1, 92, '1993-02-28', '[]'::jsonb, '[]'::jsonb),
('collab_43', 'JOSE EDSON', 'OPERADOR', '15:15 - 00:00', 'Tarde', 'TARDE', 'AERÓDROMO', 0, 95, '1986-12-14', '[]'::jsonb, '[]'::jsonb),
('collab_44', 'FEITOSA', 'OPERADOR', '15:15 - 00:00', 'Tarde', 'TARDE', 'AERÓDROMO', 4, 87, '1989-10-05', '[]'::jsonb, '[]'::jsonb),
('collab_45', 'LOPES (AD)', 'OPERADOR', '15:15 - 00:00', 'Tarde', 'TARDE', 'AERÓDROMO', -1, 93, '1992-04-22', '[]'::jsonb, '[]'::jsonb),
('collab_46', 'GIVANI (AD)', 'OPERADOR', '15:15 - 00:00', 'Tarde', 'TARDE', 'AERÓDROMO', 0, 91, '1988-07-17', '[]'::jsonb, '[]'::jsonb),
('collab_47', 'RENATO (AD)', 'OPERADOR', '15:15 - 00:00', 'Tarde', 'TARDE', 'AERÓDROMO', 2, 96, '1995-03-03', '[]'::jsonb, '[]'::jsonb),
('collab_48', 'COSTA', 'OPERADOR', '15:15 - 00:00', 'Tarde', 'TARDE', 'AERÓDROMO', -3, 89, '1990-11-12', '[]'::jsonb, '[]'::jsonb),
('collab_49', 'MANOEL', 'OPERADOR', '15:15 - 00:00', 'Tarde', 'TARDE', 'AERÓDROMO', 1, 94, '1987-08-25', '[]'::jsonb, '[]'::jsonb),
('collab_50', 'RONALD', 'OPERADOR', '15:15 - 00:00', 'Tarde', 'TARDE', 'AERÓDROMO', 0, 98, '1996-01-30', '[]'::jsonb, '[]'::jsonb),
('collab_51', 'BARBOSA', 'OPERADOR', '15:15 - 00:00', 'Tarde', 'TARDE', 'AERÓDROMO', 0, 97, '1994-06-18', '[]'::jsonb, '[]'::jsonb),
('collab_52', 'BASTOS', 'OPERADOR', '15:15 - 00:00', 'Tarde', 'TARDE', 'AERÓDROMO', 2, 95, '1991-09-04', '[]'::jsonb, '[]'::jsonb),
('collab_53', 'GILVAN (AD)', 'OPERADOR', '15:15 - 00:00', 'Tarde', 'TARDE', 'AERÓDROMO', -1, 92, '1989-12-08', '[]'::jsonb, '[]'::jsonb),
('collab_54', 'MILTON', 'OPERADOR', '15:15 - 00:00', 'Tarde', 'TARDE', 'AERÓDROMO', 3, 91, '1992-05-27', '[]'::jsonb, '[]'::jsonb),
('collab_55', 'MARQUES (AD)', 'OPERADOR', '15:15 - 00:00', 'Tarde', 'TARDE', 'AERÓDROMO', 0, 94, '1995-10-15', '[]'::jsonb, '[]'::jsonb),
('collab_56', 'LAERCIO (AA)', 'OPERADOR', '15:15 - 00:00', 'Tarde', 'TARDE', 'AERÓDROMO', 1, 96, '1993-03-12', '[]'::jsonb, '[]'::jsonb),

-- 21:12 – 06:00 (9 Operadores - Aeródromo)
('collab_57', 'HORACIO (AA)', 'OPERADOR', '21:12 - 06:00', 'Madrugada', 'MADRUGADA', 'AERÓDROMO', 0, 95, '1990-02-28', '[]'::jsonb, '[]'::jsonb),
('collab_58', 'NORMAN', 'OPERADOR', '21:12 - 06:00', 'Madrugada', 'MADRUGADA', 'AERÓDROMO', -1, 91, '1992-07-14', '[]'::jsonb, '[]'::jsonb),
('collab_59', 'RAFAEL (AD)', 'OPERADOR', '21:12 - 06:00', 'Madrugada', 'MADRUGADA', 'AERÓDROMO', 2, 93, '1994-11-23', '[]'::jsonb, '[]'::jsonb),
('collab_60', 'DOURADO', 'OPERADOR', '21:12 - 06:00', 'Madrugada', 'MADRUGADA', 'AERÓDROMO', 0, 96, '1987-04-05', '[]'::jsonb, '[]'::jsonb),
('collab_61', 'VENANCIO', 'OPERADOR', '21:12 - 06:00', 'Madrugada', 'MADRUGADA', 'AERÓDROMO', 3, 89, '1991-09-30', '[]'::jsonb, '[]'::jsonb),
('collab_62', 'DIOGO (AA)', 'OPERADOR', '21:12 - 06:00', 'Madrugada', 'MADRUGADA', 'AERÓDROMO', -2, 92, '1993-01-08', '[]'::jsonb, '[]'::jsonb),
('collab_63', 'WILLIAN (AA)', 'OPERADOR', '21:12 - 06:00', 'Madrugada', 'MADRUGADA', 'AERÓDROMO', 0, 94, '1989-06-12', '[]'::jsonb, '[]'::jsonb),
('collab_64', 'SILVERIO (AD)', 'OPERADOR', '21:12 - 06:00', 'Madrugada', 'MADRUGADA', 'AERÓDROMO', 1, 95, '1995-05-17', '[]'::jsonb, '[]'::jsonb),
('collab_65', 'REGIS (AD)', 'OPERADOR', '21:12 - 06:00', 'Madrugada', 'MADRUGADA', 'AERÓDROMO', 0, 90, '1992-10-25', '[]'::jsonb, '[]'::jsonb),

-- Líderes de Turno (9 Líderes - Aeródromo)
-- 06:00 – 15:00
('collab_66', 'CESARIO (AD)', 'LIDER', '06:00 - 15:00', 'Líderes', 'MANHÃ', 'AERÓDROMO', 0, 98, '1985-03-12', '[]'::jsonb, '[]'::jsonb),
('collab_67', 'MARTINEZ (AA)', 'LIDER', '06:00 - 15:00', 'Líderes', 'MANHÃ', 'AERÓDROMO', 1, 97, '1988-08-20', '[]'::jsonb, '[]'::jsonb),
('collab_68', 'PASCHOAL (AA)', 'LIDER', '06:00 - 15:00', 'Líderes', 'MANHÃ', 'AERÓDROMO', -1, 96, '1986-01-15', '[]'::jsonb, '[]'::jsonb),
('collab_69', 'MARCIO (AA)', 'LIDER', '06:00 - 15:00', 'Líderes', 'MANHÃ', 'AERÓDROMO', 0, 99, '1984-07-29', '[]'::jsonb, '[]'::jsonb),
-- 14:30 – 23:30
('collab_70', 'SPEDINI (AD)', 'LIDER', '14:30 - 23:30', 'Líderes', 'TARDE', 'AERÓDROMO', 2, 95, '1989-11-04', '[]'::jsonb, '[]'::jsonb),
('collab_71', 'MARCIO (AD)', 'LIDER', '14:30 - 23:30', 'Líderes', 'TARDE', 'AERÓDROMO', 0, 96, '1991-04-18', '[]'::jsonb, '[]'::jsonb),
('collab_72', 'JONATAN (AD)', 'LIDER', '14:30 - 23:30', 'Líderes', 'TARDE', 'AERÓDROMO', -2, 94, '1993-09-02', '[]'::jsonb, '[]'::jsonb),
-- 21:12 – 06:00
('collab_73', 'PEREIRA (AA)', 'LIDER', '21:12 - 06:00', 'Líderes', 'MADRUGADA', 'AERÓDROMO', 0, 97, '1987-05-11', '[]'::jsonb, '[]'::jsonb),
('collab_74', 'GUSTAVO (AD)', 'LIDER', '21:12 - 06:00', 'Líderes', 'MADRUGADA', 'AERÓDROMO', 1, 96, '1990-12-24', '[]'::jsonb, '[]'::jsonb),

-- Pátio VIP (8 Operadores - VIP)
('collab_75', 'FERNANDO', 'OPERADOR', '07:00 - 16:00', 'VIP', 'MANHÃ', 'VIP', 0, 94, '1993-06-18', '[]'::jsonb, '[]'::jsonb),
('collab_76', 'RENATA', 'OPERADOR', '06:00 - 15:00', 'VIP', 'MANHÃ', 'VIP', -1, 95, '1995-02-14', '[]'::jsonb, '[]'::jsonb),
('collab_77', 'ZAGO', 'OPERADOR', '06:00 - 15:00', 'VIP', 'MANHÃ', 'VIP', 1, 92, '1991-10-30', '[]'::jsonb, '[]'::jsonb),
('collab_78', 'TORRES', 'OPERADOR', '14:30 - 23:30', 'VIP', 'TARDE', 'VIP', 0, 93, '1989-04-05', '[]'::jsonb, '[]'::jsonb),
('collab_79', 'SOLANGE', 'OPERADOR', '14:30 - 23:30', 'VIP', 'TARDE', 'VIP', 2, 96, '1992-08-12', '[]'::jsonb, '[]'::jsonb),
('collab_80', 'LOYOLA', 'OPERADOR', '14:30 - 23:30', 'VIP', 'TARDE', 'VIP', 0, 94, '1994-01-22', '[]'::jsonb, '[]'::jsonb),
('collab_81', 'NORIVAL', 'OPERADOR', '21:00 - 06:00', 'VIP', 'MADRUGADA', 'VIP', -1, 91, '1988-12-07', '[]'::jsonb, '[]'::jsonb),
('collab_82', 'PIRES', 'OPERADOR', '22:00 - 07:00', 'VIP', 'MADRUGADA', 'VIP', 0, 95, '1990-07-15', '[]'::jsonb, '[]'::jsonb);

-- 7. POPULA A TABELA "escala_diaria" COM FOLGAS INTELIGENTES (5x2) PARA JULHO DE 2026 USANDO CROSS JOIN (COMPATÍVEL SUPABASE)
INSERT INTO public.escala_diaria (collaborator_id, day, month, year, value)
WITH collab_indexed AS (
  SELECT 
    id, 
    shift,
    (ROW_NUMBER() OVER (ORDER BY id) - 1) AS collab_idx
  FROM public.colaboradores
),
days AS (
  SELECT generate_series(1, 31) AS day
)
SELECT 
  c.id AS collaborator_id,
  d.day,
  7 AS month,
  2026 AS year,
  CASE 
    -- Se for folga baseada no escalonamento 5x2 inteligente
    WHEN (
      (c.collab_idx % 3 = 0 AND ((d.day + 2) % 7 = 6 OR (d.day + 2) % 7 = 0)) OR
      (c.collab_idx % 3 = 1 AND ((d.day + 2) % 7 = 5 OR (d.day + 2) % 7 = 6)) OR
      (c.collab_idx % 3 = 2 AND ((d.day + 2) % 7 = 0 OR (d.day + 2) % 7 = 1))
    ) THEN 'X'
    -- Senão, usa o caractere de trabalho padrão '-'
    ELSE '-'
  END AS value
FROM collab_indexed c
CROSS JOIN days d
ON CONFLICT (collaborator_id, day, month, year) DO UPDATE SET value = EXCLUDED.value;

-- 8. REGISTRO DE AUDITORIA DE CRIAÇÃO DA ESCALA ATUALIZADA
INSERT INTO public.audit_history (id, timestamp, author, action, description)
VALUES (
  'bk_init_' || EXTRACT(EPOCH FROM NOW())::int,
  TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
  'Sistema (Malha Eng.)',
  'CARGA_INICIAL',
  'Sincronização de todos os 82 colaboradores e ativação da nova escala para Julho/2026.'
);
