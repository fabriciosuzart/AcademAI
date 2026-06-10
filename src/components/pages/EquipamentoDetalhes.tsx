import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import './EquipamentoDetalhes.css';

const EquipamentoDetalhes: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { requireAuth } = useAuth();

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
            const text = `Detalhes de ${equipment.name}. O status atual é ${equipment.status}. ${equipment.description ? 'Descrição: ' + equipment.description : 'Sem descrição.'}`;
            window.dispatchEvent(new CustomEvent('voice-speak', { detail: { text } }));
        };
        window.addEventListener('voice-read-screen', handleReadScreen);
        return () => window.removeEventListener('voice-read-screen', handleReadScreen);
    }, [equipment]);

    if (loading) return <div className="details-container"><p style={{color:'white', textAlign:'center'}}>Carregando detalhes...</p></div>;
    if (error || !equipment) return <div className="details-container"><p className="error-text">{error}</p></div>;

    const imageUrl = equipment.imagePath ? `http://localhost:3000${equipment.imagePath}` : 'https://via.placeholder.com/600x400?text=Sem+Imagem';

    return (
        <div className="details-container">
            <button className="back-btn" onClick={() => navigate('/equipamentos')}>
                ← Voltar
            </button>
            
            <div className="details-card">
                <div className="details-image-wrapper">
                    <img src={imageUrl} alt={equipment.name} className="details-image" />
                    <span className={`status-badge ${equipment.status === 'DISPONÍVEL' ? 'available' : 'in-use'}`}>
                        ● {equipment.status}
                    </span>
                </div>
                
                <div className="details-info">
                    <h1>{equipment.name}</h1>
                    
                    <div className="description-box">
                        <h3>Descrição e Especificações</h3>
                        <p>{equipment.description || 'Nenhuma descrição detalhada disponível para este equipamento.'}</p>
                    </div>
                    
                    <div className="action-area">
                        <button 
                            className="primary-btn"
                            onClick={() => requireAuth(() => navigate('/agendamento', { state: { equipmentId: equipment.id } }))}
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
