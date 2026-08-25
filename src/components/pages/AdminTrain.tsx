import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { BarChart3, CalendarDays, CalendarRange,
         Check, X, User, ShieldAlert,
         ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import './AdminTrain.css';

const AdminTrain: React.FC = () => {
    // Usuarios e equipamentos ficam no perfil; aqui sobra o que e so do painel.
    const [activeTab, setActiveTab] = useState<'overview' | 'reservations' | 'calendar'>(
        localStorage.getItem('userRole') === 'ADMIN' ? 'overview' : 'reservations'
    );
    
    // --- ESTADOS PARA OVERVIEW ---
    const [overviewData, setOverviewData] = useState<any>(null);
    const [loadingOverview, setLoadingOverview] = useState(false);
    
    // --- ESTADOS PARA RESERVAS ---
    const [pendingReservations, setPendingReservations] = useState<any[]>([]);
    const [loadingRes, setLoadingRes] = useState(false);

    // --- ESTADOS PARA CALENDÁRIO GLOBAL (RF30) ---
    const [calendarAppointments, setCalendarAppointments] = useState<any[]>([]);
    const [loadingCalendar, setLoadingCalendar] = useState(false);
    const [calendarWeekOffset, setCalendarWeekOffset] = useState(0); // 0=semana atual, 1=próxima, etc.

    const navigate = useNavigate();

    // Proteção de Rota. O papel so chega depois do primeiro render, entao
    // 'roleLido' evita tratar o instante inicial como visitante anonimo.
    const [userRole, setUserRole] = useState<string | null>(null);
    const [roleLido, setRoleLido] = useState(false);

    useEffect(() => {
        const role = localStorage.getItem('userRole');
        setUserRole(role);
        setRoleLido(true);
        if (!role) {
            // Sem sessao nao e infracao: manda logar e volta pra ca depois.
            navigate('/login', { state: { from: '/admin' } });
        } else if (role !== 'ADMIN' && role !== 'PROFESSOR') {
            // Logado sem permissao: a tela abaixo explica, sem alert() nem redirect.
        } else {
            if (role === 'ADMIN') {
                fetchOverview();
            }
            fetchPendingReservations();
        }
    }, [navigate]);

    // ── Listeners de navegação por voz (VoiceNavigator) ───────────────────────────────────
    useEffect(() => {
        const validAdminTabs = ['overview', 'reservations', 'calendar'];
        const validProfessorTabs = ['reservations'];

        const handleVoiceTab = (e: Event) => {
            const { tab } = (e as CustomEvent).detail as { tab: string };
            const role = localStorage.getItem('userRole');
            const allowed = role === 'ADMIN' ? validAdminTabs : validProfessorTabs;
            if (allowed.includes(tab)) {
                setActiveTab(tab as any);
                if (tab === 'calendar') {
                    fetchCalendar(calendarWeekOffset);
                }
            } else {
                // Professor não tem acesso a essa aba — ignora silenciosamente
                console.warn('Aba de voz não permitida para este perfil:', tab);
            }
        };

        const handleVoiceAction = (e: Event) => {
            const { action } = (e as CustomEvent).detail as { action: string };
            if (action === 'approve-first') {
                if (pendingReservations.length > 0) {
                    setActiveTab('reservations');
                    handleUpdateReservation(pendingReservations[0].id, 'APROVADA');
                }
            } else if (action === 'reject-first') {
                if (pendingReservations.length > 0) {
                    setActiveTab('reservations');
                    handleUpdateReservation(pendingReservations[0].id, 'REJEITADA');
                }
            }
        };

        window.addEventListener('voice-admin-tab', handleVoiceTab);
        window.addEventListener('voice-admin-action', handleVoiceAction);
        return () => {
            window.removeEventListener('voice-admin-tab', handleVoiceTab);
            window.removeEventListener('voice-admin-action', handleVoiceAction);
        };
    }, [pendingReservations, calendarWeekOffset]);

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

    const fetchPendingReservations = async () => {
        try {
            const res = await api.get('/appointments/pending');
            setPendingReservations(res.data);
        } catch (error) {
            console.error("Erro ao buscar reservas pendentes");
        }
    };

    // --- FUNÇÕES DO CALENDÁRIO ---
    const fetchCalendar = async (weekOffset = 0) => {
        setLoadingCalendar(true);
        try {
            const today = new Date();
            today.setDate(today.getDate() + weekOffset * 7);
            const dayOfWeek = today.getDay();
            const monday = new Date(today);
            monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
            const friday = new Date(monday);
            friday.setDate(monday.getDate() + 4);

            const start = monday.toISOString().split('T')[0];
            const end = friday.toISOString().split('T')[0];

            const res = await api.get('/appointments/all-history');
            const all = Array.isArray(res.data) ? res.data : [];
            const weekAppts = all.filter((a: any) =>
                a.date >= start && a.date <= end && ['APROVADA', 'PENDENTE'].includes(a.status)
            );
            setCalendarAppointments(weekAppts);
        } catch (error) {
            console.error("Erro ao buscar calendário");
        } finally {
            setLoadingCalendar(false);
        }
    };

    // --- FUNÇÕES DE RESERVA ---
    const handleUpdateReservation = async (id: number, status: 'APROVADA' | 'REJEITADA') => {
        let rejectionReason = '';
        if (status === 'REJEITADA') {
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

    if (!roleLido) {
        return (
            <div className="admin-container">
                <p style={{ color: 'white', textAlign: 'center' }}>Carregando…</p>
            </div>
        );
    }

    // Logado, mas sem permissao. Quem colou a URL por acaso merece uma
    // explicacao na propria pagina, nao um dialogo do sistema.
    if (userRole && userRole !== 'ADMIN' && userRole !== 'PROFESSOR') {
        return (
            <div className="admin-container acesso-negado">
                <ShieldAlert size={40} aria-hidden="true" />
                <h2>Área restrita</h2>
                <p>Esta página é exclusiva de administradores e professores.</p>
                <Link to="/">Voltar para a Home</Link>
            </div>
        );
    }

    return (
        <div className="admin-container">
            <div className="admin-header">
                <h1>Painel de Controle</h1>
                {/* Inventario e usuarios vivem no perfil; aqui e a operacao. */}
                <p>Gerencie Aprovações{userRole === 'ADMIN' ? ' e a Agenda do laboratório' : ''}</p>
            </div>

            <div className="admin-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {userRole === 'ADMIN' && (
                    <button id="admin-tab-overview" onClick={() => setActiveTab('overview')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: activeTab === 'overview' ? '#3b82f6' : '#e2e8f0', color: activeTab === 'overview' ? 'white' : 'black', cursor: 'pointer' }}>
                        <BarChart3 size={18} aria-hidden="true" /> Visão Geral
                    </button>
                )}
                <button id="admin-tab-reservations" onClick={() => setActiveTab('reservations')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: activeTab === 'reservations' ? '#3b82f6' : '#e2e8f0', color: activeTab === 'reservations' ? 'white' : 'black', cursor: 'pointer' }}>
                    <CalendarDays size={18} aria-hidden="true" /> Reservas Pendentes
                    {pendingReservations.length > 0 && <span style={{ background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '12px', marginLeft: '8px', fontSize: '0.8rem' }}>{pendingReservations.length}</span>}
                </button>
                {userRole === 'ADMIN' && (
                    <>
                        <button
                                id="admin-tab-calendar"
                                onClick={() => { setActiveTab('calendar'); fetchCalendar(calendarWeekOffset); }}
                                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: activeTab === 'calendar' ? '#3b82f6' : '#e2e8f0', color: activeTab === 'calendar' ? 'white' : 'black', cursor: 'pointer' }}>
                                <CalendarRange size={18} aria-hidden="true" /> Calendário Global
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
                                            <button disabled={loadingRes} onClick={() => handleUpdateReservation(res.id, 'APROVADA')} style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                                <Check size={16} aria-hidden="true" /> Aprovar
                                            </button>
                                            <button disabled={loadingRes} onClick={() => handleUpdateReservation(res.id, 'REJEITADA')} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                                <X size={16} aria-hidden="true" /> Rejeitar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ABA: CALENDÁRIO GLOBAL */}
            {activeTab === 'calendar' && userRole === 'ADMIN' && (
                <div className="admin-panel" style={{ width: '100%', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                        <h2 style={{ color: 'white', margin: 0 }}>Calendário Global</h2>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => { const w = calendarWeekOffset - 1; setCalendarWeekOffset(w); fetchCalendar(w); }}
                                style={{ background: '#334155', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
                                <ArrowLeft size={16} aria-hidden="true" /> Semana Anterior
                            </button>
                            <button onClick={() => { setCalendarWeekOffset(0); fetchCalendar(0); }}
                                style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
                                Hoje
                            </button>
                            <button onClick={() => { const w = calendarWeekOffset + 1; setCalendarWeekOffset(w); fetchCalendar(w); }}
                                style={{ background: '#334155', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
                                Próxima Semana <ArrowRight size={16} aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                    {loadingCalendar ? (
                        <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>Carregando calendário...</p>
                    ) : calendarAppointments.length === 0 ? (
                        <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>Nenhuma reserva aprovada ou pendente nesta semana.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {calendarAppointments
                                .sort((a: any, b: any) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
                                .map((appt: any) => {
                                    const dateLabel = new Date(appt.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
                                    const isApproved = appt.status === 'APROVADA';
                                    return (
                                        <div key={appt.id} style={{
                                            background: '#0f172a', padding: '14px 18px', borderRadius: '10px',
                                            borderLeft: `4px solid ${isApproved ? '#10b981' : '#fbbf24'}`,
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'
                                        }}>
                                            <div>
                                                <strong style={{ color: 'white', display: 'block', textTransform: 'capitalize' }}>{dateLabel}</strong>
                                                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                                                    {appt.time}{appt.endTime ? ` – ${appt.endTime}` : ''} &bull; {appt.equipment?.name || '—'}
                                                </span>
                                                <span style={{ color: '#cbd5e1', fontSize: '0.85rem', display: 'block', marginTop: '4px' }}>
                                                    <User size={15} aria-hidden="true" /> {appt.user?.name} ({appt.user?.role})
                                                </span>
                                            </div>
                                            <span style={{
                                                padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold',
                                                background: isApproved ? 'rgba(16,185,129,0.15)' : 'rgba(251,191,36,0.15)',
                                                color: isApproved ? '#10b981' : '#fbbf24'
                                            }}>
                                                {appt.status}
                                            </span>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>
            )}

        </div>
    );
};

export default AdminTrain;