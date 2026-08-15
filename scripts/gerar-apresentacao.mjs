// Gera a apresentacao do sistema .GRAMO em PDF (docs/APRESENTACAO-SISTEMA.pdf).
// Uso: node scripts/gerar-apresentacao.mjs
// Sem dependencia externa nova: usa pdfkit (ja no node_modules).
import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'docs', 'APRESENTACAO-SISTEMA.pdf');

const ACCENT = '#0b5563'; // teal GRAMO
const ACCENT2 = '#12808f';
const TEXT = '#1a2230';
const MUTED = '#5a6572';
const LINE = '#d7dde3';

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 64, bottom: 64, left: 60, right: 60 },
  bufferPages: true,
  info: {
    Title: 'Apresentacao do Sistema .GRAMO',
    Author: 'GRAMO Engenharia',
    Subject: 'Ponto Eletronico Corporativo (REP-P) — guia de telas e uso',
  },
});
doc.pipe(fs.createWriteStream(OUT));

const W = doc.page.width;
const M = 60;
const CW = W - M * 2; // largura util

function garanteEspaco(min = 120) {
  if (doc.y > doc.page.height - 64 - min) doc.addPage();
}

function h1(txt) {
  doc.addPage();
  doc.rect(0, 0, W, 6).fill(ACCENT);
  doc.moveDown(0.5);
  doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(20).text(txt, M, 72);
  doc
    .moveTo(M, doc.y + 6)
    .lineTo(W - M, doc.y + 6)
    .strokeColor(LINE)
    .lineWidth(1)
    .stroke();
  doc.moveDown(1.2);
  doc.fillColor(TEXT);
}

function intro(txt) {
  doc.font('Helvetica').fontSize(11).fillColor(MUTED).text(txt, { width: CW, align: 'left' });
  doc.moveDown(0.8);
  doc.fillColor(TEXT);
}

// Bloco de uma tela: numero, nome, para que serve, como usar, nota.
function tela({ n, nome, tag, oque, como = [], nota }) {
  garanteEspaco(150);
  const y0 = doc.y;
  // selo com o numero
  doc
    .roundedRect(M, y0, 30, 30, 6)
    .fill(ACCENT);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(13).text(String(n), M, y0 + 8, {
    width: 30,
    align: 'center',
  });
  // titulo + tag
  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(14).text(nome, M + 42, y0 + 2, { width: CW - 42 });
  if (tag) {
    doc.fillColor(ACCENT2).font('Helvetica').fontSize(9).text(tag.toUpperCase(), M + 42, doc.y + 1, {
      width: CW - 42,
      characterSpacing: 0.5,
    });
  }
  doc.moveDown(0.6);
  doc.x = M + 42;
  doc.fillColor(TEXT).font('Helvetica').fontSize(10.5).text(oque, { width: CW - 42 });
  if (como.length) {
    doc.moveDown(0.3);
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(10).text('Como usar:', { width: CW - 42 });
    doc.fillColor(TEXT).font('Helvetica').fontSize(10.5);
    for (const passo of como) {
      doc.text(`•  ${passo}`, M + 52, doc.y, { width: CW - 52 });
    }
  }
  if (nota) {
    doc.moveDown(0.3);
    doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(9.5).text(`Nota: ${nota}`, M + 42, doc.y, {
      width: CW - 42,
    });
  }
  doc.x = M;
  doc.moveDown(0.9);
  doc
    .moveTo(M, doc.y)
    .lineTo(W - M, doc.y)
    .strokeColor(LINE)
    .lineWidth(0.5)
    .stroke();
  doc.moveDown(0.7);
  doc.fillColor(TEXT);
}

// ---------------------------------------------------------------- CAPA ---
doc.rect(0, 0, W, doc.page.height).fill(ACCENT);
doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(46).text('.GRAMO', M, 190);
doc.font('Helvetica').fontSize(18).fillColor('#d7eef0').text('Ponto Eletronico Corporativo', M, 250);
doc
  .font('Helvetica')
  .fontSize(12)
  .fillColor('#bfe3e7')
  .text('Apresentacao do sistema — guia de telas e de uso', M, 282);
doc
  .moveTo(M, 320)
  .lineTo(M + 180, 320)
  .strokeColor('#3f97a2')
  .lineWidth(2)
  .stroke();
doc
  .font('Helvetica')
  .fontSize(11)
  .fillColor('#eaf6f7')
  .text(
    'Conforme a Portaria MTP 671/2021 (REP-P).\nMulti-tenant, PWA offline-first, seguranca de dados por padrao.',
    M,
    340,
    { width: CW - 40, lineGap: 3 },
  );
doc
  .font('Helvetica')
  .fontSize(10)
  .fillColor('#bfe3e7')
  .text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}  ·  https://gramoengenharia.online`, M, doc.page.height - 90);

// -------------------------------------------------- COMO ESTA ORGANIZADO ---
h1('Sobre este documento');
intro(
  'Este guia apresenta todas as telas do sistema .GRAMO, explicando para que cada uma serve e como usa-la. ' +
    'Ele e organizado pelos tres perfis de acesso do sistema, mais o modo quiosque:',
);
doc.font('Helvetica').fontSize(11).fillColor(TEXT);
[
  ['Colaborador', 'aplicativo no celular (PWA) — quem bate o ponto.'],
  ['Administracao / RH', 'painel web — quem gere pessoas, ponto e documentos.'],
  ['Plataforma', 'operador do SaaS (super admin) — gestao de empresas.'],
  ['Quiosque', 'ponto compartilhado por dispositivo fixo na obra.'],
].forEach(([t, d]) => {
  doc.font('Helvetica-Bold').text(`• ${t}: `, { continued: true }).font('Helvetica').fillColor(MUTED).text(d);
  doc.fillColor(TEXT);
});
doc.moveDown(1);
intro(
  'Regra de ouro do sistema: o botao de bater ponto NUNCA bloqueia o colaborador. Fora da area ou do horario, ' +
    'o registro e aceito e marcado como pendente de validacao pelo RH — o ponto e sempre um documento imutavel.',
);

// ---------------------------------------------------------- COMO ACESSAR ---
h1('Como acessar');
intro('O sistema roda no navegador (e instalavel como aplicativo). Endereco unico para todos os perfis:');
doc.font('Helvetica-Bold').fontSize(13).fillColor(ACCENT).text('https://gramoengenharia.online', { align: 'left' });
doc.moveDown(0.8);
tela({
  n: 'i',
  nome: 'Instalar no celular (colaborador)',
  tag: 'PWA — parece um aplicativo',
  oque:
    'Abra o endereco no navegador do celular. No menu do navegador, escolha "Adicionar a tela inicial". ' +
    'O sistema passa a abrir como um aplicativo, funciona offline e nao da mais zoom acidental por toque.',
  como: [
    'Abra https://gramoengenharia.online no Chrome (Android) ou Safari (iPhone).',
    'Toque no menu e em "Adicionar a tela inicial".',
    'Abra pelo icone criado — pronto, e o app do colaborador.',
  ],
  nota: 'A camera (foto do ponto) so funciona em conexao segura (HTTPS) — por isso use sempre o endereco oficial.',
});

// -------------------------------------------------------- COLABORADOR ---
h1('Perfil Colaborador (app no celular)');
intro('Telas do dia a dia de quem bate o ponto. Simples, rapidas e funcionam mesmo sem internet no canteiro.');

tela({
  n: 1,
  nome: 'Login do Colaborador',
  tag: 'entrada no app',
  oque:
    'Porta de entrada do colaborador. O acesso e feito com CPF e senha. No primeiro acesso, a senha e definida ' +
    'a partir de um convite enviado pelo RH.',
  como: [
    'Digite o CPF (so numeros) e a senha.',
    'No primeiro acesso, siga o link de convite recebido para criar a senha.',
    'Esqueceu a senha? Use "recuperar" — chega um link por e-mail (se cadastrado).',
  ],
  nota: 'Apos 5 tentativas erradas a conta bloqueia por 15 minutos (protecao contra tentativa de invasao).',
});
tela({
  n: 2,
  nome: 'Bater Ponto',
  tag: 'tela principal',
  oque:
    'Registra entrada, saida e intervalos. Captura a localizacao (para conferir se esta na area da obra — a "REGAP") ' +
    'e uma foto no momento do registro. Funciona OFFLINE: sem sinal, o ponto fica guardado no aparelho e sincroniza ' +
    'sozinho quando a internet volta.',
  como: [
    'Toque no botao de registrar (entrada/saida/intervalo).',
    'Permita a localizacao e a camera quando solicitado.',
    'Pronto: o comprovante aparece com data, hora e numero de sequencia (NSR).',
  ],
  nota:
    'O botao NUNCA bloqueia. Fora da area ou do horario, o ponto e aceito como "pendente" e o RH valida depois. ' +
    'O registro e imutavel — correcoes viram um ajuste vinculado, nunca apagam o original.',
});
tela({
  n: 3,
  nome: 'Folha',
  tag: 'espelho de ponto',
  oque:
    'Mostra o espelho de ponto do colaborador: todas as marcacoes do periodo, com o status de cada uma (valida ou ' +
    'pendente). E onde o colaborador confere seus horarios.',
  como: [
    'Abra "Folha" para ver as marcacoes por dia.',
    'Toque em uma marcacao para ver detalhes.',
    'Discorda de algo? Use "contestar" para abrir uma contestacao ao RH.',
  ],
});
tela({
  n: 4,
  nome: 'Documentos',
  tag: 'arquivos do colaborador',
  oque:
    'Espaco para o colaborador enviar e visualizar documentos (ex.: atestados, comprovantes). Os arquivos sao ' +
    'cifrados (AES-256) — protegidos mesmo no armazenamento.',
  como: [
    'Toque em enviar e escolha o arquivo (ate 10 MB).',
    'Acompanhe o status (enviado / aprovado / rejeitado pelo RH).',
  ],
});
tela({
  n: 5,
  nome: 'Ferias e Afastamentos',
  tag: 'solicitacoes',
  oque:
    'Onde o colaborador solicita ferias ou registra afastamentos (licenca, atestado) e acompanha a aprovacao do RH. ' +
    'Ferias aprovadas que cobrem um dia evitam que o ponto daquele dia gere pendencia.',
  como: [
    'Toque em nova solicitacao e escolha o tipo (ferias, licenca, atestado...).',
    'Informe as datas e o motivo.',
    'Acompanhe o status: pendente, aprovada ou recusada.',
  ],
});
tela({
  n: 6,
  nome: 'Comunicados',
  tag: 'avisos da empresa',
  oque:
    'Mural de avisos que o RH publica para os colaboradores. Ao abrir, a leitura e registrada — o RH consegue medir ' +
    'quem ja leu.',
  como: ['Abra "Comunicados" para ver os avisos.', 'Toque em um comunicado para ler (a leitura e marcada automaticamente).'],
});

// -------------------------------------------------------- ADMIN / RH ---
h1('Perfil Administracao / RH (painel web)');
intro(
  'Painel completo para o RH e gestores. Recomendado usar no computador. O acesso exige 2FA (codigo de autenticacao) ' +
    'para maxima seguranca. Os gestores de filial so enxergam as obras sob sua responsabilidade.',
);

tela({
  n: 7,
  nome: 'Login do Administrador',
  tag: 'entrada no painel + 2FA',
  oque:
    'Acesso do RH e gestores. Alem de e-mail e senha, pede um codigo de verificacao em duas etapas (2FA) gerado por ' +
    'um aplicativo autenticador — camada extra que impede acesso mesmo se a senha vazar.',
  como: [
    'Informe e-mail e senha.',
    'Digite o codigo de 6 digitos do app autenticador (Google Authenticator, etc.).',
    'No primeiro acesso, o sistema mostra um QR Code para vincular o autenticador.',
  ],
});
tela({
  n: 8,
  nome: 'Dashboard',
  tag: 'visao executiva + indicadores de RH',
  oque:
    'A tela-resumo da operacao. Mostra KPIs do dia (funcionarios ativos, marcacoes, exceccoes pendentes), quem esta ' +
    'presente agora, alertas de hora extra, comparativo entre obras e o painel de INDICADORES DE RH do periodo: ' +
    'conformidade das marcacoes, atrasos, ausencias por tipo, rotatividade (turnover) e horas extras agregadas.',
  como: [
    'Abra o Dashboard logo apos entrar.',
    'Use o filtro de periodo nos Indicadores de RH (padrao: mes corrente).',
    'Acompanhe "Presenca agora" e "Hora extra hoje" em tempo quase real.',
  ],
  nota: 'E a tela ideal para o gestor abrir de manha e entender a operacao em 30 segundos.',
});
tela({
  n: 9,
  nome: 'Gestao de Ponto',
  tag: 'operacao diaria do RH',
  oque:
    'Onde o RH revisa as marcacoes, trata as pendencias (fora de area/horario, identidade) e aprova ou registra ' +
    'ajustes. Todo ajuste fica vinculado ao ponto original (que nunca e apagado).',
  como: [
    'Filtre por funcionario, obra ou periodo.',
    'Abra uma pendencia e aprove ou registre um ajuste justificado.',
    'O historico de quem aprovou o que fica registrado (auditoria).',
  ],
});
tela({
  n: 10,
  nome: 'Funcionarios',
  tag: 'cadastro e ciclo de vida',
  oque:
    'Cadastro e gestao de colaboradores: criar, editar, aprovar a foto de referencia, gerir documentos, importar em ' +
    'lote por planilha (CSV) e desligar. O desligamento e "soft delete" — nunca apaga (guarda legal de 5 anos).',
  como: [
    'Cadastre um funcionario (CPF unico) ou importe uma planilha CSV.',
    'Aprove a foto de referencia para liberar o reconhecimento.',
    'Para desligar, use "desativar" — os dados sao preservados por lei.',
  ],
});
tela({
  n: 11,
  nome: 'Assinaturas',
  tag: 'documentos para assinar',
  oque:
    'Envio de documentos para o colaborador assinar digitalmente (individual ou em lote). A assinatura gera um ' +
    'registro imutavel com carimbo de integridade (hash) e assinatura do servidor.',
  como: [
    'Selecione o documento e os destinatarios.',
    'Envie (individual ou em lote).',
    'Acompanhe quem ja assinou, recusou ou esta pendente.',
  ],
});
tela({
  n: 12,
  nome: 'Ausencias',
  tag: 'aprovacao de ferias/afastamentos',
  oque:
    'Onde o RH decide as solicitacoes de ferias e afastamentos enviadas pelos colaboradores, com visao de calendario ' +
    'para planejar a cobertura das equipes.',
  como: [
    'Veja as solicitacoes pendentes.',
    'Aprove ou recuse (com justificativa).',
    'Use o calendario para enxergar sobreposicoes na equipe.',
  ],
});
tela({
  n: 13,
  nome: 'Comunicados (RH)',
  tag: 'publicar avisos',
  oque:
    'Onde o RH publica comunicados e escolhe o publico-alvo (todos, uma obra, um cargo ou um funcionario). Mostra a ' +
    'taxa de leitura de cada aviso.',
  como: [
    'Crie um comunicado (titulo e mensagem).',
    'Escolha o publico-alvo.',
    'Publique e acompanhe quantos ja leram.',
  ],
});
tela({
  n: 14,
  nome: 'Relatorios',
  tag: 'exportacoes e conferencia',
  oque:
    'Relatorios operacionais do ponto para conferencia e fechamento. Inclui as exportacoes legais (AFD/AEJ) exigidas ' +
    'pela fiscalizacao do trabalho.',
  como: ['Escolha o relatorio e o periodo.', 'Gere e exporte para conferencia ou entrega a fiscalizacao.'],
});
tela({
  n: 15,
  nome: 'Auditoria',
  tag: 'trilha de confianca',
  oque:
    'Registro de tudo que acontece de sensivel: acessos, aprovacoes, ajustes. E a "trilha de confianca" que prova, ' +
    'para auditoria interna ou externa, quem fez o que e quando.',
  como: ['Filtre por tipo de evento, usuario ou periodo.', 'Use para investigar ou comprovar acoes.'],
});
tela({
  n: 16,
  nome: 'Configuracoes',
  tag: 'jornadas, feriados, tolerancias',
  oque:
    'Parametros que governam a validacao do ponto: jornadas (horarios, dias, carga diaria, regime de horas), feriados ' +
    'e tolerancias. E aqui que se define, por exemplo, o horario de cada equipe.',
  como: [
    'Cadastre as jornadas (entrada/saida, dias da semana, tolerancia).',
    'Cadastre os feriados (gerais ou por obra).',
    'Vincule cada funcionario a sua jornada na tela de Funcionarios.',
  ],
  nota: 'Definir as jornadas corretamente e o que torna os indicadores de atraso e hora extra precisos.',
});
tela({
  n: 17,
  nome: 'Integracoes',
  tag: 'API e folha/eSocial',
  oque:
    'Geracao de chaves de API para integrar com outros sistemas (folha de pagamento, eSocial) e configuracao dessas ' +
    'integracoes. A chave e mostrada uma unica vez, por seguranca.',
  como: [
    'Gere uma chave de API e guarde-a com seguranca (aparece so uma vez).',
    'Configure a integracao desejada (folha/eSocial).',
  ],
});
tela({
  n: 18,
  nome: 'Quiosque (gestao)',
  tag: 'dispositivos fixos',
  oque:
    'Gerencia os dispositivos de quiosque — tablets/computadores fixos na obra usados como ponto compartilhado. ' +
    'Cada dispositivo tem sua propria credencial.',
  como: ['Cadastre um dispositivo e gere sua credencial.', 'Instale o modo quiosque no aparelho (ver tela 23).'],
});
tela({
  n: 19,
  nome: 'Telao de Presenca',
  tag: 'painel para TV',
  oque:
    'Um "telao" para exibir em uma TV ou monitor na obra, mostrando quem esta presente no momento, atualizando ' +
    'sozinho. Otimo para portaria e seguranca.',
  como: ['Abra o botao "Telao" no painel (abre em nova aba).', 'Coloque em tela cheia no monitor da obra.'],
});
tela({
  n: 20,
  nome: 'Mapa de Obras',
  tag: 'area de ponto (REGAP)',
  oque:
    'Define, no mapa, a area valida para bater ponto de cada obra (a "REGAP" — geofence). Marcacoes fora dessa area ' +
    'entram como pendentes para o RH avaliar.',
  como: [
    'Abra o mapa e localize a obra.',
    'Clique no mapa para posicionar o centro da area.',
    'Ajuste o raio e salve.',
  ],
});

// -------------------------------------------------------- PLATAFORMA ---
h1('Perfil Plataforma (operador do SaaS)');
intro(
  'Perfil do fornecedor do sistema (super administrador), acima das empresas. Por seguranca fica OCULTO para o ' +
    'cliente e NAO acessa dados operacionais das empresas — apenas metricas e gestao comercial.',
);
tela({
  n: 21,
  nome: 'Login da Plataforma',
  tag: 'super admin (oculto)',
  oque:
    'Acesso do operador do SaaS, com 2FA. So aparece por um endereco especial — o cliente nem sabe que existe. Usa ' +
    'uma identidade de banco de dados separada, sem permissao sobre os dados operacionais.',
  como: ['Acesse pelo endereco reservado do fornecedor.', 'Entre com credenciais de super admin + 2FA.'],
});
tela({
  n: 22,
  nome: 'Painel da Plataforma',
  tag: 'gestao de empresas',
  oque:
    'Gestao comercial do SaaS: empresas clientes, planos, faturas e metricas de uso. Nao ve pontos, funcionarios nem ' +
    'documentos das empresas — apenas numeros agregados.',
  como: ['Cadastre/gerencie empresas e planos.', 'Acompanhe faturas e metricas de uso.'],
});

// -------------------------------------------------------- QUIOSQUE ---
h1('Modo Quiosque');
intro('Ponto compartilhado por dispositivo fixo na obra — util para quem nao usa o proprio celular.');
tela({
  n: 23,
  nome: 'Tela de Quiosque',
  tag: 'ponto compartilhado',
  oque:
    'Um dispositivo unico (tablet/PC) na obra onde varios colaboradores batem o ponto, identificando-se um a um. O ' +
    'dispositivo se autentica por sua propria credencial (nao por pessoa).',
  como: [
    'Abra o sistema em modo quiosque no dispositivo (endereco com "?modo=quiosque").',
    'Vincule o dispositivo com a credencial gerada na tela 18.',
    'Cada colaborador se identifica e registra o ponto.',
  ],
});

// -------------------------------------------------- SEGURANCA / FIM ---
h1('Seguranca e conformidade (resumo)');
intro('O .GRAMO foi construido com seguranca e conformidade legal por padrao. Em resumo:');
doc.font('Helvetica').fontSize(10.5).fillColor(TEXT);
[
  ['Ponto imutavel', 'todo registro e permanente; correcao vira ajuste vinculado. Numero de sequencia (NSR) por obra.'],
  ['Conformidade legal', 'aderente a Portaria 671/2021; exportacoes AFD/AEJ e comprovante assinado digitalmente.'],
  ['Isolamento entre empresas', 'cada empresa so ve os proprios dados, garantido no banco de dados (RLS), nao so no codigo.'],
  ['Dados sensiveis cifrados', 'fotos e documentos protegidos com AES-256; senhas com algoritmo forte (Argon2).'],
  ['2FA para administradores', 'segunda etapa de verificacao no acesso do RH e da plataforma.'],
  ['LGPD', 'consentimento separado para dado biometrico; nada e apagado (guarda legal de 5 anos).'],
  ['Operacao vigiada', 'backup diario verificado e monitoramento de saude 24/7 do ambiente de producao.'],
].forEach(([t, d]) => {
  garanteEspaco(60);
  doc.font('Helvetica-Bold').fillColor(ACCENT).text(`${t}  `, { continued: true });
  doc.font('Helvetica').fillColor(TEXT).text(d);
  doc.moveDown(0.4);
});
doc.moveDown(1);
intro(
  'Este documento e uma visao funcional das telas. Detalhes tecnicos, inventario completo e roadmap estao no ' +
    'documento de analise do sistema (docs/ANALISE-SISTEMA.md).',
);

// ------------------------------------------------ RODAPE / PAGINAS ---
const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  if (i === 0) continue; // capa sem rodape
  const y = doc.page.height - 42;
  doc
    .moveTo(M, y)
    .lineTo(W - M, y)
    .strokeColor(LINE)
    .lineWidth(0.5)
    .stroke();
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
  doc.text('.GRAMO — Ponto Eletronico Corporativo', M, y + 6, { width: CW / 2, align: 'left' });
  doc.text(`Pagina ${i} de ${range.count - 1}`, M + CW / 2, y + 6, { width: CW / 2, align: 'right' });
}

doc.end();
console.log(`PDF gerado em ${OUT}`);
