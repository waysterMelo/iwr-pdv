# Backend

Base Spring Boot do IWR PDV.

## Requisitos

- Java 21+
- PostgreSQL em execucao

## Variaveis de ambiente

- `SERVER_PORT`: porta da aplicacao. Padrao `8080`
- `DB_HOST`: host do PostgreSQL. Padrao `localhost`
- `DB_PORT`: porta do PostgreSQL. Padrao `5432`
- `DB_NAME`: nome do banco. Padrao `iwr_pdv`
- `DB_USERNAME`: usuario do banco. Padrao `postgres`
- `DB_PASSWORD`: senha do banco. Padrao `postgres`
- `DEFAULT_ADMIN_USERNAME`: usuario administrador inicial. Padrao `admin`
- `DEFAULT_ADMIN_PASSWORD`: senha inicial. Padrao `admin123`
- `DEFAULT_ADMIN_DISPLAY_NAME`: nome exibido no sistema. Padrao `Administrador`

## Como executar

1. Suba o banco com `docker compose up -d` na raiz do projeto.
2. Rode `mvnw.cmd spring-boot:run`.

## Estrutura inicial

- `common`: configuracoes compartilhadas e tratamento global de erros
- `health`: endpoint e servico de healthcheck
- `db/migration`: migrations do Flyway

## Endpoint inicial

- `GET /health`
- `GET /actuator/health`

## Endpoints de autenticacao

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Os endpoints de produto e venda exigem sessao autenticada.

## Endpoints de produto

- `POST /api/products`
- `GET /api/products`
- `GET /api/products/{productId}`
- `PUT /api/products/{productId}`
- `PATCH /api/products/{productId}/activation`
- `GET /api/products/{productId}/barcode`
- `GET /api/products/{productId}/label`

## Endpoints de venda

- `POST /api/sales`
- `GET /api/sales`
- `GET /api/sales/{saleId}`
- `POST /api/sales/{saleId}/cancel`
- `GET /api/sales/{saleId}/receipt`

## Endpoints de promissorias

- `GET /api/promissory-notes`
- `GET /api/promissory-notes/due-today`
- `POST /api/promissory-notes/{noteId}/payments`
- `GET /api/promissory-notes/{noteId}/payments`
- `GET /api/promissory-notes/{noteId}/whatsapp-message`
- `POST /api/promissory-notes/renegotiations`

## Swagger

- `GET /swagger-ui.html`
- `GET /v3/api-docs`
