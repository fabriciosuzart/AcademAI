import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import './CalendarPicker.css';

interface CalendarPickerProps {
    equipmentId: string;
    onDateTimeSelect: (date: string, time: string) => void;
}

const CalendarPicker: React.FC<CalendarPickerProps> = ({ equipmentId, onDateTimeSelect }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState<string>('');
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

    // Time slots logic (08:00 to 18:00)
    const generateTimeSlots = () => {
        if (!selectedDate) return [];
        
        const slots = [];
        const dateStr = selectedDate.toISOString().split('T')[0];
        
        // Find bookings for the selected date
        const dayBookings = bookedSlots.filter(b => b.date === dateStr);
        
        for (let hour = 8; hour <= 18; hour++) {
            const timeStr = `${hour.toString().padStart(2, '0')}:00`;
            
            // Check if this time slot is booked
            // Simpler check: if any booking starts at exactly this time (or if it falls between start and end)
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

    const handleTimeSelect = (timeStr: string) => {
        setSelectedTime(timeStr);
        if (selectedDate) {
            const dateStr = selectedDate.toISOString().split('T')[0];
            onDateTimeSelect(dateStr, timeStr);
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
                    <div className="time-slots-grid" role="list" aria-label={`Horários disponíveis para ${selectedDate.toLocaleDateString('pt-BR')}`}>
                        {generateTimeSlots().map(slot => (
                            <button
                                key={slot.time}
                                type="button"
                                className={`time-slot ${slot.isBooked ? 'booked' : 'available'} ${selectedTime === slot.time ? 'selected' : ''}`}
                                disabled={slot.isBooked}
                                onClick={() => handleTimeSelect(slot.time)}
                                aria-label={`${slot.time} - ${slot.isBooked ? 'Horário ocupado' : 'Horário livre para agendamento'}`}
                                aria-pressed={selectedTime === slot.time}
                                role="listitem"
                            >
                                {slot.time}
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
