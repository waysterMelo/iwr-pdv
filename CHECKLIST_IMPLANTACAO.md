# Checklist de Implantacao

Use este roteiro para preparar uma maquina local para operar o IWR PDV.

## Ambiente

- [ ] Docker Desktop instalado e iniciado.
- [ ] Java 21 ou superior instalado.
- [ ] Node.js instalado.
- [ ] Porta `5432` livre para PostgreSQL.
- [ ] Porta `8080` livre para backend.
- [ ] Porta `5173` livre para frontend em desenvolvimento.

## Inicializacao

- [ ] Rodar `docker compose up -d`.
- [ ] Confirmar container `iwr-pdv-postgres` em execucao.
- [ ] Rodar `backend\mvnw.cmd spring-boot:run`.
- [ ] Confirmar `GET http://localhost:8080/health` com `status=UP` e `database=UP`.
- [ ] Rodar `npm install` dentro de `frontend` quando necessario.
- [ ] Rodar `npm run dev` dentro de `frontend`.
- [ ] Abrir `http://127.0.0.1:5173/`.

## Acesso Mobile

- [ ] Publicar o frontend em HTTPS para uso em celular.
- [ ] Confirmar que o navegador mostra contexto seguro antes de testar camera.
- [ ] Evitar acesso por IP local em HTTP comum para venda mobile, pois a camera pode ser bloqueada.
- [ ] Abrir o sistema em smartphone e confirmar troca automatica para o layout mobile.
- [ ] Clicar em `Vender` e confirmar abertura da tela de venda mobile.
- [ ] Clicar em `Abrir camera` e conceder permissao de camera.
- [ ] Escanear QR Code de produto ativo com estoque e confirmar entrada automatica no carrinho.
- [ ] Escanear novamente o mesmo produto apos o intervalo de leitura e confirmar soma de quantidade.
- [ ] Fechar o scanner e confirmar que o indicador da camera do aparelho foi desligado.
- [ ] Digitar codigo manualmente e confirmar entrada no carrinho.

## Validacao funcional

- [ ] Cadastrar produto ativo com estoque.
- [ ] Confirmar codigo automatico no padrao `IWR-000001`.
- [ ] Abrir QR Code do produto.
- [ ] Abrir preview da etiqueta.
- [ ] Adicionar produto na venda pelo codigo.
- [ ] Finalizar venda.
- [ ] Confirmar baixa de estoque no cadastro de produtos.
- [ ] Confirmar venda no historico.

## Dependencias fisicas

- [ ] Executar `CHECKLIST_HOMOLOGACAO_HARDWARE.md` quando impressora e leitor chegarem.
- [ ] Ajustar tamanho da etiqueta conforme midia real.
- [ ] Registrar evidencias de impressao e leitura.
