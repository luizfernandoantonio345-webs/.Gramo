// Gera a APRESENTACAO do sistema .GRAMO em PDF profissional, pronto para imprimir.
// Tecnica: monta HTML/CSS e renderiza com Chromium (page.pdf) -> tipografia
// perfeita, portugues acentuado e texto vetorial. Uma tela por pagina + guia.
// Uso: node scripts/gerar-apresentacao.mjs   (rode a captura antes)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TELAS = path.join(__dirname, '..', 'docs', 'telas');
const OUT = path.join(__dirname, '..', 'docs', 'APRESENTACAO-SISTEMA.pdf');
const VERIF = process.env.VERIF ? path.join(TELAS, '_preview') : null;

const img64 = (file) => {
  try {
    return 'data:image/jpeg;base64,' + fs.readFileSync(path.join(TELAS, file)).toString('base64');
  } catch {
    return '';
  }
};
const png64 = (abs) => {
  try {
    return 'data:image/png;base64,' + fs.readFileSync(abs).toString('base64');
  } catch {
    return '';
  }
};
const PUB = path.join(__dirname, '..', 'apps', 'web', 'public');
const LOGO = png64(path.join(PUB, 'gramo-logo.png'));
const EMBLEMA = png64(path.join(PUB, 'gramo-emblema.png'));

const TELAS_IMG = [
  { g: 'Colaborador', img: '01-colaborador-login.jpg', nome: 'Login do Colaborador',
    cap: 'Entrada do colaborador no aplicativo, com CPF e senha.',
    oque: 'É a porta de entrada do colaborador (CPF e senha). No primeiro acesso, a senha é criada a partir de um convite enviado pelo RH.',
    como: ['Digite o CPF e a senha.', 'No primeiro acesso, use o código de convite do RH.', 'Esqueceu a senha? Recupere-a por e-mail.'],
    nota: 'Após 5 tentativas incorretas, a conta é bloqueada por 15 minutos.' },
  { g: 'Colaborador', img: '02-colaborador-bater-ponto.jpg', nome: 'Bater Ponto',
    cap: 'Registro de entrada e saída com localização e foto. Funciona sem internet.',
    oque: 'É a tela principal do colaborador. Registra entrada, saída e intervalos, com a localização (área da obra — a REGAP) e uma foto. Funciona off-line e sincroniza automaticamente quando a conexão retorna.',
    como: ['Toque no botão para registrar.', 'Permita o acesso à localização e à câmera.', 'O comprovante exibe data, hora e o número de sequência (NSR).'],
    nota: 'O botão nunca bloqueia: fora da área ou do horário, o ponto entra como pendente. O registro é imutável.' },
  { g: 'Colaborador', img: '03-colaborador-folha.jpg', nome: 'Folha',
    cap: 'Espelho de ponto: as marcações do período e a situação de cada uma.',
    oque: 'Mostra o espelho de ponto do colaborador, com a situação de cada marcação (válida ou pendente).',
    como: ['Veja as marcações organizadas por dia.', 'Toque em uma marcação para ver os detalhes.', 'Não concorda com um registro? Use a opção "contestar".'] },
  { g: 'Colaborador', img: '04-colaborador-documentos.jpg', nome: 'Documentos',
    cap: 'Envio e consulta de documentos, com criptografia.',
    oque: 'Espaço para o colaborador enviar e consultar documentos (por exemplo, atestados). Os arquivos são criptografados (AES‑256).',
    como: ['Envie o arquivo (até 10 MB).', 'Acompanhe a situação: enviado, aprovado ou recusado.'] },
  { g: 'Colaborador', img: '05-colaborador-ferias.jpg', nome: 'Férias e Afastamentos',
    cap: 'Solicitação de férias e afastamentos, com acompanhamento.',
    oque: 'É onde o colaborador solicita férias ou registra afastamentos e acompanha a aprovação do RH.',
    como: ['Inicie uma nova solicitação e escolha o tipo.', 'Informe as datas e o motivo.', 'Acompanhe a situação: pendente, aprovada ou recusada.'],
    nota: 'Férias aprovadas que cobrem um dia evitam que o ponto daquele dia gere pendência.' },
  { g: 'Colaborador', img: '06-colaborador-comunicados.jpg', nome: 'Comunicados',
    cap: 'Mural de avisos da empresa; a leitura é registrada.',
    oque: 'Mural de avisos publicados pelo RH. Ao abrir um comunicado, a leitura é registrada — o RH consegue medir quem já leu.',
    como: ['Abra a lista de comunicados.', 'Toque em um item para lê‑lo (a leitura é marcada automaticamente).'] },

  { g: 'Administração / RH', img: '07-admin-login.jpg', nome: 'Login do Administrador',
    cap: 'Acesso do RH e dos gestores, com verificação em duas etapas (2FA).',
    oque: 'Acesso do RH e dos gestores. Além de e‑mail e senha, solicita um código de verificação em duas etapas (2FA), gerado por um aplicativo autenticador — uma camada extra que impede o acesso mesmo que a senha vaze.',
    como: ['Informe o e‑mail e a senha.', 'Digite o código de 6 dígitos do aplicativo autenticador.', 'No primeiro acesso, leia o QR Code para vincular o autenticador.'] },
  { g: 'Administração / RH', img: '08-admin-dashboard.jpg', nome: 'Painel (Dashboard)',
    cap: 'Visão executiva: indicadores, presença ao vivo e indicadores de RH.',
    oque: 'É a tela‑resumo da operação. Reúne os indicadores do dia (colaboradores ativos, marcações, pendências), a presença em tempo real, os alertas de hora extra, o comparativo entre obras e o painel de indicadores de RH: conformidade das marcações, atrasos, ausências, rotatividade e horas extras.',
    como: ['Abra o Painel logo após entrar.', 'Use o filtro de período nos indicadores de RH (o padrão é o mês corrente).', 'Acompanhe a presença e as horas extras quase em tempo real.'],
    nota: 'É a tela ideal para o gestor entender a operação em poucos segundos.' },
  { g: 'Administração / RH', img: '09-admin-gestao-ponto.jpg', nome: 'Gestão de Ponto',
    cap: 'Revisão das marcações, tratamento de pendências e ajustes.',
    oque: 'É onde o RH revisa as marcações, trata as pendências (fora da área ou do horário) e registra ajustes. Todo ajuste fica vinculado ao registro original, que nunca é apagado.',
    como: ['Filtre por colaborador, obra ou período.', 'Abra uma pendência e aprove ou registre um ajuste justificado.', 'Todas as ações ficam auditadas.'] },
  { g: 'Administração / RH', img: '10-admin-funcionarios.jpg', nome: 'Funcionários',
    cap: 'Cadastro, foto, documentos, importação por planilha e desligamento.',
    oque: 'Cadastro e gestão dos colaboradores: criar e editar, aprovar a foto de referência, gerir documentos, importar em lote por planilha (CSV) e desligar. O desligamento preserva os dados (guarda legal de 5 anos).',
    como: ['Cadastre um colaborador (CPF único) ou importe uma planilha.', 'Aprove a foto de referência.', 'Para desligar, use "desativar" — os dados são mantidos por lei.'] },
  { g: 'Administração / RH', img: '11-admin-ausencias.jpg', nome: 'Ausências',
    cap: 'Aprovação de férias e afastamentos, com visão de calendário.',
    oque: 'É onde o RH decide as solicitações de férias e afastamentos, com uma visão de calendário para planejar a cobertura das equipes.',
    como: ['Veja as solicitações pendentes.', 'Aprove ou recuse, sempre com justificativa.', 'Use o calendário para enxergar sobreposições na equipe.'] },
  { g: 'Administração / RH', img: '12-admin-comunicados.jpg', nome: 'Comunicados (RH)',
    cap: 'Publicação de avisos por público‑alvo, com taxa de leitura.',
    oque: 'É onde o RH publica comunicados e escolhe o público‑alvo (todos, uma obra, um cargo ou uma pessoa). A tela mostra a taxa de leitura de cada aviso.',
    como: ['Crie o comunicado com título e mensagem.', 'Escolha o público‑alvo.', 'Publique e acompanhe quantos já leram.'] },
  { g: 'Administração / RH', img: '13-admin-assinaturas.jpg', nome: 'Assinaturas',
    cap: 'Envio de documentos para assinatura digital.',
    oque: 'Envia documentos para o colaborador assinar digitalmente (individualmente ou em lote). A assinatura gera um registro imutável, com verificação de integridade.',
    como: ['Selecione o documento e os destinatários.', 'Envie (individualmente ou em lote).', 'Acompanhe quem já assinou, recusou ou está pendente.'] },
  { g: 'Administração / RH', img: '14-admin-relatorios.jpg', nome: 'Relatórios',
    cap: 'Relatórios operacionais e exportações legais (AFD e AEJ).',
    oque: 'Relatórios operacionais do ponto, para conferência e fechamento. Inclui as exportações legais (AFD e AEJ) exigidas pela fiscalização do trabalho.',
    como: ['Escolha o relatório e o período.', 'Gere e exporte para conferência ou para a fiscalização.'] },
  { g: 'Administração / RH', img: '15-admin-auditoria.jpg', nome: 'Auditoria',
    cap: 'Trilha de confiança: acessos, aprovações e ajustes.',
    oque: 'Registra tudo o que é sensível: acessos, aprovações e ajustes. É a trilha de confiança que comprova, para auditoria interna ou externa, quem fez o quê e quando.',
    como: ['Filtre por tipo de evento, usuário ou período.', 'Use para investigar ou comprovar ações.'] },
  { g: 'Administração / RH', img: '16-admin-configuracoes.jpg', nome: 'Configurações',
    cap: 'Jornadas, feriados e tolerâncias que regem o ponto.',
    oque: 'São os parâmetros que governam a validação do ponto: jornadas (horários, dias, carga diária e regime de horas), feriados e tolerâncias.',
    como: ['Cadastre as jornadas (entrada, saída, dias e tolerância).', 'Cadastre os feriados (gerais ou por obra).', 'Vincule cada colaborador à sua jornada.'],
    nota: 'Jornadas bem configuradas tornam os indicadores de atraso e de hora extra precisos.' },
  { g: 'Administração / RH', img: '17-admin-integracoes.jpg', nome: 'Integrações',
    cap: 'Chaves de API e integração com folha de pagamento e eSocial.',
    oque: 'Gera chaves de API para integrar com outros sistemas (folha de pagamento e eSocial) e configura essas integrações. Por segurança, a chave é exibida uma única vez.',
    como: ['Gere uma chave de API e guarde‑a com segurança.', 'Configure a integração desejada.'] },
  { g: 'Administração / RH', img: '18-admin-quiosque.jpg', nome: 'Quiosque (gestão)',
    cap: 'Cadastro dos dispositivos de ponto compartilhado.',
    oque: 'Gerencia os dispositivos de quiosque — tablets ou computadores fixos na obra, usados como ponto compartilhado. Cada dispositivo possui a própria credencial.',
    como: ['Cadastre um dispositivo e gere a sua credencial.', 'Instale o modo quiosque no aparelho.'] },

  { g: 'Quiosque', img: '19-quiosque.jpg', nome: 'Tela de Quiosque',
    cap: 'Ponto compartilhado no aparelho da obra, ativado por token.',
    oque: 'Dispositivo fixo na obra em que vários colaboradores batem o ponto, identificando-se um a um. Na primeira vez, o aparelho é ativado com um token gerado pelo RH; depois, autentica-se sozinho.',
    como: ['No aparelho, abra o sistema em modo quiosque.', 'Cole o token do dispositivo (gerado em Painel → Quiosque) e ative.', 'Cada colaborador identifica-se e registra o ponto.'] },
];

const TELAS_EXTRA = [
  { g: 'Administração / RH', nome: 'Telão de Presença',
    oque: 'Painel para exibir em uma TV ou monitor na obra, mostrando quem está presente no momento e atualizando sozinho. Ideal para a portaria e a segurança.',
    como: ['Abra o botão "Telão" no painel (abre em nova aba).', 'Coloque em tela cheia no monitor da obra.'] },
  { g: 'Administração / RH', nome: 'Mapa de Obras',
    oque: 'Define, no mapa, a área válida para bater ponto de cada obra (a REGAP). Marcações fora dessa área entram como pendentes para o RH avaliar.',
    como: ['Localize a obra no mapa.', 'Clique no mapa para posicionar o centro da área.', 'Ajuste o raio e salve.'] },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

// ---- monta as paginas de conteudo (sem a capa) ----
const paginas = [];

// Pagina: como apresentar
paginas.push(`
  <div class="pad">
    <div class="eyebrow">Introdução</div>
    <h2 class="title">Como apresentar</h2>
    <p class="lead">Este material tem duas partes. Primeiro, as <b>telas</b> — uma por página, com a imagem real e uma frase sobre o que cada uma faz —, ideais para mostrar o sistema. Ao final, um <b>guia de estudo</b> com o passo a passo de cada tela, para você se preparar.</p>
    <h3 class="h3">Três mensagens‑chave para o gerente</h3>
    <ul class="msgs">
      <li><b>É confiável e legal:</b> segue a Portaria MTP nº 671/2021, com ponto imutável, exportações fiscais e assinatura digital.</li>
      <li><b>É seguro:</b> dados isolados por empresa no banco de dados, biometria e documentos criptografados, verificação em duas etapas (2FA) e trilha de auditoria.</li>
      <li><b>Dá visão de gestão:</b> painel com presença ao vivo e indicadores de RH (atrasos, ausências, rotatividade e horas extras).</li>
    </ul>
    <div class="rule">
      <div class="rule-title">Regra de ouro</div>
      O botão de bater ponto <b>nunca bloqueia</b> o colaborador: fora da área ou do horário, o registro é aceito como pendente e o RH valida depois. O ponto é sempre um documento imutável.
    </div>
  </div>`);

let grupoAtual = '';
let numero = 0;
for (const s of TELAS_IMG) {
  if (s.g !== grupoAtual) {
    grupoAtual = s.g;
    paginas.push('@@DIV@@' + grupoAtual);
  }
  numero++;
  paginas.push(`
    <div class="pad screen">
      <div class="eyebrow">${esc(grupoAtual)} &nbsp;·&nbsp; Tela ${numero}</div>
      <h2 class="title">${esc(s.nome)}</h2>
      <div class="stage"><img src="${img64(s.img)}" alt="${esc(s.nome)}"/></div>
      <p class="cap">${esc(s.cap)}</p>
    </div>`);
}

// Guia de estudo: chunk de 4 itens por pagina
const todos = [...TELAS_IMG, ...TELAS_EXTRA];
const porPagina = 3;
for (let i = 0; i < todos.length; i += porPagina) {
  const bloco = todos.slice(i, i + porPagina);
  const itens = bloco
    .map((s, k) => {
      const passos = (s.como ?? []).map((p) => `<li>${esc(p)}</li>`).join('');
      const nota = s.nota ? `<div class="gnote">Observação: ${esc(s.nota)}</div>` : '';
      return `
      <div class="gitem">
        <div class="geyebrow">${esc(s.g)}</div>
        <div class="gtitle">${i + k + 1}. ${esc(s.nome)}</div>
        <div class="gtext">${esc(s.oque)}</div>
        <div class="gsteps-label">Como usar</div>
        <ul class="gsteps">${passos}</ul>
        ${nota}
      </div>`;
    })
    .join('<div class="gsep"></div>');
  const cabecalho =
    i === 0
      ? `<div class="eyebrow">Anexo</div><h2 class="title">Guia de estudo</h2><p class="lead">Passo a passo de cada tela, para você se preparar antes de apresentar.</p>`
      : `<div class="eyebrow">Anexo</div><h2 class="title">Guia de estudo <span class="cont">(continuação)</span></h2>`;
  paginas.push(`<div class="pad">${cabecalho}<div class="guide">${itens}</div></div>`);
}

const totalPdf = paginas.length + 1; // + capa
const corpo = paginas
  .map((entry, idx) => {
    if (entry.startsWith('@@DIV@@')) {
      const nome = entry.slice(7);
      return `<section class="divider"><div class="divider-inner">${esc(nome)}</div></section>`;
    }
    const pdfPage = idx + 2; // capa e a pagina 1
    const marca = EMBLEMA ? `<img class="hdr-logo" src="${EMBLEMA}" alt="GRAMO"/>` : '';
    return `
  <section class="page">
    ${marca}
    ${entry}
    <div class="pfoot"><span>.GRAMO — Ponto Eletrônico Corporativo</span><span>${pdfPage} / ${totalPdf}</span></div>
  </section>`;
  })
  .join('');

const css = `
  *{margin:0;padding:0;box-sizing:border-box}
  html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1f2a33;font-size:11pt;line-height:1.5}
  @page{size:A4;margin:0}
  .page{position:relative;width:210mm;height:297mm;overflow:hidden;page-break-after:always}
  .page:last-child{page-break-after:auto}
  .pad{padding:20mm 20mm 22mm}
  .eyebrow{color:#12808f;font-size:9.5pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
  .title{font-size:23pt;color:#0b2b36;margin-top:3mm;font-weight:700;letter-spacing:-.01em}
  .title .cont{font-size:13pt;color:#6b7681;font-weight:400}
  .lead{margin-top:5mm;color:#3a4750;font-size:12pt}
  .h3{margin-top:9mm;color:#0b5563;font-size:13.5pt}
  .msgs{margin:4mm 0 0 5mm;list-style:none}
  .msgs li{position:relative;padding-left:7mm;margin-bottom:3mm;color:#2b3740}
  .msgs li::before{content:'';position:absolute;left:0;top:2.6mm;width:3mm;height:3mm;border-radius:50%;background:#12808f}
  .rule{margin-top:11mm;background:#eef6f7;border-left:5px solid #0b5563;border-radius:6px;padding:6mm 7mm;color:#26333c}
  .rule-title{font-weight:700;color:#0b5563;margin-bottom:2mm;text-transform:uppercase;letter-spacing:.08em;font-size:9.5pt}
  /* divisor de grupo */
  .divider{position:relative;width:210mm;height:297mm;page-break-after:always;background:linear-gradient(135deg,#0b5563,#12808f);display:flex;align-items:center;justify-content:center}
  .divider-inner{color:#fff;font-size:30pt;font-weight:700;letter-spacing:-.01em;text-align:center;padding:0 24mm}
  /* tela */
  .stage{margin-top:8mm;height:198mm;background:#eef2f4;border:1px solid #dde4e8;border-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden}
  .stage img{max-width:94%;max-height:94%;object-fit:contain;border-radius:6px;box-shadow:0 8px 26px rgba(11,39,51,.18)}
  .cap{margin-top:7mm;font-size:12pt;color:#33414d}
  /* guia */
  .guide{margin-top:6mm}
  .gitem{page-break-inside:avoid}
  .geyebrow{color:#12808f;font-size:8.5pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
  .gtitle{font-size:13pt;font-weight:700;color:#0b2b36;margin-top:1mm}
  .gtext{font-size:10.5pt;color:#3a4750;margin-top:1.5mm}
  .gsteps-label{font-size:9.5pt;font-weight:700;color:#0b5563;margin-top:2.5mm}
  .gsteps{margin:1mm 0 0 6mm;font-size:10.5pt;color:#2b3740}
  .gsteps li{margin-bottom:.7mm}
  .gnote{font-size:9.5pt;color:#6b7681;font-style:italic;margin-top:2mm}
  .gsep{border-top:1px solid #e6ebee;margin:5mm 0}
  .pfoot{position:absolute;left:20mm;right:20mm;bottom:9mm;display:flex;justify-content:space-between;font-size:8pt;color:#8a949c;border-top:1px solid #e6ebee;padding-top:2.5mm}
  /* capa */
  .cover{position:relative;width:210mm;height:297mm;page-break-after:always;background:linear-gradient(150deg,#0a4a58 0%,#0b5563 45%,#12808f 100%);color:#fff;overflow:hidden}
  .cover .mark{position:absolute;right:-60mm;top:-60mm;width:180mm;height:180mm;border-radius:50%;background:rgba(255,255,255,.05)}
  .cover .mark2{position:absolute;left:-40mm;bottom:-50mm;width:130mm;height:130mm;border-radius:50%;background:rgba(255,255,255,.04)}
  .cover .logocard{position:absolute;left:22mm;top:24mm;background:#fff;border-radius:8px;padding:5mm 7mm;box-shadow:0 8px 22px rgba(0,0,0,.20)}
  .cover .logocard img{height:15mm;display:block}
  .hdr-logo{position:absolute;top:12mm;right:20mm;height:9mm;border-radius:2px;z-index:5}
  .cover .inner{position:absolute;left:22mm;right:22mm;top:88mm}
  .cover .brand{font-size:58pt;font-weight:800;letter-spacing:-.02em}
  .cover .sub{font-size:19pt;color:#d5eef1;margin-top:2mm}
  .cover .kicker{margin-top:9mm;font-size:13pt;font-weight:700;color:#eafafb;text-transform:uppercase;letter-spacing:.12em}
  .cover .bar{width:52mm;height:3px;background:#7fd0d8;margin:6mm 0}
  .cover .desc{font-size:12pt;color:#cdeaed;max-width:150mm;line-height:1.6}
  .cover .foot{position:absolute;left:22mm;right:22mm;bottom:20mm;color:#bfe3e7;font-size:10.5pt;border-top:1px solid rgba(255,255,255,.25);padding-top:4mm;display:flex;justify-content:space-between}
`;

const capa = `
  <section class="cover">
    <div class="mark"></div><div class="mark2"></div>
    ${LOGO ? `<div class="logocard"><img src="${LOGO}" alt="GRAMO Engenharia"/></div>` : ''}
    <div class="inner">
      <div class="brand">.GRAMO</div>
      <div class="sub">Ponto Eletrônico Corporativo</div>
      <div class="kicker">Apresentação do Sistema</div>
      <div class="bar"></div>
      <div class="desc">Guia visual das telas e roteiro de uso, para apresentação executiva. Em conformidade com a Portaria MTP nº 671/2021 (REP‑P).</div>
    </div>
    <div class="foot"><span>GRAMO Engenharia</span><span>${esc(hoje)} · gramoengenharia.online</span></div>
  </section>`;

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${css}</style></head><body>${capa}${corpo}</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'print' });

if (VERIF) {
  // Modo verificacao: exporta PNGs das primeiras paginas para conferencia visual.
  await page.setViewportSize({ width: 794, height: 1123 });
  const secoes = await page.$$('section');
  for (let i = 0; i < Math.min(secoes.length, Number(process.env.VERIF)); i++) {
    await secoes[i].screenshot({ path: `${VERIF}-${String(i + 1).padStart(2, '0')}.png` });
  }
  console.log('previews em docs/telas/_preview-*.png');
}

await page.pdf({
  path: OUT,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
});
await browser.close();
console.log('Apresentacao gerada em', OUT, '—', totalPdf, 'paginas');
