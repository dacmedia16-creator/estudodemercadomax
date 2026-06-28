## Objetivo
Sempre iniciar o novo estudo com **todos os portais selecionados** (Zap, Chaves na Mão, OLX e quaisquer outros listados em `PORTAIS`).

## Mudanças

**`src/routes/app.novo-estudo.tsx`**
- No estado inicial (`useState` do `data`), trocar `portais: ["Zap Imóveis"]` por `portais: PORTAIS.map(p => p.nome)` para já vir tudo marcado.
- No `useEffect` que lê `localStorage["portal.chavesnamao"]`: manter Chaves na Mão sempre incluído por padrão (default `true` quando a chave não existe), e só removê-lo se o usuário tiver desativado explicitamente em Configurações. Mesma lógica para qualquer outro portal com toggle persistido (OLX, se houver).
- Não alterar `togglePortal` — usuário continua podendo desmarcar manualmente no passo "Portais".

**`src/routes/app.exemplo.tsx`**
- Atualizar o estudo de exemplo para incluir todos os portais (`portais: ["Zap Imóveis", "Chaves na Mão", "OLX"]`) para refletir o novo padrão.

## Fora do escopo
- Nenhuma mudança em `study-runner`, adapter, tipos ou backend — a lógica de busca já respeita o array `portais` recebido.
- Nenhum ajuste em estudos já salvos.
