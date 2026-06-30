# Buscar em bairros próximos (opcional)

Hoje, quando o imóvel está num bairro pequeno/específico, a busca trava no filtro de bairro e devolve zero. Vou adicionar um controle opcional no formulário para expandir a busca para bairros vizinhos — sem alterar o comportamento padrão de quem não marcar nada.

## O que muda na UI (Passo 1 — Dados básicos)

Logo abaixo do campo "Bairro principal", adicionar um bloco "Expandir busca":

- **Toggle "Buscar também em bairros próximos"** (default: desligado)
- Quando ligado, mostra:
  - **Sugestões automáticas** (chips clicáveis): assim que o CEP/bairro for preenchido, busca bairros vizinhos via Nominatim (raio ~2km do centroide do bairro) e oferece como chips para o usuário aceitar/remover
  - **Campo livre** para adicionar bairros manualmente (input com Enter / vírgula)
  - **Lista dos selecionados** como tags removíveis

Os bairros escolhidos alimentam o campo `bairrosProximos` (já existe em `StudyInput`, só está vazio por padrão hoje).

## O que muda na lógica de busca

- `study-runner.ts`: quando `bairrosProximos.length > 0`, depois da camada "bairro principal", roda uma camada extra **"Bairros próximos"** iterando cada vizinho como keyword/filtro de bairro, com a mesma deduplicação e os mesmos guards (cidade, finalidade, tipo, sanity de preço) já existentes.
- Mantém a cascata atual: Edifício → Endereço → Bairro → **Bairros próximos (novo, opcional)** → Raio geográfico.
- Cada comparável trazido pela camada nova recebe a flag visual **"Bairro vizinho"** (badge no card e na tabela), pra ficar transparente no relatório que não é do bairro do imóvel.
- O funil de busca (`funilBusca`) ganha a etapa "Bairros próximos: N" quando ativada.

## CriteriosEditor (ajuste pós-estudo)

Adicionar o mesmo controle no `CriteriosEditor`, para o usuário ligar "bairros próximos" e re-rodar sem refazer o formulário. Os chips sugeridos vêm das mesmas fontes (Nominatim + manual).

## Arquivos afetados

- `src/routes/app.novo-estudo.tsx` — novo bloco no Passo 1, estado + handlers, chamada Nominatim para sugestões
- `src/components/criterios-editor.tsx` — espelhar o controle
- `src/lib/study-runner.ts` — nova camada "Bairros próximos" + badge `bairroVizinho`
- `src/lib/study-types.ts` — adicionar `bairroVizinho?: boolean` em `ComparableProperty`
- `src/routes/app.relatorio.$id.tsx` — badge "Bairro vizinho" nos cards/tabela
- (opcional) `src/lib/geocode.functions.ts` — server fn `suggestNearbyNeighborhoods(cidade, bairro)` usando Nominatim para evitar CORS

## O que NÃO muda

- Comportamento default: quem não ligar o toggle continua com a busca atual.
- Nenhuma mudança no ACM, IA, PDF ou cálculo de valor sugerido.
- Sem custo extra de GeckoAPI quando o toggle está desligado.
