## Por que o Chaves na Mão não trouxe nada

Olhando `src/lib/study-runner.ts` + `src/lib/gecko.functions.ts`, o runner dispara **a mesma requisição para os dois portais em paralelo**, e essa requisição está montada para o Zap:

1. **`state` em UF maiúscula** (`"SP"`, `"PR"`…). O Chaves frequentemente espera nome por extenso ou ignora o filtro; quando não reconhece, responde `notFound: true` e o portal é marcado como `exhausted` na 1ª página (não tenta mais).
2. **Filtros nativos do PLP** (`bedrooms`, `priceMin/Max`, `areaMin/Max`, `latitude/longitude`, `radius`) — todos são vocabulário do Zap. No Chaves esses campos costumam zerar o resultado.
3. **`keyword` formatada pro Zap** (ex.: `"apartamento agua-verde"` slugificada) — no Chaves a busca é mais sensível a texto livre.
4. **Shape de resposta**: hoje só lemos `res.data.items`. Se o Chaves devolver sob outra chave (`results`, `properties`, `ads`), o runner trata como 0 itens **sem avisar** (`recebidos` fica 0 e não vai pro funil).
5. **`nextPage` ausente** no Chaves → portal vira `exhausted` após página 1, mesmo se tiver mais resultados.

Hoje nada disso aparece no funil — o relatório só mostra os dados do Zap.

## Plano (1 PR)

### 1. Validar o shape real do Chaves
- Usar o "Testar PLP" em `/app/configuracoes` (já existe) com `target=chavesnamao.com.br` e logar `Object.keys(data)` + `Object.keys(items[0])` no console.
- Confirmar: nome do array (`items` vs `results`), nome dos campos de preço/área/quartos, formato de `state`, e se existe `nextPage` ou `hasNextPage`.

### 2. Separar parâmetros por portal em `study-runner.ts`
Trocar o `adaptivePaginate` para montar o body **por target** em vez de spread igual pros dois:

```ts
const buildParams = (t: PortalTarget): PlpParams => {
  if (t === "zapimoveis.com.br") return { ...zapParams };
  // Chaves: mandar só o essencial
  return {
    city: params.city,
    state: "", // ou nome por extenso — confirmar no passo 1
    businessType: params.businessType,
    keyword: params.keyword,
    // sem bedrooms/price/area/lat/lng/radius
  };
};
```

### 3. Adapter tolerante a `items` alternativo
Em `gecko.functions.ts` (ou no runner), normalizar:
```ts
const items = res.data?.items ?? res.data?.results ?? res.data?.properties ?? [];
```

### 4. Expor o Chaves no funil
Adicionar uma linha por portal em `funilBusca`:
- `"Chaves na Mão — recebidos / aproveitados / descartados"`
- E logar `plpNotFoundCount` por portal (hoje é global).

Assim, mesmo que ainda venha 0, o usuário vê **por que** (notFound, items vazio, descartados sem preço…).

### 5. Não marcar `exhausted` quando `nextPage` for indefinido **mas vier itens**
Hoje: `if (res.data?.nextPage == null) exhausted.add(t)`. Mudar para só marcar exausto se `items.length === 0` **ou** `nextPage` explicitamente vier `null`/`false`. Se vier `undefined` + itens, tentar próxima página.

### 6. Teste rápido pós-fix
Rodar um estudo em Curitiba/Água Verde, confirmar no funil:
- `Zap — recebidos > 0`
- `Chaves — recebidos > 0`
- ambos com `aproveitados` no relatório.

## Fora de escopo
- Não mexer no relatório/UI além de adicionar as linhas no funil.
- Não mudar a lógica de camadas (condomínio/endereço/bairro) — só corrige a coleta.
