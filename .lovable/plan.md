## Objetivo
Aumentar as letras da página 3 (Carta ao Proprietário) no PDF exportado, mantendo tudo dentro de 1 folha A4 retrato.

## Mudanças (apenas CSS de impressão em `src/styles.css`, bloco `.print-owner-pages .owner-letter-*`)

Aumentos de tipografia, com pequenos ajustes de espaçamento para compensar:

- `owner-letter-intro`: 9.2pt → **10.5pt** (line-height 1.3)
- `owner-letter-card-lbl`: 6.4pt → **7.4pt**
- `owner-letter-card-val`: 12pt → **14pt**
- `owner-letter-card-sub`: 6.8pt → **8pt**
- `owner-letter-box-title`: 8.2pt → **9.5pt**
- `owner-letter-list li`: 7.7pt → **9pt** (line-height 1.3)
- `owner-letter-faixa-title`: 7.4pt → **8.5pt**
- `owner-letter-faixa-tag`: 6.5pt → **7.5pt**
- `owner-letter-faixa-val`: 10pt → **11.5pt**
- `owner-letter-faixa-hint`: 7.4pt → **8.5pt**
- `owner-letter-cta-title`: 7.5pt → **9pt**
- `owner-letter-cta p`: 8pt → **9.5pt** (line-height 1.3)
- `owner-letter-sign`: 7.8pt → **9pt**
- `owner-letter-page` gap: 5pt → **6pt**

## Garantia de 1 página
- A `.acm-page` da owner page já está travada em **210×297mm** com `overflow: hidden` e `page-break-after: auto`, então qualquer overflow eventual é cortado em vez de gerar 2ª folha.
- Se algum item ainda transbordar visualmente em revisão, reduzo padding interno dos cards/boxes (sem mexer nas fontes) num segundo passe.

## Escopo
- Sem mudanças na página 1 (one-pager) nem na página 2 (Argumentos).
- Sem mudança em componentes/TSX — só CSS.
