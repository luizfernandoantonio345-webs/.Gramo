# .GRAMO — Roteiro de demonstração + manual rápido

> Guia para **apresentar o sistema ao gerente da GRAMO ENGENHARIA** e para o
> uso do dia a dia. A demo dura ~10 minutos e já vem com massa de dados
> realista (3 obras, 36 funcionários, ~1.300 marcações).

---

## 0. Antes de começar (deixar rodando)

Máquina de dev (3 terminais — detalhes em `RODAR-LOCAL.md`):

1. Banco: `node scripts/dev-local.mjs` (espere "Banco no ar")
2. API: `cd apps/api && node dist/src/main.js`
3. PWA: `cd apps/web && npx vite preview --host --port 5173`

Se for a primeira vez, popule a demo: `node scripts/seed-gramo.mjs` e depois
`node scripts/seed-demo.mjs`.

Abra **http://localhost:5173** (Ctrl+Shift+R na primeira vez).

**Credenciais da demonstração:**

| Perfil        | Acesso                                                       |
| ------------- | ------------------------------------------------------------ |
| Administração | `rh@gramoengenharia.com.br` · `GramoRH@2026`                 |
| Colaborador   | CPF `529.982.247-25` · `Gramo@12345` (José da Silva — Suape) |
| Telão da obra | `http://localhost:5173/?modo=presenca` (logado como admin)   |

> A câmera do reconhecimento facial exige **HTTPS** (no `localhost` funciona).
> Para testar no celular, use o link seguro (túnel "PORTS" do VS Code).

---

## 1. Roteiro de 10 minutos (o que clicar, na ordem)

**(1) Abertura — "visão do gestor" (2 min)**

- Entre como **Administração** → **Dashboard**.
- Aponte: **funcionários ativos**, **presença agora** (quem está trabalhando neste
  momento, por obra), **hora extra hoje** e o **comparativo entre obras**
  (o % fora da REGAP é o indicador de conformidade).
- Fala-chave: _"O senhor vê a operação inteira das obras em uma tela, em tempo real."_

**(2) Telão da obra (1 min)**

- Abra `?modo=presenca`. É a tela para uma TV no canteiro: quem está presente,
  por obra, atualizando sozinha.
- Fala-chave: _"Isso fica numa TV na portaria — o encarregado vê a presença do canteiro."_

**(3) Reconhecimento facial anti-fraude (3 min) — o ponto alto**

- Vá para **Colaborador** (José) → **Bater ponto** → **Ligar câmera**.
- Clique **Cadastrar meu rosto** → aparece o **termo LGPD** → **Autorizo** →
  clique de novo **Cadastrar meu rosto** (enquadre o rosto).
- Agora **bata o ponto** com a câmera ligada → **"✓ Rosto reconhecido"**.
- **O golpe:** peça para **outra pessoa** bater no lugar → **"Rosto não confere —
  irá p/ conferência"**. O ponto é registrado mesmo assim (nunca bloqueia) e vai
  para a fila do RH.
- Fala-chave: _"Isso mata o 'bater ponto pelo colega', que é o maior problema em obra."_

**(4) O RH tratando exceções (1,5 min)**

- Volte para **Administração** → **Gestão de ponto** → **Fila de exceções**:
  mostre a marcação que caiu como pendente (fora da área / rosto não confere) e
  **aprove/recuse** com justificativa.
- Fala-chave: _"Nada é apagado. O RH decide, e tudo fica registrado."_

**(5) Conformidade legal (1,5 min)**

- **Relatórios** → gere **AFD** e o **Pacote de fiscalização** (Portaria 671).
- Em **Funcionários** → abra um funcionário → **Espelho (PDF)** e o **Fechamento
  por obra (PDF)**.
- Fala-chave: _"Sai tudo no padrão da fiscalização do trabalho, com hash de
  integridade e assinatura do servidor."_

**(6) Fechamento (30 s)**

- Mostre **importar funcionários por CSV** (Funcionários) e o **banco de horas**
  por funcionário (extras, faltas, adicional noturno).

---

## 2. O que dizer sobre conformidade (argumentos)

- **Portaria 671/2021 (REP-P):** NSR sequencial por obra, AFD/AEJ, ponto
  **imutável** (o banco bloqueia alteração/exclusão — correção só via ajuste
  registrado).
- **CLT:** banco de horas (3 regimes), **adicional noturno** (hora reduzida +
  adicional), horas extras com limite legal.
- **LGPD:** biometria facial com **consentimento explícito** registrado; a
  imagem fica **cifrada** e o reconhecimento roda **no aparelho** do funcionário.
- **Anti-fraude:** geolocalização (REGAP) + reconhecimento facial + foto de
  auditoria em cada batida.

## 3. Seja honesto sobre o que é externo (não invente)

Se perguntarem, estes itens dependem de contratação/processo externo (e estão
previstos):

- **Assinatura ICP-Brasil** do AFD (hoje é assinatura própria de integridade).
- **Homologação gov.br / laudo INMETRO** do REP-P.
- **Liveness facial** (anti "foto de uma foto") e **push/WhatsApp**.

---

## 4. Manual rápido por tela (RH)

| Tela            | Para quê                                                       |
| --------------- | -------------------------------------------------------------- |
| Dashboard       | Visão executiva: presença, extras, comparativo de obras        |
| Gestão de ponto | Fila de exceções (aprovar/recusar) + áreas REGAP               |
| Funcionários    | Cadastro, **importar CSV**, foto de referência, banco de horas |
| Ausências       | Férias/afastamentos                                            |
| Comunicados     | Avisos aos funcionários                                        |
| Assinaturas     | Documentos para assinatura                                     |
| Relatórios      | AFD/AEJ, pacote de fiscalização, espelho e fechamento em PDF   |
| Auditoria       | Trilha de tudo que foi feito                                   |
| Configurações   | Empresa, obras (filiais), jornadas                             |
| Quiosque        | Tablet na portaria (bater ponto sem app)                       |

> Acesso do fornecedor (você) à administração da plataforma: `?plataforma=1` no
> fim da URL. A empresa não vê essa área.
