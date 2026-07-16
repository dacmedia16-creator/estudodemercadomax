## Objetivo

No passo 2 do "Novo estudo", ocultar o campo **"Área total (m²)"** quando o tipo do imóvel selecionado for **"Apartamento"**.

## Alteração — `src/routes/app.novo-estudo.tsx`

No passo 2, envolver o `<Field label="Área total (m²)">` em um condicional:

```tsx
{data.tipo !== "Apartamento" && (
  <Field label="Área total (m²)"><NumberInput ... /></Field>
)}
```

Quando ocultado, também limpar `data.areaTotal` para não enviar valor residual caso o usuário troque de tipo depois de digitar. Isso é feito ajustando o `onValueChange` do Select de tipo no passo 1: se novo tipo for "Apartamento", setar `areaTotal: undefined`.

## Fora do escopo

- Não alterar outros campos nem outros tipos.
- Não mexer no `StudyInput` — `areaTotal` já é opcional.
