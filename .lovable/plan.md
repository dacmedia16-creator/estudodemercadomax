Gerar uma versão do ícone RE/MAX sem o fundo azul-marinho (pin recortado, fundo transparente) e usar no header da landing, na sidebar do app e no favicon — onde hoje o ícone aparece como um quadradinho azul.

### Passos
1. Usar `imagegen--edit_image` no `src/assets/remax-icon.png` para remover o fundo navy, mantendo só o pin RE/MAX (vermelho/branco/azul) com `transparent_background: true`. Salvar como novo asset `remax-icon-transparent.png`.
2. Subir via `lovable-assets` e gerar pointer `src/assets/remax-icon-transparent.png.asset.json`.
3. Trocar o import nos pontos que usam o ícone:
   - `src/components/app-sidebar.tsx` — remover `rounded-lg object-cover`, deixar só a imagem.
   - `src/routes/index.tsx` (header da landing) — idem.
4. Manter o logo completo (com texto "Imóveis RE/MAX Única Escolha") inalterado na tela de login e nos PDFs — só o ícone vai para versão transparente.

### Observação
A versão atual com fundo navy permanece disponível em `remax-icon.png` caso queira voltar.
