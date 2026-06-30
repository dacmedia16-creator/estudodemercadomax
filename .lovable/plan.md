# Corrigir comparáveis fora do padrão na camada "Mesmo prédio/condomínio"

## Problema

No último estudo (3 quartos / 98 m² no Cannes Campolim), entraram 2 imóveis de **2 quartos** (84 m² e sem área informada) porque a camada "Mesmo condomínio" do Chaves na Mão é tratada como uma exceção: quando o sistema reconhece que o anúncio está no mesmo prédio, ele **bypassa** o filtro de quartos/área. Além disso, mesmo quando o filtro roda, ele tolera ±1 quarto e aceita itens com área nula.

## Correções (todas em `src/lib/study-runner.ts`)

1. **Aplicar anchor estrito também à camada "Mesmo prédio/condomínio"** quando `criterios.anchorStrict` estiver ligado. Hoje só roda nas camadas de bairro/raio.

2. **Quartos: exigir igualdade exata quando anchor estrito está ligado** (em vez de ±1). Comportamento atual ±1 fica apenas para anchor desligado.
   - Estudo de 3 quartos → só entra 3 quartos.
   - Mantém o "soft mode" como hoje (sem anchor estrito, segue ±1).

3. **Área ausente/zero**: descartar quando anchor estrito está ligado. Hoje o item é mantido em "modo benefício da dúvida". Vai virar uma linha visível no funil: `Removidos por área ausente (anchor estrito) total: N`.

4. **Logar no funil quantos itens "mesmo prédio" foram descartados pelo anchor estrito**, separados por motivo (quartos, área fora da faixa, área ausente).

## O que NÃO muda

- Sem anchor estrito, o comportamento atual continua (±1 quarto, ±25% área, aceita área ausente). Quem prefere ver "tudo do mesmo prédio" liga/desliga via toggle no editor de critérios.
- Sem mudanças em Zap/OLX/IA/PDF/UI principal — só lógica de filtro e linhas extras no funil.
- Sem novas chamadas à GeckoAPI (filtro é local).

## Resultado esperado

No estudo do Cannes Campolim com anchor estrito, os dois anúncios de 2 quartos (incluindo o de 0 m²) seriam descartados antes de chegar no relatório, e o funil mostraria claramente o motivo.
