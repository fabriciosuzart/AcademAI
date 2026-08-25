import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import './Equipamentos.css';
import { Circle } from 'lucide-react';
import { classeStatus, ehDisponivel, normalizarStatus, rotuloStatus, OPCOES_STATUS } from '../../utils/status';
import { agruparPorModelo } from '../../utils/equipamentos';


const Equipamentos: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortOrder, setSortOrder] = useState('default');

  useEffect(() => {
    const loadEquipments = async () => {
      try {
        const res = await api.get('/equipment');
        setEquipamentos(agruparPorModelo(res.data));
      } catch (error) {
        console.error("Erro ao carregar equipamentos:", error);
      } finally {
        setLoading(false);
      }
    };
    loadEquipments();
  }, []);

  // ── Leitura de Tela por Voz ─────────────────────────────
  useEffect(() => {
    const handleReadScreen = () => {
      const disponiveis = equipamentos.filter(e => ehDisponivel(e.status)).length;
      const manutencao = equipamentos.filter(e => classeStatus(e.status) === 'maintenance').length;
      let text = `Você está na página de Equipamentos. Existem ${equipamentos.length} equipamentos cadastrados, sendo ${disponiveis} disponíveis no momento.`;
      if (manutencao > 0) text += ` Atenção, ${manutencao} estão em manutenção.`;
      
      if (filterStatus !== 'all') {
         text += ` Você está filtrando para mostrar apenas equipamentos com status ${rotuloStatus(filterStatus)}.`;
      }
      window.dispatchEvent(new CustomEvent('voice-speak', { detail: { text } }));
    };
    window.addEventListener('voice-read-screen', handleReadScreen);
    return () => window.removeEventListener('voice-read-screen', handleReadScreen);
  }, [equipamentos, filterStatus]);

  const filteredItems = equipamentos
    .filter(item => filterStatus === 'all' ? true : normalizarStatus(item.status) === filterStatus)
    .sort((a, b) => {
      if (sortOrder === 'alphabetical') return a.name.localeCompare(b.name);
      return a.id - b.id;
    });

  return (
    <div className="equipment-page">
      
      {/* Cabeçalho Premium */}
      <header className="page-header">
        <div className="header-title">
            <h1>Laboratório de Equipamentos</h1>
            <p>Descubra as ferramentas para dar vida às suas ideias.</p>
        </div>

        <div className="filter-controls">
            <select onChange={(e) => setFilterStatus(e.target.value)} value={filterStatus}>
                <option value="all">Todos os Equipamentos</option>
                {OPCOES_STATUS.map(({ valor, rotulo }) => (
                  <option key={valor} value={valor}>{rotulo}</option>
                ))}
            </select>
            
            <select onChange={(e) => setSortOrder(e.target.value)} value={sortOrder}>
                <option value="default">Relevância</option>
                <option value="alphabetical">Ordem Alfabética (A-Z)</option>
            </select>
        </div>
      </header>

      {/* Catálogo de Equipamentos */}
      {loading ? (
          <div style={{ textAlign: 'center', color: 'white', padding: '40px' }}>Carregando equipamentos...</div>
      ) : (
          <div className="equipment-grid">
            {filteredItems.map(item => (
              <div key={item.id} className="card">
                
                <div className="card-image">
                    <img 
                        src={item.imagePath ? `http://localhost:3000${item.imagePath}` : 'https://via.placeholder.com/300x200?text=S/IMAGEM'} 
                        alt={item.name} 
                        onError={(e) => e.currentTarget.src = 'https://via.placeholder.com/300x200?text=S/IMAGEM'} 
                    />
                    
                    <span className={`status-badge ${classeStatus(item.status)}`}>
                        <Circle size={10} fill="currentColor" aria-hidden="true" /> {rotuloStatus(item.status)}
                    </span>
                </div>
                
                <div className="card-content">
                    <h3>{item.name}</h3>

                    {item.quantidade > 1 && (
                      <p className="card-unidades">
                        {item.quantidade} unidades — escolha qual reservar nos detalhes
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: 'auto' }}>
                        <button 
                            onClick={() => navigate(`/equipamento/${item.id}`)}
                            className="schedule-button"
                            style={{ border: '1px solid #3b82f6', background: 'transparent', color: '#3b82f6', fontFamily: 'inherit', flex: 1, textAlign: 'center' }}
                        >
                            Detalhes
                        </button>
                        <button 
                            onClick={() => {
                                if (isLoggedIn) {
                                    navigate('/agendamento', { state: { equipmentId: item.id } });
                                } else {
                                    navigate('/login', { state: { from: 'agendamento', equipmentId: item.id } });
                                }
                            }} 
                            className="schedule-button"
                            style={{ border: 'none', fontFamily: 'inherit', flex: 1, textAlign: 'center' }}
                        >
                            Reservar
                        </button>
                    </div>
                </div>
                
              </div>
            ))}
          </div>
      )}
    </div>
  );
};

export default Equipamentos;