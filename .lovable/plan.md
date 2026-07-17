## Objetivo
Transformar `/app` de um redirect para uma página de Dashboard com resumo da atividade do corretor.

> Observação: esta tarefa já foi implementada no turno anterior (arquivos `src/routes/app.index.tsx` e `src/components/app-sidebar.tsx` atualizados). Se aprovar, o plano é revisar/reafirmar a implementação existente sem mudanças destrutivas.

## Arquivos alterados

### 1. `src/routes/app.index.tsx` (reescrever)
- Remover `beforeLoad`/`redirect`; definir `component: DashboardPage`.
- Carregar estudos via `useEffect` + `studyStore.all()`, com `loading`/`error` (toast) e estado vazio.
- Layout dentro de `mx-auto max-w-7xl px-6 py-8`, na ordem:
  - **A. Cabeçalho**: título "Início", subtítulo "Resumo dos seus estudos de mercado", botão "Novo estudo" (Link → `/app/novo-estudo`, ícone `FilePlus2`).
  - **B. 4 StatCards** (`grid-cols-2 md:grid-cols-4 gap-4`): Total, Últimos 30 dias, Bairros distintos, Cidades distintas.
  - **C. Grid 2 col** (`grid-cols-1 lg:grid-cols-2 gap-4`):
    - **C1**: `BarChart` recharts — 6 últimos meses, cor `oklch(0.58 0.16 152)`, altura 240, `ResponsiveContainer`, `CartesianGrid 3 3`, `Tooltip`.
    - **C2**: Top 6 bairros — lista com barra `bg-primary/70` proporcional, "bairro (cidade)" à esquerda, contagem à direita.
  - **D. Últimos estudos** (Card): 5 mais recentes, cada linha `Link` → `/app/relatorio/$id`, com tipo+bairro, `formatBRL(valorPretendido)`, data `dd/mm` muted, `Badge` de status (success/warning/primary).
  - **E. Atalhos** (`grid-cols-1 md:grid-cols-3 gap-4`): Novo estudo, Estudos salvos, Comparativos — ícone circular `bg-primary/10 text-primary`, hover `hover:border-primary/40 transition`.
- Estado vazio: Card único com CTA "Criar primeiro estudo".
- Loading: skeletons `animate-pulse bg-muted`.
- Subcomponentes locais: `StatCard`, `BarRow`, `ShortcutCard`.

### 2. `src/components/app-sidebar.tsx`
- Importar `LayoutDashboard` de `lucide-react`.
- Adicionar `{ title: "Início", url: "/app", icon: LayoutDashboard }` como **primeiro** item.

## Detalhes técnicos
- Meses agrupados por chave `YYYY-MM`, label `toLocaleString('pt-BR', { month: 'short' })`.
- 30 dias: `Date.now() - createdAt <= 30*24h`.
- Badge de status via `className` (tokens `success`, `warning`, `primary`).
- Somente Card, Button, Badge de shadcn; sem novos pacotes.
