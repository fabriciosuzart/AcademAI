import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../api/axios';
import CalendarPicker from '../CalendarPicker';
import './Agendamento.css';

const Agendamento: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const preselectedEquipmentId = location.state?.equipmentId || '';

    const [equipmentList, setEquipmentList] = useState<any[]>([]);
    const [equipmentId, setEquipmentId] = useState<string>(preselectedEquipmentId);
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [justification, setJustification] = useState('');
    
    const [isLoggedIn, setIsLoggedIn] = useState(false);

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
            const response = await api.post('/schedule', { 
                equipmentId, 
                date, 
                time,
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
                    <h1>📅 Solicitar Reserva</h1>
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
                                        disabled={item.status === 'MANUTENÇÃO'}
                                    >
                                        {item.status === 'DISPONÍVEL' ? '🟢' : item.status === 'MANUTENÇÃO' ? '🔴' : '🟠'} {item.name} {item.status === 'MANUTENÇÃO' ? '(Bloqueado)' : ''}
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
                                onDateTimeSelect={(selectedDate, selectedTime) => {
                                    setDate(selectedDate);
                                    setTime(selectedTime);
                                }}
                            />
                        )}
                        {date && time && (
                            <p style={{ color: '#10b981', marginTop: '10px', fontWeight: 'bold' }}>
                                ✅ Selecionado: {date.split('-').reverse().join('/')} às {time}
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