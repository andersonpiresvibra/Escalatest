# Guia de Escopo e Conduta do Agente - Escala Easy VIBRA

Este documento serve como a **Diretriz de Conduta Suprema** para qualquer agente de IA ou desenvolvedor que atue neste repositório. O cumprimento destas regras é obrigatório e deve ser verificado antes de qualquer alteração de código.

---

## 🚨 REGRA DE OURO (GOLDEN RULE)
> **NÃO ALTERE O LAYOUT OU A ESTRUTURA VISUAL SEM PERMISSÃO EXPLÍCITA DO USUÁRIO.**
> O design, o posicionamento dos componentes, os espaçamentos, as cores e a estrutura do HTML (layout) devem ser preservados a todo custo, exceto quando o usuário solicitar expressamente uma modificação visual.

---

## 💼 CONTEXTO EXCLUSIVO DO SISTEMA
O **Escala Easy VIBRA** é estritamente um sistema de **Gestão de Escala de Trabalho Mensal** para colaboradores corporativos padrão (Operadores, Líderes e Supervisores).
- **PROIBIÇÃO ABSOLUTA:** O sistema **NÃO TEM QUALQUER RELAÇÃO** com aviação, aviões, malhas aéreas, voos, aeroportos ou combustíveis (como JetFuel, Vibra Combustíveis, etc.).
- **NÃO CONCORRA COM METÁFORAS DE AVIAÇÃO:** Não utilize o termo "malha" ou qualquer analogia aeroespacial. É uma escala de trabalho corporativa para controle de turnos (Manhã, Tarde, Noite, Administrativo) e folgas.

---

## 🎛️ TRÍADE DE ESCOPO: MODOS DE ATUAÇÃO
Dependendo da intenção da solicitação do usuário, o agente deve se enquadrar estritamente em um dos três modos abaixo e limitar suas ações de forma cirúrgica.

### 1. 💻 MODO PROGRAMAÇÃO (Programming)
*Ativado quando o assunto é lógica, regras de negócio, banco de dados, APIs ou fluxos de dados.*
- **O que fazer:** Focar estritamente nos arquivos de lógica (`src/app/services/`, TypeScript controladores, backend, chamadas de API, queries do Supabase, regras do Firestore).
- **O que NÃO fazer:** **NÃO ALTERAR** elementos visuais, classes de estilo do Tailwind, tags de estruturação do HTML ou layouts de tela. A estrutura visual deve permanecer 100% intacta.
- **Diretriz:** Siga as melhores práticas de programação TypeScript e Angular, garantindo tipagem estrita e tratamento robusto de erros.

### 2. 🎨 MODO LAYOUT (Design/Layout)
*Ativado quando o assunto é aparência, design, CSS, Tailwind, espaçamentos, cores ou posicionamento.*
- **O que fazer:** Alterar estritamente as propriedades visuais, classes de utilidade do Tailwind, templates HTML de visualização (`.html`), variáveis de CSS ou arquivos de tema (`styles.css`, `themes.css`).
- **O que NÃO fazer:** **NÃO ALTERAR** a lógica de negócio, chamadas de API, endpoints do servidor, schemas do banco de dados ou fluxo de dados do aplicativo.
- **Diretriz:** Mantenha o design refinado e de alta fidelidade (Dark Mode Slate-900, acentos em Emerald-500), garantindo que as mudanças sejam estritamente visuais.

### 3. 🤖 MODO AUTOMAÇÃO (Automation)
*Ativado quando o assunto é scripts, ferramentas de build, CI/CD, deploys ou tarefas agendadas.*
- **O que fazer:** Alterar estritamente os scripts de automação, arquivos de configuração (ex: `package.json`, `angular.json`, `wrangler.toml`, arquivos de workflows, scripts na raiz como `sync_and_clean.js`, `patch_scale_service.js`, etc.).
- **O que NÃO fazer:** **NÃO ALTERAR** os arquivos de código-fonte do aplicativo (`src/app/`) nem a lógica de exibição, a menos que seja um patch de build estritamente necessário.
- **Diretriz:** Mantenha as automações enxutas, seguras e focadas no propósito especificado pelo usuário.

---

## 📋 PROTOCOLO DE EXECUÇÃO PRÉ-TURA
Antes de realizar qualquer edição de arquivo ou comando:
1. **Identifique o Modo Ativo:** Classifique a solicitação do usuário entre **Programação**, **Layout** ou **Automação**.
2. **Auto-Verificação de Escopo:** Pergunte-se: *"A alteração que estou prestes a fazer toca em arquivos ou lógicas fora do meu Modo Ativo?"* Se sim, isole as mudanças ou peça permissão ao usuário.
3. **Respeite a integridade dos dados:** Nunca use dados estáticos/mock. Toda informação de escala (colaboradores, turnos, siglas) deve ser lida dinamicamente do banco de dados.
