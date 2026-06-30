# Por que quase todos os comparáveis vêm do OLX

## Diagnóstico

Dos últimos 10 estudos, a distribuição de comparáveis foi:

| Estudo (cidade) | Zap | Chaves | OLX | Total |
|---|---|---|---|---|
| Votorantim 30/06 02:42 | 0 | 0 | 10 | 10 |
| Votorantim 30/06 02:37 | 0 | 0 | 2 | 2 |
| Votorantim 30/06 02:31 | 0 | 0 | 2 | 2 |
| Sorocaba 30/06 02:22 | 0 | 0 | 8 | 8 |
| Sorocaba 30/06 01:31 | 0 | 0 | 6 | 6 |
| Sorocaba 30/06 01:27 | 0 | 0 | 3 | 3 |
| Sorocaba 29/06 15:42 | 2 | 0 | 8 | 10 |
| Sorocaba 29/06 15:23 | 2 | 6 | 1 | 9 |

**Não é normal.** Os três portais foram chamados (todos respondem 200 em `api_usage`), mas Zap e Chaves voltam praticamente vazios depois dos filtros.

Causa principal (lendo `src/lib/study-runner.ts` + `gecko.functions.ts`):

1. **Zap recebe filtros nativos rígidos** — `bedrooms`, `priceMin/Max`, `areaMin/Max`, `amenities` (diferenciais), `latitude/longitude` + `radius` (2 km por default). Quando o imóvel é nicho (área grande, muitos diferenciais), o PLP do Zap retorna 0 ou pouquíssimos itens. Existe um “Passe A/B” de retry sem filtros, mas ele só dispara em condições específicas e não está cobrindo todos os casos.
2. **Chaves só roda em camadas de bairro** — o código pula Chaves nas camadas “Mesmo prédio” e “Mesmo endereço” porque a API não aceita `keyword`. Então quando o estudo encerra cedo nas camadas de keyword (ou só essas voltam algo), Chaves fica zerada.
3. **OLX é chamado quase sem filtros** — só `keyword`, `priceMin/Max` e `categoryPath`. Sem `bedrooms`, sem `area`, sem `amenities`, sem `radius`. Resultado: vem muita coisa, a filtragem local sobrevive a vários itens, e o OLX domina.
4. **Camada de “Mesmo prédio” por keyword (`edificio`) tende a 0 no Zap** porque o keyword exato bate em poucos anúncios — mas as camadas seguintes de bairro/raio com filtros nativos rígidos também não compensam.

Resumindo: o desequilíbrio é um artefato de configuração de filtros, **não** de cobertura real dos portais. Zap e Chaves têm acervo grande nas cidades testadas; estão sendo cortados na origem.

## Proposta de correções

Apenas em `src/lib/study-runner.ts` e `src/lib/gecko.functions.ts` — sem mexer em UI, IA ou auth.

1. **Afrouxar filtros nativos do Zap/Chaves por default**
   - Mandar `priceMin/Max` só quando o usuário explicitamente apertou no editor de critérios. Hoje é ±30% automático, o que sozinho já corta muito imóvel.
   - Mandar `amenities` para o Zap **apenas** se o modo do campo `diferenciais` for `prefer` ou `hard`. Em `soft` (default), retirar — diferenciais entram só no score de similaridade.
   - Mandar `bedrooms` como faixa `[q-1, q, q+1]` em vez de valor único (Chaves já usa só o primeiro — mantemos).

2. **Retry simétrico ao OLX nas camadas finais**
   - Se a camada de bairro/raio voltou `< 3` itens no Zap, refazer a chamada do Zap **só com `city + propertyType + keyword`** (igual ao patamar mínimo do OLX). Hoje esse fallback só dispara quando o retorno é exatamente 0.
   - Mesma regra para Chaves usando `city + neighborhood + propertyTypes`.

3. **Permitir Chaves nas camadas de endereço/edifício via `neighborhood`**
   - Quando `priorizarEdificio` está ligado, em vez de pular Chaves, rodar Chaves com `neighborhood = bairro` + filtros nativos. Não traz "mesmo prédio", mas alimenta a base do bairro e equilibra o mix.

4. **Logar “motivo de descarte” por portal no `funil`**
   - Para cada camada, somar quantos itens cada portal devolveu **antes** dos filtros locais e quantos sobraram **depois**. Hoje o `perPortal` já guarda `recebidos/aproveitados/descartados`, mas não está sendo escrito no `funilBusca` final — precisa virar linha visível no funil.

5. **Limite de domínio por portal**
   - No final, se um único portal tem `> 70%` dos comparáveis e há `< 8` no total, rodar **um** passe adicional nos outros portais sem `amenities`, sem `radius` e com `bedrooms ±1`, para tentar equilibrar. Aborta se não trouxer nada novo.

Impacto esperado: Zap e Chaves passam a aparecer consistentemente no mix, sem perder a precisão (os filtros locais — tipo, área, finalidade, cidade, sanity de preço) continuam blindando o resultado contra ruído.

## Detalhes técnicos

- `src/lib/study-runner.ts` — ajustar `adaptivePaginate()` para (i) montar `portalParams` por camada respeitando `fieldModes.diferenciais`, (ii) acionar retry “mínimo” quando o portal devolveu `< 3` itens, (iii) escrever as métricas de `perPortal` no `funilBusca`, (iv) rodar o passe de rebalanceamento ao final quando um portal domina.
- `src/lib/gecko.functions.ts` — sem mudança de schema; o suporte a `bedrooms` array já existe.
- Sem mudança no adapter, na IA, no PDF nem na UI principal — só o card de funil já existente vai mostrar mais linhas.
