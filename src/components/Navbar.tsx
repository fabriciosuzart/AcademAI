import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css';
import { GraduationCap, Bell } from 'lucide-react';

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Recupera os dados do usuário salvos no login
  const userName = localStorage.getItem('userName');

  const closeMobileMenu = () => setIsMenuOpen(false);

  // Função para limpar o acesso e deslogar
  const handleLogout = () => {
    localStorage.clear();
    closeMobileMenu();
    navigate('/login');
  };

  return (
    <nav className="navbar" role="navigation" aria-label="Menu principal">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo" onClick={closeMobileMenu}>
          <GraduationCap className="logo-image" strokeWidth={2} aria-hidden="true" />
          <span>AcademAI</span>
        </Link>

        <ul className={isMenuOpen ? "nav-menu active" : "nav-menu"}>
          <li className="nav-item">
            <Link to="/" className="nav-link" onClick={closeMobileMenu} aria-label="Página inicial">Home</Link>
          </li>
          <li className="nav-item">
            <Link to="/assistente" className="nav-link" onClick={closeMobileMenu} aria-label="Assistente de Inteligência Artificial">Assistente IA</Link>
          </li>
          <li className="nav-item">
            <Link to="/equipamentos" className="nav-link" onClick={closeMobileMenu} aria-label="Lista de equipamentos">Equipamentos</Link>
          </li>
          <li className="nav-item">
            <Link to="/disponibilidade" className="nav-link" onClick={closeMobileMenu} aria-label="Ver disponibilidade">Disponibilidade</Link>
          </li>
          <li className="nav-item">
            <Link to="/documentacao" className="nav-link" onClick={closeMobileMenu} aria-label="Documentação e tutoriais">Documentação</Link>
          </li>
          <li className="nav-item">
            <Link to="/contato" className="nav-link" onClick={closeMobileMenu} aria-label="Formulário de contato">Contato</Link>
          </li>

          {/* LÓGICA DE LOGIN / LOGOUT */}
          <li className="nav-item">
            {userName ? (
              <div className="user-nav-box">
                <Link to="/perfil" className="nav-user-name" style={{ textDecoration: 'none', color: '#004aad', fontWeight: 'bold' }} onClick={closeMobileMenu}>
                  Olá, {userName.split(' ')[0]}
                </Link>
                <Link to="/notificacoes" className="nav-link nav-icon-link" onClick={closeMobileMenu} aria-label="Ver Notificações" title="Notificações">
                  <Bell size={20} aria-hidden="true" />
                </Link>
                <button className="logout-btn" onClick={handleLogout} aria-label="Sair da conta">Sair</button>
              </div>
            ) : (
              <Link to="/login" className="nav-link login-btn" onClick={closeMobileMenu} aria-label="Fazer login">
                Login
              </Link>
            )}
          </li>
        </ul>

        <div className="nav-icon" role="button" aria-label="Alternar menu de navegação" aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <div className={isMenuOpen ? "line1 active" : "line1"}></div>
          <div className={isMenuOpen ? "line2 active" : "line2"}></div>
          <div className={isMenuOpen ? "line3 active" : "line3"}></div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;