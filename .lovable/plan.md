# Por que o último estudo veio vazio

Olhando o log de chamadas (`api_usage`) do estudo `7040b56b…` de 29/06 às 03:19, as 7 PLPs feitas (Zap, Chaves e OLX) voltaram todas com **HTTP 502** da GeckoAPI. Ou seja: a API intermediária estava com indisponibilidade momentânea — nenhum portal chegou a responder. O estudo de poucos minutos antes (02:49) rodou normal, então foi uma janela curta de instabilidade do upstream, não um bug do filtro.

Hoje o `study-runner` trata 502/503/504 como "portal vazio" e segue em frente, então quando os 3 portais caem juntos o estudo simplesmente fecha sem nada e sem aviso claro pro usuário.

## O que mudar

1. **Retry com backoff para erros transitórios do upstream**
   - Em `src/lib/gecko.functions.ts`, no `callGecko`, tratar `502/503/504` igual ao 429 já tratado: até 2 tentativas extras com backoff (1.5s, 3s) antes de devolver erro.
   - Isso resolve a maior parte das janelas curtas como a de 03:19 sem mexer no fluxo.

2. **Propagar "indisponibilidade do upstream" pro runner**
   - Em `src/lib/study-runner.ts`, distinguir `ok:false` com status 5xx de "portal vazio": marcar `portalIndisponivel` no funil em vez de `exhaustedThisQuery`, e adicionar linha clara em `funilBusca` ("Zap: GeckoAPI indisponível (502) — tentado 3x").
   - Não disparar retries internos extras (passos A/B sem filtros nativos) quando o erro for 5xx — não adianta afrouxar filtro se o upstream está fora.

3. **Aviso no `app/carregando` e no relatório quando todos os portais caem**
   - Em `src/routes/app.carregando.tsx`: se `result.comparaveis.length === 0` e o funil indicar todos portais com 5xx, mostrar toast vermelho "GeckoAPI indisponível agora. Tente novamente em alguns minutos." em vez de abrir o relatório vazio em silêncio.
   - No relatório, exibir um banner equivalente no topo quando o estudo foi salvo nesse estado, com botão "Rodar de novo" reaproveitando os mesmos parâmetros.

4. **Painel de Configurações: status do GeckoAPI**
   - Aproveitar o `geckoStatus` existente e adicionar um teste leve (1 PLP barata) que diga "GeckoAPI respondendo / com falhas" — ajuda o usuário a confirmar que é o upstream e não a conta dele.

## Técnico

- Sem mudança de schema. `api_usage` já guarda o `status`, dá pra detectar 5xx histórico no admin sem migração.
- Custo: o retry de 5xx adiciona no máximo 2 chamadas extras *somente* quando o upstream falha; chamadas com 5xx normalmente não consomem crédito GeckoAPI, mas vamos confirmar pela doc antes do merge.
- Sem mexer em filtros de similaridade, ACM, IA ou layout de PDF.

## Como validar

- Forçar `callGecko` a devolver 502 em ambiente local (mock) e confirmar:
  - 3 tentativas no `api_usage`.
  - Funil mostra "GeckoAPI indisponível".
  - Carregando exibe toast e não salva estudo vazio silenciosamente.
- Rodar um estudo real depois do merge e conferir que o caminho feliz segue idêntico (mesmas chamadas, mesmo custo).
