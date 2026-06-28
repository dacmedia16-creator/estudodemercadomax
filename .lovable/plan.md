## Diagnóstico
Na camada **"Mesmo prédio"** (`src/lib/study-runner.ts` ~linha 398), o filtro local só checa o nome do edifício — não a cidade. Quando a GeckoAPI/Zap devolve um imóvel com condomínio de mesmo nome em outra cidade (caso comum em redes como "Edifício Solar das Palmeiras", "Cannes", etc.), ele passa direto e entra como comparável. As outras camadas (endereço/bairro) já restringem por bairro, então o problema é mais visível no Layer 1.

## Correção

**`src/lib/study-runner.ts`**
- Após `condoRaw = res.properties.filter(matchEdificio)`, aplicar também `inCidade(p)` (já existe na linha 204) antes do filtro de tipo.
- Registrar no funil: `Mesmo prédio: removidos por cidade diferente (N)` quando algum for descartado, para o usuário entender por que sumiu.
- Aplicar a mesma checagem `inCidade` defensivamente nas camadas **endereço** e **bairro/cidade inteira**, garantindo que nenhum imóvel fora da cidade do estudo cole no resultado final (não muda comportamento atual quando o portal já respeita, mas blinda contra falhas do upstream).
- Não aplicar quando `buscaLivre === true` (usuário sem cidade definida) — mantém o modo livre intacto.

## Fora do escopo
- Não mexer em pontuação de similaridade, tipos, UI do relatório nem no editor de critérios.
- Não alterar a busca por raio km / lat-lng (continua valendo como reforço).
