import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import './Equipamentos.css';
import { Circle } from 'lucide-react';

// Agrupa unidades do mesmo modelo num card so. "Bambu Lab A1" e "A2" viram
// "Bambu Lab" com 2 unidades. Mesma reducao que o painel admin ja usava, para
// as duas telas contarem a mesma historia.
//
// A deteccao e por sufixo no nome (01, 02, A1...). Funciona no acervo atual,
// mas e fragil: um "Arduino Uno R3" viraria "Arduino Uno R". O certo a medio
// prazo e um campo de modelo no banco, em vez de adivinhar pelo nome.
function agruparPorModelo(itens: any[]): any[] {
  const grupos: Record<string, any> = {};

  for (const item of itens) {
    const modelo = item.name.replace(/\s*(0\d|A\d|\d+)$/i, '').trim();
    if (!grupos[modelo]) {
      grupos[modelo] = { ...item, name: modelo, quantidade: 1, unidades: [item] };
    } else {
      grupos[modelo].quantidade += 1;
      grupos[modelo].unidades.push(item);
      // O grupo aparece como disponivel se ao menos uma unidade estiver.
      if (ehDisponivel(item.status)) grupos[modelo].status = item.status;
    }
  }
  return Object.values(grupos);
}

function ehDisponivel(status: string) {
  const s = (status || '').toUpperCase();
  return s === 'DISPONÍVEL' || s === 'DISPONIVEL' || s === 'AVAILABLE';
}

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
      const disponiveis = equipamentos.filter(e => e.status === 'DISPONÍVEL').length;
      const manutencao = equipamentos.filter(e => e.status === 'MANUTENÇÃO').length;
      let text = `Você está na página de Equipamentos. Existem ${equipamentos.length} equipamentos cadastrados, sendo ${disponiveis} disponíveis no momento.`;
      if (manutencao > 0) text += ` Atenção, ${manutencao} estão em manutenção.`;
      
      if (filterStatus !== 'all') {
         text += ` Você está filtrando para mostrar apenas equipamentos com status ${filterStatus}.`;
      }
      window.dispatchEvent(new CustomEvent('voice-speak', { detail: { text } }));
    };
    window.addEventListener('voice-read-screen', handleReadScreen);
    return () => window.removeEventListener('voice-read-screen', handleReadScreen);
  }, [equipamentos, filterStatus]);

  const filteredItems = equipamentos
    .filter(item => filterStatus === 'all' ? true : item.status === filterStatus)
    .sort((a, b) => {
      if (sortOrder === 'alphabetical') return a.name.localeCompare(b.name);
      return a.id - b.id;
    });

  // Traduz status do banco para português e define a classe CSS
  const getStatusInfo = (status: string): { label: string; className: string } => {
    const s = (status || '').toUpperCase().trim();
    if (s === 'DISPONÍVEL' || s === 'DISPONIVEL' || s === 'AVAILABLE') {
      return { label: 'Disponível', className: 'available' };
    }
    if (s === 'EM USO' || s === 'IN USE' || s === 'INUSE' || s === 'IN-USE') {
      return { label: 'Em Uso', className: 'in-use' };
    }
    if (s === 'MANUTENÇÃO' || s === 'MANUTENCAO' || s === 'MAINTENANCE') {
      return { label: 'Manutenção', className: 'maintenance' };
    }
    return { label: status, className: 'in-use' };
  };

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
                <option value="DISPONÍVEL">Disponíveis Hoje</option>
                <option value="EM USO">Em Uso</option>
                <option value="MANUTENÇÃO">Em Manutenção</option>
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
                    
                    <span className={`status-badge ${getStatusInfo(item.status).className}`}>
                        <Circle size={10} fill="currentColor" aria-hidden="true" /> {getStatusInfo(item.status).label}
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