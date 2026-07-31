# Plano de Rotas Pro Allen - TODO

## Banco de Dados
- [x] Criar tabelas: routes, posts, supervisor_routes, visit_checklists, checklistItems, supervisor_locations, postVisitHistory
- [x] Seed de dados com as 4 rotas e 26 postos
- [x] Índices para performance de queries

## Backend - APIs
- [x] API de autenticação (login/logout) com controle de papéis
- [x] API de rotas (listar, obter detalhes)
- [x] API de postos (listar por rota, obter detalhes)
- [x] API de checklist (criar, atualizar, listar)
- [x] API de KM (registrar inicial e final)
- [x] API de localização GPS (salvar coordenadas)
- [x] API de relatórios (por período, filtros)
- [x] adminProcedure para proteção de endpoints administrativos
- [x] API de postos com prioridade de visita (cores: vermelho, amarelo, verde)

## Frontend - Painel Supervisor
- [x] Página de login
- [x] Dashboard do supervisor (seleção de rota)
- [x] Página de rota selecionada (lista de postos com status)
- [x] Página de detalhes do checklist de visita
- [x] Formulário de KM inicial (ao iniciar rota)
- [x] Formulário de KM final (ao encerrar rota)
- [x] Envio periódico de GPS (enquanto rota ativa)
- [x] Feedback visual de sucesso/erro nas ações
- [x] Dados reais dos postos (nome, endereço) exibidos corretamente

## Frontend - Painel Administrativo
- [x] Dashboard administrativo com navegação
- [x] Mapa em tempo real com posição dos supervisores
- [x] Página de relatórios com filtros por período
- [x] Tabela de visitas realizadas
- [x] Aba de Prioridades com sistema de cores (vermelho >10d, amarelo 5-10d, verde <5d)
- [x] Componente PostPriorityCard para exibir prioridades
- [x] Seleção de rota para visualizar prioridades específicas

## Design e Estilo
- [x] Definir paleta de cores elegante (azul e branco)
- [x] Implementar tema visual refinado
- [x] Garantir responsividade em mobile
- [x] Adicionar animações sutis e transições

## Testes
- [x] Testes unitários das APIs (vitest)
- [x] Testes de integração do fluxo supervisor
- [x] Validação do painel administrativo

## Alterações Solicitadas
- [x] Adicionar campos de hora de chegada e saída em cada posto
- [x] Remover mapa do painel administrativo
- [x] Criar interface para registrar horários durante a visita
- [x] Adicionar coluna de horários no relatório de visitas


## Funcionalidades Avançadas
- [x] Exportar relatórios em CSV com dados formatados
- [x] Gráficos de tempo médio de visita por posto/rota
- [x] Gráficos de conformidade do checklist
- [x] Dashboard de métricas com KPIs
- [x] Análise de desempenho por período
- [x] Página de exportação de relatórios
- [x] Página de métricas com gráficos interativos
- [x] Navegação entre páginas administrativas
