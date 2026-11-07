"use client";

import { useState, useEffect, useRef } from "react";

type Log = { id: string; at: string; lat?: string; lon?: string; type: "land" | "work"; score: number; memo: string; client: string; fee: number };
type Item = { id: string; name: string; packed: boolean; cat?: string };
type Plan = { id: string; name: string; kind: string; day: string; memo: string; done: boolean };
type Trip = { id: string; title: string; start: string; end: string; notes: string; items: Item[]; plans: Plan[]; date?: string };
type Fav = { id: string; name: string; category: string; area: string; memo: string };
type Profile = { title: string; name: string; romaji: string; message: string; url: string };
const DEFAULT_PROFILE: Profile = { title: "波動調整師", name: "千鈴龍穂", romaji: "senritatuho", message: "島と土地の波動に耳をすませ、ご縁をつないでいく旅の手帖です。", url: "" };

const KEY = "seeker_data_v2";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const ym = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth() + 1}`; };
const inp = "w-full min-w-0 p-3 rounded-xl bg-[#fffdf8] border border-[#e3d9c3] text-xs text-[#22384a] placeholder:text-[#7d8c93] focus:outline-none focus:border-[#b08d4a]";
const card = "bg-[#fffdf8] border border-[#e3d9c3] shadow-sm rounded-xl";
const LEVELS = ["かすか", "おだやか", "澄む", "満ちる", "輝く"]; // 波動（弱 → 強）
const LV_COLORS = ["#7c93a6", "#2f8fb5", "#3a9d6e", "#d99a1e", "#c9453f"]; // 1〜5の色
const CATS: Record<string, string> = { gourmet: "味わい", rental_car: "足（移動）", stay: "宿り", spot: "拝所・訪ねたい場所", other: "その他" };
const ITEM_CATS = ["御嶽・ヒーリング", "台所・暮らし", "車・移動", "衣類・日用品", "手続き・予約", "その他"];
const AREAS = ["那覇", "南部", "中部", "北部", "宮古", "八重山", "久米島", "伊江島"];

// 日付まわり
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dlabel = (d: string) => { const x = new Date(d + "T00:00:00"); return `${x.getMonth() + 1}/${x.getDate()}(${"日月火水木金土"[x.getDay()]})`; };
const rangeText = (t: Trip) => !t.start ? "" : !t.end || t.end === t.start ? t.start.replace(/-/g, "/") : `${t.start.replace(/-/g, "/")} 〜 ${t.end.slice(5).replace("-", "/")}`;
const daysOf = (t: Trip) => {
  if (!t.start) return [] as string[];
  const out: string[] = [], e = new Date((t.end || t.start) + "T00:00:00");
  for (const d = new Date(t.start + "T00:00:00"); d <= e && out.length < 31; d.setDate(d.getDate() + 1)) out.push(iso(d));
  return out;
};
const normTrip = (t: any): Trip => ({
  ...t, start: t.start ?? t.date ?? "", end: t.end ?? "", plans: t.plans ?? [],
  items: (t.items ?? []).map((i: any) => ({ ...i, cat: i.cat ?? "その他" })),
});

// 旅の言葉・タイプに合わせて携え物を自動で用意
function makeItems(text: string, live: boolean): Item[] {
  const l: [string, string][] = [];
  const add = (c: string, n: string) => { if (!l.some((x) => x[1] === n)) l.push([c, n]); };
  add("御嶽・ヒーリング", "ヒーリンググッズ（音叉・クリスタルなど）"); add("御嶽・ヒーリング", "数珠"); add("御嶽・ヒーリング", "エネルギーノート");
  add("衣類・日用品", "着替え・洗面用具"); add("衣類・日用品", "充電器・モバイルバッテリー");
  if (/神社|寺|参拝|山|御嶽/.test(text)) add("御嶽・ヒーリング", "お賽銭の小銭");
  if (/神社|寺/.test(text)) add("御嶽・ヒーリング", "御朱印帳");
  if (live) ["電子レンジ調理器具", "クッキングシート", "サランラップ", "キッチンバサミ", "果物ナイフ"].forEach((n) => add("台所・暮らし", n));
  if (live || /車|レンタカー/.test(text)) ["車用充電器", "ETC（カード）", "運転免許証", "スマホホルダー"].forEach((n) => add("車・移動", n));
  if (/飛行機|航空|空港|新幹線|電車/.test(text)) { add("手続き・予約", "チケット・予約画面"); add("手続き・予約", "身分証明書"); }
  if (/温泉|宿|泊/.test(text)) { add("衣類・日用品", "タオル"); add("手続き・予約", "宿の予約控え"); }
  return l.map(([cat, name]) => ({ id: uid(), name, cat, packed: false }));
}

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ESC[c]);
const toLocalInput = (s: string) => { const d = new Date(s); return `${iso(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

// 落款（朱の印）：お名前の最初の4文字を、右から左へ縦書き風に並べます
function Seal({ name, size = 36 }: { name: string; size?: number }) {
  const c = Array.from(name.replace(/\s/g, "")).slice(0, 4);
  const cols = [c.slice(0, 2), c.slice(2, 4)].filter((x) => x.length);
  return (
    <div style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }} className="shrink-0 bg-[#c9453f] text-white font-bold rounded-[4px] flex flex-row-reverse items-center justify-center gap-[2px] shadow-sm ring-1 ring-[#c9453f]/30">
      {cols.map((col, i) => (
        <div key={i} className="flex flex-col items-center justify-center leading-none gap-[1px]">{col.map((ch, j) => <span key={j}>{ch}</span>)}</div>
      ))}
    </div>
  );
}
const mapUrl = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

// 地図：波動1〜5で色分け。丸＝土地、角丸の四角＝ご縁。線は記録順。
function MapView({ logs }: { logs: Log[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<"all" | "land" | "work">("all");
  const [ready, setReady] = useState(false);
  const pts = logs.filter((l) => l.lat && (filter === "all" || l.type === filter)).slice().reverse();

  useEffect(() => {
    if ((window as any).L) { setReady(true); return; }
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; js.onload = () => setReady(true);
    document.body.appendChild(js);
  }, []);

  useEffect(() => {
    const L = (window as any).L;
    if (!ready || !L || !ref.current || pts.length === 0) return;
    const map = L.map(ref.current);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
    const ll = pts.map((p) => [Number(p.lat), Number(p.lon)]);
    L.polyline(ll, { color: "#264e70", weight: 3, opacity: 0.7, dashArray: "6 6" }).addTo(map);
    pts.forEach((p, i) => {
      const sz = 22 + p.score * 3, bg = LV_COLORS[p.score - 1], br = p.type === "work" ? "28%" : "50%";
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:${sz}px;height:${sz}px;border-radius:${br};background:${bg};color:#fff;font-size:${Math.round(sz / 2)}px;font-weight:bold;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${p.score}</div>`,
        iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
      });
      const label = (p.type === "work" ? "ご縁" : "土地") + (p.client ? ` ${esc(p.client)}様` : "") + ` 波動 ${p.score}（${LEVELS[p.score - 1]}）`;
      L.marker(ll[i], { icon }).addTo(map).bindPopup(`<b>${label}</b><br>${i + 1}番目の記録<br>${new Date(p.at).toLocaleString("ja-JP")}${p.memo ? "<br>" + esc(p.memo) : ""}`);
    });
    map.fitBounds(ll, { padding: [30, 30], maxZoom: 15 });
    return () => map.remove();
  }, [ready, filter, logs]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-[11px]">
        {([["all", "すべて"], ["land", "土地"], ["work", "ご縁"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-lg ${filter === k ? "bg-[#264e70] text-white" : "bg-[#f3f9f9] text-[#4e6472]"}`}>{l}</button>
        ))}
        <span className="ml-auto text-[#4e6472] self-center">{pts.length}か所</span>
      </div>
      {pts.length === 0 ? (
        <p className="text-xs text-[#4e6472] text-center py-10">場所つきの記憶がまだありません。<br />「刻む」で記録すると、ここに道が描かれていきます。</p>
      ) : (
        <>
          <div ref={ref} className="isolate relative z-0 h-[58vh] w-full rounded-xl border border-[#e3d9c3]" />
          <div className={`${card} p-3 space-y-2`}>
            <div className="flex justify-between">
              {LEVELS.map((n, i) => (
                <div key={n} className="flex flex-col items-center gap-1">
                  <span className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ background: LV_COLORS[i] }}>{i + 1}</span>
                  <span className="text-[9px] text-[#4e6472]">{n}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[#4e6472]">色と大きさが波動の強さです。丸＝土地、角丸の四角＝ご縁。線は刻んだ順につながっています。点に触れると記憶がひらきます。</p>
          </div>
        </>
      )}
    </div>
  );
}

export default function SeekerApp() {
  const [tab, setTab] = useState<"vibe" | "prepare" | "map" | "favorites" | "data">("vibe");
  const [loaded, setLoaded] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [currentId, setCurrentId] = useState<string>("");
  const [favs, setFavs] = useState<Fav[]>([
    { id: "f1", name: "いつものレンタカー会社", category: "rental_car", area: "那覇", memo: "軽自動車が借りやすくておすすめ" },
    { id: "f2", name: "お気に入りの蕎麦屋", category: "gourmet", area: "", memo: "鴨南蛮が絶品。エネルギーが高い空間" },
  ]);
  const [msg, setMsg] = useState("");
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [editProfile, setEditProfile] = useState(false);
  const [editLogId, setEditLogId] = useState("");
  const [editPlanId, setEditPlanId] = useState("");
  const [editItemId, setEditItemId] = useState("");
  const [editFavId, setEditFavId] = useState("");

  // 記録
  const [type, setType] = useState<"land" | "work">("land");
  const [score, setScore] = useState(3);
  const [memo, setMemo] = useState("");
  const [client, setClient] = useState("");
  const [fee, setFee] = useState("");
  const [filter, setFilter] = useState<"all" | "land" | "work">("all");
  // 旅
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [live, setLive] = useState(true);
  const [newItem, setNewItem] = useState("");
  const [newItemCat, setNewItemCat] = useState("その他");
  const [pName, setPName] = useState("");
  const [pKind, setPKind] = useState("spot");
  const [pDay, setPDay] = useState("");
  const [pMemo, setPMemo] = useState("");
  // とっておき
  const [fName, setFName] = useState("");
  const [fArea, setFArea] = useState("");
  const [fCat, setFCat] = useState("gourmet");
  const [fMemo, setFMemo] = useState("");
  const [fSearch, setFSearch] = useState("");
  const [fAreaFilter, setFAreaFilter] = useState("");

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(""), 3000); };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        setLogs(d.logs ?? []); setTrips((d.trips ?? []).map(normTrip)); setCurrentId(d.currentId ?? "");
        if (d.favs) setFavs(d.favs.map((f: any) => ({ ...f, area: f.area ?? "" })));
        if (d.profile) setProfile({ ...DEFAULT_PROFILE, ...d.profile });
      } else {
        const oldLogs = JSON.parse(localStorage.getItem("seeker_logs") || "[]");
        setLogs(oldLogs.map((l: any) => ({
          id: l.id, at: new Date().toISOString(), lat: l.latitude, lon: l.longitude,
          type: String(l.logType).includes("仕事") ? "work" : "land", score: l.vibeScore, memo: "", client: "", fee: 0,
        })));
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify({ logs, trips, currentId, favs, profile }));
  }, [logs, trips, currentId, favs, profile, loaded]);

  // ---- 記録 ----
  const saveLog = (pos?: GeolocationPosition) => {
    const log: Log = {
      id: uid(), at: new Date().toISOString(),
      lat: pos?.coords.latitude.toFixed(5), lon: pos?.coords.longitude.toFixed(5),
      type, score, memo: memo.trim(), client: type === "work" ? client.trim() : "", fee: type === "work" ? Number(fee) || 0 : 0,
    };
    setLogs((p) => [log, ...p]);
    setMemo(""); setClient(""); setFee("");
    flash(pos ? "波動を刻みました（場所つき）" : "波動を刻みました");
  };
  const handleLog = () => {
    if (!navigator.geolocation) return saveLog();
    flash("場所を探しています…");
    navigator.geolocation.getCurrentPosition(saveLog, () => saveLog(), { timeout: 10000 });
  };
  const updateLog = (id: string, patch: Partial<Log>) => setLogs((p) => p.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const updateFav = (id: string, patch: Partial<Fav>) => setFavs((p) => p.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const delLog = (id: string) => { if (confirm("この記録を削除しますか？")) setLogs((p) => p.filter((l) => l.id !== id)); };

  const thisMonth = ym(new Date().toISOString());
  const monthWork = logs.filter((l) => l.type === "work" && ym(l.at) === thisMonth);
  const monthTotal = monthWork.reduce((s, l) => s + l.fee, 0);
  const shown = logs.filter((l) => filter === "all" || l.type === filter);

  // ---- 旅 ----
  const trip = trips.find((t) => t.id === currentId);
  const days = trip ? daysOf(trip) : [];
  const updateTrip = (fn: (t: Trip) => Trip) => setTrips((p) => p.map((t) => (t.id === currentId ? fn(t) : t)));
  const addTrip = () => {
    if (!title.trim()) return flash("旅の名を入れてください");
    const t: Trip = { id: uid(), title: title.trim(), start, end: end && end >= start ? end : "", notes, items: makeItems(title + notes, live), plans: [] };
    setTrips((p) => [t, ...p]); setCurrentId(t.id);
    setTitle(""); setStart(""); setEnd(""); setNotes(""); setShowNew(false);
    flash("旅支度を整えました");
  };
  const delTrip = () => {
    if (!trip || !confirm(`「${trip.title}」を削除しますか？`)) return;
    const rest = trips.filter((t) => t.id !== trip.id);
    setTrips(rest); setCurrentId(rest[0]?.id ?? "");
  };
  const addItem = () => {
    if (!newItem.trim()) return;
    updateTrip((t) => ({ ...t, items: [...t.items, { id: uid(), name: newItem.trim(), cat: newItemCat, packed: false }] }));
    setNewItem("");
  };
  const addPlan = () => {
    if (!pName.trim()) return flash("場所やお店の名前を入れてください");
    updateTrip((t) => ({ ...t, plans: [...t.plans, { id: uid(), name: pName.trim(), kind: pKind, day: pDay, memo: pMemo.trim(), done: false }] }));
    setPName(""); setPMemo("");
  };
  const updatePlan = (id: string, patch: Partial<Plan>) => updateTrip((t) => ({ ...t, plans: t.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const updateItem = (id: string, patch: Partial<Item>) => updateTrip((t) => ({ ...t, items: t.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const plansOf = (d: string) => (trip?.plans ?? []).filter((p) => (d === "" ? !days.includes(p.day) : p.day === d));

  // ---- とっておき ----
  const addFav = () => {
    if (!fName.trim()) return flash("名前を入れてください");
    setFavs((p) => [{ id: uid(), name: fName.trim(), category: fCat, area: fArea.trim(), memo: fMemo.trim() }, ...p]);
    setFName(""); setFMemo("");
  };
  const favToTrip = (f: Fav) => {
    if (!trip) return flash("先に「旅支度」で旅を作ってください");
    updateTrip((t) => ({ ...t, plans: [...t.plans, { id: uid(), name: f.name, kind: f.category, day: "", memo: [f.area, f.memo].filter(Boolean).join(" ／ "), done: false }] }));
    flash(`「${trip.title}」の行きたい場所に入れました`);
  };
  const areaList = Array.from(new Set(favs.map((f) => f.area).filter(Boolean)));
  const favShown = favs
    .filter((f) => (!fAreaFilter || f.area === fAreaFilter) && (!fSearch || (f.name + f.memo + f.area).includes(fSearch)))
    .sort((a, b) => a.area.localeCompare(b.area, "ja"));

  // ---- お守り ----
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ logs, trips, currentId, favs, profile }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `seeker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    flash("お守りを作りました");
  };
  const importData = (file?: File) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(String(r.result));
        if (!confirm("今のデータをバックアップの内容に置き換えます。よろしいですか？")) return;
        setLogs(d.logs ?? []); setTrips((d.trips ?? []).map(normTrip)); setCurrentId(d.currentId ?? "");
        setFavs((d.favs ?? []).map((f: any) => ({ ...f, area: f.area ?? "" })));
        if (d.profile) setProfile({ ...DEFAULT_PROFILE, ...d.profile });
        flash("お守りから戻しました");
      } catch { flash("ファイルを読み込めませんでした"); }
    };
    r.readAsText(file);
  };

  const tabs = [["vibe", "刻む"], ["prepare", "旅支度"], ["map", "道標"], ["favorites", "とっておき"], ["data", "お守り"]] as const;
  const btn = (on: boolean) => `py-3 rounded-xl text-xs font-medium border transition-all ${on ? "bg-[#e8eef2] border-[#264e70] text-[#264e70]" : "bg-[#fffdf8] border-transparent text-[#4e6472]"}`;
  const chip = (on: boolean) => `shrink-0 px-3 py-1.5 rounded-lg text-[11px] ${on ? "bg-[#264e70] text-white" : "bg-[#f3f9f9] text-[#4e6472]"}`;
  const tag = "text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#f3f9f9] text-[#264e70]";

  return (
    <div style={{ fontFamily: '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif' }} className="min-h-screen bg-[#d6eef0] text-[#22384a] antialiased">
      <div className="max-w-md mx-auto p-5 pb-28">
        <div className="text-center pb-5">
          <div className="h-1 rounded-full bg-gradient-to-r from-[#264e70] via-[#b08d4a] to-[#c9604b] mb-4" />
          <p className="text-[#b08d4a] text-xs tracking-[0.5em]">〜 ❖ 〜</p>
          <h1 className="text-2xl font-medium tracking-[0.25em] text-[#264e70] mt-1">ニライの手帖</h1>
          <p className="text-[11px] text-[#4e6472] mt-1 tracking-widest">海の彼方、ニライの風をたどる</p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <Seal name={profile.name} size={40} />
            <div className="text-left leading-tight">
              <p className="text-[10px] text-[#4e6472] tracking-[0.3em]">{profile.title}</p>
              <p className="text-sm font-medium tracking-[0.25em]">{profile.name}<span className="text-[10px] text-[#4e6472] tracking-widest ml-1.5">作</span></p>
              <p className="text-[9px] text-[#7d8c93] tracking-[0.3em]">{profile.romaji}</p>
            </div>
          </div>
        </div>

        {/* ===== 刻む ===== */}
        {tab === "vibe" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setType("land")} className={btn(type === "land")}>土地との対話</button>
              <button onClick={() => setType("work")} className={btn(type === "work")}>ご縁のセッション</button>
            </div>
            <p className="text-[11px] text-[#4e6472]">この場の波動は、どんな感じ？</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => setScore(s)} style={score === s ? { background: LV_COLORS[s - 1] } : {}} className={`flex-1 py-2.5 rounded-xl ${score === s ? "text-white shadow" : "bg-[#fffdf8] text-[#4e6472]"}`}>
                  <span className="block text-base font-bold leading-none">{s}</span>
                  <span className="block text-[9px] mt-1 opacity-90">{LEVELS[s - 1]}</span>
                </button>
              ))}
            </div>
            {type === "work" && (
              <div className="grid grid-cols-2 gap-2">
                <input className={inp} placeholder="お客様のお名前" value={client} onChange={(e) => setClient(e.target.value)} />
                <input className={inp} placeholder="料金（円）" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value.replace(/\D/g, ""))} />
              </div>
            )}
            <textarea className={`${inp} h-20 resize-none`} placeholder="感じたこと、風や香り、場所の名前、気づき…" value={memo} onChange={(e) => setMemo(e.target.value)} />
            <button onClick={handleLog} className="w-full py-4 bg-gradient-to-r from-[#264e70] to-[#2f7f8a] rounded-xl font-medium tracking-widest text-sm text-white">この場の波動を刻む</button>

            {monthWork.length > 0 && (
              <div className={`${card} p-3 text-xs flex justify-between`}>
                <span className="text-[#4e6472]">今月のご縁 {monthWork.length}件</span>
                <span className="text-[#264e70] font-bold">{monthTotal.toLocaleString()}円</span>
              </div>
            )}

            <div className="flex gap-2 text-[11px]">
              {([["all", "すべて"], ["land", "土地"], ["work", "ご縁"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setFilter(k)} className={chip(filter === k)}>{l}</button>
              ))}
              <span className="ml-auto text-[#4e6472] self-center">{shown.length}件</span>
            </div>
            <div className="space-y-2">
              {shown.length === 0 && <p className="text-xs text-[#4e6472] text-center py-6">まだ何も刻まれていません</p>}
              {shown.map((l) => (
                <div key={l.id} className={`${card} p-3 text-xs`}>
                  {editLogId === l.id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => updateLog(l.id, { type: "land" })} className={btn(l.type === "land")}>土地との対話</button>
                        <button onClick={() => updateLog(l.id, { type: "work" })} className={btn(l.type === "work")}>ご縁のセッション</button>
                      </div>
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} onClick={() => updateLog(l.id, { score: n })} style={l.score === n ? { background: LV_COLORS[n - 1] } : {}} className={`flex-1 py-2 rounded-lg ${l.score === n ? "text-white" : "bg-[#f3f9f9] text-[#4e6472]"}`}>
                            <span className="block text-sm font-bold leading-none">{n}</span><span className="block text-[9px] mt-0.5">{LEVELS[n - 1]}</span>
                          </button>
                        ))}
                      </div>
                      {l.type === "work" && (
                        <div className="grid grid-cols-2 gap-2">
                          <input className={inp} placeholder="お客様のお名前" value={l.client} onChange={(e) => updateLog(l.id, { client: e.target.value })} />
                          <input className={inp} placeholder="料金（円）" inputMode="numeric" value={l.fee ? String(l.fee) : ""} onChange={(e) => updateLog(l.id, { fee: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                        </div>
                      )}
                      <input type="datetime-local" className={`${inp} appearance-none`} value={toLocalInput(l.at)} onChange={(e) => e.target.value && updateLog(l.id, { at: new Date(e.target.value).toISOString() })} />
                      <textarea className={`${inp} h-20 resize-none`} value={l.memo} onChange={(e) => updateLog(l.id, { memo: e.target.value })} />
                      <button onClick={() => setEditLogId("")} className="w-full py-2 bg-[#264e70] rounded-xl text-xs font-bold text-white">完了</button>
                    </div>
                  ) : (<>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[#264e70] font-medium">{l.type === "work" ? "ご縁" : "土地"}</span>
                      {l.client && <span className="ml-2">{l.client}様</span>}
                      {l.fee > 0 && <span className="text-[#4e6472] ml-2">{l.fee.toLocaleString()}円</span>}
                      <p className="text-[10px] text-[#4e6472] mt-0.5">{new Date(l.at).toLocaleString("ja-JP")}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg font-bold text-white text-[11px]" style={{ background: LV_COLORS[l.score - 1] }}>{l.score}・{LEVELS[l.score - 1]}</span>
                  </div>
                  {l.memo && <p className="mt-2 whitespace-pre-wrap">{l.memo}</p>}
                  <div className="flex justify-between mt-2 text-[10px]">
                    {l.lat ? <a className="text-[#264e70] underline" href={`https://www.google.com/maps?q=${l.lat},${l.lon}`} target="_blank" rel="noreferrer">地図でひらく</a> : <span className="text-[#7d8c93]">場所の記録なし</span>}
                    <span className="flex gap-3"><button onClick={() => setEditLogId(l.id)} className="text-[#264e70]">編集</button><button onClick={() => delLog(l.id)} className="text-[#7d8c93]">削除</button></span>
                  </div>
                  </>)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== 旅支度 ===== */}
        {tab === "prepare" && (
          <div className="space-y-4">
            {(showNew || trips.length === 0) ? (
              <div className={`${card} p-4 space-y-2`}>
                <input className={inp} placeholder="旅の名（例：沖縄・御嶽をめぐる暮らす旅）" value={title} onChange={(e) => setTitle(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <label className="min-w-0 text-[10px] text-[#4e6472]">出発日
                    <input type="date" className={`${inp} mt-1 appearance-none`} value={start} onChange={(e) => { setStart(e.target.value); if (end && end < e.target.value) setEnd(""); }} />
                  </label>
                  <label className="min-w-0 text-[10px] text-[#4e6472]">帰着日
                    <input type="date" className={`${inp} mt-1 appearance-none`} value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
                  </label>
                </div>
                <textarea className={`${inp} h-16 resize-none`} placeholder="レンタカー、航空券、宿泊先の予約控えなど..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                <label className="flex items-center gap-2 text-[11px] text-[#4e6472]">
                  <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="w-4 h-4 accent-[#264e70]" />
                  暮らすような旅（台所・車の携え物も入れる）
                </label>
                <button onClick={addTrip} className="w-full py-2.5 bg-[#264e70] rounded-xl text-xs font-bold text-white">旅支度をはじめる</button>
              </div>
            ) : (
              <button onClick={() => setShowNew(true)} className="w-full py-2.5 rounded-xl border border-dashed border-[#264e70] text-xs text-[#264e70]">＋ 新しい旅をつくる</button>
            )}

            {trips.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {trips.map((t) => <button key={t.id} onClick={() => setCurrentId(t.id)} className={chip(t.id === currentId)}>{t.title}</button>)}
              </div>
            )}

            {trip && (
              <div className="space-y-4">
                <div className="p-4 bg-[#e8eef2] border border-[#b9c9d4] rounded-xl space-y-2">
                  <input className={`${inp} font-bold`} value={trip.title} onChange={(e) => updateTrip((t) => ({ ...t, title: e.target.value }))} />
                  {rangeText(trip) && <p className="text-[11px] text-[#4e6472]">{rangeText(trip)}（{days.length}日間）</p>}
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" className={`${inp} appearance-none`} value={trip.start} onChange={(e) => updateTrip((t) => ({ ...t, start: e.target.value, end: t.end && t.end < e.target.value ? "" : t.end }))} />
                    <input type="date" className={`${inp} appearance-none`} value={trip.end} min={trip.start || undefined} onChange={(e) => updateTrip((t) => ({ ...t, end: e.target.value }))} />
                  </div>
                  <textarea className={`${inp} h-16 resize-none`} placeholder="予約メモ" value={trip.notes} onChange={(e) => updateTrip((t) => ({ ...t, notes: e.target.value }))} />
                </div>

                {/* 行きたい場所・行程 */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-[#264e70]">行きたい場所・お店</p>
                  <div className={`${card} p-3 space-y-2`}>
                    <input className={inp} placeholder="名前（例：斎場御嶽、〇〇食堂）" value={pName} onChange={(e) => setPName(e.target.value)} />
                    <div className="grid grid-cols-2 gap-2">
                      <select className={inp} value={pKind} onChange={(e) => setPKind(e.target.value)}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                      <select className={inp} value={pDay} onChange={(e) => setPDay(e.target.value)}>
                        <option value="">日程は未定</option>
                        {days.map((d) => <option key={d} value={d}>{dlabel(d)}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <input className={inp} placeholder="メモ（予約・営業時間など）" value={pMemo} onChange={(e) => setPMemo(e.target.value)} />
                      <button onClick={addPlan} className="px-4 bg-[#264e70] rounded-xl text-xs font-bold text-white shrink-0">追加</button>
                    </div>
                  </div>
                  {[...days, ""].map((d) => {
                    const list = plansOf(d);
                    if (list.length === 0) return null;
                    return (
                      <div key={d || "none"} className="space-y-1.5">
                        <p className="text-[11px] text-[#4e6472]">{d ? dlabel(d) : "日程未定"}</p>
                        {list.map((p) => (
                          <div key={p.id} className={`${card} p-3 space-y-1.5`}>
                            <div className="flex items-center gap-2">
                              <input type="checkbox" checked={p.done} onChange={() => updatePlan(p.id, { done: !p.done })} className="w-4 h-4 accent-[#264e70]" />
                              {editPlanId === p.id
                                ? <input className={inp} value={p.name} onChange={(e) => updatePlan(p.id, { name: e.target.value })} />
                                : <span className={`flex-1 text-xs font-medium ${p.done ? "line-through text-[#7d8c93]" : ""}`}>{p.name}</span>}
                              <span className={tag}>{CATS[p.kind] ?? "その他"}</span>
                              <button onClick={() => setEditPlanId(editPlanId === p.id ? "" : p.id)} className="text-[#264e70] text-xs">✎</button>
                              <button onClick={() => updateTrip((t) => ({ ...t, plans: t.plans.filter((x) => x.id !== p.id) }))} className="text-[#7d8c93] text-xs">✕</button>
                            </div>
                            {editPlanId === p.id ? (
                              <div className="space-y-2 pl-6">
                                <select className={inp} value={p.kind} onChange={(e) => updatePlan(p.id, { kind: e.target.value })}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                                <input className={inp} placeholder="メモ" value={p.memo} onChange={(e) => updatePlan(p.id, { memo: e.target.value })} />
                                <button onClick={() => setEditPlanId("")} className="w-full py-2 bg-[#264e70] rounded-xl text-xs font-bold text-white">完了</button>
                              </div>
                            ) : (p.memo && <p className="text-[11px] text-[#4e6472] pl-6">{p.memo}</p>)}
                            <div className="flex justify-between items-center pl-6 text-[10px]">
                              <a className="text-[#264e70] underline" href={mapUrl(p.name)} target="_blank" rel="noreferrer">地図でひらく</a>
                              <select className="bg-[#f3f9f9] rounded-lg px-2 py-1 text-[#4e6472]" value={days.includes(p.day) ? p.day : ""} onChange={(e) => updatePlan(p.id, { day: e.target.value })}>
                                <option value="">日程未定</option>
                                {days.map((x) => <option key={x} value={x}>{dlabel(x)}</option>)}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  {trip.plans.length === 0 && <p className="text-[11px] text-[#4e6472]">「とっておき」から、ボタンひとつで入れることもできます。</p>}
                </div>

                {/* 携え物 */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-[#264e70]">携え物 {trip.items.filter((i) => i.packed).length} / {trip.items.length}</span>
                    <button className="text-[11px] text-[#4e6472]" onClick={() => updateTrip((t) => ({ ...t, items: t.items.map((i) => ({ ...i, packed: false })) }))}>すべてまっさらに戻す</button>
                  </div>
                  {ITEM_CATS.map((c) => {
                    const list = trip.items.filter((i) => (ITEM_CATS.includes(i.cat ?? "") ? i.cat : "その他") === c);
                    if (list.length === 0) return null;
                    return (
                      <div key={c} className="space-y-1.5">
                        <p className="text-[11px] text-[#4e6472]">{c}</p>
                        {list.map((i) => (
                          <div key={i.id} className={`${card} p-3 flex items-center gap-3`}>
                            <input type="checkbox" checked={i.packed} onChange={() => updateTrip((t) => ({ ...t, items: t.items.map((x) => (x.id === i.id ? { ...x, packed: !x.packed } : x)) }))} className="w-4 h-4 accent-[#264e70]" />
                            {editItemId === i.id ? (
                              <div className="flex-1 flex gap-1.5 min-w-0">
                                <input className={inp} value={i.name} onChange={(e) => updateItem(i.id, { name: e.target.value })} />
                                <select className={`${inp} !w-24 shrink-0`} value={i.cat ?? "その他"} onChange={(e) => updateItem(i.id, { cat: e.target.value })}>{ITEM_CATS.map((c) => <option key={c}>{c}</option>)}</select>
                              </div>
                            ) : <span className={`flex-1 text-xs ${i.packed ? "line-through text-[#7d8c93]" : ""}`}>{i.name}</span>}
                            <button onClick={() => setEditItemId(editItemId === i.id ? "" : i.id)} className="text-[#264e70] text-xs">{editItemId === i.id ? "完了" : "✎"}</button>
                            <button onClick={() => updateTrip((t) => ({ ...t, items: t.items.filter((x) => x.id !== i.id) }))} className="text-[#7d8c93] text-xs">✕</button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  <div className="flex gap-2">
                    <input className={inp} placeholder="携え物を足す" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} />
                    <select className={`${inp} !w-28 shrink-0`} value={newItemCat} onChange={(e) => setNewItemCat(e.target.value)}>{ITEM_CATS.map((c) => <option key={c}>{c}</option>)}</select>
                    <button onClick={addItem} className="px-4 bg-[#264e70] rounded-xl text-xs font-bold text-white shrink-0">追加</button>
                  </div>
                </div>
                <button onClick={delTrip} className="w-full text-[11px] text-[#7d8c93] py-2">この旅を手放す</button>
              </div>
            )}
          </div>
        )}

        {tab === "map" && <MapView logs={logs} />}

        {/* ===== とっておき ===== */}
        {tab === "favorites" && (
          <div className="space-y-3">
            <div className={`${card} p-4 space-y-2`}>
              <input className={inp} placeholder="名前（お店・会社・場所）" value={fName} onChange={(e) => setFName(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <input className={inp} list="areas" placeholder="エリア（例：本部）" value={fArea} onChange={(e) => setFArea(e.target.value)} />
                <select className={inp} value={fCat} onChange={(e) => setFCat(e.target.value)}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              </div>
              <datalist id="areas">{Array.from(new Set([...areaList, ...AREAS])).map((a) => <option key={a} value={a} />)}</datalist>
              <input className={inp} placeholder="ひとことメモ（定休日・予約・おすすめなど）" value={fMemo} onChange={(e) => setFMemo(e.target.value)} />
              <button onClick={addFav} className="w-full py-2.5 bg-[#264e70] rounded-xl text-xs font-bold text-white">とっておきにしまう</button>
            </div>

            <input className={inp} placeholder="さがす（名前・エリア・メモ）" value={fSearch} onChange={(e) => setFSearch(e.target.value)} />
            {areaList.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button onClick={() => setFAreaFilter("")} className={chip(!fAreaFilter)}>すべて</button>
                {areaList.map((a) => <button key={a} onClick={() => setFAreaFilter(a)} className={chip(fAreaFilter === a)}>{a}</button>)}
              </div>
            )}

            {favShown.map((f) => (
              <div key={f.id} className={`${card} p-4`}>
                <div className="flex justify-between items-center">
                  <div className="flex gap-1.5">
                    <span className={tag}>{CATS[f.category] ?? "その他"}</span>
                    {f.area && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#b08d4a] text-white">{f.area}</span>}
                  </div>
                  <button onClick={() => confirm("削除しますか？") && setFavs((p) => p.filter((x) => x.id !== f.id))} className="text-[#7d8c93] text-xs">削除</button>
                </div>
                {editFavId === f.id ? (
                  <div className="space-y-2 mt-2">
                    <input className={inp} value={f.name} onChange={(e) => updateFav(f.id, { name: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2">
                      <input className={inp} list="areas" placeholder="エリア" value={f.area} onChange={(e) => updateFav(f.id, { area: e.target.value })} />
                      <select className={inp} value={f.category} onChange={(e) => updateFav(f.id, { category: e.target.value })}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    </div>
                    <input className={inp} placeholder="ひとことメモ" value={f.memo} onChange={(e) => updateFav(f.id, { memo: e.target.value })} />
                    <button onClick={() => setEditFavId("")} className="w-full py-2 bg-[#264e70] rounded-xl text-xs font-bold text-white">完了</button>
                  </div>
                ) : (<>
                  <h3 className="font-bold text-xs mt-1.5">{f.name}</h3>
                  {f.memo && <p className="text-xs text-[#4e6472] mt-1">{f.memo}</p>}
                </>)}
                <div className="flex gap-4 mt-2 text-[11px]">
                  <a className="text-[#264e70] underline" href={mapUrl(`${f.area} ${f.name}`.trim())} target="_blank" rel="noreferrer">地図でひらく</a>
                  <button className="text-[#264e70] underline" onClick={() => favToTrip(f)}>今の旅に入れる</button>
                  <button className="text-[#264e70] underline" onClick={() => setEditFavId(editFavId === f.id ? "" : f.id)}>編集</button>
                </div>
              </div>
            ))}
            {favShown.length === 0 && <p className="text-xs text-[#4e6472] text-center py-6">見つかりません</p>}
          </div>
        )}

        {/* ===== お守り ===== */}
        {tab === "data" && (
          <div className="space-y-4 text-xs">
            <div className={`${card} p-4 space-y-3`}>
              <div className="flex items-center gap-3">
                <Seal name={profile.name} size={44} />
                <div>
                  <p className="text-[10px] text-[#4e6472] tracking-[0.3em]">{profile.title}</p>
                  <p className="font-bold text-sm tracking-[0.2em]">{profile.name}</p>
                  <p className="text-[10px] text-[#7d8c93] tracking-[0.25em]">{profile.romaji}</p>
                </div>
              </div>
              {editProfile ? (
                <div className="space-y-2">
                  <input className={inp} placeholder="肩書き" value={profile.title} onChange={(e) => setProfile({ ...profile, title: e.target.value })} />
                  <input className={inp} placeholder="お名前" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                  <input className={inp} placeholder="ローマ字" value={profile.romaji} onChange={(e) => setProfile({ ...profile, romaji: e.target.value })} />
                  <textarea className={`${inp} h-20 resize-none`} placeholder="ひとこと" value={profile.message} onChange={(e) => setProfile({ ...profile, message: e.target.value })} />
                  <input className={inp} placeholder="公式サイトやSNSのURL（https://…）" value={profile.url} onChange={(e) => setProfile({ ...profile, url: e.target.value })} />
                  <button onClick={() => setEditProfile(false)} className="w-full py-2 bg-[#264e70] rounded-xl font-bold text-white">完了</button>
                </div>
              ) : (
                <>
                  <p className="text-[#4e6472] whitespace-pre-wrap">{profile.message}</p>
                  {/^https?:\/\//.test(profile.url) && <a className="text-[#264e70] underline block" href={profile.url} target="_blank" rel="noreferrer">公式サイト・SNSをひらく</a>}
                  <button onClick={() => setEditProfile(true)} className="text-[#264e70] underline">プロフィールを編集</button>
                </>
              )}
            </div>
            <div className={`${card} p-4 space-y-3`}>
              <p className="font-bold">お守りを作る</p>
              <p className="text-[#4e6472]">記憶はこのスマホの中だけに保存されています。大切な記憶が消えないよう、ときどきお守り（バックアップ）を作っておきましょう。機種変更のときにも使えます。</p>
              <button onClick={exportData} className="w-full py-2.5 bg-[#264e70] rounded-xl font-bold text-white">お守りを保存する</button>
            </div>
            <div className={`${card} p-4 space-y-3`}>
              <p className="font-bold">お守りから戻す</p>
              <input type="file" accept="application/json" onChange={(e) => importData(e.target.files?.[0])} className="text-[#4e6472]" />
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-[#4e6472] mt-8 tracking-widest">ニライの手帖　／　{profile.title}　{profile.name}　作</p>

        {msg && <div className="fixed bottom-24 z-50 left-1/2 -translate-x-1/2 w-[90%] max-w-sm text-center text-xs text-[#264e70] bg-[#fffdf8] shadow-md py-2.5 rounded-xl border border-[#b9c9d4]">{msg}</div>}

        <div className="fixed bottom-0 z-50 left-1/2 -translate-x-1/2 w-full max-w-md p-3 bg-[#d6eef0]">
          <div className="grid grid-cols-5 gap-1 bg-[#fffdf8] p-1.5 rounded-2xl border border-[#e3d9c3] shadow-sm">
            {tabs.map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`py-3 rounded-xl text-[11px] font-medium ${tab === k ? "bg-[#264e70] text-white" : "text-[#4e6472]"}`}>{l}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
