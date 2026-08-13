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
