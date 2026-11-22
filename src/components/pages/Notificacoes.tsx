import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import './Notificacoes.css';
import type { Notificacao } from '../../types/api';

const Notificacoes: React.FC = () => {
    const [notifications, setNotifications] = useState<Notificacao[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    // RF12/RF13: a lista se atualiza sozinha a cada 30 s enquanto a aba está
    // visível, para a aprovação ou a nova pendência aparecer sem recarregar.
    useEffect(() => {
        const userId = localStorage.getItem('userId');
        if (!userId) return;
        fetchNotifications(userId);
        const timer = window.setInterval(() => {
            if (document.visibilityState === 'visible') fetchNotifications(userId);
        }, 30_000);
        return () => window.clearInterval(timer);
    }, []);

    const fetchNotifications = async (userId: string) => {
        try {
            const res = await api.get(`/notifications/${userId}`);
            const data = res.data;
            if (data && data.notifications) {
                setNotifications(data.notifications);
                setUnreadCount(data.unreadCount);
            }
        } catch (error) {
            console.error("Erro ao buscar notificações:", error);
        }
    };

    const markAsRead = async (id: number) => {
        try {
            const res = await api.put(`/notifications/${id}/read`);
            if (res.status === 200) {
                setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
                setUnreadCount(Math.max(0, unreadCount - 1));
                window.dispatchEvent(new Event('notificacoes-atualizadas')); // atualiza o sino do menu
            }
        } catch (error) {
            console.error("Erro ao marcar como lida:", error);
        }
    };

    // Admin e professor: a notificação de reserva pendente leva direto às
    // "Aprovações pendentes" do Perfil (aba overview), onde aprovam ou rejeitam.
    const navigate = useNavigate();
    const podeAvaliar = ['ADMIN', 'PROFESSOR'].includes(localStorage.getItem('userRole') || '');
    const abrirAprovacoes = (notif: Notificacao) => {
        if (!notif.isRead) markAsRead(notif.id);
        navigate('/perfil', { state: { aba: 'overview' } });
    };

    const markAllAsRead = async () => {
        const userId = localStorage.getItem('userId');
        if (!userId) return;
        try {
            const res = await api.put(`/notifications/read-all/${userId}`);
            if (res.status === 200) {
                setNotifications(notifications.map(n => ({ ...n, isRead: true })));
                setUnreadCount(0);
                window.dispatchEvent(new Event('notificacoes-atualizadas')); // atualiza o sino do menu
            }
        } catch (error) {
            console.error("Erro ao marcar todas como lidas:", error);
        }
    };

    return (
        <div className="notificacoes-container" role="main" aria-label="Página de notificações">
            <div className="notificacoes-header">
                <h1>Notificações</h1>
                {unreadCount > 0 && (
                    <button className="mark-all-btn" onClick={markAllAsRead} aria-label="Marcar todas as notificações como lidas">
                        Marcar todas como lidas
                    </button>
                )}
            </div>

            <div className="notificacoes-list" aria-live="polite">
                {notifications.length === 0 ? (
                    <p className="no-notifications" role="status">Você não tem nenhuma notificação.</p>
                ) : (
                    notifications.map(notif => (
                        <div key={notif.id} className={`notification-item ${notif.isRead ? 'read' : 'unread'}`} aria-label={`Notificação de ${notif.type.replace('_', ' ')}`}>
                            <div className="notification-content">
                                <strong>{notif.type.replace('_', ' ')}</strong>
                                <p>{notif.message}</p>
                                <small>{new Date(notif.createdAt).toLocaleString()}</small>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                            {podeAvaliar && notif.type === 'NOVA_PENDENTE' && (
                                <button className="read-btn" onClick={() => abrirAprovacoes(notif)} aria-label="Ir para as aprovações pendentes">
                                    Aprovar / Rejeitar
                                </button>
                            )}
                            {!notif.isRead && (
                                <button className="read-btn" onClick={() => markAsRead(notif.id)} aria-label={`Marcar notificação de ${notif.type.replace('_', ' ')} como lida`}>
                                    Marcar como lida
                                </button>
                            )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Notificacoes;
