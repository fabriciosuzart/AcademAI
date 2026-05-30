import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import './AdminTrain.css';

const AdminTrain: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'overview' | 'reservations' | 'equipment' | 'ai'>('overview');
    
    // --- ESTADOS PARA OVERVIEW ---
    const [overviewData, setOverviewData] = useState<any>(null);
    const [loadingOverview, setLoadingOverview] = useState(false);
    
    // --- ESTADOS PARA IA ---
    const [file, setFile] = useState<File | null>(null);
    const [loadingAI, setLoadingAI] = useState(false);
    const [messageAI, setMessageAI] = useState('');
    const [msgTypeAI, setMsgTypeAI] = useState<'success' | 'error' | 'info'>('info');
    
    // --- ESTADOS PARA EQUIPAMENTOS ---
    const [equipments, setEquipments] = useState<any[]>([]);
    const [eqName, setEqName] = useState('');
    const [eqDesc, setEqDesc] = useState('');
    const [eqStatus, setEqStatus] = useState('DISPONÍVEL');
    const [eqImage, setEqImage] = useState<File | null>(null);
    const [loadingEq, setLoadingEq] = useState(false);
    const [messageEq, setMessageEq] = useState('');
    const [editingEqId, setEditingEqId] = useState<number | null>(null);

    // --- ESTADOS PARA RESERVAS ---
    const [pendingReservations, setPendingReservations] = useState<any[]>([]);
    const [loadingRes, setLoadingRes] = useState(false);

    const navigate = useNavigate();

    // Proteção de Rota
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        const role = localStorage.getItem('userRole');
        setUserRole(role);
        if (role !== 'ADMIN' && role !== 'PROFESSOR') {
            alert('Acesso negado. Apenas administradores ou professores.');
            navigate('/');
        } else {
            if (role === 'ADMIN') {
                fetchEquipments();
                fetchOverview();
            }
            fetchPendingReservations();
        }
    }, [navigate]);

    const fetchOverview = async () => {
        setLoadingOverview(true);
        try {
            const res = await api.get('/appointments/overview');
            setOverviewData(res.data);
        } catch (error) {
            console.error("Erro ao buscar visão geral");
        } finally {
            setLoadingOverview(false);
        }
    };

    const fetchEquipments = async () => {
        try {
            const res = await api.get('/equipment');
            setEquipments(res.data);
        } catch (error) {
            console.error("Erro ao buscar equipamentos");
        }
    };

    const fetchPendingReservations = async () => {
        try {
            const res = await api.get('/appointments/pending');
            setPendingReservations(res.data);
        } catch (error) {
            console.error("Erro ao buscar reservas pendentes");
        }
    };

    // --- FUNÇÕES DA IA ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setMessageAI(`Arquivo selecionado: ${e.target.files[0].name}`);
            setMsgTypeAI('info');
        }
    };

    const handleUploadAI = async () => {
        if (!file) return;
        setLoadingAI(true);
        setMessageAI('⚙️ Processando o arquivo... isso pode levar alguns segundos.');
        setMsgTypeAI('info');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await api.post('/train', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
            if (response.status === 200) {
                setMessageAI('✅ IA Treinada com sucesso!');
                setMsgTypeAI('success');
            }
        } catch (error: any) {
            setMessageAI(error.response?.data?.error || '❌ Erro de conexão.');
            setMsgTypeAI('error');
        } finally {
            setLoadingAI(false);
        }
    };

    // --- FUNÇÕES DE EQUIPAMENTOS ---
    const handleAddEquipment = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoadingEq(true);
        setMessageEq(editingEqId ? 'Atualizando equipamento...' : 'Salvando equipamento...');

        const formData = new FormData();
        formData.append('name', eqName);
        formData.append('description', eqDesc);
        formData.append('status', eqStatus);
        if (eqImage) formData.append('image', eqImage);

        try {
            const url = editingEqId ? `/equipment/${editingEqId}` : '/equipment';
            const method = editingEqId ? 'put' : 'post';
            
            const response = await api[method](url, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
            if (response.status === 201 || response.status === 200) {
                setMessageEq(editingEqId ? '✅ Equipamento atualizado com sucesso!' : '✅ Equipamento salvo com sucesso!');
                setEqName(''); setEqDesc(''); setEqImage(null); setEditingEqId(null);
                fetchEquipments();
            }
        } catch (error: any) {
            setMessageEq(error.response?.data?.error || '❌ Erro ao salvar.');
        } finally {
            setLoadingEq(false);
        }
    };

    const handleEditClick = (eq: any) => {
        setEditingEqId(eq.id);
        setEqName(eq.name);
        setEqStatus(eq.status);
        try {
            const parsedDesc = JSON.parse(eq.description);
            setEqDesc(parsedDesc.description || '');
        } catch (e) {
            setEqDesc(eq.description || '');
        }
        setEqImage(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingEqId(null);
        setEqName('');
        setEqDesc('');
        setEqStatus('DISPONÍVEL');
        setEqImage(null);
        setMessageEq('');
    };

    const handleDeleteEquipment = async (id: number, name: string) => {
        if (!window.confirm(`Tem certeza que deseja excluir o equipamento "${name}"?\nEsta ação apagará também o histórico de reservas associadas a ele.`)) return;
        
        try {
            const response = await api.delete(`/equipment/${id}`);
            if (response.status === 200) {
                alert('Equipamento excluído com sucesso!');
                if (editingEqId === id) handleCancelEdit();
                fetchEquipments();
            }
        } catch (error: any) {
            alert(error.response?.data?.error || 'Erro ao excluir equipamento.');
        }
    };

    // --- FUNÇÕES DE RESERVA ---
    const handleUpdateReservation = async (id: number, status: 'APROVADO' | 'RECUSADO') => {
        let rejectionReason = '';
        if (status === 'RECUSADO') {
            const reason = prompt('Por favor, informe a justificativa para a rejeição:');
            if (reason === null) return; // Cancelou o prompt
            rejectionReason = reason;
        }

        setLoadingRes(true);
        try {
            await api.put(`/appointments/${id}/status`, { status, rejectionReason });
            fetchPendingReservations(); // Recarrega a lista
        } catch (error: any) {
            alert('Erro ao atualizar reserva.');
        } finally {
            setLoadingRes(false);
        }
    };

    return (
        <div className="admin-container">
            <div className="admin-header">
                <h1>Painel de Controle</h1>
                <p>Gerencie Aprovações{userRole === 'ADMIN' ? ', Inventário e IA' : ''}</p>
            </div>

            <div className="admin-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {userRole === 'ADMIN' && (
                    <button onClick={() => setActiveTab('overview')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: activeTab === 'overview' ? '#3b82f6' : '#e2e8f0', color: activeTab === 'overview' ? 'white' : 'black', cursor: 'pointer' }}>
                        📊 Visão Geral
                    </button>
                )}
                <button onClick={() => setActiveTab('reservations')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: activeTab === 'reservations' ? '#3b82f6' : '#e2e8f0', color: activeTab === 'reservations' ? 'white' : 'black', cursor: 'pointer' }}>
                    📅 Reservas Pendentes
                    {pendingReservations.length > 0 && <span style={{ background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '12px', marginLeft: '8px', fontSize: '0.8rem' }}>{pendingReservations.length}</span>}
                </button>
                {userRole === 'ADMIN' && (
                    <>
                        <button onClick={() => setActiveTab('equipment')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: activeTab === 'equipment' ? '#3b82f6' : '#e2e8f0', color: activeTab === 'equipment' ? 'white' : 'black', cursor: 'pointer' }}>
                            🖨️ Equipamentos
                        </button>
                        <button onClick={() => setActiveTab('ai')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: activeTab === 'ai' ? '#3b82f6' : '#e2e8f0', color: activeTab === 'ai' ? 'white' : 'black', cursor: 'pointer' }}>
                            🧠 Treinamento IA
                        </button>
                    </>
                )}
            </div>

            {/* ABA: VISÃO GERAL */}
            {activeTab === 'overview' && userRole === 'ADMIN' && (
                <div className="admin-panel" style={{ width: '100%', margin: '0 auto' }}>
                    <h2 style={{ color: 'white', marginTop: 0 }}>Visão Geral</h2>
                    {loadingOverview || !overviewData ? (
                        <p style={{ color: '#94a3b8', textAlign: 'center' }}>Carregando dados...</p>
                    ) : (
                        <div>
                            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '150px', background: '#1e293b', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                                    <h3 style={{ color: '#cbd5e1', margin: '0 0 10px 0', fontSize: '1rem' }}>Reservas Hoje</h3>
                                    <p style={{ color: 'white', fontSize: '2rem', margin: 0, fontWeight: 'bold' }}>{overviewData.todayAppointments.length}</p>
                                </div>
                                <div style={{ flex: 1, minWidth: '150px', background: '#1e293b', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                                    <h3 style={{ color: '#cbd5e1', margin: '0 0 10px 0', fontSize: '1rem' }}>Reservas na Semana</h3>
                                    <p style={{ color: 'white', fontSize: '2rem', margin: 0, fontWeight: 'bold' }}>{overviewData.weekAppointments.length}</p>
                                </div>
                                <div style={{ flex: 1, minWidth: '150px', background: '#1e293b', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                                    <h3 style={{ color: '#cbd5e1', margin: '0 0 10px 0', fontSize: '1rem' }}>Pendentes</h3>
                                    <p style={{ color: '#fbbf24', fontSize: '2rem', margin: 0, fontWeight: 'bold' }}>{overviewData.pendingCount}</p>
                                </div>
                            </div>
                            <h3 style={{ color: 'white', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>Reservas de Hoje</h3>
                            {overviewData.todayAppointments.length === 0 ? (
                                <p style={{ color: '#94a3b8' }}>Nenhuma reserva para hoje.</p>
                            ) : (
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                    {overviewData.todayAppointments.map((appt: any) => (
                                        <li key={appt.id} style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <strong style={{ color: 'white', display: 'block' }}>{appt.equipment.name}</strong>
                                                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{appt.time} - {appt.user.name} ({appt.user.role})</span>
                                            </div>
                                            <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', background: appt.status === 'APROVADO' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(251, 191, 36, 0.2)', color: appt.status === 'APROVADO' ? '#10b981' : '#fbbf24' }}>
                                                {appt.status}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ABA: RESERVAS PENDENTES */}
            {activeTab === 'reservations' && (
                <div className="admin-panel" style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
                    <h2 style={{ color: 'white', marginTop: 0 }}>Aprovações Pendentes</h2>
                    {pendingReservations.length === 0 ? (
                        <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>Nenhuma reserva pendente no momento.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {pendingReservations.map(res => (
                                <div key={res.id} style={{ background: '#0f172a', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #fbbf24' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
                                        <div style={{ color: '#cbd5e1' }}>
                                            <h3 style={{ margin: '0 0 10px 0', color: 'white' }}>{res.user.name} <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>(RA: {res.user.ra})</span></h3>
                                            <p style={{ margin: '5px 0' }}><strong>Equipamento:</strong> {res.equipment.name}</p>
                                            <p style={{ margin: '5px 0' }}><strong>Data/Hora:</strong> {res.date.split('-').reverse().join('/')} às {res.time}</p>
                                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '6px', marginTop: '10px', fontStyle: 'italic' }}>
                                                "{res.justification}"
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                                            <button disabled={loadingRes} onClick={() => handleUpdateReservation(res.id, 'APROVADO')} style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                                ✅ Aprovar
                                            </button>
                                            <button disabled={loadingRes} onClick={() => handleUpdateReservation(res.id, 'RECUSADO')} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                                ❌ Rejeitar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ABA: IA E EQUIPAMENTOS OCULTADAS PARA BREVIDADE NESTE RESUMO (Elas são idênticas ao código anterior) */}
            {activeTab === 'ai' && (
                <div className="admin-panel">
                    <div className="file-upload-wrapper"><input type="file" className="file-upload-input" onChange={handleFileChange} /></div>
                    <button className="train-button" onClick={handleUploadAI}>{loadingAI ? 'Processando...' : 'Treinar IA'}</button>
                    {messageAI && <div className={`alert-box alert-${msgTypeAI}`}>{messageAI}</div>}
                </div>
            )}

            {activeTab === 'equipment' && (
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <div className="admin-panel" style={{ flex: '1', minWidth: '300px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ color: 'white', marginTop: 0 }}>{editingEqId ? 'Editar Equipamento' : 'Novo Equipamento'}</h2>
                            {editingEqId && (
                                <button type="button" onClick={handleCancelEdit} style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer' }}>
                                    Cancelar
                                </button>
                            )}
                        </div>
                        <form onSubmit={handleAddEquipment} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div><label style={{color: 'white'}}>Nome:</label><input type="text" value={eqName} onChange={e => setEqName(e.target.value)} required style={{width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: 'white'}} /></div>
                            <div>
                                <label style={{color: 'white'}}>Status:</label>
                                <select value={eqStatus} onChange={e => setEqStatus(e.target.value)} style={{width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: 'white'}}>
                                    <option value="DISPONÍVEL">🟢 Disponível</option>
                                    <option value="EM USO">🟠 Em Uso</option>
                                    <option value="MANUTENÇÃO">🔴 Em Manutenção</option>
                                </select>
                            </div>
                            <div><label style={{color: 'white'}}>Descrição:</label><textarea value={eqDesc} onChange={e => setEqDesc(e.target.value)} rows={4} style={{width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: 'white'}} /></div>
                            <div><label style={{color: 'white'}}>Foto:</label><input type="file" onChange={e => setEqImage(e.target.files ? e.target.files[0] : null)} accept="image/*" style={{color: 'white'}} /></div>
                            <button type="submit" className="train-button" disabled={loadingEq} style={{background: '#10b981'}}>{loadingEq ? 'Salvando...' : (editingEqId ? 'Atualizar Equipamento' : 'Cadastrar Equipamento')}</button>
                            {messageEq && <div style={{ color: 'white', marginTop: '10px' }}>{messageEq}</div>}
                        </form>
                    </div>
                    <div className="admin-panel" style={{ flex: '1', minWidth: '350px' }}>
                        <h2 style={{ color: 'white', marginTop: 0 }}>Equipamentos Cadastrados ({equipments.length})</h2>
                        <ul style={{ listStyle: 'none', padding: 0, maxHeight: '500px', overflowY: 'auto' }}>
                            {equipments.map(eq => (
                                <li key={eq.id} style={{ background: '#1e293b', margin: '8px 0', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ color: 'white', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <strong style={{ fontSize: '1.1rem' }}>{eq.name}</strong>
                                        <span style={{ fontSize: '0.85rem', color: eq.status === 'DISPONÍVEL' ? '#10b981' : (eq.status === 'EM USO' ? '#fbbf24' : '#ef4444') }}>
                                            {eq.status === 'DISPONÍVEL' ? '🟢 ' : (eq.status === 'EM USO' ? '🟠 ' : '🔴 ')} 
                                            {eq.status}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button 
                                            type="button" 
                                            onClick={() => handleEditClick(eq)}
                                            style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}
                                        >
                                            Editar
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => handleDeleteEquipment(eq.id, eq.name)}
                                            style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}
                                        >
                                            Excluir
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminTrain;