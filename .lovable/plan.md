Ocultar a aba "Busca rápida" em `/app/novo-estudo`:

- Em `src/routes/app.novo-estudo.tsx`, remover o `TabsTrigger value="rapida"` e o `TabsContent value="rapida"` (que renderiza `<BuscaRapida />`).
- Definir a aba "Formulário" como única/ativa por padrão e ajustar o grid das tabs para 1 coluna (ou remover a TabsList se sobrar só uma).
- Manter `src/components/busca-rapida.tsx` no projeto (sem uso), para reativar fácil depois.

Sem mudanças de lógica de busca.