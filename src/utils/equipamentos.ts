// Agrupamento de equipamentos por modelo.
//
// Três telas precisavam da mesma redução — o catálogo público, a página de
// detalhes e a aba de equipamentos do perfil — e cada uma tinha a sua cópia,
// adivinhando o grupo por regex sobre o nome ("Bambu Lab A1" -> "Bambu Lab").
// A adivinhação saiu do código: o grupo agora é o campo `modelo`, gravado no
// banco. Isto aqui é só a agregação.

import { ehDisponivel } from './status';

/** O mínimo que o agrupamento lê. As funções são genéricas: o resto dos campos
 *  (imagem, descrição...) passa adiante com o tipo de quem chamou. */
export interface UnidadeAgrupada {
  id: number | string;
  name: string;
  modelo?: string;
  status: string;
}

export type GrupoDeModelo<T extends UnidadeAgrupada = UnidadeAgrupada> = T & {
  quantidade: number;
  unidades: T[];
};

/** Nome do grupo de uma unidade. O fallback cobre registro antigo sem modelo. */
export function modeloDe(item: UnidadeAgrupada): string {
  return (item.modelo || item.name || '').trim();
}

/**
 * Um item por modelo, com a contagem de unidades e a lista delas.
 * O grupo aparece como disponível se ao menos uma unidade estiver — é o que o
 * usuário quer saber ao olhar o card: dá para reservar alguma?
 */
export function agruparPorModelo<T extends UnidadeAgrupada>(itens: T[]): GrupoDeModelo<T>[] {
  const grupos: Record<string, GrupoDeModelo<T>> = {};

  for (const item of itens) {
    const modelo = modeloDe(item);
    if (!grupos[modelo]) {
      grupos[modelo] = { ...item, name: modelo, quantidade: 1, unidades: [item] };
    } else {
      grupos[modelo].quantidade += 1;
      grupos[modelo].unidades.push(item);
      if (ehDisponivel(item.status)) grupos[modelo].status = item.status;
    }
  }

  return Object.values(grupos);
}

/** As unidades irmãs de um equipamento, ele incluído, em ordem de nome. */
export function unidadesDoMesmoModelo<T extends UnidadeAgrupada>(
  todos: T[],
  alvo: UnidadeAgrupada,
): T[] {
  const modelo = modeloDe(alvo);
  return todos
    .filter((e) => modeloDe(e) === modelo)
    .sort((a, b) => a.name.localeCompare(b.name));
}
