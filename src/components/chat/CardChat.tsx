// Cards das respostas de ação do assistente (lista de equipamentos, reserva,
// confirmação, minhas reservas, agendamento a completar, login). O backend manda o
// card pronto em JSON junto da frase fixa — ver backend/chat_intent.js e a rota
// /api/chat em backend/server.js.
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Clock, LogIn, User, X } from 'lucide-react';
import axios from 'axios';
import api from '../../api/axios';
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

/** Reserva validada mas ainda não gravada: o usuário confirma no card (UC12). */
export type PreviaReserva = Omit<ReservaChat, 'id'>;

/** Estado do card de confirmação, guardado na mensagem pelo Assistente. */
export type EstadoConfirmacao = 'pendente' | 'enviando' | 'feita' | 'descartada';

export interface EquipamentoChat {
  id: number;
  name: string;
  modelo: string;
  status: string;
}

/** Horário livre calculado pelo backend em caso de conflito (RN07). */
export interface HorarioLivre {
  date: string;
  time: string;
  endTime: string;
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
  | { tipo: 'agendar'; sugestao: SugestaoAgendamento; alternativas?: HorarioLivre[] }
  | { tipo: 'confirmar'; previa: PreviaReserva }
  | { tipo: 'reservas'; itens: ReservaChat[]; acao: 'listar' | 'cancelar' }
  | { tipo: 'login' };

/** Ações que o card de confirmação devolve ao Assistente, que guarda o estado da conversa. */
export interface AcoesConfirmacao {
  estado?: EstadoConfirmacao;
  /** Finalidade digitada (RF08, obrigatória). Fica na mensagem, para o "sim" por texto/voz usá-la. */
  finalidade?: string;
  onFinalidade?: (valor: string) => void;
  onConfirmar?: (finalidade: string) => void;
  onDescartar?: () => void;
}

/** Mensagem de erro da API (campo "error" do backend), ou o texto padrão. */
function mensagemDaApi(erro: unknown, padrao: string): string {
  if (axios.isAxiosError(erro)) {
    const corpo = erro.response?.data as { error?: string } | undefined;
    if (corpo?.error) return corpo.error;
  }
  return padrao;
}

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

const CardAgendar: React.FC<{ sugestao: SugestaoAgendamento; alternativas?: HorarioLivre[] }> = ({ sugestao, alternativas = [] }) => {
  const abrirAgendamento = useAbrirAgendamento();
  const entendido = [
    sugestao.equipamento,
    sugestao.data && dataBR(sugestao.data),
    sugestao.inicio && `às ${sugestao.inicio}`,
  ].filter(Boolean);
  return (
    <div className="chat-card">
      {entendido.length > 0 && <p className="chat-card-note">Entendi: {entendido.join(' · ')}</p>}
      {alternativas.length > 0 && (
        <div className="chat-card-actions" role="group" aria-label="Horários livres sugeridos">
          {alternativas.map((h) => (
            <button
              key={`${h.date}-${h.time}`}
              type="button"
              className="chat-card-btn ghost"
              onClick={() => abrirAgendamento({ ...sugestao, data: h.date, inicio: h.time })}
              aria-label={`Agendar em ${dataBR(h.date)}, das ${h.time} às ${h.endTime}`}
            >
              <CalendarDays size={16} aria-hidden="true" /> {dataBR(h.date)} · {h.time}–{h.endTime}
            </button>
          ))}
        </div>
      )}
      <div className="chat-card-actions">
        <button type="button" className="chat-card-btn" onClick={() => abrirAgendamento(sugestao)}>
          <CalendarDays size={16} aria-hidden="true" /> Abrir agendamento
        </button>
      </div>
    </div>
  );
};

const CardConfirmar: React.FC<{ previa: PreviaReserva } & AcoesConfirmacao> = ({
  previa, estado = 'pendente', finalidade = '', onFinalidade, onConfirmar, onDescartar,
}) => {
  const abrirAgendamento = useAbrirAgendamento();
  const semFinalidade = !finalidade.trim();
  const aprovada = previa.status === 'APROVADA';
  const aberto = estado === 'pendente' || estado === 'enviando';
  return (
    <div className="chat-card">
      <div className="chat-card-head">
        <strong>{previa.equipamento}</strong>
        <span className={`chat-badge ${aprovada ? 'ok' : 'pending'}`}>
          {aprovada ? 'Aprovação automática' : 'Precisa de aprovação'}
        </span>
      </div>
      <dl className="chat-card-kv">
        <div><dt>Data</dt><dd>{dataBR(previa.date)}</dd></div>
        <div><dt>Horário</dt><dd>{previa.time} às {previa.endTime}</dd></div>
      </dl>
      {aberto ? (
        <>
          <label className="chat-card-field">
            <span>Finalidade (obrigatória)</span>
            <input
              type="text"
              maxLength={500}
              required
              aria-required="true"
              value={finalidade}
              onChange={(e) => onFinalidade?.(e.target.value)}
              placeholder="Ex.: protótipo do projeto integrador"
              disabled={estado === 'enviando'}
            />
          </label>
          <div className="chat-card-actions">
            <button type="button" className="chat-card-btn" disabled={estado === 'enviando' || semFinalidade}
              title={semFinalidade ? 'Informe a finalidade para confirmar' : undefined}
              onClick={() => onConfirmar?.(finalidade)}>
              <CheckCircle2 size={16} aria-hidden="true" /> {estado === 'enviando' ? 'Confirmando…' : 'Confirmar'}
            </button>
            <button type="button" className="chat-card-btn ghost" disabled={estado === 'enviando'}
              onClick={() => abrirAgendamento({ equipmentId: previa.equipmentId, data: previa.date, inicio: previa.time })}>
              <CalendarDays size={16} aria-hidden="true" /> Alterar
            </button>
            <button type="button" className="chat-card-btn ghost" disabled={estado === 'enviando'} onClick={onDescartar}>
              <X size={16} aria-hidden="true" /> Não reservar
            </button>
          </div>
        </>
      ) : (
        <p className="chat-card-note">{estado === 'feita' ? 'Pedido confirmado.' : 'Reserva não feita.'}</p>
      )}
    </div>
  );
};

type EstadoItem = { fase: 'ativa' | 'perguntando' | 'cancelando' | 'cancelada'; erro?: string };

const CardReservas: React.FC<{ itens: ReservaChat[]; acao: 'listar' | 'cancelar' }> = ({ itens, acao }) => {
  const [estados, setEstados] = useState<Record<number, EstadoItem>>({});
  const estadoDe = (id: number): EstadoItem => estados[id] ?? { fase: 'ativa' };
  const mudar = (id: number, novo: EstadoItem) => setEstados((atual) => ({ ...atual, [id]: novo }));

  // O cancelamento é da rota REST (regra das 2h de antecedência, só o dono, notificações).
  // O chat só oferece o botão; a IA nunca cancela sozinha.
  const cancelar = async (id: number) => {
    mudar(id, { fase: 'cancelando' });
    try {
      await api.put(`/appointments/${id}/cancel`);
      mudar(id, { fase: 'cancelada' });
    } catch (erro) {
      mudar(id, { fase: 'ativa', erro: mensagemDaApi(erro, 'Não consegui cancelar agora. Tente de novo.') });
    }
  };

  return (
    <div className="chat-card">
      <ul className="chat-card-list">
        {itens.map((r) => {
          const { fase, erro } = estadoDe(r.id);
          const aprovada = r.status === 'APROVADA';
          return (
            <li key={r.id}>
              <div className="chat-card-item">
                <strong>{r.equipamento}</strong>
                {fase === 'cancelada'
                  ? <span className="chat-badge maintenance">Cancelada</span>
                  : <span className={`chat-badge ${aprovada ? 'ok' : 'pending'}`}>{aprovada ? 'Aprovada' : 'Pendente'}</span>}
              </div>
              <span className="chat-card-note">{dataBR(r.date)}, das {r.time} às {r.endTime}</span>
              {fase === 'perguntando' ? (
                <div className="chat-card-actions">
                  <span className="chat-card-note">Cancelar esta reserva?</span>
                  <button type="button" className="chat-card-btn danger" onClick={() => cancelar(r.id)}>Sim, cancelar</button>
                  <button type="button" className="chat-card-btn ghost" onClick={() => mudar(r.id, { fase: 'ativa' })}>Não</button>
                </div>
              ) : fase !== 'cancelada' && (
                <div className="chat-card-actions">
                  <button
                    type="button"
                    className={`chat-card-btn ${acao === 'cancelar' ? 'danger' : 'ghost'}`}
                    disabled={fase === 'cancelando'}
                    onClick={() => mudar(r.id, { fase: 'perguntando' })}
                  >
                    <X size={16} aria-hidden="true" /> {fase === 'cancelando' ? 'Cancelando…' : 'Cancelar'}
                  </button>
                </div>
              )}
              {erro && <p className="chat-card-erro" role="alert">{erro}</p>}
            </li>
          );
        })}
      </ul>
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

const CardChat: React.FC<{ card: CardChatDados } & AcoesConfirmacao> = ({ card, ...acoes }) => {
  switch (card.tipo) {
    case 'confirmar': return <CardConfirmar previa={card.previa} {...acoes} />;
    case 'reservas': return <CardReservas itens={card.itens} acao={card.acao} />;
    case 'reserva': return <CardReserva reserva={card.reserva} />;
    case 'equipamentos':
      return <CardEquipamentos itens={card.itens} total={card.total} filtro={card.filtro} logado={card.logado} />;
    case 'agendar': return <CardAgendar sugestao={card.sugestao} alternativas={card.alternativas} />;
    case 'login': return <CardLogin />;
    default: return null;
  }
};

export default CardChat;
