Vou corrigir a lógica de busca para o Zap não desaparecer e para imóveis com metragem igual/próxima entrarem com prioridade real.

Plano:
1. Ajustar a busca por endereço
   - Combinar `endereco + numero` quando o número estiver separado no formulário.
   - Guardar rua/número nos comparáveis normalizados.
   - Marcar “Mesmo endereço” pelo campo estruturado do anúncio (`address.street`) e não só por texto do título/descrição.
   - Usar número apenas como bônus/sinal forte, não como filtro obrigatório.

2. Corrigir o sumiço do Zap
   - Evitar que o Zap seja considerado “sem imóveis” só porque a primeira camada por condomínio/endereço veio zerada.
   - No retry do Zap, usar uma busca ampla por bairro/cidade sem filtros nativos rígidos e depois filtrar localmente.
   - Registrar no funil quantos imóveis do Zap foram recebidos antes e depois dos filtros.

3. Melhorar a metragem
   - Separar “mesmo tamanho” de “faixa de área”: imóveis com área igual ou muito próxima ao imóvel analisado terão prioridade.
   - Se nenhum imóvel cair na faixa estrita, ampliar progressivamente a área antes de descartar tudo.
   - Mostrar no funil quantos imóveis foram removidos por área/preço/quartos.

4. Melhorar transparência no relatório
   - Exibir uma linha clara por portal: Zap e Chaves, recebidos/aproveitados/descartados.
   - Adicionar diagnóstico quando o Zap trouxe imóveis mas eles foram excluídos por filtros de área, preço, quarto ou raio.

5. Verificação
   - Rodar typecheck automático do ambiente e validar com um cenário Sorocaba/SP, Parque Campolim, Rua Antonio Perez Hernandez, com Zap + Chaves ativos.