## Quando houver mais de 10 comparáveis, usar só os 10 de menor preço

Regra simples: depois de toda a busca/filtros atuais, se sobrarem **mais de 10 comparáveis**, ordenar por **preço total (R$) crescente** e **manter apenas os 10 mais baratos**. Todo o resto do motor (ACM, IA, médias, faixas, PDF) continua igual — só recebe uma lista menor.

### Mudanças

**1. `src/lib/study-runner.ts`**
- No fim do pipeline, logo antes de entregar os comparáveis para `study-engine`, aplicar:
  ```
  if (comparaveis.length > 10) {
    comparaveis = [...comparaveis].sort((a,b) => a.preco - b.preco).slice(0, 10);
    funil.push({ etapa: "Top 10 mais baratos (corte por preço)", total: 10 });
  }
  ```
- Isso garante que médias, mediana, percentis, ACM e IA já trabalhem sobre os 10 escolhidos — sem precisar mexer no motor.

**2. `CriteriosEditor` (`src/components/criterios-editor.tsx`)**
- Adicionar switch **"Limitar aos 10 mais baratos quando houver mais de 10"** (ligado por padrão), salvando em `overridesAplicados.top10Baratos`.
- Runner respeita a flag: se desligada, mantém a lista cheia.

**3. Funil de busca (UI + PDF)**
- A etapa "Top 10 mais baratos (corte por preço)" aparece naturalmente no painel de funil já existente, sem mudança de componente.

### Não vou mexer em
- `study-engine.ts`, scoring, ACM, IA, filtros de busca, fallbacks, geocoding, portais — nada disso muda.

### Resultado
- ≤10 comparáveis: comportamento atual, idêntico.
- >10 comparáveis: estudo passa a ser baseado nos 10 mais baratos; valor sugerido, médias e faixas refletem esse recorte automaticamente; usuário pode desligar a regra no editor de critérios para voltar ao comportamento antigo.