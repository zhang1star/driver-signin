/**
 * api.js — Supabase 数据层
 * 部署前请将 SUPABASE_URL 和 SUPABASE_ANON_KEY 替换为你的实际值
 * 获取方式：Supabase 控制台 → Project Settings → API
 */

// ── 配置区（部署前必填）────────────────────────────────────
const SUPABASE_URL      = 'https://ytizvfczjcjgqavxuoku.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0aXp2ZmN6amNqZ3Fhdnh1b2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDkwMDksImV4cCI6MjA5MTY4NTAwOX0.4vGHG67fvWYptrE0Xy_HQwHpJLNTbttgi4KRAAcMfPs';
const TABLE             = 'driver_records';
const ADMIN_PASSWORD    = '1234';                    // 管理员密码，可自行修改
// ──────────────────────────────────────────────────────────

/** 通用请求封装 */
async function sbFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        options.prefer || '',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** 格式化时间 */
function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} `
       + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 计算在场时长 */
function duration(inIso, outIso) {
  const end  = outIso ? new Date(outIso) : new Date();
  const mins = Math.floor((end - new Date(inIso)) / 60000);
  if (mins < 60) return `${mins} 分钟`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h} 小时 ${m} 分钟` : `${h} 小时`;
}

/** 公司徽标 */
const COMPANY_COLOR = { '中通':'#f97316','月祥':'#8b5cf6','自有':'#0ea5e9','货拉拉':'#ec4899' };
function companyBadge(company) {
  const c = COMPANY_COLOR[company] || '#64748b';
  return `<span class="rc-badge" style="background:${c}22;color:${c}">${company}</span>`;
}

/** ── API 方法 ─────────────────────────────────────────── */
const API = {

  /** 签到：新增记录 */
  async checkIn({ name, plate, phone, company }) {
    return sbFetch(`${TABLE}?select=*`, {
      method: 'POST',
      prefer: 'return=representation',
      body: JSON.stringify({
        name: name.trim(),
        plate: plate.trim().toUpperCase(),
        phone: phone.trim(),
        company,
      }),
    }).then(rows => rows[0]);
  },

  /** 查询当前在场（未签退）车辆 */
  async onSite() {
    return sbFetch(`${TABLE}?select=*&out_time=is.null&order=in_time.desc`);
  },

  /** 按车牌/姓名模糊搜索在场车辆 */
  async searchOnSite(keyword) {
    const kw = keyword.trim().toUpperCase();
    if (!kw) return this.onSite();
    return sbFetch(
      `${TABLE}?select=*&out_time=is.null&or=(plate.ilike.*${kw}*,name.ilike.*${kw}*)&order=in_time.desc`
    );
  },

  /** 签退：更新 out_time */
  async checkOut(id) {
    return sbFetch(`${TABLE}?id=eq.${id}&select=*`, {
      method: 'PATCH',
      prefer: 'return=representation',
      body: JSON.stringify({ out_time: new Date().toISOString() }),
    }).then(rows => rows[0]);
  },

  /** 管理后台：查询全部记录（支持筛选） */
  async all({ company = '', date = '', tab = 'all' } = {}) {
    let q = `${TABLE}?select=*&order=in_time.desc`;
    if (tab === 'onsite') q += '&out_time=is.null';
    if (tab === 'done')   q += '&out_time=not.is.null';
    if (company) q += `&company=eq.${encodeURIComponent(company)}`;
    if (date)    q += `&in_time=gte.${date}T00:00:00&in_time=lte.${date}T23:59:59`;
    return sbFetch(q);
  },

  /** 统计数据 */
  async stats() {
    const today = new Date().toISOString().slice(0, 10);
    const [all, onsite, todayList] = await Promise.all([
      sbFetch(`${TABLE}?select=id`),
      sbFetch(`${TABLE}?select=id&out_time=is.null`),
      sbFetch(`${TABLE}?select=id&in_time=gte.${today}T00:00:00`),
    ]);
    return {
      total:  all.length,
      onsite: onsite.length,
      today:  todayList.length,
    };
  },
};
