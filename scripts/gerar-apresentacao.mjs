// Gera a APRESENTACAO do sistema .GRAMO em PDF (docs/APRESENTACAO-SISTEMA.pdf).
// Uma tela por pagina (screenshot real de docs/telas/) + guia de estudo no fim.
// Uso: node scripts/gerar-apresentacao.mjs   (rode a captura antes: capturar-telas.mjs)
import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TELAS = path.join(__dirname, '..', 'docs', 'telas');
const OUT = path.join(__dirname, '..', 'docs', 'APRESENTACAO-SISTEMA.pdf');

const ACCENT = '#0b5563';
const ACCENT2 = '#12808f';
const TEXT = '#1a2230';
const MUTED = '#5a6572';
const PANEL = '#eef2f4';
const LINE = '#d7dde3';

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 60, bottom: 60, left: 54, right: 54 },
  bufferPages: true,
  info: { Title: 'Apresentacao do Sistema .GRAMO', Author: 'GRAMO Engenharia' },
});
doc.pipe(fs.createWriteStream(OUT));
const W = doc.page.width;
const H = doc.page.height;
const M = 54;
const CW = W - M * 2;

// Fonte com acentuacao (Arial do Windows); fallback para Helvetica.
let REG = 'Helvetica';
let BOLD = 'Helvetica-Bold';
try {
  const fd = 'C:\\Windows\\Fonts';
  if (fs.existsSync(path.join(fd, 'arial.ttf'))) {
    doc.registerFont('R', path.join(fd, 'arial.ttf'));
    REG = 'R';
  }
  if (fs.existsSync(path.join(fd, 'arialbd.ttf'))) {
    doc.registerFont('B', path.join(fd, 'arialbd.ttf'));
    BOLD = 'B';
  }
} catch {
  /* usa Helvetica */
}

const TELAS_IMG = [
  { g: 'Colaborador', img: '01-colaborador-login.png', nome: 'Login do Colaborador',
    cap: 'Entrada do colaborador no app, com CPF e senha.',
    oque: 'Porta de entrada do colaborador (CPF + senha). No primeiro acesso, a senha e criada a partir de um convite do RH.',
    como: ['Digite o CPF e a senha.', 'Primeiro acesso: use o codigo de convite do RH.', 'Esqueceu a senha? Recupere por e-mail.'],
    nota: 'Apos 5 erros a conta bloqueia por 15 minutos.' },
  { g: 'Colaborador', img: '02-colaborador-bater-ponto.png', nome: 'Bater Ponto',
    cap: 'Registro de entrada/saida com localizacao e foto. Funciona offline.',
    oque: 'Tela principal do colaborador. Registra entrada, saida e intervalos, com localizacao (area da obra/REGAP) e foto. Funciona OFFLINE e sincroniza sozinho depois.',
    como: ['Toque no botao de registrar.', 'Permita localizacao e camera.', 'O comprovante mostra data, hora e o NSR.'],
    nota: 'O botao NUNCA bloqueia: fora da area/horario, entra como pendente. O ponto e imutavel.' },
  { g: 'Colaborador', img: '03-colaborador-folha.png', nome: 'Folha',
    cap: 'Espelho de ponto: marcacoes do periodo e seus status.',
    oque: 'Mostra o espelho de ponto do colaborador, com o status de cada marcacao (valida ou pendente).',
    como: ['Veja as marcacoes por dia.', 'Toque em uma para detalhes.', 'Discorda? Use "contestar".'] },
  { g: 'Colaborador', img: '04-colaborador-documentos.png', nome: 'Documentos',
    cap: 'Envio e consulta de documentos (cifrados).',
    oque: 'Espaco para enviar e ver documentos (ex.: atestados). Os arquivos sao cifrados (AES-256).',
    como: ['Envie o arquivo (ate 10 MB).', 'Acompanhe o status (enviado/aprovado/rejeitado).'] },
  { g: 'Colaborador', img: '05-colaborador-ferias.png', nome: 'Ferias e Afastamentos',
    cap: 'Solicitacao de ferias/afastamentos e acompanhamento.',
    oque: 'Onde o colaborador solicita ferias ou registra afastamentos e acompanha a aprovacao do RH.',
    como: ['Nova solicitacao: escolha o tipo.', 'Informe datas e motivo.', 'Acompanhe o status.'],
    nota: 'Ferias aprovadas evitam que o ponto do dia gere pendencia.' },
  { g: 'Colaborador', img: '06-colaborador-comunicados.png', nome: 'Comunicados',
    cap: 'Mural de avisos da empresa; a leitura e registrada.',
    oque: 'Avisos que o RH publica. Ao abrir, a leitura e registrada (o RH mede quem leu).',
    como: ['Abra a lista de comunicados.', 'Toque para ler (marca a leitura).'] },

  { g: 'Administracao / RH', img: '07-admin-login.png', nome: 'Login do Administrador',
    cap: 'Acesso do RH/gestor, com verificacao em duas etapas (2FA).',
    oque: 'Acesso do RH e gestores: e-mail + senha + codigo 2FA de um app autenticador (camada extra de seguranca).',
    como: ['Informe e-mail e senha.', 'Digite o codigo de 6 digitos do autenticador.', '1o acesso: leia o QR Code para vincular.'] },
  { g: 'Administracao / RH', img: '08-admin-dashboard.png', nome: 'Dashboard',
    cap: 'Visao executiva: KPIs, presenca ao vivo e Indicadores de RH.',
    oque: 'Tela-resumo da operacao: KPIs do dia, presenca agora, alertas de hora extra, comparativo entre obras e os Indicadores de RH (conformidade, atrasos, ausencias, rotatividade e horas extras).',
    como: ['Abra o Dashboard ao entrar.', 'Use o filtro de periodo nos Indicadores de RH.', 'Acompanhe presenca e extras em tempo quase real.'],
    nota: 'Ideal para o gestor entender a operacao em 30 segundos.' },
  { g: 'Administracao / RH', img: '09-admin-gestao-ponto.png', nome: 'Gestao de Ponto',
    cap: 'Revisao de marcacoes, tratamento de pendencias e ajustes.',
    oque: 'Onde o RH revisa marcacoes, trata pendencias (fora de area/horario) e registra ajustes vinculados (nunca apaga o original).',
    como: ['Filtre por funcionario/obra/periodo.', 'Abra a pendencia e aprove ou ajuste.', 'Tudo fica auditado.'] },
  { g: 'Administracao / RH', img: '10-admin-funcionarios.png', nome: 'Funcionarios',
    cap: 'Cadastro, foto, documentos, importacao CSV e desligamento.',
    oque: 'Gestao de colaboradores: criar/editar, aprovar foto, gerir documentos, importar em lote (CSV) e desligar (soft delete, guarda de 5 anos).',
    como: ['Cadastre (CPF unico) ou importe CSV.', 'Aprove a foto de referencia.', 'Desligar = desativar (preserva os dados).'] },
  { g: 'Administracao / RH', img: '11-admin-ausencias.png', nome: 'Ausencias',
    cap: 'Aprovacao de ferias/afastamentos, com calendario.',
    oque: 'Onde o RH decide ferias e afastamentos, com visao de calendario para planejar a equipe.',
    como: ['Veja as pendencias.', 'Aprove ou recuse com justificativa.', 'Use o calendario para sobreposicoes.'] },
  { g: 'Administracao / RH', img: '12-admin-comunicados.png', nome: 'Comunicados (RH)',
    cap: 'Publicacao de avisos por publico-alvo e taxa de leitura.',
    oque: 'Publica comunicados escolhendo o publico (todos, obra, cargo ou pessoa) e mostra a taxa de leitura.',
    como: ['Crie o comunicado.', 'Escolha o publico-alvo.', 'Publique e acompanhe as leituras.'] },
  { g: 'Administracao / RH', img: '13-admin-assinaturas.png', nome: 'Assinaturas',
    cap: 'Envio de documentos para assinatura digital.',
    oque: 'Envia documentos para o colaborador assinar (individual ou em lote), com registro imutavel e carimbo de integridade.',
    como: ['Selecione documento e destinatarios.', 'Envie.', 'Acompanhe assinados/recusados/pendentes.'] },
  { g: 'Administracao / RH', img: '14-admin-relatorios.png', nome: 'Relatorios',
    cap: 'Relatorios operacionais e exportacoes legais (AFD/AEJ).',
    oque: 'Relatorios para conferencia e fechamento, incluindo as exportacoes legais exigidas pela fiscalizacao (AFD/AEJ).',
    como: ['Escolha relatorio e periodo.', 'Gere e exporte.'] },
  { g: 'Administracao / RH', img: '15-admin-auditoria.png', nome: 'Auditoria',
    cap: 'Trilha de confianca: acessos, aprovacoes e ajustes.',
    oque: 'Registro de tudo que e sensivel (acessos, aprovacoes, ajustes) — prova, para auditoria, quem fez o que e quando.',
    como: ['Filtre por evento/usuario/periodo.', 'Use para investigar ou comprovar.'] },
  { g: 'Administracao / RH', img: '16-admin-configuracoes.png', nome: 'Configuracoes',
    cap: 'Jornadas, feriados e tolerancias que regem o ponto.',
    oque: 'Parametros que governam a validacao do ponto: jornadas (horarios, dias, carga), feriados e tolerancias.',
    como: ['Cadastre jornadas.', 'Cadastre feriados.', 'Vincule a jornada a cada funcionario.'],
    nota: 'Jornadas corretas tornam atrasos e horas extras precisos.' },
  { g: 'Administracao / RH', img: '17-admin-integracoes.png', nome: 'Integracoes',
    cap: 'Chaves de API e integracao com folha/eSocial.',
    oque: 'Gera chaves de API (mostradas uma unica vez) e configura integracoes com folha de pagamento e eSocial.',
    como: ['Gere a chave e guarde-a.', 'Configure a integracao.'] },
  { g: 'Administracao / RH', img: '18-admin-quiosque.png', nome: 'Quiosque (gestao)',
    cap: 'Cadastro dos dispositivos de ponto compartilhado.',
    oque: 'Gerencia os dispositivos de quiosque (tablets/PCs fixos na obra), cada um com sua credencial.',
    como: ['Cadastre o dispositivo e gere a credencial.', 'Instale o modo quiosque no aparelho.'] },
];

const TELAS_EXTRA = [
  { g: 'Administracao / RH', nome: 'Telao de Presenca',
    oque: 'Painel para exibir numa TV/monitor da obra mostrando quem esta presente agora, atualizando sozinho.',
    como: ['Abra o botao "Telao" no painel.', 'Coloque em tela cheia no monitor.'] },
  { g: 'Administracao / RH', nome: 'Mapa de Obras',
    oque: 'Define no mapa a area valida para bater ponto de cada obra (REGAP/geofence).',
    como: ['Localize a obra no mapa.', 'Clique para posicionar o centro.', 'Ajuste o raio e salve.'] },
  { g: 'Plataforma (operador do SaaS)', nome: 'Login da Plataforma',
    oque: 'Acesso do super administrador (fornecedor), com 2FA. Fica oculto do cliente e nao acessa dados operacionais.',
    como: ['Acesse pelo endereco reservado.', 'Entre com credenciais de super admin + 2FA.'] },
  { g: 'Plataforma (operador do SaaS)', nome: 'Painel da Plataforma',
    oque: 'Gestao comercial do SaaS: empresas, planos, faturas e metricas de uso (nunca ve dados operacionais das empresas).',
    como: ['Gerencie empresas e planos.', 'Acompanhe faturas e metricas.'] },
  { g: 'Quiosque', nome: 'Tela de Quiosque',
    oque: 'Dispositivo fixo na obra onde varios colaboradores batem ponto, identificando-se um a um.',
    como: ['Abra em modo quiosque (?modo=quiosque).', 'Vincule com a credencial do dispositivo.', 'Cada colaborador se identifica e registra.'] },
];

// -------------------------------------------------------------- CAPA ---
doc.rect(0, 0, W, H).fill(ACCENT);
doc.fillColor('#ffffff').font(BOLD).fontSize(52).text('.GRAMO', M, 200);
doc.font(REG).fontSize(19).fillColor('#d7eef0').text('Ponto Eletronico Corporativo', M, 266);
doc.font(BOLD).fontSize(13).fillColor('#eaf6f7').text('Apresentacao do sistema', M, 300);
doc.moveTo(M, 334).lineTo(M + 170, 334).lineWidth(2).strokeColor('#3f97a2').stroke();
doc.font(REG).fontSize(11).fillColor('#cdeaed').text(
  'Guia visual das telas + roteiro de estudo para apresentar o sistema.\nConforme a Portaria MTP 671/2021 (REP-P).',
  M, 352, { width: CW - 30, lineGap: 4 },
);
doc.font(REG).fontSize(10).fillColor('#bfe3e7').text(
  `Gerado em ${new Date().toLocaleDateString('pt-BR')}  ·  https://gramoengenharia.online`,
  M, H - 84,
);

// --------------------------------------------------- COMO APRESENTAR ---
doc.addPage();
doc.rect(0, 0, W, 6).fill(ACCENT);
doc.fillColor(ACCENT).font(BOLD).fontSize(22).text('Como apresentar', M, 66);
doc.moveDown(0.8);
doc.fillColor(TEXT).font(REG).fontSize(11.5).text(
  'Este material tem duas partes: primeiro as TELAS (uma por pagina, com a imagem real e uma frase do que faz) — use para mostrar o sistema; e no FINAL um GUIA DE ESTUDO com o passo a passo de cada tela — use para se preparar.',
  { width: CW, lineGap: 3 },
);
doc.moveDown(1);
doc.fillColor(ACCENT).font(BOLD).fontSize(13).text('3 mensagens-chave para o chefe');
doc.moveDown(0.4);
[
  ['E confiavel e legal', 'segue a Portaria 671/2021, com ponto imutavel, exportacoes fiscais e assinatura digital.'],
  ['E seguro', 'dados isolados por empresa no banco, biometria/documentos cifrados, 2FA e trilha de auditoria.'],
  ['Da visao de gestao', 'dashboard com presenca ao vivo e indicadores de RH (atrasos, ausencias, turnover, horas extras).'],
].forEach(([t, d]) => {
  doc.font(BOLD).fillColor(ACCENT).fontSize(11.5).text('• ' + t + ': ', { continued: true });
  doc.font(REG).fillColor(TEXT).text(d);
  doc.moveDown(0.3);
});
doc.moveDown(0.8);
doc.fillColor(MUTED).font(REG).fontSize(10.5).text(
  'Regra de ouro para citar: o botao de bater ponto NUNCA bloqueia o colaborador — fora da area/horario o registro e aceito como pendente e o RH valida depois.',
  { width: CW, lineGap: 3 },
);

// ------------------------------------------------- PAGINAS DAS TELAS ---
let grupoAtual = '';
let numero = 0;
for (const s of TELAS_IMG) {
  if (s.g !== grupoAtual) {
    grupoAtual = s.g;
    doc.addPage();
    doc.rect(0, H / 2 - 70, W, 140).fill(ACCENT);
    doc.fillColor('#ffffff').font(BOLD).fontSize(26).text(grupoAtual, M, H / 2 - 30, {
      width: CW,
      align: 'center',
    });
  }
  numero++;
  doc.addPage();
  doc.rect(0, 0, W, 6).fill(ACCENT);
  doc.fillColor(ACCENT2).font(BOLD).fontSize(9).text(`${grupoAtual.toUpperCase()}  ·  TELA ${numero}`, M, 40, {
    characterSpacing: 0.5,
  });
  doc.fillColor(TEXT).font(BOLD).fontSize(19).text(s.nome, M, 54, { width: CW });

  const top = 96;
  const stageH = 600;
  doc.roundedRect(M, top, CW, stageH, 10).fill(PANEL);
  const pad = 16;
  const imgPath = path.join(TELAS, s.img);
  if (fs.existsSync(imgPath)) {
    doc.image(imgPath, M + pad, top + pad, {
      fit: [CW - 2 * pad, stageH - 2 * pad],
      align: 'center',
      valign: 'center',
    });
  } else {
    doc.fillColor(MUTED).font(REG).fontSize(12).text('(captura pendente)', M, top + stageH / 2 - 6, {
      width: CW,
      align: 'center',
    });
  }
  doc.fillColor(TEXT).font(REG).fontSize(11.5).text(s.cap, M, top + stageH + 16, { width: CW });
}

// -------------------------------------------- GUIA DE ESTUDO (FINAL) ---
doc.addPage();
doc.rect(0, 0, W, 6).fill(ACCENT);
doc.fillColor(ACCENT).font(BOLD).fontSize(22).text('Guia de estudo', M, 66);
doc.fillColor(MUTED).font(REG).fontSize(11).text(
  'Passo a passo de cada tela — para voce se preparar antes de apresentar.',
  M, doc.y + 4, { width: CW },
);
doc.moveDown(1);

function blocoEstudo(s, idx) {
  if (doc.y > H - 150) doc.addPage();
  doc.fillColor(ACCENT2).font(BOLD).fontSize(9).text(s.g.toUpperCase(), { characterSpacing: 0.4 });
  doc.fillColor(TEXT).font(BOLD).fontSize(13).text(`${idx}. ${s.nome}`);
  doc.moveDown(0.2);
  doc.fillColor(TEXT).font(REG).fontSize(10.5).text(s.oque, { width: CW });
  if (s.como?.length) {
    doc.moveDown(0.2);
    doc.fillColor(ACCENT).font(BOLD).fontSize(10).text('Como usar:');
    doc.fillColor(TEXT).font(REG).fontSize(10.5);
    for (const p of s.como) doc.text(`•  ${p}`, M + 10, doc.y, { width: CW - 10 });
  }
  if (s.nota) {
    doc.moveDown(0.2);
    doc.fillColor(MUTED).font(REG).fontSize(9.5).text(`Nota: ${s.nota}`, { width: CW });
  }
  doc.moveDown(0.5);
  doc.moveTo(M, doc.y).lineTo(W - M, doc.y).lineWidth(0.5).strokeColor(LINE).stroke();
  doc.moveDown(0.6);
}

let idx = 0;
for (const s of [...TELAS_IMG, ...TELAS_EXTRA]) {
  idx++;
  blocoEstudo(s, idx);
}

// ------------------------------------------------------ RODAPE/PAGINAS ---
const range = doc.bufferedPageRange();
for (let i = range.start + 1; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  // Zera a margem inferior desta pagina: sem isto, escrever no rodape (abaixo da
  // margem) faz o pdfkit ADICIONAR uma pagina por rodape (explosao de paginas).
  doc.page.margins.bottom = 0;
  const y = H - 40;
  doc.font(REG).fontSize(8.5).fillColor(MUTED);
  doc.text('.GRAMO — Ponto Eletronico Corporativo', M, y, { width: CW / 2, lineBreak: false });
  doc.text(`${i} / ${range.count - 1}`, M + CW / 2, y, {
    width: CW / 2,
    align: 'right',
    lineBreak: false,
  });
}

doc.end();
console.log('Apresentacao gerada em', OUT);
