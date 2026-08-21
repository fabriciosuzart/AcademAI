# 🔐 Contas de Teste (Seed)

Durante o desenvolvimento, configuramos um script de "Seed" (semeadura) do Prisma para injetar usuários automaticamente no banco de dados. Rode com `npx prisma db seed` dentro de `backend/` — ele cria estas contas e também os cadastros do laboratório recuperados em `prisma/seed-cadastros.js`. Isso facilita os testes das permissões (Middlewares) e do fluxo de aprovação de reservas sem precisar cadastrar contas na mão.

> Todas as contas abaixo possuem a mesma senha padrão: **`senha123`**

| Nome | E-mail de Login | Perfil (Role) | Permissões |
| :--- | :--- | :--- | :--- |
| **Administrador Geral** | `admin@academai.com` | `ADMIN` | Acesso total ao Painel Admin. Pode cadastrar equipamentos, treinar a IA e aprovar/rejeitar reservas. |
| **Professor Responsável** | `prof@academai.com` | `PROFESSOR` | Acesso parcial ao Painel Admin. Pode visualizar as pendências e aprovar/rejeitar reservas de equipamentos. |
| **Aluno 1** | `aluno1@academai.com` | `ALUNO` | Usuário padrão. Pode navegar, conversar com a IA, solicitar reservas (com justificativa) e acompanhar seu Histórico. |
| **Aluno 2** | `aluno2@academai.com` | `ALUNO` | Usuário padrão. Conta extra para testar múltiplos agendamentos concorrentes. |

---

**Dica para Testes Rápidos:**
Para testar o fluxo de aprovação, sugerimos o seguinte passo-a-passo:
1. Faça login como `aluno1@academai.com` e solicite uma reserva de equipamento.
2. Saia e faça login como `prof@academai.com` ou `admin`.
3. Navegue até a aba "Reservas Pendentes" no Painel Admin e clique em "Aprovar".
4. Volte para a conta do aluno e verifique se o status mudou para a cor verde (Aprovado) no histórico!
