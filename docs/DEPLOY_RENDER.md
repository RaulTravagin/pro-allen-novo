# Deploy independente no Render com Neon PostgreSQL

Este projeto utiliza **PostgreSQL com Drizzle e node-postgres**, sendo compatível com Neon. O frontend e a API são publicados juntos em um Web Service do Render; o banco é mantido externamente no Neon.

## 1. Criar e configurar o banco Neon

No painel do Neon, abra o projeto criado e copie a **connection string** do banco em formato PostgreSQL. No Render, defina essa URI como `DATABASE_URL` e configure `DATABASE_SSL=true`. Nunca envie essa URI ao GitHub, pois ela contém credenciais do banco.

## 2. Publicar o código no GitHub

Na raiz do repositório devem estar `index.html`, `render.yaml`, `package.json`, `client/`, `server/`, `drizzle-pg/` e `docs/`. O arquivo `render.yaml` descreve o serviço e a inicialização do banco.

## 3. Criar o serviço no Render

No [Render Dashboard](https://dashboard.render.com/), escolha **New → Blueprint**, conecte o repositório e confirme o arquivo `render.yaml`. Preencha os segredos abaixo quando o Render solicitar:

| Variável | Finalidade |
|---|---|
| `DATABASE_URL` | URI PostgreSQL copiada do Neon |
| `DATABASE_SSL` | Use `true` para o Neon |
| `GESTOR_ACCESS_PASSWORD` | Senha exclusiva do Gestor |
| `INITIAL_SUPERVISOR_PASSWORD` | Senha inicial de Paulo, Rodrigo e Aparecido |
| `RAULTRAVAGIN_INITIAL_PASSWORD` | Senha inicial de `raultravagin` |

O Render gera `JWT_SECRET` automaticamente. Na primeira inicialização, o comando `start:render` executa a migração PostgreSQL em `drizzle-pg/`, verifica as quatro rotas, a Base Operacional, os postos e as contas iniciais. Esse seed é idempotente e não duplica os dados em reinicializações.

## 4. Operação online

Após o deploy, acesse a URL `https://<nome-do-servico>.onrender.com`. Os supervisores e o Gestor usarão o mesmo banco Neon, permitindo a atualização compartilhada de rotas, checklists, KM, escala e relatórios. O login OAuth Manus permanece desativado no deploy externo; os logins locais e o acesso por senha do Gestor continuam disponíveis.

O Mapa Operacional usa **Leaflet com tiles do OpenStreetMap**, sem chave de API ou variável adicional no Render. Os tiles são carregados diretamente do OpenStreetMap e os marcadores são renderizados a partir das coordenadas de postos e do GPS dos supervisores.
