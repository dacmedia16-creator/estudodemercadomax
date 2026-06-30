# Plano: recuperar volume de comparáveis

Diagnóstico: as Ondas 1–3 adicionaram 3 filtros que, combinados, descartam imóveis demais — principalmente em bairros com pouca oferta.

## O que vou mexer

**`src/lib/study-engine.ts`**

1. **Score de confiança — não excluir mais por score baixo**
   - Hoje: imóveis com `confidenceScore < 30` são removidos do cálculo; `< 50` entra com peso 0.5.
   - Novo: nenhum imóvel é removido por confiança. Peso vira:
     - `>= 60` → peso 1.0
     - `30–59` → peso 0.75
     - `< 30` → peso 0.5 (entra, mas pesa menos)
   - O badge de confiança continua aparecendo na UI/PDF para transparência, só não elimina ninguém.

2. **Dedup semântica — só agrupar duplicatas óbvias**
   - Hoje: agrupa por área (±1 m²) + preço (±2%) + bairro → estava juntando imóveis parecidos mas distintos.
   - Novo: só agrupa quando **mesmo prédio/endereço + mesma área exata + preço ±1%**. Sem prédio identificado, não deduplica. Mantém `dedupCount` para os casos reais.

3. **Sanity de 15% sobre IA — afrouxar para 25%**
   - Hoje: se a IA diverge >15% da mediana×área, o motor sobrescreve.
   - Novo: tolerância sobe para 25% (a IA tem mais espaço quando a amostra é pequena ou dispersa). `iaSobrescrita` continua sinalizado no relatório quando dispara.

**`src/lib/study-runner.ts`**
- Sem mudança de busca/portais (o problema não é coleta, é o que o motor descarta depois).

**UI**
- Nenhuma mudança visual. Badges e capa/contracapa do PDF continuam.

## Resultado esperado

Mesma busca passa a manter ~20–40% mais comparáveis no estudo final, sem afrouxar os guardas de finalidade (venda/aluguel) nem de tipo (casa/apto) — esses continuam estritos.
