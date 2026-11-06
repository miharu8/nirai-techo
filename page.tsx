"use client";

import { useState, useEffect, useRef } from "react";

type Log = { id: string; at: string; lat?: string; lon?: string; type: "land" | "work"; score: number; memo: string; client: string; fee: number };
type Item = { id: string; name: string; packed: boolean };
type Trip = { id: string; title: string; date: string; notes: string; items: Item[] };
type Fav = { id: string; name: string; category: string; memo: string };

const KEY = "seeker_data_v2";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const ym = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth() + 1}`; };
const inp = "w-full p-3 rounded-xl bg-[#fffdf8] border border-[#e3d9c3] text-xs text-[#22384a] placeholder:text-[#7d8c93] focus:outline-none focus:border-[#b08d4a]";
const card = "bg-[#fffdf8] border border-[#e3d9c3] shadow-sm rounded-xl";
const CATS: Record<string, string> = { gourmet: "味わい", rental_car: "足（移動）", stay: "宿り", spot: "訪ねたい場所", other: "その他" };

// 旅のタイトル・メモの言葉に合わせて持ち物を自動追加
function makeItems(text: string): Item[] {
  const names = ["クリスタル・音叉", "エネルギーノート", "着替え・洗面用具", "充電器・モバイルバッテリー"];
  if (/神社|寺|参拝|山/.test(text)) names.push("小銭（お賽銭）", "御朱印帳");
  if (/車|レンタカー/.test(text)) names.push("運転免許証", "スマホホルダー");
  if (/飛行機|航空|空港|新幹線|電車/.test(text)) names.push("チケット・予約画面", "身分証明書");
  if (/温泉|宿|泊/.test(text)) names.push("タオル", "宿の予約控え");
  return names.map((name) => ({ id: uid(), name, packed: false }));
}


const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ESC[c]);

// 記録した場所を、古い順に番号つきの点で結び、線でつなぐ地図（無料の OpenStreetMap を使用）
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
    L.polyline(ll, { color: "#2f7f8a", weight: 3, dashArray: "6 6" }).addTo(map);
    pts.forEach((p, i) => {
      const bg = p.type === "work" ? "#c9604b" : "#2f7f8a";
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:26px;height:26px;border-radius:50%;background:${bg};color:#fff;font-size:12px;font-weight:bold;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${i + 1}</div>`,
        iconSize: [26, 26], iconAnchor: [13, 13],
      });
      const label = (p.type === "work" ? "ご縁" : "土地") + (p.client ? ` ${esc(p.client)}様` : "") + ` ★${p.score}`;
      L.marker(ll[i], { icon }).addTo(map).bindPopup(`<b>${i + 1}. ${label}</b><br>${new Date(p.at).toLocaleString("ja-JP")}${p.memo ? "<br>" + esc(p.memo) : ""}`);
    });
    map.fitBounds(ll, { padding: [30, 30], maxZoom: 15 });
    return () => map.remove();
  }, [ready, filter, logs]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-[11px]">
        {([["all", "すべて"], ["land", "土地"], ["work", "ご縁"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-lg ${filter === k ? "bg-[#264e70] text-white" : "bg-[#efe8d8] text-[#4e6472]"}`}>{l}</button>
        ))}
        <span className="ml-auto text-[#7d8c93] self-center">{pts.length}か所</span>
      </div>
      {pts.length === 0 ? (
        <p className="text-xs text-[#7d8c93] text-center py-10">場所つきの記憶がまだありません。<br />「刻む」で記録すると、ここに道が描かれていきます。</p>
      ) : (
        <>
          <div ref={ref} className="isolate relative z-0 h-[60vh] w-full rounded-xl border border-[#e3d9c3]" />
          <p className="text-[10px] text-[#7d8c93]">番号は刻んだ順です。点に触れると記憶がひらきます。（海の色＝土地／珊瑚色＝ご縁）</p>
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
    { id: "f1", name: "いつものレンタカー会社", category: "rental_car", memo: "軽自動車が借りやすくておすすめ" },
    { id: "f2", name: "お気に入りの蕎麦屋", category: "gourmet", memo: "鴨南蛮が絶品。エネルギーが高い空間" },
  ]);
  const [msg, setMsg] = useState("");

  // 記録フォーム
  const [type, setType] = useState<"land" | "work">("land");
  const [score, setScore] = useState(3);
  const [memo, setMemo] = useState("");
  const [client, setClient] = useState("");
  const [fee, setFee] = useState("");
  const [filter, setFilter] = useState<"all" | "land" | "work">("all");
  // 旅フォーム
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [newItem, setNewItem] = useState("");
  // お気に入りフォーム
  const [fName, setFName] = useState("");
  const [fCat, setFCat] = useState("gourmet");
  const [fMemo, setFMemo] = useState("");

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(""), 3000); };

  // 読み込み（旧バージョンのデータも引き継ぎ）
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        setLogs(d.logs ?? []); setTrips(d.trips ?? []); setCurrentId(d.currentId ?? ""); if (d.favs) setFavs(d.favs);
      } else {
        const oldLogs = JSON.parse(localStorage.getItem("seeker_logs") || "[]");
        setLogs(oldLogs.map((l: any) => ({
          id: l.id, at: new Date().toISOString(), lat: l.latitude, lon: l.longitude,
          type: String(l.logType).includes("仕事") ? "work" : "land", score: l.vibeScore, memo: "", client: "", fee: 0,
        })));
        const t = JSON.parse(localStorage.getItem("seeker_trip") || "null");
        if (t) {
          const trip: Trip = { id: uid(), title: t.title, date: "", notes: t.transitNotes || "",
            items: (t.belongings || []).map((b: any) => ({ id: b.id, name: b.item_name, packed: b.is_packed })) };
          setTrips([trip]); setCurrentId(trip.id);
        }
      }
    } catch {}
    setLoaded(true);
  }, []);

  // 変更のたびに自動保存
  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify({ logs, trips, currentId, favs }));
  }, [logs, trips, currentId, favs, loaded]);

  // ---- 記録 ----
  const saveLog = (pos?: GeolocationPosition) => {
    const log: Log = {
      id: uid(), at: new Date().toISOString(),
      lat: pos?.coords.latitude.toFixed(5), lon: pos?.coords.longitude.toFixed(5),
      type, score, memo: memo.trim(), client: type === "work" ? client.trim() : "", fee: type === "work" ? Number(fee) || 0 : 0,
    };
    setLogs((p) => [log, ...p]);
    setMemo(""); setClient(""); setFee("");
    flash(pos ? "響きを刻みました（場所つき）" : "響きを刻みました");
  };
  const handleLog = () => {
    if (!navigator.geolocation) return saveLog();
    flash("場所を探しています…");
    navigator.geolocation.getCurrentPosition(saveLog, () => saveLog(), { timeout: 10000 });
  };
  const delLog = (id: string) => { if (confirm("この記録を削除しますか？")) setLogs((p) => p.filter((l) => l.id !== id)); };

  const thisMonth = ym(new Date().toISOString());
  const monthWork = logs.filter((l) => l.type === "work" && ym(l.at) === thisMonth);
  const monthTotal = monthWork.reduce((s, l) => s + l.fee, 0);
  const shown = logs.filter((l) => filter === "all" || l.type === filter);

  // ---- 旅 ----
  const trip = trips.find((t) => t.id === currentId);
  const updateTrip = (fn: (t: Trip) => Trip) => setTrips((p) => p.map((t) => (t.id === currentId ? fn(t) : t)));
  const addTrip = () => {
    if (!title.trim()) return flash("旅の名を入れてください");
    const t: Trip = { id: uid(), title: title.trim(), date, notes, items: makeItems(title + notes) };
    setTrips((p) => [t, ...p]); setCurrentId(t.id);
    setTitle(""); setDate(""); setNotes("");
    flash("旅支度を整えました");
  };
  const delTrip = () => {
    if (!trip || !confirm(`「${trip.title}」を削除しますか？`)) return;
    const rest = trips.filter((t) => t.id !== trip.id);
    setTrips(rest); setCurrentId(rest[0]?.id ?? "");
  };
  const addItem = () => {
    if (!newItem.trim()) return;
    updateTrip((t) => ({ ...t, items: [...t.items, { id: uid(), name: newItem.trim(), packed: false }] }));
    setNewItem("");
  };

  // ---- お気に入り ----
  const addFav = () => {
    if (!fName.trim()) return flash("名前を入れてください");
    setFavs((p) => [{ id: uid(), name: fName.trim(), category: fCat, memo: fMemo.trim() }, ...p]);
    setFName(""); setFMemo("");
  };

  // ---- バックアップ ----
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
        setLogs(d.logs ?? []); setTrips(d.trips ?? []); setCurrentId(d.currentId ?? ""); setFavs(d.favs ?? []);
        flash("お守りから戻しました");
      } catch { flash("ファイルを読み込めませんでした"); }
    };
    r.readAsText(file);
  };

  const tabs = [["vibe", "刻む"], ["prepare", "旅支度"], ["map", "道標"], ["favorites", "とっておき"], ["data", "お守り"]] as const;
  const btn = (on: boolean) => `py-3 rounded-xl text-xs font-medium border transition-all ${on ? "bg-[#e8eef2] border-[#264e70] text-[#264e70]" : "bg-[#fffdf8] border-transparent text-[#4e6472]"}`;

  return (
    <div style={{ fontFamily: '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif' }} className="max-w-md mx-auto min-h-screen bg-[#c9ecef] text-[#22384a] p-5 pb-28 antialiased">
      <div className="text-center pb-5">
        <div className="h-1 rounded-full bg-gradient-to-r from-[#264e70] via-[#b08d4a] to-[#c9604b] mb-4" />
        <p className="text-[#b08d4a] text-xs tracking-[0.5em]">〜 ❖ 〜</p>
        <h1 className="text-2xl font-medium tracking-[0.25em] text-[#264e70] mt-1">ニライの手帖</h1>
        <p className="text-[11px] text-[#4e6472] mt-1 tracking-widest">島をめぐり、響きを刻む</p>
      </div>

      {/* ===== 記録 ===== */}
      {tab === "vibe" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setType("land")} className={btn(type === "land")}>土地との対話</button>
            <button onClick={() => setType("work")} className={btn(type === "work")}>ご縁のセッション</button>
          </div>
          <p className="text-[11px] text-[#4e6472] -mb-2">場の響き　弱 ← → 強</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setScore(s)} className={`flex-1 py-3 rounded-xl font-bold ${score === s ? "bg-[#264e70] text-white" : "bg-[#efe8d8] text-[#7d8c93]"}`}>{s}</button>
            ))}
          </div>
          {type === "work" && (
            <div className="grid grid-cols-2 gap-2">
              <input className={inp} placeholder="お客様のお名前" value={client} onChange={(e) => setClient(e.target.value)} />
              <input className={inp} placeholder="料金（円）" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value.replace(/\D/g, ""))} />
            </div>
          )}
          <textarea className={`${inp} h-20 resize-none`} placeholder="感じたこと、風や香り、場所の名前、気づき…" value={memo} onChange={(e) => setMemo(e.target.value)} />
          <button onClick={handleLog} className="w-full py-4 bg-gradient-to-r from-[#264e70] to-[#2f7f8a] rounded-xl font-medium tracking-widest text-sm text-white">この場の響きを刻む</button>

          {monthWork.length > 0 && (
            <div className={`${card} p-3 text-xs flex justify-between`}>
              <span className="text-[#4e6472]">今月のご縁 {monthWork.length}件</span>
              <span className="text-[#264e70] font-bold">{monthTotal.toLocaleString()}円</span>
            </div>
          )}

          <div className="flex gap-2 text-[11px]">
            {([["all", "すべて"], ["land", "土地"], ["work", "ご縁"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-lg ${filter === k ? "bg-[#264e70] text-white" : "bg-[#efe8d8] text-[#4e6472]"}`}>{l}</button>
            ))}
            <span className="ml-auto text-[#7d8c93] self-center">{shown.length}件</span>
          </div>
          <div className="space-y-2">
            {shown.length === 0 && <p className="text-xs text-[#7d8c93] text-center py-6">まだ何も刻まれていません</p>}
            {shown.map((l) => (
              <div key={l.id} className={`${card} p-3 text-xs`}>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[#264e70] font-medium">{l.type === "work" ? "ご縁" : "土地"}</span>
                    {l.client && <span className="text-[#22384a] ml-2">{l.client}様</span>}
                    {l.fee > 0 && <span className="text-[#4e6472] ml-2">{l.fee.toLocaleString()}円</span>}
                    <p className="text-[10px] text-[#4e6472] mt-0.5">{new Date(l.at).toLocaleString("ja-JP")}</p>
                  </div>
                  <span className="bg-[#efe8d8] px-2.5 py-1 rounded-lg font-bold text-[#264e70]">★ {l.score}</span>
                </div>
                {l.memo && <p className="text-[#22384a] mt-2 whitespace-pre-wrap">{l.memo}</p>}
                <div className="flex justify-between mt-2 text-[10px]">
                  {l.lat ? <a className="text-[#264e70] underline" href={`https://www.google.com/maps?q=${l.lat},${l.lon}`} target="_blank" rel="noreferrer">地図でひらく</a> : <span className="text-[#7d8c93]">場所の記録なし</span>}
                  <button onClick={() => delLog(l.id)} className="text-[#7d8c93]">削除</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== 旅の準備 ===== */}
      {tab === "prepare" && (
        <div className="space-y-4">
          <div className={`${card} p-4 space-y-2`}>
            <input className={inp} placeholder="旅の名（例：戸隠をめぐる旅）" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} />
            <textarea className={`${inp} h-20 resize-none`} placeholder="レンタカー、航空券、宿泊先の予約控えなど..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button onClick={addTrip} className="w-full py-2.5 bg-[#264e70] rounded-xl text-xs font-bold text-white">旅支度をはじめる（携え物を自動で用意）</button>
            <p className="text-[10px] text-[#7d8c93]">「神社」「車」「温泉」などの言葉に合わせて携え物が増えます</p>
          </div>

          {trips.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {trips.map((t) => (
                <button key={t.id} onClick={() => setCurrentId(t.id)} className={`shrink-0 px-3 py-2 rounded-lg text-xs ${t.id === currentId ? "bg-[#264e70] text-white" : "bg-[#efe8d8] text-[#4e6472]"}`}>{t.title}</button>
              ))}
            </div>
          )}

          {trip && (
            <div className="space-y-3">
              <div className="p-4 bg-[#e8eef2] border border-[#b9c9d4] rounded-xl">
                <h3 className="font-bold text-sm text-[#264e70]">{trip.title}</h3>
                {trip.date && <p className="text-[11px] text-[#4e6472] mt-0.5">{trip.date.replace(/-/g, "/")}</p>}
                <textarea className="w-full mt-2 p-2 rounded-lg bg-[#efe8d8] text-xs text-[#22384a] h-20 resize-none focus:outline-none" placeholder="予約メモ" value={trip.notes} onChange={(e) => updateTrip((t) => ({ ...t, notes: e.target.value }))} />
              </div>

              <div className="flex justify-between items-center text-[11px] text-[#4e6472]">
                <span>携え物 {trip.items.filter((i) => i.packed).length} / {trip.items.length}</span>
                <button onClick={() => updateTrip((t) => ({ ...t, items: t.items.map((i) => ({ ...i, packed: false })) }))}>すべてまっさらに戻す</button>
              </div>
              <div className="space-y-1.5">
                {trip.items.map((i) => (
                  <div key={i.id} className={`${card} p-3 flex items-center gap-3`}>
                    <input type="checkbox" checked={i.packed} onChange={() => updateTrip((t) => ({ ...t, items: t.items.map((x) => (x.id === i.id ? { ...x, packed: !x.packed } : x)) }))} className="w-4 h-4 accent-[#264e70]" />
                    <span className={`flex-1 text-xs ${i.packed ? "line-through text-[#7d8c93]" : "text-[#22384a]"}`}>{i.name}</span>
                    <button onClick={() => updateTrip((t) => ({ ...t, items: t.items.filter((x) => x.id !== i.id) }))} className="text-[#7d8c93] text-xs">✕</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input className={inp} placeholder="携え物を足す" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} />
                <button onClick={addItem} className="px-4 bg-[#264e70] rounded-xl text-xs font-bold text-white shrink-0">追加</button>
              </div>
              <button onClick={delTrip} className="w-full text-[11px] text-[#7d8c93] py-2">この旅を手放す</button>
            </div>
          )}
        </div>
      )}

      {/* ===== 地図 ===== */}
      {tab === "map" && <MapView logs={logs} />}

      {/* ===== お気に入り ===== */}
      {tab === "favorites" && (
        <div className="space-y-3">
          <div className={`${card} p-4 space-y-2`}>
            <input className={inp} placeholder="名前（お店・会社・場所）" value={fName} onChange={(e) => setFName(e.target.value)} />
            <select className={inp} value={fCat} onChange={(e) => setFCat(e.target.value)}>
              {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className={inp} placeholder="ひとことメモ" value={fMemo} onChange={(e) => setFMemo(e.target.value)} />
            <button onClick={addFav} className="w-full py-2.5 bg-[#264e70] rounded-xl text-xs font-bold text-white">とっておきにしまう</button>
          </div>
          {favs.map((f) => (
            <div key={f.id} className={`${card} p-4`}>
              <div className="flex justify-between">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#efe8d8] text-[#264e70]">{CATS[f.category] ?? "その他"}</span>
                <button onClick={() => confirm("削除しますか？") && setFavs((p) => p.filter((x) => x.id !== f.id))} className="text-[#7d8c93] text-xs">削除</button>
              </div>
              <h3 className="font-bold text-xs mt-1 text-[#22384a]">{f.name}</h3>
              {f.memo && <p className="text-xs text-[#4e6472] mt-1">{f.memo}</p>}
            </div>
          ))}
        </div>
      )}

      {/* ===== 保存（バックアップ） ===== */}
      {tab === "data" && (
        <div className="space-y-4 text-xs">
          <div className={`${card} p-4 space-y-3`}>
            <p className="text-[#22384a] font-bold">お守りを作る</p>
            <p className="text-[#4e6472]">記憶はこのスマホの中だけに保存されています。大切な記憶が消えないよう、ときどきお守り（バックアップ）を作っておきましょう。機種変更のときにも使えます。</p>
            <button onClick={exportData} className="w-full py-2.5 bg-[#264e70] rounded-xl font-bold text-white">お守りを保存する</button>
          </div>
          <div className={`${card} p-4 space-y-3`}>
            <p className="text-[#22384a] font-bold">お守りから戻す</p>
            <input type="file" accept="application/json" onChange={(e) => importData(e.target.files?.[0])} className="text-[#4e6472]" />
          </div>
        </div>
      )}

      {msg && <div className="fixed bottom-24 z-50 left-1/2 -translate-x-1/2 w-[90%] max-w-sm text-center text-xs text-[#264e70] bg-[#fffdf8] shadow-md py-2.5 rounded-xl border border-[#b9c9d4]">{msg}</div>}

      <div className="fixed bottom-0 z-50 left-1/2 -translate-x-1/2 w-full max-w-md p-3 bg-[#c9ecef]">
        <div className="grid grid-cols-5 gap-1 bg-[#fffdf8] p-1.5 rounded-2xl border border-[#e3d9c3]">
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`py-3 rounded-xl text-[11px] font-medium ${tab === k ? "bg-[#264e70] text-white" : "text-[#4e6472]"}`}>{l}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
