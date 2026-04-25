# IWR PDV

Fundacao tecnica do sistema de gestao de loja da IWR Modas.

## Stack

- Frontend: React, TypeScript e Vite
- Backend: Spring Boot e Java 21
- Banco: PostgreSQL
- Migrations: Flyway

## Estrutura

- [backend](C:\Users\wayst\OneDrive\Desktop\Projetos\iwr-pdv\backend)
- [frontend](C:\Users\wayst\OneDrive\Desktop\Projetos\iwr-pdv\frontend)
- [docker-compose.yml](C:\Users\wayst\OneDrive\Desktop\Projetos\iwr-pdv\docker-compose.yml)
- [CHECKLIST_HOMOLOGACAO_HARDWARE.md](C:\Users\wayst\OneDrive\Desktop\Projetos\iwr-pdv\CHECKLIST_HOMOLOGACAO_HARDWARE.md)

## Como subir o ambiente

1. Inicie o PostgreSQL com `docker compose up -d`.
2. Suba o backend com `backend\mvnw.cmd spring-boot:run`.
3. Suba o frontend com `npm install` e `npm run dev` dentro de `frontend`.

## Entregas atuais

- Sprint 0 concluida com fundacao tecnica, healthcheck e integracao inicial
- Sprint 1 concluida com CRUD de produtos
- Sprint 2 concluida com codigo unico e QR Code
- Sprint 3 concluida em software com etiquetas imprimiveis de produto
- Sprint 4 iniciada com tela de venda e carrinho local por codigo
- busca por nome ou codigo
- ativacao e inativacao de produtos
- frontend com tela de cadastro, listagem, edicao e caixa
