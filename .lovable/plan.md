# Otimizar busca GeckoAPI: menos crédito + mais imóveis

## Diagnóstico

Hoje cada estudo gasta até **9 PLP + 6 PDP = 15 requisições**. Dois problemas combinados:

1. **PLP devolve pouco** porque mandamos filtros estruturados (`bedrooms`, `priceMin/Max`, `areaMin/Max`) — o Zap corta no servidor antes da gente filtrar localmente.
2. **PLP gasta demais** porque rodamos 3 camadas (edifício + endereço + bairro) × 3 páginas + 6 PDPs, sempre, mesmo quando a página 1 já basta.

## Solução: pipeline adaptativo (sem novos controles na UI)

### Mudança 1 — PLP ampla, filtro local

Em `src/lib/study-runner.ts`, parar de enviar filtros estruturados na PLP. Manter só `city`, `state`, `businessType`, `propertyType`, `keyword`, `page`. Todo o filtro de quartos/área/preço passa a acontecer **localmente** (já fazemos isso nas camadas `strict → expandida`). Resultado: cada página devolve 20–30 anúncios em vez de 2–5.

### Mudança 2 — Parada antecipada por suficiência

Introduzir um alvo `TARGET_COMPARABLES = 8`. Após cada página de cada camada, normalizar + aplicar filtro estrito e checar:

- Se já temos `≥ TARGET` comparáveis estritos → **parar** (não busca próxima página nem próxima camada).
- Se temos `≥ 4` e estamos na página 2+ → parar a camada atual, ir pra próxima só se faltar âncora de edifício/endereço.
- Página vazia → parar a camada (já existe).

### Mudança 3 — Camadas sob demanda

Ordem nova das camadas, executadas **uma de cada vez** até atingir alvo:

```text
1. Edifício (se preenchido) — 1 página primeiro; só pagina 2/3 se a 1 trouxe match e ainda falta âncora
2. Endereço (se preenchido) — mesma regra
3. Bairro — 1 página; pagina 2/3 só se filtro estrito local não atingiu TARGET
```

Camadas 1 e 2 **não rodam** se já temos âncoras suficientes da anterior. Hoje rodam sempre em sequência.

### Mudança 4 — PDP sob demanda

Reduzir PDP de **6 fixos → até 3**, e só dispara em comparáveis cujo `condominio === 0` E que estão no top 3 do ranking de similaridade. Se a PLP já trouxe condomínio/área completos, **zero PDP**. Estudo típico passa a usar 0–3 PDP em vez de 6.

### Mudança 5 — Contador de requisições no relatório

Adicionar ao `funilBusca` uma linha final **"Requisições GeckoAPI: X PLP + Y PDP = Z"**, calculada no runner. Sem nova UI — aparece no bloco "Critérios da busca" que já existe.

## Resultado esperado

| Cenário | Hoje | Depois |
|---|---|---|
| Estudo simples (só bairro, página 1 já basta) | ~7 req | **1–2 req** |
| Estudo médio (bairro, precisa 2 páginas) | ~9 req | **2–4 req** |
| Estudo completo (edifício+endereço+bairro, dados ruins) | 15 req | **6–8 req** |
| Comparáveis típicos por estudo | 4–8 | **10–15** |

Redução média estimada: **60–70% de crédito** + ~2× mais comparáveis no relatório (porque a PLP ampla devolve mais anúncios pra filtragem local escolher).

## Arquivos alterados

- `src/lib/study-runner.ts` — toda a lógica de camadas, parada antecipada, PLP sem filtros estruturados, contador.
- `src/routes/app.relatorio.$id.tsx` — exibir a linha "Requisições GeckoAPI" no funil (renderização já genérica).

## Fora de escopo

- Sem novos toggles no painel "Ajustar critérios" (você pediu automático).
- Sem cache entre reexecuções (próximo passo se ainda assim ficar caro).
- Sem mudança em `gecko.functions.ts` nem na UI do formulário.
