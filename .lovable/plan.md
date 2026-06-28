## Diagnóstico

Não foi erro da API — foi como o estudo prioriza a camada **"Mesmo prédio"**.

Quando você marca um edifício (ex.: Cannes Campolim) com `priorizarEdificio`, o `study-runner.ts` faz isto (linhas 709-711):

```
if (priorizarEdificio && condoMatches.length >= 1) {
  chosen = condoMatches;   // <-- usa TODOS os imóveis do prédio
}
```

Ou seja, **qualquer apartamento do mesmo condomínio entra no resultado**, mesmo que tenha 1 dormitório e 45 m² — porque o condomínio Cannes Campolim tem várias tipologias (1 dorm/45 m², 3 dorm/103 m² etc.). O filtro de quartos/área só é aplicado nas camadas de bairro/cidade, não nas âncoras de prédio/endereço.

O mesmo vale para a Camada 2 ("Mesmo endereço") quando ela dispara.

## O que vou ajustar

### 1. Filtro de tipologia também nas âncoras (prédio + endereço)
Em `src/lib/study-runner.ts`, aplicar nas camadas 1 e 2 os mesmos limites de **quartos** (±1) e **área útil** (±25%) que já existem no filtro estrito. Imóveis sem dado de quartos/área seguem passando (são enriquecidos via PDP).

### 2. Enriquecimento PDP antes do filtro nas âncoras
Hoje os itens incompletos do mesmo prédio ficam com badge "Aproximado" e área "—". Vou rodar PDP nos top N (até 6) **antes** de aplicar o filtro de tipologia, para não descartar bons matches por falta de dado.

### 3. Funil mais transparente
Novas linhas:
- `Mesmo prédio: removidos por quartos (3) ou área (105-175 m²)` — total
- `Mesmo endereço: removidos por quartos/área` — total

Assim você enxerga quantos foram cortados e por quê.

### 4. Controle opcional no painel "Critérios da busca"
Adicionar um toggle **"Aplicar critérios de quartos/área no mesmo prédio"** (ligado por padrão) em `src/components/criterios-editor.tsx`. Se você quiser ver TODAS as unidades do prédio (caso raro de comparativo de tipologias), desliga o toggle e refaz o estudo.

### 5. Sem mexer na busca em si
A pipeline (PLP → PDP → camadas) continua igual; só muda o filtro local nas âncoras. Nenhum crédito extra de API é gasto, salvo os PDPs do passo 2 (que já são limitados a 6).

## Arquivos afetados

- `src/lib/study-runner.ts` — aplicar filtros nas camadas `condominio` e `endereco`, novas entradas no `funilBusca`, enriquecimento PDP das âncoras.
- `src/lib/study-types.ts` — novo campo opcional `filtrarAncoras?: boolean` em `SearchOverrides`.
- `src/components/criterios-editor.tsx` — toggle "Aplicar critérios no mesmo prédio".

## Resultado esperado

Para seu caso (3 dorm / 3 suítes / 140 m² no Cannes Campolim):
- As 4 unidades de 45-103 m² / 1 qto seriam descartadas com a etiqueta `Mesmo prédio: removidos por quartos/área`.
- Restariam só as unidades do prédio compatíveis; se < 4, o sistema cai naturalmente nas camadas de endereço/bairro como hoje.