// RNF09 — testes unitários dos módulos críticos: autenticação (bloqueio de login e
// validação de cadastro) e fluxo de reservas (regras temporais, cancelamento,
// limite, horários e bloqueios de datas). Rodam sem servidor e sem banco.
import { MAX_TENTATIVAS_LOGIN, BLOQUEIO_LOGIN_MS, contaBloqueada, bloqueioVencido, aposSenhaErrada } from '../auth-regras.js';
import { validarEmailInstitucional, validarSenha } from '../validacao-cadastro.js';
import {
    REGRAS_RESERVA, validarRegrasTemporais, podeCancelar, sujeitoAoLimite, contarReservasAtivas,
} from '../config-reservas.js';
import { horarioValido, paraMinutos, paraHorario, somarMinutos, clausulaDeConflito, DURACAO_PADRAO } from '../horarios.js';
import { normalizarEquipmentId, clausulaDeBloqueio, buscarBloqueioQueImpede, motivoDoBloqueio } from '../bloqueios.js';

// Datas locais fixas, para os testes não dependerem do dia em que rodam.
const AGORA = new Date('2026-11-18T10:00:00');

describe('Bloqueio de login (auth-regras.js)', () => {
    it('conta só fica bloqueada enquanto lockedUntil está no futuro', () => {
        expect(contaBloqueada({ lockedUntil: null }, AGORA)).toBe(false);
        expect(contaBloqueada({ lockedUntil: new Date(AGORA.getTime() + 1000) }, AGORA)).toBe(true);
        expect(contaBloqueada({ lockedUntil: new Date(AGORA.getTime() - 1000) }, AGORA)).toBe(false);
        expect(bloqueioVencido({ lockedUntil: new Date(AGORA.getTime() - 1000) }, AGORA)).toBe(true);
    });

    it(`bloqueia na ${MAX_TENTATIVAS_LOGIN}ª senha errada seguida, por 15 minutos`, () => {
        expect(aposSenhaErrada({ failedLoginAttempts: 0 }, AGORA)).toEqual({ failedLoginAttempts: 1, lockedUntil: null });
        const quinta = aposSenhaErrada({ failedLoginAttempts: MAX_TENTATIVAS_LOGIN - 1 }, AGORA);
        expect(quinta.failedLoginAttempts).toBe(MAX_TENTATIVAS_LOGIN);
        expect(quinta.lockedUntil.getTime()).toBe(AGORA.getTime() + BLOQUEIO_LOGIN_MS);
    });

    it('depois de um bloqueio vencido, a contagem recomeça do zero', () => {
        const usuario = { failedLoginAttempts: MAX_TENTATIVAS_LOGIN, lockedUntil: new Date(AGORA.getTime() - 1000) };
        expect(aposSenhaErrada(usuario, AGORA)).toEqual({ failedLoginAttempts: 1, lockedUntil: null });
    });
});

describe('Validação de cadastro (validacao-cadastro.js)', () => {
    it('aceita só e-mail institucional válido', () => {
        expect(validarEmailInstitucional('aluno@academai.com')).toBeNull();
        expect(validarEmailInstitucional('aluno@alunos.academai.com')).toBeNull();
        expect(validarEmailInstitucional('aluno@gmail.com')).toMatch(/institucional/);
        expect(validarEmailInstitucional('sem-arroba')).toMatch(/válido/);
    });

    it('senha com pelo menos 8 caracteres, letras e números', () => {
        expect(validarSenha('abc12345')).toBeNull();
        expect(validarSenha('abc123')).toMatch(/8 caracteres/);
        expect(validarSenha('abcdefgh')).toMatch(/letras e números/);
    });
});

describe('Regras de reserva (config-reservas.js)', () => {
    it('recusa reserva no passado e fora da duração permitida', () => {
        expect(validarRegrasTemporais('2026-11-17', '10:00', '11:00', AGORA).ok).toBe(false);
        expect(validarRegrasTemporais('2026-11-19', '10:00', '11:00', AGORA)).toEqual({ ok: true });
        expect(validarRegrasTemporais('2026-11-19', '10:00', '10:15', AGORA).erro).toMatch(/no mínimo/);
        expect(validarRegrasTemporais('2026-11-19', '10:00', '13:00', AGORA).erro).toMatch(/no máximo/);
        expect(validarRegrasTemporais('data', '10:00', '11:00', AGORA).erro).toMatch(/inválidos/);
    });

    it(`RF15: cancelamento só até ${REGRAS_RESERVA.antecedenciaCancelamentoHoras}h antes; admin isento`, () => {
        const daquiAUmaHora = { date: '2026-11-18', time: '11:00' };
        const amanha = { date: '2026-11-19', time: '11:00' };
        expect(podeCancelar(daquiAUmaHora, 'ALUNO', AGORA).ok).toBe(false);
        expect(podeCancelar(daquiAUmaHora, 'ALUNO', AGORA).erro).toMatch(/menos de 2h/);
        expect(podeCancelar(daquiAUmaHora, 'ADMIN', AGORA).ok).toBe(true);
        expect(podeCancelar(amanha, 'PROFESSOR', AGORA).ok).toBe(true);
    });

    it('só alunos têm limite de reservas ativas, contadas de hoje em diante', async () => {
        expect(sujeitoAoLimite('ALUNO')).toBe(true);
        expect(sujeitoAoLimite('PROFESSOR')).toBe(false);
        expect(sujeitoAoLimite('ADMIN')).toBe(false);
        let consulta;
        const prisma = { appointment: { count: async (args) => { consulta = args; return 2; } } };
        expect(await contarReservasAtivas(prisma, 7, '2026-11-18')).toBe(2);
        expect(consulta.where).toEqual({ userId: 7, status: { in: ['PENDENTE', 'APROVADA'] }, date: { gte: '2026-11-18' } });
    });
});

describe('Horários (horarios.js)', () => {
    it('converte e valida HH:MM', () => {
        expect(horarioValido('08:30')).toBe(true);
        expect(horarioValido('8:30')).toBe(false);
        expect(horarioValido('24:00')).toBe(false);
        expect(paraMinutos('16:30')).toBe(990);
        expect(paraHorario(990)).toBe('16:30');
        expect(somarMinutos('16:30', 90)).toBe('18:00');
    });

    it('conflito é intervalo meio-aberto: terminar quando o outro começa não conflita', () => {
        const [comFim, semFim] = clausulaDeConflito('15:00', '16:00');
        expect(comFim).toEqual({ time: { lt: '16:00' }, endTime: { gt: '15:00' } });
        // Reserva antiga sem endTime vale DURACAO_PADRAO minutos.
        expect(semFim.time.gt).toBe(somarMinutos('15:00', -DURACAO_PADRAO));
    });
});

describe('Bloqueios de datas (bloqueios.js)', () => {
    it('normaliza o equipamento vindo do formulário', () => {
        expect(normalizarEquipmentId('')).toBeNull();
        expect(normalizarEquipmentId(undefined)).toBeNull();
        expect(normalizarEquipmentId('12')).toBe(12);
        expect(normalizarEquipmentId('abc')).toBeNull();
    });

    it('um dia é impedido pelo bloqueio global ou pelo do próprio equipamento', async () => {
        expect(clausulaDeBloqueio(3)).toEqual([{ equipmentId: null }, { equipmentId: 3 }]);
        let consulta;
        const prisma = { blockedDate: { findFirst: async (args) => { consulta = args; return { reason: null }; } } };
        const bloqueio = await buscarBloqueioQueImpede(prisma, '2026-12-25', 3);
        expect(consulta).toEqual({ where: { date: '2026-12-25', OR: [{ equipmentId: null }, { equipmentId: 3 }] } });
        expect(motivoDoBloqueio(bloqueio)).toBe('Feriado/Recesso');
        expect(motivoDoBloqueio({ reason: 'Recesso de fim de ano' })).toBe('Recesso de fim de ano');
    });
});
