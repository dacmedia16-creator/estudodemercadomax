# Usar diferenciais como filtro real na busca

## Situação atual
Os diferenciais marcados no formulário (Piscina, Academia, Churrasqueira, Portaria 24h, etc.) **não são enviados** para o Zap PLP. Eles só são usados depois:
- **Soft** → somam pontos na similaridade.
- **Hard** → exigem que ≥50% dos diferenciais estejam presentes no anúncio retornado.
- **Ignore** → não fazem nada.

Isso desperdiça oportunidade: o Zap aceita `amenities` no PLP e poderia filtrar na fonte, trazendo comparáveis mais aderentes sem gastar requisições extras.

## O que vou mudar

### 1. Mapeamento dos diferenciais para o vocabulário do Zap
Criar `mapDiferenciaisToZapAmenities()` em `src/lib/gecko-adapter.ts` traduzindo os rótulos da UI para os códigos aceitos pela API (ex.: "Piscina" → `POOL`, "Academia" → `GYM`, "Churrasqueira" → `BARBECUE_GRILL`, "Portaria 24h" → `GATED_COMMUNITY`/`CONCIERGE_24H`, "Sacada" → `BALCONY`, "Elevador" → `ELEVATOR`, "Mobiliado" → `FURNISHED`, etc.). Rótulos sem equivalente (ex.: "Vista livre", "Próximo ao metrô") continuam apenas no scoring local.

### 2. Envio condicional para o Zap PLP
Em `src/lib/study-runner.ts`, ao montar o payload PLP do Zap:
- Se o modo do campo `diferenciais` for **hard** → enviar `amenities` com **todos** os mapeados (filtro estrito na fonte).
- Se for **soft** → enviar só os 2–3 diferenciais mais "decisivos" (Piscina, Academia, Mobiliado) quando o usuário marcou ≥3 itens, para guiar a busca sem ser restritivo demais. Configurável.
- Se for **ignore** → não enviar.
- OLX e Chaves: não enviar (o adapter deles não usa `amenities`); seguem só com filtragem local.

### 3. Fallback automático quando o filtro nativo zera resultados
Se uma camada (prédio/endereço/bairro) voltar vazia **com** `amenities` enviado, refazer a mesma camada **sem** `amenities` e aplicar o filtro localmente. Isso evita perder comparáveis quando o anúncio simplesmente não declara as amenities no Zap.

### 4. Filtro local mais tolerante para o modo Hard
Hoje exigimos ≥50% dos diferenciais. Problema: muitos anúncios não preenchem a lista completa. Mudar para:
- Exigir só os diferenciais **estruturais** marcados como Hard (Piscina, Academia, Churrasqueira, Mobiliado, Portaria 24h, Elevador).
- Ignorar diferenciais "subjetivos" no Hard (Vista livre, Próximo ao metrô/escolas, Reformado, Novo) — esses só pontuam no Soft.

### 5. Visibilidade no funil e no relatório
- Adicionar linha no funil: `"Zap PLP com amenities: [Piscina, Academia] → X resultados"` e, se houver fallback, `"Fallback sem amenities: +Y resultados"`.
- No bloco "Critérios da busca" do relatório, listar quais diferenciais foram enviados nativamente vs. aplicados só localmente.

### 6. Editor de critérios
No `CriteriosEditor`, mostrar os diferenciais com seus modos (Ignorar/Soft/Hard) e permitir reexecutar o estudo alterando isso.

## Arquivos afetados
- `src/lib/gecko-adapter.ts` — novo `mapDiferenciaisToZapAmenities`.
- `src/lib/study-runner.ts` — envio condicional, fallback, filtro local revisado, log no funil.
- `src/components/criterios-editor.tsx` — exibir e editar modos dos diferenciais.
- `src/routes/app.relatorio.$id.tsx` — exibir no bloco de critérios.

## Fora do escopo
- Não muda o consumo de créditos (mesma quantidade de chamadas, no pior caso +1 fallback por camada vazia).
- Não muda OLX nem Chaves na Mão (mantêm filtragem só local).
- Não altera o scoring de similaridade pós-busca (Soft continua funcionando como hoje).
