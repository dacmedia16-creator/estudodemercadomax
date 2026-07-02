## Remover o banner amarelo do piso competitivo

Agora que o teto default subiu pra +15% e você já entende a lógica, o aviso amarelo virou ruído.

### Mudança

**`src/components/acm-panel.tsx`** — remover o bloco `{computed.pisoAplicado && (<div>…</div>)}` que renderiza o banner amarelo com os botões "Aumentar teto para +25%" e "Desligar 'Respeitar piso'".

### Mantém

- Slider "Máx. acima do piso" e toggle "Respeitar piso" continuam no painel de estratégia (dá pra ajustar por ali quando precisar).
- Hint amarelo no card "Valor sugerido" quando o piso trava — continua servindo como aviso discreto.
- Fórmula da média dos 4 fatores e default de +15% ficam como estão.

Confirma?