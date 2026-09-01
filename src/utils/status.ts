// Vocabulário único de status de equipamento.
//
// O banco chegou a ter três grafias convivendo na mesma tabela ("DISPONÍVEL",
// "available", "in-use"), e como boa parte das telas comparava por igualdade
// exata, o filtro de /equipamentos escondia máquinas disponíveis e a bolinha
// de /disponibilidade pintava de vermelho quem estava livre.
//
// O valor canônico é português, para acompanhar o vocabulário que Appointment
// já usa (PENDENTE, APROVADA...), mas sem acento e sem espaço: foi exatamente
// isso que produziu "DISPONÍVEL" vs "DISPONIVEL" e "EM USO" vs "IN-USE". O
// usuário nunca vê esse valor — o rótulo bonito sai de rotuloStatus().
//
// Espelhado em backend/status.js. Não há build compartilhado entre o Vite e o
// Node, então são dois arquivos: ao mexer em um, mexa no outro.

export const STATUS = {
  DISPONIVEL: 'DISPONIVEL',
  EM_USO: 'EM_USO',
  MANUTENCAO: 'MANUTENCAO',
} as const;

export type StatusEquipamento = (typeof STATUS)[keyof typeof STATUS];

// Grafias antigas continuam sendo aceitas de propósito: quem estiver com um
// banco não migrado na própria máquina não vê a tela quebrar.
const SINONIMOS: Record<string, StatusEquipamento> = {
  'DISPONIVEL': STATUS.DISPONIVEL,
  'DISPONÍVEL': STATUS.DISPONIVEL,
  'AVAILABLE': STATUS.DISPONIVEL,
  'EM_USO': STATUS.EM_USO,
  'EM USO': STATUS.EM_USO,
  'IN USE': STATUS.EM_USO,
  'IN-USE': STATUS.EM_USO,
  'INUSE': STATUS.EM_USO,
  'MANUTENCAO': STATUS.MANUTENCAO,
  'MANUTENÇÃO': STATUS.MANUTENCAO,
  'MAINTENANCE': STATUS.MANUTENCAO,
};

const ROTULOS: Record<StatusEquipamento, string> = {
  [STATUS.DISPONIVEL]: 'Disponível',
  [STATUS.EM_USO]: 'Em Uso',
  [STATUS.MANUTENCAO]: 'Manutenção',
};

const CLASSES: Record<StatusEquipamento, string> = {
  [STATUS.DISPONIVEL]: 'available',
  [STATUS.EM_USO]: 'in-use',
  [STATUS.MANUTENCAO]: 'maintenance',
};

/** Converte qualquer grafia conhecida no valor canônico. Desconhecido vira MANUTENCAO:
 *  na dúvida, não liberar a máquina é o lado seguro do erro. */
export function normalizarStatus(bruto?: string | null): StatusEquipamento {
  const chave = (bruto || '').toUpperCase().trim();
  return SINONIMOS[chave] ?? STATUS.MANUTENCAO;
}

/** Texto para o usuário: 'Disponível' | 'Em Uso' | 'Manutenção'. */
export function rotuloStatus(bruto?: string | null): string {
  return ROTULOS[normalizarStatus(bruto)];
}

/** Classe CSS já usada pelos badges: 'available' | 'in-use' | 'maintenance'. */
export function classeStatus(bruto?: string | null): string {
  return CLASSES[normalizarStatus(bruto)];
}

export function ehDisponivel(bruto?: string | null): boolean {
  return normalizarStatus(bruto) === STATUS.DISPONIVEL;
}

export function ehManutencao(bruto?: string | null): boolean {
  return normalizarStatus(bruto) === STATUS.MANUTENCAO;
}

/** Opções do filtro de status, na ordem em que aparecem nos seletores. */
export const OPCOES_STATUS: { valor: StatusEquipamento; rotulo: string }[] = [
  { valor: STATUS.DISPONIVEL, rotulo: ROTULOS[STATUS.DISPONIVEL] },
  { valor: STATUS.EM_USO, rotulo: ROTULOS[STATUS.EM_USO] },
  { valor: STATUS.MANUTENCAO, rotulo: ROTULOS[STATUS.MANUTENCAO] },
];
