## Problema

No passo 4 ("Portais") do formulário detalhado, **Chaves na Mão** aparece como "Em breve" e não pode ser selecionada — mesmo já tendo sido integrada no backend (adapter + runner) e disponível em Configurações.

Isso é só um detalhe visual hardcoded em `src/routes/app.novo-estudo.tsx` linha 31:

```ts
{ nome: "Chaves na Mão", ativo: false }
```

O runner já dispara as duas chamadas em paralelo quando o switch global está ligado em Configurações — o card do passo 4 só está desatualizado.

## Mudanças

**1. `src/routes/app.novo-estudo.tsx`**
- Marcar `Chaves na Mão` como `ativo: true` na lista de portais.
- Tornar os cards de portal **realmente clicáveis** (hoje são decorativos): Zap fica sempre ligado, Chaves na Mão alterna `localStorage.portal.chavesnamao` no clique, com check mark e estado visual sincronizados.
- Os outros (Viva Real / OLX / Imovelweb) continuam "Em breve" e disabled.

**2. Sincronia com Configurações**
- Ler o valor inicial de `localStorage.portal.chavesnamao` (default `true`) ao montar o passo.
- Salvar imediatamente ao clicar — o `study-runner` já lê esse flag, então a próxima execução respeita a escolha feita aqui.
- Mostrar uma linha de ajuda discreta: "Também configurável em Configurações → Portais ativos".

## Fora de escopo

- Não mexo no runner nem no adapter (já funcionam).
- Não habilito Viva Real / OLX / Imovelweb (não estão integrados na GeckoAPI ainda).
