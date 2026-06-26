## Plano

1. **Padronizar o estado do portal Chaves na Mão**
   - Corrigir a inconsistência atual: algumas telas salvam `true/false`, outras leem `1/0`.
   - Usar um único formato para `localStorage.portal.chavesnamao` e aceitar os valores antigos para não quebrar quem já configurou.

2. **Fazer o runner respeitar a seleção do estudo**
   - Além do `localStorage`, usar também `input.portais` do formulário.
   - Se o estudo tiver `Chaves na Mão` marcado, a busca deve obrigatoriamente incluir `target: "chavesnamao.com.br"`.
   - Zap continua sempre ativo como base.

3. **Sincronizar formulário e configurações**
   - Em `/app/novo-estudo`, o card “Chaves na Mão” deve salvar no mesmo padrão usado pelo runner.
   - Em `/app/configuracoes`, o switch deve ler e salvar o mesmo padrão.
   - Ajustar o estado inicial para Chaves vir ligado por padrão quando nunca configurado.

4. **Deixar visível durante a busca**
   - Atualizar a tela de carregamento para não dizer só “Buscando imóveis no Zap Imóveis”.
   - Mostrar algo como “Buscando imóveis nos portais ativos” para evitar a impressão de que só Zap está rodando.

5. **Validação**
   - Conferir que uma busca com Chaves marcado gera chamadas PLP para os dois targets:
     - `zapimoveis.com.br`
     - `chavesnamao.com.br`
   - Conferir que, no funil do relatório, aparecem os contadores por portal.