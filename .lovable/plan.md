## Diagnóstico

O estudo que você abriu foi **salvo antes** da correção de deduplicação de IDs entrar em vigor. Ou seja: o `payload` guardado no banco ainda tem várias linhas com o **mesmo `id`** (o Viva Real reutiliza o `listingId` do empreendimento em unidades diferentes).

Como o `handleRemove` em `src/components/comparaveis-manager.tsx` remove com `filter(c => c.id !== id)`, todo mundo que compartilha aquele id vai embora junto — foi exatamente o que você viu de novo.

A dedupe do runner só age quando o estudo é gerado/rerunado. Estudos antigos permanecem com ids duplicados no JSON persistido até rodar "Refazer busca". Precisamos consertar sem exigir isso do usuário.

## Correção

Duas camadas, ambas pequenas:

### 1. Deduplicar ids ao carregar do banco (`src/lib/study-store.ts`)
Em `toResult`, aplicar o mesmo passo de unicidade que o runner faz, tanto em `payload.comparaveis` quanto em `payload.comparaveisOriginais` (quando existir). Assim, qualquer estudo antigo passa a ter ids únicos assim que é lido — sem migração de banco.

### 2. Remover por referência, não por id (`src/components/comparaveis-manager.tsx`)
Trocar `handleRemove(id)` por `handleRemove(index)` e usar `study.comparaveis.filter((_, i) => i !== index)`. Isso blinda contra qualquer duplicata futura (ex.: adaptador novo, item colado manualmente com colisão que escape do sufixo, etc.). A key do `<li>` também passa a ser `${c.id}-${index}` para não repetir warning do React.

Nenhuma mudança no runner, nas estatísticas, no PDF ou no schema Supabase. `comparaveisOriginais` continua sendo o snapshot preenchido pelo runner; quando ausente (estudo muito antigo), o fallback para `study.comparaveis` (agora com ids únicos após load) mantém "Restaurar originais" funcionando.

## Arquivos afetados

- `src/lib/study-store.ts` — dedupe defensivo em `toResult`.
- `src/components/comparaveis-manager.tsx` — remoção por índice + key composta.
