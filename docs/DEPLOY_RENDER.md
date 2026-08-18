# Deploy independente no Render

Este pacote mantém o banco **MySQL compatível** já utilizado pelo sistema. Por isso, a configuração recomendada é **Render Web Service** para frontend e backend juntos, conectado a **Aiven for MySQL**. Aiven oferece um serviço MySQL gratuito sem prazo de expiração, com 1 GB de RAM e 1 GB de disco; serviços sem uso contínuo podem ser desligados, mas podem ser religados. [1]

> Não use o PostgreSQL gratuito do Render para este código sem uma migração dedicada: o sistema atual usa Drizzle com dialeto MySQL. Além disso, o Postgres gratuito do Render expira após 30 dias e seus dados são apagados após o período de carência se não houver upgrade. [2]

## 1. Criar o banco MySQL gratuito

Crie uma conta em [Aiven](https://aiven.io/free-mysql-database), selecione **MySQL Free** e aguarde o status **Running**. Na tela de conexão, copie a URI MySQL completa. O servidor deve usar TLS; mantenha `DATABASE_SSL=true` no Render. Aiven permite uso gratuito sem cartão de crédito e sem limite de prazo, dentro das restrições do plano. [1]

## 2. Enviar o código a um repositório GitHub

Extraia o ZIP de deploy e envie os arquivos para um repositório privado ou público no GitHub. Os arquivos `render.yaml` e `index.html` ficam na raiz; o código React permanece em `client/src`. Não envie `.env` com senhas reais.

## 3. Criar o serviço no Render

No [Render Dashboard](https://dashboard.render.com/), selecione **New → Blueprint**, conecte o repositório e confirme o arquivo `render.yaml`. Escolha o plano **Free** para testes. O Render inicia serviços web Node a partir dos comandos de build e start definidos no Blueprint; eles devem escutar a porta fornecida pela variável `PORT`. [3]

Preencha os campos solicitados como segredo:

| Variável | Valor a informar |
|---|---|
| `DATABASE_URL` | URI MySQL copiada do Aiven |
| `GESTOR_ACCESS_PASSWORD` | Senha exclusiva do Gestor |
| `INITIAL_SUPERVISOR_PASSWORD` | Senha inicial de Paulo, Rodrigo e Aparecido |
| `RAULTRAVAGIN_INITIAL_PASSWORD` | Senha inicial de `raultravagin` |

O Render gera `JWT_SECRET` automaticamente. Cada inicialização executa as migrações e verifica as quatro rotas, a Base Operacional, os postos iniciais e os supervisores. O processo é idempotente: publicar novamente, reiniciar ou retornar de repouso não duplica os registros iniciais.

## 4. Acessar e operar

Quando o deploy terminar, abra a URL `https://<nome-do-servico>.onrender.com`. Supervisores e Gestor passam a usar o mesmo banco remoto, permitindo que os checklists e as rotas preenchidos por um aparelho apareçam no painel dos demais na próxima atualização do sistema.

O serviço gratuito do Render entra em repouso após 15 minutos sem tráfego e pode levar cerca de um minuto para responder ao próximo acesso. O plano gratuito também tem limite mensal de horas; use-o para testes ou operação leve. [2]

## Limites e itens opcionais

O login de supervisores e o login por senha do Gestor funcionam sem serviços Manus. O login administrativo via OAuth Manus fica desativado por `MANUS_OAUTH_ENABLED=false`. O mapa operacional requer uma chave própria do Google Maps caso seja ativado fora da infraestrutura atual. O código de rotas, checklist, KM, relatórios, escala, postos e sincronização pelo banco permanece no serviço web.

## Referências

[1]: https://aiven.io/docs/products/mysql/concepts/mysql-free-tier "Aiven for MySQL free tier"
[2]: https://render.com/docs/free "Render Free instances"
[3]: https://render.com/docs/web-services "Render Web Services"
