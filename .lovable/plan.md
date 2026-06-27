## Causa raiz

Na tabela, todos os anúncios da OLX aparecem com **250m² / 3 quartos / 4 vagas** porque o `study-runner` está **copiando os valores do imóvel do usuário** quando o PLP não traz área/quartos:

```ts
// src/lib/study-runner.ts (Layer "Mesmo prédio")
if (p.incomplete) {
  if (!p.areaUtil) p.areaUtil = input.areaUtil;   // ← vira 250
  if (!p.quartos) p.quartos  = input.quartos;     // ← vira 3
  p.aproximado = true;
}
```

A intenção era “mesmo condomínio costuma ter mesma planta”, mas o efeito real é **mascarar os dados reais dos anúncios** — inclusive `R$/m²` calculado fica errado.
A OLX PLP raramente devolve `useful_area`, então cai sempre nesse fallback.

## Correção

### 1. `src/lib/study-runner.ts` — remover o backfill silencioso
- Excluir o bloco que sobrescreve `areaUtil`/`quartos` do `p` com `input.*` no layer “Mesmo prédio”.
- Manter `incomplete` e `aproximado` apenas como sinalização — sem inventar números.
- Para itens “mesmo prédio” incompletos: tentar **enriquecer via PDP** (já temos `geckoPdp` + `enrichWithPdp`). Hoje o PDP só roda nos 3 primeiros e só se faltar `condominio`. Vamos:
  - Ampliar a condição de PDP para incluir `!p.areaUtil || !p.quartos || p.incomplete`.
  - Subir o limite de PDP de 3 → até 6 (apenas dos que estão visivelmente incompletos), para cobrir os “mesmo prédio”.
- Se o PDP ainda não trouxer área/quartos, deixar `0` (a UI já mostra `—`/oculta) em vez de chutar os valores do usuário.

### 2. `src/lib/gecko-adapter.ts` (`olxItemToProperty`) — endurecer parsing
- Adicionar mais chaves possíveis para área da OLX PLP: `size`, `square_meters`, `total_area_useful`, e fallback no `subtitle`.
- Não usar regex genérica `m²` em `desc` quando `desc` é só o título (evitar pegar “250m²” vindo do prompt de busca).

### 3. UI (`src/routes/app.relatorio.$id.tsx` + tabela comparativa)
- Quando `areaUtil === 0` (ou `incomplete`), mostrar `—` no “Área” e `—` no “R$/m²” em vez de exibir o valor herdado.
- Adicionar badge discreto **“Área não informada”** no título, se incompleto.

### 4. `study-engine` — proteger métricas
- Em `recomputeStudy`/`generateStudy`: filtrar itens com `areaUtil <= 0` ao calcular `precoMedioM2`, `avgArea` e ACM (já tem guardas parciais; garantir consistência).

## Resultado esperado
- Cada anúncio passa a refletir a área real retornada pelo portal/PDP.
- Quando o portal não devolve área, o card mostra `—` em vez de `250m²` falso.
- O preço médio e o R$/m² da tabela ficam corretos.
- Consumo de PDP sobe um pouco (até +3 chamadas) — vou avisar no funil de requisições.

Sem mudanças de design visual além do `—` e do badge.