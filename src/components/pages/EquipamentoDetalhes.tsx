import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import './EquipamentoDetalhes.css';
import { ArrowLeft, Circle, Wrench } from 'lucide-react';

const EquipamentoDetalhes: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isLoggedIn } = useAuth();

    const [equipment, setEquipment] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');



    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await api.get(`/equipment/${id}`);
                setEquipment(res.data);
            } catch (err: any) {
                setError(err.response?.data?.error || 'Equipamento não encontrado.');
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [id]);

    // ── Leitura de Tela por Voz ─────────────────────────────
    useEffect(() => {
        const handleReadScreen = () => {
            if (!equipment) return;
            const { label } = getStatusInfo(equipment.status);
            const text = `Detalhes de ${equipment.name}. O status atual é ${label}. ${equipment.description ? 'Descrição: ' + equipment.description : 'Sem descrição.'}`;
            window.dispatchEvent(new CustomEvent('voice-speak', { detail: { text } }));
        };
        window.addEventListener('voice-read-screen', handleReadScreen);
        return () => window.removeEventListener('voice-read-screen', handleReadScreen);
    }, [equipment]);

    // Traduz status do banco para português
    const getStatusInfo = (status: string): { label: string; className: string } => {
        const s = (status || '').toUpperCase().trim();
        if (s === 'DISPONÍVEL' || s === 'DISPONIVEL' || s === 'AVAILABLE') {
            return { label: 'Disponível', className: 'available' };
        }
        if (s === 'EM USO' || s === 'IN USE' || s === 'INUSE' || s === 'IN-USE') {
            return { label: 'Em Uso', className: 'in-use' };
        }
        if (s === 'MANUTENÇÃO' || s === 'MANUTENCAO' || s === 'MAINTENANCE') {
            return { label: 'Manutenção', className: 'maintenance' };
        }
        return { label: status, className: 'in-use' };
    };


    if (loading) return <div className="details-container"><p style={{color:'white', textAlign:'center'}}>Carregando detalhes...</p></div>;
    if (error || !equipment) return <div className="details-container"><p className="error-text">{error}</p></div>;

    const imageUrl = equipment.imagePath ? `http://localhost:3000${equipment.imagePath}` : 'https://via.placeholder.com/600x400?text=Sem+Imagem';
    const { label: statusLabel, className: statusClass } = getStatusInfo(equipment.status);

    // Faz parse da descrição que fica salva como JSON no banco
    let parsedDescription = '';
    let parsedSpecs = '';
    try {
        const parsed = JSON.parse(equipment.description || '{}');
        parsedDescription = parsed.description || '';
        parsedSpecs = parsed.specs || '';
    } catch {
        parsedDescription = equipment.description || '';
    }

    return (
        <div className="details-container">
            <button className="back-btn" onClick={() => navigate('/equipamentos')}>
                <ArrowLeft size={18} aria-hidden="true" /> Voltar
            </button>

            <div className="details-card">
                <div className="details-image-wrapper">
                    <img src={imageUrl} alt={equipment.name} className="details-image" />
                    <span className={`status-badge ${statusClass}`}>
                        <Circle size={10} fill="currentColor" aria-hidden="true" /> {statusLabel}
                    </span>
                </div>

                <div className="details-info">
                    <h1>{equipment.name}</h1>

                    <div className="description-box">
                        <h3>Descrição e Especificações</h3>
                        {parsedSpecs && (
                            <p style={{ color: '#38bdf8', fontWeight: 600, marginBottom: '8px' }}>
                                <Wrench size={18} aria-hidden="true" /> {parsedSpecs}
                            </p>
                        )}
                        <p>
                            {parsedDescription || 'Nenhuma descrição detalhada disponível para este equipamento.'}
                        </p>
                    </div>


                    <div className="action-area">
                        <button
                            className="primary-btn"
                            onClick={() => {
                                if (isLoggedIn) {
                                    navigate('/agendamento', { state: { equipmentId: equipment.id } });
                                } else {
                                    navigate('/login', { state: { from: 'agendamento', equipmentId: equipment.id } });
                                }
                            }}
                        >
                            Reservar Horário
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EquipamentoDetalhes;
