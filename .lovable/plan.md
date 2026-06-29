## Adicionar logo da RE/MAX Única Escolha no site e nos PDFs

### Assets
- Subir os dois logos como Lovable Assets:
  - `src/assets/remax-icon.png.asset.json` (logo só ícone — pin RE/MAX) — usado em header/sidebar/favicon.
  - `src/assets/remax-full.png.asset.json` (logo completo "Imóveis RE/MAX Única Escolha CRECI: 29886-J") — usado na landing e nos PDFs.

### Onde aplicar no site
- **Sidebar do app** (`src/components/app-sidebar.tsx`): substituir o ícone `<Radar />` pelo logo ícone RE/MAX.
- **Header do app** (`src/routes/app.tsx`): trocar o texto "Estudo de Mercado Pro" por uma versão menor do logo completo.
- **Landing** (`src/routes/index.tsx`): logo completo no topo (nav) e versão ícone no footer.
- **Auth** (`src/routes/auth.tsx`): logo completo acima do formulário.
- **Favicon / OG image** (`src/routes/__root.tsx`): apontar para o logo ícone.

### Onde aplicar nos arquivos gerados (PDFs)
- **Branding store** (`src/lib/branding-store.ts`): definir `logoUrl` default = URL do logo completo RE/MAX (hoje vem `undefined`, então o ACM mostra placeholder).
- **PDFs** (`src/components/print-slides.tsx`): garantir que as 3 páginas (ACM landscape, Argumentos ao proprietário, Carta ao proprietário) renderizam `branding.logoUrl` no cabeçalho. Hoje o ACM já usa; confirmar que páginas 2 e 3 também exibem.
- **Configurações** (`src/routes/app.configuracoes.tsx`): manter o upload manual (corretor pode trocar pelo seu próprio logo); só mudar o default.

### Observação
O logo já vem com fundo azul-marinho (não tem versão transparente). Vou usar como está; em fundo branco do PDF ele aparecerá como um card azul — fica coerente com a identidade RE/MAX. Se preferir versão recortada/transparente, me avise que gero uma variante editada antes de aplicar.
