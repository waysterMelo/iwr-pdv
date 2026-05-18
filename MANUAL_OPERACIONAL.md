# Manual Operacional IWR PDV

Manual curto para a operacao basica da loja.

## Acessar o sistema

1. Abra `http://127.0.0.1:5173/`.
2. Entre com o usuario e senha fornecidos para a loja.
3. No ambiente local inicial, o padrao e `admin` / `admin123`.
4. Use a navegacao para alternar entre `Vendas`, `Promissorias`, `Clientes`, `Historico` e `Produtos`.

## Cadastrar produto

1. Abra `Produtos`.
2. Preencha nome, preco, estoque e status.
3. Deixe o codigo vazio para o sistema gerar automaticamente.
4. Clique em `Cadastrar produto`.

## Gerar QR Code e etiqueta

1. Abra `Produtos`.
2. Localize o produto na lista.
3. Use `Baixar` para salvar o QR Code.
4. Use `Etiqueta` para abrir a previa.
5. Use `Imprimir etiqueta` quando a impressora estiver disponivel.

## Realizar venda

1. Abra `Vendas`.
2. Leia o QR Code ou digite o codigo do produto.
3. Pressione `Enter` ou clique em `Adicionar`.
4. Ajuste a quantidade se necessario.
5. Informe forma de pagamento, desconto quando houver e valor recebido para dinheiro.
6. Clique em `Finalizar venda`.

O sistema valida produto ativo e estoque disponivel antes de finalizar. Ao finalizar, a venda e salva e o estoque e reduzido automaticamente.

## Controlar promissorias

1. Abra `Promissorias`.
2. Acompanhe parcelas pendentes, vencidas e pagas.
3. Registre recebimentos quando o cliente pagar.
4. Use a mensagem de WhatsApp para lembrar clientes em atraso.
5. Renegocie parcelas quando for necessario combinar novo prazo.

## Consultar historico

1. Abra `Historico`.
2. Use os filtros de inicio e fim quando necessario.
3. Selecione uma venda para consultar os itens.
4. Use `Imprimir recibo` quando precisar entregar comprovante nao fiscal.
5. Use `Cancelar venda` para estornar uma venda e devolver estoque.

## Pontos de atencao

- Produto inativo nao entra no carrinho.
- Produto sem estoque nao pode ser vendido.
- A baixa de estoque acontece apenas quando a venda e finalizada.
- Cancelamento devolve o estoque dos itens vendidos.
- Impressao e leitura fisica dependem da homologacao dos equipamentos.
- A senha padrao deve ser alterada no ambiente antes da entrega final.
