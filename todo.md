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
