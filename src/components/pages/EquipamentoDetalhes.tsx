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

    // Outras maquinas do mesmo modelo. Cada uma tem agenda propria, entao a
    // reserva precisa apontar para uma unidade concreta, nunca para o grupo.
    const [unidades, setUnidades] = useState<any[]>([]);
    const [unidadeSelecionada, setUnidadeSelecionada] = useState<number | null>(null);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await api.get(`/equipment/${id}`);
                setEquipment(res.data);
                setUnidadeSelecionada(res.data.id);

                // Descobre as irmas pelo mesmo nome-base do agrupamento da listagem
                const todos = await api.get('/equipment');
                const modelo = (nome: string) => nome.replace(/\s*(0\d|A\d|\d+)$/i, '').trim();
                const alvo = modelo(res.data.name);
                setUnidades(
                    todos.data
                        .filter((e: any) => modelo(e.name) === alvo)
                        .sort((a: any, b: any) => a.name.localeCompare(b.name))
                );
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


                    {/* Quando o modelo tem mais de uma maquina, a reserva e sempre
                        contra uma unidade concreta — cada uma tem agenda propria. */}
                    {unidades.length > 1 && (
                        <div className="unidades-picker">
                            <h3>Escolha a unidade</h3>
                            <div className="unidades-lista">
                                {unidades.map((u) => (
                                    <button
                                        key={u.id}
                                        type="button"
                                        className={`unidade-btn${u.id === unidadeSelecionada ? ' ativa' : ''}`}
                                        onClick={() => setUnidadeSelecionada(u.id)}
                                        aria-pressed={u.id === unidadeSelecionada}
                                    >
                                        <Circle size={9} fill="currentColor" aria-hidden="true" />
                                        <span>{u.name}</span>
                                        <small>{getStatusInfo(u.status).label}</small>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="action-area">
                        <button
                            className="primary-btn"
                            onClick={() => {
                                const alvo = unidadeSelecionada ?? equipment.id;
                                if (isLoggedIn) {
                                    navigate('/agendamento', { state: { equipmentId: alvo } });
                                } else {
                                    navigate('/login', { state: { from: 'agendamento', equipmentId: alvo } });
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
