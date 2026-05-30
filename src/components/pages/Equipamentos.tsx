import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import './Equipamentos.css';

const Equipamentos: React.FC = () => {
  const navigate = useNavigate();
  const { requireAuth } = useAuth();
  
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortOrder, setSortOrder] = useState('default');

  useEffect(() => {
    const loadEquipments = async () => {
      try {
        const res = await api.get('/equipment');
        setEquipamentos(res.data);
      } catch (error) {
        console.error("Erro ao carregar equipamentos:", error);
      } finally {
        setLoading(false);
      }
    };
    loadEquipments();
  }, []);

  const filteredItems = equipamentos
    .filter(item => filterStatus === 'all' ? true : item.status === filterStatus)
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
                <option value="DISPONÍVEL">🟢 Disponíveis Hoje</option>
                <option value="EM USO">🟠 Em Uso</option>
                <option value="MANUTENÇÃO">🔴 Em Manutenção</option>
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
                    
                    <span className={`status-badge ${item.status === 'DISPONÍVEL' ? 'available' : 'in-use'}`}>
                        ● {item.status}
                    </span>
                </div>
                
                <div className="card-content">
                    <h3>{item.name}</h3>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                            onClick={() => navigate(`/equipamento/${item.id}`)}
                            className="schedule-button"
                            style={{ border: '1px solid #3b82f6', background: 'transparent', color: '#3b82f6', width: '50%', fontFamily: 'inherit' }}
                        >
                            Detalhes
                        </button>
                        <button 
                            onClick={() => requireAuth(() => navigate('/agendamento', { state: { equipmentId: item.id } }))} 
                            className="schedule-button"
                            style={{ border: 'none', width: '50%', fontFamily: 'inherit' }}
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