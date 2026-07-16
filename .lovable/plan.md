## Objetivo

No passo 2 do "Novo estudo", os campos monetários (Condomínio, IPTU, Valor pretendido) devem:
1. Começar **vazios** (sem valores pré-preenchidos).
2. Exibir o valor formatado como **moeda brasileira** (R$) enquanto o usuário digita.

## Alterações — `src/routes/app.novo-estudo.tsx`

### 1. Estado inicial vazio
No `useState` do `data` (defaults iniciais), remover os valores:
- `condominio: 850` → removido (undefined)
- `iptu: 220` → removido (undefined)
- `valorPretendido: 780000` → removido (undefined)

Outros numéricos (área, quartos, etc.) permanecem como estão — o pedido é sobre os campos em moeda.

### 2. Novo componente `CurrencyInput`
Criar componente local ao lado de `NumberInput`, com a mesma API (`v?: number; onV: (n) => void`), mas:
- Formata o valor exibido como `R$ 1.234,56` (Intl.NumberFormat pt-BR, style currency BRL).
- Aceita apenas dígitos na digitação; internamente converte para número (centavos → reais) ou trata como valor inteiro em reais (sem centavos, já que os campos atuais usam inteiros).
- Placeholder vazio (`R$ 0,00` cinza) quando `v === undefined`.
- No blur, mantém o valor formatado; no focus, mantém a máscara (não vira input cru).

Decisão de precisão: manter em **reais inteiros** (sem centavos), como hoje, para não mudar o `StudyInput`. Ex.: digitar "850" → exibe `R$ 850`. Se preferir suportar centavos, aviso para confirmar — mas o padrão do form hoje é inteiro.

### 3. Trocar os 3 inputs no passo 2
```
<Field label="Condomínio (R$)"><CurrencyInput ... /></Field>
<Field label="IPTU (R$)"><CurrencyInput ... /></Field>
<Field label="Valor pretendido (R$)"><CurrencyInput ... /></Field>
```

Os labels perdem o `(R$)` redundante, virando "Condomínio", "IPTU", "Valor pretendido".

## Fora do escopo
- Não muda `StudyInput` nem lógica do estudo.
- Não altera outros campos numéricos (área, quartos, ano, etc.).
- Não mexe no passo 1, 3 ou 4.
