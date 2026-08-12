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

## Nota de Histórico
- [x] O checklist anterior continha observações repetidas e não acionáveis geradas durante uma recuperação de workspace. Ele foi normalizado nesta versão para manter apenas entregas verificáveis e o histórico relevante.
