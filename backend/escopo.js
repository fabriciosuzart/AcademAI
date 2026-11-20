// RN02 / Seção 3.1.1 — escopo de aprovação do professor.
//
// O administrador define, por professor, os modelos de equipamento cujas reservas
// ele pode aprovar (ex.: "Impressora 3D Finder, Cortadora a Laser"). Escopo vazio
// é o padrão do documento: o professor avalia as reservas de todos os estudantes
// do laboratório. O campo fica em User.escopoAprovacao, como lista separada por
// vírgula ou por quebra de linha.

/** Lista normalizada dos modelos do escopo ([] = sem restrição). */
export function lerEscopo(bruto) {
    const lista = Array.isArray(bruto) ? bruto : String(bruto ?? '').split(/[,\n]/);
    return [...new Set(lista.map((m) => String(m).trim()).filter(Boolean))];
}

/** Texto gravado no banco a partir do que veio do formulário. */
export const gravarEscopo = (bruto) => lerEscopo(bruto).join(', ');

/** true se o professor com este escopo pode avaliar reservas deste modelo. */
export function professorAbrange(escopo, modelo) {
    const lista = lerEscopo(escopo);
    if (!lista.length) return true;
    const alvo = String(modelo ?? '').trim().toLowerCase();
    return lista.some((m) => m.toLowerCase() === alvo);
}

/**
 * Quem pode avaliar uma reserva pendente: administradores ativos sempre;
 * professores ativos só quando a reserva é de estudante e o modelo está no escopo.
 */
export function podeAvaliar(avaliador, { papelSolicitante, modelo }) {
    if (!avaliador?.isActive) return false;
    if (avaliador.role === 'ADMIN') return true;
    if (avaliador.role !== 'PROFESSOR') return false;
    return papelSolicitante === 'ALUNO' && professorAbrange(avaliador.escopoAprovacao, modelo);
}
