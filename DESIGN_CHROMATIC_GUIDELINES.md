# Diretrizes de Harmonia Cromática e Cores Complementares
## Escala Easy VIBRA - Guia de Design UI/UX de Alta Fidelidade

Este documento serve como a **especificação obrigatória de design cromático** do sistema Escala Easy VIBRA. Ele deve ser consultado antes de qualquer alteração ou criação de componentes, cartões, tabelas, modais ou painéis visuais no sistema.

---

### 1. O Problema do Contraste Sujo (Muddy Contrast)
O uso inadequado de cores sem harmonia cromática degrada a experiência do usuário e desvaloriza a interface de alta fidelidade do aplicativo.
* **O que evitar:** Combinar fundos de cores vibrantes (como verde esmeralda `bg-emerald-500`) com textos escuros/pretos genéricos (`text-slate-950`, `text-black` ou `#000000`). Essa combinação gera cansaço visual, falta de nitidez e ausência de harmonia cromática.
* **O que buscar:** Utilizar o círculo cromático para estabelecer **contrastes harmônicos**. Se uma cor vibrante for usada como fundo, o texto sobre ela deve ser ou **branco puro/esbranquiçado** (alta reflexão de luz) ou um **tom extremamente escuro derivado da própria cor de fundo** (analogia cromática escura), garantindo que não pareça "sujo".

---

### 2. Tabela de Combinações Recomendadas (Círculo Cromático & Contraste)

| Cor de Fundo | Classe Tailwind Fundo | Cor do Texto Recomendada (Clara) | Cor do Texto Recomendada (Escura/Análoga) | O que NUNCA usar |
| :--- | :--- | :--- | :--- | :--- |
| **Verde / Esmeralda** | `bg-emerald-500` ou `bg-emerald-600` | `text-white` (Branco Puro) ou `text-emerald-50` | `text-emerald-950` (Verde Escuro Profundo) | `text-slate-950`, `text-black` |
| **Âmbar / Amarelo** | `bg-amber-500` ou `bg-amber-400` | `text-white` (Branco Puro) | `text-amber-950` (Marrom Profundo/Quente) | `text-slate-900`, `text-slate-950` |
| **Vermelho / Rose** | `bg-rose-500` ou `bg-red-500` | `text-white` (Branco Puro) | `text-rose-950` (Vinho/Vermelho Profundo) | `text-slate-900`, `text-black` |
| **Azul / Índigo** | `bg-blue-600` ou `bg-indigo-600` | `text-white` (Branco Puro) | `text-blue-950` (Azul Escuro Profundo) | `text-slate-900`, `text-black` |

---

### 3. Aplicação em Cores Complementares e Análogas

#### A. Tons Verdes (Esmeralda - Emerald)
* **Design de Sucesso:**
  * Fundo: `bg-emerald-500`
  * Texto/Ícone: `text-white` ou `text-emerald-950` (nunca cinza escuro ou preto)
* **Badges de Status em Light Theme:**
  * Fundo pastel: `bg-emerald-100` ou `bg-emerald-50`
  * Texto: `text-emerald-800` ou `text-emerald-900`
* **Badges de Status em Dark Theme:**
  * Fundo suave: `bg-emerald-950/30`
  * Texto: `text-emerald-400` ou `text-emerald-300`

#### B. Tons Âmbar (Alerta - Amber)
* **Design de Sucesso:**
  * Fundo: `bg-amber-500`
  * Texto/Ícone: `text-white` ou `text-amber-950`
* **Badges de Status em Light Theme:**
  * Fundo pastel: `bg-amber-100` ou `bg-amber-50`
  * Texto: `text-amber-800` ou `text-amber-900`
* **Badges de Status em Dark Theme:**
  * Fundo suave: `bg-amber-950/30`
  * Texto: `text-amber-400` ou `text-amber-300`

#### C. Tons de Crise ou Crítico (Rose/Red)
* **Design de Sucesso:**
  * Fundo: `bg-rose-500`
  * Texto/Ícone: `text-white` ou `text-rose-950`
* **Badges de Status em Light Theme:**
  * Fundo pastel: `bg-rose-100` ou `bg-rose-50`
  * Texto: `text-rose-800` ou `text-rose-900`
* **Badges de Status em Dark Theme:**
  * Fundo suave: `bg-rose-950/30`
  * Texto: `text-rose-400` ou `text-rose-300`

---

### 4. Checklist de Validação Cromática
Antes de fechar qualquer edição de layout ou criar novas interfaces:
1. [ ] **Verificou o texto em botões com fundos coloridos?** Garantir que botões verdes tenham texto branco ou verde escuro profundo, nunca cinza médio ou preto.
2. [ ] **Verificou os badges e tags de siglas?** Certificar-se de que os textos das siglas herdem cores análogas de alto contraste em relação ao seu fundo específico.
3. [ ] **Evitou o cinza genérico sobre fundos de cor?** O "cinza sujo" (`text-slate-500` ou `text-slate-600`) nunca deve ser jogado em cima de fundos coloridos como verde ou âmbar. Se o fundo for colorido, use uma variação da própria cor de fundo (ex: `text-emerald-700` sobre `bg-emerald-50`).
4. [ ] **Verificou o Dark Mode?** Elementos brilhantes no modo escuro devem usar contraste invertido, mas mantendo a pureza cromática (ex: `bg-emerald-500` com `text-slate-950` pode ser substituído por `bg-emerald-500` com `text-emerald-950` ou `text-slate-900` de alta densidade).
