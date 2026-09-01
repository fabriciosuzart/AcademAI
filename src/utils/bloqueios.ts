/**
 * Datas bloqueadas (feriados, recesso, manutencao programada).
 *
 * A regra de casamento vive aqui porque as duas telas de calendario —
 * CalendarPicker, na solicitacao de reserva, e Disponibilidade, na consulta —
 * precisam concordar sobre o que esta trancado. Quando cada uma tinha a sua
 * copia, so a primeira bloqueava, e a segunda ainda oferecia "Reservar" num
 * feriado. O backend aplica a mesma regra em server.js e mcp_tools.js.
 */

export interface DataBloqueada {
  id: number;
  date: string;
  reason?: string | null;
  /** null = bloqueio global, vale para todos os equipamentos. */
  equipmentId?: number | null;
}

/**
 * O bloqueio que atinge `dataISO` para este equipamento, se houver.
 *
 * Um bloqueio sem equipmentId e global; com equipmentId, so tranca aquela
 * maquina. `equipmentId` chega como texto vindo do <select>, dai a comparacao
 * por String.
 */
export function bloqueioDoDia(
  bloqueios: DataBloqueada[],
  dataISO: string,
  equipmentId: string | number | null,
): DataBloqueada | undefined {
  const alvo = equipmentId === null || equipmentId === "" ? null : String(equipmentId);
  return bloqueios.find(
    (b) =>
      b.date === dataISO &&
      (b.equipmentId === null ||
        b.equipmentId === undefined ||
        (alvo !== null && String(b.equipmentId) === alvo)),
  );
}

/** Motivo apresentavel — o campo e opcional no banco. */
export function motivoDoBloqueio(bloqueio?: DataBloqueada): string {
  if (!bloqueio) return "";
  return bloqueio.reason || "Feriado/Recesso";
}
