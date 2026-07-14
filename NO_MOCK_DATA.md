# Diretriz Rígida: Proibição de Dados Simulados e Uso Exclusivo de Banco de Dados

Este documento estabelece a regra máxima para o desenvolvimento e manutenção do sistema **Escala Easy VIBRA**.

## 1. Fonte Única da Verdade (Single Source of Truth)
* **NENHUM** colaborador, turno, sigla, folga, ou registro de histórico deve ser inventado, simulado ou hardcoded nos arquivos de código do frontend (`.ts`, `.html`, etc.).
* Toda e qualquer informação exibida na tela deve vir estritamente das tabelas relacionais do banco de dados ativo (Supabase/Firebase):
  1. `colaboradores`
  2. `escala_diaria`
  3. `sigla_types`
  4. `shift_types`
  5. `audit_history`

## 2. Proibição de Simulações e Mocking
* É terminantemente proibido criar "states" locais estáticos com listas de operadores, cargos fictícios ou comportamentos que não reflitam o estado real do banco de dados.
* O sistema deve operar de maneira 100% dinâmica. Se uma sigla, turno ou colaborador não existe na tabela correspondente do banco de dados, ele **não deve** ser renderizado ou tratado pelo sistema.

## 3. Origem do Código "N"
* O caractere `"N"` na escala diária originou-se do script de carga inicial do banco de dados (`schema.sql` e `sync_and_clean.js`) para representar o turno da **Noite/Madrugada** (dos colaboradores com horário de trabalho das 21:12 às 06:00, 21:00 às 06:00 ou 22:00 às 07:00).
* Caso o padrão da escala real ou do PDF não utilize o caractere `"N"` para esse turno, a alteração deve ser feita diretamente nas tabelas `shift_types` e `sigla_types` do banco de dados, e o script de mapeamento deve ser ajustado para refletir o código correto (por exemplo, se o correto for outra letra ou representação).

---
**Esta diretriz é inegociável e deve ser lida por qualquer agente de codificação antes de realizar edições no sistema.**
