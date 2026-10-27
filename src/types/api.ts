// Formato das respostas do backend usadas pelas telas (ver backend/server.js e
// backend/prisma/schema.prisma). Só os campos que o front lê.

/** Linha da tabela Equipment, como GET /api/equipment e /api/equipment/:id devolvem. */
export interface Equipamento {
  id: number;
  name: string;
  modelo: string;
  description: string | null;
  imagePath: string | null;
  status: string;
}

/** Notificação (GET /api/notifications/:userId → { notifications, unreadCount }). */
export interface Notificacao {
  id: number;
  userId: number;
  type: 'RESERVA_APROVADA' | 'RESERVA_REJEITADA' | 'NOVA_PENDENTE' | 'RESERVA_CANCELADA' | string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedId: number | null;
}

/** Corpo de POST /api/auth/refresh: dados da sessão restaurada pelo cookie. */
export type RespostaSessao = Omit<RespostaLogin, 'auth'>;

/** Corpo de POST /api/login. O refresh token não vem aqui: vai num cookie HttpOnly. */
export interface RespostaLogin {
  auth: boolean;
  token: string;
  id: number;
  name: string;
  email: string;
  role: string;
  ra?: string | null;
  isTempPassword?: number;
}

/** Reserva nas listas do Perfil: GET /api/appointments/:userId e /api/appointments/all-history
 *  (esta traz também quem reservou). */
export interface ReservaHistorico {
  id: number;
  equipment: string;
  date: string;
  startTime: string;
  endTime: string | null;
  status: string;
  justification: string | null;
  rejectionReason: string | null;
  user?: string;
  userRole?: string;
}

/** Reserva com as relações do Prisma: GET /api/appointments/pending e a visão geral. */
export interface ReservaComRelacoes {
  id: number;
  date: string;
  time: string;
  endTime: string | null;
  status: string;
  justification: string | null;
  user: { name: string; role?: string; ra?: string | null; email?: string };
  equipment: { name: string };
}

/** GET /api/appointments/overview. */
export interface VisaoGeral {
  today: string;
  weekStart: string;
  weekEnd: string;
  todayAppointments: ReservaComRelacoes[];
  weekAppointments: ReservaComRelacoes[];
  pendingCount: number;
}

/** GET /api/reports/summary (RF30). */
export interface ResumoRelatorio {
  totalReservas: number;
  totalEquipamentos: number;
  totalUsuarios: number;
  reservasPorStatus: { status: string; total: number }[];
  usuariosPorPapel: { papel: string; total: number }[];
  topEquipamentos: { equipamento: string; total: number }[];
}

/** GET /api/audit-logs (RF07/RF30). */
export interface LogAuditoria {
  id: number;
  action: string;
  actor: string;
  target: string | null;
  detail: string | null;
  ip: string | null;
  createdAt: string;
}

/** GET /api/blocked-dates. equipment é null no bloqueio global. */
export interface Bloqueio {
  id: number;
  date: string;
  reason: string | null;
  equipmentId: number | null;
  equipment: { name: string } | null;
}
