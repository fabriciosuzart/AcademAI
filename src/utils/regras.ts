// Regras de reserva definidas pelo administrador (RF08/RF15).
//
// O backend é a fonte da verdade (GET /api/config/reservas, público). As telas
// buscam uma vez por carregamento e montam as opções de duração a partir da
// duração mínima e máxima; sem resposta, valem os padrões do servidor.
import { useEffect, useState } from 'react';
import api from '../api/axios';
import { DURACOES, PASSO_SLOT } from './horarios';

export interface RegrasReserva {
  antecedenciaMinimaMinutos: number;
  duracaoMinimaMinutos: number;
  duracaoMaximaMinutos: number;
  limiteReservasAtivas: number;
  antecedenciaCancelamentoHoras: number;
}

export interface ConfigReservas {
  regras: RegrasReserva;
  padrao: RegrasReserva;
  faixas: Record<keyof RegrasReserva, [number, number]>;
}

export const REGRAS_PADRAO: RegrasReserva = {
  antecedenciaMinimaMinutos: 0,
  duracaoMinimaMinutos: 30,
  duracaoMaximaMinutos: 120,
  limiteReservasAtivas: 3,
  antecedenciaCancelamentoHoras: 2,
};

let emCache: Promise<RegrasReserva> | null = null;

/** Busca as regras (uma vez por carregamento da página). `recarregar` ignora o cache. */
export function buscarRegras(recarregar = false): Promise<RegrasReserva> {
  if (!emCache || recarregar) {
    emCache = api
      .get<ConfigReservas>('/config/reservas')
      .then((r) => ({ ...REGRAS_PADRAO, ...r.data.regras }))
      .catch(() => {
        emCache = null;
        return REGRAS_PADRAO;
      });
  }
  return emCache;
}

/** Durações oferecidas: da mínima à máxima, na grade de 30 min (e sempre a mínima). */
export function duracoesPermitidas(regras: RegrasReserva): number[] {
  const { duracaoMinimaMinutos: min, duracaoMaximaMinutos: max } = regras;
  const lista = new Set<number>([min]);
  for (let m = Math.ceil(min / PASSO_SLOT) * PASSO_SLOT; m <= max; m += PASSO_SLOT) lista.add(m);
  const resultado = [...lista].filter((m) => m >= min && m <= max).sort((a, b) => a - b);
  return resultado.length ? resultado : DURACOES;
}

/** Hook: regras atuais (começa nos padrões e troca quando a resposta chega). */
export function useRegrasReserva(): RegrasReserva {
  const [regras, setRegras] = useState<RegrasReserva>(REGRAS_PADRAO);
  useEffect(() => {
    let ativo = true;
    buscarRegras().then((r) => { if (ativo) setRegras(r); });
    return () => { ativo = false; };
  }, []);
  return regras;
}
