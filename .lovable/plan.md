## Diagnóstico

A OLX não foi chamada na sua última busca porque ela está **opt-in** em dois lugares:

1. **Formulário "Novo Estudo" → passo Portais**: na lista `PORTAIS_DISPONIVEIS` (`src/routes/app.novo-estudo.tsx`) a OLX está com `ativo: false`. Se você não marcar o checkbox, ela não entra em `input.portais` e o runner ignora.
2. **Configurações → Portais**: o toggle global `portal.olx` tem default `false` (`isOlxEnabled()` em `src/lib/study-runner.ts:30`). Só vale quando o estudo não traz seleção própria.

Como a seleção do formulário sempre sobrescreve o toggle global, basta o checkbox da OLX vir desmarcado para ela ser pulada — foi o que aconteceu agora.

## Plano

1. **Ligar OLX por padrão no formulário** (`src/routes/app.novo-estudo.tsx`): mudar `{ nome: "OLX", ativo: false }` → `ativo: true`. Estudos novos passam a incluir OLX automaticamente; o usuário ainda pode desmarcar.
2. **Ligar OLX por padrão no toggle global** (`src/lib/study-runner.ts` `isOlxEnabled`): default `true` quando nada estiver salvo, alinhando com Zap/Chaves. Também atualizar o estado inicial do toggle em `src/routes/app.configuracoes.tsx` para refletir o novo default.
3. **Reforço visual**: na tela de carregamento e no funil do relatório, garantir que a linha "OLX" apareça mesmo quando retorna 0 itens, para você ver explicitamente que o portal foi consultado (hoje só aparece quando há resultados ou erro).
4. **Verificação**: rodar um estudo de teste (mesmo cenário Cannes Campolim) e conferir no console/funil as chamadas `geckoPlp` com `target: "olx.com.br"` e `state: "SP"` + `categoryPath: "imoveis/venda-de-apartamentos"`. Sem mudanças em lógica de parsing/filtros — só ativação por padrão.

Sem alterações em backend, schemas ou créditos além do consumo natural de mais um portal por estudo.