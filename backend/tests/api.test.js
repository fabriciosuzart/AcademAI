import request from 'supertest';

// Testes contra o servidor local já rodando na porta 3000 (npm run test:api),
// com o banco populado pelo seed (contas de contas_teste.md). Só leitura: não
// alteram dados.
const BASE_URL = 'http://localhost:3000';

const entrar = async (email) => {
    const r = await request(BASE_URL).post('/api/login').send({ email, password: 'senha123' });
    return r.body;
};

describe('Testes da API de Equipamentos', () => {
    it('deve retornar uma lista de equipamentos com status 200', async () => {
        const response = await request(BASE_URL).get('/api/equipment');
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    it('deve retornar 404 para um equipamento que não existe', async () => {
        const response = await request(BASE_URL).get('/api/equipment/99999');
        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('error');
    });
});

describe('Autenticação e controle de acesso', () => {
    it('mensagem genérica para e-mail inexistente e senha errada (RF02)', async () => {
        const a = await request(BASE_URL).post('/api/login').send({ email: 'ninguem@academai.com', password: 'x1234567' });
        const b = await request(BASE_URL).post('/api/login').send({ email: 'prof@academai.com', password: 'errada123' });
        expect(a.status).toBe(401);
        expect(a.body.error).toBe(b.body.error);
    });

    it('rota protegida sem token responde 401 (RNF05)', async () => {
        const r = await request(BASE_URL).get('/api/users');
        expect(r.status).toBe(401);
    });

    it('estudante não lê estatísticas nem dados de outro usuário (RNF30/RNF28)', async () => {
        const aluno = await entrar('aluno1@academai.com');
        const prof = await entrar('prof@academai.com');
        const auth = { Authorization: `Bearer ${aluno.token}` };
        expect((await request(BASE_URL).get(`/api/users/${prof.id}/stats`).set(auth)).status).toBe(403);
        expect((await request(BASE_URL).get(`/api/users/${prof.id}/dados`).set(auth)).status).toBe(403);
        expect((await request(BASE_URL).get(`/api/users/${aluno.id}/dados`).set(auth)).status).toBe(200);
    });

    it('decisão de reserva só aceita APROVADA ou REJEITADA (RF14)', async () => {
        const admin = await entrar('admin@academai.com');
        const r = await request(BASE_URL).put('/api/appointments/1/status')
            .set({ Authorization: `Bearer ${admin.token}` }).send({ status: 'QUALQUER' });
        expect(r.status).toBe(400);
    });
});

describe('Regras de reserva (RF08)', () => {
    it('são públicas para as telas montarem as opções', async () => {
        const r = await request(BASE_URL).get('/api/config/reservas');
        expect(r.status).toBe(200);
        expect(r.body.regras).toHaveProperty('duracaoMaximaMinutos');
    });

    it('só o administrador altera', async () => {
        const aluno = await entrar('aluno1@academai.com');
        const r = await request(BASE_URL).put('/api/config/reservas')
            .set({ Authorization: `Bearer ${aluno.token}` }).send({ limiteReservasAtivas: 1 });
        expect(r.status).toBe(403);
    });
});
