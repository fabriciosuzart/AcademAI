import {
    classificarResposta, perguntaDeConfirmacao, formatarDataBR,
    obterRascunho, salvarRascunho, encerrarEsperaDeConfirmacao, descartarRascunho,
    TTL_RASCUNHO_MS
} from '../confirmacao-reserva.js';

describe('Pergunta de confirmação (Regra 1)', () => {
    it('usa exatamente o texto especificado', () => {
        const texto = perguntaDeConfirmacao({ equipmentName: 'Impressora 3D Finder 01', date: '2026-10-25', time: '14:00' });
        expect(texto).toBe('Confirma a reserva da máquina Impressora 3D Finder 01 para o dia 25/10/2026 às 14:00?');
    });

    it('formata data ISO para o padrão brasileiro', () => {
        expect(formatarDataBR('2026-01-05')).toBe('05/01/2026');
        expect(formatarDataBR('amanhã')).toBe('amanhã');
    });
});

describe('Classificação da resposta (Regras 2 e 3)', () => {
    it.each([
        'sim', 'Sim!', 'S', 'confirmo', 'Confirmo a reserva', 'pode reservar', 'ok', 'Ok, obrigado',
        'isso mesmo', 'sim, pode confirmar por favor', 'claro', 'perfeito', '👍',
    ])('"%s" é CONFIRMA', (t) => {
        expect(classificarResposta(t)).toBe('CONFIRMA');
    });

    it.each([
        'não', 'Nao', 'não confirmo', 'não, obrigado', 'cancela', 'errado', 'não está certo', 'não quero',
    ])('"%s" é RECUSA', (t) => {
        expect(classificarResposta(t)).toBe('RECUSA');
    });

    it.each([
        'sim, mas às 15h', 'não, muda para amanhã', 'pode mudar o horário?', 'qual o horário de funcionamento?',
        'talvez', '', '   ', 'quero', 'acho que sim',
    ])('"%s" é OUTRO (não grava)', (t) => {
        expect(classificarResposta(t)).toBe('OUTRO');
    });
});

describe('Rascunho por usuário', () => {
    const args = { equipmentName: 'Laser CO2', date: '2026-10-25', time: '09:00', endTime: '10:00' };

    afterEach(() => descartarRascunho(42));

    it('salva aguardando confirmação e descarta', () => {
        salvarRascunho(42, args);
        expect(obterRascunho(42)).toMatchObject({ args, aguardandoConfirmacao: true });
        descartarRascunho(42);
        expect(obterRascunho(42)).toBeNull();
    });

    it('encerrar a espera mantém os dados mas impede a gravação por um "sim" solto', () => {
        salvarRascunho(42, args);
        encerrarEsperaDeConfirmacao(42);
        expect(obterRascunho(42)).toMatchObject({ args, aguardandoConfirmacao: false });
    });

    it('expira após o TTL', () => {
        const t0 = 1_000_000;
        salvarRascunho(42, args, t0);
        expect(obterRascunho(42, t0 + TTL_RASCUNHO_MS - 1)).not.toBeNull();
        expect(obterRascunho(42, t0 + TTL_RASCUNHO_MS)).toBeNull();
    });

    it('visitante (sem userId) nunca tem rascunho', () => {
        expect(obterRascunho(null)).toBeNull();
    });
});
