## Diagnóstico
Olhei o `src/lib/study-runner.ts`. As **camadas 1 (mesmo condomínio) e 2 (mesmo endereço)** só aplicam `matchEdificio` / `matchEndereco` — **pulam o filtro de tipo**. Quando o sistema prioriza essas camadas (caso do estudo da imagem — quase todos os resultados estão marcados "Mesmo prédio"), qualquer "Casa de condomínio", "Sobrado" etc. publicado dentro do mesmo condomínio/endereço entra como comparável de "Apartamento".

Também existem dois reforços que falharam:
- O `propertyType` enviado ao Zap PLP serve só como filtro nativo; **se o portal não respeita, nada local descarta**.
- O `matchesType` usado nas camadas seguintes verifica só se a palavra "apartamento" aparece no `titulo/descricao`. Vários anúncios de Zap/Chaves/OLX não trazem essa palavra explícita, então o fallback ainda deixa casas passarem.

Resultado: o estudo de Apartamento misturou "Casa de condomínio à venda…", "Casa de condomínio para comprar…", "Casa de condomínio para alugar…" do Zap.

## Correção (apenas frontend / lógica, sem mexer em UI)

### 1. `src/lib/gecko-adapter.ts`
- Exportar um helper `isSameTipoFamily(propertyOrTitle, tipoDesejado)` que considera:
  - O campo estruturado do PLP (`propertyType`, `unitTypes`, `listingType`) quando disponível.
  - Palavras-chave do título normalizado: famílias `apartamento` (apartamento, apto, cobertura, flat, studio, kitnet, loft) **excluindo** `casa`, `sobrado`, `casa de condomínio`, `chácara`, `sítio`, `terreno`, `comercial`, `sala`, etc.
  - Família `casa` (casa, sobrado, casa de condomínio, casa térrea) excluindo apartamento/cobertura.
  - Demais tipos por correspondência direta.
- Anotar no `MockProperty` (já existe `propertyType` opcional via gecko) — só ler, não criar campo novo.

### 2. `src/lib/study-runner.ts`
- Substituir `matchesType` pelo novo `isSameTipoFamily` em todos os lugares (camadas 3/cidade/livre).
- **Aplicar o filtro de tipo nas camadas 1 e 2**:
  - `condoMatches = res.properties.filter((p) => matchEdificio(p, edificio) && isSameTipoFamily(p, tipo))`
  - `enderecoMatches = res.properties.filter((p) => matchEndereco(p, enderecoRaw) && isSameTipoFamily(p, tipo))`
- Logar no funil quantos foram **removidos por tipo incompatível** em cada camada:
  - `funilBusca.push({ etapa: "Removidos por tipo (mesmo prédio)", total: N })` quando `N > 0`.
- Adicionar um **hard filter final** sobre `chosen` (após as camadas escolhidas e antes dos hard filters dos campos extras):
  ```
  const before = chosen.length;
  chosen = chosen.filter((p) => isSameTipoFamily(p, tipo));
  const removed = before - chosen.length;
  if (removed > 0) funilBusca.push({ etapa: `Tipo incompatível (${tipo}) — removidos`, total: removed });
  ```
- Manter `propertyType`/`propertyTypes` já enviados ao Zap/Chaves (filtro nativo continua, é só backup).

### 3. (Opcional, mantém o relatório transparente)
- O bloco "Critérios da busca" no relatório já mostra o `tipo`. Sem mudança de UI necessária — o funil novo já comunica o descarte.

## Fora do escopo
- Não tocar em layout, ACM, slides, exportação PDF ou no fluxo do form.
- Não alterar a chamada da Gecko nem adicionar nova requisição.

## Validação
Reexecutar o estudo do print (Apartamento 78m² · Parque Morumbi). Esperado: as 4 linhas "Casa de condomínio…" do Zap desaparecem; o funil mostra `Removidos por tipo (mesmo prédio): N` e/ou `Tipo incompatível (Apartamento) — removidos: N`. Resto dos OLX/Zap (apartamentos) continua na tabela.
