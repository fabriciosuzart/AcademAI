// RNF09 — testes dos módulos criados nos ajustes do TCC: trava de reserva (RF16),
// horários alternativos (RN07), escopo do professor (RN02), acervo (RN11/RN12),
// regras configuráveis (RF08) e senha temporária (RF07). Rodam sem servidor e sem banco.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { comTrava, travasAtivas } from '../trava.js';
import { sugerirHorarios } from '../horarios.js';
import { lerEscopo, gravarEscopo, professorAbrange, podeAvaliar } from '../escopo.js';
import { podeAcessar, filtrarPorAcesso, rotuloDoArquivo, versaoVigente, normalizarAcesso } from '../acervo.js';
import { validarNovasRegras, salvarRegras, carregarRegras, REGRAS_RESERVA, REGRAS_PADRAO } from '../config-reservas.js';
import { senhaTemporariaExpirada, validadeSenhaTemporaria, gerarSenhaTemporaria, VALIDADE_SENHA_TEMPORARIA_MS } from '../auth-regras.js';
import { validarSenha } from '../validacao-cadastro.js';
import { detalhe } from '../auditoria.js';
import { escaparHtml } from '../notificacoes.js';
import { textoReserva } from '../chat_intent.js';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

describe('Trava de reserva (trava.js — RF16)', () => {
    it('executa em fila quem usa a mesma chave, sem intercalar', async () => {
        const ordem = [];
        const tarefa = (nome, ms) => comTrava('reservas', async () => {
            ordem.push(`${nome}:inicio`);
            await esperar(ms);
            ordem.push(`${nome}:fim`);
            return nome;
        });
        const resultados = await Promise.all([tarefa('A', 30), tarefa('B', 5), tarefa('C', 1)]);
        expect(resultados).toEqual(['A', 'B', 'C']);
        expect(ordem).toEqual(['A:inicio', 'A:fim', 'B:inicio', 'B:fim', 'C:inicio', 'C:fim']);
        expect(travasAtivas()).toBe(0);
    });

    it('libera a fila mesmo quando a tarefa falha', async () => {
        await expect(comTrava('x', async () => { throw new Error('falhou'); })).rejects.toThrow('falhou');
        await expect(comTrava('x', async () => 'ok')).resolves.toBe('ok');
        expect(travasAtivas()).toBe(0);
    });

    it('simula a corrida: só um de três pedidos sobrepostos é gravado', async () => {
        const gravadas = [];
        const pedir = (inicio, fim) => comTrava('reservas', async () => {
            await esperar(2); // "consulta" ao banco
            const conflito = gravadas.some(([a, b]) => inicio < b && a < fim);
            if (!conflito) gravadas.push([inicio, fim]);
            return !conflito;
        });
        const ok = await Promise.all([pedir(600, 660), pedir(630, 690), pedir(615, 645)]);
        expect(ok.filter(Boolean)).toHaveLength(1);
    });
});

describe('Horários alternativos (horarios.js — RN07)', () => {
    it('lista inícios livres na grade de 30 min, sem invadir reservas', () => {
        const ocupadas = [{ time: '08:00', endTime: '10:00' }, { time: '11:00', endTime: '12:00' }];
        const livres = sugerirHorarios(ocupadas, 60, { abertura: '08:00', fechamento: '13:00' });
        expect(livres).toEqual(['10:00', '12:00']);
    });

    it('intervalo meio-aberto: terminar quando a outra começa é permitido', () => {
        expect(sugerirHorarios([{ time: '09:00', endTime: '10:00' }], 60, { abertura: '08:00', fechamento: '11:00' }))
            .toEqual(['08:00', '10:00']);
    });

    it('reserva antiga sem término ocupa a duração padrão (60 min)', () => {
        expect(sugerirHorarios([{ time: '08:00', endTime: null }], 30, { abertura: '08:00', fechamento: '10:00' }))
            .toEqual(['09:00', '09:30']);
    });

    it('chat mostra as alternativas no texto do conflito', () => {
        const texto = textoReserva({
            ok: false, codigo: 'CONFLITO', equipamento: 'Cortadora a Laser', date: '2026-11-27',
            alternativas: [{ date: '2026-11-27', time: '10:00', endTime: '11:00' }],
        });
        expect(texto).toMatch(/Horários livres/);
        expect(texto).toMatch(/das 10:00 às 11:00/);
    });
});

describe('Escopo do professor (escopo.js — RN02)', () => {
    it('normaliza a lista de modelos', () => {
        expect(lerEscopo(' Bambu Lab ,Cortadora a Laser,, Bambu Lab')).toEqual(['Bambu Lab', 'Cortadora a Laser']);
        expect(gravarEscopo(['Cortadora a Laser', ' X1 '])).toBe('Cortadora a Laser, X1');
    });

    it('escopo vazio abrange todos; com lista, só os modelos dela', () => {
        expect(professorAbrange('', 'Qualquer')).toBe(true);
        expect(professorAbrange('Bambu Lab', 'bambu lab')).toBe(true);
        expect(professorAbrange('Bambu Lab', 'Cortadora a Laser')).toBe(false);
    });

    it('admin avalia tudo; professor só reservas de estudante no escopo', () => {
        const prof = { role: 'PROFESSOR', isActive: true, escopoAprovacao: 'Bambu Lab' };
        expect(podeAvaliar({ role: 'ADMIN', isActive: true }, { papelSolicitante: 'PROFESSOR', modelo: 'X' })).toBe(true);
        expect(podeAvaliar(prof, { papelSolicitante: 'ALUNO', modelo: 'Bambu Lab' })).toBe(true);
        expect(podeAvaliar(prof, { papelSolicitante: 'ALUNO', modelo: 'Cortadora a Laser' })).toBe(false);
        expect(podeAvaliar(prof, { papelSolicitante: 'PROFESSOR', modelo: 'Bambu Lab' })).toBe(false);
        expect(podeAvaliar({ ...prof, isActive: false }, { papelSolicitante: 'ALUNO', modelo: 'Bambu Lab' })).toBe(false);
    });
});

describe('Acervo (acervo.js — RN11/RN12)', () => {
    const meta = {
        'a.pdf.md': { original: 'Normas.pdf', versao: 2, acesso: 'todos' },
        'b.pdf.md': { original: 'Manual interno.pdf', versao: 1, acesso: 'professores' },
        'c.md': { original: 'Senhas do servidor.md', versao: 1, acesso: 'administradores' },
    };
    const vetores = ['a.pdf.md', 'b.pdf.md', 'c.md', 'base.md'].map((n) => ({ source: `Arquivo: ${n}` }));
    const nomeDoSource = (s) => s.replace(/^Arquivo:\s*/, '');

    it('cada perfil só recupera os documentos que pode ler', () => {
        const nomes = (papel) => filtrarPorAcesso(vetores, meta, papel, nomeDoSource).map((v) => nomeDoSource(v.source));
        expect(nomes(null)).toEqual(['a.pdf.md', 'base.md']);
        expect(nomes('ALUNO')).toEqual(['a.pdf.md', 'base.md']);
        expect(nomes('PROFESSOR')).toEqual(['a.pdf.md', 'b.pdf.md', 'base.md']);
        expect(nomes('ADMIN')).toHaveLength(4);
    });

    it('nível desconhecido vira "todos"; fonte mostra o nome original', () => {
        expect(normalizarAcesso('qualquer')).toBe('todos');
        expect(podeAcessar('administradores', 'PROFESSOR')).toBe(false);
        expect(rotuloDoArquivo(meta, 'a.pdf.md')).toBe('Normas.pdf');
        expect(rotuloDoArquivo(meta, 'base.md')).toBe('base.md');
    });

    it('acha a versão vigente pelo nome original, sem diferenciar caixa', () => {
        expect(versaoVigente(meta, 'normas.PDF')[0]).toBe('a.pdf.md');
        expect(versaoVigente(meta, 'Outro.pdf')).toBeNull();
    });
});

describe('Regras de reserva configuráveis (config-reservas.js — RF08)', () => {
    it('aceita só números inteiros dentro da faixa', () => {
        expect(validarNovasRegras({ limiteReservasAtivas: 5 }).ok).toBe(true);
        expect(validarNovasRegras({ limiteReservasAtivas: 0 }).ok).toBe(false);
        expect(validarNovasRegras({ duracaoMaximaMinutos: 'muito' }).ok).toBe(false);
        expect(validarNovasRegras({ inventada: 1 }).ok).toBe(false);
        expect(validarNovasRegras({ duracaoMinimaMinutos: 120, duracaoMaximaMinutos: 60 }).ok).toBe(false);
    });

    it('grava no arquivo, aplica na hora e volta ao padrão ao recarregar sem arquivo', () => {
        const arquivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'regras-')), 'regras.json');
        expect(salvarRegras({ limiteReservasAtivas: 7, antecedenciaCancelamentoHoras: 4 }, arquivo).ok).toBe(true);
        expect(REGRAS_RESERVA.limiteReservasAtivas).toBe(7);
        expect(JSON.parse(fs.readFileSync(arquivo, 'utf-8')).antecedenciaCancelamentoHoras).toBe(4);
        carregarRegras(path.join(path.dirname(arquivo), 'nao-existe.json'));
        expect(REGRAS_RESERVA).toEqual({ ...REGRAS_PADRAO });
        carregarRegras(arquivo);
        expect(REGRAS_RESERVA.limiteReservasAtivas).toBe(7);
        carregarRegras(path.join(path.dirname(arquivo), 'nao-existe.json'));
    });
});

describe('Senha temporária (auth-regras.js — RF07)', () => {
    const AGORA = new Date('2026-11-19T10:00:00');

    it('vale por 60 minutos', () => {
        const validade = validadeSenhaTemporaria(AGORA);
        expect(validade.getTime() - AGORA.getTime()).toBe(VALIDADE_SENHA_TEMPORARIA_MS);
        const usuario = { isTempPassword: 1, tempPasswordExpiresAt: validade };
        expect(senhaTemporariaExpirada(usuario, new Date(AGORA.getTime() + 59 * 60000))).toBe(false);
        expect(senhaTemporariaExpirada(usuario, new Date(AGORA.getTime() + 61 * 60000))).toBe(true);
        expect(senhaTemporariaExpirada({ isTempPassword: 0, tempPasswordExpiresAt: validade }, new Date(2030, 0, 1))).toBe(false);
    });

    it('é gerada com letras e números, atendendo a política do RF01', () => {
        for (let i = 0; i < 50; i++) {
            const senha = gerarSenhaTemporaria();
            expect(senha).toHaveLength(10);
            expect(validarSenha(senha)).toBeNull();
            expect(senha).not.toMatch(/[0O1lI]/);
        }
    });
});

describe('Auditoria e e-mail', () => {
    it('monta o detalhe sem campos vazios', () => {
        expect(detalhe({ a: 1, b: null, c: '', d: 'x' })).toBe('a=1; d=x');
    });

    it('escapa HTML vindo de nomes e motivos', () => {
        expect(escaparHtml('<script>"x"</script>')).toBe('&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
    });
});
