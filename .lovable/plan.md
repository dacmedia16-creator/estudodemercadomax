## Objetivo
Transformar `/app` de um redirect para uma página de Dashboard com resumo da atividade do corretor.

## Arquivos alterados

### 1. `src/routes/app.index.tsx` (reescrever)
- Remover `beforeLoad`/`redirect`; definir `component: DashboardPage`.
- Carregar estudos via `useEffect` + `studyStore.all()`, com `loading`/`error` (toast) e estado vazio.
- Layout dentro de `mx-auto max-w-7xl px-6 py-8`, na ordem:
  - **A. Cabeçalho**: título "Início" (h1), subtítulo "Resumo dos seus estudos de mercado", botão "Novo estudo" (Link → `/app/novo-estudo`, ícone `FilePlus2`).
  - **B. 4 StatCards** (`grid-cols-2 md:grid-cols-4 gap-4`): Total, Últimos 30 dias, Bairros distintos, Cidades distintas. Rótulo `text-muted-foreground`, número `text-3xl font-bold`.
  - **C. Grid 2 col** (`grid-cols-1 lg:grid-cols-2 gap-4`):
    - **C1**: `BarChart` recharts — estudos por mês (últimos 6 meses, rótulo curto pt-BR), barras `oklch(0.58 0.16 152)`, altura 240, `ResponsiveContainer`, `CartesianGrid 3 3`, `Tooltip`.
    - **C2**: Top 6 bairros — lista `BarRow` local, nome+cidade à esquerda, barra `bg-primary/70` proporcional (width = count/max), contagem à direita.
  - **D. Últimos estudos** (Card): título + Link "Ver todos" → `/app/estudos`. Até 5 mais recentes; cada linha é `Link` para `/app/relatorio/$id` com tipo + bairro, `formatBRL(valorPretendido)`, data curta `dd/mm` em muted, `Badge` de status (success/warning/primary conforme mapeamento).
  - **E. Atalhos** (`grid-cols-1 md:grid-cols-3 gap-4`): cards `Link` com ícone circular `bg-primary/10 text-primary` — Novo estudo (`FilePlus2`), Estudos salvos (`FolderOpen`), Comparativos (`BarChart3`). Hover `hover:border-primary/40 transition`.
- Estado vazio: se `studies.length === 0`, renderizar Card único com CTA "Criar primeiro estudo" → `/app/novo-estudo` (mantendo cabeçalho).
- Loading: skeletons simples (divs `animate-pulse bg-muted`) nos slots dos 4 stats e do bloco principal.
- Subcomponentes locais: `StatCard`, `BarRow`.

### 2. `src/components/app-sidebar.tsx`
- Importar `LayoutDashboard` de `lucide-react`.
- Adicionar `{ title: "Início", url: "/app", icon: LayoutDashboard }` como **primeiro** item de `items`.
- Ajuste do `isActive` já funciona (compara `pathname === url`); nenhuma outra mudança.

## Detalhes técnicos
- Agrupamento por mês: chave `YYYY-MM` a partir de `new Date(createdAt)`, gerar array dos últimos 6 meses (inclusive meses zerados) com label `toLocaleString('pt-BR', { month: 'short' })`.
- Últimos 30 dias: `Date.now() - createdAt <= 30*24h`.
- Mapeamento de Badge: Abaixo → variant custom com classes `bg-success/15 text-success border-success/30`; Acima → `bg-warning/15 text-warning border-warning/30`; Dentro → `bg-primary/15 text-primary border-primary/30` (Badge shadcn aceita `className`).
- Sem novos pacotes; recharts já instalado. Somente Card, Button, Badge de shadcn.
- Tokens existentes apenas — sem gradientes nem cores novas.
