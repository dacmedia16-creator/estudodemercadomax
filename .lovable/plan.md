## Objetivo

No Step 4 do `/app/novo-estudo`, ocultar a UI de seleção de portais e o slider de raio, mantendo a lógica funcionando nos bastidores com todos os portais ativos selecionados e raio fixo em 5 km.

## Mudanças

**`src/routes/app.novo-estudo.tsx`**
- Manter o state `data.portais` inicializado com todos os portais ativos (Zap, Chaves na Mão, OLX) — comportamento atual já faz isso.
- Trocar valor inicial de `radiusKm` de `2` para `5` e remover o slider da UI.
- Remover do JSX do Step 4:
  - Bloco "Portais para busca" (grid de cards Zap/Chaves/Viva/OLX/Imovelweb + texto "Também configurável em Configurações").
  - Bloco "Raio de busca" (label + range input + legendas 1–5 km + descrição).
- Manter o Card "Pronto para gerar?" como único conteúdo visível do Step 4.
- Manter `sessionStorage.setItem("rip:pending-radius", "5")` e o envio de `portais` no `StudyInput` intactos para o runner.
- Seed de `localStorage["portal.chavesnamao"]` continua respeitado (caso usuário tenha desligado em Configurações, a lógica permanece).

## Não muda

- `study-runner.ts`, `gecko-adapter.ts`, lógica de busca e filtros de raio (Haversine).
- Configurações → Portais ativos continua existindo para super admin/usuário desligar Chaves se quiser.
- Steps 1–3 do formulário.
