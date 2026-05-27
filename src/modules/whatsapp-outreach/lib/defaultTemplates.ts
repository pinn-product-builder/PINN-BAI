/**
 * Biblioteca de templates default para campanhas WhatsApp.
 *
 * Quando uma campanha é criada pelo wizard, esses templates são auto-criados
 * (1 por touch do cadence_days) pra que o usuário não comece com a tela em branco.
 * Tudo aqui é editável depois — é só um ponto de partida.
 *
 * Tom: voz Mari Pinn — humano, direto, sem ser invasivo. Sempre puxa contexto
 * do brief (nome, empresa, cargo) e tenta gerar resposta com pergunta aberta.
 *
 * Padrão de cadência presumido: D0 / D2 / D5 / D9.
 * Se a campanha tiver cadência maior, o último template (breakup) se repete.
 */

export interface DefaultTemplate {
  /** Posição na cadência (0 = D0, 1 = t1, 2 = t2, ...) */
  touch_index: number;
  /** Corpo da mensagem com placeholders {{nome}}/{{empresa}}/{{cargo}} */
  body: string;
  /** Variáveis usadas pelo template — informativo pra UI */
  vars: string[];
  /** Notas internas explicando a estratégia do touch */
  notes: string;
}

/**
 * Templates default pra cadência típica D0/D2/D5/D9.
 * Cada um cobre 1 índice de touch — index 0 = abertura, último = breakup.
 */
export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    touch_index: 0,
    body:
      "Oi {{nome}}, aqui é a Mari da Pinn 👋\n\n" +
      "Tô falando com diretores comerciais de empresas como a {{empresa}} sobre uma forma de não perder lead por falta de follow-up — a gente tem uma IA SDR que cuida do funil enquanto o time foca em fechar.\n\n" +
      "Faz sentido a gente trocar uma ideia rápida? Sem compromisso, só pra eu entender se cabe no seu cenário.",
    vars: ["nome", "empresa"],
    notes:
      "D0 — Abertura. Apresenta a Mari, ancora no cargo do lead, propõe valor curto e termina com pergunta aberta de baixo atrito.",
  },
  {
    touch_index: 1,
    body:
      "{{nome}}, voltei aqui rapidinho 🙂\n\n" +
      "Mandei mensagem outro dia sobre como a Pinn ajuda times comerciais a não perderem lead no funil — sei que a agenda de {{cargo}} é puxada, então fica tranquilo se não for o momento.\n\n" +
      "Só queria saber se faz sentido pra {{empresa}} hoje, ou se prefere que eu volte mais pra frente.",
    vars: ["nome", "cargo", "empresa"],
    notes:
      "t1 (D+2) — Follow-up cordial. Lembra do contato anterior, abre porta pra dizer 'agora não' sem perder o lead, demonstra empatia com a rotina.",
  },
  {
    touch_index: 2,
    body:
      "Oi {{nome}}, última tentativa por aqui pra não virar spam.\n\n" +
      "Posso te mandar um case curto de outra empresa do seu setor que economizou 12h/semana do time comercial com a gente? São 2 prints, leitura de 30 segundos.\n\n" +
      "Se preferir, me responde com '*depois*' que eu volto em uns 30 dias.",
    vars: ["nome"],
    notes:
      "t2 (D+5) — Ângulo diferente: oferece prova social (case) com custo de leitura mínimo. Escape válvula 'depois' pra capturar interesse adiado.",
  },
  {
    touch_index: 3,
    body:
      "{{nome}}, prometo que essa é a última 😄\n\n" +
      "Como não consegui falar com você por aqui, vou parar de incomodar e arquivar nosso contato. Se em algum momento fizer sentido bater um papo sobre IA SDR pra {{empresa}}, é só me responder esse número que retomo na hora.\n\n" +
      "Sucesso na operação aí!",
    vars: ["nome", "empresa"],
    notes:
      "t3 (D+9) — Breakup educado. Encerra a cadência com gratidão e deixa porta aberta. Esse texto também é reutilizado pra cadências mais longas.",
  },
];

/**
 * Retorna `cadenceLen` templates default — sempre cobre todos os touches da
 * cadência. Se cadência > 4, repete o último (breakup) nos extras.
 *
 * Cada template gerado é uma cópia (não referência) — modificar o retorno
 * não afeta a constante DEFAULT_TEMPLATES.
 */
export function getDefaultTemplatesForCadence(cadenceLen: number): DefaultTemplate[] {
  const safeLen = Math.max(1, Math.min(cadenceLen, 12));
  const last = DEFAULT_TEMPLATES[DEFAULT_TEMPLATES.length - 1];
  return Array.from({ length: safeLen }, (_, i) => {
    const base = DEFAULT_TEMPLATES[i] ?? last;
    return {
      touch_index: i,
      body: base.body,
      vars: [...base.vars],
      notes: base.notes,
    };
  });
}
