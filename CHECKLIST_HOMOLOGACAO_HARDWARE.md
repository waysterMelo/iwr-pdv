# Checklist de Homologacao de Hardware

Checklist para validar impressora de etiquetas e leitor de QR Code quando os equipamentos chegarem.

## Identificacao da rodada

- Data:
- Loja:
- Responsavel tecnico:
- Operador que executou:
- Modelo da impressora:
- Modelo do leitor:
- Versao do sistema (`git rev-parse --short HEAD`):

## Preparacao do ambiente

- [ ] Backend em execucao e acessivel.
- [ ] Frontend em execucao e acessivel.
- [ ] Banco conectado sem erros no `/health`.
- [ ] Pelo menos 5 produtos cadastrados com codigos diferentes.
- [ ] Produto com nome curto, nome longo, preco inteiro e preco com centavos.

## Testes da impressora de etiquetas

- [ ] Abrir etiqueta por produto e validar preview no navegador.
- [ ] Imprimir etiqueta de produto com nome curto.
- [ ] Imprimir etiqueta de produto com nome longo.
- [ ] Validar legibilidade do nome, preco, codigo e QR impresso.
- [ ] Validar se o QR ficou inteiro, sem corte nas bordas.
- [ ] Validar alinhamento da etiqueta na midia real.
- [ ] Imprimir 10 etiquetas em sequencia e observar estabilidade.
- [ ] Repetir impressao apos reiniciar impressora.

## Testes do leitor de QR Code

- [ ] Ler QR direto da tela (sem impressao) para validar leitura base.
- [ ] Ler QR da etiqueta impressa em distancia curta.
- [ ] Ler QR da etiqueta impressa em distancia media.
- [ ] Ler QR com iluminacao normal da loja.
- [ ] Ler QR com iluminacao mais fraca.
- [ ] Repetir leitura de 10 etiquetas diferentes.
- [ ] Confirmar que o codigo lido corresponde ao codigo do produto.

## Cenarios de robustez

- [ ] Etiqueta com nome longo continua legivel e sem truncar dados criticos.
- [ ] Etiqueta com preco alto continua com layout correto.
- [ ] Impressao consecutiva nao degrada qualidade do QR.
- [ ] Leitor nao retorna caracteres extras no inicio/fim.
- [ ] Fluxo continua funcional apos reiniciar backend e frontend.

## Critérios de aprovacao

- [ ] Taxa de leitura do QR impresso >= 95% em 50 tentativas.
- [ ] Nenhum dado critico cortado na etiqueta (nome, preco ou codigo).
- [ ] Impressao continua estavel por 10 operacoes consecutivas.
- [ ] Leitura devolve exatamente o codigo esperado em todos os cenarios aprovados.

## Evidencias da homologacao

- [ ] Fotos de 3 etiquetas impressas.
- [ ] Video curto de leitura do QR impresso.
- [ ] Registro de problemas encontrados e status de correcao.
- [ ] Decisao final: `Aprovado` ou `Reprovado`.

## Plano de acao para problemas

- [ ] Ajustar tamanho da etiqueta no backend (`/api/products/{id}/label`).
- [ ] Ajustar configuracoes da impressora (densidade, velocidade, largura).
- [ ] Ajustar contraste/qualidade de impressao para melhorar leitura do QR.
- [ ] Reexecutar apenas os testes afetados apos cada ajuste.

