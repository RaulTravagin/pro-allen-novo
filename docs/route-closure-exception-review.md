# Revisão — encerramento de rota e serialização das mutations

## Decisões e comportamento

O schema já possuía `postVisitHistory`, que registra visitas individuais, não eventos de fechamento de rota; ele foi preservado. Foi adicionada uma tabela de exceções independente e uma migração PostgreSQL aditiva. Cada exceção registra supervisor, rota, instante, justificativa e snapshot JSON das pendências; não se sobrescreve histórico anterior.

O único caminho de conclusão é `supervisorRoutes.finishShift`. A operação verifica no servidor propriedade, estado `in_progress`, KM final, postos/visitas/relatos e registra fechamento e exceção na mesma transação. Sem pendências, fecha normalmente. Se houver posto não atendido, visita pendente/ignorada/em atendimento ou relato aplicável não enviado, a primeira tentativa não fecha: devolve o snapshot. Nova tentativa exige justificativa (8–2000 caracteres), gravada com o fechamento. Para cada posto/tipo de atendimento usa-se o estado mais recente; relatos pendentes históricos continuam sinalizados. A Base Operacional não é tratada como visita a posto de cliente.

`withLockedSupervisorRoute` é o ponto comum: seleciona e bloqueia com `FOR UPDATE` a linha de `supervisorRoutes`, filtrando pelo ID e supervisor autenticado, e avalia o estado **depois** de adquirir o lock. `finishShift`, cancelamento e todas as mutations de checklist usam esse helper. `createForRoute`, `startNewVisit`, `createCoverage`, `checkIn`, `checkOut`, `submitOccurrence` e `markVisited` fazem revalidação e inserts/updates na transação; `checkOut` e `markVisited` também gravam histórico nessa mesma transação. A preparação da Base Operacional, quando necessária em `createCoverage`, ocorre somente após o lock e na própria transação (com advisory lock transacional para evitar duplicatas globais). A leitura inicial do ID da rota da visita serve apenas para localizar o lock; o checklist é relido sob lock e conferido contra essa rota. Os helpers genéricos de escrita sem lock foram removidos. A checagem de visita ativa e a idempotência da preparação também ocorrem sob o lock da rota.

`updateKm` não recebe KM final e não altera rotas concluídas/canceladas. O `markVisited` legado descarta timestamps do cliente e grava os do servidor. A UI de exceção continua exibindo justificativa e snapshot auditável.

## Validação e limitações

Após a última alteração, `pnpm check` passou; os testes focados passaram (9 arquivos, 34 testes), incluindo `route-checklist-lock.test.ts`, que simula um fechamento retendo o lock: a mutation aguarda, lê o estado concluído após a liberação e não chega ao callback de insert. `pnpm build` passou. `drizzle-kit check` passou com URL fictícia apenas para validar journal/snapshot, sem conexão a banco. `git diff --check` passou.

A suíte completa **não foi repetida** após o aviso para evitar integrações amplas. A execução já concluída antes do aviso terminou com 54 arquivos e 144 testes aprovados; 6 arquivos/13 testes falharam por configuração/dados ausentes no ambiente, não relacionados a estas mutations: `gestor-access.test.ts` e `local-supervisor-accounts.integration.test.ts` não tinham senhas de teste; `local-supervisor-auth.test.ts` também não tinha `JWT_SECRET`; `neon-backup-connection.test.ts` não tinha `DATABASE_URL`; `raul-history.integration.test.ts` não encontrou os dados operacionais esperados; e `branding.test.tsx` não tinha `VITE_APP_TITLE`. Nenhuma leitura ou impressão de valores de variáveis de conexão/secrets foi feita.

O ambiente usa Node.js v24.19.0, enquanto `package.json` declara `>=22 <23`; o pnpm atual também avisa que configurações `pnpm.*` antigas no `package.json` são ignoradas. O build emitiu o aviso de chunks de cliente acima de 500 kB.

## Migração e integração pendente

A migração e o snapshot da exceção permanecem localmente como `0010_route_closure_exception_audit`; não foram aplicados. Há outra feature em paralelo que também cria uma migração Drizzle `0010`. **Não publique nem aplique este SQL isoladamente. Ao integrar as branches, reconcilie o schema combinado e renumere/regere a migração e o snapshot desta rota com o próximo índice livre, atualizando o journal para evitar colisão.** A outra branch e `main` não foram incorporadas ou modificadas.

Não executei aplicação de migrações nem consultas manuais ao banco; `drizzle-kit check` verificou apenas arquivos locais com URL fictícia. A suíte ampla acima já havia terminado antes do aviso e incluía testes rotulados como integração; não foi repetida depois, e não inspecionei nem imprimi valores de conexão/secrets. Nenhum push, merge ou deploy foi realizado. O log de exceções é append-only pelos fluxos da aplicação (sem endpoint de edição/exclusão); não há proteção contra alteração direta por credenciais SQL privilegiadas.
