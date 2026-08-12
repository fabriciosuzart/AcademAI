import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

const Home: React.FC = () => {
    const userRole = localStorage.getItem('userRole');

    return (
        <div className="home-container">
            <main className="home-main">
                <h1>Bem-vindo ao INOVFABLAB!</h1>
                <p className="subtitle">O seu espaço para criar, inovar e construir o futuro.</p>

                <div className="tabs">
                    <Link to="/assistente" className="tab-button active">Interagir com IA</Link>
                    <Link to="/cadastro" className="tab-button active">Cadastre-se Agora</Link>
                    {userRole === 'ADMIN' && (
                        <Link to="/admin" className="tab-button admin-tab">Painel Admin</Link>
                    )}
                </div>

                <div className="content-box">
                    <h3>O que é o INOVFABLAB?</h3>
                    <p>Somos um laboratório de fabricação digital (FABLAB) onde a criatividade encontra as ferramentas para se transformar em realidade. Aqui, estudantes, pesquisadores e entusiastas podem desenvolver projetos, prototipar ideias e aprender na prática.</p>
                </div>

                <h2>Sua Jornada para Criar</h2>
                <div className="journey-grid">
                    <div className="content-box">
                        <h3>1. Cadastre-se e Treine</h3>
                        <p>O primeiro passo é se cadastrar. Após o cadastro, explore nossa lista de treinamentos online para os equipamentos que você deseja usar, como impressoras 3D, cortadoras a laser e muito mais.</p>
                    </div>

                    <div className="content-box">
                        <h3>2. Valide e Agende</h3>
                        <p>Depois de concluir o treinamento online, você agendará uma validação presencial com um de nossos responsáveis. Com a autorização, você ganha acesso para reservar os equipamentos diretamente pelo sistema.</p>
                    </div>

                    <div className="content-box">
                        <h3>3. Crie e Compartilhe</h3>
                        <p>Com o acesso liberado, o laboratório é seu! Reserve seus horários, desenvolva seus projetos e não se esqueça de compartilhar suas criações na Galeria de Projetos para inspirar outros e ganhar créditos para mais agendamentos.</p>
                    </div>
                </div>

                <h2>Conheça o Espaço</h2>
                <div className="video-container">
                    <iframe
                        src="https://www.youtube.com/embed/KLfAyKi_aK4"
                        title="YouTube video player"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen>
                    </iframe>
                </div>

                <h2>Aviso Importante</h2>
                <div className="content-box">
                    <ul className="rules-list">
                        <li>É obrigatório deixar um documento de identificação na recepção para utilizar qualquer equipamento.</li>
                        <li>Chegue com no mínimo 10 minutos de antecedência para preparar seu material e fazer o login.</li>
                        <li>Reservas possuem tolerância de 10 minutos de atraso. Após esse período, o horário será disponibilizado para outros usuários presentes no laboratório.</li>
                        <li>É estritamente proibida a entrada com bermuda, chinelos, saias, vestidos ou regatas, visando a sua segurança.</li>
                        <li>O INOVFABLAB não se responsabiliza por objetos ou materiais pessoais deixados no laboratório.</li>
                    </ul>
                </div>

                <p className="slogan">Somos todos INOVFABLAB, somos todos UNISANTA!</p>

            </main>
        </div>
    );
};

export default Home;