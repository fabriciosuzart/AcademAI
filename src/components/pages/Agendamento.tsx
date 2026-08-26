import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../api/axios';
import { CalendarDays, CheckCircle2 } from 'lucide-react';
import CalendarPicker from '../CalendarPicker';
import './Agendamento.css';
import { ehManutencao } from '../../utils/status';
import { duracaoEntre, formatarDuracao } from '../../utils/horarios';

const Agendamento: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const preselectedEquipmentId = location.state?.equipmentId || '';

    const [equipmentList, setEquipmentList] = useState<any[]>([]);
    const [equipmentId, setEquipmentId] = useState<string>(preselectedEquipmentId);
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [justification, setJustification] = useState('');
    
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // ── Preenchimento e Submissão por Voz ────────────────────
    useEffect(() => {
        const handleVoiceFill = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (!detail) return;
            const { field, text } = detail;
            
            if (field === 'justification') {
                setJustification(text);
            }
        };

        const handleVoiceSubmit = () => {
            const form = document.querySelector('.schedule-form') as HTMLFormElement;
            if (form && form.requestSubmit) form.requestSubmit();
        };

        window.addEventListener('voice-fill-field', handleVoiceFill);
        window.addEventListener('voice-submit-form', handleVoiceSubmit);
        return () => {
            window.removeEventListener('voice-fill-field', handleVoiceFill);
            window.removeEventListener('voice-submit-form', handleVoiceSubmit);
        };
    }, []);

    // Trava de login
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
        } else {
            setIsLoggedIn(true);
            fetchEquipments();
        }
    }, [navigate]);

    const fetchEquipments = async () => {
        try {
            const res = await api.get('/equipment');
            // Filtra apenas os que estão disponíveis, opcional.
            setEquipmentList(res.data);
            
            // Se veio com ID preselecionado mas era numérico, converte para string para o select bater certinho.
            if (preselectedEquipmentId) {
                setEquipmentId(preselectedEquipmentId.toString());
            }
        } catch (error) {
            console.error("Erro ao buscar equipamentos.");
        }
    };

    if (!isLoggedIn) return null;

    const handleSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            if (!date || !time || !endTime) {
                alert('Escolha a data, a duração e o horário da reserva.');
                return;
            }

            const response = await api.post('/schedule', { 
                equipmentId, 
                date, 
                time,
                endTime,
                justification
            });
            
            if (response.status === 201) {
                alert(`Reserva enviada com sucesso! Acompanhe o status no seu perfil.`);
                navigate('/perfil');
            }
        } catch (error: any) {
            alert(error.response?.data?.error || 'Erro ao agendar. Tente novamente.');
        }
    };

    return (
        <div className="agendamento-page">
            <div className="schedule-card">
                <div className="schedule-header">
                    <h1><CalendarDays size={26} aria-hidden="true" /> Solicitar Reserva</h1>
                    <p>Preencha os dados e informe a justificativa para avaliação do professor.</p>
                </div>

                <form className="schedule-form" onSubmit={handleSchedule} aria-label="Formulário de solicitação de agendamento">
                    <div className="form-group">
                        <label htmlFor="equipment">Selecione o Equipamento</label>
                        <div className="select-wrapper">
                            <select 
                                id="equipment" 
                                value={equipmentId} 
                                onChange={e => setEquipmentId(e.target.value)} 
                                required
                                aria-required="true"
                                aria-label="Selecione o equipamento para agendar"
                            >
                                <option value="" disabled>-- Escolha um equipamento --</option>
                                {equipmentList.map((item) => (
                                    <option 
                                        key={item.id} 
                                        value={item.id}
                                        disabled={ehManutencao(item.status)}
                                    >
                                        {item.name} {ehManutencao(item.status) ? '(Bloqueado)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '20px' }}>
                        <label>Data e Horário</label>
                        {!equipmentId ? (
                            <div style={{ padding: '15px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                Selecione um equipamento primeiro para ver a disponibilidade.
                            </div>
                        ) : (
                            <CalendarPicker 
                                equipmentId={equipmentId}
                                onDateTimeSelect={(selectedDate, selectedTime, selectedEndTime) => {
                                    setDate(selectedDate);
                                    setTime(selectedTime);
                                    setEndTime(selectedEndTime);
                                }}
                            />
                        )}
                        {date && time && endTime && (
                            <p style={{ color: '#10b981', marginTop: '10px', fontWeight: 'bold' }}>
                                <CheckCircle2 size={18} aria-hidden="true" /> Selecionado:{' '}
                                {date.split('-').reverse().join('/')}, das {time} às {endTime}
                                {' '}({formatarDuracao(duracaoEntre(time, endTime) ?? 0)})
                            </p>
                        )}
                    </div>

                    <div className="form-group">
                        <label htmlFor="justification">Justificativa (Motivo do Uso)</label>
                        <textarea 
                            id="justification"
                            rows={3}
                            placeholder="Descreva brevemente o projeto ou disciplina..."
                            value={justification}
                            onChange={e => setJustification(e.target.value)}
                            required
                            aria-required="true"
                            aria-label="Descreva a justificativa ou motivo do uso"
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid #334155',
                                background: '#1e293b',
                                color: 'white',
                                fontFamily: 'inherit',
                                resize: 'vertical'
                            }}
                        />
                    </div>

                    <button type="submit" className="submit-button" aria-label="Enviar solicitação de reserva">
                        Enviar Solicitação
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Agendamento;