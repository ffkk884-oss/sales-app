import { useState, useMemo, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  BarChart3,
  Plus,
  Search,
  Trash2,
  Pencil,
  X,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronRight,
  Receipt,
  Printer,
  Menu,
  LogOut,
  Loader2,
} from "lucide-react";
import { supabase } from "./supabaseClient";

// 個人/法人の区分に応じた敬称
const honorific = (customer) => (customer?.kind === "individual" ? "様" : "御中");
const kindLabel = (kind) => (kind === "individual" ? "個人" : "法人");

const PAYMENT_METHODS = [
  ["bank_transfer", "銀行振込"],
  ["cash", "現金"],
  ["credit_card", "クレジットカード"],
  ["e_money", "電子マネー・QRコード決済"],
  ["cod", "代金引換"],
];
const paymentLabel = (v) => PAYMENT_METHODS.find(([k]) => k === v)?.[1] ?? "—";

const yen = (n) => "¥" + Math.round(n).toLocaleString("ja-JP");
const TAX_RATE = 0.1;
const docSubtotal = (doc) => doc.items.reduce((sum, it) => sum + it.qty * it.price, 0);
const docTax = (doc) => Math.round(docSubtotal(doc) * TAX_RATE);
const docTotal = (doc) => docSubtotal(doc) + docTax(doc);
// ---------- 自社情報（見積書・請求書・領収書に表示） ----------

const COMPANY = {
  name: "後畳店",
  representative: "後 明広",
  phone: "0739-22-8302",
  fax: "0739-25-2788",
  email: "tatami@ushirotatami.com",
  addressMain: "本店：和歌山県田辺市高雄3-11-33",
  addressShowroom: "ショールーム：和歌山県田辺市新庄町1800-108",
  license: "一級技能士 内装仕上業 和歌山県知事許可第17097号",
  bank: "紀陽銀行 田辺支店 普通1454963　口座名：後明広",
  invoiceNumber: "T6-8104-4860-3885",
};
const today = () => new Date().toISOString().slice(0, 10);

// ---------- データベース行 <-> アプリ内データ 変換 ----------

const customerFromRow = (row) => ({
  id: row.id,
  kind: row.kind,
  name: row.name,
  contact: row.contact ?? "",
  phone: row.phone ?? "",
  email: row.email ?? "",
  postalCode: row.postal_code ?? "",
  address: row.address ?? "",
});
const customerToRow = (c) => ({
  kind: c.kind,
  name: c.name,
  contact: c.contact ?? "",
  phone: c.phone ?? "",
  email: c.email ?? "",
  postal_code: c.postalCode ?? "",
  address: c.address ?? "",
});

const productFromRow = (row) => ({
  id: row.id,
  name: row.name,
  price: Number(row.price),
  stock: Number(row.stock),
  unit: row.unit ?? "個",
  lowStock: Number(row.low_stock ?? 5),
});
const productToRow = (p) => ({
  name: p.name,
  price: p.price,
  stock: p.stock,
  unit: p.unit,
  low_stock: p.lowStock,
});

const docFromRow = (row) => ({
  id: row.id,
  docNumber: row.doc_number,
  type: row.type,
  customerId: row.customer_id,
  date: row.date,
  dueDate: row.due_date,
  status: row.status,
  paymentMethod: row.payment_method,
  items: row.items ?? [],
});
const docToRow = (d) => ({
  doc_number: d.docNumber,
  type: d.type,
  customer_id: d.customerId,
  date: d.date,
  due_date: d.dueDate || null,
  status: d.status,
  payment_method: d.paymentMethod,
  items: d.items,
});

// ---------- 共通UI部品 ----------

function NavItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-[#1c3d34] text-white" : "text-[#5a6a64] hover:bg-[#e8ece9]"
      }`}
    >
      <Icon size={18} strokeWidth={2} />
      <span className="flex-1 text-left">{label}</span>
      {badge ? (
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-[#d9665a] text-white"}`}>
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function StatCard({ label, value, sub, trend, icon: Icon }) {
  return (
    <div className="bg-white rounded-xl border border-[#e3e3dd] p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#8a8a82] tracking-wide">{label}</span>
        <Icon size={16} className="text-[#b8b8ae]" />
      </div>
      <div className="text-2xl font-semibold text-[#23241f] tabular-nums">{value}</div>
      {sub ? (
        <div className={`flex items-center gap-1 text-xs font-medium ${trend === "up" ? "text-[#2e7d5b]" : trend === "down" ? "text-[#c0524a]" : "text-[#8a8a82]"}`}>
          {trend === "up" ? <TrendingUp size={13} /> : trend === "down" ? <TrendingDown size={13} /> : null}
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-3 md:p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-2xl shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-[#ececec] sticky top-0 bg-white">
          <h3 className="font-semibold text-[#23241f]">{title}</h3>
          <button onClick={onClose} className="text-[#9a9a92] hover:text-[#23241f]">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 md:p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-medium text-[#6a6a62] mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-[#dadad2] text-sm focus:outline-none focus:ring-2 focus:ring-[#1c3d34]/30 focus:border-[#1c3d34]";

const STATUS_LABEL = {
  paid: "支払済み",
  unpaid: "未払い",
  draft: "ドラフト",
  sent: "送付済み",
};
const STATUS_COLOR = {
  paid: "bg-[#e3f0e8] text-[#2e7d5b]",
  unpaid: "bg-[#fbe9e7] text-[#c0524a]",
  draft: "bg-[#eef0ec] text-[#6a6a62]",
  sent: "bg-[#e7eef7] text-[#3a64a8]",
};
// ---------- メインアプリ ----------

export default function SalesApp() {
  const [page, setPage] = useState("dashboard");
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const [customerModal, setCustomerModal] = useState(null); // {editing} or null
  const [productModal, setProductModal] = useState(null);
  const [docModal, setDocModal] = useState(null);
  const [receiptDoc, setReceiptDoc] = useState(null); // 領収書表示中の請求書
  const [printDoc, setPrintDoc] = useState(null); // 印刷表示中の見積書・請求書
  const [search, setSearch] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState(null);

  // ---- 初回読み込み：Supabaseから全データを取得 ----
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      const [{ data: custData, error: custErr }, { data: prodData, error: prodErr }, { data: docData, error: docErr }] =
        await Promise.all([
          supabase.from("customers").select("*").order("created_at"),
          supabase.from("products").select("*").order("created_at"),
          supabase.from("documents").select("*").order("created_at"),
        ]);
      if (!custErr && custData) setCustomers(custData.map(customerFromRow));
      if (!prodErr && prodData) setProducts(prodData.map(productFromRow));
      if (!docErr && docData) setInvoices(docData.map(docFromRow));
      setLoading(false);
    };
    loadAll();
  }, []);
  const customerById = (id) => customers.find((c) => c.id === id);
  const productById = (id) => products.find((p) => p.id === id);

  

  const stats = useMemo(() => {
    const paidInvoices = invoices.filter((d) => d.type === "invoice" && d.status === "paid");
    const unpaidInvoices = invoices.filter((d) => d.type === "invoice" && d.status === "unpaid");
    const totalSales = paidInvoices.reduce((s, d) => s + docTotal(d), 0);
    const unpaidTotal = unpaidInvoices.reduce((s, d) => s + docTotal(d), 0);
    const lowStockCount = products.filter((p) => p.stock <= p.lowStock).length;
    return { totalSales, unpaidTotal, lowStockCount, unpaidCount: unpaidInvoices.length };
  }, [invoices, products]);

  // ---- 顧客 CRUD ----
  const saveCustomer = async (data) => {
    if (data.id) {
      const { error } = await supabase.from("customers").update(customerToRow(data)).eq("id", data.id);
      if (error) { alert("保存に失敗しました: " + error.message); return; }
      setCustomers((cs) => cs.map((c) => (c.id === data.id ? data : c)));
    } else {
      const { data: inserted, error } = await supabase.from("customers").insert(customerToRow(data)).select().single();
      if (error) { alert("保存に失敗しました: " + error.message); return; }
      setCustomers((cs) => [...cs, customerFromRow(inserted)]);
    }
    setCustomerModal(null);
  };
  const deleteCustomer = async (id) => {
    if (invoices.some((d) => d.customerId === id)) {
      alert("この取引先には見積書/請求書の履歴があるため削除できません。");
      return;
    }
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) { alert("削除に失敗しました: " + error.message); return; }
    setCustomers((cs) => cs.filter((c) => c.id !== id));
  };

  // ---- 商品 CRUD ----
  const saveProduct = async (data) => {
    if (data.id) {
      const { error } = await supabase.from("products").update(productToRow(data)).eq("id", data.id);
      if (error) { alert("保存に失敗しました: " + error.message); return; }
      setProducts((ps) => ps.map((p) => (p.id === data.id ? data : p)));
    } else {
      const { data: inserted, error } = await supabase.from("products").insert(productToRow(data)).select().single();
      if (error) { alert("保存に失敗しました: " + error.message); return; }
      setProducts((ps) => [...ps, productFromRow(inserted)]);
    }
    setProductModal(null);
  };
  const deleteProduct = async (id) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { alert("削除に失敗しました: " + error.message); return; }
    setProducts((ps) => ps.filter((p) => p.id !== id));
  };

  // ---- 見積/請求 CRUD ----
  const nextDocNumber = (type) => {
    const prefix = type === "estimate" ? "EST" : "INV";
    const count = invoices.filter((d) => d.type === type).length + 1;
    return `${prefix}-${String(count).padStart(4, "0")}`;
  };

  const saveDoc = async (data) => {
    if (data.id) {
      const { error } = await supabase.from("documents").update(docToRow(data)).eq("id", data.id);
      if (error) { alert("保存に失敗しました: " + error.message); return; }
      setInvoices((ds) => ds.map((d) => (d.id === data.id ? data : d)));
    } else {
      const docNumber = nextDocNumber(data.type);
      const { data: inserted, error } = await supabase
        .from("documents")
        .insert(docToRow({ ...data, docNumber }))
        .select()
        .single();
      if (error) { alert("保存に失敗しました: " + error.message); return; }
      setInvoices((ds) => [...ds, docFromRow(inserted)]);
    }
    setDocModal(null);
  };
  const deleteDoc = async (id) => {
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) { alert("削除に失敗しました: " + error.message); return; }
    setInvoices((ds) => ds.filter((d) => d.id !== id));
  };

  const convertToInvoice = async (estimate) => {
    const docNumber = nextDocNumber("invoice");
    const newInvoiceData = {
      ...estimate,
      docNumber,
      type: "invoice",
      status: "unpaid",
      date: today(),
    };
    const { data: inserted, error } = await supabase
      .from("documents")
      .insert(docToRow(newInvoiceData))
      .select()
      .single();
    if (error) { alert("変換に失敗しました: " + error.message); return; }

    const { error: deleteError } = await supabase.from("documents").delete().eq("id", estimate.id);
    if (deleteError) { alert("元の見積書の削除に失敗しました: " + deleteError.message); return; }

    setInvoices((ds) => [...ds.filter((d) => d.id !== estimate.id), docFromRow(inserted)]);
    setPage("invoices");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const filteredCustomers = customers.filter(
    (c) => c.name.includes(search) || (c.contact ?? "").includes(search)
  );
  const filteredProducts = products.filter((p) => p.name.includes(search));
  const filteredDocs = (type) =>
    invoices
      .filter((d) => d.type === type)
      .filter((d) => {
        const cust = customerById(d.customerId);
        return !search || cust?.name.includes(search) || d.docNumber.includes(search);
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));

  const navConfig = [
    { key: "dashboard", label: "ダッシュボード", icon: LayoutDashboard },
    { key: "customers", label: "取引先", icon: Users },
    { key: "products", label: "商品・在庫", icon: Package, badge: stats.lowStockCount || null },
    { key: "estimates", label: "見積書", icon: FileText },
    { key: "invoices", label: "請求書", icon: FileText, badge: stats.unpaidCount || null },
    { key: "reports", label: "売上レポート", icon: BarChart3 },
  ];

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f4f3ee]">
        <div className="flex flex-col items-center gap-3 text-[#5a6a64]">
          <Loader2 size={28} className="animate-spin" />
          <span className="text-sm">データを読み込んでいます...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#f4f3ee] text-[#23241f]" style={{ fontFamily: "'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
      {/* モバイル用ヘッダー */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#fbfaf6] border-b border-[#e3e3dd] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#1c3d34] flex items-center justify-center text-white font-bold text-xs">販</div>
          <span className="font-semibold text-sm">販売管理</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 rounded-lg text-[#5a6a64] hover:bg-[#e8ece9]"
          aria-label="メニューを開く"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* モバイル用メニュー（オーバーレイ） */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative w-64 bg-[#fbfaf6] flex flex-col p-4 h-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 px-2 py-1">
                <div className="w-8 h-8 rounded-lg bg-[#1c3d34] flex items-center justify-center text-white font-bold text-sm">販</div>
                <div>
                  <div className="font-semibold text-sm leading-tight">販売管理</div>
                  <div className="text-[11px] text-[#9a9a92]">Sales Manager</div>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 text-[#9a9a92]">
                <X size={18} />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {navConfig.map((n) => (
                <NavItem
                  key={n.key}
                  icon={n.icon}
                  label={n.label}
                  badge={n.badge}
                  active={page === n.key}
                  onClick={() => {
                    setPage(n.key);
                    setSearch("");
                    setMobileMenuOpen(false);
                  }}
                />
              ))}
            </nav>
            <div className="mt-auto pt-3 border-t border-[#e3e3dd]">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 text-sm text-[#5a6a64] hover:text-[#c0524a] px-4 py-2.5 rounded-lg hover:bg-[#fbe9e7] transition-colors"
              >
                <LogOut size={16} /> ログアウト
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* PC用サイドバー */}
      <aside className="hidden md:flex w-60 bg-[#fbfaf6] border-r border-[#e3e3dd] flex-col p-4 shrink-0">
        <div className="flex items-center gap-2 px-2 py-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[#1c3d34] flex items-center justify-center text-white font-bold text-sm">販</div>
          <div>
            <div className="font-semibold text-sm leading-tight">販売管理</div>
            <div className="text-[11px] text-[#9a9a92]">Sales Manager</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {navConfig.map((n) => (
            <NavItem
              key={n.key}
              icon={n.icon}
              label={n.label}
              badge={n.badge}
              active={page === n.key}
              onClick={() => {
                setPage(n.key);
                setSearch("");
              }}
            />
          ))}
        </nav>
        <div className="mt-auto px-2 py-3 border-t border-[#e3e3dd] pt-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-sm text-[#5a6a64] hover:text-[#c0524a] px-2 py-2 rounded-lg hover:bg-[#fbe9e7] transition-colors"
          >
            <LogOut size={16} /> ログアウト
          </button>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 md:p-8">
          {page === "dashboard" && (
            <DashboardPage
              stats={stats}
              invoices={invoices}
              customerById={customerById}
              docTotal={docTotal}
              products={products}
              setPage={setPage}
            />
          )}

          {page === "customers" && (
            <ListPage
              title="取引先"
              actionLabel="取引先を追加"
              onAction={() => setCustomerModal({})}
              search={search}
              setSearch={setSearch}
              searchPlaceholder="会社名・担当者名で検索"
            >
              <CustomerTable
                rows={filteredCustomers}
                onEdit={(c) => setCustomerModal(c)}
                onDelete={deleteCustomer}
                onHistory={(c) => setHistoryCustomer(c)}
              />
            </ListPage>
          )}

          {page === "products" && (
            <ListPage
              title="商品・在庫"
              actionLabel="商品を追加"
              onAction={() => setProductModal({})}
              search={search}
              setSearch={setSearch}
              searchPlaceholder="商品名で検索"
            >
              <ProductTable
                rows={filteredProducts}
                onEdit={(p) => setProductModal(p)}
                onDelete={deleteProduct}
              />
            </ListPage>
          )}

          {(page === "estimates" || page === "invoices") && (
            <ListPage
              title={page === "estimates" ? "見積書" : "請求書"}
              actionLabel={page === "estimates" ? "見積書を作成" : "請求書を作成"}
              onAction={() =>
                setDocModal({ type: page === "estimates" ? "estimate" : "invoice", date: today(), items: [] })
              }
              search={search}
              setSearch={setSearch}
              searchPlaceholder="取引先名・番号で検索"
            >
              <DocTable
                rows={filteredDocs(page === "estimates" ? "estimate" : "invoice")}
                customerById={customerById}
                docTotal={docTotal}
                onEdit={(d) => setDocModal(d)}
                onDelete={deleteDoc}
                onConvert={page === "estimates" ? convertToInvoice : null}
                onReceipt={page === "invoices" ? (d) => setReceiptDoc(d) : null}
                
              onPrint={(d) => setPrintDoc(d)}
              />
            </ListPage>
          )}

          {page === "reports" && (
            <ReportsPage invoices={invoices} customerById={customerById} docTotal={docTotal} products={products} />
          )}
        </div>
      </main>

      {customerModal && (
        <CustomerForm data={customerModal} onSave={saveCustomer} onClose={() => setCustomerModal(null)} />
      )}
      {historyCustomer && (
        <CustomerHistoryModal
          customer={historyCustomer}
          docs={invoices.filter((d) => d.customerId === historyCustomer.id)}
          docTotal={docTotal}
          onClose={() => setHistoryCustomer(null)}
        />
      )}
      {productModal && (
        <ProductForm data={productModal} onSave={saveProduct} onClose={() => setProductModal(null)} />
      )}
      {docModal && (
        <DocForm
          data={docModal}
          customers={customers}
          products={products}
          onSave={saveDoc}
          onClose={() => setDocModal(null)}
        />
      )}
      {receiptDoc && (
        <ReceiptModal
          doc={receiptDoc}
          customer={customerById(receiptDoc.customerId)}
          docTotal={docTotal}
          onClose={() => setReceiptDoc(null)}
        />
      )}
      {printDoc && (
        <PrintDocModal
          doc={printDoc}
          customer={customerById(printDoc.customerId)}
          productById={productById}
          docTotal={docTotal}
          onClose={() => setPrintDoc(null)}
        />
      )}



    </div>
  );
}
// ---------- ページ: ダッシュボード ----------

function DashboardPage({ stats, invoices, customerById, docTotal, products, setPage }) {
  const recentDocs = [...invoices].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
  const lowStock = products.filter((p) => p.stock <= p.lowStock);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">ダッシュボード</h1>
      <p className="text-sm text-[#8a8a82] mb-6">{today()} 時点の概況</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        <StatCard label="支払済み売上合計" value={yen(stats.totalSales)} icon={TrendingUp} />
        <StatCard
          label="未払い請求"
          value={yen(stats.unpaidTotal)}
          sub={`${stats.unpaidCount}件 未収`}
          trend={stats.unpaidCount > 0 ? "down" : null}
          icon={AlertTriangle}
        />
        <StatCard
          label="発行済みドキュメント"
          value={`${invoices.length} 件`}
          sub={`見積 ${invoices.filter((d) => d.type === "estimate").length}・請求 ${invoices.filter((d) => d.type === "invoice").length}`}
          icon={FileText}
        />
        <StatCard
          label="在庫アラート"
          value={`${stats.lowStockCount} 品目`}
          sub={stats.lowStockCount > 0 ? "発注を検討" : "問題なし"}
          trend={stats.lowStockCount > 0 ? "down" : "up"}
          icon={Package}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl border border-[#e3e3dd] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">最近の見積書・請求書</h2>
            <button onClick={() => setPage("invoices")} className="text-xs text-[#1c3d34] font-medium flex items-center gap-1 hover:underline">
              すべて見る <ChevronRight size={14} />
            </button>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {recentDocs.map((d) => {
                const cust = customerById(d.customerId);
                return (
                  <tr key={d.id} className="border-t border-[#f0f0ec]">
                    <td className="py-2.5 text-[#8a8a82] text-xs font-mono">{d.docNumber}</td>
                    <td className="py-2.5">{cust?.name}</td>
                    <td className="py-2.5 text-[#8a8a82] text-xs">{d.date}</td>
                    <td className="py-2.5 text-right font-medium tabular-nums">{yen(docTotal(d))}</td>
                    <td className="py-2.5 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[d.status]}`}>
                        {STATUS_LABEL[d.status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl border border-[#e3e3dd] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">在庫アラート</h2>
            <button onClick={() => setPage("products")} className="text-xs text-[#1c3d34] font-medium flex items-center gap-1 hover:underline">
              すべて見る <ChevronRight size={14} />
            </button>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-[#8a8a82]">在庫不足の商品はありません。</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span>{p.name}</span>
                  <span className="text-[#c0524a] font-medium tabular-nums">
                    残り {p.stock}{p.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- 共通: リストページ ----------

function ListPage({ title, actionLabel, onAction, search, setSearch, searchPlaceholder, children }) {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-semibold">{title}</h1>
        <button
          onClick={onAction}
          className="flex items-center justify-center gap-1.5 bg-[#1c3d34] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#15302a] transition-colors"
        >
          <Plus size={16} /> {actionLabel}
        </button>
      </div>
      <div className="relative mb-4 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa9a0]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#dadad2] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1c3d34]/30"
        />
      </div>
      <div className="bg-white rounded-xl border border-[#e3e3dd] overflow-x-auto">{children}</div>
    </div>
  );
}

function Th({ children, right }) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold text-[#8a8a82] tracking-wide ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

// ---------- 取引先テーブル ----------

function CustomerTable({ rows, onEdit, onDelete, onHistory }) {
  if (rows.length === 0) return <EmptyState text="取引先が見つかりません。" />;
  return (
    <table className="w-full min-w-[640px] text-sm">
      <thead className="bg-[#fafaf7] border-b border-[#ececec]">
        <tr>
          <Th>氏名・会社名</Th>
          <Th>区分</Th>
          <Th>担当者</Th>
          <Th>電話番号</Th>
          <Th>メール</Th>
          <Th right>操作</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.id} className="border-b border-[#f3f3ef] last:border-0 hover:bg-[#fafaf7]">
            <td className="px-4 py-3 font-medium">{c.name}</td>
            <td className="px-4 py-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.kind === "individual" ? "bg-[#e7eef7] text-[#3a64a8]" : "bg-[#eef0ec] text-[#6a6a62]"}`}>
                {kindLabel(c.kind)}
              </span>
            </td>
            <td className="px-4 py-3 text-[#5a5a52]">{c.contact || "—"}</td>
            <td className="px-4 py-3 text-[#5a5a52]">{c.phone}</td>
            <td className="px-4 py-3 text-[#5a5a52]">{c.email}</td>
            <td className="px-4 py-3 text-right">
              <div className="flex justify-end gap-1.5">
                <button
                  onClick={() => onHistory(c)}
                  className="text-xs px-2.5 py-1 rounded-md border border-[#1c3d34]/30 text-[#1c3d34] font-medium hover:bg-[#1c3d34]/5"
                >
                  履歴
                </button>
                <RowActions onEdit={() => onEdit(c)} onDelete={() => onDelete(c.id)} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------- 取引先の履歴モーダル ----------

function CustomerHistoryModal({ customer, docs, docTotal, onClose }) {
  const sorted = [...docs].sort((a, b) => (a.date < b.date ? 1 : -1));
  const totalPaid = docs
    .filter((d) => d.type === "invoice" && d.status === "paid")
    .reduce((s, d) => s + docTotal(d), 0);
  const totalUnpaid = docs
    .filter((d) => d.type === "invoice" && d.status === "unpaid")
    .reduce((s, d) => s + docTotal(d), 0);

  return (
    <Modal title={`${customer.name} の履歴`} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-[#fafaf7] rounded-lg p-4">
          <div className="text-xs text-[#8a8a82] mb-1">支払済み合計</div>
          <div className="text-xl font-semibold tabular-nums">{yen(totalPaid)}</div>
        </div>
        <div className="bg-[#fafaf7] rounded-lg p-4">
          <div className="text-xs text-[#8a8a82] mb-1">未払い合計</div>
          <div className="text-xl font-semibold tabular-nums text-[#c0524a]">{yen(totalUnpaid)}</div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState text="この取引先の見積書・請求書はまだありません。" />
      ) : (
        <div className="border border-[#ececec] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#fafaf7]">
              <tr>
                <Th>番号</Th>
                <Th>種別</Th>
                <Th>発行日</Th>
                <Th right>金額</Th>
                <Th>状態</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => (
                <tr key={d.id} className="border-t border-[#f3f3ef]">
                  <td className="px-4 py-2.5 font-mono text-xs text-[#5a5a52]">{d.docNumber}</td>
                  <td className="px-4 py-2.5">{d.type === "invoice" ? "請求書" : "見積書"}</td>
                  <td className="px-4 py-2.5 text-[#5a5a52]">{d.date}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">{yen(docTotal(d))}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[d.status]}`}>
                      {STATUS_LABEL[d.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[#dadad2] text-[#5a5a52]">
          閉じる
        </button>
      </div>
    </Modal>
  );
}

// ---------- 商品テーブル ----------

function ProductTable({ rows, onEdit, onDelete }) {
  if (rows.length === 0) return <EmptyState text="商品が見つかりません。" />;
  return (
    <table className="w-full min-w-[560px] text-sm">
      <thead className="bg-[#fafaf7] border-b border-[#ececec]">
        <tr>
          <Th>商品名</Th>
          <Th right>単価</Th>
          <Th right>在庫数</Th>
          <Th>状態</Th>
          <Th right>操作</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => {
          const low = p.stock <= p.lowStock;
          return (
            <tr key={p.id} className="border-b border-[#f3f3ef] last:border-0 hover:bg-[#fafaf7]">
              <td className="px-4 py-3 font-medium">{p.name}</td>
              <td className="px-4 py-3 text-right tabular-nums">{yen(p.price)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{p.stock}{p.unit}</td>
              <td className="px-4 py-3">
                {low ? (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#fbe9e7] text-[#c0524a]">残量わずか</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#e3f0e8] text-[#2e7d5b]">適正</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <RowActions onEdit={() => onEdit(p)} onDelete={() => onDelete(p.id)} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---------- 見積/請求テーブル ----------

function DocTable({ rows, customerById, docTotal, onEdit, onDelete, onConvert, onReceipt, onPrint }) {
  if (rows.length === 0) return <EmptyState text="該当するデータがありません。" />;
  return (
    <table className="w-full min-w-[820px] text-sm">
      <thead className="bg-[#fafaf7] border-b border-[#ececec]">
        <tr>
          <Th>番号</Th>
          <Th>取引先</Th>
          <Th>発行日</Th>
          <Th>支払方法</Th>
          <Th right>金額</Th>
          <Th>状態</Th>
          <Th right>操作</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d) => {
          const cust = customerById(d.customerId);
          return (
            <tr key={d.id} className="border-b border-[#f3f3ef] last:border-0 hover:bg-[#fafaf7]">
              <td className="px-4 py-3 font-mono text-xs text-[#5a5a52]">{d.docNumber}</td>
              <td className="px-4 py-3 font-medium">{cust?.name ?? "—"}</td>
              <td className="px-4 py-3 text-[#5a5a52]">{d.date}</td>
              <td className="px-4 py-3 text-[#5a5a52]">{paymentLabel(d.paymentMethod)}</td>
              <td className="px-4 py-3 text-right tabular-nums font-medium">{yen(docTotal(d))}</td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[d.status]}`}>
                  {STATUS_LABEL[d.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-1.5">
                  {onPrint && (
                    <button
                      onClick={() => onPrint(d)}
                      className="text-xs px-2.5 py-1 rounded-md border border-[#1c3d34]/30 text-[#1c3d34] font-medium hover:bg-[#1c3d34]/5 flex items-center gap-1"
                    >
                      <Printer size={12} /> 印刷
                    </button>
                  )}
                  {onConvert && (
                    <button
                      onClick={() => onConvert(d)}
                      className="text-xs px-2.5 py-1 rounded-md border border-[#1c3d34]/30 text-[#1c3d34] font-medium hover:bg-[#1c3d34]/5"
                    >
                      請求書に変換
                    </button>
                  )}
                  {onReceipt && d.status === "paid" && (
                    <button
                      onClick={() => onReceipt(d)}
                      className="text-xs px-2.5 py-1 rounded-md border border-[#1c3d34]/30 text-[#1c3d34] font-medium hover:bg-[#1c3d34]/5 flex items-center gap-1"
                    >
                      <Receipt size={12} /> 領収書
                    </button>
                  )}
                  <RowActions onEdit={() => onEdit(d)} onDelete={() => onDelete(d.id)} />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex justify-end gap-1">
      <button onClick={onEdit} className="p-1.5 rounded-md text-[#8a8a82] hover:bg-[#f0f0ec] hover:text-[#23241f]">
        <Pencil size={14} />
      </button>
      <button
        onClick={() => {
          if (confirm("削除しますか？この操作は取り消せません。")) onDelete();
        }}
        className="p-1.5 rounded-md text-[#8a8a82] hover:bg-[#fbe9e7] hover:text-[#c0524a]"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="px-4 py-10 text-center text-sm text-[#9a9a92]">{text}</div>;
}

// ---------- フォーム: 取引先 ----------

function CustomerForm({ data, onSave, onClose }) {
  const [form, setForm] = useState({
    id: data.id ?? null,
    kind: data.kind ?? "individual",
    name: data.name ?? "",
    contact: data.contact ?? "",
    phone: data.phone ?? "",
    email: data.email ?? "",
    postalCode: data.postalCode ?? "",
    address: data.address ?? "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isIndividual = form.kind === "individual";

  return (
    <Modal title={data.id ? "取引先を編集" : "取引先を追加"} onClose={onClose}>
      <Field label="区分">
        <div className="flex gap-2">
          {[["individual", "個人"], ["company", "法人"]].map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => setForm((f) => ({ ...f, kind: v }))}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                form.kind === v
                  ? "bg-[#1c3d34] text-white border-[#1c3d34]"
                  : "bg-white text-[#5a5a52] border-[#dadad2] hover:bg-[#fafaf7]"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </Field>
      <Field label={isIndividual ? "氏名 *" : "会社名 *"}>
        <input className={inputCls} value={form.name} onChange={set("name")} placeholder={isIndividual ? "山田 太郎" : "株式会社 ○○"} />
      </Field>
      {!isIndividual && (
        <Field label="担当者名">
          <input className={inputCls} value={form.contact} onChange={set("contact")} placeholder="山田 太郎" />
        </Field>
      )}
      <Field label="電話番号">
        <input className={inputCls} value={form.phone} onChange={set("phone")} placeholder="03-1234-5678" />
      </Field>
      <Field label="メールアドレス">
        <input className={inputCls} value={form.email} onChange={set("email")} placeholder="example@example.com" />
      </Field>
      <Field label="郵便番号">
        <input className={inputCls} value={form.postalCode} onChange={set("postalCode")} placeholder="123-4567" />
      </Field>
      <Field label={isIndividual ? "住所（配送先）" : "住所"}>
        <input className={inputCls} value={form.address} onChange={set("address")} placeholder="東京都..." />
      </Field>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[#dadad2] text-[#5a5a52]">
          キャンセル
        </button>
        <button
          onClick={() => form.name.trim() && onSave(form)}
          className="px-4 py-2 text-sm rounded-lg bg-[#1c3d34] text-white font-medium disabled:opacity-40"
          disabled={!form.name.trim()}
        >
          保存
        </button>
      </div>
    </Modal>
  );
}

// ---------- フォーム: 商品 ----------

function ProductForm({ data, onSave, onClose }) {
  const [form, setForm] = useState({
    id: data.id ?? null,
    name: data.name ?? "",
    price: data.price ?? 0,
    stock: data.stock ?? 0,
    unit: data.unit ?? "個",
    lowStock: data.lowStock ?? 5,
  });
  const set = (k, num) => (e) => setForm((f) => ({ ...f, [k]: num ? Number(e.target.value) : e.target.value }));

  return (
    <Modal title={data.id ? "商品を編集" : "商品を追加"} onClose={onClose}>
      <Field label="商品名 *">
        <input className={inputCls} value={form.name} onChange={set("name")} placeholder="商品名を入力" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="単価（円）">
          <input type="number" className={inputCls} value={form.price} onChange={set("price", true)} />
        </Field>
        <Field label="単位">
          <input className={inputCls} value={form.unit} onChange={set("unit")} placeholder="個・台・箱など" />
        </Field>
        <Field label="現在の在庫数">
          <input type="number" className={inputCls} value={form.stock} onChange={set("stock", true)} />
        </Field>
        <Field label="在庫アラート基準">
          <input type="number" className={inputCls} value={form.lowStock} onChange={set("lowStock", true)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[#dadad2] text-[#5a5a52]">
          キャンセル
        </button>
        <button
          onClick={() => form.name.trim() && onSave(form)}
          className="px-4 py-2 text-sm rounded-lg bg-[#1c3d34] text-white font-medium disabled:opacity-40"
          disabled={!form.name.trim()}
        >
          保存
        </button>
      </div>
    </Modal>
  );
}
// ---------- フォーム: 見積書・請求書 ----------

function DocForm({ data, customers, products, onSave, onClose }) {
  const isInvoice = data.type === "invoice";
  const [customerId, setCustomerId] = useState(data.customerId ?? "");
  const [date, setDate] = useState(data.date ?? today());
  const [dueDate, setDueDate] = useState(data.dueDate ?? "");
  const [status, setStatus] = useState(data.status ?? (isInvoice ? "unpaid" : "draft"));
  const [paymentMethod, setPaymentMethod] = useState(data.paymentMethod ?? "bank_transfer");
  const [items, setItems] = useState(
    data.items?.length
      ? data.items
      : [{ productId: products[0]?.id ?? "", name: products[0]?.name ?? "", qty: 1, price: products[0]?.price ?? 0 }]
  );

  const addItem = () =>
    setItems((it) => [
      ...it,
      { productId: products[0]?.id ?? "", name: products[0]?.name ?? "", qty: 1, price: products[0]?.price ?? 0 },
    ]);
  const removeItem = (i) => setItems((it) => it.filter((_, idx) => idx !== i));
  const updateItem = (i, key, val) =>
    setItems((it) =>
      it.map((row, idx) => {
        if (idx !== i) return row;
        if (key === "productId") {
          if (val === "") {
            return { ...row, productId: "", name: "" };
          }
          const prod = products.find((p) => p.id === val);
          return { ...row, productId: val, name: prod?.name ?? "", price: prod?.price ?? row.price };
        }
        if (key === "name") {
          return { ...row, name: val };
        }
        return { ...row, [key]: Number(val) };
      })
    );

  const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0);
const tax = Math.round(subtotal * TAX_RATE);
const total = subtotal + tax;
  const statusOptions = isInvoice
    ? [["unpaid", "未払い"], ["paid", "支払済み"]]
    : [["draft", "ドラフト"], ["sent", "送付済み"]];

  const canSave = customerId && items.length > 0 && items.every((it) => it.productId || it.name?.trim());

  return (
    <Modal title={`${isInvoice ? "請求書" : "見積書"}${data.id ? "を編集" : "を作成"}`} onClose={onClose} wide>
      {(customers.length === 0 || products.length === 0) && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-[#fbe9e7] text-[#c0524a] text-sm">
          {customers.length === 0 && products.length === 0
            ? "先に取引先と商品を登録してください。"
            : customers.length === 0
            ? "先に取引先を登録してください。"
            : "先に商品を登録してください。"}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
        <Field label="取引先 *">
          <select className={inputCls} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">選択してください</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="状態">
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {statusOptions.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="発行日">
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={isInvoice ? "支払期限" : "見積有効期限"}>
          <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="支払方法">
          <select className={inputCls} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {PAYMENT_METHODS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-[#6a6a62]">明細</span>
          <button onClick={addItem} className="text-xs text-[#1c3d34] font-medium flex items-center gap-1 hover:underline">
            <Plus size={13} /> 行を追加
          </button>
        </div>
        <div className="border border-[#ececec] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#fafaf7]">
              <tr>
                <Th>商品</Th>
                <Th right>数量</Th>
                <Th right>単価</Th>
                <Th right>小計</Th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-t border-[#f3f3ef]">
                  <td className="px-3 py-2">
                    <select
                      className="w-full text-sm border border-[#dadad2] rounded-md px-2 py-1.5 mb-1"
                      value={it.productId}
                      onChange={(e) => updateItem(i, "productId", e.target.value)}
                    >
                      <option value="">— 商品名を直接入力 —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    {!it.productId && (
                      <input
                        type="text"
                        className="w-full text-sm border border-[#dadad2] rounded-md px-2 py-1.5"
                        placeholder="商品名を入力"
                        value={it.name}
                        onChange={(e) => updateItem(i, "name", e.target.value)}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      className="w-20 text-sm border border-[#dadad2] rounded-md px-2 py-1.5 text-right tabular-nums"
                      value={it.qty}
                      onChange={(e) => updateItem(i, "qty", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="w-24 text-sm border border-[#dadad2] rounded-md px-2 py-1.5 text-right tabular-nums"
                      value={it.price}
                      onChange={(e) => updateItem(i, "price", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{yen(it.qty * it.price)}</td>
                  <td className="px-1 py-2 text-center">
                    <button onClick={() => removeItem(i)} className="text-[#aaa9a0] hover:text-[#c0524a]">
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end mt-3">
  <table className="text-sm w-56">
    <tbody>
      <tr>
        <td className="py-1 text-[#8a8a82]">小計</td>
        <td className="py-1 text-right tabular-nums">{yen(subtotal)}</td>
      </tr>
      <tr>
        <td className="py-1 text-[#8a8a82]">消費税（10%）</td>
        <td className="py-1 text-right tabular-nums">{yen(tax)}</td>
      </tr>
      <tr className="border-t border-[#23241f]">
        <td className="py-1.5 font-semibold">合計</td>
        <td className="py-1.5 text-right tabular-nums font-semibold">{yen(total)}</td>
      </tr>
    </tbody>
  </table>
</div>
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[#dadad2] text-[#5a5a52]">
          キャンセル
        </button>
        <button
          onClick={() =>
            canSave &&
            onSave({ ...data, customerId, date, dueDate, status, paymentMethod, items })
          }
          className="px-4 py-2 text-sm rounded-lg bg-[#1c3d34] text-white font-medium disabled:opacity-40"
          disabled={!canSave}
        >
          保存
        </button>
      </div>
    </Modal>
  );
}

// ---------- ページ: 売上レポート ----------

function ReportsPage({ invoices, customerById, docTotal, products }) {
  const [selectedMonth, setSelectedMonth] = useState("all"); // "all" または "2026-06" 形式

  const allPaidInvoices = invoices.filter((d) => d.type === "invoice" && d.status === "paid");

  // 月別の売上集計（グラフ用、常に全期間）
  const byMonth = useMemo(() => {
    const map = {};
    allPaidInvoices.forEach((d) => {
      const month = d.date?.slice(0, 7); // "YYYY-MM"
      if (!month) return;
      map[month] = (map[month] ?? 0) + docTotal(d);
    });
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [allPaidInvoices]);

  const monthLabel = (m) => {
    const [y, mo] = m.split("-");
    return `${y}年${Number(mo)}月`;
  };

  // 選択中の月で絞り込んだ請求書（取引先別・商品別の集計に使う）
  const paidInvoices = useMemo(() => {
    if (selectedMonth === "all") return allPaidInvoices;
    return allPaidInvoices.filter((d) => d.date?.slice(0, 7) === selectedMonth);
  }, [allPaidInvoices, selectedMonth]);

  const byCustomer = useMemo(() => {
    const map = {};
    paidInvoices.forEach((d) => {
      const name = customerById(d.customerId)?.name ?? "不明";
      map[name] = (map[name] ?? 0) + docTotal(d);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [paidInvoices]);

  const byProduct = useMemo(() => {
    const map = {};
    paidInvoices.forEach((d) => {
      d.items.forEach((it) => {
        const prod = products.find((p) => p.id === it.productId);
        const name = it.name || prod?.name || "不明";
        map[name] = (map[name] ?? 0) + it.qty * it.price;
      });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [paidInvoices]);

  const maxCustomer = Math.max(1, ...byCustomer.map(([, v]) => v));
  const maxProduct = Math.max(1, ...byProduct.map(([, v]) => v));
  const maxMonth = Math.max(1, ...byMonth.map(([, v]) => v));
  const grandTotal = byCustomer.reduce((s, [, v]) => s + v, 0);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
        <h1 className="text-xl font-semibold">売上レポート</h1>
        <select
          className="px-3 py-2 rounded-lg border border-[#dadad2] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1c3d34]/30"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          <option value="all">すべての期間</option>
          {[...byMonth].reverse().map(([m]) => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>
      </div>
      <p className="text-sm text-[#8a8a82] mb-6">
        支払済み請求書をもとに集計（{paidInvoices.length}件）
        {selectedMonth !== "all" && ` ・ ${monthLabel(selectedMonth)}で絞り込み中`}
      </p>

      <div className="bg-white rounded-xl border border-[#e3e3dd] p-5 mb-6">
        <div className="text-xs font-medium text-[#8a8a82] mb-1">
          {selectedMonth === "all" ? "売上合計" : `${monthLabel(selectedMonth)}の売上合計`}
        </div>
        <div className="text-3xl font-semibold tabular-nums">{yen(grandTotal)}</div>
      </div>

      {/* 月別売上グラフ */}
      <div className="bg-white rounded-xl border border-[#e3e3dd] p-5 mb-6">
        <h2 className="font-semibold text-sm mb-4">月別 売上</h2>
        {byMonth.length === 0 ? (
          <EmptyState text="データがありません。" />
        ) : (
          <div className="flex items-end gap-2 md:gap-4 overflow-x-auto pb-1" style={{ minHeight: "140px" }}>
            {byMonth.map(([m, val]) => (
              <button
                key={m}
                onClick={() => setSelectedMonth(selectedMonth === m ? "all" : m)}
                className="flex flex-col items-center gap-1.5 shrink-0 group"
                style={{ width: "56px" }}
              >
                <span className="text-[11px] text-[#6a6a62] font-medium tabular-nums">
                  {yen(val).replace("¥", "")}
                </span>
                <div
                  className={`w-9 rounded-t-md transition-colors ${
                    selectedMonth === m ? "bg-[#1c3d34]" : "bg-[#d9a05b] group-hover:bg-[#1c3d34]"
                  }`}
                  style={{ height: `${Math.max(8, (val / maxMonth) * 100)}px` }}
                />
                <span className={`text-[11px] ${selectedMonth === m ? "text-[#1c3d34] font-semibold" : "text-[#8a8a82]"}`}>
                  {m.slice(2).replace("-", "/")}
                </span>
              </button>
            ))}
          </div>
        )}
        {byMonth.length > 0 && (
          <p className="text-[11px] text-[#aaa9a0] mt-2">バーをクリックすると、その月で絞り込めます。</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-[#e3e3dd] p-5">
          <h2 className="font-semibold text-sm mb-4">取引先別 売上</h2>
          {byCustomer.length === 0 ? (
            <EmptyState text="データがありません。" />
          ) : (
            <div className="flex flex-col gap-3">
              {byCustomer.map(([name, val]) => (
                <div key={name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{name}</span>
                    <span className="font-medium tabular-nums">{yen(val)}</span>
                  </div>
                  <div className="h-2 bg-[#f0f0ec] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1c3d34] rounded-full"
                      style={{ width: `${(val / maxCustomer) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[#e3e3dd] p-5">
          <h2 className="font-semibold text-sm mb-4">商品別 売上</h2>
          {byProduct.length === 0 ? (
            <EmptyState text="データがありません。" />
          ) : (
            <div className="flex flex-col gap-3">
              {byProduct.map(([name, val]) => (
                <div key={name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{name}</span>
                    <span className="font-medium tabular-nums">{yen(val)}</span>
                  </div>
                  <div className="h-2 bg-[#f0f0ec] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#d9a05b] rounded-full"
                      style={{ width: `${(val / maxProduct) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- 領収書モーダル ----------

function ReceiptModal({ doc, customer, docTotal, onClose }) {
  const total = docTotal(doc);
  const receiptNo = doc.docNumber.replace("INV", "REC");

  return (
    <Modal title="領収書" onClose={onClose}>
      <div id="receipt-print-area" className="border border-[#dadad2] rounded-lg p-6 mb-5 bg-white">
        <div className="flex justify-between items-start mb-5 pb-5 border-b-2 border-[#1c3d34]">
          <div>
            <h2 className="text-lg font-bold tracking-[0.25em] text-[#23241f] whitespace-nowrap">領　収　書</h2>
            <div className="text-[10px] text-[#8a8a82] font-mono mt-1.5">No. {receiptNo}</div>
          </div>
          <div className="text-right text-[10px] text-[#5a5a52] leading-snug">
            <div className="flex items-center justify-end gap-1.5 mb-1.5">
              <img src="/logo.png" alt="ロゴ" className="w-8 h-8 object-contain" />
              <span className="text-sm font-bold text-[#23241f]">{COMPANY.name}</span>
            </div>
            <div>代表：{COMPANY.representative}　｜　{COMPANY.license}</div>
            <div>{COMPANY.addressMain}</div>
            <div>{COMPANY.addressShowroom}</div>
            <div>TEL：{COMPANY.phone}　FAX：{COMPANY.fax}　{COMPANY.email}</div>
            <div>登録番号：{COMPANY.invoiceNumber}</div>
          </div>
        </div>
<div className="mb-6">
          <div className="text-base font-semibold border-b border-[#23241f] inline-block pb-1 min-w-[200px]">
            {customer?.name ?? "—"} {honorific(customer)}
          </div>
          {customer?.address && <div className="text-xs text-[#5a5a52] mt-1">{customer.address}</div>}
        </div>
        

        <div className="mb-6">
  <div className="text-2xl font-bold tabular-nums">{yen(total)}</div>
  <div className="text-xs text-[#8a8a82] mt-1">（税込・うち消費税 {yen(docTax(doc))}）</div>
</div>

        <div className="text-sm text-[#5a5a52] mb-4">
          上記正に領収いたしました。
        </div>

        <table className="w-full text-sm mb-4">
          <tbody>
            <tr className="border-t border-[#ececec]">
              <td className="py-2 text-[#8a8a82] w-28">発行日</td>
              <td className="py-2">{doc.date}</td>
            </tr>
            <tr className="border-t border-[#ececec]">
              <td className="py-2 text-[#8a8a82]">支払方法</td>
              <td className="py-2">{paymentLabel(doc.paymentMethod)}</td>
            </tr>
            <tr className="border-t border-[#ececec]">
              <td className="py-2 text-[#8a8a82]">対象請求書</td>
              <td className="py-2 font-mono text-xs">{doc.docNumber}</td>
            </tr>
          </tbody>
        </table>

        
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[#dadad2] text-[#5a5a52]">
          閉じる
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 text-sm rounded-lg bg-[#1c3d34] text-white font-medium flex items-center gap-1.5"
        >
          <Printer size={15} /> 印刷する
        </button>
      </div>
    </Modal>
  );
}
// ---------- 見積書・請求書 印刷モーダル ----------

function PrintDocModal({ doc, customer, productById, docTotal, onClose }) {
  const isInvoice = doc.type === "invoice";
  const taxExcluded = docSubtotal(doc);
  const tax = docTax(doc);
  const total = docTotal(doc);

  return (
    <Modal title={isInvoice ? "請求書を印刷" : "見積書を印刷"} onClose={onClose} wide>
      <div id="doc-print-area" className="border border-[#dadad2] rounded-lg p-6 md:p-8 mb-5 bg-white">
        <div className="flex justify-between items-start pb-5 mb-2 border-b-2 border-[#1c3d34]">
          <div>
            <h2 className="text-xl font-bold tracking-[0.25em] text-[#23241f] whitespace-nowrap">
  {isInvoice ? "請　求　書" : "見　積　書"}
</h2>
            <div className="text-[10px] text-[#8a8a82] font-mono mt-1.5">No. {doc.docNumber}</div>
          </div>
          <div className="text-right text-[10px] text-[#5a5a52] leading-snug">
            <div className="flex items-center justify-end gap-1.5 mb-1.5">
              <img src="/logo.png" alt="ロゴ" className="w-8 h-8 object-contain" />
              <span className="text-sm font-bold text-[#23241f]">{COMPANY.name}</span>
            </div>
            <div>代表：{COMPANY.representative}　｜　{COMPANY.license}</div>
            <div>{COMPANY.addressMain}</div>
            <div>{COMPANY.addressShowroom}</div>
            <div>TEL：{COMPANY.phone}　FAX：{COMPANY.fax}　{COMPANY.email}</div>
            <div>登録番号：{COMPANY.invoiceNumber}</div>
            {isInvoice && <div>お振込先：{COMPANY.bank}</div>}
          </div>
        </div>

        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="font-bold text-lg mb-1">{customer?.name} 様</div>
            {customer?.address && <div className="text-sm text-[#5a5a52]">{customer.address}</div>}
            {customer?.contact && <div className="text-sm text-[#5a5a52]">ご担当：{customer.contact} 様</div>}
            {customer?.phone && <div className="text-sm text-[#5a5a52]">TEL：{customer.phone}</div>}
          </div>
          <div className="text-right">
            <table className="w-full text-sm ml-auto">
              <tbody>
                <tr>
                  <td className="py-1 text-[#8a8a82] pr-4">発行日</td>
                  <td className="py-1 text-right">{doc.date}</td>
                </tr>
                <tr>
                  <td className="py-1 text-[#8a8a82] pr-4">{isInvoice ? "支払期限" : "見積有効期限"}</td>
                  <td className="py-1 text-right">{doc.dueDate || "—"}</td>
                </tr>
                {isInvoice && (
                  <tr>
                    <td className="py-1 text-[#8a8a82] pr-4">支払方法</td>
                    <td className="py-1 text-right">{paymentLabel(doc.paymentMethod)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-6">
          <div className="text-sm text-[#5a5a52] mb-1">
            {isInvoice ? "下記の通りご請求申し上げます。" : "下記の通りお見積りいたします。"}
          </div>
          <div className="text-3xl font-bold tabular-nums">{yen(total)}</div>
          <div className="text-xs text-[#8a8a82] mt-1">（税込・消費税{Math.round(TAX_RATE * 100)}%）</div>
        </div>

        <div className="border border-[#ececec] rounded-lg overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead className="bg-[#fafaf7]">
              <tr>
                <Th>品目</Th>
                <Th right>数量</Th>
                <Th right>単価</Th>
                <Th right>金額</Th>
              </tr>
            </thead>
            <tbody>
              {doc.items.map((it, i) => {
                const prod = productById(it.productId);
                const itemName = it.name || prod?.name || "—";
                return (
                  <tr key={i} className="border-t border-[#f3f3ef]">
                    <td className="px-4 py-2.5">{itemName}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{it.qty}{prod?.unit ?? ""}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{yen(it.price)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{yen(it.qty * it.price)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mb-8">
          <table className="text-sm w-56">
            <tbody>
              <tr>
                <td className="py-1 text-[#8a8a82]">小計</td>
                <td className="py-1 text-right tabular-nums">{yen(taxExcluded)}</td>
              </tr>
              <tr>
                <td className="py-1 text-[#8a8a82]">消費税</td>
                <td className="py-1 text-right tabular-nums">{yen(tax)}</td>
              </tr>
              <tr className="border-t border-[#23241f]">
                <td className="py-1.5 font-semibold">合計</td>
                <td className="py-1.5 text-right tabular-nums font-semibold">{yen(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[#dadad2] text-[#5a5a52]">
          閉じる
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 text-sm rounded-lg bg-[#1c3d34] text-white font-medium flex items-center gap-1.5"
        >
          <Printer size={15} /> 印刷する
        </button>
      </div>
    </Modal>
  );
}