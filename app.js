import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBLeQOBtqDgn5KO29wIuBAJT095lDqNT4s",
  authDomain: "pontoonline-89b2c.firebaseapp.com",
  projectId: "pontoonline-89b2c",
  storageBucket: "pontoonline-89b2c.firebasestorage.app",
  messagingSenderId: "1002172076605",
  appId: "1:1002172076605:web:978d0dd9eac6ccdf31d054",
  measurementId: "G-BJVQBZYDR9"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const app = document.getElementById("app");

let currentUser = null;
let systems = [];
let activeSystemId = null;

const money = (value) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
}).format(Number(value) || 0);

const numberPt = (value, digits = 0) => new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits
}).format(Number(value) || 0);

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#039;",
  '"': "&quot;"
}[char]));

const normalizeEvolutions = (system) => Array.isArray(system.evolutions) ? system.evolutions : [];
const evolutionTotal = (system) => normalizeEvolutions(system)
  .filter((item) => item.active !== false)
  .reduce((sum, item) => sum + (Number(item.monthlyIncrease) || 0), 0);
const currentMonthly = (system) => (Number(system.baseMonthly) || 0) + evolutionTotal(system);
const grossMargin = (system) => currentMonthly(system) - (Number(system.internalCost) || 0);

function monthProgress(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const days = new Date(year, month + 1, 0).getDate();
  return {
    day,
    days,
    percent: Math.min(100, Math.max(0, (day / days) * 100)),
    dailyPercent: 100 / days
  };
}

function competenceLabel(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
}

function statusClass(status) {
  if (status === "Ativo") return "ok";
  if (status === "Atenção") return "warn";
  return "off";
}

function toast(message) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function closeModal() {
  document.querySelector(".modal-backdrop")?.remove();
}

function showLogin(message = "") {
  app.innerHTML = `
    <main class="login-page">
      <section class="login-card">
        <div class="brand-mark">↗</div>
        <h1>Painel de Sistemas</h1>
        <p>Gestão financeira, técnica e relatórios mensais para seus clientes.</p>
        <form id="loginForm">
          <label>E-mail
            <input id="loginEmail" type="email" autocomplete="email" required placeholder="seu@email.com">
          </label>
          <label style="margin-top:14px">Senha
            <input id="loginPassword" type="password" autocomplete="current-password" required placeholder="••••••••">
          </label>
          <button class="btn btn-primary btn-full" style="margin-top:18px" type="submit">Entrar no painel</button>
          <div id="loginMessage" class="form-message">${escapeHtml(message)}</div>
        </form>
      </section>
    </main>`;

  document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const msg = document.getElementById("loginMessage");
    msg.textContent = "Entrando...";
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error(error);
      msg.textContent = "Não foi possível entrar. Confira e-mail e senha.";
    }
  });
}

async function isAdmin(user) {
  if (!user) return false;
  const adminSnap = await getDoc(doc(db, "admins", user.uid));
  return adminSnap.exists();
}

function shellHtml() {
  return `
    <div class="shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <strong>Painel de Sistemas</strong>
          <span>Gestão & relatórios</span>
        </div>
        <nav class="nav">
          <button class="active" data-view="dashboard">▦ Visão geral</button>
          <button data-view="systems">▤ Sistemas</button>
          <button data-view="reports">▣ Relatórios</button>
        </nav>
        <div class="sidebar-footer">
          <div class="user-email">${escapeHtml(currentUser?.email || "Administrador")}</div>
          <button id="logoutBtn" class="btn btn-ghost" style="color:white;border-color:rgba(255,255,255,.18)">Sair</button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div>
            <h1 id="pageTitle">Visão geral</h1>
            <p id="pageSubtitle">Acompanhe receita, custos, uso e evolução dos sistemas.</p>
          </div>
          <button id="newSystemBtn" class="btn btn-primary">+ Novo sistema</button>
        </header>
        <div id="content" class="content"></div>
      </main>
    </div>`;
}

async function loadSystems() {
  const ref = collection(db, "systems");
  let snapshot;
  try {
    snapshot = await getDocs(query(ref, orderBy("createdAt", "desc")));
  } catch {
    snapshot = await getDocs(ref);
  }
  systems = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function dashboardHtml() {
  const active = systems.filter((item) => item.status !== "Inativo");
  const monthly = active.reduce((sum, item) => sum + currentMonthly(item), 0);
  const costs = active.reduce((sum, item) => sum + (Number(item.internalCost) || 0), 0);
  const margin = monthly - costs;
  const averageDb = active.length ? active.reduce((sum, item) => sum + (Number(item.dbUsage) || 0), 0) / active.length : 0;
  const progress = monthProgress();

  return `
    <section class="kpis">
      <div class="kpi"><span>RECEITA MENSAL</span><strong>${money(monthly)}</strong><small>${active.length} sistemas em operação</small></div>
      <div class="kpi"><span>CUSTO DIRETO</span><strong>${money(costs)}</strong><small>Infraestrutura e serviços</small></div>
      <div class="kpi"><span>MARGEM BRUTA INTERNA</span><strong>${money(margin)}</strong><small>${monthly > 0 ? numberPt((margin / monthly) * 100, 1) : "0,0"}% da receita</small></div>
      <div class="kpi"><span>USO MÉDIO DO BANCO</span><strong>${numberPt(averageDb, 0)}%</strong><small>${numberPt(progress.percent, 1)}% do ciclo mensal decorrido</small></div>
    </section>

    <section class="card">
      <div class="card-header">
        <div><h2>Sistemas acompanhados</h2><p>Resumo financeiro e técnico dos contratos.</p></div>
        <button class="btn btn-soft" id="dashNewBtn">+ Adicionar</button>
      </div>
      <div class="card-body">
        ${systemCardsHtml(systems.slice(0, 6))}
      </div>
    </section>`;
}

function systemCardsHtml(items) {
  if (!items.length) return `<div class="empty"><strong>Nenhum sistema cadastrado</strong>Cadastre o primeiro contrato para começar o acompanhamento.</div>`;
  return `<div class="system-grid">${items.map((system) => {
    const monthly = currentMonthly(system);
    const margin = grossMargin(system);
    const dbUsage = Math.max(0, Math.min(100, Number(system.dbUsage) || 0));
    return `
      <article class="system-card">
        <div class="system-head">
          <div><h3>${escapeHtml(system.name)}</h3><p>${escapeHtml(system.clientName || "Cliente não informado")}</p></div>
          <span class="badge ${statusClass(system.status)}">${escapeHtml(system.status || "Ativo")}</span>
        </div>
        <div class="system-values">
          <div class="metric-box"><span>Mensalidade</span><strong>${money(monthly)}</strong></div>
          <div class="metric-box"><span>Custo interno</span><strong>${money(system.internalCost)}</strong></div>
          <div class="metric-box"><span>Margem</span><strong>${money(margin)}</strong></div>
        </div>
        <div class="progress-row">
          <div class="progress-label"><span>Uso da infraestrutura / banco</span><strong>${numberPt(dbUsage)}%</strong></div>
          <div class="progress"><i style="width:${dbUsage}%"></i></div>
        </div>
        <div class="system-actions">
          <button class="btn btn-soft" data-detail="${system.id}">Ver detalhes</button>
          <button class="btn btn-ghost" data-edit="${system.id}">Editar</button>
          <button class="btn btn-dark" data-report="${system.id}">Gerar relatório</button>
        </div>
      </article>`;
  }).join("")}</div>`;
}

function systemsHtml() {
  return `
    <section class="card">
      <div class="card-header">
        <div><h2>Todos os sistemas</h2><p>Mensalidade base, expansões, custos e indicadores.</p></div>
      </div>
      <div class="card-body">
        <div class="toolbar">
          <input id="systemSearch" type="search" placeholder="Pesquisar sistema ou cliente...">
          <select id="systemStatusFilter"><option value="Todos">Todos</option><option>Ativo</option><option>Atenção</option><option>Inativo</option></select>
        </div>
        <div id="systemListArea">${systemCardsHtml(systems)}</div>
      </div>
    </section>`;
}

async function reportsHtml() {
  const snap = await getDocs(collection(db, "reports"));
  const reports = snap.docs.map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => String(b.generatedAt || "").localeCompare(String(a.generatedAt || "")));

  if (!reports.length) {
    return `<section class="card"><div class="card-header"><div><h2>Relatórios gerados</h2><p>Histórico dos snapshots enviados aos clientes.</p></div></div><div class="empty"><strong>Nenhum relatório gerado</strong>Abra um sistema e gere o primeiro relatório mensal.</div></section>`;
  }

  return `
    <section class="card">
      <div class="card-header"><div><h2>Relatórios gerados</h2><p>Cada relatório mantém os valores do momento em que foi criado.</p></div></div>
      <div class="card-body">
        <div class="evolution-list">
          ${reports.map((report) => `
            <div class="evolution-item">
              <div><strong>${escapeHtml(report.systemName)} · ${escapeHtml(report.competence)}</strong><p>${escapeHtml(report.clientName)} · ${money(report.monthly)}</p></div>
              <div style="display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end">
                <button class="btn btn-soft" data-open-report="${escapeHtml(report.token)}">Abrir</button>
                <button class="btn btn-ghost" data-copy-report="${escapeHtml(report.token)}">Copiar link</button>
              </div>
            </div>`).join("")}
        </div>
      </div>
    </section>`;
}

async function renderView(view = "dashboard") {
  document.querySelectorAll(".nav button").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === view));
  const title = document.getElementById("pageTitle");
  const subtitle = document.getElementById("pageSubtitle");
  const content = document.getElementById("content");

  if (view === "dashboard") {
    title.textContent = "Visão geral";
    subtitle.textContent = "Acompanhe receita, custos, uso e evolução dos sistemas.";
    content.innerHTML = dashboardHtml();
    document.getElementById("dashNewBtn")?.addEventListener("click", () => openSystemForm());
  } else if (view === "systems") {
    title.textContent = "Sistemas";
    subtitle.textContent = "Gerencie contratos, custos e ampliações de escopo.";
    content.innerHTML = systemsHtml();
    setupSystemFilters();
  } else {
    title.textContent = "Relatórios";
    subtitle.textContent = "Histórico dos relatórios compartilhados com clientes.";
    content.innerHTML = `<div class="boot-screen" style="min-height:300px"><div class="spinner"></div><p>Carregando relatórios...</p></div>`;
    content.innerHTML = await reportsHtml();
  }
}

function setupSystemFilters() {
  const search = document.getElementById("systemSearch");
  const filter = document.getElementById("systemStatusFilter");
  const area = document.getElementById("systemListArea");
  const apply = () => {
    const text = search.value.trim().toLocaleLowerCase("pt-BR");
    const status = filter.value;
    const filtered = systems.filter((item) => {
      const haystack = `${item.name || ""} ${item.clientName || ""}`.toLocaleLowerCase("pt-BR");
      return (!text || haystack.includes(text)) && (status === "Todos" || item.status === status);
    });
    area.innerHTML = systemCardsHtml(filtered);
  };
  search.addEventListener("input", apply);
  filter.addEventListener("change", apply);
}

function openSystemForm(system = null) {
  const editing = Boolean(system);
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <section class="modal" role="dialog" aria-modal="true">
      <div class="modal-header"><h2>${editing ? "Editar sistema" : "Novo sistema"}</h2><button class="btn btn-ghost" data-close>Fechar</button></div>
      <form id="systemForm" class="modal-body">
        <div class="form-grid">
          <label>Nome do sistema<input name="name" required maxlength="80" value="${escapeHtml(system?.name || "")}"></label>
          <label>Cliente / órgão<input name="clientName" required maxlength="100" value="${escapeHtml(system?.clientName || "")}"></label>
          <label>E-mail do cliente<input name="clientEmail" type="email" value="${escapeHtml(system?.clientEmail || "")}"></label>
          <label>Status<select name="status"><option ${system?.status === "Ativo" ? "selected" : ""}>Ativo</option><option ${system?.status === "Atenção" ? "selected" : ""}>Atenção</option><option ${system?.status === "Inativo" ? "selected" : ""}>Inativo</option></select></label>
          <label>Mensalidade base (R$)<input name="baseMonthly" type="number" min="0" step="0.01" required value="${Number(system?.baseMonthly) || 0}"></label>
          <label>Custo direto interno (R$)<input name="internalCost" type="number" min="0" step="0.01" required value="${Number(system?.internalCost) || 0}"></label>
          <label>Uso da infraestrutura / banco (%)<input name="dbUsage" type="number" min="0" max="100" step="1" value="${Number(system?.dbUsage) || 0}"></label>
          <label>Disponibilidade (%)<input name="availability" type="number" min="0" max="100" step="0.01" value="${Number(system?.availability) || 99.8}"></label>
          <label>Atendimentos no mês<input name="supportCount" type="number" min="0" step="1" value="${Number(system?.supportCount) || 0}"></label>
          <label>Atualizações no mês<input name="updatesCount" type="number" min="0" step="1" value="${Number(system?.updatesCount) || 0}"></label>
          <label>Dia de vencimento<input name="dueDay" type="number" min="1" max="31" step="1" value="${Number(system?.dueDay) || 10}"></label>
          <label>Link do sistema<input name="systemUrl" type="url" value="${escapeHtml(system?.systemUrl || "")}" placeholder="https://..."></label>
          <label class="span-2">Observações internas<textarea name="notes" placeholder="Informações que nunca aparecem no relatório do cliente.">${escapeHtml(system?.notes || "")}</textarea></label>
        </div>
        <div id="systemFormMessage" class="form-message"></div>
        <div class="form-actions">
          ${editing ? `<button type="button" id="deleteSystemBtn" class="btn btn-danger">Excluir sistema</button>` : ""}
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">${editing ? "Salvar alterações" : "Cadastrar sistema"}</button>
        </div>
      </form>
    </section>`;
  document.body.appendChild(modal);
  modal.querySelectorAll("[data-close]").forEach((btn) => btn.addEventListener("click", closeModal));
  modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });

  document.getElementById("systemForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get("name").trim(),
      clientName: form.get("clientName").trim(),
      clientEmail: form.get("clientEmail").trim(),
      status: form.get("status"),
      baseMonthly: Number(form.get("baseMonthly")) || 0,
      internalCost: Number(form.get("internalCost")) || 0,
      dbUsage: Math.max(0, Math.min(100, Number(form.get("dbUsage")) || 0)),
      availability: Math.max(0, Math.min(100, Number(form.get("availability")) || 0)),
      supportCount: Math.max(0, Number(form.get("supportCount")) || 0),
      updatesCount: Math.max(0, Number(form.get("updatesCount")) || 0),
      dueDay: Math.max(1, Math.min(31, Number(form.get("dueDay")) || 10)),
      systemUrl: form.get("systemUrl").trim(),
      notes: form.get("notes").trim(),
      updatedAt: serverTimestamp()
    };
    const msg = document.getElementById("systemFormMessage");
    msg.textContent = "Salvando...";
    try {
      if (editing) {
        await updateDoc(doc(db, "systems", system.id), payload);
      } else {
        payload.evolutions = [];
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, "systems"), payload);
      }
      await loadSystems();
      closeModal();
      await renderView("systems");
      toast(editing ? "Sistema atualizado." : "Sistema cadastrado.");
    } catch (error) {
      console.error(error);
      msg.textContent = "Erro ao salvar. Verifique as regras do Firestore.";
    }
  });

  document.getElementById("deleteSystemBtn")?.addEventListener("click", async () => {
    if (!confirm(`Excluir ${system.name}? Essa ação não pode ser desfeita.`)) return;
    await deleteDoc(doc(db, "systems", system.id));
    await loadSystems();
    closeModal();
    await renderView("systems");
    toast("Sistema excluído.");
  });
}

function openSystemDetails(system) {
  activeSystemId = system.id;
  const evolutions = normalizeEvolutions(system);
  const monthly = currentMonthly(system);
  const cost = Number(system.internalCost) || 0;
  const margin = monthly - cost;
  const progress = monthProgress();
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <section class="modal" role="dialog" aria-modal="true">
      <div class="modal-header"><h2>Detalhes do sistema</h2><button class="btn btn-ghost" data-close>Fechar</button></div>
      <div class="modal-body">
        <div class="detail-title">
          <div><h2 style="margin:0">${escapeHtml(system.name)}</h2><p style="margin:5px 0 0;color:var(--muted);font-size:12px">${escapeHtml(system.clientName)}</p></div>
          <span class="badge ${statusClass(system.status)}">${escapeHtml(system.status)}</span>
        </div>
        <div class="detail-grid">
          <div class="detail-box"><span>Base</span><strong>${money(system.baseMonthly)}</strong></div>
          <div class="detail-box"><span>Evoluções</span><strong>+ ${money(evolutionTotal(system))}</strong></div>
          <div class="detail-box"><span>Mensalidade atual</span><strong>${money(monthly)}</strong></div>
          <div class="detail-box"><span>Margem interna</span><strong>${money(margin)}</strong></div>
        </div>
        <div class="detail-grid">
          <div class="detail-box"><span>Banco / infraestrutura</span><strong>${numberPt(system.dbUsage)}%</strong></div>
          <div class="detail-box"><span>Disponibilidade</span><strong>${numberPt(system.availability, 2)}%</strong></div>
          <div class="detail-box"><span>Ciclo mensal</span><strong>${numberPt(progress.percent, 1)}%</strong></div>
          <div class="detail-box"><span>Suportes / atualizações</span><strong>${Number(system.supportCount) || 0} / ${Number(system.updatesCount) || 0}</strong></div>
        </div>

        <h3 class="section-title">Ampliações permanentes do escopo</h3>
        <div class="evolution-list">
          ${evolutions.length ? evolutions.map((item, index) => `
            <div class="evolution-item">
              <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.description || "Sem descrição")} · ${escapeHtml(item.date || "")}</p></div>
              <div style="text-align:right"><div class="evolution-price">+ ${money(item.monthlyIncrease)}/mês</div><button class="btn btn-danger" style="margin-top:7px;min-height:32px;padding:6px 9px;font-size:11px" data-remove-evolution="${index}">Remover</button></div>
            </div>`).join("") : `<div class="empty"><strong>Nenhuma evolução cadastrada</strong>Adicione novos recursos que passaram a integrar permanentemente o sistema.</div>`}
        </div>

        <h3 class="section-title">Adicionar evolução</h3>
        <form id="evolutionForm" class="form-grid">
          <label>Título<input name="title" required placeholder="Ex.: Relatório gerencial"></label>
          <label>Acréscimo mensal (R$)<input name="monthlyIncrease" type="number" min="0" step="0.01" required placeholder="50,00"></label>
          <label>Data<input name="date" type="date" required value="${new Date().toISOString().slice(0,10)}"></label>
          <label>Categoria<select name="category"><option>Funcionalidade</option><option>Módulo</option><option>Integração</option><option>Infraestrutura</option><option>Suporte ampliado</option></select></label>
          <label class="span-2">Justificativa / descrição<textarea name="description" required placeholder="Descreva o que foi incorporado ao sistema e passou a fazer parte do escopo mantido."></textarea></label>
          <div class="span-2 form-actions" style="margin-top:0"><button type="submit" class="btn btn-primary">+ Incorporar evolução</button></div>
        </form>

        <div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:24px;border-top:1px solid var(--border);padding-top:18px">
          <button id="detailEditBtn" class="btn btn-ghost">Editar indicadores</button>
          <button id="detailReportBtn" class="btn btn-dark">Gerar relatório do cliente</button>
        </div>
      </div>
    </section>`;
  document.body.appendChild(modal);
  modal.querySelectorAll("[data-close]").forEach((btn) => btn.addEventListener("click", closeModal));
  modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });

  document.getElementById("evolutionForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const newItem = {
      id: crypto.randomUUID(),
      title: data.get("title").trim(),
      description: data.get("description").trim(),
      category: data.get("category"),
      date: data.get("date"),
      monthlyIncrease: Number(data.get("monthlyIncrease")) || 0,
      active: true
    };
    await updateDoc(doc(db, "systems", system.id), {
      evolutions: [...evolutions, newItem],
      updatedAt: serverTimestamp()
    });
    await loadSystems();
    closeModal();
    openSystemDetails(systems.find((item) => item.id === system.id));
    toast("Evolução incorporada à mensalidade.");
  });

  modal.querySelectorAll("[data-remove-evolution]").forEach((btn) => btn.addEventListener("click", async () => {
    const index = Number(btn.dataset.removeEvolution);
    if (!confirm("Remover esta evolução da composição mensal?")) return;
    const next = evolutions.filter((_, i) => i !== index);
    await updateDoc(doc(db, "systems", system.id), { evolutions: next, updatedAt: serverTimestamp() });
    await loadSystems();
    closeModal();
    openSystemDetails(systems.find((item) => item.id === system.id));
  }));

  document.getElementById("detailEditBtn").addEventListener("click", () => { closeModal(); openSystemForm(system); });
  document.getElementById("detailReportBtn").addEventListener("click", async () => { await generateReport(system); });
}

function safePublicEvolutions(system) {
  return normalizeEvolutions(system)
    .filter((item) => item.active !== false)
    .map((item) => ({
      title: item.title || "Evolução do sistema",
      description: item.description || "",
      category: item.category || "Funcionalidade",
      date: item.date || "",
      monthlyIncrease: Number(item.monthlyIncrease) || 0
    }));
}

async function generateReport(system) {
  const token = crypto.randomUUID().replaceAll("-", "");
  const now = new Date();
  const progress = monthProgress(now);
  const monthly = currentMonthly(system);
  const payload = {
    token,
    systemId: system.id,
    systemName: system.name || "Sistema",
    clientName: system.clientName || "Cliente",
    clientEmail: system.clientEmail || "",
    competence: competenceLabel(now),
    generatedAt: now.toISOString(),
    monthly,
    baseMonthly: Number(system.baseMonthly) || 0,
    expansionMonthly: evolutionTotal(system),
    dbUsage: Math.max(0, Math.min(100, Number(system.dbUsage) || 0)),
    availability: Math.max(0, Math.min(100, Number(system.availability) || 0)),
    supportCount: Math.max(0, Number(system.supportCount) || 0),
    updatesCount: Math.max(0, Number(system.updatesCount) || 0),
    periodPercent: progress.percent,
    periodDay: progress.day,
    periodDays: progress.days,
    evolutions: safePublicEvolutions(system),
    services: [
      "Infraestrutura e disponibilidade do sistema",
      "Banco de dados e armazenamento operacional",
      "Manutenção corretiva e preventiva",
      "Segurança e continuidade da solução",
      "Suporte técnico",
      "Atualizações e acompanhamento"
    ]
  };

  try {
    await setDoc(doc(db, "publicReports", token), payload);
    await addDoc(collection(db, "reports"), { ...payload, createdAt: serverTimestamp() });
    const url = reportUrl(token);
    closeModal();
    showGeneratedReportDialog(payload, url);
  } catch (error) {
    console.error(error);
    toast("Não foi possível gerar o relatório. Verifique as regras do Firestore.");
  }
}

function reportUrl(token) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("relatorio", token);
  return url.toString();
}

function showGeneratedReportDialog(report, url) {
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <section class="modal" style="max-width:620px">
      <div class="modal-header"><h2>Relatório gerado</h2><button class="btn btn-ghost" data-close>Fechar</button></div>
      <div class="modal-body">
        <p style="margin-top:0;color:var(--muted);font-size:13px">Foi criado um snapshot público sem custo interno, margem ou observações administrativas.</p>
        <label>Link para o cliente<input id="generatedLink" readonly value="${escapeHtml(url)}"></label>
        <div class="form-actions" style="justify-content:flex-start;flex-wrap:wrap">
          <button id="copyGeneratedBtn" class="btn btn-soft">Copiar link</button>
          <button id="openGeneratedBtn" class="btn btn-dark">Abrir relatório</button>
          <button id="whatsappGeneratedBtn" class="btn btn-primary">Compartilhar no WhatsApp</button>
        </div>
      </div>
    </section>`;
  document.body.appendChild(modal);
  modal.querySelectorAll("[data-close]").forEach((btn) => btn.addEventListener("click", closeModal));
  document.getElementById("copyGeneratedBtn").addEventListener("click", () => copyText(url));
  document.getElementById("openGeneratedBtn").addEventListener("click", () => window.open(url, "_blank", "noopener"));
  document.getElementById("whatsappGeneratedBtn").addEventListener("click", () => {
    const text = `Olá! Segue o relatório mensal do ${report.systemName}, competência ${report.competence}.\n\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Link copiado.");
  } catch {
    prompt("Copie o link abaixo:", text);
  }
}

async function renderPublicReport(token) {
  app.innerHTML = `<div class="boot-screen"><div class="spinner"></div><p>Carregando relatório...</p></div>`;
  try {
    const snap = await getDoc(doc(db, "publicReports", token));
    if (!snap.exists()) {
      app.innerHTML = `<main class="login-page"><section class="login-card"><h1>Relatório não encontrado</h1><p>O link pode estar incorreto ou o relatório pode ter sido removido.</p></section></main>`;
      return;
    }
    const report = snap.data();
    const evolutions = Array.isArray(report.evolutions) ? report.evolutions : [];
    const services = Array.isArray(report.services) ? report.services : [];
    const period = Math.max(0, Math.min(100, Number(report.periodPercent) || 0));
    const dbUsage = Math.max(0, Math.min(100, Number(report.dbUsage) || 0));
    const availability = Math.max(0, Math.min(100, Number(report.availability) || 0));

    app.innerHTML = `
      <main class="report-page">
        <article class="report-sheet">
          <header class="report-hero">
            <small>RELATÓRIO MENSAL DE SERVIÇOS · ${escapeHtml(report.competence || "")}</small>
            <h1>${escapeHtml(report.systemName || "Sistema")}</h1>
            <p>${escapeHtml(report.clientName || "Cliente")}</p>
          </header>
          <div class="report-body">
            <section class="report-kpis">
              <div class="report-kpi"><span>Mensalidade atual</span><strong>${money(report.monthly)}</strong></div>
              <div class="report-kpi"><span>Ciclo mensal</span><strong>${numberPt(period, 1)}%</strong></div>
              <div class="report-kpi"><span>Infraestrutura</span><strong>${numberPt(dbUsage)}%</strong></div>
              <div class="report-kpi"><span>Disponibilidade</span><strong>${numberPt(availability, 2)}%</strong></div>
            </section>

            <section class="report-section">
              <h2>Acompanhamento do ciclo mensal</h2>
              <div class="progress-row">
                <div class="progress-label"><span>Período utilizado</span><strong>Dia ${Number(report.periodDay) || 0} de ${Number(report.periodDays) || 0}</strong></div>
                <div class="progress" style="height:12px"><i style="width:${period}%"></i></div>
              </div>
              <div class="progress-row">
                <div class="progress-label"><span>Utilização da infraestrutura / banco de dados</span><strong>${numberPt(dbUsage)}%</strong></div>
                <div class="progress" style="height:12px"><i style="width:${dbUsage}%"></i></div>
              </div>
            </section>

            <section class="report-section">
              <h2>Atividades do período</h2>
              <div class="report-kpis" style="grid-template-columns:repeat(2,minmax(0,1fr))">
                <div class="report-kpi"><span>Atendimentos técnicos</span><strong>${Number(report.supportCount) || 0}</strong></div>
                <div class="report-kpi"><span>Atualizações realizadas</span><strong>${Number(report.updatesCount) || 0}</strong></div>
              </div>
            </section>

            ${evolutions.length ? `
              <section class="report-section">
                <h2>Evoluções incorporadas ao sistema</h2>
                <div class="evolution-list">
                  ${evolutions.map((item) => `<div class="evolution-item"><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.description || "")} ${item.date ? `· ${escapeHtml(item.date)}` : ""}</p></div><div class="evolution-price">+ ${money(item.monthlyIncrease)}/mês</div></div>`).join("")}
                </div>
              </section>` : ""}

            <section class="report-section">
              <h2>Serviços mantidos na mensalidade</h2>
              <div class="service-list">
                ${services.map((service) => `<div class="service-item"><strong>${escapeHtml(service)}</strong><p>Serviço acompanhado continuamente durante o período contratado.</p></div>`).join("")}
              </div>
            </section>

            <section class="report-section">
              <div class="report-note"><strong>Resumo do serviço</strong><br>A mensalidade contempla a continuidade operacional da solução, infraestrutura digital, manutenção, suporte, atualizações e acompanhamento permanente. Novas funcionalidades incorporadas passam a integrar o escopo técnico mantido do sistema.</div>
            </section>
          </div>
        </article>
        <div class="report-actions">
          <button id="reportPrintBtn" class="btn btn-dark">Imprimir / salvar PDF</button>
          <button id="reportShareBtn" class="btn btn-primary">Compartilhar</button>
        </div>
      </main>`;

    document.getElementById("reportPrintBtn").addEventListener("click", () => window.print());
    document.getElementById("reportShareBtn").addEventListener("click", async () => {
      const shareData = { title: `Relatório - ${report.systemName}`, text: `Relatório mensal de ${report.competence}`, url: window.location.href };
      if (navigator.share) {
        try { await navigator.share(shareData); } catch { /* cancelado */ }
      } else {
        await copyText(window.location.href);
      }
    });
  } catch (error) {
    console.error(error);
    app.innerHTML = `<main class="login-page"><section class="login-card"><h1>Não foi possível abrir o relatório</h1><p>Verifique as regras públicas da coleção publicReports no Firestore.</p></section></main>`;
  }
}

function bindShellEvents() {
  document.getElementById("logoutBtn").addEventListener("click", () => signOut(auth));
  document.getElementById("newSystemBtn").addEventListener("click", () => openSystemForm());
  document.querySelectorAll(".nav button").forEach((btn) => btn.addEventListener("click", () => renderView(btn.dataset.view)));

  document.getElementById("content").addEventListener("click", async (event) => {
    const detail = event.target.closest("[data-detail]");
    const edit = event.target.closest("[data-edit]");
    const report = event.target.closest("[data-report]");
    const openReport = event.target.closest("[data-open-report]");
    const copyReport = event.target.closest("[data-copy-report]");

    if (detail) {
      const system = systems.find((item) => item.id === detail.dataset.detail);
      if (system) openSystemDetails(system);
    }
    if (edit) {
      const system = systems.find((item) => item.id === edit.dataset.edit);
      if (system) openSystemForm(system);
    }
    if (report) {
      const system = systems.find((item) => item.id === report.dataset.report);
      if (system) await generateReport(system);
    }
    if (openReport) window.open(reportUrl(openReport.dataset.openReport), "_blank", "noopener");
    if (copyReport) await copyText(reportUrl(copyReport.dataset.copyReport));
  });
}

async function startAdmin(user) {
  currentUser = user;
  app.innerHTML = shellHtml();
  bindShellEvents();
  await loadSystems();
  await renderView("dashboard");
}

async function bootstrap() {
  const token = new URLSearchParams(window.location.search).get("relatorio");
  if (token) {
    await renderPublicReport(token);
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      currentUser = null;
      showLogin();
      return;
    }
    try {
      if (!(await isAdmin(user))) {
        await signOut(auth);
        showLogin("Usuário autenticado, mas sem permissão administrativa.");
        return;
      }
      await startAdmin(user);
    } catch (error) {
      console.error(error);
      showLogin("Não foi possível validar o administrador. Confira o Firestore.");
    }
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(console.error));
}

bootstrap();
