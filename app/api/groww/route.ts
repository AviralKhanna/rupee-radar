export const dynamic = "force-dynamic";

type GrowwHolding = {
  trading_symbol: string;
  quantity: number;
  average_price: number;
};

let cachedToken: { value: string; expiresAt: number } | undefined;

const headersFor = (token: string) => ({
  Accept: "application/json",
  Authorization: `Bearer ${token}`,
  "X-API-VERSION": "1.0",
});

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function getAccessToken(apiKey: string, secret: string) {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const checksum = await sha256(secret + timestamp);
  const response = await fetch("https://api.groww.in/v1/token/api/access", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ key_type: "approval", checksum, timestamp }),
    cache: "no-store",
  });
  const body = await response.json() as { token?: string; error?: { message?: string } };
  if (!response.ok || !body.token) throw new Error(body.error?.message || `Authentication failed (${response.status})`);
  cachedToken = { value: body.token, expiresAt: Date.now() + 20 * 60 * 60 * 1000 };
  return body.token;
}

function getLtp(payload: unknown, symbol: string) {
  const data = payload as Record<string, unknown>;
  const candidates = [
    data[`NSE_${symbol}`],
    (data.payload as Record<string, unknown> | undefined)?.[`NSE_${symbol}`],
    (data.payload as Record<string, unknown> | undefined)?.[symbol],
  ];
  for (const value of candidates) {
    if (typeof value === "number") return value;
    if (value && typeof value === "object" && typeof (value as { ltp?: unknown }).ltp === "number") return (value as { ltp: number }).ltp;
  }
  return undefined;
}

export async function GET() {
  if (process.env.ENABLE_PRIVATE_GROWW !== "true") return Response.json({ connected: false, error: "Live account access is disabled on this public demo." }, { status: 403 });
  try {
    const apiKey = process.env.GROWW_API_KEY;
    const secret = process.env.GROWW_API_SECRET;
    if (!apiKey || !secret) return Response.json({ connected: false, error: "Groww credentials are not configured." }, { status: 503 });

    let token: string;
    try {
      token = await getAccessToken(apiKey, secret);
    } catch {
      // Some Groww test credentials are already bearer tokens. The read-only
      // request below safely verifies that format without invoking trade APIs.
      token = apiKey;
    }
    let holdingsResponse = await fetch("https://api.groww.in/v1/holdings/user", { headers: headersFor(token), cache: "no-store" });
    if (!holdingsResponse.ok && token !== apiKey) {
      holdingsResponse = await fetch("https://api.groww.in/v1/holdings/user", { headers: headersFor(apiKey), cache: "no-store" });
    }
    const holdingsBody = await holdingsResponse.json() as {
      status?: string;
      payload?: { holdings?: GrowwHolding[] };
      error?: { message?: string };
    };
    const holdingsAllowed = holdingsResponse.ok && holdingsBody.status === "SUCCESS";
    const holdings = holdingsAllowed ? holdingsBody.payload?.holdings || [] : [];
    const fallbackSymbols = ["RELIANCE", "HDFCBANK", "INFY", "TATAMOTORS", "ITC"];
    const priceSymbols = holdings.length ? holdings.slice(0, 50).map(h => h.trading_symbol) : fallbackSymbols;
    let ltpBody: unknown = {};
    const symbols = priceSymbols.map(symbol => `NSE_${symbol}`).join(",");
    const ltpResponse = await fetch(`https://api.groww.in/v1/live-data/ltp?segment=CASH&exchange_symbols=${encodeURIComponent(symbols)}`, {
      headers: headersFor(token),
      cache: "no-store",
    });
    ltpBody = await ltpResponse.json();
    if (!ltpResponse.ok) {
      const ltpError = ltpBody as { error?: { message?: string } };
      throw new Error(`Live data: ${ltpError.error?.message || `request failed (${ltpResponse.status})`}; Holdings: ${holdingsBody.error?.message || "not available"}`);
    }

    return Response.json({
      connected: true,
      mode: holdingsAllowed ? "portfolio-and-live" : "live-only",
      warning: holdingsAllowed ? undefined : holdingsBody.error?.message || "Portfolio holdings permission is unavailable.",
      fetchedAt: new Date().toISOString(),
      holdings: holdings.map(h => ({
        symbol: h.trading_symbol,
        name: h.trading_symbol,
        quantity: Number(h.quantity),
        avg: Number(h.average_price),
        price: getLtp(ltpBody, h.trading_symbol) ?? Number(h.average_price),
        change: 0,
        sector: "Groww holding",
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Groww read-only connection]", error instanceof Error ? error.message : "Unknown error");
    return Response.json({
      connected: false,
      error: error instanceof Error ? error.message : "Unable to connect to Groww.",
    }, { status: 502 });
  }
}
