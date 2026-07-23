# Plano de Rotas Pro Allen - TODO

## Banco de Dados
- [x] Criar tabelas: routes, posts, supervisor_routes, visit_checklists, checklistItems, supervisor_locations, postVisitHistory
- [x] Seed de dados com as 4 rotas e 26 postos
- [ ] Índices para performance de queries

## Backend - APIs
- [x] API de autenticação (login/logout) com controle de papéis
- [x] API de rotas (listar, obter detalhes)
- [x] API de postos (listar por rota, obter detalhes)
- [x] API de checklist (criar, atualizar, listar)
- [x] API de KM (registrar inicial e final)
- [x] API de localização GPS (salvar coordenadas)
- [x] API de relatórios (por período, filtros)
- [ ] Cron periódico para enviar GPS (Heartbeat)

## Frontend - Painel Supervisor
- [x] Página de login
- [x] Dashboard do supervisor (seleção de rota)
- [x] Página de rota selecionada (lista de postos com status)
- [x] Página de detalhes do checklist de visita
- [x] Formulário de KM inicial (ao iniciar rota)
- [x] Formulário de KM final (ao encerrar rota)
- [x] Envio periódico de GPS (enquanto rota ativa)
- [ ] Notificações de prioridade por prazo de visita (sistema de cores)

## Frontend - Painel Administrativo
- [x] Dashboard administrativo com navegação
- [x] Mapa em tempo real com posição dos supervisores
- [x] Página de relatórios com filtros por período
- [x] Tabela de visitas realizadas
- [ ] Tabela de checklists preenchidos
- [ ] Gráficos de KM percorrido

## Design e Estilo
- [x] Definir paleta de cores elegante (azul e branco)
- [x] Implementar tema visual refinado
- [ ] Garantir responsividade em mobile
- [ ] Adicionar animações sutis

## Testes
- [ ] Testes unitários das APIs
- [ ] Testes de integração do fluxo supervisor
- [ ] Testes do painel administrativo
