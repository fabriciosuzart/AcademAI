> Conteúdo inicial do AcademAI, versionado para que a assistente tenha o que
> responder num ambiente recém-instalado. Descreve o fluxo que o próprio
> sistema executa hoje.

# Como reservar um equipamento

## Passo a passo

1. **Escolha o equipamento** na página de Equipamentos. O catálogo mostra um
   card por modelo, com a quantidade de unidades quando há mais de uma.

2. **Abra os detalhes** e, se o modelo tiver várias máquinas, **escolha a
   unidade**. Isso importa: cada unidade tem agenda própria, e a reserva sempre
   aponta para uma máquina concreta.

3. **Escolha a data e o horário.** Os horários vão das **08:00 às 18:00**, em
   blocos de uma hora. Horários já ocupados aparecem marcados e não podem ser
   selecionados.

4. **Confirme.** A reserva é criada e você recebe uma notificação com o
   resultado.

## O que acontece depois de confirmar

Depende do seu perfil:

- **Aluno** — a reserva fica com status **Pendente** e aguarda aprovação. Um
  professor ou administrador recebe a notificação e decide.
- **Professor** ou **Administrador** — a reserva é **aprovada automaticamente**,
  sem passar por fila.

Em qualquer caso você é notificado dentro do sistema e por e-mail, quando o
envio estiver configurado.

## Status possíveis de uma reserva

- **Pendente** — criada, aguardando decisão.
- **Aprovada** — confirmada, o horário é seu.
- **Rejeitada** — recusada, sempre com justificativa.
- **Cancelada** — desmarcada por você.
- **Concluída** — já aconteceu.

## Regras que o sistema aplica sozinho

- **Conflito de horário.** Duas reservas não podem ocupar a mesma unidade no
  mesmo intervalo. Reservas pendentes também bloqueiam o horário.
- **Equipamento em manutenção.** Máquinas nesse estado não aceitam reserva
  alguma, nem pelo catálogo nem pela assistente.
- **Datas bloqueadas.** O administrador pode bloquear dias específicos, por
  manutenção programada ou feriado.
- **Redução de quantidade.** Se um modelo tem unidades com reservas pendentes
  ou aprovadas, o administrador não consegue reduzir a quantidade de máquinas
  antes que essas reservas sejam resolvidas.

## Cancelar uma reserva

Reservas pendentes ou aprovadas podem ser canceladas pelo próprio usuário, na
aba Agendamentos do perfil. Depois de concluída, não há cancelamento.

## Reservar conversando com a assistente

A assistente virtual também cria reservas. Basta pedir em linguagem natural,
citando o equipamento pelo nome — por exemplo, "quero reservar a cortadora a
laser amanhã às 14h". As mesmas regras acima valem: conflito, manutenção e
aprovação por perfil.
