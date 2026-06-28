## Objetivo
Remover o campo **"Bairros próximos"** do formulário de novo estudo.

## Mudanças

**`src/routes/app.novo-estudo.tsx`**
- Remover o `<Label>` + `<Input>` de "Bairros próximos (separados por vírgula)" do passo 1.
- Manter `bairrosProximos: []` no estado inicial (apenas como array vazio) para não quebrar o tipo `StudyInput` nem a lógica do runner/adapter que consome esse campo.

## Fora do escopo
- Não alterar `StudyInput`, `CriteriosEditor` (onde o usuário ainda pode adicionar bairros próximos no painel de ajuste de critérios do relatório), nem a lógica de busca.
