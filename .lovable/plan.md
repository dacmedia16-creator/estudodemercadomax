# Tornar todos os 4 portais fixos, com falha isolada por portal

Todos os portais integrados (Zap, Viva Real, Chaves na Mão, OLX) passam a rodar sempre em todas as buscas. Se algum deles falhar, é ignorado e a busca continua com os outros — sem quebrar o estudo.

## Boa notícia sobre a "falha isolada"

O `study-runner.ts` **já isola falhas por portal**: cada chamada `geckoPlp` está dentro de um `try/catch` num `Promise.all` (linhas 378–431). Portal que dá erro devolve `null`, é registrado no funil e a camada segue com os demais. Ou seja, esse comportamento já existe hoje para Zap/Chaves/OLX/Viva. A mudança abaixo é só de UI e da lista fixa; o motor não precisa de retrabalho.

## Mudanças

### 1. `src/lib/study-runner.ts`
- Remover as funções `isChavesEnabled()` e `isOlxEnabled()` (e o `isVivaEnabled` já foi removido).
- `activeTargets()` passa a retornar sempre `["zapimoveis.com.br", "vivareal.com.br", "chavesnamao.com.br", "olx.com.br"]`, ignorando o `input.portais` para efeito de seleção (o campo continua existindo em `StudyInput` para compatibilidade, mas não filtra mais nada).
- Incluir `olx.com.br` também em `retryTargets` (hoje ele fica de fora do retry afrouxado).

### 2. `src/routes/app.configuracoes.tsx`
- Remover estados `chavesOn`, `olxOn` e handlers `toggleChaves`, `toggleOlx`.
- Na lista "Portais ativos", deixar os 4 como `locked: true, checked: true` (todos "Sempre ativo", sem interruptor).
- Adicionar uma pequena nota abaixo da lista: "Se algum portal estiver instável, ele é ignorado automaticamente e o estudo segue com os outros."
- Manter o seletor de teste PDP/PLP com os 4 portais (diagnóstico inalterado).
- Imovelweb continua como "Em breve" (locked, desligado).

### 3. `src/routes/app.novo-estudo.tsx`
- Remover todo o `useEffect` que lia `portal.chavesnamao` / `portal.olx` do localStorage.
- Inicializar `portais` com os 4 fixos e remover a lógica de sync/toggle.
- Remover a persistência em `localStorage` dentro de `togglePortal` (a função pode ser removida se não for mais usada em nenhum lugar da UI; o passo 4 do wizard hoje só mostra um Card informativo, não expõe toggles).

### 4. Limpeza de localStorage legado
- Não vamos migrar/limpar as chaves antigas (`portal.chavesnamao`, `portal.olx`, `portal.vivareal`) — elas simplesmente deixam de ser lidas. Sem risco funcional.

## Fora de escopo
- Adapter Gecko e handler `geckoPlp` — inalterados.
- Retry por 5xx dentro do `callGecko` — já existe (3 tentativas) e continua.
- Aviso visual no relatório dizendo "portal X ficou fora nesta busca" — pode ser um próximo passo, mas hoje o funil já mostra `firstError` no debug; não vou mexer nisso agora.

## Impacto esperado
- Estudos consomem créditos dos 4 portais sempre (antes era variável).
- Robustez maior: portal caído não trava mais nada — já era assim, agora fica explícito e sem interruptor pra confundir o usuário.
- Tempo do estudo pode subir levemente quando algum portal está lento, já que a camada espera o `Promise.all` resolver.

## Validação
- Configurações → 4 portais listados como "Sempre ativo", sem switches (só Imovelweb desligado).
- Novo estudo → passo 4 mostra só o card informativo, sem toggles.
- Simular erro de um portal (ex.: URL de teste inválida no diagnóstico) e confirmar que estudo real segue normalmente com os outros três — o funil deve mostrar o portal que falhou como `error`/`0 itens`.
