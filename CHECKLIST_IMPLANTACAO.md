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

## Validacao funcional

- [ ] Cadastrar produto ativo com estoque.
- [ ] Confirmar codigo automatico no padrao `IWR-000001`.
- [ ] Abrir QR Code do produto.
- [ ] Abrir preview da etiqueta.
- [ ] Adicionar produto no caixa pelo codigo.
- [ ] Finalizar venda.
- [ ] Confirmar baixa de estoque no cadastro de produtos.
- [ ] Confirmar venda no historico.

## Dependencias fisicas

- [ ] Executar `CHECKLIST_HOMOLOGACAO_HARDWARE.md` quando impressora e leitor chegarem.
- [ ] Ajustar tamanho da etiqueta conforme midia real.
- [ ] Registrar evidencias de impressao e leitura.

