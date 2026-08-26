import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import './CalendarPicker.css';
import {
    DURACOES,
    HORA_ABERTURA,
    HORA_FECHAMENTO,
    PASSO_SLOT,
    formatarDuracao,
    haSobreposicao,
    paraHorario,
    paraMinutos,
    somarMinutos,
} from '../utils/horarios';

interface CalendarPickerProps {
    equipmentId: string;
    /** Devolve o intervalo escolhido. `endTime` ja vem somado a duracao. */
    onDateTimeSelect: (date: string, time: string, endTime: string) => void;
}

/** Data local em YYYY-MM-DD. `toISOString` converte para UTC e, a oeste de
 *  Greenwich, devolveria o dia anterior. */
const paraISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const CalendarPicker: React.FC<CalendarPickerProps> = ({ equipmentId, onDateTimeSelect }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [duracao, setDuracao] = useState<number>(60);
    const [bookedSlots, setBookedSlots] = useState<{ date: string, time: string, endTime: string | null }[]>([]);
    const [blockedDates, setBlockedDates] = useState<any[]>([]);
    
    // Fetch booked slots when equipment changes
    useEffect(() => {
        if (!equipmentId) {
            setBookedSlots([]);
            return;
        }
        
        const fetchBookings = async () => {
            try {
                const res = await api.get(`/appointments/equipment/${equipmentId}`);
                if (res.status === 200) {
                    setBookedSlots(res.data);
                }
            } catch (error) {
                console.error("Erro ao buscar agendamentos do equipamento:", error);
            }
        };
        
        const fetchBlocked = async () => {
            try {
                const res = await api.get('/blocked-dates');
                setBlockedDates(res.data);
            } catch (error) {
                console.error("Erro ao buscar datas bloqueadas:", error);
            }
        };

        fetchBookings();
        fetchBlocked();
    }, [equipmentId]);

    // Calendar generation logic
    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const renderCalendarDays = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        
        const days = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Empty slots for previous month
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty" role="gridcell" aria-hidden="true"></div>);
        }

        // Days of the month
        for (let i = 1; i <= daysInMonth; i++) {
            const dateObj = new Date(year, month, i);
            const isPast = dateObj < today;
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            const isSelected = selectedDate?.toDateString() === dateObj.toDateString();
            
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const blockInfo = blockedDates.find(b => b.date === dateStr && (!b.equipmentId || b.equipmentId.toString() === equipmentId));
            const isBlocked = !!blockInfo;
            
            const disabled = isPast || isWeekend || isBlocked;
            const blockReason = isBlocked ? (blockInfo.reason || 'Bloqueado') : '';
            
            days.push(
                <div 
                    key={i} 
                    className={`calendar-day ${disabled ? 'disabled' : 'selectable'} ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                        if (!disabled) {
                            setSelectedDate(dateObj);
                            setSelectedTime('');
                        }
                    }}
                    role="gridcell"
                    title={blockReason}
                    aria-label={`${i} de ${monthNames[month]}, ${disabled ? (isBlocked ? blockReason : 'indisponível') : 'selecionável'}`}
                    aria-selected={isSelected}
                    tabIndex={disabled ? -1 : 0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !disabled) {
                            setSelectedDate(dateObj);
                            setSelectedTime('');
                        }
                    }}
                >
                    {i}
                </div>
            );
        }

        return days;
    };

    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

    /** Reservas do dia escolhido, ja normalizadas como intervalos [inicio, fim). */
    const reservasDoDia = () => {
        if (!selectedDate) return [];
        const dateStr = paraISO(selectedDate);
        return bookedSlots
            .filter(b => b.date === dateStr)
            .map(b => ({
                inicio: b.time,
                // Reserva antiga sem fim gravado: assume 1h, senao ela nao
                // ocuparia slot nenhum e o horario ficaria reservavel duas vezes.
                fim: b.endTime || somarMinutos(b.time, 60),
            }));
    };

    /** true se [inicio, fim) invade alguma reserva ja existente. */
    const estaOcupado = (inicio: string, fim: string) =>
        reservasDoDia().some(r => haSobreposicao(inicio, fim, r.inicio, r.fim));

    /** Slots de PASSO_SLOT em PASSO_SLOT que ainda cabem antes do fechamento. */
    const generateTimeSlots = () => {
        if (!selectedDate) return [];

        const slots = [];
        const fechamento = paraMinutos(HORA_FECHAMENTO);

        for (
            let minuto = paraMinutos(HORA_ABERTURA);
            minuto + duracao <= fechamento;
            minuto += PASSO_SLOT
        ) {
            const inicio = paraHorario(minuto);
            const fim = paraHorario(minuto + duracao);
            slots.push({ time: inicio, endTime: fim, isBooked: estaOcupado(inicio, fim) });
        }

        return slots;
    };

    const handleTimeSelect = (timeStr: string) => {
        setSelectedTime(timeStr);
        if (selectedDate) {
            onDateTimeSelect(paraISO(selectedDate), timeStr, somarMinutos(timeStr, duracao));
        }
    };

    /** Mudar a duracao muda o fim do intervalo, entao a escolha anterior e
     *  refeita — ou descartada, se com a nova duracao ela passar a colidir. */
    const handleDuracaoSelect = (novaDuracao: number) => {
        setDuracao(novaDuracao);
        if (!selectedDate || !selectedTime) return;

        const fim = somarMinutos(selectedTime, novaDuracao);
        const cabe = paraMinutos(fim) <= paraMinutos(HORA_FECHAMENTO);
        if (cabe && !estaOcupado(selectedTime, fim)) {
            onDateTimeSelect(paraISO(selectedDate), selectedTime, fim);
        } else {
            setSelectedTime('');
        }
    };

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    return (
        <div className="calendar-picker-container" aria-label="Seletor de data e hora">
            <div className="calendar-section">
                <div className="calendar-header">
                    <button type="button" onClick={prevMonth} className="cal-nav-btn" aria-label="Mês anterior">&lt;</button>
                    <h4 aria-live="polite">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h4>
                    <button type="button" onClick={nextMonth} className="cal-nav-btn" aria-label="Próximo mês">&gt;</button>
                </div>
                
                <div className="calendar-grid-header" role="row">
                    <span role="columnheader" aria-label="Domingo">Dom</span><span role="columnheader" aria-label="Segunda-feira">Seg</span><span role="columnheader" aria-label="Terça-feira">Ter</span><span role="columnheader" aria-label="Quarta-feira">Qua</span><span role="columnheader" aria-label="Quinta-feira">Qui</span><span role="columnheader" aria-label="Sexta-feira">Sex</span><span role="columnheader" aria-label="Sábado">Sáb</span>
                </div>
                
                <div className="calendar-grid" role="grid" aria-label="Calendário do mês atual">
                    {renderCalendarDays()}
                </div>
                <div className="calendar-legend">
                    <span className="legend-item"><span className="dot blocked"></span> Indisponível (FDS/Passado)</span>
                </div>
            </div>

            {selectedDate && (
                <div className="time-section" aria-live="polite">
                    <h4>Horários em {selectedDate.toLocaleDateString('pt-BR')}</h4>

                    <div className="duration-picker">
                        <span className="duration-label" id="duration-label">Duração da reserva</span>
                        <div className="duration-options" role="group" aria-labelledby="duration-label">
                            {DURACOES.map(minutos => (
                                <button
                                    key={minutos}
                                    type="button"
                                    className={`duration-option ${duracao === minutos ? 'selected' : ''}`}
                                    onClick={() => handleDuracaoSelect(minutos)}
                                    aria-pressed={duracao === minutos}
                                    aria-label={`Reservar por ${formatarDuracao(minutos)}`}
                                >
                                    {formatarDuracao(minutos)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="time-slots-grid" role="list" aria-label={`Horários disponíveis para ${selectedDate.toLocaleDateString('pt-BR')}`}>
                        {generateTimeSlots().map(slot => (
                            <button
                                key={slot.time}
                                type="button"
                                className={`time-slot ${slot.isBooked ? 'booked' : 'available'} ${selectedTime === slot.time ? 'selected' : ''}`}
                                disabled={slot.isBooked}
                                onClick={() => handleTimeSelect(slot.time)}
                                aria-label={`${slot.time} às ${slot.endTime} - ${slot.isBooked ? 'Horário ocupado' : 'Horário livre para agendamento'}`}
                                aria-pressed={selectedTime === slot.time}
                                role="listitem"
                            >
                                {slot.time}
                                <span className="slot-end">até {slot.endTime}</span>
                                {slot.isBooked && <span className="booked-label">Ocupado</span>}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarPicker;
