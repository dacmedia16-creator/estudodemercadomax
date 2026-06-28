Renomear a marca "Radar Imobiliário" para "Estudo de Mercado" em toda a interface visível (sidebar, landing, auth, títulos de página, branding padrão do relatório ACM).

## Escopo
- `src/components/app-sidebar.tsx`: trocar "Radar Imobiliário" / "Pro" pelo novo nome.
- `src/routes/auth.tsx`, `src/routes/index.tsx`: atualizar logo/título visíveis.
- `src/lib/branding-store.ts`: `DEFAULT_BRANDING.brandName` passa a ser "Estudo de Mercado".
- Demais ocorrências textuais de "Radar Imobiliário Pro" na UI (rodapés, headers, meta tags do `__root.tsx`).

## Fora do escopo
- Não altero IDs internos, chaves de localStorage (`rip:*`, `radar.branding.v1`), nem nomes de variáveis/arquivos.
- Não mexo em lógica de busca, auth ou backend.
