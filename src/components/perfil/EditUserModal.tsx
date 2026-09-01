import React from "react";
import { Check } from "lucide-react";

/**
 * Modal de "Editar perfil" de usuario (aba Usuarios, so ADMIN).
 *
 * Extraido do Perfil.tsx (item 15). O estado do formulario continua no Perfil
 * (nome/email/ra/treinamentos) e e passado como valor + setter; este componente
 * so desenha e dispara os callbacks. trainingModules vem por prop para nao
 * duplicar a lista.
 */
interface EditUserModalProps {
  open: boolean;
  editingUser: any | null;
  editName: string;
  setEditName: (v: string) => void;
  editEmail: string;
  setEditEmail: (v: string) => void;
  editRa: string;
  setEditRa: (v: string) => void;
  editTrainings: string[];
  setEditTrainings: React.Dispatch<React.SetStateAction<string[]>>;
  trainingModules: string[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onDelete: () => void;
}

const EditUserModal: React.FC<EditUserModalProps> = ({
  open,
  editingUser,
  editName,
  setEditName,
  editEmail,
  setEditEmail,
  editRa,
  setEditRa,
  editTrainings,
  setEditTrainings,
  trainingModules,
  onClose,
  onSubmit,
  onDelete,
}) => {
  if (!open || !editingUser) return null;

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
              Editar perfil
            </h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>
        <form className="edit-user-form" onSubmit={onSubmit}>
          <div className="form-group">
            <label className="sleek-label">NOME DO USUÁRIO</label>
            <input type="text" className="sleek-input" value={editName} onChange={(e) => setEditName(e.target.value)} required />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label className="sleek-label">E-MAIL</label>
              <input type="email" className="sleek-input" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required />
            </div>
            <div className="form-group flex-1">
              <label className="sleek-label">R.A.</label>
              <input type="text" className="sleek-input" value={editRa} onChange={(e) => setEditRa(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="sleek-label">TREINAMENTOS CONCLUÍDOS</label>
            <div className="training-tags-container">
              {trainingModules.map((module) => {
                const isSelected = editTrainings.includes(module);
                return (
                  <button
                    type="button"
                    key={module}
                    className={`training-tag-btn ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      if (isSelected) {
                        setEditTrainings((prev) => prev.filter((t) => t !== module));
                      } else {
                        setEditTrainings((prev) => [...prev, module]);
                      }
                    }}
                  >
                    {isSelected && <span className="check-icon"><Check size={14} aria-hidden="true" /></span>}
                    {module}
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="divider pf-s31" />

          <div className="modal-actions-footer">
            <button type="button" className="ghost-btn danger-btn" onClick={onDelete}>
              Excluir Usuário
            </button>
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

export default EditUserModal;
