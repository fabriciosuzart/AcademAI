import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import './Disponibilidade.css';
import { classeStatus, ehDisponivel, normalizarStatus, rotuloStatus, OPCOES_STATUS } from '../../utils/status';
import {
    HORA_ABERTURA,
    HORA_FECHAMENTO,
    PASSO_SLOT,
    haSobreposicao,
    paraHorario,
    paraMinutos,
    somarMinutos,
} from '../../utils/horarios';
import type { DataBloqueada } from '../../utils/bloqueios';
import { bloqueioDoDia, motivoDoBloqueio } from '../../utils/bloqueios';
import api from '../../api/axios';

/** Data local em YYYY-MM-DD. `toISOString` converte para UTC e, a oeste de
 *  Greenwich, devolveria o dia anterior. */
const paraISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface Equipment {
    id: number;
    name: string;
    status: string;
    imagePath?: string;
}

interface BookedSlot {
    date: string;
    time: string;
    endTime: string | null;
    status: string;
}

const Disponibilidade: React.FC = () => {
    const navigate = useNavigate();
    const { isLoggedIn } = useAuth();
    const [equipments, setEquipments] = useState<Equipment[]>([]);
    const [selectedEquipment, setSelectedEquipment] = useState<number | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
    const [blockedDates, setBlockedDates] = useState<DataBloqueada[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('all');

    // Carrega lista de equipamentos
    useEffect(() => {
        const fetchEquipments = async () => {
            try {
                const res = await fetch('http://localhost:3000/api/equipment');
                const data = await res.json();
                setEquipments(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Erro ao carregar equipamentos:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchEquipments();
    }, []);

    // Carrega as datas bloqueadas (feriados, recesso). A lista traz tanto os
    // bloqueios globais quanto os de equipamento; o filtro por maquina e feito
    // na hora de desenhar o dia.
    useEffect(() => {
        const fetchBlocked = async () => {
            try {
                const res = await api.get('/blocked-dates');
                setBlockedDates(res.data);
            } catch (error) {
                console.error("Erro ao buscar datas bloqueadas:", error);
            }
        };
        fetchBlocked();
    }, []);

    // Carrega reservas do equipamento selecionado
    useEffect(() => {
        if (!selectedEquipment) {
            setBookedSlots([]);
            return;
        }
        const fetchBookings = async () => {
            try {
                const res = await fetch(`http://localhost:3000/api/appointments/equipment/${selectedEquipment}`);
                if (res.ok) {
                    const data = await res.json();
                    setBookedSlots(data);
                }
            } catch (error) {
                console.error("Erro ao buscar agendamentos:", error);
            }
        };
        fetchBookings();
    }, [selectedEquipment]);

    const filteredEquipments = equipments.filter(eq => {
        if (filterType === 'all') return true;
        return normalizarStatus(eq.status) === filterType;
    });

    // Calendar logic
    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    const hasBookingOnDate = (dateStr: string) => {
        return bookedSlots.some(b => b.date === dateStr);
    };

    const renderCalendarDays = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const days = [];
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="disp-day empty" />);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dateObj = new Date(year, month, i);
            const isPast = dateObj < today;
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            const isSelected = selectedDate?.toDateString() === dateObj.toDateString();
            const dateStr = paraISO(dateObj);
            const hasBooking = hasBookingOnDate(dateStr);

            // Feriado/recesso tranca o dia aqui tambem. Antes so o calendario
            // do formulario respeitava o bloqueio, e esta tela ainda oferecia
            // "Reservar" num dia que o backend ia recusar com 403.
            const bloqueio = bloqueioDoDia(blockedDates, dateStr, selectedEquipment);
            const disabled = isPast || isWeekend || !!bloqueio;
            const motivo = bloqueio
                ? motivoDoBloqueio(bloqueio)
                : isPast || isWeekend
                  ? 'indisponível'
                  : '';

            days.push(
                <div
                    key={i}
                    className={`disp-day ${disabled ? 'disabled' : 'selectable'} ${bloqueio ? 'bloqueado' : ''} ${isSelected ? 'selected' : ''} ${hasBooking && !disabled ? 'has-booking' : ''}`}
                    onClick={() => { if (!disabled) setSelectedDate(dateObj); }}
                    role="gridcell"
                    title={bloqueio ? motivoDoBloqueio(bloqueio) : ''}
                    aria-label={`${i} de ${monthNames[month]}, ${disabled ? motivo : hasBooking ? 'possui reservas' : 'livre'}`}
                    aria-selected={isSelected}
                    aria-disabled={disabled}
                    tabIndex={disabled ? -1 : 0}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !disabled) setSelectedDate(dateObj); }}
                >
                    <span className="day-number">{i}</span>
                    {hasBooking && !disabled && <span className="booking-dot" />}
                </div>
            );
        }
        return days;
    };

    /** Horario que ja passou, quando o dia escolhido e hoje. */
    const ehPassado = (dia: Date, horario: string) => {
        const agora = new Date();
        if (paraISO(dia) !== paraISO(agora)) return false;
        return paraMinutos(horario) <= agora.getHours() * 60 + agora.getMinutes();
    };

    // Mesmo passo e mesma regra de sobreposicao do CalendarPicker: as duas
    // telas mostram as mesmas reservas e nao podem discordar sobre quem esta livre.
    const generateTimeSlots = () => {
        if (!selectedDate) return [];
        const dateStr = paraISO(selectedDate);
        const dayBookings = bookedSlots
            .filter(b => b.date === dateStr)
            // Reserva antiga sem fim gravado: assume 1h.
            .map(b => ({ inicio: b.time, fim: b.endTime || somarMinutos(b.time, 60) }));

        const slots = [];
        const fechamento = paraMinutos(HORA_FECHAMENTO);
        for (
            let minuto = paraMinutos(HORA_ABERTURA);
            minuto + PASSO_SLOT <= fechamento;
            minuto += PASSO_SLOT
        ) {
            const inicio = paraHorario(minuto);
            const fim = paraHorario(minuto + PASSO_SLOT);
            slots.push({
                time: inicio,
                isBooked: dayBookings.some(b => haSobreposicao(inicio, fim, b.inicio, b.fim)),
                passado: ehPassado(selectedDate, inicio),
            });
        }
        return slots;
    };

    const handleReserveSlot = (time: string) => {
        if (!selectedEquipment || !selectedDate) return;
        const dateStr = paraISO(selectedDate);

        // Rede de seguranca: o dia bloqueado ja nao e clicavel, mas o bloqueio
        // pode ter sido criado depois que esta tela carregou.
        const bloqueio = bloqueioDoDia(blockedDates, dateStr, selectedEquipment);
        if (bloqueio) {
            alert(`Esta data está bloqueada. Motivo: ${motivoDoBloqueio(bloqueio)}`);
            return;
        }
        if (isLoggedIn) {
            navigate('/agendamento', {
                state: { equipmentId: selectedEquipment, preDate: dateStr, preTime: time }
            });
        } else {
            navigate('/login', {
                state: { from: 'agendamento', equipmentId: selectedEquipment, preDate: dateStr, preTime: time }
            });
        }
    };

    const selectedEquipmentData = equipments.find(e => e.id === selectedEquipment);

    return (
        <div className="disponibilidade-page" role="main" aria-label="Consulta de disponibilidade de recursos">
            <header className="disp-header">
                <h1>Disponibilidade de Recursos</h1>
                <p>Consulte a disponibilidade dos equipamentos e ambientes do laboratório</p>
            </header>

            <div className="disp-layout">
                {/* Painel de recursos */}
                <aside className="disp-sidebar" aria-label="Lista de recursos">
                    <div className="disp-filter">
                        <label htmlFor="filter-type" id="filter-label">Filtrar por status:</label>
                        <select
                            id="filter-type"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            aria-labelledby="filter-label"
                        >
                            <option value="all">Todos</option>
                            {OPCOES_STATUS.map(({ valor, rotulo }) => (
                                <option key={valor} value={valor}>{rotulo}</option>
                            ))}
                        </select>
                    </div>

                    <div className="disp-equipment-list">
                        {loading ? (
                            <p className="loading-text">Carregando equipamentos...</p>
                        ) : filteredEquipments.length === 0 ? (
                            <p className="loading-text">Nenhum equipamento encontrado.</p>
                        ) : (
                            filteredEquipments.map(eq => (
                                <button
                                    key={eq.id}
                                    className={`disp-eq-card ${selectedEquipment === eq.id ? 'active' : ''}`}
                                    onClick={() => {
                                        setSelectedEquipment(eq.id);
                                        setSelectedDate(null);
                                    }}
                                    aria-label={`${eq.name}, status: ${rotuloStatus(eq.status)}`}
                                    aria-pressed={selectedEquipment === eq.id}
                                >
                                    <span className={`eq-status-dot ${classeStatus(eq.status)}`} />
                                    <span className="eq-name">{eq.name}</span>
                                </button>
                            ))
                        )}
                    </div>
                </aside>

                {/* Calendário */}
                <section className="disp-main" aria-label="Calendário de disponibilidade">
                    {!selectedEquipment ? (
                        <div className="disp-empty-state">
                            <span className="empty-icon"><CalendarDays size={40} aria-hidden="true" /></span>
                            <h2>Selecione um recurso</h2>
                            <p>Escolha um equipamento na lista ao lado para consultar a disponibilidade.</p>
                        </div>
                    ) : (
                        <>
                            <div className="disp-resource-header">
                                <h2>{selectedEquipmentData?.name}</h2>
                                <span className={`disp-status-badge ${ehDisponivel(selectedEquipmentData?.status) ? 'available' : 'unavailable'}`}>
                                    {rotuloStatus(selectedEquipmentData?.status)}
                                </span>
                            </div>

                            <div className="disp-calendar" role="grid" aria-label="Calendário mensal">
                                <div className="cal-nav">
                                    <button
                                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                                        aria-label="Mês anterior"
                                    >
                                        <ChevronLeft size={20} aria-hidden="true" />
                                    </button>
                                    <h3>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
                                    <button
                                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                                        aria-label="Próximo mês"
                                    >
                                        <ChevronRight size={20} aria-hidden="true" />
                                    </button>
                                </div>

                                <div className="cal-weekdays" role="row">
                                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                                        <span key={d} role="columnheader">{d}</span>
                                    ))}
                                </div>

                                <div className="cal-grid">
                                    {renderCalendarDays()}
                                </div>

                                <div className="cal-legend">
                                    <span><span className="legend-dot free" /> Livre</span>
                                    <span><span className="legend-dot booked" /> Com reservas</span>
                                    <span><span className="legend-dot disabled" /> Indisponível</span>
                                    <span><span className="legend-dot bloqueado" /> Bloqueado (feriado/recesso)</span>
                                </div>
                            </div>

                            {/* Time slots */}
                            {selectedDate && (
                                <div className="disp-timeslots" aria-label={`Horários para ${selectedDate.toLocaleDateString('pt-BR')}`}>
                                    <h3>Horários — {selectedDate.toLocaleDateString('pt-BR')}</h3>
                                    <div className="timeslot-grid">
                                        {generateTimeSlots().map(slot => {
                                            const indisponivel = slot.isBooked || slot.passado;
                                            const rotulo = slot.isBooked ? 'Ocupado' : slot.passado ? 'Já passou' : 'Livre';
                                            return (
                                                <div key={slot.time} className={`timeslot ${indisponivel ? 'booked' : 'free'}`}>
                                                    <span className="timeslot-time">{slot.time}</span>
                                                    <span className="timeslot-label">{rotulo}</span>
                                                    {!indisponivel && (
                                                        <button
                                                            className="timeslot-reserve-btn"
                                                            onClick={() => handleReserveSlot(slot.time)}
                                                            aria-label={`Reservar às ${slot.time}`}
                                                        >
                                                            Reservar
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </section>
            </div>
        </div>
    );
};

export default Disponibilidade;
