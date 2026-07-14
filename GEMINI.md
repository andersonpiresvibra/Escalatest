# Instruções de Escopo e Conduta do Modelo - Escala Easy VIBRA

Estas diretrizes complementam as regras de desenvolvimento do projeto e devem ser lidas obrigatoriamente antes de qualquer tomada de decisão técnica ou visual.

---

## 🚨 REGRA DE OURO (GOLDEN RULE)
**NÃO ALTERE O LAYOUT OU A ESTRUTURA VISUAL SEM PERMISSÃO EXPLÍCITA DO USUÁRIO.**
A estrutura de componentes, designs de tela, classes Tailwind de layout, cores, espaçamento e templates HTML devem ser mantidos idênticos a menos que o usuário solicite explicitamente modificações no visual.

---

## 🧭 DIRETRIZES DE ACORDO COM O ASSUNTO (TRÍADE DE ESCOPO)

### 1. Assunto: PROGRAMAÇÃO (Programming)
*Se o assunto ou solicitação do usuário for sobre lógica, banco de dados, APIs, serviços ou backend:*
- Siga as regras detalhadas de programação em `/AGENT_ROLES.md` (Seção: MODO PROGRAMAÇÃO).
- Modifique apenas arquivos de lógica (`src/app/services/`, controladores TypeScript, regras de API).
- **Proibição:** É terminantemente proibido modificar o layout visual, estilos ou HTML dos componentes.

### 2. Assunto: LAYOUT
*Se o assunto ou solicitação do usuário for estritamente sobre aparência, design, CSS ou Tailwind:*
- Siga as regras em `/AGENT_ROLES.md` (Seção: MODO LAYOUT).
- Modifique apenas arquivos visuais (`.html`, `.css`, classes Tailwind).
- **Proibição:** É terminantemente proibido alterar lógicas de negócio, conexões de banco de dados, endpoints ou fluxos de dados.

### 3. Assunto: AUTOMAÇÃO (Automation)
*Se o assunto ou solicitação for automação, builders, scripts ou fluxos de trabalho adicionais:*
- Siga as regras em `/AGENT_ROLES.md` (Seção: MODO AUTOMAÇÃO).
- Altere apenas os scripts de automação ou o arquivo de skill correspondente.
- **Proibição:** É terminantemente proibido tocar na interface ou na lógica interna do aplicativo principal.

---

## 🏢 CONTEXTO DE NEGÓCIO EXCLUSIVO
O aplicativo lida unicamente com **escala de trabalho corporativa** (turnos de operadores, líderes e supervisores).
- **NÃO** possui qualquer relação com aviação, aeronaves, aeroportos ou malhas de voos.
- Evite absolutamente o termo "malha" ou qualquer conotação aérea.
- Siga as diretrizes de dados do arquivo `/AGENT_ROLES.md` para conexões dinamicas ao banco de dados relacional.
- **Harmonia Cromática OBRIGATÓRIA:** Consulte e aplique estritamente as diretrizes de `/DESIGN_CHROMATIC_GUIDELINES.md` para qualquer alteração ou criação de designs de tela e cores de componentes (evitando contrastes sem harmonia como texto preto/escuro sobre fundo verde ou âmbar).

