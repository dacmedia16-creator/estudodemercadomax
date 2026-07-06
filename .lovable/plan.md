## Problema
Ao apagar o número do campo, aparece "0" de volta e não dá para deixar vazio. Isso acontece por dois motivos no `NumberInput` (em `src/routes/app.novo-estudo.tsx`):
1. O `onBlur` força `"0"` quando o texto está vazio.
2. Vários defaults no estado inicial já são `0` (ex.: `areaTotal: 0`, `andar: 0`), então o campo renderiza "0".

## Mudança
- Remover o `onBlur` que força "0". Deixar o campo realmente vazio quando o usuário apagar.
- Ao apagar tudo, emitir `0` para o estado (mantendo compatibilidade de tipo `number`) mas **não** reescrever o texto exibido — o input fica visualmente vazio.
- Ajustar o `useEffect` de sincronização: quando o valor externo for `0` e o texto local estiver vazio, manter vazio (não sobrescrever com "0").
- Nenhuma mudança nos defaults do formulário nem na lógica de submit.

## Escopo
- Arquivo único: `src/routes/app.novo-estudo.tsx`, função `NumberInput`.
