## Diagnóstico

Os logs do AI Gateway mostram que a chamada para o Gemini está **respondendo com sucesso (HTTP 200, ~550 tokens de saída)**, mas o card não renderiza o resultado. Causa provável: a saída estruturada (`experimental_output: Output.object(...)`) está chegando como `undefined` no servidor — o modelo retorna texto/markdown em vez de JSON puro, e o parse silencioso resulta em `res.data = { geradoEm }` sem os campos esperados (`resumo`, `faixaRecomendada`, etc.). O componente troca o placeholder por uma view "vazia" e parece não ter feito nada.

## Correção

### 1. `src/lib/ai-analysis.functions.ts`
- Trocar `Output.object` (parse silencioso, frágil com Gemini) por uma chamada `generateText` com instrução explícita de JSON + `response_format`-equivalente via prompt rígido e parse manual com `JSON.parse` resiliente (extrair primeiro `{...}` válido).
- Validar a saída com Zod antes de retornar; se faltar campo essencial, retornar `{ ok:false, error: "Resposta da IA inválida" }`.
- Incluir log no servidor com tamanho/preview do texto bruto para futuras depurações.
- Acrescentar fallback simples: se o modelo falhar em estruturar, calcular faixas a partir dos percentis (entrada=P25, ideal=mediana, teto=P75) e usar o texto livre como `resumo`.

### 2. `src/components/ai-analysis-card.tsx`
- Garantir que, em caso de resposta incompleta (`!res.data?.resumo`), exibir `toast.error` claro em vez de aplicar um `aiAnalysis` vazio.
- Adicionar `console.error` com `res.error` para facilitar diagnóstico.
- Validar `next.aiAnalysis` antes do `onChange` para não corromper o estudo salvo.

### 3. Verificação
- Rodar o botão no relatório, confirmar nos logs do gateway uma resposta nova e ver o card preenchido com resumo, faixas, riscos e recomendações.

## Detalhes técnicos
- O modelo segue `google/gemini-3-flash-preview` (já configurado).
- O `requireSupabaseAuth` continua envolvendo a função; sem mudanças em RLS ou banco.
- Sem alterações em rotas ou no schema do estudo (`aiAnalysis` permanece opcional).
