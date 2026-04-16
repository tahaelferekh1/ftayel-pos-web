const DEFAULT_CATEGORIES = [];
const LBP_TO_USD_RATE = 90000;
const MODIFIER_PRESETS = ["طرطور", "كبيس", "بندورة", "مايونيز", "خردل", "خس", "ثوم", "نعنع", "دبس", "Mozzarella", "Cheddar", "BBQ Sauce", "Smoked Sauce"];
const MODIFIER_PRESETS_AR = ["طرطور", "كبيس", "بندورة", "مايونيز", "خردل", "خس", "ثوم", "نعنع", "دبس", "موزاريلا", "تشيدر", "صوص باربكيو", "صوص مدخن"];
const CATEGORY_LABELS_AR = {};
const MENU_NAME_AR = {
  "Fatayel": "فتايل",
  "Roasto": "روستو",
  "Kofta": "كفتة",
  "Sojok": "سجق",
  "Sojok Mad": "سجق مد",
  "Sawda": "سودة",
  "Ma2ane2": "مقانق",
  "Ma2ane2 Mad": "مقانق مد",
  "Djaj": "دجاج",
  "Bastarma": "بسطرما",
  "Chicken Steak": "تشيكن ستيك",
  "Beef Steak": "بيف ستيك",
  "Drinks": "مشروبات",
};
const ITEM_DEFAULT_MODIFIERS = {
  "Fatayel": ["طرطور", "كبيس", "بندورة"],
  "Roasto": ["مايونيز", "خردل", "كبيس", "بندورة"],
  "Kofta": ["مايونيز", "كبيس", "بندورة", "خس"],
  "Sojok": ["ثوم", "كبيس", "بندورة"],
  "Sojok Mad": ["خردل", "كبيس", "بندورة"],
  "Sawda": ["ثوم", "كبيس", "نعنع"],
  "Ma2ane2": ["مايونيز", "كبيس", "بندورة"],
  "Ma2ane2 Mad": ["مايونيز", "دبس", "كبيس", "بندورة", "خس"],
  "Djaj": ["مايونيز", "ثوم", "كبيس"],
  "Bastarma": ["خردل", "كبيس", "بندورة"],
  "Chicken Steak": ["Mozzarella", "Cheddar", "BBQ Sauce", "Smoked Sauce"],
  "Beef Steak": ["Mozzarella", "Cheddar", "BBQ Sauce", "Smoked Sauce"],
  "Drinks": [],
};
const TAX_RATE = 0.08;

const DEFAULT_MENU_ITEMS = [
  { id: 1,  name: "Fatayel",        price: 190000 },
  { id: 2,  name: "Roasto",         price: 230000 },
  { id: 3,  name: "Kofta",          price: 190000 },
  { id: 4,  name: "Sojok",          price: 200000 },
  { id: 5,  name: "Sojok Mad",      price: 190000 },
  { id: 6,  name: "Sawda",          price: 190000 },
  { id: 7,  name: "Ma2ane2",        price: 300000 },
  { id: 8,  name: "Ma2ane2 Mad",    price: 300000 },
  { id: 9,  name: "Djaj",           price: 300000 },
  { id: 10, name: "Bastarma",       price: 300000 },
  { id: 11, name: "Chicken Steak",  price: 300000 },
  { id: 12, name: "Beef Steak",     price: 350000 },
  { id: 13, name: "Drinks",         price: 100000 },
];
const ONLINE_PAYMENT_TYPES = {
  CARD: "online_card",
  COD: "cod",
};
const ONLINE_SYNC_INTERVAL_MS = 7000;
const DEFAULT_ONLINE_ENDPOINT = "http://localhost:8787/api/orders";

const DEFAULT_USERS = [
  { name: "admin", role: "admin", password: "admin" },
  { name: "manager", role: "manager", password: "manager" },
  { name: "cashier", role: "cashier", password: "cashier" },
];

const state = {
  users: [...DEFAULT_USERS],
  currentUser: null,
  categories: [...DEFAULT_CATEGORIES],
  selectedCategory: "All",
  currency: "lbp",
  menu: [...DEFAULT_MENU_ITEMS],
  inventory: [
    { id: 1, name: "Tomatoes", category: "Produce", qty: 20, alert: 7 },
    { id: 2, name: "Flour", category: "Dry", qty: 15, alert: 5 },
  ],
  order: [],
  posConfig: {
    discountType: "none",
    discountValue: 0,
    serviceChargePct: 0,
    taxMode: "exclusive",
    taxRate: TAX_RATE,
    paymentMethod: "cash",
  },
  reports: { daily: [], monthly: [] },
  kitchenTickets: [],
  onlineOrders: [],
  onlineOrdersConfig: {
    endpoint: DEFAULT_ONLINE_ENDPOINT,
    authToken: "",
    lastSyncAt: "",
  },
  shifts: {
    active: null,
    history: [],
  },
  auditLog: [],
  refunds: [],
  lastTransaction: null,
  activeView: "pos",
  customers: [],
  orderCounter: 0,
  heldOrders: [],
};

let onlineOrdersPollTimer = null;
let lastKnownPendingCount = 0;
let partialRefundContext = null;

function $(id) {
  return document.getElementById(id);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDefaultModifiersForItem(itemName) {
  const name = String(itemName || "").trim();
  if (!name) return [];
  if (Array.isArray(ITEM_DEFAULT_MODIFIERS[name])) return [...ITEM_DEFAULT_MODIFIERS[name]];
  const key = Object.keys(ITEM_DEFAULT_MODIFIERS).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? [...ITEM_DEFAULT_MODIFIERS[key]] : [];
}

function formatMoney(value) {
  const num = Number(value || 0);
  if (state.currency === "usd") {
    return `$${(num / LBP_TO_USD_RATE).toFixed(2)}`;
  }
  return `${Math.round(num).toLocaleString()} ل.ل`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function addAudit(action, details) {
  state.auditLog.unshift({
    id: Date.now() + Math.floor(Math.random() * 999),
    at: new Date().toISOString(),
    by: state.currentUser ? `${state.currentUser.name} (${state.currentUser.role})` : "System",
    action,
    details,
  });
  state.auditLog = state.auditLog.slice(0, 300);
}

function isSignedIn() {
  return !!state.currentUser;
}

function isAdmin() {
  return state.currentUser?.role === "admin";
}

function isManagerOrAdmin() {
  return state.currentUser?.role === "manager" || state.currentUser?.role === "admin";
}

function isManagerOnly() {
  return state.currentUser?.role === "manager";
}

function canAccessView(view) {
  if (!isSignedIn()) return false;
  if (view === "pos" || view === "kitchen" || view === "onlineOrders") return true;
  if (view === "customers") return true;
  if (view === "menu" || view === "inventory" || view === "reports" || view === "shift") return isManagerOrAdmin();
  if (view === "settings") return isManagerOrAdmin();
  if (view === "users") return isAdmin();
  return false;
}

function getSnapshot() {
  return {
    users: state.users,
    currentUser: state.currentUser,
    categories: state.categories,
    currency: state.currency,
    menu: state.menu,
    inventory: state.inventory,
    reports: state.reports,
    kitchenTickets: state.kitchenTickets,
    onlineOrders: state.onlineOrders,
    onlineOrdersConfig: state.onlineOrdersConfig,
    shifts: state.shifts,
    auditLog: state.auditLog,
    refunds: state.refunds,
    lastTransaction: state.lastTransaction,
    posConfig: state.posConfig,
    activeView: state.activeView,
    customers: state.customers,
    orderCounter: state.orderCounter,
    heldOrders: state.heldOrders,
  };
}

function normalizeLoadedUsers(users) {
  if (!Array.isArray(users)) return [...DEFAULT_USERS];

  const normalized = users.map((u) => {
    const role = ["cashier", "manager", "admin"].includes(u.role) ? u.role : "cashier";
    let mappedRole = role;
    if (u.name === "admin") mappedRole = "admin";
    if (u.name === "manager") mappedRole = "manager";
    const fallbackPassword = DEFAULT_USERS.find((d) => d.name === u.name)?.password || String(u.name || "user").toLowerCase();
    return {
      name: u.name,
      role: mappedRole,
      password: u.password || fallbackPassword,
    };
  });

  DEFAULT_USERS.forEach((def) => {
    if (!normalized.some((u) => u.name === def.name)) normalized.push({ ...def });
  });

  return normalized;
}

const OLD_PLACEHOLDER_ITEM_NAMES = ["Club Sandwich", "Grilled Burger", "Chicken Platter", "Spring Rolls", "Coke"];

function hydrateSnapshot(loaded) {
  state.categories = [...DEFAULT_CATEGORIES];
  state.users = normalizeLoadedUsers(loaded.users);
  if (Array.isArray(loaded.menu) && !loaded.menu.every((i) => OLD_PLACEHOLDER_ITEM_NAMES.includes(i.name))) {
    state.menu = loaded.menu;
  } else {
    state.menu = [...DEFAULT_MENU_ITEMS];
  }
  if (loaded.currency === "usd" || loaded.currency === "lbp") state.currency = loaded.currency;
  if (Array.isArray(loaded.inventory)) state.inventory = loaded.inventory;
  if (loaded.reports && Array.isArray(loaded.reports.daily) && Array.isArray(loaded.reports.monthly)) {
    state.reports = loaded.reports;
  }
  if (Array.isArray(loaded.kitchenTickets)) state.kitchenTickets = loaded.kitchenTickets;
  if (Array.isArray(loaded.onlineOrders)) state.onlineOrders = loaded.onlineOrders;
  if (loaded.onlineOrdersConfig && typeof loaded.onlineOrdersConfig === "object") {
    state.onlineOrdersConfig = {
      endpoint: String(loaded.onlineOrdersConfig.endpoint || DEFAULT_ONLINE_ENDPOINT).trim(),
      authToken: String(loaded.onlineOrdersConfig.authToken || "").trim(),
      lastSyncAt: String(loaded.onlineOrdersConfig.lastSyncAt || ""),
    };
  }
  if (loaded.shifts && typeof loaded.shifts === "object") {
    state.shifts = {
      active: loaded.shifts.active || null,
      history: Array.isArray(loaded.shifts.history) ? loaded.shifts.history : [],
    };
  }
  if (Array.isArray(loaded.auditLog)) state.auditLog = loaded.auditLog;
  if (Array.isArray(loaded.refunds)) state.refunds = loaded.refunds;
  if (loaded.lastTransaction) state.lastTransaction = loaded.lastTransaction;
  if (Array.isArray(loaded.customers)) state.customers = loaded.customers;
  if (typeof loaded.orderCounter === "number") state.orderCounter = loaded.orderCounter;
  if (Array.isArray(loaded.heldOrders)) state.heldOrders = loaded.heldOrders;
  if (loaded.posConfig && typeof loaded.posConfig === "object") {
    state.posConfig = {
      discountType: loaded.posConfig.discountType || "none",
      discountValue: Number(loaded.posConfig.discountValue || 0),
      serviceChargePct: Number(loaded.posConfig.serviceChargePct || 0),
      taxMode: loaded.posConfig.taxMode === "inclusive" ? "inclusive" : "exclusive",
      taxRate: Number(loaded.posConfig.taxRate || TAX_RATE),
      paymentMethod: loaded.posConfig.paymentMethod === "card" ? "card" : "cash",
    };
  }
  state.currentUser = null;
  if (loaded.activeView) state.activeView = loaded.activeView;
}

function loadState() {
  const raw = localStorage.getItem("ftayelPosStateV2") || localStorage.getItem("celinaPosStateV2") || localStorage.getItem("celinaPosState");
  if (!raw) return;
  try {
    const loaded = JSON.parse(raw);
    hydrateSnapshot(loaded);
  } catch (err) {
    console.warn("Failed to parse saved state", err);
  }
}

function saveState() {
  localStorage.setItem("ftayelPosStateV2", JSON.stringify(getSnapshot()));
}

const el = {
  layout: document.querySelector(".layout"),
  sidebar: document.querySelector(".sidebar"),
  currentRole: $("currentRole"),
  langArBtn: $("langArBtn"),
  langEnBtn: $("langEnBtn"),
  currLbpBtn: $("currLbpBtn"),
  currUsdBtn: $("currUsdBtn"),
  loginPanel: $("loginPanel"),
  loginForm: $("loginForm"),
  loginUsername: $("loginUsername"),
  loginPassword: $("loginPassword"),
  loginMsg: $("loginMsg"),
  settingsResetBtn: $("settingsResetBtn"),
  logoutBtn: $("logoutBtn"),

  navBtns: [...document.querySelectorAll(".navBtn")],
  views: [...document.querySelectorAll(".view")],

  categoryFilters: $("categoryFilters"),
  menuItems: $("menuItems"),
  orderItems: $("orderItems"),
  subtotal: $("subtotal"),
  discount: $("discount"),
  service: $("service"),
  tax: $("tax"),
  total: $("total"),
  taxLabel: $("taxLabel"),

  discountType: $("discountType"),
  discountValue: $("discountValue"),
  serviceChargePct: $("serviceChargePct"),
  taxMode: $("taxMode"),
  paymentMethod: $("paymentMethod"),

  payOrder: $("payOrder"),
  holdOrderBtn: $("holdOrderBtn"),
  cashReceived: $("cashReceived"),
  changeDue: $("changeDue"),
  cashChangeCard: $("cashChangeCard"),
  heldOrdersWrap: $("heldOrdersWrap"),
  heldOrdersList: $("heldOrdersList"),
  printReceipt: $("printReceipt"),
  printKitchen: $("printKitchen"),
  clearOrder: $("clearOrder"),
  refundOrderId: $("refundOrderId"),
  refundOrderBtn: $("refundOrderBtn"),
  partialRefundBtn: $("partialRefundBtn"),
  partialRefundPanel: $("partialRefundPanel"),
  partialRefundItemSelect: $("partialRefundItemSelect"),
  partialRefundQtySelect: $("partialRefundQtySelect"),
  confirmPartialRefundBtn: $("confirmPartialRefundBtn"),
  cancelPartialRefundBtn: $("cancelPartialRefundBtn"),
  partialRefundHint: $("partialRefundHint"),
  receiptPreview: $("receiptPreview"),

  menuList: $("menuList"),
  newItemName: $("newItemName"),
  newItemCategory: $("newItemCategory"),
  newItemPrice: $("newItemPrice"),
  addItemBtn: $("addItemBtn"),

  inventoryList: $("inventoryList"),
  invName: $("invName"),
  invQty: $("invQty"),
  invAlert: $("invAlert"),
  addInvBtn: $("addInvBtn"),
  importInventoryBtn: $("importInventoryBtn"),
  downloadInventoryTemplateBtn: $("downloadInventoryTemplateBtn"),
  inventoryFileInput: $("inventoryFileInput"),

  userList: $("userList"),
  username: $("username"),
  userPassword: $("userPassword"),
  roleSelect: $("roleSelect"),
  addUserBtn: $("addUserBtn"),

  kitchenList: $("kitchenList"),

  onlineOrdersList: $("onlineOrdersList"),
  onlineEndpoint: $("onlineEndpoint"),
  onlineToken: $("onlineToken"),
  saveOnlineSettingsBtn: $("saveOnlineSettingsBtn"),
  syncOnlineOrdersBtn: $("syncOnlineOrdersBtn"),
  importOnlineOrdersBtn: $("importOnlineOrdersBtn"),
  onlineOrdersJson: $("onlineOrdersJson"),
  onlineOrdersStatus: $("onlineOrdersStatus"),

  orderTypeDineIn: $("orderTypeDineIn"),
  orderTypeDelivery: $("orderTypeDelivery"),
  deliveryFields: $("deliveryFields"),
  deliveryName: $("deliveryName"),
  deliveryPhone: $("deliveryPhone"),
  deliveryAddress: $("deliveryAddress"),
  deliveryNote: $("deliveryNote"),
  deliveryCustomerRef: $("deliveryCustomerRef"),
  customerLookupMsg: $("customerLookupMsg"),
  customerLoyaltyLink: $("customerLoyaltyLink"),
  customerSearch: $("customerSearch"),
  customerList: $("customerList"),
  newCustomerId: $("newCustomerId"),
  newCustomerName: $("newCustomerName"),
  newCustomerPhone: $("newCustomerPhone"),
  newCustomerAddress: $("newCustomerAddress"),
  addCustomerBtn: $("addCustomerBtn"),

  shiftStatus: $("shiftStatus"),
  shiftStartCash: $("shiftStartCash"),
  openShiftBtn: $("openShiftBtn"),
  closeActualCash: $("closeActualCash"),
  closeCardTotal: $("closeCardTotal"),
  closeShiftBtn: $("closeShiftBtn"),
  shiftHistory: $("shiftHistory"),

  transCount: $("transCount"),
  revToday: $("revToday"),
  monthCount: $("monthCount"),
  revMonth: $("revMonth"),
  bestSellerMonth: $("bestSellerMonth"),
  reportNote: $("reportNote"),
  reportDay: $("reportDay"),
  reportMonth: $("reportMonth"),
  exportDaily: $("exportDaily"),
  printDailyReceipt: $("printDailyReceipt"),
  exportMonthly: $("exportMonthly"),
  dailyBreakdown: $("dailyBreakdown"),
  monthlyBreakdown: $("monthlyBreakdown"),
  exportBackup: $("exportBackup"),
  importBackup: $("importBackup"),
  backupFileInput: $("backupFileInput"),
  refundHistoryList: $("refundHistoryList"),
  auditList: $("auditList"),
};

const LANGUAGE_PAGES = {
  ar: "arabic.html",
  en: "index.html",
};

function getCurrentPageFileName() {
  const fileName = window.location.pathname.split("/").pop();
  return (fileName || "index.html").toLowerCase();
}

function getCurrentPageLanguage() {
  const page = getCurrentPageFileName();
  if (page === "arabic.html") return "ar";
  return "en";
}

function applyLanguageChrome(lang) {
  const html = document.documentElement;
  if (!html) return;
  html.lang = lang === "ar" ? "ar" : "en";
  html.dir = lang === "ar" ? "rtl" : "ltr";

  el.langArBtn?.classList.toggle("active", lang === "ar");
  el.langEnBtn?.classList.toggle("active", lang === "en");
}

function localizeMenuName(name, lang = getCurrentPageLanguage()) {
  const key = String(name || "").trim();
  if (lang !== "ar") return key;
  return MENU_NAME_AR[key] || key;
}

function localizeCategoryName(category, lang = getCurrentPageLanguage()) {
  const key = String(category || "").trim();
  if (lang !== "ar") return key;
  return CATEGORY_LABELS_AR[key] || key;
}

function setupLanguageToggle() {
  const currentLang = getCurrentPageLanguage();
  const preferredLang = localStorage.getItem("ftayelPosLang") || localStorage.getItem("celinaPosLang");

  if (preferredLang && preferredLang !== currentLang && LANGUAGE_PAGES[preferredLang]) {
    const target = LANGUAGE_PAGES[preferredLang];
    if (target.toLowerCase() !== getCurrentPageFileName()) {
      window.location.href = target;
      return true;
    }
  }

  applyLanguageChrome(currentLang);

  const switchLanguage = (lang) => {
    localStorage.setItem("ftayelPosLang", lang);
    applyLanguageChrome(lang);
    const target = LANGUAGE_PAGES[lang];
    if (!target) return;
    if (target.toLowerCase() === getCurrentPageFileName()) return;
    window.location.href = target;
  };

  el.langArBtn?.addEventListener("click", () => switchLanguage("ar"));
  el.langEnBtn?.addEventListener("click", () => switchLanguage("en"));
  return false;
}

function renderViews() {
  el.views.forEach((v) => v.classList.add("hidden"));
  const activeBtn = document.querySelector(".navBtn.active");
  if (!activeBtn) return;
  $(activeBtn.dataset.view)?.classList.remove("hidden");
}

function ensureCriticalNavButtons() {
  if (!el.sidebar) return;

  const hasOnline = !!el.sidebar.querySelector(".navBtn[data-view='onlineOrders']");
  if (!hasOnline) {
    const onlineBtn = document.createElement("button");
    onlineBtn.className = "navBtn";
    onlineBtn.dataset.view = "onlineOrders";
    onlineBtn.textContent = document.documentElement.lang === "ar" ? "الطلبات الإلكترونية" : "Online Orders";

    const kitchenBtn = el.sidebar.querySelector(".navBtn[data-view='kitchen']");
    if (kitchenBtn?.nextSibling) {
      el.sidebar.insertBefore(onlineBtn, kitchenBtn.nextSibling);
    } else {
      el.sidebar.appendChild(onlineBtn);
    }
  }

  // Refresh nav references in case buttons were injected.
  el.navBtns = [...document.querySelectorAll(".navBtn")];
}

function setActiveNav(view, force = false) {
  if (!force && !canAccessView(view)) {
    alert("You do not have access to this section.");
    return;
  }

  state.activeView = view;
  el.navBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
  localStorage.setItem("ftayelPosLastView", view);
  renderViews();
  saveState();
}

function applyRoleVisibility() {
  el.navBtns.forEach((btn) => {
    const visible = canAccessView(btn.dataset.view);
    btn.style.display = visible ? "block" : "none";
  });

  const activeBtn = document.querySelector(".navBtn.active");
  if (!activeBtn || activeBtn.style.display === "none") {
    setActiveNav("pos", true);
  }

  // Hide manager/admin-only sections within POS for cashier role
  const isMgr = isManagerOrAdmin();
  const cashierHidden = document.querySelectorAll(".manager-only");
  cashierHidden.forEach(el => { el.style.display = isMgr ? "" : "none"; });
}

function setDashboardVisibility() {
  const signedIn = isSignedIn();
  el.loginPanel.style.display = signedIn ? "none" : "block";
  el.sidebar.style.display = signedIn ? "flex" : "none";
  el.logoutBtn.style.display = signedIn ? "inline-flex" : "none";
  el.layout?.classList.toggle("signed-out", !signedIn);

  if (!signedIn) {
    el.views.forEach((v) => v.classList.add("hidden"));
  } else {
    renderViews();
  }
}

function updateRoleDisplay() {
  if (!isSignedIn()) {
    el.currentRole.textContent = "Guest";
    el.loginMsg.textContent = "Please login.";
    el.reportNote.textContent = "Manager/Admin-only page.";
    if (el.loginUsername) {
      el.loginUsername.disabled = false;
      el.loginUsername.readOnly = false;
      el.loginUsername.value = "";
    }
    if (el.loginPassword) {
      el.loginPassword.disabled = false;
      el.loginPassword.readOnly = false;
      el.loginPassword.value = "";
    }
    setTimeout(() => {
      try { el.loginUsername?.focus(); } catch (_) { /* ignore */ }
    }, 0);
    setDashboardVisibility();
    return;
  }

  el.currentRole.textContent = `${state.currentUser.name} (${state.currentUser.role})`;
  el.loginMsg.textContent = `Logged in as ${state.currentUser.name} (${state.currentUser.role})`;
  el.reportNote.textContent = isManagerOrAdmin() ? "Access granted." : "Manager/Admin-only page.";

  applyRoleVisibility();
  setDashboardVisibility();
}

function loginWithCredentials(username, password) {
  const user = state.users.find((u) => u.name === username && u.password === password);
  if (!user) {
    el.loginMsg.textContent = "Invalid username or password.";
    return false;
  }
  state.currentUser = { name: user.name, role: user.role };
  addAudit("LOGIN", `User ${user.name} signed in`);
  saveState();
  return true;
}

function logout() {
  if (!state.currentUser) return;
  addAudit("LOGOUT", `User ${state.currentUser.name} signed out`);
  state.currentUser = null;
  state.order = [];
  state._activeOrderIdx = null;
  saveState();
  renderOrder();
  renderModifierArea();
  updateRoleDisplay();
}

function resetToFactoryDefaults() {
  localStorage.removeItem("celinaPosState");
  localStorage.removeItem("celinaPosStateV2");
  localStorage.removeItem("celinaPosLastView");
  localStorage.removeItem("ftayelPosStateV2");
  localStorage.removeItem("ftayelPosLastView");
  localStorage.removeItem("ftayelPosLang");

  state.users = [...DEFAULT_USERS];
  state.currentUser = null;
  state.categories = [...DEFAULT_CATEGORIES];
  state.selectedCategory = "All";
  state.currency = "lbp";
  state.menu = [...DEFAULT_MENU_ITEMS];
  state.inventory = [
    { id: 1, name: "Tomatoes", category: "Produce", qty: 20, alert: 7 },
    { id: 2, name: "Flour", category: "Dry", qty: 15, alert: 5 },
  ];
  state.order = [];
  state.posConfig = {
    discountType: "none",
    discountValue: 0,
    serviceChargePct: 0,
    taxMode: "exclusive",
    taxRate: TAX_RATE,
    paymentMethod: "cash",
  };
  state.reports = { daily: [], monthly: [] };
  state.kitchenTickets = [];
  state.onlineOrders = [];
  state.onlineOrdersConfig = {
    endpoint: DEFAULT_ONLINE_ENDPOINT,
    authToken: "",
    lastSyncAt: "",
  };
  state.shifts = { active: null, history: [] };
  state.auditLog = [];
  state.refunds = [];
  state.lastTransaction = null;
  state.activeView = "pos";
  state.customers = [];
  state.orderCounter = 0;
  state.heldOrders = [];
  state._activeOrderIdx = null;

  partialRefundContext = null;
  lastKnownPendingCount = 0;

  applyAllRenders();
  saveState();
}

function renderCategoryFilters() {
  el.categoryFilters.innerHTML = "";
}

function renderMenu() {
  const lang = getCurrentPageLanguage();
  const items = state.menu;

  // All menu items in a single flat grid
  let html = items.map(item =>
    `<div class="menu-btn menu-item-btn" data-id="${item.id}">
      <div class="menu-btn-name">${escapeHtml(localizeMenuName(item.name, lang))}</div>
      <div class="menu-btn-price">${formatMoney(item.price)}</div>
    </div>`
  ).join("");

  // Modifier area appears below menu grid only when an item is selected
  html += '<div id="modifierArea" class="modifier-area"></div>';

  el.menuItems.innerHTML = html;

  el.menuItems.querySelectorAll(".menu-btn[data-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const itemId = Number(btn.dataset.id);
      addToOrder(itemId, 1);
    });
  });
}

function addToOrder(id, quantity = 1) {
  if (!isSignedIn()) return alert("Please sign in first.");

  const qtyToAdd = Math.max(1, Math.floor(Number(quantity) || 1));

  const item = state.menu.find((m) => m.id === id);
  if (!item) return;

  const defaultMods = getDefaultModifiersForItem(item.name);

  // Always add as a new line; items with same id AND same modifiers will be grouped in renderOrder display
  state.order.push({
    id: item.id,
    name: item.name,
    price: Number(item.price),
    qty: qtyToAdd,
    note: "",
    modifiers: [...defaultMods],
  });

  // Set this as the active item for modifier editing
  state._activeOrderIdx = state.order.length - 1;

  renderOrder();
  renderModifierArea();
}

function removeFromOrder(id, quantity = 1) {
  if (!isSignedIn()) return alert("Please sign in first.");

  const qtyToRemove = Math.max(1, Math.floor(Number(quantity) || 1));
  const existing = state.order.find((o) => o.id === id && (!o.note || o.note.trim() === "") && (!o.modifiers || o.modifiers.length === 0));
  if (!existing) return;

  existing.qty -= qtyToRemove;
  if (existing.qty <= 0) {
    const idx = state.order.indexOf(existing);
    if (idx >= 0) state.order.splice(idx, 1);
  }

  renderOrder();
}

function renderModifierArea() {
  const area = document.getElementById("modifierArea");
  if (!area) return;

  const idx = state._activeOrderIdx;
  if (idx == null || !state.order[idx]) {
    area.innerHTML = "";
    return;
  }

  const orderItem = state.order[idx];
  const defaultMods = getDefaultModifiersForItem(orderItem.name);
  const allMods = defaultMods.length ? defaultMods : MODIFIER_PRESETS;
  const isArabicUi = getCurrentPageLanguage() === "ar";
  const withoutLabel = isArabicUi ? "بدون" : "Without";

  let html = `<h4 style="margin-top:10px; color:#ddd;">${escapeHtml(localizeMenuName(orderItem.name))} - ${isArabicUi ? "التعديلات" : "Modifiers"}</h4>`;
  html += '<div class="modifier-grid">';
  allMods.forEach(mod => {
    const modIndex = MODIFIER_PRESETS.indexOf(mod);
    const label = isArabicUi && modIndex >= 0 ? MODIFIER_PRESETS_AR[modIndex] : mod;
    const isRemoved = !orderItem.modifiers?.includes(mod);
    const cls = isRemoved ? " removed" : "";
    html += `<div class="menu-btn modifier-btn${cls}" data-mod-val="${escapeHtml(mod)}">${isRemoved ? withoutLabel + " " : ""}${escapeHtml(label)}</div>`;
  });
  html += '</div>';

  area.innerHTML = html;

  area.querySelectorAll(".modifier-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.modVal;
      const target = state.order[idx];
      if (!target) return;
      target.modifiers = Array.isArray(target.modifiers) ? target.modifiers : [];
      if (target.modifiers.includes(val)) {
        target.modifiers = target.modifiers.filter(m => m !== val);
      } else {
        target.modifiers.push(val);
      }
      renderOrder();
      renderModifierArea();
    });
  });
}

function computeTotals(order = state.order) {
  const subtotal = order.reduce((sum, o) => sum + Number(o.qty) * Number(o.price), 0);

  let discountAmount = 0;
  if (state.posConfig.discountType === "percent") {
    discountAmount = subtotal * (Number(state.posConfig.discountValue || 0) / 100);
  } else if (state.posConfig.discountType === "fixed") {
    discountAmount = Number(state.posConfig.discountValue || 0);
  }
  discountAmount = Math.max(0, Math.min(discountAmount, subtotal));

  const afterDiscount = subtotal - discountAmount;
  const serviceAmount = afterDiscount * (Number(state.posConfig.serviceChargePct || 0) / 100);
  const taxableBase = Math.max(0, afterDiscount + serviceAmount);

  // Cash sales are configured as tax-free.
  if (state.posConfig.paymentMethod === "cash") {
    return {
      subtotal,
      discountAmount,
      serviceAmount,
      tax: 0,
      total: taxableBase,
    };
  }

  let tax = 0;
  let total = 0;
  if (state.posConfig.taxMode === "inclusive") {
    total = taxableBase;
    tax = taxableBase * (state.posConfig.taxRate / (1 + state.posConfig.taxRate));
  } else {
    tax = taxableBase * state.posConfig.taxRate;
    total = taxableBase + tax;
  }

  return {
    subtotal,
    discountAmount,
    serviceAmount,
    tax,
    total,
  };
}

function renderOrder() {
  if (!state.order.length) {
    el.orderItems.innerHTML = "<div class=\"text-muted\">No items yet.</div>";
  } else {
    const isArabicUi = getCurrentPageLanguage() === "ar";
    const withoutLabel = isArabicUi ? "بدون" : "No";

    el.orderItems.innerHTML = state.order
      .map((o, idx) => {
        const itemName = localizeMenuName(o.name);
        const allMods = getDefaultModifiersForItem(o.name);
        // "Removed" modifiers = default mods that are NOT in current modifiers
        const removedMods = allMods.filter(m => !o.modifiers?.includes(m));
        const removedLabels = removedMods.map(m => {
          const mi = MODIFIER_PRESETS.indexOf(m);
          return (isArabicUi && mi >= 0 ? MODIFIER_PRESETS_AR[mi] : m);
        });
        const modText = removedLabels.length ? `<div class="order-mods">${removedLabels.map(l => withoutLabel + " " + escapeHtml(l)).join(" / ")}</div>` : "";

        return `<div class="order-line" data-order-idx="${idx}">
          <div style="flex:1; cursor:pointer;" data-select-idx="${idx}">
            <div>×${o.qty} ${escapeHtml(itemName)} <span style="color:#aaa; font-size:0.9rem;">${formatMoney(o.price * o.qty)}</span></div>
            ${modText}
          </div>
          <button class="order-line-remove" data-remove-idx="${idx}" type="button">✕</button>
        </div>`;
      })
      .join("");
  }

  // Select item for modifier editing
  el.orderItems.querySelectorAll("[data-select-idx]").forEach(div => {
    div.addEventListener("click", () => {
      const idx = Number(div.dataset.selectIdx);
      state._activeOrderIdx = idx;
      renderModifierArea();
      // Highlight active
      el.orderItems.querySelectorAll(".order-line").forEach(l => l.style.borderColor = "#3a3a00");
      const line = el.orderItems.querySelector(`.order-line[data-order-idx="${idx}"]`);
      if (line) line.style.borderColor = "var(--accent)";
    });
  });

  el.orderItems.querySelectorAll("button[data-remove-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.removeIdx);
      if (!state.order[idx]) return;
      state.order[idx].qty -= 1;
      if (state.order[idx].qty <= 0) state.order.splice(idx, 1);
      if (state._activeOrderIdx === idx) {
        state._activeOrderIdx = null;
        renderModifierArea();
      }
      renderOrder();
    });
  });

  const totals = computeTotals();
  el.subtotal.textContent = formatMoney(totals.subtotal);
  el.discount.textContent = formatMoney(totals.discountAmount);
  el.service.textContent = formatMoney(totals.serviceAmount);
  el.tax.textContent = formatMoney(totals.tax);
  el.total.textContent = formatMoney(totals.total);
  const modeLabel = state.posConfig.paymentMethod === "cash"
    ? "Tax (cash: 0%)"
    : (state.posConfig.taxMode === "inclusive" ? "Tax (8% incl)" : "Tax (8% excl)");
  el.taxLabel.innerHTML = `${modeLabel}: <span id="tax">${formatMoney(totals.tax)}</span>`;
  el.tax = $("tax");
}

function buildItemDisplayLines(item, includePrice, includeModifiers = true, lang = null) {
  const lines = [];
  const amount = includePrice ? ` - ${formatMoney(item.price * item.qty)}` : "";
  const itemName = localizeMenuName(item.name, lang || getCurrentPageLanguage());
  lines.push(`${item.qty}x ${itemName}${amount}`);
  if (includeModifiers) {
    const selectedMods = Array.isArray(item.modifiers) ? item.modifiers : [];
    const defaultMods = getDefaultModifiersForItem(item.name);
    const isArabic = lang === "ar";
    const toLabel = (mod) => {
      const idx = MODIFIER_PRESETS.indexOf(mod);
      return (isArabic && idx >= 0) ? MODIFIER_PRESETS_AR[idx] : mod;
    };
    const removedLabels = defaultMods
      .filter((m) => !selectedMods.includes(m))
      .map(toLabel);
    if (removedLabels.length) {
      lines.push(`  ${isArabic ? "بدون" : "No"}: ${removedLabels.join(" / ")}`);
    }
  }
  if (item.note && item.note.trim()) {
    const noteLabel = (lang === "ar") ? "ملاحظة" : "Note";
    lines.push(`  ${noteLabel}: ${item.note.trim()}`);
  }
  return lines;
}

function buildCustomerReceiptLines(transaction) {
  const lines = [
    "Fatayel & More",
    `Date: ${new Date(transaction.date).toLocaleString()}`,
    `Cashier: ${transaction.cashier}`,
    `Payment: ${transaction.paymentMethod.toUpperCase()}`,
    `Type: ${transaction.orderType === "delivery" ? "DELIVERY" : "DINE-IN"}`,
  ];
  if (transaction.delivery) {
    lines.push("----------------------------");
    if (transaction.delivery.customerId) lines.push(`Customer ID: ${transaction.delivery.customerId}`);
    lines.push(`Customer: ${transaction.delivery.name}`);
    lines.push(`Phone: ${transaction.delivery.phone}`);
    lines.push(`Address: ${transaction.delivery.address}`);
    if (transaction.delivery.note) lines.push(`Note: ${transaction.delivery.note}`);
  }
  lines.push("----------------------------");
  lines.push(...transaction.items.flatMap((i) => buildItemDisplayLines(i, true, false)));
  lines.push("----------------------------");
  lines.push(`Subtotal: ${formatMoney(transaction.subtotal)}`);
  lines.push(`Discount: ${formatMoney(transaction.discountAmount)}`);
  lines.push(`Service: ${formatMoney(transaction.serviceAmount)}`);
  lines.push(`Tax: ${formatMoney(transaction.tax)}`);
  lines.push(`Total: ${formatMoney(transaction.total)}`);
  lines.push("Thank you!");
  return lines;
}

function buildKitchenTicketLines(ticket) {
  const typeAr = ticket.orderType === "delivery" ? "توصيل" : "داخلي";

  const lines = [
    "============================",
    ticket.orderNumber ? `رقم الطلب: ${ticket.orderNumber}` : `#${ticket.id}`,
    `${typeAr}`,
    "============================",
  ];
  lines.push(...ticket.items.flatMap((i) => buildItemDisplayLines(i, false, true, "ar")));
  return lines;
}

function renderReceiptPreview() {
  if (!state.lastTransaction) {
    el.receiptPreview.textContent = "No receipt yet.";
    return;
  }
  el.receiptPreview.textContent = buildCustomerReceiptLines(state.lastTransaction).join("\n");
}

function printLines(lines) {
  const content = `
    <div style="padding:12px;">
      <pre style="font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.35; margin:0;">${escapeHtml(lines.join("\n"))}</pre>
    </div>
  `;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8" /></head><body>${content}</body></html>`;
  printHtmlDocument(html);
}

function printHtmlDocument(html) {
  // Silent print using hidden iframe — no popup dialog
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-99999px";
  iframe.style.top = "-99999px";
  iframe.style.width = "420px";
  iframe.style.height = "760px";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  const doPrint = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (_) {
      // fallback: try window.print
    }
    setTimeout(() => {
      try { iframe.remove(); } catch (_) { /* ignore */ }
    }, 1500);
  };

  // Wait for content to load then print
  const images = Array.from(doc.images || []);
  if (images.length && images.some(img => !img.complete)) {
    let checks = 0;
    const waitForImages = () => {
      checks++;
      if (checks > 30 || images.every(img => img.complete)) {
        doPrint();
        return;
      }
      setTimeout(waitForImages, 100);
    };
    setTimeout(waitForImages, 100);
  } else {
    setTimeout(doPrint, 300);
  }
}

function getMenuQrImageSrc() {
  const menuUrl = "https://www.instagram.com/ftylnmore";
  if (window.QRCode && document.body) {
    const holder = document.createElement("div");
    holder.style.position = "fixed";
    holder.style.left = "-99999px";
    holder.style.top = "-99999px";
    document.body.appendChild(holder);
    try {
      new window.QRCode(holder, {
        text: menuUrl,
        width: 160,
        height: 160,
        correctLevel: window.QRCode.CorrectLevel.M,
      });
      const canvas = holder.querySelector("canvas");
      if (canvas) {
        const src = canvas.toDataURL("image/png");
        holder.remove();
        return src;
      }
      const img = holder.querySelector("img");
      if (img?.src) {
        const src = img.src;
        holder.remove();
        return src;
      }
    } catch (_err) {
      // fallback below
    }
    holder.remove();
  }
  return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(menuUrl)}`;
}

function buildKitchenTicketHTML(ticket) {
  const typeAr = ticket.orderType === "delivery" ? "توصيل" : "داخلي";
  const orderNum = ticket.orderNumber || ticket.id;

  const itemsHtml = ticket.items.map(item => {
    const itemName = localizeMenuName(item.name, "ar");
    const selectedMods = Array.isArray(item.modifiers) ? item.modifiers : [];
    const defaultMods = getDefaultModifiersForItem(item.name);
    const toAr = (mod) => {
      const mi = MODIFIER_PRESETS.indexOf(mod);
      return mi >= 0 ? MODIFIER_PRESETS_AR[mi] : mod;
    };
    const removedLabels = defaultMods.filter((m) => !selectedMods.includes(m)).map(toAr);
    const modifierLines = [];
    if (removedLabels.length) modifierLines.push(`بدون: ${removedLabels.join(" / ")}`);
    const modLine = modifierLines
      .map((line) => `<div style="font-size:24px; font-weight:900; color:#000; background:#f1f1f1; border:2px solid #000; border-radius:6px; padding:4px 8px; margin:4px 0 10px 20px;">${escapeHtml(line)}</div>`)
      .join("");
    const noteLine = item.note?.trim()
      ? `<div style="font-size:21px; font-weight:800; color:#111; border:1px dashed #333; border-radius:6px; padding:4px 8px; margin:2px 0 8px 20px;">ملاحظة: ${escapeHtml(item.note)}</div>`
      : "";
    return `<div style="font-size:28px; font-weight:900; margin:10px 0 2px;">×${item.qty} ${escapeHtml(itemName)}</div>${modLine}${noteLine}`;
  }).join("");

  return `
    <div style="padding:16px; font-family: Arial, sans-serif; direction:rtl; text-align:right;">
      <div style="text-align:center; font-size:48px; font-weight:900; margin:10px 0; letter-spacing:2px;">#${orderNum}</div>
      <div style="text-align:center; font-size:32px; font-weight:900; margin:6px 0 16px; border:3px solid #000; display:inline-block; padding:6px 24px; border-radius:8px;">${escapeHtml(typeAr)}</div>
      <hr style="border:2px solid #000; margin:12px 0;" />
      ${itemsHtml}
    </div>
  `;
}

function buildCustomerReceiptHTML(transaction) {
  const lang = getCurrentPageLanguage();
  const items = transaction.items
    .map((item) => {
      const selectedMods = Array.isArray(item.modifiers) ? item.modifiers : [];
      const defaultMods = getDefaultModifiersForItem(item.name);
      const isArabic = lang === "ar";
      const toLabel = (mod) => {
        const idx = MODIFIER_PRESETS.indexOf(mod);
        return (isArabic && idx >= 0) ? MODIFIER_PRESETS_AR[idx] : mod;
      };
      const removedLabels = defaultMods.filter((m) => !selectedMods.includes(m)).map(toLabel);
      const modParts = [];
      if (removedLabels.length) modParts.push(`${isArabic ? "بدون" : "No"} ${removedLabels.join(" / ")}`);
      const modText = modParts.join(" / ");
      return `
        <tr>
          <td style="text-align:left;"><strong>${escapeHtml(localizeMenuName(item.name, lang))}</strong></td>
          <td style="text-align:center;">${item.qty}</td>
          <td style="text-align:right;">${formatMoney(item.price * item.qty)}</td>
        </tr>
        ${modText ? `<tr class="mod-row"><td colspan="3">↳ ${escapeHtml(modText)}</td></tr>` : ""}
      `;
    })
    .join("");

  const qrUrl = getMenuQrImageSrc();

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 8px; background: white; font-size: 14px; }
        .receipt { width: 300px; margin: 0 auto; text-align: center; }
        .qr { margin: 4px 0 2px; }
        .qr img { max-width: 110px; height: auto; }
        .qr-label { font-size: 0.78rem; color: #666; margin-bottom: 2px; font-weight: 700; }
        h1 { font-size: 1.35rem; margin: 4px 0 2px; font-weight: 900; letter-spacing: 0.8px; text-transform: uppercase; }
        .divider { border: none; border-top: 1px dashed #bbb; margin: 7px 0; }
        .divider-solid { border: none; border-top: 3px solid #000; margin: 10px 0; }
        .meta { font-size: 0.84rem; color: #333; margin: 2px 0; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin: 5px 0; }
        th { font-size: 0.78rem; text-transform: uppercase; color: #555; padding: 3px 2px; border-bottom: 1px solid #000; text-align: left; }
        th:last-child { text-align: right; }
        td { padding: 4px 2px; border-bottom: 1px solid #e0e0e0; font-size: 0.94rem; font-weight: 800; }
        td:last-child { text-align: right; white-space: nowrap; }
        .mod-row td { font-size: 0.8rem; font-weight: 700; color: #555; padding: 1px 2px 3px; border-bottom: 1px dotted #ddd; }
        .summary-table { width: 100%; margin: 4px 0; }
        .summary-table td { border: none; padding: 3px 2px; font-size: 0.9rem; font-weight: 800; }
        .summary-table td:last-child { text-align: right; }
        .total-line { font-size: 1.2rem; font-weight: 900; }
        .delivery-box { text-align: left; background: #f5f5f5; border-radius: 5px; padding: 5px 7px; margin: 5px 0; font-size: 0.82rem; font-weight: 700; }
        .footer { margin-top: 6px; font-size: 0.78rem; color: #555; font-weight: 700; }
        .footer .thanks { font-size: 0.9rem; font-weight: 900; color: #000; margin-bottom: 2px; }
        @media print {
          body { padding: 0; }
          .receipt { width: 100%; }
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="qr">
          <img src="${qrUrl}" alt="Menu QR Code" />
          <div class="qr-label">Instagram: @ftylnmore</div>
        </div>
        <h1>Fatayel & More</h1>
        <hr class="divider" />
        ${transaction.orderNumber ? `<div style="font-size:1.5rem; font-weight:900; letter-spacing:1px; margin:3px 0;">#${transaction.orderNumber}</div>` : ""}
        <div class="meta">${new Date(transaction.date).toLocaleString()}</div>
        <div class="meta">${transaction.paymentMethod.toUpperCase()} | ${transaction.orderType === "delivery" ? "DELIVERY" : "DINE-IN/TAKEAWAY"}</div>

        ${transaction.delivery ? `
          <div class="delivery-box">
            👤 ${transaction.delivery.name}<br>
            📞 ${transaction.delivery.phone}<br>
            📍 ${transaction.delivery.address}
            ${transaction.delivery.note ? `<br>📝 ${transaction.delivery.note}` : ""}
          </div>
        ` : ""}

        <hr class="divider" />
        <table>
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Price</th></tr>
          </thead>
          <tbody>
            ${items}
          </tbody>
        </table>

        <hr class="divider" />
        <table class="summary-table">
          <tr><td>Subtotal</td><td>${formatMoney(transaction.subtotal)}</td></tr>
          ${transaction.discountAmount > 0 ? `<tr><td>Discount</td><td>- ${formatMoney(transaction.discountAmount)}</td></tr>` : ""}
          ${transaction.serviceAmount > 0 ? `<tr><td>Service Charge</td><td>${formatMoney(transaction.serviceAmount)}</td></tr>` : ""}
          ${transaction.tax > 0 ? `<tr><td>Tax</td><td>${formatMoney(transaction.tax)}</td></tr>` : ""}
        </table>
        <hr class="divider-solid" />
        <table class="summary-table">
          <tr class="total-line"><td>TOTAL</td><td>${formatMoney(transaction.total)}</td></tr>
        </table>

        <hr class="divider" />
        <div class="footer">
          <div class="thanks">Thank you!</div>
          <div>@ftylnmore</div>
        </div>
      </div>
    </body>
    </html>
  `;
  return html;
}

function printCustomerReceipt(transaction) {
  const html = buildCustomerReceiptHTML(transaction);
  printHtmlDocument(html);
}

function printKitchenReceipt(ticket) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8" /></head><body>${buildKitchenTicketHTML(ticket)}</body></html>`;
  printHtmlDocument(html);
}

function printOrderReceipts(ticket, transaction) {
  const kitchenBlock = buildKitchenTicketHTML(ticket);
  const customerHtml = buildCustomerReceiptHTML(transaction);
  const customerStyle = (customerHtml.match(/<style>([\s\S]*?)<\/style>/i) || ["", ""])[1];
  const customerBody = (customerHtml.match(/<body>([\s\S]*?)<\/body>/i) || ["", ""])[1];

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        @page { margin: 0; }
        body { margin: 0; background: #fff; }
        .receipt-page { width: 100%; min-height: 1px; }
        .page-break { page-break-before: always; break-before: page; }
        ${customerStyle}
      </style>
    </head>
    <body>
      <div class="receipt-page">${kitchenBlock}</div>
      <div class="page-break"></div>
      <div class="receipt-page">${customerBody}</div>
    </body>
    </html>
  `;

  printHtmlDocument(html);
}

let drawerSerialPort = null;

async function openCashDrawer() {
  if (!("serial" in navigator)) return false;
  try {
    if (!drawerSerialPort) {
      const remembered = await navigator.serial.getPorts();
      drawerSerialPort = remembered[0] || null;
    }
    if (!drawerSerialPort) {
      // Called from pay button click, so the browser can show the port picker.
      drawerSerialPort = await navigator.serial.requestPort();
    }
    if (!drawerSerialPort.readable && !drawerSerialPort.writable) {
      await drawerSerialPort.open({ baudRate: 9600 });
    }

    const writer = drawerSerialPort.writable.getWriter();
    // ESC p m t1 t2 = pulse command used by most receipt printers to open drawer.
    const pulse = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);
    await writer.write(pulse);
    writer.releaseLock();
    return true;
  } catch (err) {
    console.warn("Cash drawer signal failed", err);
    return false;
  }
}

function createKitchenTicket(transaction) {
  const ticket = {
    id: Date.now(),
    orderNumber: transaction.orderNumber || null,
    transactionId: transaction.id,
    date: transaction.date,
    orderType: transaction.orderType || "dine-in",
    delivery: transaction.delivery ? deepClone(transaction.delivery) : null,
    status: "new",
    items: deepClone(transaction.items),
  };
  state.kitchenTickets.unshift(ticket);
  addAudit("KITCHEN_TICKET_CREATED", `Ticket #${ticket.id} created from order #${transaction.id}`);
  return ticket;
}

function createKitchenTicketFromOnlineOrder(order) {
  const ticket = {
    id: Date.now() + Math.floor(Math.random() * 999),
    transactionId: order.transactionId || null,
    onlineOrderId: order.id,
    date: new Date().toISOString(),
    orderType: "delivery",
    delivery: {
      customerRef: order.customer?.customerRef || "",
      name: order.customer?.name || "Online Customer",
      phone: order.customer?.phone || "",
      address: order.customer?.address || "",
      note: order.customer?.note || order.note || "",
    },
    status: "new",
    items: deepClone(order.items || []),
  };
  state.kitchenTickets.unshift(ticket);
  addAudit("ONLINE_ORDER_TO_KITCHEN", `Online order ${order.externalId || order.id} sent to kitchen`);
  return ticket;
}

function buildTransactionFromOnlineOrder(order) {
  return {
    id: Date.now(),
    date: new Date().toISOString(),
    cashier: state.currentUser?.name || "cashier",
    role: state.currentUser?.role || "cashier",
    shiftId: state.shifts.active?.id || null,
    paymentMethod: order.paymentType === ONLINE_PAYMENT_TYPES.CARD ? "card" : "cash",
    orderType: "delivery",
    source: "website",
    onlineOrderId: order.externalId || order.id,
    delivery: {
      customerRef: order.customer?.customerRef || "",
      name: order.customer?.name || "Online Customer",
      phone: order.customer?.phone || "",
      address: order.customer?.address || "",
      note: order.customer?.note || "",
    },
    items: deepClone(order.items || []),
    subtotal: Number(order.subtotal || 0),
    discountAmount: Number(order.discountAmount || 0),
    serviceAmount: Number(order.serviceAmount || 0),
    tax: Number(order.tax || 0),
    total: Number(order.total || 0),
  };
}

function getPendingOnlineOrdersCount() {
  return state.onlineOrders.filter((order) => order.status === "new").length;
}

function updateOnlineOrdersBadge() {
  const pending = getPendingOnlineOrdersCount();
  const onlineBtn = el.navBtns.find((btn) => btn.dataset.view === "onlineOrders");
  if (!onlineBtn) return;
  if (!onlineBtn.dataset.baseLabel) onlineBtn.dataset.baseLabel = onlineBtn.textContent.trim();
  const base = onlineBtn.dataset.baseLabel;
  onlineBtn.textContent = pending > 0 ? `${base} (${pending})` : base;
}

function notifyCashierNewOnlineOrders(newCount) {
  if (newCount <= 0) return;
  const message = `${newCount} new online order${newCount > 1 ? "s" : ""} waiting in Pending.`;
  if (el.onlineOrdersStatus) el.onlineOrdersStatus.textContent = message;
  try {
    const audio = new Audio("data:audio/wav;base64,UklGRjwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRgAAAAAAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8=");
    audio.play().catch(() => {});
  } catch (_err) {
    // No-op: audio support varies by browser/runtime.
  }
}

async function pushOnlineOrderStatus(order) {
  const endpoint = String(state.onlineOrdersConfig.endpoint || "").trim();
  if (!endpoint) return;

  try {
    const headers = { "Content-Type": "application/json" };
    const token = String(state.onlineOrdersConfig.authToken || "").trim();
    if (token) headers.Authorization = `Bearer ${token}`;

    await fetch(`${endpoint.replace(/\/$/, "")}/${encodeURIComponent(order.externalId || order.id)}/status`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        status: order.status,
        paymentStatus: order.paymentStatus,
        transactionId: order.transactionId,
      }),
    });
  } catch (err) {
    console.warn("Could not push online order status", err);
  }
}

function normalizeOnlinePaymentType(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["online_card", "card", "paid", "prepaid", "credit_card", "card_paid"].includes(raw)) {
    return ONLINE_PAYMENT_TYPES.CARD;
  }
  return ONLINE_PAYMENT_TYPES.COD;
}


function normalizeOnlineOrderItem(rawItem, fallbackIdx) {
  const name = String(rawItem?.name || rawItem?.title || rawItem?.item || `Item ${fallbackIdx + 1}`).trim();
  const qty = Math.max(1, Number(rawItem?.qty || rawItem?.quantity || 1) || 1);
  const price = Number(rawItem?.price || rawItem?.unitPrice || rawItem?.amount || 0) || 0;
  return {
    id: Date.now() + fallbackIdx,
    name,
    category: String(rawItem?.category || "Online"),
    price,
    qty,
    note: String(rawItem?.note || rawItem?.instruction || ""),
    modifiers: Array.isArray(rawItem?.modifiers) ? rawItem.modifiers.map((m) => String(m)) : [],
  };
}

function normalizeOnlineOrder(raw) {
  const sourceId = String(raw?.id || raw?.orderId || raw?.reference || raw?.number || "").trim();
  const itemsRaw = Array.isArray(raw?.items) ? raw.items : [];
  const items = itemsRaw.map((item, idx) => normalizeOnlineOrderItem(item, idx)).filter((item) => item.name);
  if (!sourceId || !items.length) return null;

  const subtotalFromItems = items.reduce((sum, item) => sum + Number(item.qty) * Number(item.price), 0);
  const subtotal = Number(raw?.subtotal ?? subtotalFromItems) || subtotalFromItems;
  const discountAmount = Math.max(0, Number(raw?.discountAmount ?? raw?.discount ?? 0) || 0);
  const serviceAmount = Math.max(0, Number(raw?.serviceAmount ?? raw?.service ?? 0) || 0);
  const tax = Math.max(0, Number(raw?.tax ?? 0) || 0);
  const total = Number(raw?.total ?? (subtotal - discountAmount + serviceAmount + tax)) || (subtotal - discountAmount + serviceAmount + tax);

  const customerRaw = raw?.customer || {};
  const paymentType = normalizeOnlinePaymentType(raw?.paymentType || raw?.payment_method || raw?.payment || raw?.paymentMode);
  const status = String(raw?.status || "new").toLowerCase();

  return {
    id: `online-${sourceId.toLowerCase()}`,
    externalId: sourceId,
    source: String(raw?.source || "website"),
    createdAt: String(raw?.createdAt || raw?.date || new Date().toISOString()),
    status: ["new", "preparing", "out_for_delivery", "completed", "cancelled"].includes(status) ? status : "new",
    paymentType,
    paymentStatus: paymentType === ONLINE_PAYMENT_TYPES.CARD ? "paid" : "pending",
    customer: {
      customerRef: String(customerRaw?.customerRef || customerRaw?.id || raw?.customerRef || ""),
      name: String(customerRaw?.name || raw?.customerName || "Online Customer"),
      phone: String(customerRaw?.phone || raw?.phone || ""),
      address: String(customerRaw?.address || raw?.address || ""),
      note: String(customerRaw?.note || raw?.note || ""),
    },
    items,
    subtotal,
    discountAmount,
    serviceAmount,
    tax,
    total,
    transactionId: null,
    kitchenTicketId: null,
  };
}

function upsertOnlineOrder(order) {
  const idx = state.onlineOrders.findIndex((o) => o.id === order.id);
  if (idx >= 0) {
    const existing = state.onlineOrders[idx];
    state.onlineOrders[idx] = {
      ...existing,
      ...order,
      transactionId: existing.transactionId || order.transactionId || null,
      kitchenTicketId: existing.kitchenTicketId || order.kitchenTicketId || null,
    };
    return "updated";
  }
  state.onlineOrders.unshift(order);
  return "added";
}

function importOnlineOrders(rawOrders) {
  const source = Array.isArray(rawOrders)
    ? rawOrders
    : Array.isArray(rawOrders?.orders)
      ? rawOrders.orders
      : rawOrders
        ? [rawOrders]
        : [];

  let added = 0;
  let updated = 0;
  const newOrders = [];
  source.forEach((raw) => {
    const normalized = normalizeOnlineOrder(raw);
    if (!normalized) return;
    const result = upsertOnlineOrder(normalized);
    if (result === "added") {
      added += 1;
      newOrders.push(normalized);
    }
    if (result === "updated") updated += 1;
  });

  if (!added && !updated) return { added: 0, updated: 0, newOrders: [] };

  state.onlineOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  addAudit("ONLINE_ORDERS_IMPORTED", `Online orders imported: ${added} added, ${updated} updated`);
  return { added, updated, newOrders };
}

function renderOnlineOrders() {
  if (!el.onlineOrdersList) return;

  if (el.onlineEndpoint) el.onlineEndpoint.value = state.onlineOrdersConfig.endpoint || "";
  if (el.onlineToken) el.onlineToken.value = state.onlineOrdersConfig.authToken || "";
  if (el.onlineOrdersStatus && state.onlineOrdersConfig.lastSyncAt) {
    el.onlineOrdersStatus.textContent = `Last sync: ${new Date(state.onlineOrdersConfig.lastSyncAt).toLocaleString()}`;
  }

  const visibleOrders = state.onlineOrders;

  if (!visibleOrders.length) {
    const msg = state.onlineOrders.length
      ? "No orders match current filter."
      : "No online orders yet. Sync endpoint or import JSON.";
    el.onlineOrdersList.innerHTML = `<div class="text-muted">${msg}</div>`;
    return;
  }

  const statusLabel = {
    new: "NEW",
    preparing: "PREPARING",
    out_for_delivery: "OUT FOR DELIVERY",
    completed: "COMPLETED",
    cancelled: "CANCELLED",
  };

  el.onlineOrdersList.innerHTML = visibleOrders
    .map((order) => {
      const paymentText = order.paymentType === ONLINE_PAYMENT_TYPES.CARD ? "ONLINE CARD" : "CASH ON DELIVERY";
      const paymentMethodText = order.paymentType === ONLINE_PAYMENT_TYPES.CARD ? "card" : "cash";
      const canComplete = order.status !== "completed" && order.status !== "cancelled";
      const canSendKitchen = order.status === "new";
      const canMarkOut = order.status === "preparing";
      const canCancel = order.status !== "completed" && order.status !== "cancelled";
      const canAccept = order.status === "new";

      return `<div class="card" style="margin-bottom:10px; border-color:#4a4a00;">
        <div class="inline-row" style="margin:0; justify-content:space-between; align-items:flex-start;">
          <div>
            <strong>Website Order #${escapeHtml(order.externalId || order.id)}</strong>
            <div class="text-muted">${new Date(order.createdAt).toLocaleString()} | ${escapeHtml(order.source || "website")}</div>
          </div>
          <div style="text-align:right;">
            <span class="online-pill">${statusLabel[order.status] || "NEW"}</span>
            <div class="text-muted" style="margin-top:4px;">${paymentText} (${paymentMethodText.toUpperCase()})</div>
  
          </div>
        </div>

        <div style="margin-top:8px; line-height:1.55;">
          <div><strong>${escapeHtml(order.customer?.name || "Online Customer")}</strong></div>
          <div class="text-muted">${escapeHtml(order.customer?.phone || "No phone")} | ${escapeHtml(order.customer?.address || "No address")}</div>
          ${order.customer?.note ? `<div class="text-muted">Note: ${escapeHtml(order.customer.note)}</div>` : ""}
        </div>

        <div style="margin-top:8px; border-top:1px dashed #3a3a00; padding-top:8px;">
          ${order.items
            .map((item) => `<div><strong>${item.qty}x ${escapeHtml(item.name)}</strong> - ${formatMoney(item.price * item.qty)}</div>`)
            .join("")}
        </div>

        <div class="inline-row" style="justify-content:space-between; margin-top:10px;">
          <strong>Total: ${formatMoney(order.total)}</strong>
          <span class="text-muted">Payment: ${escapeHtml(order.paymentStatus || "pending").toUpperCase()}</span>
        </div>

        <div class="inline-row" style="margin-top:10px;">
          <button class="primary" type="button" data-online-load="${escapeHtml(order.id)}">Load to POS</button>
          ${canAccept ? `<button class="primary" type="button" data-online-accept="${escapeHtml(order.id)}">Accept & Print Delivery Receipt</button>` : ""}
          ${canSendKitchen ? `<button class="primary" type="button" data-online-kitchen="${escapeHtml(order.id)}">Send to Kitchen</button>` : ""}
          ${canMarkOut ? `<button class="primary" type="button" data-online-out="${escapeHtml(order.id)}">Mark Out for Delivery</button>` : ""}
          ${canComplete ? `<button class="primary" type="button" data-online-complete="${escapeHtml(order.id)}">Complete & Register Payment</button>` : ""}
          ${canCancel ? `<button class="danger" type="button" data-online-cancel="${escapeHtml(order.id)}">Cancel</button>` : ""}
        </div>
      </div>`;
    })
    .join("");

  el.onlineOrdersList.querySelectorAll("button[data-online-load]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const order = state.onlineOrders.find((o) => o.id === btn.dataset.onlineLoad);
      if (!order) return;

      state.order = deepClone(order.items);
      if (el.orderTypeDelivery) el.orderTypeDelivery.checked = true;
      if (el.orderTypeDineIn) el.orderTypeDineIn.checked = false;
      if (el.deliveryFields) el.deliveryFields.classList.remove("hidden");
      if (el.deliveryCustomerRef) el.deliveryCustomerRef.value = order.customer?.customerRef || "";
      if (el.deliveryName) el.deliveryName.value = order.customer?.name || "";
      if (el.deliveryPhone) el.deliveryPhone.value = order.customer?.phone || "";
      if (el.deliveryAddress) el.deliveryAddress.value = order.customer?.address || "";
      if (el.deliveryNote) el.deliveryNote.value = order.customer?.note || "";

      state.posConfig.paymentMethod = order.paymentType === ONLINE_PAYMENT_TYPES.CARD ? "card" : "cash";
      if (el.paymentMethod) el.paymentMethod.value = state.posConfig.paymentMethod;

      renderOrder();
      saveState();
      setActiveNav("pos", true);
      addAudit("ONLINE_ORDER_LOADED", `Online order ${order.externalId || order.id} loaded to POS cart`);
    });
  });

  el.onlineOrdersList.querySelectorAll("button[data-online-accept]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const order = state.onlineOrders.find((o) => o.id === btn.dataset.onlineAccept);
      if (!order || order.status !== "new") return;
      if (!isSignedIn()) return alert("Please login first.");

      if (!order.kitchenTicketId) {
        const ticket = createKitchenTicketFromOnlineOrder(order);
        order.kitchenTicketId = ticket.id;
      }

      order.status = "preparing";
      addAudit("ONLINE_ORDER_ACCEPTED", `Online order ${order.externalId || order.id} accepted by cashier`);

      const draftTransaction = buildTransactionFromOnlineOrder(order);
      printLines(buildCustomerReceiptLines(draftTransaction));
      await pushOnlineOrderStatus(order);

      saveState();
      renderOnlineOrders();
      renderKitchenQueue();
    });
  });

  el.onlineOrdersList.querySelectorAll("button[data-online-kitchen]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const order = state.onlineOrders.find((o) => o.id === btn.dataset.onlineKitchen);
      if (!order || order.status !== "new") return;
      const ticket = createKitchenTicketFromOnlineOrder(order);
      order.kitchenTicketId = ticket.id;
      order.status = "preparing";
      pushOnlineOrderStatus(order);
      saveState();
      renderOnlineOrders();
      renderKitchenQueue();
    });
  });

  el.onlineOrdersList.querySelectorAll("button[data-online-out]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const order = state.onlineOrders.find((o) => o.id === btn.dataset.onlineOut);
      if (!order || order.status !== "preparing") return;
      order.status = "out_for_delivery";
      addAudit("ONLINE_ORDER_OUT_FOR_DELIVERY", `Online order ${order.externalId || order.id} marked out for delivery`);
      pushOnlineOrderStatus(order);
      saveState();
      renderOnlineOrders();
    });
  });

  el.onlineOrdersList.querySelectorAll("button[data-online-complete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const order = state.onlineOrders.find((o) => o.id === btn.dataset.onlineComplete);
      if (!order || order.status === "completed" || order.status === "cancelled") return;
      if (!isSignedIn()) return alert("Please login first.");
      if (!state.shifts.active) return alert("Open a shift before completing online orders.");

      const paymentMethod = order.paymentType === ONLINE_PAYMENT_TYPES.CARD ? "card" : "cash";
      const transaction = {
        id: Date.now(),
        date: new Date().toISOString(),
        cashier: state.currentUser.name,
        role: state.currentUser.role,
        shiftId: state.shifts.active.id,
        paymentMethod,
        orderType: "delivery",
        source: "website",
        onlineOrderId: order.externalId || order.id,
        delivery: {
          customerRef: order.customer?.customerRef || "",
          name: order.customer?.name || "Online Customer",
          phone: order.customer?.phone || "",
          address: order.customer?.address || "",
          note: order.customer?.note || "",
        },
        items: deepClone(order.items),
        subtotal: Number(order.subtotal || 0),
        discountAmount: Number(order.discountAmount || 0),
        serviceAmount: Number(order.serviceAmount || 0),
        tax: Number(order.tax || 0),
        total: Number(order.total || 0),
      };

      state.reports.daily.push(transaction);
      state.reports.monthly.push(transaction);
      state.lastTransaction = transaction;
      order.status = "completed";
      order.paymentStatus = "paid";
      order.transactionId = transaction.id;
      addAudit("ONLINE_ORDER_COMPLETED", `Online order ${order.externalId || order.id} completed and registered as ${paymentMethod}`);

      if (!order.kitchenTicketId) {
        const ticket = createKitchenTicketFromOnlineOrder(order);
        order.kitchenTicketId = ticket.id;
      }

      if (paymentMethod === "cash") {
        openCashDrawer();
      }

      pushOnlineOrderStatus(order);

      saveState();
      renderOnlineOrders();
      renderKitchenQueue();
      updateReports();
      renderShiftPanel();
      renderReceiptPreview();
      alert(`Online order #${order.externalId || order.id} completed.`);
    });
  });

  el.onlineOrdersList.querySelectorAll("button[data-online-cancel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const order = state.onlineOrders.find((o) => o.id === btn.dataset.onlineCancel);
      if (!order || order.status === "completed" || order.status === "cancelled") return;
      if (!confirm(`Cancel online order #${order.externalId || order.id}?`)) return;
      order.status = "cancelled";
      addAudit("ONLINE_ORDER_CANCELLED", `Online order ${order.externalId || order.id} cancelled`);
      pushOnlineOrderStatus(order);
      saveState();
      renderOnlineOrders();
    });
  });

  updateOnlineOrdersBadge();
}

async function syncOnlineOrdersFromEndpoint({ silent = false } = {}) {
  const endpoint = String(el.onlineEndpoint?.value || state.onlineOrdersConfig.endpoint || "").trim();
  const token = String(el.onlineToken?.value || state.onlineOrdersConfig.authToken || "").trim();

  if (!endpoint) {
    if (!silent) alert("Enter endpoint URL first.");
    return { added: 0, updated: 0, newOrders: [] };
  }

  let parsedEndpoint = null;
  try {
    parsedEndpoint = new URL(endpoint);
  } catch (_err) {
    if (!silent) alert("Endpoint URL is invalid. Example: http://localhost:8787/api/orders");
    return { added: 0, updated: 0, newOrders: [] };
  }

  const pageHost = String(window.location.hostname || "").toLowerCase();
  const endpointHost = String(parsedEndpoint.hostname || "").toLowerCase();
  const localhostHosts = ["localhost", "127.0.0.1", "::1"];
  const isHostedPage = pageHost && !localhostHosts.includes(pageHost);
  const isLocalEndpoint = localhostHosts.includes(endpointHost);

  if (isHostedPage && isLocalEndpoint) {
    const message = "Sync blocked: this website is running on a domain, but endpoint uses localhost. From a hosted website, localhost points to the visitor device, not your POS server. Use a public HTTPS API URL or tunnel URL.";
    if (!silent && el.onlineOrdersStatus) el.onlineOrdersStatus.textContent = message;
    if (!silent) alert(message);
    return { added: 0, updated: 0, newOrders: [] };
  }

  if (window.location.protocol === "https:" && parsedEndpoint.protocol === "http:") {
    const message = "Sync blocked by browser security: HTTPS website cannot call HTTP API. Use HTTPS for the API endpoint.";
    if (!silent && el.onlineOrdersStatus) el.onlineOrdersStatus.textContent = message;
    if (!silent) alert(message);
    return { added: 0, updated: 0, newOrders: [] };
  }

  try {
    if (!silent && el.onlineOrdersStatus) el.onlineOrdersStatus.textContent = "Syncing online orders...";
    const headers = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(endpoint, { method: "GET", headers });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    const payload = await response.json();
    const result = importOnlineOrders(payload);
    state.onlineOrdersConfig.endpoint = endpoint;
    state.onlineOrdersConfig.authToken = token;
    state.onlineOrdersConfig.lastSyncAt = new Date().toISOString();
    saveState();
    renderOnlineOrders();
    if (result.added > 0) {
      notifyCashierNewOnlineOrders(result.added);
    }
    if (!silent && el.onlineOrdersStatus) {
      el.onlineOrdersStatus.textContent = `Sync complete. Added: ${result.added}, Updated: ${result.updated}`;
    }
    return result;
  } catch (error) {
    console.error(error);
    if (!silent) {
      if (el.onlineOrdersStatus) el.onlineOrdersStatus.textContent = `Sync failed: ${error.message}`;
      alert(`Failed to sync online orders. ${error.message}`);
    }
    return { added: 0, updated: 0, newOrders: [] };
  }
}

function startOnlineOrdersAutoSync() {
  if (onlineOrdersPollTimer) {
    clearInterval(onlineOrdersPollTimer);
    onlineOrdersPollTimer = null;
  }

  const endpoint = String(state.onlineOrdersConfig.endpoint || "").trim();
  if (!endpoint) return;

  lastKnownPendingCount = getPendingOnlineOrdersCount();
  onlineOrdersPollTimer = setInterval(async () => {
    if (!isSignedIn()) return;
    await syncOnlineOrdersFromEndpoint({ silent: true });
    const pendingNow = getPendingOnlineOrdersCount();
    if (pendingNow > lastKnownPendingCount) {
      notifyCashierNewOnlineOrders(pendingNow - lastKnownPendingCount);
    }
    lastKnownPendingCount = pendingNow;
    updateOnlineOrdersBadge();
  }, ONLINE_SYNC_INTERVAL_MS);
}

function renderKitchenQueue() {
  if (!el.kitchenList) return;

  if (!state.kitchenTickets.length) {
    el.kitchenList.innerHTML = "<div class=\"text-muted\">No kitchen tickets yet.</div>";
    return;
  }

  const statuses = ["new", "preparing", "ready", "served"];
  el.kitchenList.innerHTML = state.kitchenTickets
    .map((t) => {
      const statusButtons = statuses
        .map((s) => {
          const active = t.status === s ? " active" : "";
          return `<button type="button" class="chip mini-chip${active}" data-ticket-id="${t.id}" data-ticket-status="${s}">${s}</button>`;
        })
        .join("");

      return `<div class="card" style="margin-bottom:10px; border-color:#4a4a00;">
        <div class="inline-row" style="margin:0; justify-content:space-between;">
          <strong>Ticket #${t.id}</strong>
          <span>${new Date(t.date).toLocaleTimeString()}</span>
        </div>
        <div class="text-muted" style="margin-top:4px;">Type: ${t.orderType === "delivery" ? "🛵 DELIVERY" : "🍽 DINE-IN"} | Status: ${t.status.toUpperCase()}</div>
        ${t.delivery ? `<div class="text-muted" style="margin-top:2px;">📞 ${t.delivery.phone} — ${t.delivery.address}</div>` : ""}
        <div class="chip-row" style="margin-top:8px;">${statusButtons}</div>
        <div style="margin-top:8px; line-height:1.6;">
          ${t.items
            .map((i) => {
              const mods = i.modifiers?.length ? `<div class="text-muted">Modifiers: ${i.modifiers.join(", ")}</div>` : "";
              const note = i.note?.trim() ? `<div class="text-muted">Note: ${escapeHtml(i.note)}</div>` : "";
              return `<div><strong>${i.qty}x ${i.name}</strong>${mods}${note}</div>`;
            })
            .join("")}
        </div>
        <div class="inline-row">
          <button class="primary" type="button" data-ticket-print="${t.id}">Print Kitchen Ticket</button>
        </div>
      </div>`;
    })
    .join("");

  el.kitchenList.querySelectorAll("button[data-ticket-status]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ticket = state.kitchenTickets.find((t) => String(t.id) === btn.dataset.ticketId);
      if (!ticket) return;
      ticket.status = btn.dataset.ticketStatus;
      addAudit("KITCHEN_STATUS_UPDATED", `Ticket #${ticket.id} moved to ${ticket.status}`);
      saveState();
      renderKitchenQueue();
    });
  });

  el.kitchenList.querySelectorAll("button[data-ticket-print]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ticket = state.kitchenTickets.find((t) => String(t.id) === btn.dataset.ticketPrint);
      if (!ticket) return;
      printKitchenReceipt(ticket);
    });
  });
}

function populateMenuCategorySelect() {
  el.newItemCategory.innerHTML = state.categories.map((c) => `<option>${c}</option>`).join("");
}

function renderMenuManagement() {
  const lang = getCurrentPageLanguage();
  el.menuList.innerHTML = state.menu
    .map(
      (item) =>
        `<div class="table-item menu-manage-row">
          <div class="menu-manage-main">
            <span class="menu-manage-name">${escapeHtml(localizeMenuName(item.name, lang))}</span>
            <span class="menu-manage-price">${formatMoney(item.price)}</span>
          </div>
          <div class="menu-manage-actions">
            <input type="number" min="0" step="0.01" data-menu-price-id="${item.id}" value="${Number(item.price)}" class="menu-price-input" />
            <button type="button" class="primary menu-save-btn" data-update-menu-id="${item.id}">Save Price</button>
            <button type="button" class="danger menu-remove-btn" data-remove-menu-id="${item.id}">Remove</button>
          </div>
        </div>`
    )
    .join("");

  el.menuList.querySelectorAll("button[data-update-menu-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!isManagerOrAdmin()) return alert("Only manager/admin can edit menu prices.");
      const id = Number(btn.dataset.updateMenuId);
      const target = state.menu.find((m) => m.id === id);
      if (!target) return;
      const input = el.menuList.querySelector(`input[data-menu-price-id="${id}"]`);
      const nextPrice = Number(input?.value);
      if (!Number.isFinite(nextPrice) || nextPrice <= 0) return alert("Please enter a valid price greater than 0.");

      target.price = nextPrice;
      state.order.forEach((o) => {
        if (o.id === id) o.price = nextPrice;
      });

      addAudit("MENU_PRICE_UPDATED", `${target.name} -> ${formatMoney(nextPrice)}`);
      saveState();
      renderMenuManagement();
      renderMenu();
      renderOrder();
    });
  });

  el.menuList.querySelectorAll("button[data-remove-menu-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!isManagerOrAdmin()) return alert("Only manager/admin can remove menu items.");
      const id = Number(btn.dataset.removeMenuId);
      const target = state.menu.find((m) => m.id === id);
      state.menu = state.menu.filter((m) => m.id !== id);
      addAudit("MENU_ITEM_REMOVED", target ? `${target.name}` : `ID ${id}`);
      saveState();
      renderMenuManagement();
      renderMenu();
    });
  });
}

function renderInventory() {
  el.inventoryList.innerHTML = state.inventory
    .map((item) => {
      const low = Number(item.qty) <= Number(item.alert);
      return `<div class="table-item" style="border-color:${low ? "#ff8f80" : "#3b5ba2"}; background:${low ? "#3e1c28" : "#152c67"};">
        <div><strong>${item.name}</strong></div>
        <div>Qty: ${item.qty}</div>
        <div>Alert: ${item.alert}</div>
        <button type="button" class="danger" data-remove-inv-id="${item.id}">Remove</button>
      </div>`;
    })
    .join("");

  el.inventoryList.querySelectorAll("button[data-remove-inv-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!isManagerOrAdmin()) return alert("Only manager/admin can remove inventory items.");
      const id = Number(btn.dataset.removeInvId);
      const target = state.inventory.find((i) => i.id === id);
      state.inventory = state.inventory.filter((i) => i.id !== id);
      addAudit("INVENTORY_REMOVED", target ? `${target.name}` : `ID ${id}`);
      saveState();
      renderInventory();
    });
  });
}

function renderUsers() {
  el.userList.innerHTML = state.users
    .map(
      (u, idx) =>
        `<div class="table-item">
          <span>${u.name}</span>
          <span>${u.role}</span>
          <button type="button" class="danger" data-remove-user-idx="${idx}">Remove</button>
        </div>`
    )
    .join("");

  el.userList.querySelectorAll("button[data-remove-user-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!isAdmin()) return alert("Only admin can manage users.");
      const idx = Number(btn.dataset.removeUserIdx);
      const target = state.users[idx];
      if (!target) return;
      if (target.name === "admin") return alert("Default admin cannot be removed.");
      state.users.splice(idx, 1);
      addAudit("USER_REMOVED", `${target.name} (${target.role})`);
      saveState();
      renderUsers();
    });
  });
}

function getShiftTransactions(shiftId) {
  return state.reports.daily.filter((t) => t.shiftId === shiftId);
}

function renderShiftPanel() {
  if (!isManagerOrAdmin()) {
    el.shiftStatus.textContent = "Manager/Admin only.";
    return;
  }

  if (!state.shifts.active) {
    el.shiftStatus.textContent = "No active shift.";
  } else {
    const tx = getShiftTransactions(state.shifts.active.id);
    const cashSales = tx.filter((t) => t.paymentMethod === "cash").reduce((s, t) => s + Number(t.total || 0), 0);
    const cardSales = tx.filter((t) => t.paymentMethod === "card").reduce((s, t) => s + Number(t.total || 0), 0);
    const expectedCash = Number(state.shifts.active.startingCash) + cashSales;

    el.shiftStatus.innerHTML = [
      `Open by ${state.shifts.active.openedBy} at ${new Date(state.shifts.active.openedAt).toLocaleString()}`,
      `Starting cash: ${formatMoney(state.shifts.active.startingCash)}`,
      `Expected cash now: ${formatMoney(expectedCash)}`,
      `Expected card now: ${formatMoney(cardSales)}`,
      `Orders in shift: ${tx.length}`,
    ].join("<br />");
  }

  if (!state.shifts.history.length) {
    el.shiftHistory.innerHTML = "<div class=\"text-muted\">No closed shifts yet.</div>";
  } else {
    el.shiftHistory.innerHTML = state.shifts.history
      .slice(0, 20)
      .map(
        (s) =>
          `<div class="table-item">
            <div>
              <strong>${new Date(s.openedAt).toLocaleDateString()}</strong><br />
              Open: ${new Date(s.openedAt).toLocaleTimeString()} | Close: ${new Date(s.closedAt).toLocaleTimeString()}<br />
              Cash diff: ${formatMoney(s.cashDifference)} | Card diff: ${formatMoney(s.cardDifference)}
            </div>
            <div>${s.closedBy}</div>
          </div>`
      )
      .join("");
  }
}

function getSelectedDayTransactions() {
  const dayVal = el.reportDay?.value; // "YYYY-MM-DD"
  const allTx = [...(state.reports.daily || []), ...(state.reports.monthly || [])];
  // Deduplicate by id
  const seen = new Set();
  const unique = allTx.filter(tx => { if (seen.has(tx.id)) return false; seen.add(tx.id); return true; });

  if (!dayVal) {
    // Default: today
    const today = new Date().toISOString().slice(0, 10);
    return unique.filter(tx => new Date(tx.date).toISOString().slice(0, 10) === today);
  }
  return unique.filter(tx => new Date(tx.date).toISOString().slice(0, 10) === dayVal);
}

function getSelectedMonthTransactions() {
  const monthVal = el.reportMonth?.value; // "YYYY-MM"
  const allTx = [...(state.reports.daily || []), ...(state.reports.monthly || [])];
  const seen = new Set();
  const unique = allTx.filter(tx => { if (seen.has(tx.id)) return false; seen.add(tx.id); return true; });

  if (!monthVal) {
    // Default: current month
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return unique.filter(tx => new Date(tx.date).toISOString().slice(0, 7) === ym);
  }
  return unique.filter(tx => new Date(tx.date).toISOString().slice(0, 7) === monthVal);
}

function renderDailyBreakdown(transactions) {
  if (!el.dailyBreakdown) return;
  if (!transactions.length) {
    el.dailyBreakdown.innerHTML = '<div class="text-muted">No transactions for this day.</div>';
    return;
  }
  const total = transactions.reduce((s, tx) => s + Number(tx.total || 0), 0);
  const itemMap = new Map();
  transactions.forEach(tx => {
    (tx.items || []).forEach(item => {
      const name = item.name || "?";
      const prev = itemMap.get(name) || { qty: 0, revenue: 0 };
      prev.qty += Number(item.qty || 0);
      prev.revenue += Number(item.qty || 0) * Number(item.price || 0);
      itemMap.set(name, prev);
    });
  });
  const itemRows = [...itemMap.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([name, d]) => `<div class="table-item"><div><strong>${escapeHtml(localizeMenuName(name))}</strong> — ×${d.qty}</div><div>${formatMoney(d.revenue)}</div></div>`)
    .join("");

  el.dailyBreakdown.innerHTML = `
    <div style="margin-bottom:8px; font-size:1.05rem; font-weight:700;">
      Orders: <strong>${transactions.length}</strong> &nbsp;|&nbsp; Total: <strong>${formatMoney(total)}</strong>
    </div>
    ${itemRows}
  `;
}

function renderMonthlyBreakdown(transactions) {
  if (!el.monthlyBreakdown) return;
  if (!transactions.length) {
    el.monthlyBreakdown.innerHTML = '<div class="text-muted">No transactions for this month.</div>';
    return;
  }
  const total = transactions.reduce((s, tx) => s + Number(tx.total || 0), 0);
  // Group by day
  const dayMap = new Map();
  transactions.forEach(tx => {
    const day = new Date(tx.date).toLocaleDateString();
    const prev = dayMap.get(day) || { count: 0, revenue: 0 };
    prev.count += 1;
    prev.revenue += Number(tx.total || 0);
    dayMap.set(day, prev);
  });
  const dayRows = [...dayMap.entries()]
    .map(([day, d]) => `<div class="table-item"><div><strong>${escapeHtml(day)}</strong> — ${d.count} orders</div><div>${formatMoney(d.revenue)}</div></div>`)
    .join("");

  const itemMap = new Map();
  transactions.forEach(tx => {
    (tx.items || []).forEach(item => {
      const name = item.name || "?";
      const prev = itemMap.get(name) || { qty: 0, revenue: 0 };
      prev.qty += Number(item.qty || 0);
      prev.revenue += Number(item.qty || 0) * Number(item.price || 0);
      itemMap.set(name, prev);
    });
  });
  let bestName = "-", bestRev = 0;
  itemMap.forEach((d, name) => { if (d.revenue > bestRev) { bestRev = d.revenue; bestName = name; } });

  el.monthlyBreakdown.innerHTML = `
    <div style="margin-bottom:8px; font-size:1.05rem; font-weight:700;">
      Orders: <strong>${transactions.length}</strong> &nbsp;|&nbsp; Revenue: <strong>${formatMoney(total)}</strong> &nbsp;|&nbsp; Best Seller: <strong>${escapeHtml(localizeMenuName(bestName))}</strong>
    </div>
    ${dayRows}
  `;
}

function printDailyReport(transactions) {
  const dayLabel = el.reportDay?.value || new Date().toISOString().slice(0, 10);
  const total = transactions.reduce((s, tx) => s + Number(tx.total || 0), 0);
  const cashTotal = transactions.filter(tx => tx.paymentMethod === "cash").reduce((s, tx) => s + Number(tx.total || 0), 0);
  const cardTotal = transactions.filter(tx => tx.paymentMethod === "card").reduce((s, tx) => s + Number(tx.total || 0), 0);

  const itemMap = new Map();
  transactions.forEach(tx => {
    (tx.items || []).forEach(item => {
      const name = item.name || "?";
      const prev = itemMap.get(name) || { qty: 0, revenue: 0 };
      prev.qty += Number(item.qty || 0);
      prev.revenue += Number(item.qty || 0) * Number(item.price || 0);
      itemMap.set(name, prev);
    });
  });
  const itemRows = [...itemMap.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([name, d]) => `<tr><td>${escapeHtml(localizeMenuName(name))}</td><td style="text-align:center;">×${d.qty}</td><td style="text-align:right;">${formatMoney(d.revenue)}</td></tr>`)
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>
    body { font-family: Arial, sans-serif; padding: 16px; font-size: 15px; }
    .wrap { width: 320px; margin: 0 auto; }
    h1 { text-align:center; font-size:1.5rem; margin:0 0 4px; }
    h2 { text-align:center; font-size:1.1rem; margin:0 0 10px; color:#555; }
    .meta { font-size:1rem; font-weight:700; margin:4px 0; }
    hr { border:none; border-top:2px dashed #bbb; margin:10px 0; }
    table { width:100%; border-collapse:collapse; }
    th { font-size:0.85rem; text-transform:uppercase; color:#555; padding:4px; border-bottom:2px solid #000; text-align:left; }
    th:last-child { text-align:right; }
    td { padding:5px 4px; border-bottom:1px solid #ddd; font-size:1rem; font-weight:700; }
    .total { font-size:1.3rem; font-weight:900; text-align:right; margin-top:8px; }
    @media print { body { padding:0; } .wrap { width:100%; } }
  </style></head><body><div class="wrap">
    <h1>Fatayel & More</h1>
    <h2>Daily Report — ${escapeHtml(dayLabel)}</h2>
    <hr/>
    <div class="meta">Total Orders: ${transactions.length}</div>
    <div class="meta">Cash: ${formatMoney(cashTotal)}</div>
    <div class="meta">Card: ${formatMoney(cardTotal)}</div>
    <hr/>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Revenue</th></tr></thead><tbody>${itemRows}</tbody></table>
    <hr/>
    <div class="total">TOTAL: ${formatMoney(total)}</div>
  </div></body></html>`;

  printHtmlDocument(html);
}

function updateReports() {
  // Set default values for date pickers
  if (el.reportDay && !el.reportDay.value) {
    el.reportDay.value = new Date().toISOString().slice(0, 10);
  }
  if (el.reportMonth && !el.reportMonth.value) {
    const now = new Date();
    el.reportMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  const dayTx = getSelectedDayTransactions();
  const monthTx = getSelectedMonthTransactions();

  const totalDaily = dayTx.reduce((s, r) => s + Number(r.total || 0), 0);
  const totalMonthly = monthTx.reduce((s, r) => s + Number(r.total || 0), 0);

  const itemSales = new Map();
  monthTx.forEach((tx) => {
    (tx.items || []).forEach((item) => {
      const name = String(item.name || "").trim();
      if (!name) return;
      const revenue = Number(item.qty || 0) * Number(item.price || 0);
      itemSales.set(name, (itemSales.get(name) || 0) + revenue);
    });
  });

  let bestSellerLabel = "-";
  let bestSellerRevenue = 0;
  itemSales.forEach((revenue, name) => {
    if (revenue > bestSellerRevenue) {
      bestSellerRevenue = revenue;
      bestSellerLabel = name;
    }
  });

  if (bestSellerRevenue > 0) {
    bestSellerLabel = `${bestSellerLabel} (${formatMoney(bestSellerRevenue)})`;
  }

  el.transCount.textContent = dayTx.length;
  el.revToday.textContent = formatMoney(totalDaily);
  el.monthCount.textContent = monthTx.length;
  el.revMonth.textContent = formatMoney(totalMonthly);
  if (el.bestSellerMonth) el.bestSellerMonth.textContent = bestSellerLabel;

  renderDailyBreakdown(dayTx);
  renderMonthlyBreakdown(monthTx);

  if (el.refundHistoryList) {
    if (!state.refunds.length) {
      el.refundHistoryList.innerHTML = "<div class=\"text-muted\">No refunded orders yet.</div>";
    } else {
      el.refundHistoryList.innerHTML = state.refunds
        .slice(0, 80)
        .map(
          (r) =>
            `<div class="table-item">
              <div>
                <strong>#${r.orderId} ${String(r.type || "full").toUpperCase() === "PARTIAL" ? "(PARTIAL)" : "(FULL)"}</strong><br />
                <span class="text-muted">${new Date(r.at).toLocaleString()} by ${escapeHtml(r.by || "System")}</span>
              </div>
              <div>-${formatMoney(r.total || 0)} (${escapeHtml(String(r.paymentMethod || "").toUpperCase())})</div>
            </div>`
        )
        .join("");
    }
  }

  if (!state.auditLog.length) {
    el.auditList.innerHTML = "<div class=\"text-muted\">No audit activity yet.</div>";
  } else {
    el.auditList.innerHTML = state.auditLog
      .slice(0, 80)
      .map(
        (a) =>
          `<div class="table-item">
            <div>
              <strong>${a.action}</strong><br />
              <span class="text-muted">${new Date(a.at).toLocaleString()} by ${a.by}</span>
            </div>
            <div>${escapeHtml(a.details || "")}</div>
          </div>`
      )
      .join("");
  }
}

function downloadCSV(rows, filename) {
  const csv = rows.length
    ? [
        Object.keys(rows[0]).join(","),
        ...rows.map((r) =>
          Object.values(r)
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(",")
        ),
      ].join("\n")
    : "";

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function buildDetailedReportRows(transactions) {
  const itemMap = new Map();
  transactions.forEach((tx) => {
    (tx.items || []).forEach((item) => {
      const name = String(item.name || "").trim();
      if (!name) return;
      const prev = itemMap.get(name) || { qty: 0, total: 0 };
      prev.qty += Number(item.qty || 0);
      prev.total += Number(item.qty || 0) * Number(item.price || 0);
      itemMap.set(name, prev);
    });
  });

  const grandTotal = transactions.reduce((s, tx) => s + Number(tx.total || 0), 0);
  const rows = [];
  itemMap.forEach((data, name) => {
    rows.push({
      "Item Name": name,
      "Quantity": data.qty,
      "Total Price": state.currency === "usd" ? (data.total / LBP_TO_USD_RATE).toFixed(2) : Math.round(data.total),
      "Currency": state.currency === "usd" ? "USD" : "LBP",
    });
  });
  if (rows.length) {
    rows.push({
      "Item Name": "GRAND TOTAL",
      "Quantity": rows.reduce((s, r) => s + r["Quantity"], 0),
      "Total Price": state.currency === "usd" ? (grandTotal / LBP_TO_USD_RATE).toFixed(2) : Math.round(grandTotal),
      "Currency": state.currency === "usd" ? "USD" : "LBP",
    });
  }
  return rows;
}

function exportBackup() {
  const backup = {
    version: 2,
    createdAt: new Date().toISOString(),
    data: getSnapshot(),
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `ftayel_pos_backup_${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const payload = parsed.data || parsed;
      hydrateSnapshot(payload);
      addAudit("BACKUP_RESTORED", "Backup file imported");
      saveState();
      applyAllRenders();
      alert("Backup restored successfully.");
    } catch (err) {
      alert("Invalid backup file.");
      console.error(err);
    }
  };
  reader.readAsText(file);
}

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
}

function parseCsvToRows(text) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim().length);
  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function normalizeInventoryUploadRow(row) {
  const normalized = {};
  Object.entries(row || {}).forEach(([k, v]) => {
    normalized[String(k).trim().toLowerCase()] = v;
  });

  const name = String(
    normalized.name ?? normalized.item ?? normalized["item name"] ?? normalized.product ?? normalized["الاسم"] ?? normalized["اسم الصنف"] ?? ""
  ).trim();
  if (!name) return null;

  const qtyRaw = normalized.qty ?? normalized.quantity ?? normalized.stock ?? normalized.count ?? normalized["الكمية"] ?? 0;
  const alertRaw = normalized.alert ?? normalized.threshold ?? normalized["alert threshold"] ?? normalized["حد التنبيه"] ?? 0;

  const qty = Number(qtyRaw);
  const alert = Number(alertRaw);

  return {
    name,
    qty: Number.isFinite(qty) ? qty : 0,
    alert: Number.isFinite(alert) ? alert : 0,
  };
}

function upsertInventoryFromImport(item) {
  const existing = state.inventory.find((i) => String(i.name || "").toLowerCase() === item.name.toLowerCase());
  if (existing) {
    existing.qty = item.qty;
    existing.alert = item.alert;
    return { updated: 1, added: 0 };
  }

  const nextId = Math.max(0, ...state.inventory.map((i) => i.id)) + 1;
  state.inventory.push({
    id: nextId,
    name: item.name,
    category: "General",
    qty: item.qty,
    alert: item.alert,
  });
  return { updated: 0, added: 1 };
}

async function importInventoryFromFile(file) {
  if (!file) return;

  let rows = [];
  const fileName = String(file.name || "").toLowerCase();

  if (window.XLSX) {
    const data = await file.arrayBuffer();
    const workbook = window.XLSX.read(data, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const firstSheet = workbook.Sheets[firstSheetName];
    rows = window.XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
  } else if (fileName.endsWith(".csv")) {
    const text = await file.text();
    rows = parseCsvToRows(text);
  } else {
    alert("Excel parser not loaded. Use CSV or reload page with internet.");
    return;
  }

  let added = 0;
  let updated = 0;

  rows.forEach((r) => {
    const normalized = normalizeInventoryUploadRow(r);
    if (!normalized) return;
    const res = upsertInventoryFromImport(normalized);
    added += res.added;
    updated += res.updated;
  });

  if (!added && !updated) {
    alert("No valid rows found. Required columns: name/item + qty/quantity.");
    return;
  }

  addAudit("INVENTORY_IMPORTED", `Inventory import: ${added} added, ${updated} updated`);
  saveState();
  renderInventory();
  alert(`Inventory import done. Added: ${added}, Updated: ${updated}`);
}

function openShift() {
  if (!isManagerOrAdmin()) return alert("Only manager/admin can open shifts.");
  if (state.shifts.active) return alert("A shift is already open.");

  const startingCash = Number(el.shiftStartCash.value || 0);
  state.shifts.active = {
    id: Date.now(),
    openedAt: new Date().toISOString(),
    openedBy: state.currentUser.name,
    startingCash,
  };

  addAudit("SHIFT_OPENED", `Start cash ${formatMoney(startingCash)}`);
  saveState();
  renderShiftPanel();
}

function closeShift() {
  if (!isManagerOrAdmin()) return alert("Only manager/admin can close shifts.");
  if (!state.shifts.active) return alert("No active shift to close.");

  const shift = state.shifts.active;
  const tx = getShiftTransactions(shift.id);
  const cashSales = tx.filter((t) => t.paymentMethod === "cash").reduce((s, t) => s + Number(t.total || 0), 0);
  const cardSales = tx.filter((t) => t.paymentMethod === "card").reduce((s, t) => s + Number(t.total || 0), 0);

  const expectedCash = Number(shift.startingCash) + cashSales;
  const expectedCard = cardSales;

  const actualCash = Number(el.closeActualCash.value || 0);
  const actualCard = Number(el.closeCardTotal.value || 0);

  const closedRecord = {
    ...shift,
    closedAt: new Date().toISOString(),
    closedBy: state.currentUser.name,
    expectedCash,
    expectedCard,
    actualCash,
    actualCard,
    cashDifference: actualCash - expectedCash,
    cardDifference: actualCard - expectedCard,
    ordersCount: tx.length,
  };

  state.shifts.history.unshift(closedRecord);
  state.shifts.active = null;
  addAudit(
    "SHIFT_CLOSED",
    `Cash diff ${formatMoney(closedRecord.cashDifference)}, Card diff ${formatMoney(closedRecord.cardDifference)}`
  );
  saveState();
  renderShiftPanel();
  // Print shift summary
  setTimeout(() => printShiftSummary(closedRecord, tx), 200);
}

function getDeliveryInfo() {
  const isDelivery = el.orderTypeDelivery?.checked;
  if (!isDelivery) return null;
  return {
    customerRef: el.deliveryCustomerRef?.value.trim() || "",
    name: el.deliveryName?.value.trim() || "",
    phone: el.deliveryPhone?.value.trim() || "",
    address: el.deliveryAddress?.value.trim() || "",
    note: el.deliveryNote?.value.trim() || "",
  };
}

function clearDeliveryFields() {
  if (el.orderTypeDineIn) el.orderTypeDineIn.checked = true;
  if (el.deliveryFields) el.deliveryFields.classList.add("hidden");
  if (el.deliveryName) el.deliveryName.value = "";
  if (el.deliveryPhone) el.deliveryPhone.value = "";
  if (el.deliveryAddress) el.deliveryAddress.value = "";
  if (el.deliveryNote) el.deliveryNote.value = "";
  if (el.deliveryCustomerRef) el.deliveryCustomerRef.value = "";
  if (el.customerLookupMsg) el.customerLookupMsg.textContent = "";
  if (el.customerLoyaltyLink) el.customerLoyaltyLink.textContent = "";
}

// ── Hold Order ──────────────────────────────────────────────────────────────
function holdOrder() {
  if (!state.order.length) return alert("No items in current order.");
  const label = `Hold #${state.heldOrders.length + 1} — ${state.order.map((i) => `${i.qty}x ${i.name}`).join(", ")}`;
  state.heldOrders.push({
    id: Date.now(),
    label,
    items: deepClone(state.order),
    posConfig: deepClone(state.posConfig),
    heldAt: new Date().toISOString(),
  });
  state.order = [];
  saveState();
  renderOrder();
  renderHeldOrders();
  addAudit("ORDER_HELD", label);
}

function restoreHeldOrder(id) {
  const idx = state.heldOrders.findIndex((h) => h.id === id);
  if (idx < 0) return;
  if (state.order.length && !confirm("Replace current order with held order?")) return;
  const held = state.heldOrders.splice(idx, 1)[0];
  state.order = held.items;
  saveState();
  renderOrder();
  renderHeldOrders();
}

function renderHeldOrders() {
  if (!el.heldOrdersWrap || !el.heldOrdersList) return;
  if (!state.heldOrders.length) {
    el.heldOrdersWrap.style.display = "none";
    return;
  }
  el.heldOrdersWrap.style.display = "";
  el.heldOrdersList.innerHTML = state.heldOrders
    .map(
      (h) => `
      <div class="table-item" style="gap:8px;">
        <div style="flex:1;">
          <span style="font-weight:700; font-size:0.93rem;">${escapeHtml(h.label)}</span>
          <span style="display:block; font-size:0.78rem; color:#aaa;">${new Date(h.heldAt).toLocaleTimeString()}</span>
        </div>
        <button class="primary" data-restore-hold="${h.id}" type="button" style="min-height:36px; padding:8px 14px; font-size:0.9rem;">Restore</button>
        <button class="danger" data-remove-hold="${h.id}" type="button" style="min-height:36px; padding:8px 12px; font-size:0.9rem;">✕</button>
      </div>`
    )
    .join("");

  el.heldOrdersList.querySelectorAll("[data-restore-hold]").forEach((btn) => {
    btn.addEventListener("click", () => restoreHeldOrder(Number(btn.dataset.restoreHold)));
  });
  el.heldOrdersList.querySelectorAll("[data-remove-hold]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.heldOrders = state.heldOrders.filter((h) => h.id !== Number(btn.dataset.removeHold));
      saveState();
      renderHeldOrders();
    });
  });
}

// ── Change Calculator ────────────────────────────────────────────────────────
function updateChangeDisplay() {
  if (!el.cashChangeCard || !el.cashReceived || !el.changeDue) return;
  const isCash = state.posConfig.paymentMethod === "cash";
  el.cashChangeCard.style.display = isCash ? "" : "none";
  if (!isCash) return;
  let received = Number(el.cashReceived.value || 0);
  const totals = computeTotals();
  if (received <= 0) {
    el.changeDue.textContent = "-";
    return;
  }
  // If currency is USD, convert received amount from USD to LBP
  if (state.currency === "usd") {
    received = received * LBP_TO_USD_RATE;
  }
  const change = received - totals.total;
  el.changeDue.textContent = change >= 0 ? formatMoney(change) : `Short: ${formatMoney(Math.abs(change))}`;
  el.changeDue.style.color = change >= 0 ? "#4caf50" : "#e53935";
}

// ── Shift Close Print ────────────────────────────────────────────────────────
function printShiftSummary(closedRecord, tx) {
  const cashSales = tx.filter((t) => t.paymentMethod === "cash").reduce((s, t) => s + Number(t.total || 0), 0);
  const cardSales = tx.filter((t) => t.paymentMethod === "card").reduce((s, t) => s + Number(t.total || 0), 0);

  const html = `
    <!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; font-size: 15px; }
      .wrap { width: 320px; margin: 0 auto; }
      h2 { text-align:center; font-size: 1.5rem; font-weight:900; margin:0 0 4px; }
      .sub { text-align:center; color:#555; font-size:0.9rem; margin-bottom:12px; }
      .divider { border:none; border-top:2px dashed #bbb; margin:10px 0; }
      .divider-solid { border:none; border-top:2.5px solid #000; margin:10px 0; }
      table { width:100%; border-collapse:collapse; }
      td { padding:6px 4px; font-weight:700; font-size:1rem; }
      td:last-child { text-align:right; }
      .big { font-size:1.2rem; font-weight:900; }
      .diff-ok { color:#2e7d32; }
      .diff-bad { color:#e53935; }
    </style></head><body>
    <div class="wrap">
      <h2>Fatayel & More</h2>
      <div class="sub">Shift Close Report</div>
      <hr class="divider"/>
      <table>
        <tr><td>Opened by</td><td>${closedRecord.openedBy}</td></tr>
        <tr><td>Closed by</td><td>${closedRecord.closedBy}</td></tr>
        <tr><td>Opened at</td><td>${new Date(closedRecord.openedAt).toLocaleString()}</td></tr>
        <tr><td>Closed at</td><td>${new Date(closedRecord.closedAt).toLocaleString()}</td></tr>
        <tr><td>Total Orders</td><td>${closedRecord.ordersCount}</td></tr>
      </table>
      <hr class="divider"/>
      <table>
        <tr><td>Starting Cash</td><td>${formatMoney(closedRecord.startingCash)}</td></tr>
        <tr><td>Cash Sales</td><td>${formatMoney(cashSales)}</td></tr>
        <tr><td>Expected Cash</td><td>${formatMoney(closedRecord.expectedCash)}</td></tr>
        <tr><td>Actual Cash</td><td>${formatMoney(closedRecord.actualCash)}</td></tr>
        <tr><td>Cash Difference</td><td class="${closedRecord.cashDifference >= 0 ? "diff-ok" : "diff-bad"}">${formatMoney(closedRecord.cashDifference)}</td></tr>
      </table>
      <hr class="divider"/>
      <table>
        <tr><td>Card Sales</td><td>${formatMoney(cardSales)}</td></tr>
        <tr><td>Actual Card</td><td>${formatMoney(closedRecord.actualCard)}</td></tr>
        <tr><td>Card Difference</td><td class="${closedRecord.cardDifference >= 0 ? "diff-ok" : "diff-bad"}">${formatMoney(closedRecord.cardDifference)}</td></tr>
      </table>
      <hr class="divider-solid"/>
      <table>
        <tr class="big"><td>Total Revenue</td><td>${formatMoney(cashSales + cardSales)}</td></tr>
      </table>
    </div>
    </body></html>`;

  const win = window.open("", "_blank", "width=420,height=700");
  if (!win) return;
  win.document.write(html);
  setTimeout(() => { win.print(); win.close(); }, 250);
}

function completePayment() {
  if (!isSignedIn()) return alert("Please login first.");
  if (!state.order.length) return alert("Add items first.");
  if (!state.shifts.active) return alert("Open a shift before taking payments.");

  const delivery = getDeliveryInfo();

  if (delivery) {
    if (!delivery.customerRef) return alert("Enter customer ID for delivery orders.");
    const refId = extractCustomerIdFromInput(delivery.customerRef);
    if (!refId) return alert("Invalid customer ID format.");
    const fromRef = findCustomerById(refId);
    if (!fromRef) return alert("Customer ID not found. Register customer first in Customers tab.");
    delivery.customerRef = refId;
    delivery.name = fromRef.name;
    delivery.phone = fromRef.phone;
    delivery.address = fromRef.address;
  }

  const totals = computeTotals();
  state.orderCounter = (state.orderCounter || 0) + 1;
  const orderNumber = state.orderCounter;
  const transaction = {
    id: Date.now(),
    orderNumber,
    date: new Date().toISOString(),
    cashier: state.currentUser.name,
    role: state.currentUser.role,
    shiftId: state.shifts.active.id,
    paymentMethod: state.posConfig.paymentMethod,
    orderType: delivery ? "delivery" : "dine-in",
    delivery: delivery || null,
    items: deepClone(state.order),
    subtotal: totals.subtotal,
    discountAmount: totals.discountAmount,
    serviceAmount: totals.serviceAmount,
    tax: totals.tax,
    total: totals.total,
  };

  state.reports.daily.push(transaction);
  state.reports.monthly.push(transaction);
  state.lastTransaction = transaction;

  const ticket = createKitchenTicket(transaction);
  addAudit("ORDER_PAID", `Order #${transaction.id} paid ${formatMoney(transaction.total)} (${transaction.paymentMethod})`);

  // Save/update customer and check loyalty milestone
  let loyaltyMsg = "";
  if (delivery) {
    const { customer } = upsertCustomer(delivery);
    if (customer) {
      transaction.delivery.customerId = customer.customerId;
      const badge = getLoyaltyBadge(customer);
      if (badge.isFree) {
        loyaltyMsg = `\n\n🎁 ${customer.name} has reached ${customer.orderCount} orders — NEXT ORDER IS FREE!`;
        addAudit("LOYALTY_FREE_EARNED", `${customer.name} | ${customer.phone} hit ${customer.orderCount} orders`);
      } else {
        loyaltyMsg = `\n📋 ${customer.name}: ${customer.orderCount} order${customer.orderCount !== 1 ? "s" : ""} total (${badge.remaining} to free meal)`;
      }
    }
  }

  state.order = [];
  state._activeOrderIdx = null;
  clearDeliveryFields();
  saveState();

  renderOrder();
  renderModifierArea();
  updateReports();
  renderKitchenQueue();
  renderShiftPanel();
  renderReceiptPreview();
  renderCustomers();
  renderHeldOrders();
  if (el.cashReceived) { el.cashReceived.value = ""; }
  updateChangeDisplay();

  if (state.posConfig.paymentMethod === "cash") {
    // Fire-and-forget so payment flow remains fast even if drawer is disconnected.
    openCashDrawer();
  }

  const typeLabel = transaction.orderType === "delivery" ? "Delivery" : "Dine-in";
  alert(`Order #${orderNumber} — Paid ${formatMoney(transaction.total)} (${typeLabel}). Kitchen ticket created.${loyaltyMsg}`);
  
  // Print kitchen + customer in one print job so both always print.
  printOrderReceipts(ticket, transaction);
}

function printRefundReceipt(refund) {
  const lang = getCurrentPageLanguage();
  const itemLines = (refund.items || [])
    .map((item) => `
      <tr>
        <td>${escapeHtml(localizeMenuName(item.name || "Item", lang))}</td>
        <td style="text-align:center;">x${Number(item.qty || 0)}</td>
        <td style="text-align:right;">-${formatMoney(item.total || 0)}</td>
      </tr>
    `)
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        body { font-family: Arial, sans-serif; padding: 16px; }
        .wrap { width: 320px; margin: 0 auto; }
        h1 { text-align: center; font-size: 1.5rem; margin: 0; font-weight: 900; }
        h2 { text-align: center; font-size: 1.25rem; margin: 6px 0; color: #c62828; font-weight: 900; }
        .meta { text-align: center; font-size: 0.92rem; color: #555; margin-bottom: 8px; }
        .divider { border: none; border-top: 2px dashed #bbb; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 6px 4px; border-bottom: 1px solid #ddd; font-size: 0.96rem; }
        th { text-align: left; font-weight: 800; }
        th:last-child, td:last-child { text-align: right; }
        .summary { margin-top: 10px; font-size: 1.08rem; font-weight: 900; text-align: right; }
      </style>
    </head>
    <body>
      <div class="wrap">
        <h1>FATAYEL & MORE</h1>
        <h2>${refund.type === "partial" ? "PARTIAL REFUND" : "FULL REFUND"}</h2>
        <div class="meta">Order #${refund.orderNumber || "-"} | ID ${refund.orderId}</div>
        <div class="meta">${new Date(refund.at).toLocaleString()} by ${escapeHtml(refund.by || "System")}</div>
        <hr class="divider" />
        <table>
          <thead>
            <tr><th>Item</th><th style="text-align:center;">Qty</th><th>Amount</th></tr>
          </thead>
          <tbody>
            ${itemLines || '<tr><td colspan="3" style="text-align:center;">No item details</td></tr>'}
          </tbody>
        </table>
        <div class="summary">Refund Total: -${formatMoney(refund.total || 0)}</div>
      </div>
    </body>
    </html>
  `;

  const win = window.open("", "_blank", "width=420,height=700");
  if (!win) return;
  win.document.write(html);
  setTimeout(() => {
    win.print();
    win.close();
  }, 250);
}

function findTransactionById(orderId) {
  const id = Number(orderId);
  return state.reports.monthly.find((t) => Number(t.id) === id)
    || state.reports.daily.find((t) => Number(t.id) === id)
    || null;
}

function findTransactionByOrderNumber(orderNum) {
  const num = Number(orderNum);
  if (!Number.isFinite(num)) return null;
  const byId = new Map();
  [...(state.reports.monthly || []), ...(state.reports.daily || [])].forEach((t) => {
    if (Number(t.orderNumber) !== num) return;
    byId.set(Number(t.id), t);
  });
  const matches = Array.from(byId.values());
  if (!matches.length) return null;
  matches.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  return matches[0];
}

function resolveRefundTarget(raw) {
  if (!raw) {
    return state.lastTransaction || null;
  }
  // Try order number first (small numbers like 1, 5, 42)
  const num = Number(raw);
  if (Number.isFinite(num)) {
    const byOrderNum = findTransactionByOrderNumber(num);
    if (byOrderNum) return byOrderNum;
    // Fallback to transaction ID
    const byId = findTransactionById(num);
    if (byId) return byId;
  }
  return null;
}

function closePartialRefundPanel() {
  partialRefundContext = null;
  if (el.partialRefundPanel) el.partialRefundPanel.classList.add("hidden");
  if (el.partialRefundItemSelect) el.partialRefundItemSelect.innerHTML = "";
  if (el.partialRefundQtySelect) el.partialRefundQtySelect.innerHTML = "";
  if (el.partialRefundHint) el.partialRefundHint.textContent = "Select item and quantity to refund.";
}

function refreshPartialRefundQtyOptions() {
  if (!partialRefundContext || !el.partialRefundItemSelect || !el.partialRefundQtySelect) return;
  const selectedIndex = Number(el.partialRefundItemSelect.value);
  const selectedItem = partialRefundContext.items[selectedIndex];
  if (!selectedItem) {
    el.partialRefundQtySelect.innerHTML = "";
    return;
  }
  const maxQty = Number(selectedItem.qty || 0);
  el.partialRefundQtySelect.innerHTML = Array.from({ length: maxQty }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
  if (el.partialRefundHint) {
    el.partialRefundHint.textContent = `Refunding from: ${localizeMenuName(selectedItem.name)} (available ${maxQty})`;
  }
}

function startPartialRefundFlow(orderId) {
  const tx = findTransactionById(orderId);
  if (!tx) {
    alert("Order not found.");
    return;
  }
  if (!Array.isArray(tx.items) || !tx.items.length) {
    alert("Order has no refundable items.");
    return;
  }

  partialRefundContext = {
    orderId: Number(orderId),
    items: tx.items.map((item) => ({
      name: item.name,
      qty: Number(item.qty || 0),
      price: Number(item.price || 0),
    })),
  };

  if (!el.partialRefundPanel || !el.partialRefundItemSelect || !el.partialRefundQtySelect) {
    alert("Partial refund panel is not available.");
    return;
  }

  el.partialRefundItemSelect.innerHTML = partialRefundContext.items
    .map((item, idx) => `<option value="${idx}">${idx + 1}. ${escapeHtml(localizeMenuName(item.name))} (Qty ${item.qty}, ${formatMoney(item.price)})</option>`)
    .join("");

  refreshPartialRefundQtyOptions();
  el.partialRefundPanel.classList.remove("hidden");
}

function refundOrderById(orderId, options = {}) {
  const id = Number(orderId);
  if (!Number.isFinite(id)) {
    alert("Invalid order ID.");
    closePartialRefundPanel();
    return;
  }

  const originalTx = findTransactionById(id);
  if (!originalTx) {
    alert("Order not found.");
    closePartialRefundPanel();
    return;
  }

  const partial = options.partial || null;
  let refundTotal = 0;
  let refundItems = [];
  let refundType = "full";

  if (partial && Number.isInteger(partial.itemIndex) && Number.isInteger(partial.qty)) {
    refundType = "partial";
    const item = originalTx.items?.[partial.itemIndex];
    if (!item) {
      alert("Item not found for partial refund.");
      return;
    }
    const qty = Number(partial.qty);
    const existingQty = Number(item.qty || 0);
    if (qty < 1 || qty > existingQty) {
      alert("Invalid partial refund quantity.");
      return;
    }

    const itemUnit = Number(item.price || 0);
    const itemSubtotalRefund = itemUnit * qty;
    const previousSubtotal = Number(originalTx.subtotal || 0);
    const ratio = previousSubtotal > 0 ? Math.min(1, itemSubtotalRefund / previousSubtotal) : 0;

    refundTotal = Number((Number(originalTx.total || 0) * ratio).toFixed(2));
    refundItems = [{ name: item.name, qty, total: refundTotal }];

    item.qty = existingQty - qty;
    if (item.qty <= 0) {
      originalTx.items.splice(partial.itemIndex, 1);
    }

    const scale = 1 - ratio;
    originalTx.subtotal = Number((Number(originalTx.subtotal || 0) * scale).toFixed(2));
    originalTx.discountAmount = Number((Number(originalTx.discountAmount || 0) * scale).toFixed(2));
    originalTx.serviceAmount = Number((Number(originalTx.serviceAmount || 0) * scale).toFixed(2));
    originalTx.tax = Number((Number(originalTx.tax || 0) * scale).toFixed(2));
    originalTx.total = Number((Number(originalTx.total || 0) * scale).toFixed(2));

    if (!originalTx.items.length || originalTx.total <= 0) {
      state.reports.daily = state.reports.daily.filter((t) => Number(t.id) !== id);
      state.reports.monthly = state.reports.monthly.filter((t) => Number(t.id) !== id);
      state.kitchenTickets = state.kitchenTickets.filter((k) => Number(k.transactionId) !== id);
      refundType = "full";
    }
  } else {
    refundTotal = Number(originalTx.total || 0);
    refundItems = (originalTx.items || []).map((item) => ({
      name: item.name,
      qty: Number(item.qty || 0),
      total: Number(item.price || 0) * Number(item.qty || 0),
    }));

    state.reports.daily = state.reports.daily.filter((t) => Number(t.id) !== id);
    state.reports.monthly = state.reports.monthly.filter((t) => Number(t.id) !== id);
    state.kitchenTickets = state.kitchenTickets.filter((k) => Number(k.transactionId) !== id);

    if (originalTx.delivery?.customerId) {
      const customer = findCustomerById(originalTx.delivery.customerId);
      if (customer) {
        customer.orderCount = Math.max(0, Number(customer.orderCount || 0) - 1);
      }
    }
  }

  if (state.lastTransaction && Number(state.lastTransaction.id) === id && refundType === "full") {
    state.lastTransaction = state.reports.monthly.length
      ? state.reports.monthly[state.reports.monthly.length - 1]
      : null;
  }

  const refundRecord = {
    id: Date.now() + Math.floor(Math.random() * 999),
    at: new Date().toISOString(),
    orderId: id,
    orderNumber: originalTx.orderNumber || null,
    total: Number(refundTotal || 0),
    paymentMethod: originalTx.paymentMethod || "cash",
    type: refundType,
    items: refundItems,
    by: state.currentUser ? `${state.currentUser.name} (${state.currentUser.role})` : "System",
  };

  state.refunds.unshift(refundRecord);
  state.refunds = state.refunds.slice(0, 300);

  addAudit(
    "ORDER_REFUNDED",
    `${refundType.toUpperCase()} refund on order #${id} (${formatMoney(refundRecord.total || 0)})`
  );
  saveState();
  updateReports();
  renderKitchenQueue();
  renderShiftPanel();
  renderReceiptPreview();
  renderCustomers();
  renderOrder();
  closePartialRefundPanel();

  if (originalTx.paymentMethod === "cash") {
    openCashDrawer();
  }

  printRefundReceipt(refundRecord);

  alert(`${refundType === "partial" ? "Partial" : "Full"} refund completed for order #${id}.`);
}

// ─── Customer Loyalty System ──────────────────────────────────────────────────

const LOYALTY_THRESHOLD = 10; // free meal every N orders

function normalizePhone(phone) {
  return String(phone || "").replace(/[^\da-zA-Z]/g, "").toLowerCase();
}

function buildCustomerLink(customerId) {
  return `${window.location.origin}${window.location.pathname}?cid=${encodeURIComponent(customerId)}`;
}

function extractCustomerIdFromInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const direct = raw.match(/([A-Z0-9][A-Z0-9_-]{2,31})/i);
  if (direct) return direct[1].toUpperCase();
  try {
    const url = new URL(raw);
    const cid = url.searchParams.get("cid");
    if (cid && /^([A-Z0-9][A-Z0-9_-]{2,31})$/i.test(cid)) return cid.toUpperCase();
  } catch {
    // Not a URL, ignore parsing error.
  }
  return "";
}

function findCustomerById(customerId) {
  const id = String(customerId || "").trim().toUpperCase();
  if (!id) return null;
  return state.customers.find((c) => String(c.customerId || "").toUpperCase() === id) || null;
}

function findCustomerByPhone(phone) {
  const key = normalizePhone(phone);
  if (!key) return null;
  return state.customers.find((c) => normalizePhone(c.phone) === key) || null;
}

function fillDeliveryFromCustomer(customer) {
  if (!customer) return;
  if (el.deliveryCustomerRef) el.deliveryCustomerRef.value = customer.customerId || "";
  if (el.deliveryName && !el.deliveryName.value.trim()) el.deliveryName.value = customer.name || "";
  if (el.deliveryPhone && !el.deliveryPhone.value.trim()) el.deliveryPhone.value = customer.phone || "";
  if (el.deliveryAddress && !el.deliveryAddress.value.trim()) el.deliveryAddress.value = customer.address || "";
}

function registerCustomerFromForm() {
  const idRaw = el.newCustomerId?.value.trim() || "";
  const customerId = extractCustomerIdFromInput(idRaw);
  const name = el.newCustomerName?.value.trim() || "";
  const phone = el.newCustomerPhone?.value.trim() || "";
  const address = el.newCustomerAddress?.value.trim() || "";

  if (!customerId) return alert("Enter a valid customer ID (letters, numbers, _ or -).");
  if (!name) return alert("Enter customer name.");
  if (!phone) return alert("Enter customer phone.");
  if (!address) return alert("Enter customer address.");
  if (findCustomerById(customerId)) return alert("Customer ID already exists.");
  if (findCustomerByPhone(phone)) return alert("Phone already exists for another customer.");

  const customer = {
    id: Date.now(),
    customerId,
    name,
    phone,
    address,
    orderCount: 0,
    createdAt: new Date().toISOString(),
    lastVisit: null,
  };
  state.customers.push(customer);
  addAudit("CUSTOMER_CREATED", `${customer.name} | ${customer.phone} | ${customer.customerId}`);
  saveState();
  renderCustomers();

  if (el.newCustomerId) el.newCustomerId.value = "";
  if (el.newCustomerName) el.newCustomerName.value = "";
  if (el.newCustomerPhone) el.newCustomerPhone.value = "";
  if (el.newCustomerAddress) el.newCustomerAddress.value = "";
  alert(`Customer registered. ID: ${customer.customerId}`);
}

function upsertCustomer(delivery) {
  if (!delivery) return { customer: null, isNew: false };
  const refId = extractCustomerIdFromInput(delivery.customerRef);
  const customer = refId ? findCustomerById(refId) : null;
  if (!customer) return { customer: null, isNew: false };
  customer.orderCount += 1;
  customer.lastVisit = new Date().toISOString();
  return { customer, isNew: false };
}

function getLoyaltyBadge(customer) {
  const progress = customer.orderCount % LOYALTY_THRESHOLD;
  const remaining = LOYALTY_THRESHOLD - progress;
  const isFree = progress === 0 && customer.orderCount > 0;
  return { remaining: isFree ? 0 : remaining, isFree };
}

function renderCustomers(filter) {
  if (!el.customerList) return;
  const query = (filter !== undefined ? filter : (el.customerSearch?.value || "")).toLowerCase().trim();
  const list = query
    ? state.customers.filter(
        (c) =>
          String(c.customerId || "").toLowerCase().includes(query) ||
          c.name.toLowerCase().includes(query) ||
          normalizePhone(c.phone).includes(normalizePhone(query))
      )
    : [...state.customers];

  list.sort((a, b) => b.orderCount - a.orderCount);

  if (!list.length) {
    el.customerList.innerHTML = `<div class="text-muted">${query ? "No customers match your search." : "No customers yet. They are added automatically on delivery orders."}</div>`;
    return;
  }

  el.customerList.innerHTML = list
    .map((c) => {
      const badge = getLoyaltyBadge(c);
      const barWidth = Math.min(100, ((c.orderCount % LOYALTY_THRESHOLD) / LOYALTY_THRESHOLD) * 100);
      const loyaltyColor = badge.isFree ? "#f5c400" : "#3b8beb";
      const badgeHtml = badge.isFree
        ? `<span style="background:#f5c400;color:#0a0a0a;border-radius:4px;padding:2px 8px;font-weight:700;font-size:0.78rem;">&#127873; FREE MEAL EARNED!</span>`
        : `<span style="color:#aaa;font-size:0.82rem;">${badge.remaining} order${badge.remaining !== 1 ? "s" : ""} to free meal</span>`;

      return `<div class="card" style="margin-bottom:8px; border-color:${badge.isFree ? "#f5c400" : "#2a2a2a"};">
        <div class="inline-row" style="margin:0; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:6px;">
          <div>
            <strong style="font-size:1rem;">${escapeHtml(c.name)}</strong>
            <div class="text-muted" style="font-size:0.85rem;">&#128222; ${escapeHtml(c.phone)}</div>
            <div class="text-muted" style="font-size:0.8rem;">ID: ${escapeHtml(c.customerId || "")}</div>
            ${c.address ? `<div class="text-muted" style="font-size:0.82rem;">&#128205; ${escapeHtml(c.address)}</div>` : ""}
            <div class="text-muted" style="font-size:0.8rem;">First: ${new Date(c.createdAt).toLocaleDateString()} | Last: ${c.lastVisit ? new Date(c.lastVisit).toLocaleDateString() : "\u2014"}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:1.4rem;font-weight:700;color:${loyaltyColor};">${c.orderCount}</div>
            <div style="font-size:0.75rem;color:#aaa;">orders</div>
          </div>
        </div>
        <div style="margin-top:8px; background:#1a1a1a; border-radius:4px; height:8px; overflow:hidden;">
          <div style="width:${barWidth}%; height:100%; background:${loyaltyColor};"></div>
        </div>
        <div style="margin-top:5px; display:flex; justify-content:space-between; align-items:center;">
          ${badgeHtml}
        </div>
      </div>`;
    })
    .join("");
}

// ─────────────────────────────────────────────────────────────────────────────

function applyAllRenders() {
  renderCategoryFilters();
  renderMenu();
  renderMenuManagement();
  populateMenuCategorySelect();
  renderInventory();
  renderUsers();
  renderOrder();
  renderReceiptPreview();
  renderKitchenQueue();
  renderOnlineOrders();
  renderShiftPanel();
  renderCustomers();
  updateReports();

  el.discountType.value = state.posConfig.discountType;
  el.discountValue.value = state.posConfig.discountValue;
  el.serviceChargePct.value = state.posConfig.serviceChargePct;
  el.taxMode.value = state.posConfig.taxMode;
  el.paymentMethod.value = state.posConfig.paymentMethod;

  renderHeldOrders();
  updateChangeDisplay();

  updateRoleDisplay();
  updateOnlineOrdersBadge();

  if (!isSignedIn()) {
    el.views.forEach((v) => v.classList.add("hidden"));
    return;
  }

  const savedView = localStorage.getItem("ftayelPosLastView") || localStorage.getItem("celinaPosLastView") || state.activeView || "pos";
  const safeView = canAccessView(savedView) ? savedView : "pos";
  setActiveNav(safeView, true);
}

function wireButtons() {
  el.navBtns.forEach((btn) => {
    btn.addEventListener("click", () => setActiveNav(btn.dataset.view));
  });

  el.loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = el.loginUsername.value.trim();
    const password = el.loginPassword.value.trim();
    if (!loginWithCredentials(username, password)) return;
    applyAllRenders();
    saveState();
  });

  el.logoutBtn?.addEventListener("click", () => {
    logout();
  });

  el.settingsResetBtn?.addEventListener("click", () => {
    if (!isManagerOnly()) return alert("Only manager can reset app data.");
    if (!confirm("Reset everything to factory defaults? This cannot be undone.")) return;
    resetToFactoryDefaults();
    alert("App data was reset. You can login again now.");
  });

  el.clearOrder.addEventListener("click", () => {
    state.order = [];
    state._activeOrderIdx = null;
    renderOrder();
    renderModifierArea();
  });

  el.holdOrderBtn?.addEventListener("click", holdOrder);

  el.cashReceived?.addEventListener("input", updateChangeDisplay);

  // Show/hide cash calculator based on payment method changes
  el.paymentMethod?.addEventListener("change", () => {
    state.posConfig.paymentMethod = el.paymentMethod.value;
    updateChangeDisplay();
    renderOrder();
  });

  el.refundOrderBtn?.addEventListener("click", () => {
    if (!isSignedIn()) return alert("Please login first.");
    const raw = el.refundOrderId?.value.trim();
    const tx = resolveRefundTarget(raw);
    if (!tx) return alert(raw ? "Order not found." : "Enter order number or pay an order first.");
    if (!confirm(`Refund order #${tx.orderNumber || tx.id}?`)) return;
    refundOrderById(tx.id);
    if (el.refundOrderId) el.refundOrderId.value = "";
  });

  el.partialRefundBtn?.addEventListener("click", () => {
    if (!isSignedIn()) return alert("Please login first.");
    const raw = el.refundOrderId?.value.trim();
    const tx = resolveRefundTarget(raw);
    if (!tx) return alert(raw ? "Order not found." : "Enter order number or pay an order first.");
    startPartialRefundFlow(tx.id);
  });

  el.partialRefundItemSelect?.addEventListener("change", refreshPartialRefundQtyOptions);

  el.cancelPartialRefundBtn?.addEventListener("click", () => {
    closePartialRefundPanel();
  });

  el.confirmPartialRefundBtn?.addEventListener("click", () => {
    if (!partialRefundContext || !el.partialRefundItemSelect || !el.partialRefundQtySelect) return;
    const itemIndex = Number(el.partialRefundItemSelect.value);
    const qty = Number(el.partialRefundQtySelect.value);
    const selectedItem = partialRefundContext.items[itemIndex];
    if (!selectedItem) {
      alert("Please select a valid item.");
      return;
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > Number(selectedItem.qty || 0)) {
      alert("Please select a valid quantity.");
      return;
    }
    if (!confirm(`Refund ${qty}x ${selectedItem.name} from order #${partialRefundContext.orderId}?`)) return;
    refundOrderById(partialRefundContext.orderId, { partial: { itemIndex, qty } });
    closePartialRefundPanel();
    if (el.refundOrderId) el.refundOrderId.value = "";
  });

  el.payOrder.addEventListener("click", completePayment);

  el.printReceipt.addEventListener("click", () => {
    if (!state.lastTransaction) return alert("No paid transaction yet.");
    printCustomerReceipt(state.lastTransaction);
  });

  el.printKitchen.addEventListener("click", () => {
    if (!state.kitchenTickets.length) return alert("No kitchen ticket yet.");
    printKitchenReceipt(state.kitchenTickets[0]);
  });

  el.addItemBtn.addEventListener("click", () => {
    if (!isManagerOrAdmin()) return alert("Only manager/admin can add menu items.");
    const name = el.newItemName.value.trim();
    const price = Number(el.newItemPrice.value);
    if (!name || !price) return alert("Please fill in name and price.");

    const nextId = Math.max(0, ...state.menu.map((m) => m.id)) + 1;
    state.menu.push({ id: nextId, name, price });
    addAudit("MENU_ITEM_ADDED", `${name} ${formatMoney(price)}`);

    el.newItemName.value = "";
    el.newItemPrice.value = "";
    saveState();
    renderMenuManagement();
    renderMenu();
  });

  el.addInvBtn.addEventListener("click", () => {
    if (!isManagerOrAdmin()) return alert("Only manager/admin can add inventory.");
    const name = el.invName.value.trim();
    const qty = Number(el.invQty.value);
    const alertVal = Number(el.invAlert.value);
    if (!name) return alert("Please fill in item name.");

    const nextId = Math.max(0, ...state.inventory.map((i) => i.id)) + 1;
    state.inventory.push({ id: nextId, name, category: "General", qty, alert: alertVal });
    addAudit("INVENTORY_ADDED", `${name} qty ${qty}, alert ${alertVal}`);

    el.invName.value = "";
    el.invQty.value = "";
    el.invAlert.value = "";
    saveState();
    renderInventory();
  });

  el.importInventoryBtn?.addEventListener("click", () => {
    if (!isManagerOrAdmin()) return alert("Only manager/admin can import inventory.");
    el.inventoryFileInput?.click();
  });

  el.downloadInventoryTemplateBtn?.addEventListener("click", () => {
    if (!isManagerOrAdmin()) return alert("Only manager/admin can download inventory template.");
    const lang = getCurrentPageLanguage();
    const fileName = lang === "ar" ? "inventory_template_ar.csv" : "inventory_template.csv";
    const link = document.createElement("a");
    link.href = fileName;
    link.download = fileName;
    link.click();
  });

  el.inventoryFileInput?.addEventListener("change", async () => {
    const file = el.inventoryFileInput.files?.[0];
    if (!file) return;
    try {
      await importInventoryFromFile(file);
    } catch (err) {
      console.error(err);
      alert("Failed to import inventory file.");
    }
    el.inventoryFileInput.value = "";
  });

  el.addUserBtn.addEventListener("click", () => {
    if (!isAdmin()) return alert("Only admin can add users.");
    const username = el.username.value.trim();
    const password = el.userPassword.value.trim();
    const role = el.roleSelect.value;
    if (!username) return alert("Please enter a username.");
    if (!password) return alert("Please enter a password.");
    if (state.users.some((u) => u.name === username)) return alert("Username already exists.");

    state.users.push({ name: username, role, password });
    addAudit("USER_ADDED", `${username} (${role})`);

    el.username.value = "";
    el.userPassword.value = "";
    saveState();
    renderUsers();
  });

  const onConfigChange = () => {
    state.posConfig.discountType = el.discountType.value;
    state.posConfig.discountValue = Number(el.discountValue.value || 0);
    state.posConfig.serviceChargePct = Number(el.serviceChargePct.value || 0);
    state.posConfig.taxMode = el.taxMode.value === "inclusive" ? "inclusive" : "exclusive";
    state.posConfig.paymentMethod = el.paymentMethod.value === "card" ? "card" : "cash";
    saveState();
    renderOrder();
  };

  el.discountType.addEventListener("change", onConfigChange);
  el.discountValue.addEventListener("input", onConfigChange);
  el.serviceChargePct.addEventListener("input", onConfigChange);
  el.taxMode.addEventListener("change", onConfigChange);
  el.paymentMethod.addEventListener("change", onConfigChange);

  el.openShiftBtn.addEventListener("click", openShift);
  el.closeShiftBtn.addEventListener("click", closeShift);
  el.addCustomerBtn?.addEventListener("click", registerCustomerFromForm);

  el.saveOnlineSettingsBtn?.addEventListener("click", () => {
    state.onlineOrdersConfig.endpoint = String(el.onlineEndpoint?.value || "").trim();
    state.onlineOrdersConfig.authToken = String(el.onlineToken?.value || "").trim();
    saveState();
    startOnlineOrdersAutoSync();
    if (el.onlineOrdersStatus) el.onlineOrdersStatus.textContent = "Online order settings saved.";
  });

  el.syncOnlineOrdersBtn?.addEventListener("click", () => {
    syncOnlineOrdersFromEndpoint();
  });

  el.importOnlineOrdersBtn?.addEventListener("click", () => {
    const raw = String(el.onlineOrdersJson?.value || "").trim();
    if (!raw) return alert("Paste online orders JSON first.");
    try {
      const parsed = JSON.parse(raw);
      const result = importOnlineOrders(parsed);
      state.onlineOrdersConfig.lastSyncAt = new Date().toISOString();
      saveState();
      renderOnlineOrders();
      if (el.onlineOrdersStatus) {
        el.onlineOrdersStatus.textContent = `Imported manually. Added: ${result.added}, Updated: ${result.updated}`;
      }
    } catch (err) {
      alert("Invalid JSON format.");
    }
  });

  document.querySelectorAll("input[name='orderType']").forEach((radio) => {
    radio.addEventListener("change", () => {
      const isDelivery = el.orderTypeDelivery?.checked;
      el.deliveryFields?.classList.toggle("hidden", !isDelivery);
    });
  });

  el.exportDaily.addEventListener("click", () => {
    if (!isManagerOrAdmin()) return alert("Only manager/admin can export reports.");
    const tx = getSelectedDayTransactions();
    const rows = buildDetailedReportRows(tx);
    const dayLabel = el.reportDay?.value || new Date().toISOString().slice(0, 10);
    downloadCSV(rows.length ? rows : [{ Message: "No transactions for " + dayLabel }], `daily_report_${dayLabel}.csv`);
  });

  el.printDailyReceipt?.addEventListener("click", () => {
    if (!isManagerOrAdmin()) return alert("Only manager/admin can print reports.");
    const tx = getSelectedDayTransactions();
    printDailyReport(tx);
  });

  el.exportMonthly.addEventListener("click", () => {
    if (!isManagerOrAdmin()) return alert("Only manager/admin can export reports.");
    const tx = getSelectedMonthTransactions();
    const rows = buildDetailedReportRows(tx);
    const monthLabel = el.reportMonth?.value || new Date().toISOString().slice(0, 7);
    downloadCSV(rows.length ? rows : [{ Message: "No transactions for " + monthLabel }], `monthly_report_${monthLabel}.csv`);
  });

  el.reportDay?.addEventListener("change", () => updateReports());
  el.reportMonth?.addEventListener("change", () => updateReports());

  el.exportBackup.addEventListener("click", () => {
    if (!isManagerOrAdmin()) return alert("Only manager/admin can create backup.");
    exportBackup();
  });

  el.importBackup.addEventListener("click", () => {
    if (!isManagerOrAdmin()) return alert("Only manager/admin can restore backup.");
    el.backupFileInput.click();
  });

  el.backupFileInput.addEventListener("change", () => {
    const file = el.backupFileInput.files?.[0];
    if (!file) return;
    importBackup(file);
    el.backupFileInput.value = "";
  });

  el.orderTypeDelivery?.addEventListener("change", () => {
    if (el.deliveryFields) el.deliveryFields.classList.remove("hidden");
    if (el.deliveryCustomerRef?.value.trim()) {
      el.deliveryCustomerRef.dispatchEvent(new Event("input"));
    } else if (el.deliveryPhone?.value.trim()) {
      el.deliveryPhone.dispatchEvent(new Event("input"));
    }
  });
  el.orderTypeDineIn?.addEventListener("change", () => {
    if (el.deliveryFields) el.deliveryFields.classList.add("hidden");
    if (el.customerLookupMsg) el.customerLookupMsg.textContent = "";
    if (el.customerLoyaltyLink) el.customerLoyaltyLink.textContent = "";
  });

  // Loyalty ID/link lookup: paste ID or full link, then auto-fill customer details.
  el.deliveryCustomerRef?.addEventListener("input", () => {
    const customerId = extractCustomerIdFromInput(el.deliveryCustomerRef.value);
    if (!customerId) {
      if (el.customerLookupMsg) el.customerLookupMsg.textContent = "";
      if (el.customerLoyaltyLink) el.customerLoyaltyLink.textContent = "";
      return;
    }
    const customer = findCustomerById(customerId);
    if (!customer) {
      if (el.customerLookupMsg) el.customerLookupMsg.textContent = "Customer ID not found.";
      if (el.customerLoyaltyLink) el.customerLoyaltyLink.textContent = "";
      return;
    }
    fillDeliveryFromCustomer(customer);
    const badge = getLoyaltyBadge(customer);
    if (el.customerLookupMsg) {
      el.customerLookupMsg.textContent = badge.isFree
        ? `Returning customer ${customer.name} | FREE MEAL EARNED`
        : `Returning customer ${customer.name} | ${customer.orderCount} visits | ${badge.remaining} to free meal`;
    }
    if (el.customerLoyaltyLink) el.customerLoyaltyLink.textContent = `Link: ${buildCustomerLink(customer.customerId)}`;
  });

  // Phone auto-lookup: fill name/address from saved customer
  el.deliveryPhone?.addEventListener("input", () => {
    const phone = el.deliveryPhone.value.trim();
    const customer = findCustomerByPhone(phone);
    if (!customer) {
      if (el.customerLookupMsg) el.customerLookupMsg.textContent = "";
      if (el.customerLoyaltyLink) el.customerLoyaltyLink.textContent = "";
      return;
    }
    const badge = getLoyaltyBadge(customer);
    if (el.customerLookupMsg) {
      el.customerLookupMsg.textContent = badge.isFree
        ? `Phone found: ${customer.name}. Use ID ${customer.customerId} (free meal earned).`
        : `Phone found: ${customer.name}. Use ID ${customer.customerId} (${badge.remaining} to free meal).`;
    }
    if (el.customerLoyaltyLink) el.customerLoyaltyLink.textContent = `Link: ${buildCustomerLink(customer.customerId)}`;
  });

  // Customer search live filter
  el.customerSearch?.addEventListener("input", () => renderCustomers());
}

function setupCurrencyToggle() {
  const update = () => {
    el.currLbpBtn?.classList.toggle("active", state.currency === "lbp");
    el.currUsdBtn?.classList.toggle("active", state.currency === "usd");
    el.currLbpBtn?.setAttribute("aria-pressed", state.currency === "lbp" ? "true" : "false");
    el.currUsdBtn?.setAttribute("aria-pressed", state.currency === "usd" ? "true" : "false");
  };
  update();
  el.currLbpBtn?.addEventListener("click", () => {
    state.currency = "lbp";
    update();
    renderMenu();
    renderOrder();
    updateReports();
    saveState();
  });
  el.currUsdBtn?.addEventListener("click", () => {
    state.currency = "usd";
    update();
    renderMenu();
    renderOrder();
    updateReports();
    saveState();
  });
}

function enforceLoggedOutOnStartup() {
  state.currentUser = null;
}

function init() {
  const redirected = setupLanguageToggle();
  if (redirected) return;
  loadState();
  enforceLoggedOutOnStartup();
  ensureCriticalNavButtons();
  setupCurrencyToggle();
  wireButtons();
  applyAllRenders();
  startOnlineOrdersAutoSync();
}

init();

// ── PWA Install & Service Worker ──
let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const hint = document.getElementById("pwaInstallHint");
  if (hint) hint.style.display = "none";
});

const pwaInstallBtn = document.getElementById("pwaInstallBtn");
if (pwaInstallBtn) {
  pwaInstallBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      alert(document.documentElement.lang === "ar"
        ? "التثبيت غير متاح حالياً. استعمل Chrome أو Edge واضغط على أيقونة التثبيت ⬇️ بشريط العنوان."
        : "Install not available. Use Chrome or Edge and click the install icon ⬇️ in the address bar.");
      return;
    }
    deferredInstallPrompt.prompt();
    const result = await deferredInstallPrompt.userChoice;
    if (result.outcome === "accepted") {
      const card = document.getElementById("pwaInstallCard");
      if (card) card.innerHTML = "<p style='color:#4caf50;font-weight:700;margin:0;'>✅ " +
        (document.documentElement.lang === "ar" ? "تم التثبيت بنجاح!" : "Installed successfully!") + "</p>";
    }
    deferredInstallPrompt = null;
  });
}

window.addEventListener("appinstalled", () => {
  const card = document.getElementById("pwaInstallCard");
  if (card) card.innerHTML = "<p style='color:#4caf50;font-weight:700;margin:0;'>✅ " +
    (document.documentElement.lang === "ar" ? "التطبيق مثبّت! افتحه من سطح المكتب." : "App installed! Open it from your desktop.") + "</p>";
  deferredInstallPrompt = null;
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

window.addEventListener('beforeunload', () => {
  state.currentUser = null;
  saveState();
});
