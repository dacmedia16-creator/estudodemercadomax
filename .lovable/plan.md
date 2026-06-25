## Diagnóstico

Ao digitar "Apartamento 3 quartos Água Verde Curitiba até 700 mil" e clicar **Analisar**, o card "Entendi assim" aparece corretamente (Curitiba/PR, 3 quartos, R$ 700.000 etc.), mas:

1. O campo **Bairro** fica vazio (—). O parser regex em `parseQueryLocal` só detecta bairro quando há prefixo "bairro X", "em X", "no X" ou "na X". "Água Verde" no meio da frase escapa.
2. O botão **Confirmar e analisar** fica `disabled` porque `missing.length > 0` (bairro faltando).
3. Resultado: o usuário clica em "Confirmar" e nada acontece — exatamente o sintoma relatado.

## O que vou mudar

### 1. `src/lib/query-parser.ts` — detecção de bairro mais inteligente
- Adicionar dicionário de bairros conhecidos das principais capitais (Curitiba, SP, RJ, BH, POA — ~20 bairros por cidade). Quando a cidade é identificada, varrer o texto procurando esses bairros sem exigir prefixo.
- Fallback: quando cidade conhecida está no texto, capturar a sequência de 1–3 palavras capitalizadas imediatamente **antes** do nome da cidade como candidato a bairro (ex: "… Água Verde Curitiba …" → bairro = "Água Verde").
- Ajustar a regra de `missing`: bairro deixa de ser bloqueador se `cidade` está presente — a busca pode rodar só por cidade. Continua aparecendo aviso, mas não trava o fluxo.

### 2. `src/components/busca-rapida.tsx` — desbloquear o botão e editar inline
- O botão **Confirmar e analisar** só fica desabilitado quando **cidade** está faltando (campo realmente essencial pra GeckoAPI). Bairro vira "recomendado" mas não bloqueador.
- Quando um campo do card "Entendi assim" estiver vazio ou marcado como faltante, transformar em **input editável inline** (bairro, cidade, quartos) — assim o usuário corrige sem ir pro formulário.
- O aviso amarelo passa a dizer: "Sem bairro a busca será mais ampla. Adicione um bairro pra resultados mais precisos."

### 3. Refinar exemplos do chip
Trocar o exemplo "Apartamento 3 quartos 2 vagas Água Verde Curitiba até 700 mil com piscina" por uma versão que o parser entende 100% após o fix, e validar todos os 5 chips manualmente via Playwright depois.

## Detalhes técnicos

- `parseQueryLocal` ganha um `BAIRROS_POR_CIDADE: Record<string, string[]>` consultado quando `partial.cidade` é setado. Match case-insensitive com normalização de acentos.
- O fallback "palavras capitalizadas antes da cidade" usa regex `/([A-ZÀ-Ú][\wÀ-ú]+(?:\s+[A-ZÀ-Ú][\wÀ-ú]+){0,2})\s+<cidade>/`.
- `missing` passa a separar **blockers** (`cidade`) de **warnings** (`bairro`). A UI usa `blockers.length === 0` para habilitar Confirmar.
- Sem mudanças em `study-runner`, `gecko-adapter` ou na chamada AI — escopo restrito ao parsing e à UI da busca rápida.

## Validação

Depois das mudanças, rodar Playwright em headless contra `/app/novo-estudo`:
1. Digitar cada um dos 5 exemplos, clicar Analisar, conferir que o card mostra bairro preenchido e o botão Confirmar fica habilitado.
2. Digitar uma frase sem cidade pra confirmar que o botão fica bloqueado com a mensagem correta.
