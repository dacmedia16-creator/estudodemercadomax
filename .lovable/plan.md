Vou adicionar controle campo-a-campo dos filtros extras no painel "Ajustar critérios" do relatório (e na última etapa do formulário do novo estudo), para você decidir o que vira filtro rígido, preferência ou só relatório.

## O que cada campo poderá fazer

Cada campo extra terá 3 modos selecionáveis:
- **Ignorar**: só aparece no relatório, não afeta nada na busca.
- **Preferência (soft)**: imóveis que batem ganham boost na ordenação, mas quem não bate ainda aparece.
- **Obrigatório (hard)**: quem não bate é descartado do conjunto final.

## Campos cobertos

| Campo | Ignorar | Preferência | Obrigatório |
|---|---|---|---|
| Suítes | ✓ | ✓ (peso 7) | ✓ (= ou ±1) |
| Banheiros | ✓ | ✓ (peso 5) | ✓ (= ou ±1) |
| Vagas | ✓ | ✓ (peso 8) | ✓ (= ou ±1) |
| Andar | ✓ | ✓ (peso 4) | ✓ (faixa ±3) |
| Ano de construção | ✓ | ✓ (peso 5) | ✓ (±10 anos) |
| Condomínio (R$) | ✓ | ✓ (peso 4) | ✓ (até +30%) |
| IPTU (R$) | ✓ | ✓ (peso 3) | ✓ (até +30%) |
| Diferenciais | ✓ | ✓ (peso 15, já existe) | ✓ (precisa bater ≥ 50%) |

Campos que já são usados na busca (`tipo`, `cidade`, `bairro`, `endereco`, `numero`, `edificio`, `quartos`, `areaUtil`, `valorPretendido`, `raioKm`) continuam como estão — não vou mexer no que já funciona.

## Onde aparecerá na UI

1. **Painel "Ajustar critérios"** no relatório: nova seção colapsável "Campos extras (preferências)" com um seletor de 3 estados por campo. Mudou → reroda o estudo no mesmo ID.
2. **Etapa 3 do formulário** de novo estudo: ao lado de cada campo extra, um seletor compacto (ícone) para definir o modo desde a primeira execução. Padrão sugerido = "Preferência" para vagas/suítes/diferenciais, "Ignorar" para o resto, mantendo o comportamento atual.

## Funil de busca

O funil ganha linhas explicando o impacto dos filtros obrigatórios, ex.:
- "Removidos por 'Vagas obrigatório (2)': 4"
- "Removidos por 'Diferenciais obrigatório (Piscina, Academia)': 7"

Assim você vê exatamente quando um filtro extra está zerando a busca e pode relaxá-lo no painel.

## Detalhes técnicos

- `StudyInput` ganha um campo opcional `fieldModes: Record<string, 'ignore'|'soft'|'hard'>`.
- `study-runner.ts`: aplica filtros `hard` antes do `chosen` final (depois das camadas de busca da API, para não desperdiçar créditos).
- `study-engine.ts`: a função `similarity` lê os pesos só dos campos em modo `soft` ou `hard`; em `ignore`, o peso é 0.
- Compatibilidade: se `fieldModes` não vier, mantém o comportamento atual (= todos como `soft` com os pesos de hoje).
- Persistência: o `fieldModes` fica salvo junto com o estudo no `localStorage`, então recarregar o relatório preserva a configuração.

## Fora do escopo desta entrega

- Não vou criar novos filtros nativos na API (Zap/Chaves não aceitam vagas/suítes/condomínio etc. como filtros nativos).
- Não vou mexer na lógica de geocoding, raio, retry do Zap ou interleaving de portais — já estão funcionando.