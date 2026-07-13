# Tornar Viva Real fixo no motor de busca

Hoje o Zap Imóveis é o único portal "locked" (sempre ativo). Chaves na Mão, Viva Real e OLX são opcionais via toggle. A mudança promove o Viva Real a fixo, deixando só Chaves e OLX como opcionais.

## Mudanças

### 1. `src/routes/app.configuracoes.tsx`
- Remover estado `vivaOn`, `toggleViva` e a leitura de `localStorage.getItem("portal.vivareal")`.
- Na lista "Portais ativos", trocar a linha do Viva Real para `{ n: "Viva Real", on: true, locked: true, checked: true }` (mesmo formato do Zap).
- Manter a opção "Viva Real" no seletor de teste PDP/PLP — o diagnóstico continua funcionando.
- Opcional: garantir uma vez que `localStorage.portal.vivareal = "1"` para não deixar resquício de usuários que já haviam desligado antes.

### 2. `src/routes/app.novo-estudo.tsx`
- No `useEffect` de seed, remover o bloco que sincroniza `portal.vivareal` a partir do localStorage. Viva Real entra sempre na lista `portais` (assim como Zap já entra).
- Em `togglePortal`, remover a persistência de `portal.vivareal` no localStorage. (O toggle do wizard pode continuar existindo visualmente, mas sem estado global — ou, mais limpo: tratar Viva Real como sempre selecionado no passo 4, sem checkbox editável, igual ao Zap.)

### 3. `src/lib/study-runner.ts`
- Substituir `isVivaEnabled()` por `true` fixo (ou remover a função) em todos os pontos onde é consultada. Viva Real sempre participa do funil e do `retryTargets`.

## Fora de escopo
- Adapter e handler do Gecko para Viva Real permanecem inalterados.
- Toggles de Chaves na Mão e OLX continuam opcionais.

## Validação
- Abrir Configurações → confirmar Viva Real listado como "sempre ativo" (sem switch).
- Novo estudo → Viva Real aparece marcado e não editável no passo 4.
- Rodar um estudo e conferir no log/funil que Viva Real é consultado mesmo com `localStorage.portal.vivareal = "0"` legado.
