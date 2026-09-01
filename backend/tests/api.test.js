import request from 'supertest';

// Como não podemos mexer no server.js para exportar o 'app' 
// sem risco de quebrar o MCP/banco, vamos testar o servidor local
// que já está rodando na porta 3000.
const BASE_URL = 'http://localhost:3000';

describe('Testes da API de Equipamentos', () => {
    
    it('deve retornar uma lista de equipamentos com status 200', async () => {
        // Tenta fazer a chamada GET na rota pública de equipamentos
        const response = await request(BASE_URL).get('/api/equipment');
        
        // Espera que o status seja 200 (OK)
        expect(response.status).toBe(200);
        
        // Espera que o retorno seja um array de objetos JSON
        expect(Array.isArray(response.body)).toBe(true);
    });

    it('deve retornar 404 para um equipamento que não existe', async () => {
        const response = await request(BASE_URL).get('/api/equipment/99999');
        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('error');
    });

});
