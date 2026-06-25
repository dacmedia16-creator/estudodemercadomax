## Por que voltou zero

Hoje a busca por condomínio cai em dois funis muito apertados e qualquer um zera o resultado:

1. **Adapter descarta itens**: `geckoItemToProperty` exige `quartos` E `areaUtil` no payload da PLP. Muitos cards do Zap não trazem esses números na listagem (vêm só na PDP), então a lista chega cheia e o adapter joga tudo fora antes de qualquer filtro.
2. **`matchEdificio` exige TODOS os tokens**: "Cannes Campolim" vira `["cannes","campolim"]` e exige os dois em `titulo+descricao+bairro`. Anúncios que dizem só "Edifício Cannes" no bairro Campolim passam, mas quando o anúncio só fala "Cannes" no título e descrição genérica, ele exclui.
3. **Keyword da layer 0 mistura bairro**: hoje manda `"Cannes Campolim"` como keyword da PLP — o Zap interpreta como busca textual e pode devolver pouca coisa. O ideal é mandar só `"Cannes"` (nome do prédio) e filtrar Campolim localmente.
4. **Layer 1.5 (endereço) só roda se condomínio < TARGET**: ok, mas usa `keyword: "${endereco} ${bairro}"` que sofre do mesmo ruído.

E o **crash da página** ("This page didn't load") acontece quando o estudo volta com 0 comparáveis: `avgArea = NaN`, `diff = ±Infinity`, e a página não tem `errorComponent` nem trata `comparaveis.length === 0`, então qualquer pequeno NaN dentro do Recharts ou do diagnóstico derruba o render todo.

## Correções

**`src/lib/gecko-adapter.ts`**
- Não descartar mais por falta de `quartos`/`areaUtil` na PLP. Quando ausentes, marcar com `0` e deixar passar; o filtro local decide depois.
- Trazer um campo `incomplete: true` no MockProperty (opcional) para a layer estrita ignorar, mas a layer "mesmo prédio" aceitar.

**`src/lib/study-runner.ts`**
- Layer 0 (edifício): keyword vira apenas o nome do prédio (`"Cannes"`), sem concatenar bairro. Cidade/estado/businessType seguem no payload da PLP. Continua paginando até 3 páginas.
- `matchEdificio` mais tolerante: aceita match se ≥1 token significativo aparecer no `titulo` OU `descricao` OU `bairro` (em vez de exigir todos). Adicionar sinônimos comuns ("residencial", "ed", "edif" já estão como STOP — manter).
- Quando `priorizarEdificio` e a layer 0 retornar ≥1, pular layer principal (bairro) — esses anchors já são os comparáveis. Hoje exige ≥3 para "fixar"; baixar para ≥1 quando o usuário pediu prédio específico.
- Para itens "mesmo prédio" sem `quartos`/`areaUtil`, preencher com os valores do `input` (proxy razoável: imóvel do mesmo prédio costuma ter planta semelhante) e marcar `c.aproximado = true`.
- Adicionar log/funilBusca extra: "Itens descartados por dados incompletos" para o usuário ver o quanto a API retornou cru vs aproveitado.

**`src/lib/study-engine.ts`**
- `generateStudy` com `filtered.length === 0`: definir `avgArea`/`avgQuartos` como `input.areaUtil`/`input.quartos` (evita NaN) e `diff = 0` (status "Dentro da média" + diagnóstico "Sem comparáveis suficientes — refine a busca").

**`src/routes/app.relatorio.$id.tsx`**
- Adicionar `errorComponent` no `createFileRoute` para evitar tela cinza do Lovable quando algo no render explodir.
- Quando `study.comparaveis.length === 0`, renderizar card amigável "Nenhum comparável encontrado" no lugar dos gráficos/tabela/concorrentes, mantendo o cabeçalho e o painel "Ajustar critérios" funcionando.

## Fora de escopo
- Mudar o pipeline de PDP (continua só nos top 3 sem dados de condomínio).
- Mexer no formulário, na busca rápida ou na landing.
