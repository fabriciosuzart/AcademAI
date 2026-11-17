// Cards das respostas de ação do assistente (lista de equipamentos, reserva,
// agendamento a completar, login). O backend manda o card pronto em JSON junto da
// frase fixa — ver backend/chat_intent.js e a rota /api/chat em backend/server.js.
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Clock, LogIn, User } from 'lucide-react';
import { classeStatus, ehManutencao, rotuloStatus } from '../../utils/status';
import './CardChat.css';

export interface ReservaChat {
  id: number;
  equipamento: string;
  equipmentId: number;
  date: string;
  time: string;
  endTime: string;
  status: 'APROVADA' | 'PENDENTE';
}

export interface EquipamentoChat {
  id: number;
  name: string;
  modelo: string;
  status: string;
}

export interface SugestaoAgendamento {
  equipamento: string | null;
  equipmentId: number | null;
  data: string | null;
  inicio: string | null;
}

export type CardChatDados =
  | { tipo: 'reserva'; reserva: ReservaChat }
  | { tipo: 'equipamentos'; itens: EquipamentoChat[]; total?: number; filtro?: 'disponiveis' | 'todos'; logado: boolean }
  | { tipo: 'agendar'; sugestao: SugestaoAgendamento }
  | { tipo: 'login' };

/** "2026-11-20" -> "20/11/2026". */
const dataBR = (iso: string) => iso.split('-').reverse().join('/');

/** Abre a tela de agendamento com o que o chat já entendeu (Agendamento.tsx lê este state). */
function useAbrirAgendamento() {
  const navigate = useNavigate();
  return (s: Partial<SugestaoAgendamento>) =>
    navigate('/agendamento', {
      state: {
        equipmentId: s.equipmentId ? String(s.equipmentId) : '',
        preDate: s.data ?? undefined,
        preTime: s.inicio ?? undefined,
      },
    });
}

const CardReserva: React.FC<{ reserva: ReservaChat }> = ({ reserva }) => {
  const navigate = useNavigate();
  const aprovada = reserva.status === 'APROVADA';
  return (
    <div className="chat-card">
      <div className="chat-card-head">
        <strong>{reserva.equipamento}</strong>
        <span className={`chat-badge ${aprovada ? 'ok' : 'pending'}`}>
          {aprovada ? <CheckCircle2 size={14} aria-hidden="true" /> : <Clock size={14} aria-hidden="true" />}
          {aprovada ? 'Aprovada' : 'Pendente'}
        </span>
      </div>
      <dl className="chat-card-kv">
        <div><dt>Data</dt><dd>{dataBR(reserva.date)}</dd></div>
        <div><dt>Horário</dt><dd>{reserva.time} às {reserva.endTime}</dd></div>
      </dl>
      <div className="chat-card-actions">
        <button type="button" className="chat-card-btn" onClick={() => navigate('/perfil')}>
          <User size={16} aria-hidden="true" /> Ver no Perfil
        </button>
      </div>
    </div>
  );
};

const CardEquipamentos: React.FC<{
  itens: EquipamentoChat[];
  total?: number;
  filtro?: 'disponiveis' | 'todos';
  logado: boolean;
}> = ({ itens, total, filtro, logado }) => {
  const navigate = useNavigate();
  const abrirAgendamento = useAbrirAgendamento();

  // A lista rola dentro do card: sem um sinal, parecia ter só os itens visíveis.
  // O degradê no rodapé some quando a rolagem chega ao fim.
  const listaRef = useRef<HTMLUListElement>(null);
  const [temMais, setTemMais] = useState(false);
  const atualizarTemMais = () => {
    const el = listaRef.current;
    if (el) setTemMais(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  };
  useEffect(atualizarTemMais, [itens]);

  const rodape = filtro === 'disponiveis' && total && total > itens.length
    ? `Mostrando ${itens.length} de ${total} equipamentos (só os disponíveis)`
    : `${itens.length} ${itens.length === 1 ? 'equipamento' : 'equipamentos'}`;

  return (
    <div className="chat-card">
      <div className={`chat-card-scroll ${temMais ? 'tem-mais' : ''}`}>
      <ul className="chat-card-list" ref={listaRef} onScroll={atualizarTemMais}>
        {itens.map((e) => (
          <li key={e.id}>
            <div className="chat-card-item">
              <strong>{e.name}</strong>
              <span className={`chat-badge ${classeStatus(e.status)}`}>{rotuloStatus(e.status)}</span>
            </div>
            <div className="chat-card-actions">
              <button type="button" className="chat-card-btn ghost" onClick={() => navigate(`/equipamento/${e.id}`)}>
                Detalhes
              </button>
              {!ehManutencao(e.status) && (
                <button
                  type="button"
                  className="chat-card-btn"
                  onClick={() =>
                    logado
                      ? abrirAgendamento({ equipmentId: e.id })
                      : navigate('/login', { state: { from: 'agendamento', equipmentId: e.id } })
                  }
                >
                  <CalendarDays size={16} aria-hidden="true" /> Agendar
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      </div>
      <p className="chat-card-note">{rodape}{temMais ? ' · role para ver mais' : ''}</p>
    </div>
  );
};

const CardAgendar: React.FC<{ sugestao: SugestaoAgendamento }> = ({ sugestao }) => {
  const abrirAgendamento = useAbrirAgendamento();
  const entendido = [
    sugestao.equipamento,
    sugestao.data && dataBR(sugestao.data),
    sugestao.inicio && `às ${sugestao.inicio}`,
  ].filter(Boolean);
  return (
    <div className="chat-card">
      {entendido.length > 0 && <p className="chat-card-note">Entendi: {entendido.join(' · ')}</p>}
      <div className="chat-card-actions">
        <button type="button" className="chat-card-btn" onClick={() => abrirAgendamento(sugestao)}>
          <CalendarDays size={16} aria-hidden="true" /> Abrir agendamento
        </button>
      </div>
    </div>
  );
};

const CardLogin: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="chat-card">
      <div className="chat-card-actions">
        <button type="button" className="chat-card-btn" onClick={() => navigate('/login')}>
          <LogIn size={16} aria-hidden="true" /> Entrar
        </button>
      </div>
    </div>
  );
};

const CardChat: React.FC<{ card: CardChatDados }> = ({ card }) => {
  switch (card.tipo) {
    case 'reserva': return <CardReserva reserva={card.reserva} />;
    case 'equipamentos':
      return <CardEquipamentos itens={card.itens} total={card.total} filtro={card.filtro} logado={card.logado} />;
    case 'agendar': return <CardAgendar sugestao={card.sugestao} />;
    case 'login': return <CardLogin />;
    default: return null;
  }
};

export default CardChat;
