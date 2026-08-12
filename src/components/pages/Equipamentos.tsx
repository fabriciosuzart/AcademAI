import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Equipamentos.css';

export const equipamentosData = []; // Dados estáticos removidos, agora vem do banco de dados

const Equipamentos: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortOrder, setSortOrder] = useState('default');
  const [equipamentos, setEquipamentos] = useState<any[]>([]);

  React.useEffect(() => {
    fetch('http://localhost:3000/api/equipment')
      .then(res => res.json())
      .then(data => setEquipamentos(data))
      .catch(console.error);
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
                <option value="available">🟢 Disponíveis Hoje</option>
                <option value="in-use">🟠 Em Manutenção/Uso</option>
            </select>
            
            <select onChange={(e) => setSortOrder(e.target.value)} value={sortOrder}>
                <option value="default">Relevância</option>
                <option value="alphabetical">Ordem Alfabética (A-Z)</option>
            </select>
        </div>
      </header>

      {/* Catálogo de Equipamentos */}
      <div className="equipment-grid">
        {filteredItems.map(item => (
          <div key={item.id} className="card">
            
            <div className="card-image">
                <img src={`/${item.img}`} alt={item.name} onError={(e) => e.currentTarget.src = 'https://via.placeholder.com/300x200?text=S/IMAGEM'} />
                
                <span className={`status-badge ${item.status}`}>
                    {item.status === 'available' ? '● Disponível' : '● Em Uso'}
                </span>
            </div>
            
            <div className="card-content">
                <h3>{item.name}</h3>
                
                <Link to="/agendamento" className="schedule-button">
                    Reservar Horário
                </Link>
            </div>
            
          </div>
        ))}
      </div>
    </div>
  );
};

export default Equipamentos;