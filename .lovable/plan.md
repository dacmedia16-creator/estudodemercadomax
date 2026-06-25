## Busca por CEP no formulário de novo estudo

Adicionar um campo **CEP** no início da etapa de localização do formulário (`src/routes/app.novo-estudo.tsx`). Ao digitar 8 dígitos, consultar a API pública do ViaCEP e preencher automaticamente bairro, cidade e estado.

### Comportamento
- Campo CEP com máscara `00000-000`, ao lado (ou acima) dos campos atuais de localização.
- Ao completar 8 dígitos: chamar `https://viacep.com.br/ws/{cep}/json/` direto do cliente (API pública, sem token).
- Preencher automaticamente: **Bairro** (`bairro`), **Cidade** (`localidade`), **Estado** (`uf`).
- Usuário ainda pode editar manualmente qualquer campo depois (útil para CEPs genéricos de cidade que vêm sem bairro).
- Estados de UI: spinner enquanto busca, mensagem discreta se CEP não existir ("CEP não encontrado — preencha manualmente"), sem bloquear o formulário.
- Se o CEP for limpo, não apagar o que o usuário já digitou.

### Arquivos
- `src/routes/app.novo-estudo.tsx` — novo campo CEP + handler `onBlur`/`onChange` que dispara o fetch quando atingir 8 dígitos.
- (opcional) `src/lib/viacep.ts` — pequeno helper `lookupCep(cep)` para isolar a chamada e a normalização do retorno.

Sem mudanças no backend, na GeckoAPI ou no motor de estudo — é só conveniência de preenchimento no formulário.