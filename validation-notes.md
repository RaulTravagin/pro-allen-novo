# Evidências de validação

- 12/08/2026: A tela inicial em sessão sem login exibiu apenas os campos de usuário e senha do supervisor, o botão de entrada e o link discreto **Acesso do Gestor** no rodapé, apontando para `/gestor/acesso`.
- 12/08/2026: A entrada protegida do Gestor foi verificada em desktop e celular; os controles de senha, o texto de atualização contínua e a navegação de retorno permanecem legíveis e alcançáveis nos dois formatos.
- 12/08/2026: Em perfil limpo de navegador, a entrada móvel abriu diretamente no login local do Supervisor e no link **Acesso do Gestor**, sem navegação para o Manus OAuth. A validação desktop repetida após a renderização completa confirmou o mesmo formulário local e o atalho do Gestor, também sem OAuth.
- 13/08/2026: A identidade **CT3 · Chults Travagin** foi validada no painel administrativo em desktop e celular e na tela de senha do Gestor. Não foram observados erros novos de console ou rede nas telas validadas.
- 13/08/2026: O acesso direto de uma conta administrativa à rota `90001` foi corretamente negado pela regra de propriedade da rota, exibindo “Rota não encontrada” sem falha de renderização. A validação da rota deve ocorrer com a sessão do supervisor responsável.
- 13/08/2026: Com a sessão local do supervisor responsável, a rota ativa `90001` foi consultada com sucesso, retornando estado `in_progress`, sete checklists e uma cobertura fora de rota, confirmando a autorização e os dados operacionais do fluxo de campo.
