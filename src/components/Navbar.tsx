import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css';
import logoImage from '../assets/images/logofablab.png'; 

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Recupera os dados do usuário salvos no login
  const userName = localStorage.getItem('userName');
  const userRole = localStorage.getItem('userRole');

  const closeMobileMenu = () => setIsMenuOpen(false);

  // Função para limpar o acesso e deslogar
  const handleLogout = () => {
    localStorage.clear();
    closeMobileMenu();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo" onClick={closeMobileMenu}>
          <img src={logoImage} alt="InovFabLab Logo" className="logo-image" />
          <span>INOVFABLAB</span>
        </Link>

        <ul className={isMenuOpen ? "nav-menu active" : "nav-menu"}>
          <li className="nav-item">
            <Link to="/" className="nav-link" onClick={closeMobileMenu}>Home</Link>
          </li>
          <li className="nav-item">
            <Link to="/assistente" className="nav-link" onClick={closeMobileMenu}>Assistente IA</Link>
          </li>
          <li className="nav-item">
            <Link to="/equipamentos" className="nav-link" onClick={closeMobileMenu}>Equipamentos</Link>
          </li>
          <li className="nav-item">
            <Link to="/documentacao" className="nav-link" onClick={closeMobileMenu}>Documentação</Link>
          </li>
          <li className="nav-item">
            <Link to="/contato" className="nav-link" onClick={closeMobileMenu}>Contato</Link>
          </li>

          {/* LÓGICA DE LOGIN / LOGOUT 👇 */}
          <li className="nav-item">
            {userName ? (
              <div className="user-nav-box">
                <Link to="/perfil" className="nav-user-name" style={{ textDecoration: 'none', color: '#004aad', fontWeight: 'bold' }} onClick={closeMobileMenu}>
                  Olá, {userName.split(' ')[0]}
                </Link>
                <button className="logout-btn" onClick={handleLogout}>Sair</button>
              </div>
            ) : (
              <Link to="/login" className="nav-link login-btn" onClick={closeMobileMenu}>
                Login
              </Link>
            )}
          </li>
        </ul>

        <div className="nav-icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <div className={isMenuOpen ? "line1 active" : "line1"}></div>
          <div className={isMenuOpen ? "line2 active" : "line2"}></div>
          <div className={isMenuOpen ? "line3 active" : "line3"}></div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;