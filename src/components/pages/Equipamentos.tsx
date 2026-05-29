import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import './Equipamentos.css';

<<<<<<< HEAD
=======
export const equipamentosData = []; // Dados estáticos removidos, agora vem do banco de dados

>>>>>>> c206ab6b1b265cbd6fadad52c5d4a6aab9d72963
const Equipamentos: React.FC = () => {
  const navigate = useNavigate();
  const { requireAuth } = useAuth();
  
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortOrder, setSortOrder] = useState('default');
  const [equipamentos, setEquipamentos] = useState<any[]>([]);

<<<<<<< HEAD
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
=======
  React.useEffect(() => {
    fetch('http://localhost:3000/api/equipment')
      .then(res => res.json())
      .then(data => setEquipamentos(data))
      .catch(console.error);
  }, []);

  const filteredItems = equipamentos
    .filter(item => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'available') return item.status === 'available';
      if (filterStatus === 'in-use') return item.status === 'in-use' || item.status === 'maintenance';
      return item.status === filterStatus;
    })
>>>>>>> c206ab6b1b265cbd6fadad52c5d4a6aab9d72963
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
<<<<<<< HEAD
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
=======
      <div className="equipment-grid">
        {filteredItems.map(item => (
          <div key={item.id} className="card">
            
            <div className="card-image">
                <img src={item.imagePath || item.img ? `http://localhost:3000${item.imagePath || item.img}` : 'https://via.placeholder.com/300x200?text=S/IMAGEM'} alt={item.name} onError={(e) => e.currentTarget.src = 'https://via.placeholder.com/300x200?text=S/IMAGEM'} />
                
                <span className={`status-badge ${item.status}`}>
                    {item.status === 'available' ? '● Disponível' : item.status === 'maintenance' ? '● Em Manutenção' : '● Em Uso'}
                </span>
            </div>
            
            <div className="card-content">
                <h3>{item.name}</h3>
>>>>>>> c206ab6b1b265cbd6fadad52c5d4a6aab9d72963
                
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