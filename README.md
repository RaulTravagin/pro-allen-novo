# Pro Allen — Sistema de Gestão de Supervisores

Este pacote contém o código-fonte completo do sistema Pro Allen. A aplicação reúne login local de supervisores e gestor, rotas, visitas, checklists, quilometragem, GPS, coberturas fora de rota e relatórios diários em Word.

## Execução em outro servidor

O projeto usa **Node.js 22+**, **pnpm 10+** e um banco **PostgreSQL compatível**. Depois de extrair o arquivo ZIP, crie o arquivo de ambiente e instale as dependências.

```bash
cp environment.template .env
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
pnpm start
```

Em desenvolvimento, use:

```bash
pnpm dev
```

O servidor respeita a variável `PORT`; quando ela não for informada, inicia em `3000`.

## Variáveis obrigatórias

| Variável                 | Finalidade                                                       |
| ------------------------ | ---------------------------------------------------------------- |
| `DATABASE_URL`           | String de conexão com o banco PostgreSQL.                        |
| `JWT_SECRET`             | Chave longa e aleatória para proteger sessões locais.            |
| `GESTOR_ACCESS_PASSWORD` | Senha exclusiva da página do Gestor.                             |
| `VITE_APP_TITLE`         | Título público do aplicativo; o valor recomendado é `Pro Allen`. |

As senhas iniciais de supervisores podem ser fornecidas por `INITIAL_SUPERVISOR_PASSWORD` e `RAULTRAVAGIN_INITIAL_PASSWORD` durante o provisionamento. Não use os valores de exemplo em produção.

## Módulo de gestão de pessoal e financeiro

O módulo está disponível em `/pessoal` para usuários autenticados. As rotas adicionais `/rh/funcionarios` e `/financeiro/pagamentos` isolam, respectivamente, o cadastro/auditoria do RH e a fila de quitação do Financeiro, sem alterar as URLs operacionais atuais da Supervisão. O módulo adiciona o fluxo completo de **Folgas Trabalhadas (FTs)**, faltas, atestados médicos com upload, serviços extras, auditoria do RH, quitação financeira, exportação CSV e manutenção de funcionários.

O banco usa as tabelas `personnel_employees`, `personnel_fts`, `personnel_occurrences` e `personnel_extras`, além dos enums e da coluna `users.personnelRole` criados na migração `drizzle-pg/0006_easy_pride.sql`. A migração aditiva `drizzle-pg/0007_personnel_access_and_ft_payment.sql` acrescenta cargo, posto principal e `data_prevista_pagamento` sem apagar ou renomear estruturas existentes. Para FT, referências do dia 01 ao 15 recebem pagamento previsto no dia 20 do mesmo mês; referências do dia 16 em diante recebem pagamento previsto no dia 15 do mês seguinte. Depois de configurar o banco, aplique as migrações com:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
pnpm start
```

O perfil efetivo segue estas regras: contas existentes com `users.role = admin` são tratadas como **ADM**; contas operacionais sem `personnelRole` são tratadas como **SUPERVISOR**. O ADM pode atribuir **SUPERVISOR**, **RH**, **FINANCEIRO** ou **ADM** na aba **Perfis de acesso** dentro de `/pessoal`. Supervisores lançam registros, RH aprova ou rejeita, e Financeiro quita somente valores aprovados.

O upload de atestados aceita PDF, JPG, PNG e WEBP de até 10 MB. Os bytes são enviados para o storage configurado e apenas a referência do arquivo é persistida no banco. Para habilitar o upload, defina `BUILT_IN_FORGE_API_URL` e `BUILT_IN_FORGE_API_KEY`; sem essas variáveis, os demais fluxos do módulo continuam disponíveis, mas o envio de atestado será recusado com uma mensagem de configuração.

## Portabilidade

O build do Vite utiliza `base: "/"`, mantendo os arquivos CSS e JavaScript na raiz do domínio. Essa configuração permite abrir links diretos em rotas profundas, como `/gestor/acesso`, desde que o servidor direcione rotas desconhecidas para `index.html` (SPA fallback). O HTML não carrega mais o script de analytics específico da plataforma de desenvolvimento.

Os fluxos de login local de Supervisor e Gestor funcionam somente com banco de dados e as variáveis obrigatórias. A integração OAuth e os serviços de armazenamento/Google Maps mantêm adaptadores opcionais da plataforma original; para usá-los em outro provedor, configure credenciais compatíveis ou substitua esses adaptadores pelos serviços escolhidos.

## Segurança antes da publicação

Use credenciais novas no arquivo `.env`, nunca envie esse arquivo para repositórios e configure HTTPS/reverse proxy no servidor de produção. O arquivo ZIP não inclui `.env`, dependências instaladas, logs, bancos locais, artefatos de build ou segredos.
