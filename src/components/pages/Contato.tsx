import React from 'react';
import './Contato.css';

const Contato: React.FC = () => {
  return (
    <div className="contato-container">
      <main className="contato-content">
        <h1>Entre em Contato</h1>
        <p>
          Tem alguma dúvida, sugestão ou precisa de ajuda com um projeto?
          <br />Preencha o formulário abaixo e nossa equipe responderá em breve.
        </p>

        <form className="contato-form">
          <div>
            <label htmlFor="nome">Nome Completo</label>
            <input type="text" id="nome" placeholder="Seu nome" required />
          </div>

          <div>
            <label htmlFor="email">E-mail Institucional</label>
            <input type="email" id="email" placeholder="nome@unisanta.br" required />
          </div>

          <div>
            <label htmlFor="assunto">Assunto</label>
            <select id="assunto" required>
              <option value="" disabled>
                Selecione um motivo...
              </option>
              <option value="duvida">Dúvida Geral</option>
              <option value="projeto">Ajuda com Projeto</option>
              <option value="equipamento">Problema em Equipamento</option>
              <option value="sugestao">Sugestão</option>
            </select>
          </div>

          <div>
            <label htmlFor="mensagem">Mensagem</label>
            <textarea id="mensagem" placeholder="Descreva como podemos te ajudar..." required />
          </div>

          <button type="submit">Enviar Mensagem</button>
        </form>

{/*          <div className="contato-info">
                <div className="info-box">
                    <h3>Onde Estamos</h3>
                    <p>Laboratório<br/>Universidade Santa Cecília (Unisanta)</p>
                </div>
                <div className="info-box">
                    <h3>Horário</h3>
                    <p>Segunda a Sexta<br/>08:00 às 21:00</p>
                </div>
            </div>
*/}
            
        </main>
    </div>
  );
};

export default Contato;