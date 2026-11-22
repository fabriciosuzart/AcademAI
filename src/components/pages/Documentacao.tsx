import React from 'react';
import './Documentacao.css';

const Documentacao: React.FC = () => {
  return (
    <div className="docs-container">
        <main>
            <h1>Documentação e Manuais</h1>
            <p style={{textAlign: 'center', color: '#cbd5e1', marginBottom: '40px'}}>
                Acesse os guias de uso e segurança para todos os nossos equipamentos.
            </p>
            
            <div className="doc-section">
                <h2>Impressão 3D</h2>
                <ul className="doc-list" style={{listStyle: 'none', padding: 0}}>
                    <li style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '15px 0'}}>
                        <div>
                            <strong style={{color: '#f8fafc', fontSize: '1.1rem'}}>Manual da Impressora 3D Finder</strong>
                            <p style={{margin: '5px 0 0 0', fontSize: '0.9rem'}}>Unidades, treinamento obrigatório e regras de uso.</p>
                        </div>
                        <a href="/docs/manual-impressora-3d-finder.html" target="_blank" rel="noopener noreferrer" style={{background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold'}}>Ler Online</a>
                    </li>
                </ul>
            </div>

            <div className="doc-section">
                <h2>Corte a Laser</h2>
                <ul className="doc-list" style={{listStyle: 'none', padding: 0}}>
                    <li style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '15px 0'}}>
                        <div>
                            <strong style={{color: '#f8fafc', fontSize: '1.1rem'}}>Guia de Segurança da Cortadora a Laser</strong>
                            <p style={{margin: '5px 0 0 0', fontSize: '0.9rem'}}>Treinamento obrigatório e normas de segurança do laboratório.</p>
                        </div>
                        <a href="/docs/guia-seguranca-cortadora-laser.html" target="_blank" rel="noopener noreferrer" style={{background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold'}}>Ler Online</a>
                    </li>
                </ul>
            </div>

            <div className="doc-section">
                <h2>Regras do Laboratório</h2>
                <ul className="doc-list" style={{listStyle: 'none', padding: 0}}>
                    <li style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '15px 0'}}>
                        <div>
                            <strong style={{color: '#f8fafc', fontSize: '1.1rem'}}>Termos de Uso do Laboratório</strong>
                            <p style={{margin: '5px 0 0 0', fontSize: '0.9rem'}}>Regulamento geral para utilização do espaço Maker.</p>
                        </div>
                        <a href="/Termos_de_Uso.pdf" target="_blank" rel="noopener noreferrer" style={{background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold'}}>Baixar PDF</a>
                    </li>
                    <li style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0'}}>
                        <div>
                            <strong style={{color: '#f8fafc', fontSize: '1.1rem'}}>Procedimento de Agendamento</strong>
                            <p style={{margin: '5px 0 0 0', fontSize: '0.9rem'}}>Passo a passo de como reservar os equipamentos.</p>
                        </div>
                        <a href="/docs/procedimento-de-agendamento.html" target="_blank" rel="noopener noreferrer" style={{background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold'}}>Ler Online</a>
                    </li>
                </ul>
            </div>
            
        </main>
    </div>
  );
};

export default Documentacao;