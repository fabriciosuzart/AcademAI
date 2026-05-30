import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Disponibilidade.css';

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
    const { requireAuth } = useAuth();
    const [equipments, setEquipments] = useState<Equipment[]>([]);
    const [selectedEquipment, setSelectedEquipment] = useState<number | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
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
        return eq.status === filterType;
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
            const dateStr = dateObj.toISOString().split('T')[0];
            const hasBooking = hasBookingOnDate(dateStr);
            const disabled = isPast || isWeekend;

            days.push(
                <div
                    key={i}
                    className={`disp-day ${disabled ? 'disabled' : 'selectable'} ${isSelected ? 'selected' : ''} ${hasBooking && !disabled ? 'has-booking' : ''}`}
                    onClick={() => { if (!disabled) setSelectedDate(dateObj); }}
                    role="gridcell"
                    aria-label={`${i} de ${monthNames[month]}, ${disabled ? 'indisponível' : hasBooking ? 'possui reservas' : 'livre'}`}
                    aria-selected={isSelected}
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

    const generateTimeSlots = () => {
        if (!selectedDate) return [];
        const dateStr = selectedDate.toISOString().split('T')[0];
        const dayBookings = bookedSlots.filter(b => b.date === dateStr);

        const slots = [];
        for (let hour = 8; hour <= 18; hour++) {
            const timeStr = `${hour.toString().padStart(2, '0')}:00`;
            let isBooked = false;
            for (const b of dayBookings) {
                const bHour = parseInt(b.time.split(':')[0]);
                const eHour = b.endTime ? parseInt(b.endTime.split(':')[0]) : bHour;
                if (hour >= bHour && hour <= eHour) {
                    isBooked = true;
                    break;
                }
            }
            slots.push({ time: timeStr, isBooked });
        }
        return slots;
    };

    const handleReserveSlot = (time: string) => {
        if (!selectedEquipment || !selectedDate) return;
        const dateStr = selectedDate.toISOString().split('T')[0];
        requireAuth(() => navigate('/agendamento', {
            state: { equipmentId: selectedEquipment, preDate: dateStr, preTime: time }
        }));
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
                            <option value="DISPONÍVEL">🟢 Disponíveis</option>
                            <option value="EM USO">🟠 Em Uso</option>
                            <option value="MANUTENÇÃO">🔴 Manutenção</option>
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
                                    aria-label={`${eq.name}, status: ${eq.status}`}
                                    aria-pressed={selectedEquipment === eq.id}
                                >
                                    <span className={`eq-status-dot ${eq.status === 'DISPONÍVEL' ? 'available' : eq.status === 'EM USO' ? 'in-use' : 'maintenance'}`} />
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
                            <span className="empty-icon">📅</span>
                            <h2>Selecione um recurso</h2>
                            <p>Escolha um equipamento na lista ao lado para consultar a disponibilidade.</p>
                        </div>
                    ) : (
                        <>
                            <div className="disp-resource-header">
                                <h2>{selectedEquipmentData?.name}</h2>
                                <span className={`disp-status-badge ${selectedEquipmentData?.status === 'DISPONÍVEL' ? 'available' : 'unavailable'}`}>
                                    {selectedEquipmentData?.status}
                                </span>
                            </div>

                            <div className="disp-calendar" role="grid" aria-label="Calendário mensal">
                                <div className="cal-nav">
                                    <button
                                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                                        aria-label="Mês anterior"
                                    >
                                        ◀
                                    </button>
                                    <h3>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
                                    <button
                                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                                        aria-label="Próximo mês"
                                    >
                                        ▶
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
                                </div>
                            </div>

                            {/* Time slots */}
                            {selectedDate && (
                                <div className="disp-timeslots" aria-label={`Horários para ${selectedDate.toLocaleDateString('pt-BR')}`}>
                                    <h3>Horários — {selectedDate.toLocaleDateString('pt-BR')}</h3>
                                    <div className="timeslot-grid">
                                        {generateTimeSlots().map(slot => (
                                            <div key={slot.time} className={`timeslot ${slot.isBooked ? 'booked' : 'free'}`}>
                                                <span className="timeslot-time">{slot.time}</span>
                                                <span className="timeslot-label">{slot.isBooked ? 'Ocupado' : 'Livre'}</span>
                                                {!slot.isBooked && (
                                                    <button
                                                        className="timeslot-reserve-btn"
                                                        onClick={() => handleReserveSlot(slot.time)}
                                                        aria-label={`Reservar às ${slot.time}`}
                                                    >
                                                        Reservar
                                                    </button>
                                                )}
                                            </div>
                                        ))}
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
