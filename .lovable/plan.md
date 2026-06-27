Ocultar o painel "Como usar esses campos na busca" no step 2 de `/app/novo-estudo`:

- Em `src/routes/app.novo-estudo.tsx`, remover o bloco `<div className="rounded-xl border border-border bg-muted/30 p-4">...</div>` (linhas ~285-315) que renderiza o seletor de modos (Ignorar/Preferência/Obrigatório) por campo.
- Manter o estado `fieldModes` com os defaults (`DEFAULT_FIELD_MODES`) intacto, para a busca continuar usando os modos padrão sem mudança de lógica.
- Remover imports não usados (`FIELD_KEYS`, `FIELD_LABELS`) se ficarem órfãos.