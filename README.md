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

## Como subir o ambiente com Docker

1. Suba banco, backend e frontend com `docker compose up -d --build`.
2. Acesse o sistema em `http://localhost:5173`.
3. Acesse o backend em `http://localhost:8080/health`.
4. Acesse o Swagger em `http://localhost:5173/swagger-ui.html` ou `http://localhost:8080/swagger-ui.html`.
5. Entre no sistema com `admin` / `admin123` no primeiro acesso local.

Comandos uteis:

- Ver logs: `docker compose logs -f`.
- Parar containers: `docker compose down`.
- Parar e apagar o banco local: `docker compose down -v`.
- Rebuild completo: `docker compose build --no-cache`.

Para definir o usuario inicial em Docker, execute o compose com variaveis de ambiente:

```powershell
$env:DEFAULT_ADMIN_USERNAME='admin'
$env:DEFAULT_ADMIN_PASSWORD='troque-esta-senha'
$env:DEFAULT_ADMIN_DISPLAY_NAME='Administrador'
docker compose up -d --build
```

## Como subir em desenvolvimento local sem Docker

Este modo roda tudo no `localhost` e evita URLs antigas de tunnel/Cloudflare.

### 1. PostgreSQL local

Tenha um PostgreSQL rodando localmente na porta `5432` com estes dados:

- Banco: `iwr_pdv`
- Usuario: `postgres`
- Senha: `postgres`

Se ainda nao tiver o banco criado, crie com:

```sql
CREATE DATABASE iwr_pdv;
```

### 2. Backend local

No PowerShell ou CMD:

```powershell
cd backend
$env:DB_HOST='localhost'
$env:DB_PORT='5432'
$env:DB_NAME='iwr_pdv'
$env:DB_USERNAME='postgres'
$env:DB_PASSWORD='postgres'
$env:DEFAULT_ADMIN_USERNAME='admin'
$env:DEFAULT_ADMIN_PASSWORD='admin123'
$env:DEFAULT_ADMIN_DISPLAY_NAME='Administrador'
.\mvnw.cmd spring-boot:run
```

O backend deve responder em:

- `http://localhost:8080/health`
- `http://localhost:8080/swagger-ui.html`

### 3. Frontend local

Em outro terminal:

```powershell
cd frontend
npm install
npm run dev
```

Acesse:

- `http://localhost:5173`

O arquivo `frontend/.env.development` deixa `VITE_API_BASE_URL` vazio. Assim o frontend usa `/api` e o proxy do Vite encaminha para `http://localhost:8080`.

Se o navegador ainda tentar chamar Cloudflare ou outro endereco antigo, limpe os dados do site no DevTools ou abra em aba anonima.

Antes de entregar ao cliente, defina `DEFAULT_ADMIN_USERNAME`, `DEFAULT_ADMIN_PASSWORD` e `DEFAULT_ADMIN_DISPLAY_NAME` no ambiente do backend.

## Modo Smartphone

O frontend detecta telas de ate 720px e troca automaticamente para o layout mobile. Nesse modo, a tela inicial mostra a acao de venda rapida e o fluxo de venda usa camera do celular com `@zxing/browser` para ler QR Code, alem de manter entrada manual do codigo.

Para a camera funcionar em celular, o acesso precisa ocorrer em contexto seguro: HTTPS em homologacao/producao ou `localhost` em desenvolvimento. Em acesso por IP local com HTTP comum, navegadores mobile podem bloquear `getUserMedia` e impedir a abertura da camera.

## Entregas atuais

- Sprint 0 concluida com fundacao tecnica, healthcheck e integracao inicial
- Sprint 1 concluida com CRUD de produtos
- Sprint 2 concluida com codigo unico e QR Code
- Sprint 3 concluida em software com etiquetas imprimiveis de produto
- Sprint 4 concluida com tela de venda e leitura por codigo
- Sprint 5 concluida com fechamento de venda e baixa automatica de estoque
- Sprint 6 concluida com historico de vendas e filtros basicos
- Sprint 7 preparada em software com manual e checklist de implantacao
- Sprint 8 concluida em software com modo smartphone, venda mobile, leitura por camera e fallback manual
- login de acesso ao sistema com sessao protegida
- pagamento por dinheiro, Pix, debito e credito
- abertura, movimentacao e fechamento de caixa
- cancelamento de venda com estorno de estoque
- recibo nao fiscal imprimivel
- busca por nome ou codigo
- ativacao e inativacao de produtos
- frontend com tela de cadastro, listagem, edicao, caixa e historico
