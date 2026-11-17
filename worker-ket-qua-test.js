// MÃ MẪU để THÊM vào Worker hiện có (lophoctiengnhat-api).
// Chưa được chạy thử trên Cloudflare thật. Hãy thử ở môi trường thử trước.
// Giả định: env.DB là cơ sở dữ liệu D1, tạo bảng bằng schema.sql.

const TESTS = new Set(["nhanh", "vocab", "gram", "read", "listen", "kanji"]);
const json = (o, s = 200, h = {}) =>
  new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...h } });

async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// POST /api/test-results  (công khai, không cần đăng nhập)
export async function submitTestResult(request, env, cors = {}) {
  let b;
  try { b = await request.json(); } catch { return json({ error: "Dữ liệu không hợp lệ" }, 400, cors); }
  const name = String(b.name || "").trim().slice(0, 80);
  const phone = String(b.phone || "").replace(/[\s.\-]/g, "");
  const email = String(b.email || "").trim().slice(0, 120);
  if (!name || !/^(\+?84|0)\d{9,10}$/.test(phone)) return json({ error: "Thiếu hoặc sai họ tên, số điện thoại" }, 400, cors);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Email không hợp lệ" }, 400, cors);
  if (!TESTS.has(b.test)) return json({ error: "Loại bài test không hợp lệ" }, 400, cors);
  const score = Number(b.score), total = Number(b.total);
  if (!Number.isInteger(score) || !Number.isInteger(total) || total < 1 || total > 100 || score < 0 || score > total)
    return json({ error: "Điểm không hợp lệ" }, 400, cors);
  const details = JSON.stringify(
    (Array.isArray(b.details) ? b.details : []).slice(0, 100).map((d) => ({
      n: Number(d.n) | 0, ok: !!d.ok,
      chosen: String(d.chosen ?? "").slice(0, 80), correct: String(d.correct ?? "").slice(0, 80),
    }))
  );
  // Giới hạn số lần gửi: tối đa 20 lần/giờ cho mỗi địa chỉ IP (IP được băm, không lưu nguyên)
  const iph = await sha((request.headers.get("CF-Connecting-IP") || "") + (env.IP_SALT || "takumi"));
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM test_results WHERE ip_hash = ? AND created_at > datetime('now','-1 hour')"
  ).bind(iph).first();
  if (recent && recent.c >= 20) return json({ error: "Gửi quá nhiều lần, vui lòng thử lại sau" }, 429, cors);

  await env.DB.prepare(
    "INSERT INTO test_results (name, phone, email, test, title, score, total, percent, rec, details, ip_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
  ).bind(name, phone, email, b.test, String(b.title || "").slice(0, 80), score, total,
         Math.round((score / total) * 100), String(b.rec || "").slice(0, 80), details, iph).run();

  try {
    await notifyAdmin(env, `Kết quả test mới: ${name} (${phone})`,
      `Họ tên: ${name}\nSĐT: ${phone}\nEmail: ${email || "-"}\nBài: ${b.title}\nĐiểm: ${score}/${total}`);
  } catch (e) { console.log("Lỗi gửi mail", e); }
  return json({ ok: true }, 201, cors);
}

// GET /api/test-results  (CHỈ cho người đã đăng nhập: bạn tự kiểm tra user trước khi gọi hàm này)
export async function listTestResults(env, cors = {}) {
  const { results } = await env.DB.prepare(
    "SELECT id, created_at, name, phone, email, test, title, score, total, percent, rec, details FROM test_results ORDER BY id DESC LIMIT 200"
  ).all();
  return json({ results: results.map((r) => ({ ...r, details: JSON.parse(r.details || "[]") })) }, 200, cors);
}

// Gửi email báo cho admin (tùy chọn). Cần đặt: RESEND_API_KEY, ADMIN_EMAIL (và MAIL_FROM nếu có tên miền riêng).
async function notifyAdmin(env, subject, text) {
  if (!env.RESEND_API_KEY || !env.ADMIN_EMAIL) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM || "onboarding@resend.dev", to: [env.ADMIN_EMAIL], subject, text }),
  });
}

/* ---- Nối vào bộ định tuyến hiện có của bạn (ví dụ) ----
if (url.pathname === "/api/test-results" && request.method === "POST")
  return submitTestResult(request, env, corsHeaders);
if (url.pathname === "/api/test-results" && request.method === "GET") {
  const user = await <HÀM XÁC THỰC HIỆN CÓ CỦA BẠN>(request, env);   // trả về null nếu chưa đăng nhập
  if (!user) return json({ error: "Chưa đăng nhập" }, 401, corsHeaders);
  return listTestResults(env, corsHeaders);
}
Lưu ý CORS: cho phép phương thức GET, POST, OPTIONS và các header Content-Type, Authorization từ địa chỉ trang công khai.
*/
