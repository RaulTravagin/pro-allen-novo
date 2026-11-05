import { z } from "zod";

export const personnelProfileFields = [
  { key: "clientCode", label: "Código do cliente", section: "Identificação e família", type: "text" },
  { key: "registrationNumber", label: "Matrícula", section: "Identificação e família", type: "text" },
  { key: "documentCpf", label: "CPF informado", section: "Identificação e família", type: "text" },
  { key: "birthDate", label: "Data de nascimento", section: "Identificação e família", type: "date" },
  { key: "rgNumber", label: "Número do RG", section: "Identificação e família", type: "text" },
  { key: "rgState", label: "UF do RG", section: "Identificação e família", type: "text" },
  { key: "rgIssueDate", label: "Data de emissão do RG", section: "Identificação e família", type: "date" },
  { key: "rgIssuer", label: "Órgão emissor do RG", section: "Identificação e família", type: "text" },
  { key: "motherName", label: "Nome da mãe", section: "Identificação e família", type: "text" },
  { key: "fatherName", label: "Nome do pai", section: "Identificação e família", type: "text" },
  { key: "email", label: "E-mail", section: "Contato", type: "email" },
  { key: "phoneAreaCode", label: "DDD / telefone informado", section: "Contato", type: "text" },
  { key: "phoneNumber", label: "Telefone", section: "Contato", type: "text" },
  { key: "benefitCardNumber", label: "Número do cartão de benefício", section: "Entrega de benefício", type: "text" },
  { key: "salaryRange", label: "Faixa salarial", section: "Entrega de benefício", type: "text" },
  { key: "bankCode", label: "Código do banco", section: "Banco", type: "text" },
  { key: "bankAccountType", label: "Tipo de conta", section: "Banco", type: "text" },
  { key: "bankAgency", label: "Agência bancária", section: "Banco", type: "text" },
  { key: "bankAgencyDigit", label: "Dígito da agência", section: "Banco", type: "text" },
  { key: "bankAccountNumber", label: "Número da conta", section: "Banco", type: "text" },
  { key: "bankAccountDigit", label: "Dígito da conta", section: "Banco", type: "text" },
  { key: "departmentCode", label: "Código do departamento", section: "Identificação e família", type: "text" },
  { key: "departmentName", label: "Nome do departamento", section: "Identificação e família", type: "text" },
  { key: "deliveryResponsible", label: "Responsável pelo departamento", section: "Entrega de benefício", type: "text" },
  { key: "deliveryStreetType", label: "Tipo de logradouro de entrega", section: "Entrega de benefício", type: "text" },
  { key: "deliveryStreet", label: "Logradouro de entrega", section: "Entrega de benefício", type: "text" },
  { key: "deliveryNumber", label: "Número do endereço de entrega", section: "Entrega de benefício", type: "text" },
  { key: "deliveryComplement", label: "Complemento do endereço de entrega", section: "Entrega de benefício", type: "text" },
  { key: "deliveryNeighborhood", label: "Bairro de entrega", section: "Entrega de benefício", type: "text" },
  { key: "deliveryCity", label: "Cidade de entrega", section: "Entrega de benefício", type: "text" },
  { key: "deliveryState", label: "UF de entrega", section: "Entrega de benefício", type: "text" },
  { key: "deliveryPostalCode", label: "CEP de entrega", section: "Entrega de benefício", type: "text" },
  { key: "workDays", label: "Quantidade de dias úteis", section: "Transporte", type: "text" },
  { key: "transportOperatorCode", label: "Código da operadora de transporte", section: "Transporte", type: "text" },
  { key: "transportLineCode", label: "Código da linha de transporte", section: "Transporte", type: "text" },
  { key: "dailyPasses", label: "Passes por dia / cotas SPTrans", section: "Transporte", type: "text" },
  { key: "ticketValue", label: "Valor da passagem", section: "Transporte", type: "text" },
  { key: "homeStreetType", label: "Tipo de logradouro residencial", section: "Residência", type: "text" },
  { key: "homeStreet", label: "Logradouro residencial", section: "Residência", type: "text" },
  { key: "homeNumber", label: "Número residencial", section: "Residência", type: "text" },
  { key: "homeComplement", label: "Complemento residencial", section: "Residência", type: "text" },
  { key: "homeNeighborhood", label: "Bairro residencial", section: "Residência", type: "text" },
  { key: "homeCity", label: "Cidade residencial", section: "Residência", type: "text" },
  { key: "homeState", label: "UF residencial", section: "Residência", type: "text" },
  { key: "homePostalCode", label: "CEP residencial", section: "Residência", type: "text" },
  { key: "referenceFile", label: "Arquivo de referência", section: "Referência", type: "text" },
  { key: "reviewNotes", label: "Observações de conferência", section: "Referência", type: "text" },
  { key: "crossCheckStatus", label: "Situação do cruzamento das fichas", section: "Referência", type: "text" },
  { key: "freelancerFunction", label: "Função de free", section: "Controle de free", type: "text" },
  { key: "freelancerStatus", label: "Status de free", section: "Controle de free", type: "text" },
  { key: "freelancerHours", label: "Horário de free", section: "Controle de free", type: "text" },
  { key: "freelancerPosts", label: "Postos de free", section: "Controle de free", type: "text" },
  { key: "freelancerCoverage", label: "Cobertura de free", section: "Controle de free", type: "text" },
  { key: "freelancerPixKey", label: "Chave PIX de free", section: "Controle de free", type: "text" },
  { key: "freelancerValue", label: "Valor de free", section: "Controle de free", type: "text" },
  { key: "freelancerSupervision", label: "Supervisão de free", section: "Controle de free", type: "text" },
  { key: "freelancerNotes", label: "Observações de free", section: "Controle de free", type: "text" },
] as const satisfies readonly {
  key: string;
  label: string;
  section: string;
  type: "text" | "date" | "email";
}[];

export type PersonnelProfileFieldKey = (typeof personnelProfileFields)[number]["key"];
export type PersonnelProfileSource = z.infer<typeof personnelProfileSourceSchema>;

function isRealIsoCivilDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1]!;
}

const boundedText = (max: number) => z.string().max(max);
const civilDate = z.string().refine(isRealIsoCivilDate, "Informe uma data civil ISO válida (AAAA-MM-DD)");
const profileFieldKeys = personnelProfileFields.map(({ key }) => key) as [PersonnelProfileFieldKey, ...PersonnelProfileFieldKey[]];

const personnelProfileSourceSchema = z.object({
  fileName: boundedText(255).min(1),
  fileSha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
  sheet: boundedText(128).min(1),
  row: z.number().int().positive(),
  importedAt: z.iso.datetime(),
  cells: z.array(z.object({
    column: boundedText(32).min(1),
    header: boundedText(255),
    value: boundedText(4_000),
    kind: boundedText(64).optional(),
    formula: boundedText(2_000).optional(),
    cachedValue: boundedText(4_000).optional(),
  }).strict()).max(100),
}).strict();

const fieldsShape = Object.fromEntries(profileFieldKeys.map((key) => [
  key,
  (key === "birthDate" || key === "rgIssueDate" ? civilDate : boundedText(2_000)).optional(),
])) as unknown as Record<PersonnelProfileFieldKey, z.ZodType<string | undefined>>;

export type PersonnelEmployeeProfile = {
  fields: Partial<Record<PersonnelProfileFieldKey, string>>;
  sources?: PersonnelProfileSource[];
};

export const personnelEmployeeProfileSchema: z.ZodType<PersonnelEmployeeProfile> = z.object({
  fields: z.object(fieldsShape).strict(),
  sources: z.array(personnelProfileSourceSchema).max(20).optional(),
}).strict();
