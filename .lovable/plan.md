
## Objetivo
Substituir a paleta verde atual do sistema pelas cores oficiais RE/MAX: azul `#003DA5` (primária), vermelho `#DC1C2E` (acento/destaque) e branco como base.

## Mudanças

### 1. `src/styles.css` — tokens globais (tema claro e escuro)
- `--primary` passa de verde (`oklch 0.58 0.16 152`) para azul RE/MAX (`oklch ~0.40 0.20 260` ≈ `#003DA5`).
- `--primary-glow` → azul mais claro para gradientes.
- `--ring` acompanha `--primary` (azul).
- `--accent` / `--accent-foreground` → tons claros de azul.
- `--success` continua verde (semântica de "sucesso" precisa ser verde, não confundir com marca).
- `--destructive` ajustado para o vermelho RE/MAX `#DC1C2E` (também serve como cor de destaque da marca).
- `--sidebar-primary` e `--sidebar-ring` → azul RE/MAX.
- `--gradient-hero` e `--shadow-elegant` regenerados a partir do novo azul.
- Variável nova `--brand-red` (oklch do `#DC1C2E`) + mapeamento em `@theme inline` como `--color-brand-red` para usar em badges/realces ("valor recomendado", faixas ACM).

### 2. `src/lib/branding-store.ts`
- `DEFAULT_BRANDING.brandColor` → `#003DA5` (azul).
- `DEFAULT_BRANDING.accentColor` → `#DC1C2E` (vermelho).
- Assim o slide ACM (que lê `--acm-brand` / `--acm-accent` inline) já sai com as cores RE/MAX por padrão para novos usuários. Quem já salvou branding mantém o que escolheu (pode resetar em Configurações).

### 3. Verificação rápida
- Conferir `src/routes/index.tsx`, `src/routes/auth.tsx`, `src/components/print-slides.tsx` e `src/components/app-sidebar.tsx`: como já usam tokens semânticos (`bg-primary`, `text-primary`, `--acm-brand`), a troca dos tokens propaga automaticamente. Só ajusto se restar alguma cor hardcoded verde.

## Fora do escopo
- Não troco o ícone `Radar` da sidebar pelo balão RE/MAX (é marca registrada; se quiser, peço o arquivo e troco depois).
- Não altero textos/nome do produto.
- Não mexo em lógica de busca, auth ou dados.
