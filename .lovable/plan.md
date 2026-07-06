## Objetivo
Permitir digitar livremente nos campos numéricos do formulário (Área útil, Quartos, Valor pretendido, etc.), sem que o input "trave" ou apague o que está sendo digitado.

## Problema atual
Em `src/routes/app.novo-estudo.tsx`, o helper `NumberInput` faz:
```tsx
<Input type="number" value={v ?? ""} onChange={(e) => onV(Number(e.target.value))} />
```
Quando o usuário apaga tudo, `Number("")` vira `0` e o campo mostra `0` no lugar do vazio. Ao tentar digitar "1500", às vezes o valor "pula" porque o estado converte imediatamente, atrapalhando edição (ex.: apagar o "0" inicial exige selecionar tudo antes).

## Mudança
Ajustar apenas o `NumberInput` para segurar o texto durante a digitação:

- Manter um estado local de string dentro do componente.
- Sincronizar com a prop `v` quando ela mudar externamente.
- No `onChange`, atualizar a string local e emitir `onV`:
  - string vazia → emitir `0` (ou `undefined`, mantendo compatibilidade atual) sem forçar "0" visível.
  - string válida → emitir `Number(str)`.
- Aceitar vírgula/ponto (troca `,` por `.` antes de converter) para números decimais.
- Usar `inputMode="decimal"` para melhor teclado no mobile.

## Escopo
- Arquivo único: `src/routes/app.novo-estudo.tsx` (função `NumberInput`).
- Nenhuma mudança em lógica de negócio, engine ou tipos.

## Fora do escopo
- Formatação com máscara de moeda (R$) — pode ser feita depois se quiser.
- Alterar outros inputs (CEP, texto) que já funcionam.
