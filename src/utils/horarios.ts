/**
 * Aritmetica de horarios das reservas.
 *
 * Uma reserva e um intervalo [inicio, fim). O banco guarda os dois como texto
 * "HH:MM" (Appointment.time e Appointment.endTime), entao qualquer conta de
 * duracao ou sobreposicao passa por minutos desde a meia-noite.
 */

/** Primeiro horario que o laboratorio aceita como inicio de reserva. */
export const HORA_ABERTURA = "08:00";
/** Horario em que o laboratorio fecha: nenhuma reserva pode terminar depois. */
export const HORA_FECHAMENTO = "19:00";
/** Intervalo entre um slot e o seguinte, em minutos. */
export const PASSO_SLOT = 30;

/** Duracoes oferecidas no formulario, em minutos. */
export const DURACOES = [30, 60, 90, 120];

/** "16:30" -> 990. Devolve NaN para texto invalido. */
export function paraMinutos(horario: string): number {
  const [h, m] = (horario || "").split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
  return h * 60 + m;
}

/** 990 -> "16:30". */
export function paraHorario(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** somarMinutos("16:30", 90) -> "18:00". */
export function somarMinutos(horario: string, minutos: number): string {
  return paraHorario(paraMinutos(horario) + minutos);
}

/** 90 -> "1h30"; 60 -> "1h"; 30 -> "30min". */
export function formatarDuracao(minutos: number): string {
  if (!Number.isFinite(minutos) || minutos <= 0) return "";
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

/**
 * Duracao de uma reserva em minutos, ou null quando ela nao tem fim gravado
 * (reservas antigas, criadas antes do seletor de duracao) ou quando o fim nao
 * e posterior ao inicio.
 */
export function duracaoEntre(inicio: string, fim?: string | null): number | null {
  if (!inicio || !fim) return null;
  const i = paraMinutos(inicio);
  const f = paraMinutos(fim);
  if (Number.isNaN(i) || Number.isNaN(f) || f <= i) return null;
  return f - i;
}

/**
 * Texto do horario para a tela: "16:00 as 17:00 (1h)".
 *
 * Reserva sem fim util mostra so o inicio — antes disso a tela repetia o
 * inicio nos dois lados e exibia "16:00 as 16:00", que nao e um intervalo.
 */
export function formatarIntervalo(inicio?: string | null, fim?: string | null): string {
  if (!inicio) return "Horário não informado";
  const duracao = duracaoEntre(inicio, fim);
  if (duracao === null) return inicio;
  return `${inicio} às ${fim} (${formatarDuracao(duracao)})`;
}

/** true quando [inicioA, fimA) e [inicioB, fimB) se cruzam. */
export function haSobreposicao(
  inicioA: string,
  fimA: string,
  inicioB: string,
  fimB: string,
): boolean {
  return paraMinutos(inicioA) < paraMinutos(fimB) && paraMinutos(inicioB) < paraMinutos(fimA);
}
