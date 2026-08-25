// Vocabulário único de status de equipamento — espelho de src/utils/status.ts.
//
// Não há build compartilhado entre o Vite e o Node, então são dois arquivos:
// ao mexer em um, mexa no outro. A explicação completa está no arquivo do
// front; em resumo: três grafias conviviam no banco ("DISPONÍVEL",
// "available", "in-use") e as telas comparavam por igualdade exata.

export const STATUS = {
    DISPONIVEL: 'DISPONIVEL',
    EM_USO: 'EM_USO',
    MANUTENCAO: 'MANUTENCAO',
};

// Grafias antigas continuam aceitas: banco não migrado não pode quebrar a API.
const SINONIMOS = {
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

const ROTULOS = {
    [STATUS.DISPONIVEL]: 'Disponível',
    [STATUS.EM_USO]: 'Em Uso',
    [STATUS.MANUTENCAO]: 'Manutenção',
};

/** Converte qualquer grafia conhecida no valor canônico. Desconhecido vira
 *  MANUTENCAO: na dúvida, não liberar a máquina é o lado seguro do erro. */
export function normalizarStatus(bruto) {
    const chave = (bruto || '').toUpperCase().trim();
    return SINONIMOS[chave] ?? STATUS.MANUTENCAO;
}

export function rotuloStatus(bruto) {
    return ROTULOS[normalizarStatus(bruto)];
}

export function ehDisponivel(bruto) {
    return normalizarStatus(bruto) === STATUS.DISPONIVEL;
}

export function ehManutencao(bruto) {
    return normalizarStatus(bruto) === STATUS.MANUTENCAO;
}
