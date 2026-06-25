## Objetivo
Mudar a ordem de prioridade da busca para: **1) nome do condomínio → 2) endereço (rua) → 3) bairro → 4) expansões automáticas**. Hoje pula direto do condomínio para o bairro.

## Mudanças

### 1. `src/lib/study-runner.ts`
- Após a Layer 0 (edifício) e antes da PLP principal do bairro, adicionar **Layer 0.5 — Endereço**:
  - Só executa se `input.endereco` tiver conteúdo significativo (>= 4 chars depois de strip).
  - Keyword: `"{endereco} {bairro}"` (sem número — número costuma poluir a busca da Gecko; mantemos só pra matching local).
  - Usa `fetchPlpPages` com o mesmo `maxPages`, mesmo `propertyType` e `businessType`.
  - Filtra resultados localmente por `matchEndereco(p, endereco, numero?)` — normaliza, remove stopwords (`rua`, `avenida`, `av`, `r`, `travessa`, `alameda`) e exige que todos os tokens significativos apareçam em `titulo + descricao + endereco` do imóvel. Se `numero` for fornecido, dá um bônus mas não é obrigatório (Gecko raramente expõe número).
  - Marca esses imóveis como "mesmo endereço" via novo flag `mesmoEndereco?: boolean` em `ComparableProperty` e novo `Set<string>` `mesmoEnderecoIds`.
  - Adiciona ao `funilBusca`: `"Mesmo endereço (N pág.)": X`.

- Atualizar a lógica de seleção:
  - Se `condoMatches.length >= 3` → usa só condomínio (como hoje).
  - Senão se `enderecoMatches.length >= 3` **e não temos âncoras de condomínio suficientes** → usa só endereço + âncoras de condomínio na frente.
  - Senão → fluxo atual de camadas do bairro, com âncoras de condomínio **e** de endereço prefixadas (deduped, na ordem: condo → endereço → bairro).

### 2. `src/lib/study-types.ts`
- Adicionar `mesmoEndereco?: boolean` em `ComparableProperty`.

### 3. `src/routes/app.relatorio.$id.tsx`
- Tabela de comparáveis: adicionar badge **"Mesmo endereço"** (cor secundária diferente do "Mesmo prédio") quando `c.mesmoEndereco === true`.

### 4. `src/components/criterios-editor.tsx` — sem nova UI obrigatória
- A camada de endereço usa `input.endereco` automaticamente. Não adicionar novo campo agora; se o usuário quiser desativar, basta limpar o endereço no formulário do estudo (mudança fora de escopo deste pedido).

## Detalhes técnicos
- `matchEndereco` reaproveita `normalizeText` (já existe).
- Stopwords de endereço: `["rua", "r", "avenida", "av", "travessa", "tv", "alameda", "al", "estrada", "rodovia", "praca", "praça"]`.
- Diagnóstico no relatório passa a mencionar quantos comparáveis vieram do condomínio E quantos vieram do endereço (prefixo no `result.diagnostico`).

## Fora de escopo
- Não muda a UI do formulário de novo estudo.
- Não adiciona controle para desligar/ligar a camada de endereço (default sempre ativo se houver endereço).
