# Plano de Rotas Pro Allen — Histórico de Entregas

## Base do Sistema
- [x] Cadastro das 4 rotas e dos postos iniciais
- [x] Autenticação Manus OAuth com papéis de supervisor e administrador
- [x] Cadastro de rota diária, KM inicial/final e relatórios por período
- [x] Checklist de visita com itens de conformidade, observações e duração
- [x] Priorização de postos por dias sem visita: vermelho, amarelo e verde
- [x] Painel administrativo sem mapa, conforme solicitação do usuário
- [x] Exportação CSV, métricas com dados reais e estados vazios informativos

## Fluxo de Presença por Posto
- [x] Botão individual “Registrar chegada” em cada card pendente
- [x] Captura automática de horário no check-in
- [x] Captura de geolocalização no check-in quando autorizada pelo navegador
- [x] Estado “Em visita” com horário de entrada visível e botão “Registrar saída”
- [x] Captura automática de horário no check-out
- [x] Captura de geolocalização no check-out quando autorizada pelo navegador
- [x] Estado desabilitado “Visita concluída” com horários de entrada e saída
- [x] Ação “Registrar nova chegada” após conclusão, preservando o histórico anterior
- [x] Bloqueio de duas visitas simultâneas para o mesmo supervisor
- [x] Tratamento de GPS indisponível sem bloquear o registro de presença

## Revisão e Qualidade
- [x] Removida a exibição do nome pessoal do usuário nos cabeçalhos
- [x] Reforçada a autorização por proprietário da rota nas procedures de visita
- [x] Atualizada a interface de checklist para usar o fluxo oficial de chegada/saída
- [x] Criado cabeçalho administrativo unificado e navegação consistente
- [x] Validados TypeScript, testes Vitest e build de produção
- [x] Adicionado teste automatizado da criação de nova visita após conclusão
- [x] Verificados estados administrativos em desktop e mobile
- [x] Checkpoint da atualização de presença salvo: 24dc0464

## Teste Operacional do Card de Posto
- [x] Preparar cenário isolado em testes automatizados, sem alterar dados operacionais
- [x] Executar check-in e confirmar que o card mostra “Registrar saída” e horário de entrada
- [x] Executar check-out e confirmar tag “Visita concluída” com os dois horários
- [x] Confirmar que “Registrar chegada” volta a ficar disponível no mesmo card
- [x] Corrigir a divergência encontrada: a chegada reaparecida agora executa o check-in diretamente
- [x] Registrar evidência por teste de interação: chegada → saída → visita concluída → chegada reaparecida

## Correção do Preview dos Cards
- [x] Encontrar por que a rota real não exibe os cards de postos no preview
- [x] Renderizar “Registrar chegada” de forma visível em cada card pendente
- [x] Confirmar a troca visual para “Registrar saída” após o clique no mesmo card
- [x] Reiniciar o preview e validar o acesso à operação de campo na rota real
- [x] Validar TypeScript, teste de interação do card, testes de backend e build
- [x] Salvar checkpoint somente após a validação visual

## Correção de Preparação de Rota
- [x] Reproduzir e diagnosticar a rota aberta que não aparece no painel
- [x] Reutilizar a rota aberta do dia em vez de tentar criar outra
- [x] Corrigir a navegação que está gerando NOT_FOUND
- [x] Exibir uma mensagem clara quando houver uma rota já aberta
- [x] Testar criação, reutilização e abertura da rota no preview
- [x] Confirmar visualmente a rota real com painel da viatura e quatro cards de postos

## Controle Independente da Viatura
- [x] Criar área própria para KM inicial e final da viatura
- [x] Exibir status de quilometragem e total percorrido fora da lista de postos
- [x] Remover dependência visual e funcional entre registro de KM e cards dos postos
- [x] Manter cards de postos focados somente em chegada, saída, checklist e observações
- [x] Validar TypeScript, 9 testes automatizados, build e reinício do preview
- [x] Salvar checkpoint da atualização do controle da viatura

## Nota de Histórico
- [x] O checklist anterior continha observações repetidas e não acionáveis geradas durante uma recuperação de workspace. Ele foi normalizado nesta versão para manter apenas entregas verificáveis e o histórico relevante.

## Painel do Gestor
- [x] Definir senha única para o único gestor autorizado
- [x] Solicitar e armazenar a senha única do Gestor como segredo de ambiente
- [x] Criar uma sessão com perfil Gestor e proteger as APIs exclusivas do painel
- [x] Criar um acesso exclusivo com autenticação do gestor sem expor a senha no código
- [x] Implementar painel consolidado com rotas, visitas, supervisores e KM em tempo real
- [x] Incluir atualização automática a cada 15 segundos e indicação de última atualização dos dados
- [x] Adicionar navegação do Gestor e botão de entrada na tela inicial
- [x] Criar testes de permissão do Gestor e de carregamento dos dados operacionais
- [x] Validar desktop e celular, salvar checkpoint e disponibilizar a versão

## Correção do Acesso do Gestor
- [x] Identificar por que o painel protegido é consultado na tela de senha
- [x] Impedir qualquer consulta ao painel antes da sessão do Gestor estar autenticada
- [x] Adicionar teste de regressão para acesso sem sessão
- [x] Validar o preview da tela de acesso sem erro, salvar checkpoint e disponibilizar a correção

## Próxima Etapa: Google Maps
- [x] Retomar a integração do Google Maps em 15 de agosto de 2026, às 06h, após o levantamento dos endereços dos postos

## Acessos Individuais dos Supervisores
- [x] Criar autenticação local por usuário e senha com hash seguro
- [x] Criar conta de Paulo Murashita
- [x] Criar conta de Rodrigo Ramos
- [x] Criar conta de Aparecido Quirino
- [x] Criar conta de Raul Travagin
- [x] Garantir que cada supervisor acesse apenas suas próprias rotas e visitas
- [x] Testar os quatro logins, validar o preview e salvar checkpoint

## Correção de Rotas para Contas Locais
- [x] Identificar a origem do NOT_FOUND durante a preparação da rota
- [x] Corrigir a criação e a abertura da rota pelo supervisor local
- [x] Criar teste de regressão para preparação de rota em conta local
- [x] Validar o fluxo, salvar checkpoint e disponibilizar a correção

## Simplificação da Tela Inicial
- [x] Remover o botão administrativo “Entrar no Sistema”
- [x] Manter somente os campos de usuário e senha dos supervisores
- [x] Validar o preview e salvar checkpoint da tela simplificada

## Atalho Discreto do Gestor
- [x] Adicionar link discreto para `/gestor/acesso` no rodapé da tela inicial
- [x] Validar o atalho em sessão sem login e salvar checkpoint

## Central Operacional do Gestor
- [x] Consolidar por supervisor a rota atual, o status operacional e o próximo posto
- [x] Exibir postos em atendimento, visitas concluídas, pendentes e duração da visita
- [x] Exibir KM inicial, KM final e total percorrido por viatura
- [x] Exibir última localização GPS, precisão e tempo desde a atualização
- [x] Adicionar alertas para rota parada, GPS desatualizado, visita em andamento e KM pendente
- [x] Criar visão detalhada por supervisor com checklist, horários e observações da rota
- [x] Atualizar automaticamente a central e mostrar a hora da última atualização
- [x] Cobrir permissões, cálculos e estados da central com testes
- [x] Validar desktop e celular, salvar checkpoint e disponibilizar a central

## Ajuste de Entradas Operacionais
- [x] Identificar os registros de Raul Travagin e João Supervisor exibidos na central
- [x] Excluir os dois nomes da lista operacional sem apagar o histórico de campo
- [x] Validar a central atualizada e salvar checkpoint

## Regressão de Acesso do Gestor
- [x] Identificar o componente que dispara o painel protegido em `/gestor/acesso`
- [x] Impedir a consulta do painel antes da sessão do Gestor estar autenticada
- [x] Criar teste de regressão e validar o preview sem sessão
- [x] Salvar checkpoint e disponibilizar a correção

## Correção de Coordenadas GPS nos Postos
- [x] Identificar a conversão de latitude e longitude que causa falha no card
- [x] Normalizar coordenadas numéricas e textuais antes da exibição
- [x] Criar teste de regressão para coordenadas retornadas como texto
- [x] Validar a rota do supervisor, salvar checkpoint e disponibilizar a correção

## Cobertura Fora da Rota
- [x] Exibir postos disponíveis para cobertura fora da rota planejada
- [x] Exigir justificativa do supervisor antes de registrar a cobertura
- [x] Registrar cobertura vinculada à rota diária e ao supervisor responsável
- [x] Permitir chegada, saída e checklist na cobertura com GPS e horários
- [x] Exibir a cobertura e a justificativa na central do Gestor
- [x] Criar testes de autorização, justificativa obrigatória e registro da cobertura
- [x] Validar desktop e celular, salvar checkpoint e disponibilizar o fluxo

## Entrada Direta do Sistema
- [x] Identificar e remover o redirecionamento automático para o Manus OAuth
- [x] Exibir diretamente os acessos locais de Supervisor e Gestor na rota inicial
- [x] Preservar o acesso administrativo existente sem oferecê-lo como entrada padrão
- [x] Testar a abertura em sessão limpa, validar desktop e celular e salvar checkpoint

## Compartilhamento Externo do Site
- [x] Confirmar o endereço de produção correto para compartilhar com clientes
- [x] Verificar que a visibilidade atual exige autenticação externa do Manus
- [x] Alterar a visibilidade do site para pública para abrir diretamente a tela local
- [x] Validar o link público e entregar o endereço final de compartilhamento

## Nova Conta Operacional
- [x] Armazenar de forma protegida a senha inicial de raultravagin
- [x] Criar e ativar a conta local raultravagin como supervisor operacional
- [x] Validar o login da nova conta e confirmar a criação

## Relatório Diário do Gestor
- [x] Consolidar por supervisor a rota, status, postos, horários, checklist, KM, GPS e alertas do dia
- [x] Criar a consulta protegida do relatório diário para o Gestor
- [x] Adicionar controle de geração e visualização clara no Painel do Gestor
- [x] Permitir exportação do relatório diário em formato CSV
- [x] Criar testes de cálculo, conteúdo e proteção do relatório
- [x] Validar visualmente o relatório e a exportação CSV com sessão real do Gestor
- [x] Salvar checkpoint e disponibilizar o recurso

## Relatório Word do Gestor
- [x] Estruturar o documento Word com título, resumo executivo, indicadores e seções por supervisor
- [x] Gerar arquivo `.docx` com rotas, postos, horários, checklist, KM, GPS, coberturas e alertas
- [x] Substituir a exportação principal de CSV pela exportação organizada em Word
- [x] Testar a abertura e o conteúdo interno do documento Word gerado
- [x] Validar a interface, salvar checkpoint e disponibilizar o novo formato

## Simplificação da Tabela do Relatório Word
- [x] Remover a coluna de checklist por posto da tabela do Word
- [x] Redistribuir a largura entre posto, situação, horários e observações
- [x] Validar o conteúdo do documento gerado e salvar checkpoint

## Regressão de Acesso do Gestor — Agosto
- [x] Identificar a procedure protegida chamada em `/gestor/acesso`
- [x] Impedir a montagem ou consulta do dashboard antes da senha do Gestor
- [x] Criar regressão e validar em sessão limpa
- [x] Salvar checkpoint e disponibilizar a correção

## Rebranding CT3 Chults Travagin e Revisão de Testes
- [x] Substituir referências visíveis de Plano de Rotas Pro Allen por CT3 Chults Travagin
- [x] Atualizar o título público do aplicativo para CT3
- [x] Revisar login, Gestor, Supervisor, rotas, checklists, coberturas e relatório Word
- [x] Executar testes automatizados, verificação de tipos e build de produção
- [x] Verificar erros de console e principais telas em desktop e celular
- [x] Carregar o gerador de Word somente ao exportar o relatório diário
- [x] Corrigir problemas encontrados, salvar checkpoint e disponibilizar a versão de testes

## Tela de Acesso Pro Allen
- [x] Aplicar amarelo e preto como identidade principal no acesso de Supervisor
- [x] Exibir Pro Allen como marca principal e remover CT3 do cabeçalho
- [x] Manter CT3 Chults Travagin apenas como crédito discreto no rodapé
- [x] Ajustar a entrada do Gestor para a mesma identidade visual
- [x] Validar desktop e celular, salvar checkpoint e disponibilizar a nova tela

## Pacote Portátil do Código-Fonte
- [x] Auditar arquivos do projeto, dependências e referências de caminhos
- [x] Incluir instruções de ambiente e execução em outro servidor
- [x] Remover o script de runtime específico da plataforma do build externo
- [x] Gerar arquivo ZIP sem segredos, dependências instaladas ou artefatos locais
- [x] Verificar a estrutura e a integridade do pacote compactado
- [x] Entregar o ZIP completo ao usuário

## Painel Visual de Progresso do Gestor
- [x] Consolidar progresso, postos atendidos, pendências e conformidade por supervisor
- [x] Criar gráficos de progresso por supervisor, status operacional e desempenho de rotas
- [x] Mostrar alertas e situações críticas em leitura visual imediata
- [x] Adaptar a central do Gestor para desktop e celular
- [x] Criar testes de cálculos e estados vazios dos gráficos
- [x] Validar os gráficos com dados reais, salvar checkpoint e disponibilizar o painel
- [x] Exibir conformidade, não conformidades e itens sem resposta por supervisor
- [x] Adicionar um gráfico específico de desempenho por rota
- [x] Criar teste explícito para estado vazio do painel visual
- [x] Validar novamente os gráficos completos, salvar checkpoint e entregar a versão final

## Correção de Carregamento do Acesso do Gestor
- [x] Reproduzir a página de acesso do Gestor em sessão limpa
- [x] Identificar a falha de carregamento dos assets em rota profunda
- [x] Corrigir o carregamento de CSS e JavaScript em rotas profundas publicadas
- [x] Corrigir o fluxo de acesso e adicionar regressão automatizada
- [x] Validar em desktop e celular, salvar checkpoint e disponibilizar a correção

## Histórico Operacional de Raul Travagin
- [x] Confirmar a senha do Gestor como segredo seguro
- [x] Mapear rotas, visitas, checklists e observações vinculados a Raul Travagin
- [x] Identificar se a ausência decorre de desativação, filtro ou vínculo entre contas
- [x] Recuperar a visualização histórica sem reativar indevidamente acessos removidos
- [x] Validar explicitamente os checklists históricos vinculados a Raul Travagin
- [x] Adicionar evidência automatizada para os itens de checklist das datas históricas recuperadas
- [x] Validar o painel do Gestor e o relatório histórico com sessão real
- [x] Salvar checkpoint da correção histórica: c3bcfd60
- [x] Entregar o diagnóstico, a orientação de data e a versão publicada ao solicitante

## Checklist Intuitivo e Revisão Técnica
- [x] Analisar o fluxo atual de checklist no Painel do Gestor e no relatório Word
- [x] Exibir um resumo visual e simples de conformidades, pendências e não conformidades por visita no Painel do Gestor
- [x] Permitir leitura dos itens de checklist e observações de cada visita sem poluir a tela do Gestor
- [x] Organizar no relatório Word um resumo de checklist por visita, com situações e observações relevantes
- [x] Revisar erros de interface, dados e exportação que possam afetar os fluxos principais
- [x] Validar que as novas superfícies de checklist e relatório permanecem protegidas por sessão do Gestor
- [x] Criar ou atualizar testes de regressão para a leitura de checklist e a geração do relatório
- [x] Validar desktop, TypeScript, suíte de testes e build de produção
- [x] Validar em viewport móvel a nova leitura de checklist no Painel do Gestor e no relatório diário
- [x] Salvar checkpoint e entregar a versão revisada: fdc288cd

## Gestão de Escala pelo Gestor
- [x] Criar persistência de escala diária com os papéis Dia, Noite e Folguista
- [x] Registrar a composição inicial corrigida: Rodrigo no Dia das 06h às 18h, Paulo na Noite de hoje e na próxima noite, e Aparecido em Folga hoje
- [x] Proteger as consultas e alterações de escala exclusivamente pela sessão do Gestor
- [x] Exibir a escala atual de forma clara no Painel do Gestor
- [x] Permitir que o Gestor altere manualmente responsável, função e data da escala
- [x] Validar persistência, autorização, interface desktop e celular, testes, tipos e build
- [x] Salvar checkpoint e entregar a versão publicada: cb12ce3a

## Cadastro de Postos pelo Gestor
- [x] Analisar os dados existentes de rotas e postos e definir o fluxo de inclusão
- [x] Proteger a consulta e o cadastro de postos exclusivamente pela sessão do Gestor
- [x] Permitir cadastrar nome do posto, região, endereço e rota vinculada
- [x] Mostrar rotas disponíveis e os postos cadastrados na área do Gestor
- [x] Validar cadastro, campos obrigatórios, autorização, desktop, celular, testes, tipos e build
- [x] Salvar checkpoint e entregar a versão publicada: 14190780

## Google Maps para Postos e Rotas
- [x] Auditar endereços e coordenadas atuais dos postos para identificar dados geocodificáveis
- [x] Preparar a estrutura de geocodificação futura para endereços completos de postos
- [x] Exibir no mapa a última localização GPS do supervisor e os postos que já tiverem coordenadas
- [x] Indicar claramente os postos pendentes de localização, sem inventar coordenadas nem traçados
- [x] Proteger operações de geocodificação e visualização gerencial pela sessão do Gestor
- [x] Validar mapa, coordenadas, estados sem endereço, desktop, celular, testes, tipos e build
- [x] Salvar checkpoint e entregar a versão publicada: 9902c1f4

## Base Operacional na Preparação de Rota
- [x] Analisar o fluxo de preparação de rota e compatibilidade com registros já existentes
- [x] Adicionar Base Operacional como opção própria na seleção de atividade do supervisor
- [x] Permitir preparar e acompanhar uma atividade em Base Operacional sem criar postos de cliente fictícios
- [x] Exibir Base Operacional de forma clara no Painel do Gestor e nos relatórios
- [x] Validar seleção, autorização, desktop, celular, testes, tipos e build
- [x] Salvar checkpoint e entregar a versão publicada: 45f0faf0

## Central Operacional do Gestor
- [x] Mapear os dados atuais de supervisor, posto, tempo, GPS, KM, checklist, alertas e relatórios
- [x] Remover os gráficos visuais do Painel do Gestor
- [x] Priorizar cartões operacionais por supervisor com atividade, posto atual, tempo em posto e próxima ação
- [x] Destacar GPS, KM, checklist, observações e alertas no mesmo fluxo de acompanhamento
- [x] Preservar e facilitar o acesso ao relatório diário e ao relatório Word
- [x] Validar permissões, dados operacionais, desktop, celular, testes, tipos e build
- [x] Salvar checkpoint e entregar a versão publicada: a0a358ab

## Saída da Base para Rota de Campo
- [x] Mapear a regra atual de uma rota aberta por dia e o histórico de atividades concluídas
- [x] Liberar a preparação de rota de campo depois de encerrar a Base Operacional com KM final
- [x] Preservar Base e rota de campo como registros separados no mesmo dia
- [x] Orientar claramente o supervisor sobre encerrar a Base antes de iniciar a nova rota
- [x] Exibir a sequência Base → rota de campo no Painel do Gestor e nos relatórios
- [x] Validar transição, KM, histórico, autorização, desktop, celular, testes, tipos e build
- [x] Salvar checkpoint e entregar a versão publicada: 86838597

## Entrega do Código-Fonte
- [x] Gerar um ZIP portátil com o código completo, excluindo segredos, dependências e artefatos reconstruíveis
- [x] Validar o conteúdo e a integridade do arquivo compactado
- [x] Entregar o arquivo ZIP para download

## Pacote Estático Compilado
- [x] Executar a compilação de produção completa pelo script do projeto
- [x] Gerar um ZIP somente do conteúdo estático compilado, com index.html na raiz
- [x] Validar a integridade e a estrutura do pacote estático
- [x] Documentar as dependências de servidor, banco, autenticação e mapas que não podem operar apenas com arquivos estáticos
- [x] Entregar o ZIP estático para download

## Modo Local de Contingência
- [x] Mapear login, rotas e checklists que podem operar somente no dispositivo
- [x] Criar sessões locais e armazenamento de checklists no LocalStorage sem expor senhas em texto puro
- [x] Permitir que o supervisor use login, rota e checklist em modo local quando o servidor não estiver disponível
- [x] Exibir aviso claro de que os registros locais não são compartilhados em tempo real entre dispositivos
- [x] Preparar exportação e importação manual dos dados locais para recuperação posterior
- [x] Validar persistência, logout, integridade de dados, desktop, celular, testes, tipos e build
- [x] Salvar checkpoint e entregar a versão publicada: 37ad81ff

## Pacote Final para Netlify Drop
- [x] Executar a compilação final com o modo local de contingência
- [x] Incluir redirecionamento de SPA para a rota /local no Netlify
- [x] Gerar o ZIP de dist/public sem pastas envolventes
- [x] Validar index.html na raiz e assets incluídos no pacote
- [x] Entregar o ZIP final para envio pelo Netlify Drop

## Correção do Pacote Estático Local
- [x] Identificar a inicialização que ainda chama autenticação e APIs online no build estático
- [x] Forçar a rota principal do build estático para o modo local sem consultas tRPC
- [x] Garantir que login, rotas e checklists locais usem somente mocks e LocalStorage
- [x] Validar que não há requisições a /api/trpc após abrir, autenticar e preencher checklist local
- [x] Gerar e validar o novo ZIP de dist/public com index.html na raiz
- [x] Entregar o ZIP corrigido para Netlify Drop

## Deploy Independente no Render
- [x] Verificar a disponibilidade atual de recursos gratuitos do Render e o fluxo de banco PostgreSQL
- [x] Preparar configurações de serviço, build, start, variáveis e health check para o Render
- [x] Preparar a inicialização de banco MySQL compatível fora do Manus, evitando uma migração arriscada para PostgreSQL
- [x] Elaborar instruções objetivas de criação de conta, banco, serviço web e variáveis no Render
- [x] Gerar e validar um pacote ZIP de deploy independente
- [x] Entregar o pacote e informar os passos que dependem da conta do usuário no Render

## Publicação no GitHub
- [x] Verificar a conexão GitHub e confirmar o repositório de destino
- [x] Validar código, migrações, render.yaml e documentação antes do envio
- [x] Tentar a publicação no repositório GitHub e identificar o bloqueio de permissão de escrita
- [x] Informar a limitação de permissão e os próximos passos no Render
- [x] Substituir o envio direto pelo pacote de upload manual solicitado pelo usuário

## Código-Fonte para Upload Manual
- [x] Gerar ZIP atualizado com frontend, backend, banco, migrações e configurações de deploy
- [x] Validar ausência de segredos, dependências e artefatos reconstruíveis no ZIP
- [x] Entregar o arquivo ZIP atualizado para download manual

## Correção de Entrada Vite para Render
- [x] Auditar a estrutura do pacote e reproduzir a resolução de client/index.html
- [x] Ajustar a estrutura de entrada do Vite para deploy externo independente
- [x] Validar build e startup de produção com o novo caminho de entrada
- [x] Gerar e validar ZIP corrigido para upload manual
- [x] Entregar o pacote corrigido e orientar o novo deploy no Render

## Push Completo ao GitHub
- [x] Conferir o estado final do projeto e a exclusão de segredos antes do push
- [x] Autenticar o terminal com a credencial de escrita fornecida pelo usuário
- [x] Enviar todo o projeto, incluindo client, server, drizzle, docs e configurações do Render
- [x] Confirmar o commit remoto no repositório RaulTravagin/pro-allen-novo

## Banco de Produção e Contas Iniciais
- [ ] Confirmar a incompatibilidade entre a URL Neon PostgreSQL e o driver MySQL atual
- [ ] Preparar ou selecionar uma estratégia de banco compatível com o projeto
- [ ] Executar migrações e seed idempotente no banco de produção compatível
- [ ] Verificar as contas de supervisor e entregar as credenciais iniciais

## Conversão para PostgreSQL/Neon
- [x] Mapear o uso de MySQL no esquema, driver, migrações, queries e scripts de seed
- [x] Converter o esquema e o driver Drizzle para PostgreSQL/Neon
- [x] Gerar a migração inicial PostgreSQL e adaptar o seed idempotente
- [x] Validar tipos e build contra a configuração PostgreSQL
- [x] Fazer commit e push da conversão ao repositório GitHub: e6f5589
- [ ] Executar migração e seed na URL Neon de produção acessível
- [ ] Confirmar as contas iniciais de supervisor no banco Neon

## Verificação do Deploy Render
- [ ] Verificar a disponibilidade pública, a saúde e os fluxos locais do serviço Render
- [ ] Confirmar indícios de migração e seed no banco Neon sem expor a URL de conexão
- [ ] Informar logins iniciais de supervisores e senha do Gestor

## Correção do Mapa Operacional no Render
- [x] Identificar que o mapa atual usa Google Maps por meio de proxy Manus, não Leaflet/OpenStreetMap
- [x] Corrigir a integração para carregamento direto do Google Maps com variável de build no Render
- [ ] Validar a renderização do mapa, marcadores e estado sem coordenadas no deploy Render
- [x] Fazer commit e push da correção ao GitHub: 8e74435

## Migração do Mapa para Leaflet/OpenStreetMap
- [x] Substituir o componente Google Maps por Leaflet com tiles OpenStreetMap
- [x] Preservar marcadores de posto, GPS de supervisor, ajuste de enquadramento e traçado de rota
- [x] Remover variáveis e dependências do Google Maps do Render e da documentação
- [ ] Validar mapa desktop e celular, estados sem coordenadas, testes, tipos e build
- [x] Fazer commit e push da migração ao GitHub: 8896c31

## Backup SQL do Neon
- [ ] Obter uma conexão segura ao banco Neon de produção sem expor credenciais
- [ ] Gerar dump SQL de estrutura e dados de todas as tabelas
- [ ] Validar a integridade do arquivo de backup
- [ ] Entregar o arquivo SQL para download e definir se ele deve permanecer fora do GitHub

## Apresentação Executiva Pro Allen
- [ ] Estruturar a narrativa de capa, desafio, solução, módulos, arquitetura, benefícios e implantação
- [ ] Criar a rota /apresentacao com visual Pro Allen em páginas A4 paisagem e impressão/PDF
- [ ] Implementar botão de impressão/salvamento em PDF e exportação em PowerPoint
- [ ] Validar conteúdo, apresentação desktop, impressão, responsividade e geração do PowerPoint
- [ ] Fazer commit e push ao GitHub e orientar o redeploy no Render

## Controle de Frota e Abastecimento
- [x] Mapear o controle de KM atual e modelar viaturas, usos e abastecimentos
- [x] Criar tabelas PostgreSQL de viaturas e fuel_logs associadas à atividade atual
- [x] Exigir seleção de placa/modelo antes do KM inicial e associar KM e abastecimento à viatura
- [x] Criar formulário de abastecimento com KM, valor, litros e combustível
- [x] Calcular e exibir média Km/L, custo por Km e histórico recente por placa
- [x] Validar regras de viatura e abastecimento com três testes de regressão, TypeScript e build de produção
- [ ] Aplicar a migração no Neon de produção durante o próximo deploy com uma DATABASE_URL válida no Render
- [ ] Fazer commit e push ao GitHub e orientar migração e redeploy no Render
