Plano para corrigir o problema do “0” que ainda volta nos campos:

1. Ajustar o `NumberInput` para controlar também se o usuário já editou/limpou o campo, evitando que uma atualização externa reescreva `0` logo depois da digitação.
2. Parar de passar `0` artificialmente para campos opcionais como `Área total`, `Ano de construção` e `Andar`; eles devem abrir vazios quando não tiverem valor.
3. Permitir que o campo fique visualmente vazio enquanto o estado interno continua seguro para o cálculo.
4. Normalizar somente na hora de gerar o estudo: campos obrigatórios vazios viram `0`; campos opcionais vazios continuam ausentes.
5. Validar no preview apagando o valor de um campo que começa com `0` e confirmando que ele permanece vazio.