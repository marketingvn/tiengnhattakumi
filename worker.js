const corsHeaders = {
  "Access-Control-Allow-Origin": "https://lophoctiengnhat.haivouel.workers.dev",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Bootstrap-Secret",
  "Access-Control-Max-Age": "86400"
};

function json(data, status = 200, requestOrigin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

const encoder = new TextEncoder();
const TESTS = new Set(["nhanh", "vocab", "gram", "read", "listen", "kanji"]);

function bytesToHex(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(value) {
  return bytesToHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2", salt: encoder.encode(salt), iterations: 100000, hash: "SHA-256"
  }, key, 256);
  return bytesToHex(bits);
}

async function makePassword(password) {
  const salt = crypto.randomUUID();
  return salt + ":" + await passwordHash(password, salt);
}

async function verifyPassword(password, stored) {
  const parts = String(stored || "").split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  return (await passwordHash(password, parts[0])) === parts[1];
}

function getToken(request) {
  const header = request.headers.get("Authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

async function currentUser(request, env) {
  const token = getToken(request);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = Math.floor(Date.now() / 1000);
  return env.DB.prepare(`
    SELECT teachers.id, teachers.username, teachers.full_name, teachers.role, teachers.status
    FROM sessions
    JOIN teachers ON teachers.id = sessions.teacher_id
    WHERE sessions.id = ? AND sessions.expires_at > ? AND teachers.status = 'active'
  `).bind(tokenHash, now).first();
}

async function currentStudent(request, env) {
  const token = getToken(request); if (!token) return null;
  const hash = await sha256(token), now = Math.floor(Date.now()/1000);
  return env.DB.prepare("SELECT a.id, a.student_ref, a.username, a.full_name, a.status FROM student_sessions s JOIN student_accounts a ON a.id=s.student_account_id WHERE s.id=? AND s.expires_at>? AND a.status='active'").bind(hash,now).first();
}
function requireAdmin(user) {
  return !!user && user.role === "admin";
}

function validUsername(username) {
  return /^[a-zA-Z0-9_.-]{4,40}$/.test(username);
}

function normalizePhone(value) {
  return String(value || "").replace(/[\s.()-]/g, "");
}

function validPhone(phone) {
  return /^(\+?84|0)\d{9,10}$/.test(phone);
}

async function readBody(request) {
  try {
    const declared = Number(request.headers.get("Content-Length") || 0);
    if (declared > 500000) return null;
    const raw = await request.text();
    if (!raw || raw.length > 500000) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function cleanDetails(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).map((d, i) => ({
    n: Number.isInteger(Number(d?.n)) ? Number(d.n) : i + 1,
    ok: !!d?.ok,
    chosen: String(d?.chosen ?? "").slice(0, 120),
    correct: String(d?.correct ?? "").slice(0, 120)
  }));
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (!env.DB) {
      return json({ error: "Thiếu D1 Database Binding.", detail: "Binding phải có tên DB." }, 500, origin);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/health" && request.method === "GET") {
        const result = await env.DB.prepare("SELECT 1 AS connected").first();
        return json({ ok: true, database: result?.connected === 1 ? "connected" : "error" }, 200, origin);
      }

      // Chỉ tạo được admin đầu tiên khi chưa tồn tại tài khoản admin.
      if (path === "/api/setup" && request.method === "POST") {
        if (!env.BOOTSTRAP_SECRET) {
          return json({ error: "Chưa cấu hình BOOTSTRAP_SECRET trong Worker Secrets." }, 500, origin);
        }
        const supplied = request.headers.get("X-Bootstrap-Secret") || "";
        if (supplied !== env.BOOTSTRAP_SECRET) return json({ error: "BOOTSTRAP_SECRET không chính xác." }, 403, origin);

        const existing = await env.DB.prepare("SELECT id FROM teachers WHERE role = 'admin' LIMIT 1").first();
        if (existing) return json({ error: "Tài khoản quản trị đã được tạo." }, 409, origin);

        const body = await readBody(request);
        if (!body) return json({ error: "Dữ liệu gửi lên không hợp lệ." }, 400, origin);
        const username = String(body.username || "").trim();
        const password = String(body.password || "");
        const fullName = String(body.full_name || "").trim();
        if (!validUsername(username)) return json({ error: "Tên đăng nhập phải từ 4 đến 40 ký tự, chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang." }, 400, origin);
        if (password.length < 12) return json({ error: "Mật khẩu phải có ít nhất 12 ký tự." }, 400, origin);
        if (!fullName) return json({ error: "Vui lòng nhập họ tên quản trị viên." }, 400, origin);

        const id = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO teachers (id, username, password_hash, full_name, role, status)
          VALUES (?, ?, ?, ?, 'admin', 'active')
        `).bind(id, username, await makePassword(password), fullName).run();
        return json({ ok: true, message: "Đã tạo tài khoản quản trị thành công.", username }, 201, origin);
      }

      if (path === "/api/student/login" && request.method === "POST") {
        const body=await readBody(request); if(!body) return json({error:"Thông tin đăng nhập không hợp lệ."},400,origin);
        const username=String(body.username||"").trim(), password=String(body.password||"");
        const student=await env.DB.prepare("SELECT * FROM student_accounts WHERE username=?").bind(username).first();
        if(!student || student.status!=="active" || !(await verifyPassword(password,student.password_hash))) return json({error:"Tên đăng nhập hoặc mật khẩu không đúng."},401,origin);
        const token=crypto.randomUUID()+crypto.randomUUID(), hash=await sha256(token), expires=Math.floor(Date.now()/1000)+43200;
        await env.DB.prepare("INSERT INTO student_sessions(id,student_account_id,expires_at) VALUES(?,?,?)").bind(hash,student.id,expires).run();
        return json({ok:true,token,expires_at:expires,student:{full_name:student.full_name,username:student.username}},200,origin);
      }
      if (path === "/api/student/attendance" && request.method === "GET") {
        const student=await currentStudent(request,env); if(!student) return json({error:"Phiên học viên đã hết hạn. Vui lòng đăng nhập lại."},401,origin);
        const row=await env.DB.prepare("SELECT payload FROM app_state WHERE state_key='att'").first(); let all=[]; try{all=row?.payload?JSON.parse(row.payload):[]}catch{}
        if(!Array.isArray(all)) all=[];
        const attendance=all.filter(x=>String(x.studentId)===String(student.student_ref) && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date||"")) && ["present","absent"].includes(x.status)).map(x=>({date:x.date,status:x.status}));
        return json({student:{full_name:student.full_name,username:student.username},attendance},200,origin);
      }
      if (path === "/api/student/logout" && request.method === "POST") {
        const token=getToken(request); if(token) await env.DB.prepare("DELETE FROM student_sessions WHERE id=?").bind(await sha256(token)).run();
        return json({ok:true},200,origin);
      }
      if (path === "/api/students" && request.method === "GET") {
        const user=await currentUser(request,env); if(!user) return json({error:"Cần đăng nhập tài khoản giáo viên."},401,origin);
        const result=await env.DB.prepare("SELECT student_ref,username,full_name,status,created_at FROM student_accounts ORDER BY created_at DESC").all();
        return json({students:result.results||[]},200,origin);
      }
      if (path === "/api/students" && request.method === "POST") {
        const user=await currentUser(request,env); if(!requireAdmin(user)) return json({error:"Chỉ Admin được tạo tài khoản học viên."},403,origin);
        const body=await readBody(request); if(!body) return json({error:"Dữ liệu không hợp lệ."},400,origin);
        const ref=String(body.student_ref||"").trim(), username=String(body.username||"").trim(), password=String(body.password||"");
        if(!ref || !validUsername(username) || password.length<12) return json({error:"Vui lòng nhập mã học viên, tên đăng nhập hợp lệ và mật khẩu ít nhất 12 ký tự."},400,origin);
        const state=await env.DB.prepare("SELECT payload FROM app_state WHERE state_key='sts'").first(); let list=[]; try{list=state?.payload?JSON.parse(state.payload):[]}catch{}
        const record=Array.isArray(list)?list.find(x=>String(x.id)===ref):null; if(!record) return json({error:"Không tìm thấy học viên. Hãy đồng bộ danh sách học viên trước."},404,origin);
        const id=crypto.randomUUID(), fullName=String(record.name||"Học viên").slice(0,100), hash=await makePassword(password);
        await env.DB.prepare("INSERT INTO student_accounts(id,student_ref,username,password_hash,full_name,status) VALUES(?,?,?,?,?,'active') ON CONFLICT(student_ref) DO UPDATE SET username=excluded.username,password_hash=excluded.password_hash,full_name=excluded.full_name,status='active'").bind(id,ref,username,hash,fullName).run();
        return json({ok:true,message:"Đã tạo hoặc cập nhật tài khoản học viên."},201,origin);
      }

      if (path === "/api/login" && request.method === "POST") {
        const body = await readBody(request);
        if (!body) return json({ error: "Dữ liệu đăng nhập không hợp lệ." }, 400, origin);
        const username = String(body.username || "").trim();
        const password = String(body.password || "");
        const user = await env.DB.prepare("SELECT * FROM teachers WHERE username = ?").bind(username).first();

        if (!user || user.status !== "active" || !(await verifyPassword(password, user.password_hash))) {
          return json({ error: "Tên đăng nhập hoặc mật khẩu không đúng." }, 401, origin);
        }

        const token = crypto.randomUUID() + crypto.randomUUID();
        const tokenHash = await sha256(token);
        const expires = Math.floor(Date.now() / 1000) + 43200;
        await env.DB.prepare("INSERT INTO sessions (id, teacher_id, expires_at) VALUES (?, ?, ?)")
          .bind(tokenHash, user.id, expires).run();

        return json({
          ok: true, token, expires_at: expires,
          user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role }
        }, 200, origin);
      }

      if (path === "/api/me" && request.method === "GET") {
        const user = await currentUser(request, env);
        if (!user) return json({ error: "Chưa đăng nhập hoặc phiên đã hết hạn." }, 401, origin);
        return json({ user }, 200, origin);
      }

      // Dữ liệu quản trị dùng chung giữa mọi giáo viên và thiết bị.
      if (path === "/api/public/lessons" && request.method === "GET") {
        const row = await env.DB.prepare("SELECT payload FROM app_state WHERE state_key = 'lessons'").first();
        let lessons = [];
        try { lessons = row?.payload ? JSON.parse(row.payload) : []; } catch { lessons = []; }
        if (!Array.isArray(lessons)) lessons = [];
        return json({ lessons: lessons.filter(item => item && typeof item.title === "string" && typeof item.videoId === "string") }, 200, origin);
      }

      if (path === "/api/state" && request.method === "GET") {
        const user = await currentUser(request, env);
        if (!user) return json({ error: "Bạn cần đăng nhập để đồng bộ dữ liệu." }, 401, origin);
        const result = await env.DB.prepare(
          "SELECT state_key, payload, revision, updated_at, updated_by FROM app_state ORDER BY state_key"
        ).all();
        const state = {}, revisions = {}, metadata = {};
        for (const row of (result.results || [])) {
          try { state[row.state_key] = JSON.parse(row.payload); } catch { state[row.state_key] = []; }
          revisions[row.state_key] = Number(row.revision) || 1;
          metadata[row.state_key] = { updated_at: row.updated_at, updated_by: row.updated_by };
        }
        return json({ state, revisions, metadata }, 200, origin);
      }

      const stateMatch = path.match(/^\/api\/state\/([a-z]+)$/);
      if (stateMatch && request.method === "PUT") {
        const user = await currentUser(request, env);
        if (!user) return json({ error: "Bạn cần đăng nhập để lưu dữ liệu." }, 401, origin);
        const key = stateMatch[1];
        const allowed = new Set(["cls", "cl", "sts", "jr", "mine", "leads", "att", "lessons"]);
        if (!allowed.has(key)) return json({ error: "Nhóm dữ liệu không hợp lệ." }, 404, origin);
        const body = await readBody(request);
        if (!body || !Array.isArray(body.data)) return json({ error: "Dữ liệu phải là một danh sách hợp lệ." }, 400, origin);
        const payload = JSON.stringify(body.data);
        if (payload.length > 400000) return json({ error: "Dữ liệu quá lớn. Vui lòng chia nhỏ hoặc dọn dữ liệu cũ." }, 413, origin);
        const expected = body.revision;
        let result;
        if (expected === null || expected === undefined) {
          result = await env.DB.prepare(
            "INSERT INTO app_state (state_key, payload, revision, updated_by, updated_at) VALUES (?, ?, 1, ?, datetime('now')) ON CONFLICT(state_key) DO NOTHING"
          ).bind(key, payload, user.id).run();
          if (!result.meta?.changes) {
            const current = await env.DB.prepare("SELECT revision, updated_at FROM app_state WHERE state_key = ?").bind(key).first();
            return json({ error: "Có dữ liệu mới hơn trên máy chủ. Không thể ghi đè thay đổi của giáo viên khác.", conflict: true, revision: current?.revision || 1, updated_at: current?.updated_at || null }, 409, origin);
          }
          return json({ ok: true, key, revision: 1 }, 200, origin);
        }
        const revision = Number(expected);
        if (!Number.isInteger(revision) || revision < 1) return json({ error: "Phiên bản dữ liệu không hợp lệ." }, 400, origin);
        result = await env.DB.prepare(
          "UPDATE app_state SET payload = ?, revision = revision + 1, updated_by = ?, updated_at = datetime('now') WHERE state_key = ? AND revision = ?"
        ).bind(payload, user.id, key, revision).run();
        if (!result.meta?.changes) {
          const current = await env.DB.prepare("SELECT revision, updated_at FROM app_state WHERE state_key = ?").bind(key).first();
          return json({ error: "Có dữ liệu mới hơn trên máy chủ. Hệ thống đã chặn ghi đè để bảo vệ dữ liệu.", conflict: true, revision: current?.revision || null, updated_at: current?.updated_at || null }, 409, origin);
        }
        return json({ ok: true, key, revision: revision + 1 }, 200, origin);
      }

      if (path === "/api/logout" && request.method === "POST") {
        const token = getToken(request);
        if (token) await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256(token)).run();
        return json({ ok: true }, 200, origin);
      }

      // Học viên gửi đăng ký từ trang công khai. Không yêu cầu đăng nhập.
      if (path === "/api/registrations" && request.method === "POST") {
        const body = await readBody(request);
        if (!body) return json({ error: "Dữ liệu đăng ký không hợp lệ." }, 400, origin);
        const name = String(body.name || "").trim().slice(0, 80);
        const phone = normalizePhone(body.phone);
        const level = String(body.level || "").trim().slice(0, 80);
        const interestedClass = String(body.cls || body.interested_class || "").trim().slice(0, 120);
        const goal = String(body.goal || "").trim().slice(0, 500);

        if (!name || !validPhone(phone) || !level) {
          return json({ error: "Vui lòng nhập họ tên, số điện thoại hợp lệ và trình độ hiện tại." }, 400, origin);
        }

        const id = crypto.randomUUID();
        // Tự nhận diện cột để tương thích D1 đã tạo theo schema cũ hoặc mới.
        const tableInfo = await env.DB.prepare("PRAGMA table_info(registrations)").all();
        const available = new Set((tableInfo.results || []).map(column => column.name));
        const values = { id, full_name: name, phone, course: level, note: goal, status: "new", name, level, interested_class: interestedClass, goal };
        const columns = Object.keys(values).filter(column => available.has(column));
        if (!columns.includes("id") || !columns.includes("phone")) {
          return json({ error: "Cấu trúc bảng đăng ký học thử chưa đầy đủ. Vui lòng kiểm tra D1." }, 500, origin);
        }
        const placeholders = columns.map(() => "?").join(", ");
        await env.DB.prepare(`INSERT INTO registrations (${columns.join(", ")}) VALUES (${placeholders})`)
          .bind(...columns.map(column => values[column])).run();

        return json({ ok: true, id, message: "Đã nhận đăng ký học thử." }, 201, origin);
      }

      // Danh sách đăng ký chỉ dành cho tài khoản đã đăng nhập.
      if (path === "/api/registrations" && request.method === "GET") {
        const user = await currentUser(request, env);
        if (!user) return json({ error: "Bạn cần đăng nhập để xem danh sách đăng ký." }, 401, origin);
        const tableInfo = await env.DB.prepare("PRAGMA table_info(registrations)").all();
        const available = new Set((tableInfo.results || []).map(column => column.name));
        const nameColumn = available.has("name") ? "name" : (available.has("full_name") ? "full_name" : "''");
        const levelColumn = available.has("level") ? "level" : (available.has("course") ? "course" : "''");
        const classColumn = available.has("interested_class") ? "interested_class" : "''";
        const goalColumn = available.has("goal") ? "goal" : (available.has("note") ? "note" : "''");
        const createdColumn = available.has("created_at") ? "created_at" : "''";
        const result = await env.DB.prepare(`
          SELECT id, ${nameColumn} AS name, phone, ${levelColumn} AS level,
                 ${classColumn} AS interested_class, ${goalColumn} AS goal,
                 ${createdColumn} AS created_at
          FROM registrations ORDER BY ${createdColumn} DESC LIMIT 300
        `).all();
        return json({ registrations: result.results || [] }, 200, origin);
      }

      // Kết quả kiểm tra được gửi công khai từ trang làm bài.
      if (path === "/api/test-results" && request.method === "POST") {
        const body = await readBody(request);
        if (!body) return json({ error: "Dữ liệu kết quả không hợp lệ." }, 400, origin);

        const name = String(body.name || "").trim().slice(0, 80);
        const phone = normalizePhone(body.phone);
        const email = String(body.email || "").trim().slice(0, 120);
        const test = String(body.test || "");
        const title = String(body.title || "").trim().slice(0, 120);
        const score = Number(body.score);
        const total = Number(body.total);

        if (!name || !validPhone(phone)) return json({ error: "Thiếu hoặc sai họ tên, số điện thoại." }, 400, origin);
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Email không hợp lệ." }, 400, origin);
        if (!TESTS.has(test)) return json({ error: "Loại bài kiểm tra không hợp lệ." }, 400, origin);
        if (!Number.isInteger(score) || !Number.isInteger(total) || total < 1 || total > 100 || score < 0 || score > total) {
          return json({ error: "Điểm số không hợp lệ." }, 400, origin);
        }

        const details = JSON.stringify(cleanDetails(body.details));
        const ip = request.headers.get("CF-Connecting-IP") || "";
        const ipHash = await sha256(ip + (env.IP_SALT || "takumi-default-salt"));
        const recent = await env.DB.prepare(`
          SELECT COUNT(*) AS count FROM test_results
          WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')
        `).bind(ipHash).first();
        if (recent && recent.count >= 20) return json({ error: "Bạn đã gửi quá nhiều kết quả. Vui lòng thử lại sau." }, 429, origin);

        const rec = String(body.rec || "").trim().slice(0, 120);
        const result = await env.DB.prepare(`
          INSERT INTO test_results (name, phone, email, test, title, score, total, percent, rec, details, ip_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(name, phone, email || null, test, title, score, total, Math.round(score / total * 100), rec, details, ipHash).run();

        return json({ ok: true, id: result.meta?.last_row_id || null, message: "Đã lưu kết quả kiểm tra." }, 201, origin);
      }

      // Kết quả kiểm tra chỉ hiển thị sau khi đăng nhập.
      if (path === "/api/test-results" && request.method === "GET") {
        const user = await currentUser(request, env);
        if (!user) return json({ error: "Bạn cần đăng nhập để xem kết quả." }, 401, origin);
        const result = await env.DB.prepare(`
          SELECT id, created_at, name, phone, email, test, title, score, total, percent, rec, details
          FROM test_results ORDER BY id DESC LIMIT 200
        `).all();
        const rows = (result.results || []).map(row => {
          let details = [];
          try { details = JSON.parse(row.details || "[]"); } catch {}
          return { ...row, details };
        });
        return json({ results: rows }, 200, origin);
      }

      if (path === "/api/teachers" && request.method === "GET") {
        const user = await currentUser(request, env);
        if (!requireAdmin(user)) return json({ error: "Bạn không có quyền quản trị." }, 403, origin);
        const result = await env.DB.prepare(`
          SELECT id, username, full_name, role, status, created_at
          FROM teachers ORDER BY created_at DESC
        `).all();
        return json({ teachers: result.results || [] }, 200, origin);
      }

      if (path === "/api/teachers" && request.method === "POST") {
        const user = await currentUser(request, env);
        if (!requireAdmin(user)) return json({ error: "Bạn không có quyền quản trị." }, 403, origin);
        const body = await readBody(request);
        if (!body) return json({ error: "Dữ liệu không hợp lệ." }, 400, origin);
        const username = String(body.username || "").trim();
        const password = String(body.password || "");
        const fullName = String(body.full_name || "").trim();
        if (!validUsername(username) || password.length < 12 || !fullName) {
          return json({ error: "Tên đăng nhập tối thiểu 4 ký tự, mật khẩu tối thiểu 12 ký tự và cần họ tên." }, 400, origin);
        }
        const id = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO teachers (id, username, password_hash, full_name, role, status)
          VALUES (?, ?, ?, ?, 'teacher', 'active')
        `).bind(id, username, await makePassword(password), fullName).run();
        return json({ ok: true, id, message: "Đã tạo tài khoản giáo viên." }, 201, origin);
      }

      const teacherMatch = path.match(/^\/api\/teachers\/([^/]+)\/status$/);
      if (teacherMatch && request.method === "PATCH") {
        const user = await currentUser(request, env);
        if (!requireAdmin(user)) return json({ error: "Bạn không có quyền quản trị." }, 403, origin);
        const body = await readBody(request);
        const status = body?.status;
        if (!["active", "locked"].includes(status)) return json({ error: "Trạng thái không hợp lệ." }, 400, origin);
        await env.DB.prepare("UPDATE teachers SET status = ? WHERE id = ? AND role = 'teacher'")
          .bind(status, teacherMatch[1]).run();
        if (status === "locked") {
          await env.DB.prepare("DELETE FROM sessions WHERE teacher_id = ?").bind(teacherMatch[1]).run();
        }
        return json({ ok: true, message: "Đã cập nhật trạng thái tài khoản." }, 200, origin);
      }

      return json({ error: "Không tìm thấy API.", path }, 404, origin);
    } catch (error) {
      console.error("API ERROR:", error);
      const message = String(error?.message || error);
      if (message.includes("UNIQUE")) return json({ error: "Tên đăng nhập đã tồn tại hoặc dữ liệu bị trùng." }, 409, origin);
      return json({ error: "Có lỗi khi xử lý yêu cầu. Vui lòng thử lại hoặc liên hệ quản trị viên." }, 500, origin);
    }
  }
};
