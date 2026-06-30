# Minha opinião sobre os estudos de hoje

Honestamente: o motor está **funcional, mas ainda entrega muita variação de qualidade entre um estudo e outro**. O que mais compromete a confiança no produto:

## Onde está doendo

### 1. Qualidade dos comparáveis (maior risco)
- **Mistura de padrões**: mesmo com o anchor estrito, ainda entram itens "do mesmo prédio" sem área, com tipologia diferente, ou de finalidade ambígua (locação disfarçada de venda). Já corrigimos várias camadas, mas o problema é estrutural: o sistema confia demais no que o portal devolve.
- **Dependência de 1 portal**: quando Zap volta vazio, o estudo vira "estudo OLX" e a amostra perde representatividade. O rebalance ajudou, mas não resolve quando OLX domina por baixa qualidade de anúncio.
- **Duplicados quase-iguais**: mesmo imóvel anunciado por 2 corretores diferentes infla a amostra e puxa a média.
- **Falta de "score de confiança" no comparável**: hoje todos pesam igual no cálculo. Um anúncio com foto ruim, sem área confirmada e 180 dias parado pesa o mesmo que um anúncio fresco e completo.

### 2. Precificação / Valor ideal
- **Valor ideal oscila demais entre execuções** do mesmo imóvel porque a amostra muda. Falta um "intervalo de confiança" mostrando ao corretor o quanto confiar.
- **A IA às vezes contradiz o cálculo determinístico** (mediana × área). Hoje a IA tem prioridade no `getValorIdeal`, mas não há sanidade entre os dois — se a IA viaja, o número vai pro PDF.
- **Estratégia (mediana / P25 / P75) é escolhida pelo corretor sem contexto**: deveríamos sugerir a estratégia com base no perfil da amostra (alta dispersão → mediana; amostra pequena → P25 conservador).
- **Não consideramos tempo médio de mercado** dos comparáveis para ajustar o preço. Anúncio com 200 dias parado a R$/m² alto não deveria puxar a mediana pra cima.

### 3. Layout do PDF
- **Página 1 (ACM landscape)** ficou densa demais; o "Valor ideal" não tem destaque visual proporcional à importância.
- **Página 2 (Argumentos)** funciona, mas é texto corrido — falta hierarquia visual (ícones, blocos, citação dos comparáveis).
- **Página 3 (Carta)** ficou legível, mas a tabela de top comparáveis aperta o texto. O leitor (proprietário) recebe muita informação ao mesmo tempo.
- **Falta uma capa/contracapa** com identidade do corretor — o PDF começa direto no dashboard, o que parece relatório técnico, não material de apresentação.

---

## Plano de melhorias priorizado (3 ondas)

### Onda 1 — Confiança nos comparáveis (alto impacto, baixo custo)
1. **Score de confiança por comparável** (0–100): combina completude (área, fotos, condomínio), idade do anúncio (DOM), e se passou em todos os filtros vs. foi resgatado. Exibir badge no PDF e no app.
2. **Peso ponderado no cálculo de mediana/média**: comparáveis com score < 50 entram com peso 0.5; score < 30 são excluídos do cálculo (mas permanecem visíveis com flag).
3. **Deduplicação semântica**: agrupar anúncios com mesma área + mesmo preço ± 2% + mesmo bairro como "1 imóvel, N anunciantes" — exibe no PDF como "3 corretores anunciando o mesmo imóvel".
4. **Guard de finalidade reforçado**: além do preço, validar que a URL/título não contém "aluguel/locação/temporada" mesmo quando o portal classifica como venda.

### Onda 2 — Inteligência de precificação (médio impacto)
5. **Intervalo de confiança no Valor Ideal**: mostrar "R$ X (faixa de confiança: R$ Y a R$ Z)" baseado em desvio-padrão da amostra ponderada. Quando a faixa for muito larga, o PDF avisa "amostra heterogênea — recomendamos buscar mais comparáveis".
6. **Sugestão automática de estratégia ACM**: o sistema recomenda mediana/P25/P75 com base em (a) tamanho da amostra, (b) dispersão, (c) DOM médio. Corretor pode sobrescrever.
7. **Sanidade IA × determinístico**: se a IA sugerir Valor Ideal > 15% acima ou abaixo da mediana × área, o sistema usa a mediana e marca no log "IA ignorada por divergência". Evita que a IA "viaje" no PDF.
8. **Penalidade por DOM alto**: comparáveis com >120 dias no portal entram com peso 0.7 no R$/m² médio (sinal de preço acima do mercado).

### Onda 3 — Apresentação do PDF (alto impacto percebido)
9. **Capa personalizada** (página 0): foto do imóvel, endereço, corretor responsável, data, logo RE/MAX. Vira o "rosto" do documento.
10. **Destaque do Valor Ideal na p.1**: card grande, cor sólida, número em fonte display 48pt+. Hoje compete visualmente com 5 outros blocos.
11. **Reestruturar p.2 (Argumentos)** em 3 blocos visuais com ícones: "O que o mercado mostra" | "Riscos do preço atual" | "Cenário recomendado" — cada um com 2–3 bullets curtos e citação de comparáveis específicos.
12. **Aliviar p.3 (Carta)**: tirar a tabela de comparáveis (já está na p.1) e dar espaço pro texto respirar. Tabela vira mini-rodapé com 3 linhas só.
13. **Contracapa** com próximos passos: "Agende uma visita para revisar a estratégia" + contato do corretor.

---

## Minha sugestão de ordem de execução

Começaria pela **Onda 1 (itens 1–3)** porque é onde está o maior risco de o corretor mostrar um estudo "errado" ao cliente. Depois **item 9 (capa) + item 10 (destaque do Valor Ideal)** porque mudam radicalmente a percepção do PDF com pouco esforço. O resto vem depois conforme você for usando.

**Não faz parte deste plano** implementar nada — quero seu OK em quais ondas/itens entram no próximo ciclo antes de mexer em código. Me diga: "vai com Onda 1 inteira", "só itens 1, 2, 9, 10", "tudo", ou qualquer outro recorte.
