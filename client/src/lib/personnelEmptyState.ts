export function personnelEmployeeEmptyState(employeeCount: number) {
  if (employeeCount > 0) return null;
  return {
    title: "Nenhum funcionário cadastrado",
    description: "O RH ainda não cadastrou a base de colaboradores. Cadastre um funcionário na aba Funcionários antes de lançar registros.",
  };
}
