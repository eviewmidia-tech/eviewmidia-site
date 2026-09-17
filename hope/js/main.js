// =========================================================
// Hope Home Care
// CONFIGURAÇÃO: tudo o que a equipe pode querer mudar fica aqui.
// =========================================================
const CONFIG = {
  // 55 + DDD + número, sem espaços
  whatsapp: "5519995581107",

  agenda: {
    // quantos dias disponíveis aparecem para escolha
    diasExibidos: 14,
    // 1 = a partir de amanhã
    antecedenciaDias: 1,
    // 0 = domingo, 1 = segunda ... 6 = sábado
    diasDaSemana: [1, 2, 3, 4, 5, 6],
    // datas sem atendimento (feriados), formato AAAA-MM-DD
    datasBloqueadas: ["2026-10-12", "2026-11-02", "2026-11-15", "2026-11-20", "2026-12-25"],
    periodos: [
      { id: "manha", nome: "Manhã", faixa: "8h às 12h", inicio: 8, fim: 12 },
      { id: "tarde", nome: "Tarde", faixa: "13h às 18h", inicio: 13, fim: 18 },
    ],
  },
};

// ---------------------------------------------------------
// Utilidades
// ---------------------------------------------------------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const whatsLink = (msg) => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;

const openExternal = (url) => {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
};

// Envia eventos para Google Analytics / Tag Manager / Meta Pixel, se instalados
const track = (event, params = {}) => {
  try {
    window.dataLayer?.push({ event, ...params });
    window.gtag?.("event", event, params);
    window.fbq?.("trackCustom", event, params);
  } catch (_) { /* sem rastreamento instalado */ }
};

// ---------------------------------------------------------
// Links de WhatsApp com mensagem pronta
// ---------------------------------------------------------
$$("[data-whats]").forEach((el) => {
  el.href = whatsLink(el.dataset.whats);
  el.target = "_blank";
  el.rel = "noopener";
  el.addEventListener("click", () => track("clique_whatsapp", { origem: el.dataset.origem || "site" }));
});
$$("[data-track]").forEach((el) => el.addEventListener("click", () => track(el.dataset.track)));

$("#ano").textContent = new Date().getFullYear();

// ---------------------------------------------------------
// Header, menu mobile, animações, link ativo
// ---------------------------------------------------------
const header = $(".header");
const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

const burger = $(".burger");
const nav = $("#nav");
const setMenu = (open) => {
  burger.setAttribute("aria-expanded", String(open));
  burger.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
  nav.classList.toggle("is-open", open);
};
burger.addEventListener("click", () => setMenu(burger.getAttribute("aria-expanded") !== "true"));
$$("a", nav).forEach((a) => a.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));

const revealed = $$(".reveal");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      io.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  revealed.forEach((el) => io.observe(el));

  const links = $$('a[href^="#"]:not(.btn)', nav);
  const sections = links.map((a) => $(a.getAttribute("href"))).filter(Boolean);
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${entry.target.id}`));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach((s) => spy.observe(s));
} else {
  revealed.forEach((el) => el.classList.add("is-in"));
}

// ---------------------------------------------------------
// Serviços: filtro por abas
// ---------------------------------------------------------
const tabs = $$(".tabs [data-filter]");
tabs.forEach((tab) => tab.addEventListener("click", () => {
  const filter = tab.dataset.filter;
  tabs.forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
  $$(".service").forEach((card) => {
    const show = filter === "todos" || card.dataset.cat === filter;
    card.classList.toggle("is-hidden", !show);
    if (show) {
      card.classList.add("is-in");
      card.classList.remove("pop");
      void card.offsetWidth;
      card.classList.add("pop");
    }
  });
}));

// ---------------------------------------------------------
// Atendimento prioritário (urgência)
// ---------------------------------------------------------
const urgent = $("#urgent");
const urgentForm = $("#urgent-form");

$$("[data-open-urgent]").forEach((btn) => btn.addEventListener("click", () => {
  setMenu(false);
  if (typeof urgent.showModal === "function") urgent.showModal();
  else urgent.setAttribute("open", "");
  track("abrir_urgencia", { origem: btn.dataset.origem || "site" });
}));

urgent.addEventListener("click", (e) => {
  if (e.target === urgent) urgent.close();
});

$("[data-urgent-send]").addEventListener("click", () => {
  const sit = urgentForm.querySelector('input[name="u_sit"]:checked');
  const cidade = urgentForm.elements.u_cidade;
  const nome = urgentForm.elements.u_nome.value.trim();
  const ok = Boolean(sit && cidade.value);
  cidade.classList.toggle("is-invalid", !cidade.value);
  $(".form__error", urgentForm).hidden = ok;
  if (!ok) return;

  const linhas = [
    "🔴 *ATENDIMENTO PRIORITÁRIO*",
    "",
    `*Situação:* ${sit.value}`,
    `*Cidade:* ${cidade.value}`,
  ];
  if (nome) linhas.push(`*Nome:* ${nome}`);
  linhas.push("", "Preciso de ajuda o quanto antes.");

  track("envio_urgencia", { situacao: sit.value, cidade: cidade.value });
  openExternal(whatsLink(linhas.join("\n")));
});

// ---------------------------------------------------------
// Plano de cuidado (questionário)
// ---------------------------------------------------------
const SERVICOS = {
  posop: { nome: "Cuidados pós-operatórios", icone: "s-posop", porque: "Sinais vitais, curativos e apoio na recuperação" },
  enfermagem: { nome: "Enfermagem", icone: "s-enfermagem", porque: "Procedimentos, medicação e monitoramento com segurança" },
  fisio: { nome: "Fisioterapia", icone: "s-fisio", porque: "Recuperar mobilidade, força e prevenir quedas" },
  cuidador: { nome: "Cuidador de idosos", icone: "s-cuidador", porque: "Apoio no banho, alimentação, rotina e companhia" },
  geriatria: { nome: "Cuidados geriátricos", icone: "s-geriatria", porque: "Acompanhamento da saúde e dos remédios do idoso" },
  acomp: { nome: "Acompanhamento de pacientes", icone: "s-acomp", porque: "Controle da doença, consultas e exames em dia" },
  fono: { nome: "Fonoaudiologia", icone: "s-fono", porque: "Engolir com segurança e melhorar a comunicação" },
  nutri: { nome: "Nutrição", icone: "s-nutri", porque: "Alimentação adequada para recuperar e manter a saúde" },
  psico: { nome: "Psicologia", icone: "s-psico", porque: "Apoio emocional ao paciente e à família" },
};
const NA_UNIDADE = ["fisio", "nutri", "psico"];
const POR_SITUACAO = {
  alta: ["posop", "enfermagem", "fisio"],
  rotina: ["cuidador", "geriatria"],
  mobilidade: ["fisio"],
  cronica: ["acomp", "enfermagem"],
  deglutir: ["fono"],
  alimentacao: ["nutri"],
  emocional: ["psico"],
};
const AUTONOMIA = {
  1: { texto: "independente", extra: [] },
  2: { texto: "precisa de ajuda em algumas tarefas", extra: [] },
  3: { texto: "depende de ajuda na maior parte do dia", extra: ["cuidador", "enfermagem"] },
  4: { texto: "acamado(a)", extra: ["enfermagem", "cuidador", "fisio"] },
};
const CIDADES_ATENDIDAS = ["Holambra", "Jaguariúna", "Artur Nogueira", "Santo Antônio de Posse"];

const quiz = $("#quiz");
const steps = $$(".quiz__step", quiz);
const result = $(".quiz__result", quiz);
const btnNext = $("[data-q-next]", quiz);
const btnPrev = $("[data-q-prev]", quiz);
const quizError = $(".quiz__error", quiz);
let current = 0;
let plano = null;

$("[data-q-total]", quiz).textContent = steps.length;

const stepValid = (i) => {
  const step = steps[i];
  const radios = $$('input[type="radio"]', step);
  const checks = $$('input[type="checkbox"]', step);
  const select = $("select", step);
  if (radios.length && !radios.some((r) => r.checked)) return false;
  if (checks.length && !checks.some((c) => c.checked)) return false;
  if (select && !select.value) return false;
  return true;
};

const showStep = (i) => {
  current = i;
  steps.forEach((s, idx) => s.classList.toggle("is-active", idx === i));
  $("[data-q-current]", quiz).textContent = i + 1;
  $("[data-q-bar]", quiz).style.width = `${((i + 1) / steps.length) * 100}%`;
  btnPrev.hidden = i === 0;
  btnNext.innerHTML = i === steps.length - 1
    ? 'Ver meu plano <svg class="ic"><use href="#i-arrow"/></svg>'
    : 'Continuar <svg class="ic"><use href="#i-arrow"/></svg>';
  quizError.hidden = true;
  keepQuizInView();
};

const keepQuizInView = () => {
  const top = quiz.getBoundingClientRect().top;
  if (top < 0) window.scrollBy({ top: top - header.offsetHeight - 12, behavior: "smooth" });
};

const buildPlan = () => {
  const val = (name) => quiz.querySelector(`[name="${name}"]:checked`)?.value;
  const para = val("q_para");
  const situacoes = $$('input[name="q_sit"]:checked', quiz).map((c) => c.value);
  const aut = val("q_aut");
  const freq = val("q_freq");
  const local = val("q_local");
  const cidade = $('select[name="q_cidade"]', quiz).value;

  const ids = [];
  const add = (list) => list.forEach((id) => !ids.includes(id) && ids.push(id));
  situacoes.forEach((s) => add(POR_SITUACAO[s] || []));
  add(AUTONOMIA[aut].extra);
  if (freq === "Período integral ou 24 horas") add(["cuidador"]);

  const situacoesTexto = $$('input[name="q_sit"]:checked', quiz).map((c) => c.nextElementSibling.textContent.trim());
  return { para, situacoes: situacoesTexto, autonomia: AUTONOMIA[aut].texto, freq, local, cidade, servicos: ids };
};

const renderPlan = (p) => {
  $("[data-r-title]", quiz).textContent = p.para === "Para mim" ? "Seu plano de cuidado" : `Plano de cuidado: ${p.para.toLowerCase()}`;
  $("[data-r-intensity]", quiz).innerHTML = `Autonomia: <b>${p.autonomia}</b> · Frequência: <b>${p.freq.toLowerCase()}</b>`;
  $("[data-r-list]", quiz).innerHTML = p.servicos.map((id) => {
    const s = SERVICOS[id];
    return `<li><svg><use href="#${s.icone}"/></svg><div><strong>${s.nome}</strong><small>${s.porque}</small></div></li>`;
  }).join("");

  const notas = [];
  if (p.cidade === "Outra cidade") {
    notas.push(`Hoje atendemos ${CIDADES_ATENDIDAS.join(", ")}. Fale com a gente para verificar a sua cidade.`);
  }
  const foraDaUnidade = p.servicos.filter((id) => !NA_UNIDADE.includes(id));
  if (p.local === "unidade" && foraDaUnidade.length) {
    notas.push("Fisioterapia, nutrição e psicologia podem ser feitas na unidade. Os demais cuidados são realizados em casa.");
  }
  const nota = $("[data-r-note]", quiz);
  nota.hidden = !notas.length;
  nota.textContent = notas.join(" ");
};

const planText = (p) => [
  `*Para:* ${p.para}`,
  `*Situação:* ${p.situacoes.join("; ")}`,
  `*Autonomia:* ${p.autonomia}`,
  `*Frequência:* ${p.freq}`,
  `*Serviços sugeridos:* ${p.servicos.map((id) => SERVICOS[id].nome).join(", ")}`,
];

btnNext.addEventListener("click", () => {
  if (!stepValid(current)) {
    quizError.hidden = false;
    return;
  }
  if (current === 0) track("inicio_plano_cuidado");
  if (current < steps.length - 1) {
    showStep(current + 1);
    return;
  }
  plano = buildPlan();
  renderPlan(plano);
  steps.forEach((s) => s.classList.remove("is-active"));
  result.hidden = false;
  quiz.classList.add("is-done");
  keepQuizInView();
  track("plano_cuidado_concluido", { servicos: plano.servicos.join(","), cidade: plano.cidade });
});
btnPrev.addEventListener("click", () => current > 0 && showStep(current - 1));
quiz.addEventListener("change", () => { quizError.hidden = true; });

$("[data-q-restart]", quiz).addEventListener("click", () => {
  $$("input", quiz).forEach((i) => { i.checked = false; });
  $('select[name="q_cidade"]', quiz).value = "";
  result.hidden = true;
  quiz.classList.remove("is-done");
  plano = null;
  $("[data-booking-plan]").hidden = true;
  showStep(0);
});

$("[data-plan-whats]", quiz).addEventListener("click", () => {
  const msg = ["Olá! Montei um plano de cuidado no site da Hope e gostaria de conversar.", "", ...planText(plano), `*Cidade:* ${plano.cidade}`].join("\n");
  track("clique_whatsapp", { origem: "plano_cuidado" });
  openExternal(whatsLink(msg));
});

$("[data-plan-to-agenda]", quiz).addEventListener("click", () => {
  const box = $("[data-booking-plan]");
  box.hidden = false;
  $("[data-booking-plan-text]").textContent = plano.servicos.map((id) => SERVICOS[id].nome).join(" · ");
  if (plano.cidade) scheduler.elements.cidade.value = plano.cidade;
  const tipo = plano.local === "unidade" ? "unidade" : "casa";
  scheduler.querySelector(`input[name="tipo"][value="${tipo}"]`).checked = true;
  updateSummary();
});

showStep(0);

// ---------------------------------------------------------
// Agendamento de avaliação
// ---------------------------------------------------------
const scheduler = $("#scheduler");
const daysEl = $("[data-days]", scheduler);
const periodsEl = $("[data-periods]", scheduler);
const summaryEl = $("[data-summary]", scheduler);
const schedError = $(".form__error", scheduler);
const doneEl = $("[data-done]", scheduler);
const agenda = { dia: null, periodo: null, ultimaMensagem: "" };

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtWeekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
const fmtMonth = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const fmtLong = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
const clean = (s) => s.replace(".", "");

const availableDays = () => {
  const { diasExibidos, antecedenciaDias, diasDaSemana, datasBloqueadas } = CONFIG.agenda;
  const days = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + antecedenciaDias);
  while (days.length < diasExibidos) {
    if (diasDaSemana.includes(d.getDay()) && !datasBloqueadas.includes(iso(d))) days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
};

const selectIn = (container, btn) => {
  $$("[role=radio]", container).forEach((b) => {
    const on = b === btn;
    b.setAttribute("aria-checked", String(on));
    b.tabIndex = on ? 0 : -1;
  });
};

availableDays().forEach((d, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "day";
  b.setAttribute("role", "radio");
  b.setAttribute("aria-checked", "false");
  b.tabIndex = i === 0 ? 0 : -1;
  b.setAttribute("aria-label", fmtLong.format(d));
  b.innerHTML = `<small>${clean(fmtWeekday.format(d))}</small><strong>${d.getDate()}</strong><em>${clean(fmtMonth.format(d))}</em>`;
  b.addEventListener("click", () => {
    agenda.dia = d;
    selectIn(daysEl, b);
    updateSummary();
  });
  daysEl.appendChild(b);
});

CONFIG.agenda.periodos.forEach((p, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "period";
  b.setAttribute("role", "radio");
  b.setAttribute("aria-checked", "false");
  b.tabIndex = i === 0 ? 0 : -1;
  b.innerHTML = `<strong>${p.nome}</strong><small>${p.faixa}</small>`;
  b.addEventListener("click", () => {
    agenda.periodo = p;
    selectIn(periodsEl, b);
    updateSummary();
  });
  periodsEl.appendChild(b);
});

// Setas do seletor de dias
const btnDaysPrev = $("[data-days-prev]", scheduler);
const btnDaysNext = $("[data-days-next]", scheduler);
const updateArrows = () => {
  btnDaysPrev.disabled = daysEl.scrollLeft <= 2;
  btnDaysNext.disabled = daysEl.scrollLeft + daysEl.clientWidth >= daysEl.scrollWidth - 2;
};
btnDaysPrev.addEventListener("click", () => daysEl.scrollBy({ left: -daysEl.clientWidth, behavior: "smooth" }));
btnDaysNext.addEventListener("click", () => daysEl.scrollBy({ left: daysEl.clientWidth, behavior: "smooth" }));
daysEl.addEventListener("scroll", updateArrows, { passive: true });
window.addEventListener("resize", updateArrows);
updateArrows();

const tipoAtual = () => scheduler.querySelector('input[name="tipo"]:checked').value;
const tipoTexto = (t) => (t === "unidade" ? "Na unidade (Galeria Hulshof, Holambra)" : "Em casa");

function updateSummary() {
  schedError.hidden = true;
  const partes = [`<b>${tipoAtual() === "unidade" ? "Na unidade" : "Em casa"}</b>`];
  partes.push(agenda.dia ? `<b>${fmtLong.format(agenda.dia)}</b>` : "escolha o dia");
  partes.push(agenda.periodo ? `<b>${agenda.periodo.nome.toLowerCase()} (${agenda.periodo.faixa})</b>` : "escolha o período");
  summaryEl.innerHTML = `<svg class="ic"><use href="#i-calendar"/></svg><span>${partes.join(" · ")}</span>`;
}
scheduler.addEventListener("change", () => {
  updateSummary();
  schedError.hidden = true;
  $$(".is-invalid", scheduler).forEach((f) => f.value && f.classList.remove("is-invalid"));
});
updateSummary();

scheduler.addEventListener("submit", (e) => {
  e.preventDefault();
  const nome = scheduler.elements.nome;
  const cidade = scheduler.elements.cidade;
  const faltando = [];
  if (!agenda.dia) faltando.push("o dia");
  if (!agenda.periodo) faltando.push("o período");
  if (!nome.value.trim()) faltando.push("seu nome");
  if (!cidade.value) faltando.push("a cidade");
  nome.classList.toggle("is-invalid", !nome.value.trim());
  cidade.classList.toggle("is-invalid", !cidade.value);

  if (faltando.length) {
    schedError.textContent = `Falta escolher ${faltando.join(", ").replace(/, ([^,]*)$/, " e $1")}.`;
    schedError.hidden = false;
    return;
  }
  schedError.hidden = true;

  const linhas = [
    "📅 *Solicitação de avaliação*",
    "",
    `*Nome:* ${nome.value.trim()}`,
    `*Cidade:* ${cidade.value}`,
    `*Local:* ${tipoTexto(tipoAtual())}`,
    `*Data preferida:* ${fmtLong.format(agenda.dia)}`,
    `*Período:* ${agenda.periodo.nome} (${agenda.periodo.faixa})`,
  ];
  if (plano) linhas.push("", "_Plano montado no site:_", ...planText(plano));
  linhas.push("", "Aguardo a confirmação do horário.");

  agenda.ultimaMensagem = linhas.join("\n");
  track("agendamento_solicitado", { local: tipoAtual(), cidade: cidade.value, periodo: agenda.periodo.id, com_plano: Boolean(plano) });
  openExternal(whatsLink(agenda.ultimaMensagem));

  $("[data-done-when]", scheduler).textContent = `${fmtLong.format(agenda.dia)} · ${agenda.periodo.nome} (${agenda.periodo.faixa})`;
  doneEl.hidden = false;
});

$("[data-resend]", scheduler).addEventListener("click", () => openExternal(whatsLink(agenda.ultimaMensagem)));

$("[data-new-booking]", scheduler).addEventListener("click", () => {
  doneEl.hidden = true;
  agenda.dia = null;
  agenda.periodo = null;
  $$("[role=radio]", scheduler).forEach((b) => b.setAttribute("aria-checked", "false"));
  updateSummary();
});

// Lembrete .ics para a agenda do celular/computador
$("[data-ics]", scheduler).addEventListener("click", () => {
  const d = agenda.dia;
  const p = agenda.periodo;
  const stamp = (h) => `${iso(d).replaceAll("-", "")}T${String(h).padStart(2, "0")}0000`;
  const local = tipoAtual() === "unidade"
    ? "Rua Rota dos Imigrantes\\, 485\\, Sala 104 - Holambra/SP"
    : "Em casa";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hope Home Care//Agendamento//PT-BR",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@cuidarcomhope.com.br`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `DTSTART:${stamp(p.inicio)}`,
    `DTEND:${stamp(p.fim)}`,
    "SUMMARY:Avaliação Hope Home Care (aguardando confirmação)",
    `LOCATION:${local}`,
    "DESCRIPTION:A equipe da Hope confirma o horário exato pelo WhatsApp. Contato: (19) 99558-1107",
    "STATUS:TENTATIVE",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "avaliacao-hope.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  track("lembrete_agenda");
});
