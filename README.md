# Pro Allen — Sistema de Gestão de Supervisores

Este pacote contém o código-fonte completo do sistema Pro Allen. A aplicação reúne login local de supervisores e gestor, rotas, visitas, checklists, quilometragem, GPS, coberturas fora de rota e relatórios diários em Word.

## Execução em outro servidor

O projeto usa **Node.js 22+**, **pnpm 10+** e um banco **MySQL/TiDB compatível**. Depois de extrair o arquivo ZIP, crie o arquivo de ambiente e instale as dependências.

```bash
cp environment.template .env
pnpm install --frozen-lockfile
pnpm db:push
pnpm build
pnpm start
```

Em desenvolvimento, use:

```bash
pnpm dev
```

O servidor respeita a variável `PORT`; quando ela não for informada, inicia em `3000`.

## Variáveis obrigatórias

| Variável | Finalidade |
|---|---|
| `DATABASE_URL` | String de conexão com o banco MySQL/TiDB. |
| `JWT_SECRET` | Chave longa e aleatória para proteger sessões locais. |
| `GESTOR_ACCESS_PASSWORD` | Senha exclusiva da página do Gestor. |
| `VITE_APP_TITLE` | Título público do aplicativo; o valor recomendado é `Pro Allen`. |

As senhas iniciais de supervisores podem ser fornecidas por `INITIAL_SUPERVISOR_PASSWORD` e `RAULTRAVAGIN_INITIAL_PASSWORD` durante o provisionamento. Não use os valores de exemplo em produção.

## Portabilidade

O build do Vite utiliza `base: "./"`, portanto os arquivos CSS e JavaScript compilados são referenciados com caminhos relativos. O HTML não carrega mais o script de analytics específico da plataforma de desenvolvimento.

Os fluxos de login local de Supervisor e Gestor funcionam somente com banco de dados e as variáveis obrigatórias. A integração OAuth e os serviços de armazenamento/Google Maps mantêm adaptadores opcionais da plataforma original; para usá-los em outro provedor, configure credenciais compatíveis ou substitua esses adaptadores pelos serviços escolhidos.

## Segurança antes da publicação

Use credenciais novas no arquivo `.env`, nunca envie esse arquivo para repositórios e configure HTTPS/reverse proxy no servidor de produção. O arquivo ZIP não inclui `.env`, dependências instaladas, logs, bancos locais, artefatos de build ou segredos.
