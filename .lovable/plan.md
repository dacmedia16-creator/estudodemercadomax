## Diagnóstico

As fotos não aparecem porque o CDN da OLX (`img.olx.com.br`) bloqueia hotlink: quando o browser envia o header `Referer` apontando para o nosso domínio, o servidor responde **403 Forbidden** (testado via curl: sem Referer = 200, com Referer = 403). Resultado: `naturalWidth = 0` e a tag `<img>` mostra apenas o texto do `alt`. Zap e Chaves geralmente permitem hotlink, mas a mesma proteção pode aparecer em alguns casos.

## Plano

1. **Adicionar `referrerPolicy="no-referrer"`** na tag `<img>` dos cards de concorrentes diretos em `src/routes/app.relatorio.$id.tsx` (linha 370). Sem o header `Referer`, o CDN da OLX libera a imagem.
2. **Aplicar a mesma política** em qualquer outro `<img>` que renderize `c.imagem` no relatório (verificar a tabela de comparáveis e cards adicionais — se houver `<img>` lá, ajustar; se forem só thumbnails inline, idem).
3. **Fallback visual**: adicionar `onError` que esconde o `<img>` quebrado e deixa o placeholder `bg-muted` aparecer limpo, evitando o texto longo do `alt` poluindo o card quando a imagem ainda assim falhar (ex.: URL inválida do PDP).
4. **Sem mudanças** em adapter, runner, GeckoAPI ou créditos — é puro ajuste de renderização no client.

### Detalhes técnicos
- `referrerPolicy="no-referrer"` é um atributo padrão do HTML; o React aceita em camelCase.
- Não usar proxy server-side: gastaria função/CPU à toa e a política de referrer resolve 100% do caso OLX testado.
- O `alt` continua para acessibilidade, mas com `onError` que seta `display:none` no `<img>`, o usuário vê só o fundo cinza neutro quando a imagem realmente não carrega.
