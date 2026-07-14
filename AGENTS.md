# Sistema de Gestão de Escala - Escala Easy VIBRA

## Diretrizes de Negócio e Escopo
Este sistema foi projetado e desenvolvido estritamente para a **Gestão de Escala de Trabalho Mensal**.

**DIRETRIZ CRÍTICA:**
- O sistema **NÃO TEM QUALQUER RELAÇÃO** com aviação, aviões, aeronaves, voos, aeroportos ou combustíveis (como JetFuel, Vibra Combustíveis, etc.).
- Não utilize quaisquer termos, metadados, imagens ou recursos relacionados a aviões, combustível, voos ou telemetria aérea.
- Os colaboradores cadastrados representam trabalhadores de escala corporativa padrão (Operadores, Líderes e Supervisores) divididos em turnos (Manhã, Tarde, Noite, Administrativo) e setores de atuação da empresa.
- Todos os IDs de colaboradores devem possuir o prefixo limpo `collab_` (ex: `collab_12345`). É terminantemente proibido o uso de qualquer prefixo de aeronaves ou aviação.

## Estrutura do Banco de Dados (Supabase)
O banco de dados do sistema utiliza as seguintes tabelas em sua estrutura relacional:
1. `colaboradores`: Cadastro e informações pessoais de cada trabalhador.
2. `escala_diaria`: Dias de trabalho e folgas programadas para o mês.
3. `sigla_types`: Tipos de siglas de afastamento e folgas corporativas.
4. `shift_types`: Turnos base configurados para o planejamento.
5. `audit_history`: Registros de auditoria de alterações na escala.

Qualquer alteração ou sugestão de código futura deve respeitar estritamente estas definições.

## Fonte Única de Dados (Single Source of Truth)
* **PROIBIÇÃO DE MOCK/DADOS INVENTADOS:** O aplicativo não deve sob circunstância alguma utilizar listas estáticas de colaboradores, turnos inventados, ou siglas simuladas que estejam fora das tabelas oficiais acima.
* Toda a interface deve ser 100% dinâmica, lendo as siglas, os turnos e os colaboradores cadastrados unicamente a partir do banco de dados relacional.

## Diretrizes de Harmonia Cromática (Círculo Cromático)
* **DIRETRIZ DE DESIGN OBRIGATÓRIA:** É terminantemente proibido usar textos de contraste escuro sujo (como preto ou cinza escuro genéricos) sobre fundos coloridos vibrantes (como verde, esmeralda, âmbar ou vermelho).
* Toda a interface deve seguir estritamente o guia de cores estabelecido em `/DESIGN_CHROMATIC_GUIDELINES.md`. 
* Sempre que um fundo colorido for criado ou modificado (como botões, badges, cabeçalhos, indicações de dia ou status), aplique as regras de harmonia cromática de círculo cromático (ex: `text-white` ou um tom extremamente escuro análogo como `text-emerald-950` sobre fundos esmeralda).


