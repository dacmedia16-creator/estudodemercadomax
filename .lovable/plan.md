# Busca livre estilo Google para estudos

## Objetivo

Adicionar uma barra de pesquisa única onde o usuário digita uma descrição em linguagem natural (ex.: "apartamento 3 quartos 2 vagas Água Verde Curitiba até 700 mil com piscina") e o sistema entende, busca na GeckoAPI e gera o estudo — sem precisar preencher o formulário de 4 etapas.

## UX

- **Onde aparece:** novo bloco no topo de `/app` (dashboard) e no topo de `/app/novo-estudo`, com tabs **"Busca rápida"** (novo padrão) e **"Formulário detalhado"** (fluxo atual preservado).
- **Componente:** input grande com ícone de lupa, placeholder com exemplo rotativo, botão "Analisar". Abaixo, chips clicáveis com exemplos prontos ("apto 2q Batel aluguel", "casa 3 suítes Santa Felicidade até 1.2mi").
- **Feedback antes de rodar:** ao submeter, mostra um card "Entendi assim:" com os campos extraídos (tipo, finalidade, cidade, bairro, quartos, faixa de preço, diferenciais) e dois botões: **Confirmar e analisar** / **Ajustar campos** (abre o formulário pré-preenchido na etapa 1). Isso evita gastar créditos numa interpretação errada.

## Como interpretar o texto

Pipeline em duas camadas, na ordem:

1. **Parser local (grátis, instantâneo)** em `src/lib/query-parser.ts`:
   - Regex/heurísticas para: quartos (`3q`, `3 quartos`, `três quartos`), suítes, vagas, banheiros, área (`80m2`, `80 m²`), preço (`700k`, `R$ 700.000`, `até 1.2mi`, `entre 500 e 800 mil`), finalidade (palavras "aluguel/locação" vs "venda/comprar"), tipo (apartamento/casa/cobertura/studio/kitnet/sobrado/sala/terreno), diferenciais (piscina, academia, churrasqueira, varanda, mobiliado, pet, etc).
   - Cidade/estado/bairro: lista local de cidades+UF do Brasil (compacta, ~500 maiores) + heurística "após `em` ou `no/na`". Se identificar CEP, chama ViaCEP (já temos).
   - Cobre 70-80% dos casos sem chamar IA.

2. **Fallback IA (Lovable AI Gateway)** quando o parser local não conseguir tipo+cidade+(quartos OU área OU preço):
   - `createServerFn` `parseQuery` em `src/lib/query-parser.functions.ts` usando `generateText` + `Output.object` com schema enxuto (mesmo shape do `StudyInput`).
   - Modelo: `google/gemini-3-flash-preview` (barato e rápido).
   - Prompt curto pedindo extração estrita; campos não identificados ficam `null` e a UI pede pra completar.

A keyword final da GeckoAPI vira `"{tipo} {bairro}"` (igual hoje) — o texto livre só alimenta a extração, não vai cru pra API.

## Reaproveitamento

- Resultado do parser é convertido pra `StudyInput` existente e passa por **exatamente o mesmo `study-runner`** (PLP+PDP, camadas edifício/endereço/bairro, pós-filtro). Zero mudança no pipeline de busca.
- Painel "Ajustar critérios" no relatório continua funcionando igual.

## Arquivos

- `src/lib/query-parser.ts` — parser local (regex + dicionários).
- `src/lib/query-parser.functions.ts` — server fn de fallback IA.
- `src/lib/ai-gateway.server.ts` — provider helper Lovable AI (se ainda não existe).
- `src/components/busca-rapida.tsx` — input + chips + card "Entendi assim".
- `src/routes/app.index.tsx` e `src/routes/app.novo-estudo.tsx` — montam o componente + tabs.
- `src/routes/app.carregando.tsx` — sem mudança (recebe o `StudyInput` via sessionStorage como hoje).

## Custos

- Parser local: grátis.
- Fallback IA: ~1 chamada Gemini Flash por busca quando o parser falha (texto curto, custo desprezível em créditos Lovable AI).
- GeckoAPI: mesmo consumo do fluxo atual — o card de confirmação evita queimar créditos em interpretação errada.

## Fora de escopo

- Autocomplete enquanto digita (poderia ser próximo passo).
- Histórico de buscas livres (já temos histórico de estudos).
- Busca semântica em estudos salvos.
