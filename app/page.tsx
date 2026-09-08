"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type Holding = {
  symbol: string;
  name: string;
  quantity: number;
  avg: number;
  price: number;
  change: number;
  sector: string;
};

const starterHoldings: Holding[] = [
  { symbol: "RELIANCE", name: "Reliance Industries", quantity: 18, avg: 2791.2, price: 2965.4, change: 1.28, sector: "Energy" },
  { symbol: "HDFCBANK", name: "HDFC Bank", quantity: 32, avg: 1589.6, price: 1724.8, change: 0.72, sector: "Financials" },
  { symbol: "INFY", name: "Infosys", quantity: 24, avg: 1428.4, price: 1621.35, change: -0.46, sector: "Technology" },
  { symbol: "TATAMOTORS", name: "Tata Motors", quantity: 48, avg: 814.7, price: 936.1, change: 2.14, sector: "Automobile" },
  { symbol: "ITC", name: "ITC", quantity: 65, avg: 421.15, price: 474.2, change: -0.18, sector: "Consumer" },
];

const chartSeed = [154820,155100,154760,155580,155330,156240,156020,156890,156410,157160,157520,157280,158040,157820,158610,159120,158850,159580,160240,160090,160860,161430,161110,162084];
const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function PriceChart({ points }: { points: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      const w = rect.width, h = rect.height, pad = 8;
      const min = Math.min(...points) * .998, max = Math.max(...points) * 1.002;
      const coords = points.map((p, i) => ({
        x: pad + i * (w - pad * 2) / (points.length - 1),
        y: pad + (max - p) * (h - pad * 2) / (max - min),
      }));
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, "rgba(54, 210, 164, .28)");
      gradient.addColorStop(1, "rgba(54, 210, 164, 0)");
      ctx.beginPath();
      ctx.moveTo(coords[0].x, h);
      coords.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(coords.at(-1)!.x, h);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.beginPath();
      coords.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.strokeStyle = "#36d2a4";
      ctx.lineWidth = 2.4;
      ctx.lineJoin = "round";
      ctx.stroke();
      const last = coords.at(-1)!;
      ctx.beginPath();
      ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#36d2a4";
      ctx.fill();
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [points]);

  return <canvas ref={canvasRef} className="price-chart" aria-label="Portfolio value chart" />;
}

function parseCsv(text: string): Holding[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(v => v.trim().toLowerCase());
  const find = (...names: string[]) => headers.findIndex(h => names.some(n => h.includes(n)));
  const indexes = {
    symbol: find("symbol", "stock"),
    name: find("company", "name"),
    quantity: find("quantity", "qty"),
    avg: find("average", "avg"),
    price: find("current", "ltp", "price"),
  };
  return lines.slice(1).map(line => {
    const cells = line.split(",").map(v => v.replace(/["₹,]/g, "").trim());
    const symbol = cells[indexes.symbol] || cells[indexes.name] || "STOCK";
    const avg = Number(cells[indexes.avg]) || 0;
    const price = Number(cells[indexes.price]) || avg;
    return {
      symbol: symbol.toUpperCase(),
      name: cells[indexes.name] || symbol,
      quantity: Number(cells[indexes.quantity]) || 0,
      avg,
      price,
      change: 0,
      sector: "Imported",
    };
  }).filter(h => h.quantity > 0);
}

export default function Home() {
  const [holdings, setHoldings] = useState(starterHoldings);
  const [points, setPoints] = useState(chartSeed);
  const [range, setRange] = useState("1D");
  const [query, setQuery] = useState("");
  const [imported, setImported] = useState(false);
  const [connection, setConnection] = useState<"connecting" | "live" | "error">("error");
  const [connectionMessage, setConnectionMessage] = useState("Sample portfolio · illustrative prices");

  useEffect(() => {
    let active = true;
    const loadGroww = async () => {
      try {
        const response = await fetch("/api/groww", { cache: "no-store" });
        const data = await response.json() as { connected?: boolean; holdings?: Holding[]; fetchedAt?: string; error?: string };
        if (!active) return;
        if (!response.ok || !data.connected) throw new Error(data.error || "Groww connection failed");
        if (data.holdings?.length) setHoldings(data.holdings);
        setConnection("live");
        setConnectionMessage(`Groww live · ${new Date(data.fetchedAt || Date.now()).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`);
      } catch (error) {
        if (!active) return;
        setConnection("error");
        setConnectionMessage(error instanceof Error ? error.message : "Groww connection failed");
      }
    };
    if (process.env.NEXT_PUBLIC_ENABLE_GROWW !== "true") return;
    loadGroww();
    const refresh = window.setInterval(loadGroww, 15_000);
    return () => { active = false; window.clearInterval(refresh); };
  }, []);

  useEffect(() => {
    const ticker = window.setInterval(() => {
      setPoints(prev => {
        const latest = prev.at(-1)!;
        const next = Math.max(latest * .995, latest + (Math.random() - .46) * 280);
        return [...prev.slice(1), next];
      });
    }, 2400);
    return () => window.clearInterval(ticker);
  }, []);

  const totals = useMemo(() => {
    const invested = holdings.reduce((sum, h) => sum + h.quantity * h.avg, 0);
    const current = holdings.reduce((sum, h) => sum + h.quantity * h.price, 0);
    return { invested, current, gain: current - invested };
  }, [holdings]);

  const filtered = holdings.filter(h => `${h.symbol} ${h.name}`.toLowerCase().includes(query.toLowerCase()));

  const importFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result));
      if (parsed.length) {
        setHoldings(parsed);
        setImported(true);
      }
    };
    reader.readAsText(file);
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#" aria-label="Rupee Radar home"><span>R</span>Rupee Radar</a>
        <label className="search"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your holdings" /></label>
        <nav><button className="nav-active">Overview</button><button>Watchlist</button><button>Orders</button></nav>
        <button className="bell" aria-label="Notifications">●</button>
        <div className="avatar">AK</div>
      </header>

      <section className="shell">
        <div className="welcome-row">
          <div><p className="eyebrow">PORTFOLIO OVERVIEW</p><h1>Your portfolio, at a glance.</h1><p className="muted">Here’s how your investments are moving today.</p></div>
          <div className="actions"><span className={`connection ${connection}`}><i />{connectionMessage}</span><label className="import-button">↑ Import Groww CSV<input type="file" accept=".csv,text/csv" onChange={importFile} /></label></div>
        </div>

        {imported && <div className="import-note">Your Groww CSV is loaded locally in this browser. Nothing was uploaded.</div>}

        <section className="hero-card">
          <div className="hero-copy">
            <p className="label">Current value <span className="live-dot">{imported ? "IMPORTED" : connection === "live" ? "LIVE" : "DEMO"}</span></p>
            <h2>{money(totals.current)}</h2>
            <p className={totals.gain >= 0 ? "positive" : "negative"}>{totals.gain >= 0 ? "▲" : "▼"} {money(Math.abs(totals.gain))} <span>({((totals.gain / totals.invested) * 100 || 0).toFixed(2)}%) all time</span></p>
            <div className="stats"><div><span>Invested</span><strong>{money(totals.invested)}</strong></div><div><span>Today’s returns</span><strong className="positive">+₹1,248 <small>0.78%</small></strong></div></div>
          </div>
          <div className="chart-panel">
            <div className="range-tabs">{["1D","1W","1M","1Y","ALL"].map(r => <button key={r} onClick={() => setRange(r)} className={range === r ? "selected" : ""}>{r}</button>)}</div>
            <PriceChart points={points} />
            <div className="chart-times"><span>9:15</span><span>11:00</span><span>13:00</span><span>15:30</span></div>
          </div>
        </section>

        <section className="content-grid">
          <div className="holdings-card">
            <div className="section-title"><div><p className="eyebrow">YOUR ASSETS</p><h3>Holdings</h3></div><button>View all →</button></div>
            <div className="table-head"><span>Instrument</span><span>Qty · Avg.</span><span>Current</span><span>Returns</span></div>
            <div className="holding-list">
              {filtered.map((h, i) => {
                const ret = h.quantity * (h.price - h.avg);
                return <div className="holding-row" key={`${h.symbol}-${i}`}>
                  <div className="instrument"><span className={`coin coin-${i % 5}`}>{h.symbol.slice(0, 1)}</span><div><strong>{h.symbol}</strong><small>{h.name}</small></div></div>
                  <div><strong>{h.quantity}</strong><small>{money(h.avg)}</small></div>
                  <div><strong>{money(h.price)}</strong><small className={h.change >= 0 ? "positive" : "negative"}>{h.change >= 0 ? "+" : ""}{h.change.toFixed(2)}%</small></div>
                  <div><strong className={ret >= 0 ? "positive" : "negative"}>{ret >= 0 ? "+" : "-"}{money(Math.abs(ret))}</strong><small>{((ret / (h.quantity * h.avg)) * 100 || 0).toFixed(2)}%</small></div>
                </div>;
              })}
            </div>
          </div>

          <aside>
            <div className="allocation-card">
              <div className="section-title"><div><p className="eyebrow">DIVERSIFICATION</p><h3>Allocation</h3></div><button>•••</button></div>
              <div className="allocation-body">
                <div className="donut"><div><strong>5</strong><span>sectors</span></div></div>
                <div className="legend">
                  {[
                    ["Financials","32%"],["Energy","25%"],["Technology","20%"],["Automobile","14%"],["Consumer","9%"]
                  ].map((item, i) => <div key={item[0]}><i className={`dot dot-${i}`} /><span>{item[0]}</span><strong>{item[1]}</strong></div>)}
                </div>
              </div>
            </div>
            <div className="pulse-card">
              <p className="eyebrow">MARKET PULSE</p><h3>NIFTY 50</h3>
              <div className="index-row"><strong>24,834.85</strong><span className="positive">+0.63%</span></div>
              <div className="mini-bars">{[22,28,25,39,34,48,43,55,51,66,62,74,69,82].map((v,i)=><i key={i} style={{height:`${v}%`}} />)}</div>
              <p className="market-open"><i /> Market open · Closes in 2h 14m</p>
            </div>
          </aside>
        </section>
        <footer>Prices in this starter dashboard are illustrative. Import your Groww CSV to use your own holdings.</footer>
      </section>
    </main>
  );
}
