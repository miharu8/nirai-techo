"use client";

import { useState, useEffect, useRef } from "react";

type Log = { id: string; at: string; lat?: string; lon?: string; type: "land" | "work"; score: number; memo: string; client: string; fee: number; place?: string; pmemo?: string };
type Item = { id: string; name: string; packed: boolean; cat?: string };
type Plan = { id: string; name: string; kind: string; day: string; memo: string; done: boolean; loc?: string };
type Trip = { id: string; title: string; start: string; end: string; notes: string; items: Item[]; plans: Plan[]; date?: string };
type Fav = { id: string; name: string; category: string; area: string; memo: string; loc?: string };
type Place = { key: string; name: string; named: boolean; logs: Log[]; lat: string; lon: string; last: Log; memo: string };

const APP_VERSION = "2026.11.08-c";
const KEY = "seeker_data_v2";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const ym = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth() + 1}`; };
const inp = "w-full min-w-0 p-3 rounded-xl bg-white border border-[#d5e3e7] text-xs text-[#2d3a40] placeholder:text-[#8a99a0] focus:outline-none focus:border-[#6aa6bf]";
const card = "bg-white border border-[#d5e3e7] shadow-sm rounded-xl";
const LEVELS = ["かすか", "おだやか", "澄む", "満ちる", "輝く"]; // 波動（弱 → 強）
const LV_COLORS = ["#b7d3df", "#7fb5cb", "#4a96b7", "#2f6f96", "#1d4f73"]; // 空色の濃淡
const LV_TEXT = ["#2d3a40", "#2d3a40", "#ffffff", "#ffffff", "#ffffff"];
const lvStyle = (n: number, on: boolean) => (on ? { background: LV_COLORS[n - 1], color: LV_TEXT[n - 1] } : { borderBottom: `3px solid ${LV_COLORS[n - 1]}` });
const CATS: Record<string, string> = { gourmet: "味わい", rental_car: "足（移動）", stay: "宿り", spot: "拝所・訪ねたい場所", other: "その他" };
const ITEM_CATS = ["御嶽・ヒーリング", "台所・暮らし", "車・移動", "衣類・日用品", "手続き・予約", "その他"];
const AREAS = ["那覇", "南部", "中部", "北部", "宮古", "八重山", "久米島", "伊江島"];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dlabel = (d: string) => { const x = new Date(d + "T00:00:00"); return `${x.getMonth() + 1}/${x.getDate()}(${"日月火水木金土"[x.getDay()]})`; };
const rangeText = (t: Trip) => !t.start ? "" : !t.end || t.end === t.start ? t.start.replace(/-/g, "/") : `${t.start.replace(/-/g, "/")} 〜 ${t.end.slice(5).replace("-", "/")}`;
const daysOf = (t: Trip) => {
  if (!t.start) return [] as string[];
  const out: string[] = [], e = new Date((t.end || t.start) + "T00:00:00");
  for (const d = new Date(t.start + "T00:00:00"); d <= e && out.length < 31; d.setDate(d.getDate() + 1)) out.push(iso(d));
  return out;
};
const toLocalInput = (s: string) => { const d = new Date(s); return `${iso(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const normTrip = (t: any): Trip => ({
  ...t, start: t.start ?? t.date ?? "", end: t.end ?? "", plans: t.plans ?? [],
  items: (t.items ?? []).map((i: any) => ({ ...i, cat: i.cat ?? "その他" })),
});

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
const mapUrl = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const gDir = (lat: string, lon: string) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
const aDir = (lat: string, lon: string) => `https://maps.apple.com/?daddr=${lat},${lon}`;

// 同じ場所のまとめ方：名前があれば名前で、なければ約100m四方でまとめる
const placeKey = (l: Log) => (l.place?.trim() ? "n:" + l.place.trim() : l.lat ? `g:${Number(l.lat).toFixed(3)},${Number(l.lon).toFixed(3)}` : "");
function buildPlaces(logs: Log[]): Place[] {
  const g: Record<string, Log[]> = {};
  logs.filter((l) => l.lat).forEach((l) => { (g[placeKey(l)] ||= []).push(l); });
  return Object.entries(g).map(([key, ls]) => {
    const s = ls.slice().sort((a, b) => b.at.localeCompare(a.at));
    const avg = (f: (l: Log) => string | undefined) => (s.reduce((x, l) => x + Number(f(l)), 0) / s.length).toFixed(5);
    return { key, name: key.startsWith("n:") ? key.slice(2) : "", named: key.startsWith("n:"), logs: s, lat: avg((l) => l.lat), lon: avg((l) => l.lon), last: s[0], memo: s.find((l) => l.pmemo)?.pmemo ?? "" };
  }).sort((a, b) => b.last.at.localeCompare(a.last.at));
}

// ブランドの印：天（龍）・地（穂）・人（千の鈴）を、風の線でつなぐ
function Mark({ width = 180 }: { width?: number }) {
  return (
    <svg viewBox="0 12 300 96" width={width} aria-hidden="true" className="mx-auto block">
      <path d="M8 88 C 40 62, 70 112, 100 88 S 160 62, 192 88 S 252 112, 292 84" fill="none" stroke="#9ec7d6" strokeWidth="2" />
      <path d="M8 98 C 40 72, 70 122, 100 98 S 160 72, 192 98 S 252 122, 292 94" fill="none" stroke="#cfe3ea" strokeWidth="1.2" />
      <g fill="none" stroke="#6aa6bf" strokeWidth="2.2" strokeLinecap="round">
        <path d="M30 62 C 26 40, 56 26, 64 44 C 70 58, 48 64, 46 52 C 45 44, 55 42, 58 48" />
        <path d="M30 62 C 24 66, 20 70, 16 76" />
      </g>
      <path d="M150 74 C 150 60, 152 48, 157 28" fill="none" stroke="#c9a77c" strokeWidth="2.2" strokeLinecap="round" />
      <g fill="#ecdcb4" stroke="#c9a77c" strokeWidth="1.2">
        {[[145, 64, -32], [156, 59, 32], [146, 52, -32], [158, 47, 32], [149, 40, -32], [160, 35, 32]].map(([x, y, r], i) => (
          <ellipse key={i} cx={x} cy={y} rx="3.4" ry="7" transform={`rotate(${r} ${x} ${y})`} />
        ))}
        <ellipse cx="158" cy="24" rx="3.2" ry="6.5" transform="rotate(8 158 24)" />
      </g>
      <circle cx="250" cy="28" r="3.4" fill="none" stroke="#e29a86" strokeWidth="1.6" />
      <path d="M238 66 C 238 46, 245 33, 250 33 C 255 33, 262 46, 262 66 Z" fill="#fff" stroke="#e29a86" strokeWidth="2" />
      <path d="M234 66 L266 66" stroke="#e29a86" strokeWidth="2" strokeLinecap="round" />
      <circle cx="250" cy="71" r="3.4" fill="#e29a86" />
      <path d="M270 44 q7 10 0 20 M277 38 q11 16 0 32 M230 44 q-7 10 0 20 M223 38 q-11 16 0 32" fill="none" stroke="#e29a86" strokeWidth="1.2" strokeOpacity="0.55" strokeLinecap="round" />
    </svg>
  );
}
function WindBg() {
  return (
    <svg viewBox="0 0 340 120" preserveAspectRatio="none" width="100%" height="130" className="absolute top-0 left-0" aria-hidden="true">
      <path d="M0 40 C 60 10, 110 70, 170 38 S 280 20, 340 44" fill="none" stroke="#d3e6eb" strokeWidth="1.2" />
      <path d="M0 62 C 60 34, 120 90, 180 60 S 290 42, 340 66" fill="none" stroke="#d3e6eb" strokeWidth="1.2" />
      <path d="M0 84 C 70 58, 130 108, 190 80 S 290 64, 340 88" fill="none" stroke="#d3e6eb" strokeWidth="1.2" />
    </svg>
  );
}

// 地図：波動1〜5を空色の濃淡で表示。丸＝土地、角丸の四角＝ご縁。線は刻んだ順。
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
    L.polyline(ll, { color: "#2f6584", weight: 3, opacity: 0.6, dashArray: "6 6" }).addTo(map);
    pts.forEach((p, i) => {
      const sz = 22 + p.score * 3, br = p.type === "work" ? "28%" : "50%";
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:${sz}px;height:${sz}px;border-radius:${br};background:${LV_COLORS[p.score - 1]};color:${LV_TEXT[p.score - 1]};font-size:${Math.round(sz / 2)}px;font-weight:bold;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${p.score}</div>`,
        iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
      });
      const label = (p.type === "work" ? "ご縁" : "土地") + (p.client ? ` ${esc(p.client)}様` : "") + ` 波動 ${p.score}（${LEVELS[p.score - 1]}）`;
      L.marker(ll[i], { icon }).addTo(map).bindPopup(
        `${p.place ? `<b>${esc(p.place)}</b><br>` : ""}<b>${label}</b><br>${i + 1}番目の記録<br>${new Date(p.at).toLocaleString("ja-JP")}${p.memo ? "<br>" + esc(p.memo) : ""}<br><a href="${gDir(p.lat!, p.lon!)}" target="_blank" rel="noreferrer">ここへ行く（Google）</a>`
      );
    });
    map.fitBounds(ll, { padding: [30, 30], maxZoom: 15 });
    return () => map.remove();
  }, [ready, filter, logs]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-[11px]">
        {([["all", "すべて"], ["land", "土地"], ["work", "ご縁"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-lg border ${filter === k ? "bg-[#2f6584] border-[#2f6584] text-white" : "bg-white border-[#d5e3e7] text-[#5f7078]"}`}>{l}</button>
        ))}
        <span className="ml-auto text-[#5f7078] self-center">{pts.length}か所</span>
      </div>
      {pts.length === 0 ? (
        <p className="text-xs text-[#5f7078] text-center py-10">場所つきの記憶がまだありません。<br />「刻む」で記録すると、ここに道が描かれていきます。</p>
      ) : (
        <>
          <div ref={ref} className="isolate relative z-0 h-[56vh] w-full rounded-xl border border-[#d5e3e7]" />
          <div className={`${card} p-3 space-y-2`}>
            <div className="flex justify-between">
              {LEVELS.map((n, i) => (
                <div key={n} className="flex flex-col items-center gap-1">
                  <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center" style={{ background: LV_COLORS[i], color: LV_TEXT[i] }}>{i + 1}</span>
                  <span className="text-[9px] text-[#5f7078]">{n}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[#5f7078]">色の濃さと大きさが波動の強さです。丸＝土地、角丸の四角＝ご縁。線は刻んだ順につながっています。点に触れると「ここへ行く」が出ます。</p>
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
  const [place, setPlace] = useState("");
  const [pmemo, setPmemo] = useState("");
  const [filter, setFilter] = useState<"all" | "land" | "work">("all");
  // 道標
  const [mapMode, setMapMode] = useState<"map" | "list">("map");
  const [pSearch, setPSearch] = useState("");
  const [editPlace, setEditPlace] = useState<{ key: string; name: string; memo: string } | null>(null);
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
    if (loaded) localStorage.setItem(KEY, JSON.stringify({ logs, trips, currentId, favs }));
  }, [logs, trips, currentId, favs, loaded]);

  // ---- 記録 ----
  const placeNames = Array.from(new Set(logs.map((l) => l.place?.trim() ?? "").filter(Boolean)));
  const onPlaceInput = (v: string) => {
    setPlace(v);
    if (!pmemo) { const m = logs.find((l) => l.place?.trim() === v.trim() && l.pmemo)?.pmemo; if (m) setPmemo(m); }
  };
  const saveLog = (pos?: GeolocationPosition) => {
    const log: Log = {
      id: uid(), at: new Date().toISOString(),
      lat: pos?.coords.latitude.toFixed(5), lon: pos?.coords.longitude.toFixed(5),
      type, score, memo: memo.trim(), client: type === "work" ? client.trim() : "", fee: type === "work" ? Number(fee) || 0 : 0,
      place: place.trim(), pmemo: place.trim() ? pmemo.trim() : "",
    };
    setLogs((p) => [log, ...p]);
    setMemo(""); setClient(""); setFee(""); setPlace(""); setPmemo("");
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
    updateTrip((t) => ({ ...t, plans: [...t.plans, { id: uid(), name: f.name, kind: f.category, day: "", memo: [f.area, f.memo].filter(Boolean).join(" ／ "), done: false, loc: f.loc }] }));
    flash(`「${trip.title}」の行きたい場所に入れました`);
  };
  const areaList = Array.from(new Set(favs.map((f) => f.area).filter(Boolean)));
  const favShown = favs
    .filter((f) => (!fAreaFilter || f.area === fAreaFilter) && (!fSearch || (f.name + f.memo + f.area).includes(fSearch)))
    .sort((a, b) => a.area.localeCompare(b.area, "ja"));

  // ---- 場所リスト（道標） ----
  const places = buildPlaces(logs).filter((p) => !pSearch || (p.name + p.memo).includes(pSearch));
  const savePlace = () => {
    if (!editPlace) return;
    const { key, name, memo: m } = editPlace;
    setLogs((p) => p.map((l) => (placeKey(l) === key ? { ...l, place: name.trim(), pmemo: m.trim() } : l)));
    setEditPlace(null); flash("場所を更新しました");
  };
  const sharePlace = (pl: Place) => {
    const text = [pl.named ? pl.name : "この場所", pl.memo, `https://www.google.com/maps?q=${pl.lat},${pl.lon}`].filter(Boolean).join("\n");
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => flash("コピーしました。貼り付けて送れます"));
  };
  const placeToFav = (pl: Place) => {
    if (!pl.named) return flash("先に名前をつけてください");
    setFavs((p) => [{ id: uid(), name: pl.name, category: "spot", area: "", memo: pl.memo, loc: `${pl.lat},${pl.lon}` }, ...p]);
    flash("「とっておき」にしまいました");
  };
  const placeToTrip = (pl: Place) => {
    if (!pl.named) return flash("先に名前をつけてください");
    if (!trip) return flash("先に「旅支度」で旅を作ってください");
    updateTrip((t) => ({ ...t, plans: [...t.plans, { id: uid(), name: pl.name, kind: "spot", day: "", memo: pl.memo, done: false, loc: `${pl.lat},${pl.lon}` }] }));
    flash(`「${trip.title}」の行きたい場所に入れました`);
  };

  // ---- お守り ----
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ logs, trips, currentId, favs }, null, 2)], { type: "application/json" });
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
        flash("お守りから戻しました");
      } catch { flash("ファイルを読み込めませんでした"); }
    };
    r.readAsText(file);
  };

  const tabs = [["vibe", "刻む"], ["prepare", "旅支度"], ["map", "道標"], ["favorites", "とっておき"], ["data", "お守り"]] as const;
  const btn = (on: boolean) => `py-3 rounded-xl text-xs font-medium border transition-all ${on ? "bg-[#e0eef3] border-[#6aa6bf] text-[#2f6584]" : "bg-white border-[#d5e3e7] text-[#5f7078]"}`;
  const chip = (on: boolean) => `shrink-0 px-3 py-1.5 rounded-lg text-[11px] border ${on ? "bg-[#2f6584] border-[#2f6584] text-white" : "bg-white border-[#d5e3e7] text-[#5f7078]"}`;
  const tag = "text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#e0eef3] text-[#2f6584]";
  const lvBtnCls = (on: boolean) => `flex-1 py-2.5 rounded-xl ${on ? "shadow" : "bg-white border border-[#d5e3e7] text-[#5f7078]"}`;
  const primary = "bg-[#2f6584] rounded-xl text-xs font-bold text-white";

  return (
    <div style={{ fontFamily: '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif' }} className="min-h-screen bg-[#eef5f6] text-[#2d3a40] antialiased">
      <div className="max-w-md mx-auto p-5 pb-28">
        <div className="relative text-center pb-5">
          <WindBg />
          <div className="relative pt-1">
            <Mark width={190} />
            <h1 className="text-xl font-medium tracking-[0.3em] mt-1 mr-[-0.3em]">ニライの手帖</h1>
            <p className="text-[11px] text-[#5f7078] mt-1 tracking-[0.2em]">天・地・人を、風がつなぐ</p>
            <p className="text-[10px] text-[#8a99a0] mt-2 tracking-[0.2em]">千鈴龍穂の教えとともに</p>
          </div>
        </div>

        {/* ===== 刻む ===== */}
        {tab === "vibe" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setType("land")} className={btn(type === "land")}>土地との対話</button>
              <button onClick={() => setType("work")} className={btn(type === "work")}>ご縁のセッション</button>
            </div>
            <input className={inp} list="placeNames" placeholder="場所の名前（例：斎場御嶽）" value={place} onChange={(e) => onPlaceInput(e.target.value)} />
            <datalist id="placeNames">{placeNames.map((n) => <option key={n} value={n} />)}</datalist>
            {place.trim() && <input className={inp} placeholder="場所メモ（行き方・駐車場・入口など。次に行くとき役立ちます）" value={pmemo} onChange={(e) => setPmemo(e.target.value)} />}
            <p className="text-[11px] text-[#5f7078]">この場の波動は、どんな感じ？</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => setScore(s)} style={lvStyle(s, score === s)} className={lvBtnCls(score === s)}>
                  <span className="block text-base font-bold leading-none">{s}</span>
                  <span className="block text-[9px] mt-1">{LEVELS[s - 1]}</span>
                </button>
              ))}
            </div>
            {type === "work" && (
              <div className="grid grid-cols-2 gap-2">
                <input className={inp} placeholder="お客様のお名前" value={client} onChange={(e) => setClient(e.target.value)} />
                <input className={inp} placeholder="料金（円）" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value.replace(/\D/g, ""))} />
              </div>
            )}
            <textarea className={`${inp} h-20 resize-none`} placeholder="感じたこと、風や香り、気づき…" value={memo} onChange={(e) => setMemo(e.target.value)} />
            <button onClick={handleLog} className="w-full py-4 bg-[#2f6584] rounded-xl font-medium tracking-widest text-sm text-white">この場の波動を刻む</button>

            {monthWork.length > 0 && (
              <div className={`${card} p-3 text-xs flex justify-between`}>
                <span className="text-[#5f7078]">今月のご縁 {monthWork.length}件</span>
                <span className="text-[#2f6584] font-bold">{monthTotal.toLocaleString()}円</span>
              </div>
            )}

            <div className="flex gap-2 text-[11px]">
              {([["all", "すべて"], ["land", "土地"], ["work", "ご縁"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setFilter(k)} className={chip(filter === k)}>{l}</button>
              ))}
              <span className="ml-auto text-[#5f7078] self-center">{shown.length}件</span>
            </div>
            <div className="space-y-2">
              {shown.length === 0 && <p className="text-xs text-[#5f7078] text-center py-6">まだ何も刻まれていません</p>}
              {shown.map((l) => (
                <div key={l.id} className={`${card} p-3 text-xs`}>
                  {editLogId === l.id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => updateLog(l.id, { type: "land" })} className={btn(l.type === "land")}>土地との対話</button>
                        <button onClick={() => updateLog(l.id, { type: "work" })} className={btn(l.type === "work")}>ご縁のセッション</button>
                      </div>
                      <input className={inp} list="placeNames" placeholder="場所の名前" value={l.place ?? ""} onChange={(e) => updateLog(l.id, { place: e.target.value })} />
                      <input className={inp} placeholder="場所メモ（行き方など）" value={l.pmemo ?? ""} onChange={(e) => updateLog(l.id, { pmemo: e.target.value })} />
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} onClick={() => updateLog(l.id, { score: n })} style={lvStyle(n, l.score === n)} className={lvBtnCls(l.score === n).replace("py-2.5", "py-2")}>
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
                      <button onClick={() => setEditLogId("")} className={`w-full py-2 ${primary}`}>完了</button>
                    </div>
                  ) : (<>
                    <div className="flex justify-between items-start">
                      <div>
                        {l.place && <p className="font-bold text-sm">{l.place}</p>}
                        <span className="text-[#2f6584] font-medium">{l.type === "work" ? "ご縁" : "土地"}</span>
                        {l.client && <span className="ml-2">{l.client}様</span>}
                        {l.fee > 0 && <span className="text-[#5f7078] ml-2">{l.fee.toLocaleString()}円</span>}
                        <p className="text-[10px] text-[#5f7078] mt-0.5">{new Date(l.at).toLocaleString("ja-JP")}</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg font-bold text-[11px]" style={{ background: LV_COLORS[l.score - 1], color: LV_TEXT[l.score - 1] }}>{l.score}・{LEVELS[l.score - 1]}</span>
                    </div>
                    {l.memo && <p className="mt-2 whitespace-pre-wrap">{l.memo}</p>}
                    <div className="flex justify-between mt-2 text-[10px]">
                      {l.lat ? <a className="text-[#2f6584] underline" href={gDir(l.lat, l.lon!)} target="_blank" rel="noreferrer">ここへ行く</a> : <span className="text-[#8a99a0]">場所の記録なし</span>}
                      <span className="flex gap-3"><button onClick={() => setEditLogId(l.id)} className="text-[#2f6584]">編集</button><button onClick={() => delLog(l.id)} className="text-[#8a99a0]">削除</button></span>
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
                  <label className="min-w-0 text-[10px] text-[#5f7078]">出発日
                    <input type="date" className={`${inp} mt-1 appearance-none`} value={start} onChange={(e) => { setStart(e.target.value); if (end && end < e.target.value) setEnd(""); }} />
                  </label>
                  <label className="min-w-0 text-[10px] text-[#5f7078]">帰着日
                    <input type="date" className={`${inp} mt-1 appearance-none`} value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
                  </label>
                </div>
                <textarea className={`${inp} h-16 resize-none`} placeholder="レンタカー、航空券、宿泊先の予約控えなど..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                <label className="flex items-center gap-2 text-[11px] text-[#5f7078]">
                  <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="w-4 h-4 accent-[#2f6584]" />
                  暮らすような旅（台所・車の携え物も入れる）
                </label>
                <button onClick={addTrip} className={`w-full py-2.5 ${primary}`}>旅支度をはじめる</button>
              </div>
            ) : (
              <button onClick={() => setShowNew(true)} className="w-full py-2.5 rounded-xl border border-dashed border-[#2f6584] text-xs text-[#2f6584]">＋ 新しい旅をつくる</button>
            )}

            {trips.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {trips.map((t) => <button key={t.id} onClick={() => setCurrentId(t.id)} className={chip(t.id === currentId)}>{t.title}</button>)}
              </div>
            )}

            {trip && (
              <div className="space-y-4">
                <div className="p-4 bg-[#e0eef3] border border-[#b8d2dc] rounded-xl space-y-2">
                  <input className={`${inp} font-bold`} value={trip.title} onChange={(e) => updateTrip((t) => ({ ...t, title: e.target.value }))} />
                  {rangeText(trip) && <p className="text-[11px] text-[#5f7078]">{rangeText(trip)}（{days.length}日間）</p>}
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" className={`${inp} appearance-none`} value={trip.start} onChange={(e) => updateTrip((t) => ({ ...t, start: e.target.value, end: t.end && t.end < e.target.value ? "" : t.end }))} />
                    <input type="date" className={`${inp} appearance-none`} value={trip.end} min={trip.start || undefined} onChange={(e) => updateTrip((t) => ({ ...t, end: e.target.value }))} />
                  </div>
                  <textarea className={`${inp} h-16 resize-none`} placeholder="予約メモ" value={trip.notes} onChange={(e) => updateTrip((t) => ({ ...t, notes: e.target.value }))} />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-[#2f6584]">行きたい場所・お店</p>
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
                      <button onClick={addPlan} className={`px-4 shrink-0 ${primary}`}>追加</button>
                    </div>
                  </div>
                  {[...days, ""].map((d) => {
                    const list = plansOf(d);
                    if (list.length === 0) return null;
                    return (
                      <div key={d || "none"} className="space-y-1.5">
                        <p className="text-[11px] text-[#5f7078]">{d ? dlabel(d) : "日程未定"}</p>
                        {list.map((p) => (
                          <div key={p.id} className={`${card} p-3 space-y-1.5`}>
                            <div className="flex items-center gap-2">
                              <input type="checkbox" checked={p.done} onChange={() => updatePlan(p.id, { done: !p.done })} className="w-4 h-4 accent-[#2f6584]" />
                              {editPlanId === p.id
                                ? <input className={inp} value={p.name} onChange={(e) => updatePlan(p.id, { name: e.target.value })} />
                                : <span className={`flex-1 text-xs font-medium ${p.done ? "line-through text-[#8a99a0]" : ""}`}>{p.name}</span>}
                              <span className={tag}>{CATS[p.kind] ?? "その他"}</span>
                              <button onClick={() => setEditPlanId(editPlanId === p.id ? "" : p.id)} className="text-[#2f6584] text-xs">✎</button>
                              <button onClick={() => updateTrip((t) => ({ ...t, plans: t.plans.filter((x) => x.id !== p.id) }))} className="text-[#8a99a0] text-xs">✕</button>
                            </div>
                            {editPlanId === p.id ? (
                              <div className="space-y-2 pl-6">
                                <select className={inp} value={p.kind} onChange={(e) => updatePlan(p.id, { kind: e.target.value })}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                                <input className={inp} placeholder="メモ" value={p.memo} onChange={(e) => updatePlan(p.id, { memo: e.target.value })} />
                                <button onClick={() => setEditPlanId("")} className={`w-full py-2 ${primary}`}>完了</button>
                              </div>
                            ) : (p.memo && <p className="text-[11px] text-[#5f7078] pl-6">{p.memo}</p>)}
                            <div className="flex justify-between items-center pl-6 text-[10px]">
                              <a className="text-[#2f6584] underline" href={mapUrl(p.loc || p.name)} target="_blank" rel="noreferrer">地図でひらく</a>
                              <select className="bg-[#e3eff2] rounded-lg px-2 py-1 text-[#5f7078]" value={days.includes(p.day) ? p.day : ""} onChange={(e) => updatePlan(p.id, { day: e.target.value })}>
                                <option value="">日程未定</option>
                                {days.map((x) => <option key={x} value={x}>{dlabel(x)}</option>)}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  {trip.plans.length === 0 && <p className="text-[11px] text-[#5f7078]">「とっておき」や「道標」の場所リストから、ボタンひとつで入れることもできます。</p>}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-[#2f6584]">携え物 {trip.items.filter((i) => i.packed).length} / {trip.items.length}</span>
                    <button className="text-[11px] text-[#5f7078]" onClick={() => updateTrip((t) => ({ ...t, items: t.items.map((i) => ({ ...i, packed: false })) }))}>すべてまっさらに戻す</button>
                  </div>
                  {ITEM_CATS.map((c) => {
                    const list = trip.items.filter((i) => (ITEM_CATS.includes(i.cat ?? "") ? i.cat : "その他") === c);
                    if (list.length === 0) return null;
                    return (
                      <div key={c} className="space-y-1.5">
                        <p className="text-[11px] text-[#5f7078]">{c}</p>
                        {list.map((i) => (
                          <div key={i.id} className={`${card} p-3 flex items-center gap-3`}>
                            <input type="checkbox" checked={i.packed} onChange={() => updateItem(i.id, { packed: !i.packed })} className="w-4 h-4 accent-[#2f6584]" />
                            {editItemId === i.id ? (
                              <div className="flex-1 flex gap-1.5 min-w-0">
                                <input className={inp} value={i.name} onChange={(e) => updateItem(i.id, { name: e.target.value })} />
                                <select className={`${inp} !w-24 shrink-0`} value={i.cat ?? "その他"} onChange={(e) => updateItem(i.id, { cat: e.target.value })}>{ITEM_CATS.map((x) => <option key={x}>{x}</option>)}</select>
                              </div>
                            ) : <span className={`flex-1 text-xs ${i.packed ? "line-through text-[#8a99a0]" : ""}`}>{i.name}</span>}
                            <button onClick={() => setEditItemId(editItemId === i.id ? "" : i.id)} className="text-[#2f6584] text-xs">{editItemId === i.id ? "完了" : "✎"}</button>
                            <button onClick={() => updateTrip((t) => ({ ...t, items: t.items.filter((x) => x.id !== i.id) }))} className="text-[#8a99a0] text-xs">✕</button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  <div className="flex gap-2">
                    <input className={inp} placeholder="携え物を足す" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} />
                    <select className={`${inp} !w-28 shrink-0`} value={newItemCat} onChange={(e) => setNewItemCat(e.target.value)}>{ITEM_CATS.map((c) => <option key={c}>{c}</option>)}</select>
                    <button onClick={addItem} className={`px-4 shrink-0 ${primary}`}>追加</button>
                  </div>
                </div>
                <button onClick={delTrip} className="w-full text-[11px] text-[#8a99a0] py-2">この旅を手放す</button>
              </div>
            )}
          </div>
        )}

        {/* ===== 道標 ===== */}
        {tab === "map" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMapMode("map")} className={btn(mapMode === "map")}>地図</button>
              <button onClick={() => setMapMode("list")} className={btn(mapMode === "list")}>場所リスト</button>
            </div>
            {mapMode === "map" ? <MapView logs={logs} /> : (
              <div className="space-y-3">
                <input className={inp} placeholder="場所をさがす（名前・メモ）" value={pSearch} onChange={(e) => setPSearch(e.target.value)} />
                {places.length === 0 && <p className="text-xs text-[#5f7078] text-center py-8">場所つきの記録がまだありません。<br />「刻む」で場所の名前を入れて記録すると、ここに集まります。</p>}
                {places.map((pl) => (
                  <div key={pl.key} className={`${card} p-3 space-y-2 text-xs`}>
                    {editPlace?.key === pl.key ? (
                      <div className="space-y-2">
                        <input className={inp} placeholder="場所の名前" value={editPlace.name} onChange={(e) => setEditPlace({ ...editPlace, name: e.target.value })} />
                        <textarea className={`${inp} h-20 resize-none`} placeholder="場所メモ（行き方・駐車場・入口など）" value={editPlace.memo} onChange={(e) => setEditPlace({ ...editPlace, memo: e.target.value })} />
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={savePlace} className={`py-2 ${primary}`}>保存</button>
                          <button onClick={() => setEditPlace(null)} className="py-2 rounded-xl border border-[#d5e3e7] text-[#5f7078]">やめる</button>
                        </div>
                      </div>
                    ) : (<>
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-bold text-sm">{pl.named ? pl.name : "名前のない場所"}</p>
                          <p className="text-[10px] text-[#5f7078] mt-0.5">{pl.logs.length}回　最後 {new Date(pl.last.at).toLocaleDateString("ja-JP")}</p>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg font-bold text-[11px]" style={{ background: LV_COLORS[pl.last.score - 1], color: LV_TEXT[pl.last.score - 1] }}>{pl.last.score}・{LEVELS[pl.last.score - 1]}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 items-center">
                        <span className="text-[10px] text-[#5f7078] mr-1">波動の移り変わり</span>
                        {pl.logs.slice().reverse().map((l) => (
                          <span key={l.id} className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: LV_COLORS[l.score - 1], color: LV_TEXT[l.score - 1] }}>{l.score}</span>
                        ))}
                      </div>
                      {pl.memo && <p className="text-[#5f7078] whitespace-pre-wrap">{pl.memo}</p>}
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-[#2f6584]">
                        <a className="underline" href={gDir(pl.lat, pl.lon)} target="_blank" rel="noreferrer">ここへ行く（Google）</a>
                        <a className="underline" href={aDir(pl.lat, pl.lon)} target="_blank" rel="noreferrer">（Apple）</a>
                        <button className="underline" onClick={() => sharePlace(pl)}>シェア</button>
                        <button className="underline" onClick={() => setEditPlace({ key: pl.key, name: pl.name, memo: pl.memo })}>{pl.named ? "名前・メモを編集" : "名前をつける"}</button>
                        <button className="underline" onClick={() => placeToFav(pl)}>とっておきへ</button>
                        <button className="underline" onClick={() => placeToTrip(pl)}>今の旅へ</button>
                      </div>
                    </>)}
                  </div>
                ))}
                <p className="text-[10px] text-[#8a99a0]">シェアには、場所の名前・場所メモ・地図リンクだけが入ります。お客様のお名前や料金、セッションのメモは入りません。</p>
              </div>
            )}
          </div>
        )}

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
              <button onClick={addFav} className={`w-full py-2.5 ${primary}`}>とっておきにしまう</button>
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
                    {f.area && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#c9a77c] text-white">{f.area}</span>}
                  </div>
                  <button onClick={() => confirm("削除しますか？") && setFavs((p) => p.filter((x) => x.id !== f.id))} className="text-[#8a99a0] text-xs">削除</button>
                </div>
                {editFavId === f.id ? (
                  <div className="space-y-2 mt-2">
                    <input className={inp} value={f.name} onChange={(e) => updateFav(f.id, { name: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2">
                      <input className={inp} list="areas" placeholder="エリア" value={f.area} onChange={(e) => updateFav(f.id, { area: e.target.value })} />
                      <select className={inp} value={f.category} onChange={(e) => updateFav(f.id, { category: e.target.value })}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    </div>
                    <input className={inp} placeholder="ひとことメモ" value={f.memo} onChange={(e) => updateFav(f.id, { memo: e.target.value })} />
                    <button onClick={() => setEditFavId("")} className={`w-full py-2 ${primary}`}>完了</button>
                  </div>
                ) : (<>
                  <h3 className="font-bold text-xs mt-1.5">{f.name}</h3>
                  {f.memo && <p className="text-xs text-[#5f7078] mt-1">{f.memo}</p>}
                </>)}
                <div className="flex gap-4 mt-2 text-[11px]">
                  <a className="text-[#2f6584] underline" href={mapUrl(f.loc || `${f.area} ${f.name}`.trim())} target="_blank" rel="noreferrer">地図でひらく</a>
                  <button className="text-[#2f6584] underline" onClick={() => favToTrip(f)}>今の旅に入れる</button>
                  <button className="text-[#2f6584] underline" onClick={() => setEditFavId(editFavId === f.id ? "" : f.id)}>編集</button>
                </div>
              </div>
            ))}
            {favShown.length === 0 && <p className="text-xs text-[#5f7078] text-center py-6">見つかりません</p>}
          </div>
        )}

        {/* ===== お守り ===== */}
        {tab === "data" && (
          <div className="space-y-4 text-xs">
            <div className={`${card} p-4 space-y-3`}>
              <Mark width={170} />
              <p className="font-bold text-sm text-center tracking-[0.2em]">天・地・人をつなぐ</p>
              <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                <div><p className="text-[#6aa6bf] font-bold text-sm">天</p><p>龍</p></div>
                <div><p className="text-[#c9a77c] font-bold text-sm">地</p><p>穂</p></div>
                <div><p className="text-[#e29a86] font-bold text-sm">人</p><p>千の鈴</p></div>
              </div>
              <p className="text-[#5f7078] leading-relaxed">ひとりひとりの鈴の音が、天と地をつなぐ。天地人のように、天と地、海、植物、鉱物、岩などの自然をつなぐ役割として、日々の波動調整を刻む手帖です。</p>
              <p className="text-[10px] text-[#8a99a0] text-center tracking-widest">波動調整師 千鈴龍穂（senritatuho）の教えとともに</p>
            </div>
            <div className={`${card} p-4 space-y-3`}>
              <p className="font-bold">お守りを作る</p>
              <p className="text-[#5f7078]">記憶はこのスマホの中だけに保存されています。大切な記憶が消えないよう、ときどきお守り（バックアップ）を作っておきましょう。機種変更のときにも使えます。</p>
              <button onClick={exportData} className={`w-full py-2.5 ${primary}`}>お守りを保存する</button>
            </div>
            <div className={`${card} p-4 space-y-3`}>
              <p className="font-bold">お守りから戻す</p>
              <input type="file" accept="application/json" onChange={(e) => importData(e.target.files?.[0])} className="text-[#5f7078]" />
            </div>
            <div className={`${card} p-4 space-y-2`}>
              <p className="font-bold">最新に更新</p>
              <p className="text-[#5f7078]">新しくなったはずなのに画面が古いままのときに押してください。記録は消えません。</p>
              <button onClick={() => location.reload()} className="w-full py-2.5 rounded-xl border border-[#2f6584] text-[#2f6584] font-bold">最新に更新する</button>
              <p className="text-[10px] text-[#8a99a0]">バージョン {APP_VERSION}</p>
            </div>
          </div>
        )}

        {msg && <div className="fixed bottom-24 z-50 left-1/2 -translate-x-1/2 w-[90%] max-w-sm text-center text-xs text-[#2f6584] bg-white shadow-md py-2.5 rounded-xl border border-[#b8d2dc]">{msg}</div>}

        <div className="fixed bottom-0 z-50 left-1/2 -translate-x-1/2 w-full max-w-md p-3 bg-[#eef5f6]">
          <div className="grid grid-cols-5 gap-1 bg-white p-1.5 rounded-2xl border border-[#d5e3e7] shadow-sm">
            {tabs.map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`py-3 rounded-xl text-[11px] font-medium ${tab === k ? "bg-[#2f6584] text-white" : "text-[#5f7078]"}`}>{l}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
