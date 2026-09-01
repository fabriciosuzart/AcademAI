import React from "react";
import { formatarIntervalo } from "../../utils/horarios";

/**
 * Modal de "Detalhes do Agendamento".
 *
 * Primeiro pedaco extraido do Perfil.tsx (item 15): e um modal-folha, so
 * mostra a reserva selecionada e fecha. Interface minima de proposito —
 * a reserva e o callback de fechar —, sem tocar no resto do estado do Perfil.
 */
interface AppointmentDetailsModalProps {
  appointment: any | null;
  onClose: () => void;
}

const AppointmentDetailsModal: React.FC<AppointmentDetailsModalProps> = ({
  appointment,
  onClose,
}) => {
  if (!appointment) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content appointment-details-modal">
        <div className="modal-header">
          <h2>Detalhes do Agendamento</h2>
          <button className="close-modal-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="detail-row">
            <span className="detail-label">Equipamento:</span>
            <span className="detail-value">{appointment.equipment?.name || appointment.equipment || "Agendamento"}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Data:</span>
            <span className="detail-value">{appointment.date ? appointment.date.split("-").reverse().join("/") : "Não informada"}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Horário:</span>
            <span className="detail-value">{formatarIntervalo(appointment.startTime || appointment.time, appointment.endTime)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Status:</span>
            <span className={`perfil-status-badge ${appointment.status}`}>{appointment.status}</span>
          </div>

          {appointment.user && (
            <div className="detail-row">
              <span className="detail-label">Usuário:</span>
              <span className="detail-value">{appointment.user?.name || appointment.user} ({appointment.userRole || appointment.user?.role})</span>
            </div>
          )}

          {appointment.justification && (
            <div className="detail-row pf-s22">
              <span className="detail-label pf-s23">Justificativa / Motivo:</span>
              <div className="detail-value pf-s24">
                "{appointment.justification}"
              </div>
            </div>
          )}

          {appointment.rejectionReason && (
            <div className="detail-row pf-s25">
              <span className="detail-label pf-s26">Motivo da Recusa:</span>
              <div className="detail-value pf-s27">
                {appointment.rejectionReason}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer pf-s28">
          <button className="secondary-btn" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppointmentDetailsModal;
