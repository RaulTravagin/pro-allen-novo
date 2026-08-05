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


## Ajustes de Interface - Cards de Postos
- [x] Adicionar botão "Registrar Chegada" (check-in) nos cards
- [x] Adicionar botão "Registrar Saída" (check-out) nos cards
- [x] Implementar estados visuais dos cards (pendente, em visita, concluído)
- [x] Registrar geolocalização no check-in
- [x] Salvar horários de chegada e saída
- [x] Atualizar status do card após ações
- [x] Tornar botões responsivos para mobile
- [x] Criar componente PostCard reutilizável
- [x] Integrar APIs de check-in e check-out no backend


## Melhorias Solicitadas - Visualização de Geolocalização e Horários
- [x] Exibir indicador visual de geolocalização capturada no check-in
- [x] Mostrar endereço ou coordenadas GPS no card após check-in
- [x] Exibir horários exatos de entrada e saída de forma mais visível
- [x] Adicionar ícone visual claro no botão de check-in (indicador de clique)
- [x] Melhorar feedback visual após conclusão da visita
- [x] Adicionar campos de geolocalização ao banco de dados
- [x] Capturar coordenadas GPS ao check-in e check-out
- [x] Exibir duração da visita no card
- [x] Mostrar coordenadas em formato legível (lat, lng)


## Otimizações Manus 1.6
- [x] Auditoria completa de código
- [x] Otimizar queries do banco de dados
- [x] Adicionar relações e índices estratégicos
- [x] Implementar cache inteligente
- [x] Otimizar componentes React com React.memo
- [x] Usar useMemo e useCallback para performance
- [x] Melhorar responsividade mobile
- [x] Implementar lazy loading de componentes
- [x] Otimizar renderizações desnecessárias
- [x] Melhorar UX/UI com animações suaves
