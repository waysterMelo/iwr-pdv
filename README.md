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
- [CHECKLIST_IMPLANTACAO.md](C:\Users\wayst\OneDrive\Desktop\Projetos\iwr-pdv\CHECKLIST_IMPLANTACAO.md)
- [MANUAL_OPERACIONAL.md](C:\Users\wayst\OneDrive\Desktop\Projetos\iwr-pdv\MANUAL_OPERACIONAL.md)

## Como subir o ambiente

1. Inicie o PostgreSQL com `docker compose up -d`.
2. Suba o backend com `backend\mvnw.cmd spring-boot:run`.
3. Suba o frontend com `npm install` e `npm run dev` dentro de `frontend`.
4. Entre no sistema com `admin` / `admin123` no primeiro acesso local.

Antes de entregar ao cliente, defina `DEFAULT_ADMIN_USERNAME`, `DEFAULT_ADMIN_PASSWORD` e `DEFAULT_ADMIN_DISPLAY_NAME` no ambiente do backend.

## Entregas atuais

- Sprint 0 concluida com fundacao tecnica, healthcheck e integracao inicial
- Sprint 1 concluida com CRUD de produtos
- Sprint 2 concluida com codigo unico e QR Code
- Sprint 3 concluida em software com etiquetas imprimiveis de produto
- Sprint 4 concluida com tela de venda e leitura por codigo
- Sprint 5 concluida com fechamento de venda e baixa automatica de estoque
- Sprint 6 concluida com historico de vendas e filtros basicos
- Sprint 7 preparada em software com manual e checklist de implantacao
- login de acesso ao sistema com sessao protegida
- pagamento por dinheiro, Pix, debito e credito
- abertura, movimentacao e fechamento de caixa
- cancelamento de venda com estorno de estoque
- recibo nao fiscal imprimivel
- busca por nome ou codigo
- ativacao e inativacao de produtos
- frontend com tela de cadastro, listagem, edicao, caixa e historico
