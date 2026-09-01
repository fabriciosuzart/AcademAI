import React from "react";
import { OPCOES_STATUS } from "../../utils/status";

/**
 * Modal de "Editar equipamento" (aba Equipamentos, so ADMIN).
 *
 * Extraido do Perfil.tsx (item 15). O estado do formulario continua no Perfil
 * e chega como valor + setter; este componente so desenha e dispara callbacks.
 */
interface EditEquipmentModalProps {
  open: boolean;
  editingEquipment: any | null;
  name: string;
  setName: (v: string) => void;
  specs: string;
  setSpecs: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  quantity: number;
  setQuantity: (v: number) => void;
  status: string;
  setStatus: (v: string) => void;
  requiresTraining: boolean;
  setRequiresTraining: (v: boolean) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const EditEquipmentModal: React.FC<EditEquipmentModalProps> = ({
  open,
  editingEquipment,
  name, setName,
  specs, setSpecs,
  description, setDescription,
  quantity, setQuantity,
  status, setStatus,
  requiresTraining, setRequiresTraining,
  onClose,
  onSubmit,
}) => {
  if (!open || !editingEquipment) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card edit-user-modal pf-s29" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="pf-s30">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Editar equipamento
            </h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>
        <form className="edit-user-form" onSubmit={onSubmit}>
          <div className="form-group">
            <label className="sleek-label">NOME DO EQUIPAMENTO</label>
            <input type="text" className="sleek-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="sleek-label">ESPECIFICAÇÕES</label>
            <input type="text" className="sleek-input" value={specs} onChange={(e) => setSpecs(e.target.value)} placeholder="Ex: 40W CO₂ - área 600x300mm" />
          </div>

          <div className="form-group">
            <label className="sleek-label">DESCRIÇÃO</label>
            <textarea className="sleek-input pf-s33" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição do equipamento" />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label className="sleek-label">QUANTIDADE DISPONÍVEL</label>
              <input type="number" className="sleek-input" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} min="1" />
            </div>
            <div className="form-group flex-1">
              <label className="sleek-label">STATUS ATUAL</label>
              <select className="sleek-input pf-s34" value={status} onChange={(e) => setStatus(e.target.value)}>
                {OPCOES_STATUS.map(({ valor, rotulo }) => (
                  <option key={valor} value={valor}>{rotulo}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="sleek-label">TREINAMENTO OBRIGATÓRIO</label>
            <div className="pf-s35">
              <label className="pf-s36">
                <input type="radio" checked={requiresTraining} onChange={() => setRequiresTraining(true)} />
                <span>Sim</span>
              </label>
              <label className="pf-s36">
                <input type="radio" checked={!requiresTraining} onChange={() => setRequiresTraining(false)} />
                <span>Não</span>
              </label>
            </div>
          </div>

          <hr className="divider pf-s31" />

          <div className="modal-actions-footer">
            <div className="right-actions">
              <button type="button" className="ghost-btn" onClick={onClose}>Cancelar</button>
              <button type="submit" className="secondary-btn pf-s32">Salvar</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditEquipmentModal;
