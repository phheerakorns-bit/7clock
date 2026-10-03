// ตรวจให้แน่ใจว่าเป็น Supabase project เดียวกับที่เปิดดูตาราง products อยู่
const SUPABASE_URL = 'https://htxwjotjnucxnrdppoca.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gcQfRrMYqhJf1eFELFLkKw_QLUdRd8l';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);

  // ==========================================
  // ส่วนหน้าแสดงสินค้า
  // ==========================================
  const productList = document.getElementById('product-list');
  const LOW_STOCK_THRESHOLD = 3;

  // แปลงชื่อหมวดจากทุกรูปแบบให้เป็นค่ามาตรฐานที่ปุ่มกรองใช้
  const MOOD_ALIAS = {
    classic: 'classic', seamless: 'classic',
    minimal: 'minimal', cotton: 'minimal',
    sport: 'sport',
    luxury: 'luxury',   lounge: 'luxury',
  };
  const MOOD_LABEL = {
    classic: 'Classic', minimal: 'Minimal', sport: 'Sport', luxury: 'Luxury',
  };

  // ทำชื่อให้เทียบกันได้ (ตัด "7CLOCK" นำหน้า, ตัดช่องว่าง/อักขระพิเศษ)
  const nameKey = (v) =>
    String(v ?? '').toLowerCase()
      .replace(/^7clock\s*/, '')
      .replace(/[^a-z0-9ก-๙]/g, '');

  const isUrl = (s) => /^(https?:)?\/\//i.test(s) || /^data:image\//i.test(s);

  function renderProducts(products, filter) {
    const filtered = filter === 'all' ? products : products.filter(p => p.mood === filter);

    if (filtered.length === 0) {
      productList.innerHTML =
        '<p class="empty-state">ยังไม่มีสินค้าในหมวดนี้</p>';
      return;
    }

    productList.innerHTML = filtered.map(p => {
      const stock = p.stock === undefined || p.stock === null ? NaN : Number(p.stock);
      const hasStock = Number.isFinite(stock);
      const soldOut = hasStock && stock <= 0;
      const low = hasStock && stock > 0 && stock <= LOW_STOCK_THRESHOLD;

      const stockLabel = soldOut
        ? '<p class="stock-out">สินค้าหมด</p>'
        : low
        ? `<p class="stock-low">เหลือเพียง ${esc(stock)} ชิ้น</p>`
        : '';

      const button = soldOut
        ? '<span class="btn btn-disabled">สินค้าหมด</span>'
        : `<a href="order.html?item=${encodeURIComponent(p.name)}&price=${encodeURIComponent(p.price)}"
             class="btn">สั่งซื้อสินค้า</a>`;

      return `
        <div class="card">
          <span class="card-tag tag-${esc(p.mood)}">${esc(MOOD_LABEL[p.mood] || p.mood)}</span>
          <img src="${esc(p.image)}" data-fallback="${esc(p.fallbackImage || '')}"
               alt="${esc(p.name)}" loading="lazy">
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.description)}</p>
          <div class="price">฿${esc(Number(p.price).toLocaleString('th-TH'))}</div>
          ${stockLabel}
          ${button}
        </div>
      `;
    }).join('');
  }

  async function loadProducts() {
    // 1) โหลดข้อมูลหลัก (รูป หมวด คำอธิบาย) จาก products.json
    let local = [];
    try {
      const res = await fetch('products.json');
      if (res.ok) local = await res.json();
    } catch (e) {
      console.warn('โหลด products.json ไม่สำเร็จ', e);
    }

    // 2) โหลดราคา/สต๊อกจาก Supabase
    const { data, error } = await sb
      .from('products')
      .select('*')
      .order('id', { ascending: true });

    // เปิด F12 > Console เพื่อดูว่า Supabase ส่งอะไรกลับมา
    console.log('Supabase products:', data, error);

    const normalize = (p) => ({
      ...p,
      mood: MOOD_ALIAS[String(p.mood ?? '').trim().toLowerCase()] || p.mood,
    });

    // ถ้า Supabase ใช้ไม่ได้ ให้ใช้ JSON ล้วน
    if (error || !data || data.length === 0) {
      if (local.length === 0) throw new Error('โหลดสินค้าไม่สำเร็จ');
      return local.map(normalize);
    }

    // 3) รวมข้อมูล: จับคู่ด้วยชื่อ (ไม่สนคำว่า 7CLOCK) หรือ id
    const localByName = new Map(local.map(p => [nameKey(p.name), p]));
    const localById = new Map(local.map(p => [String(p.id), p]));

    return data.map(row => {
      const base = localByName.get(nameKey(row.name)) || localById.get(String(row.id)) || {};
      const clean = Object.fromEntries(
        Object.entries(row).filter(([, v]) => v !== null && v !== '')
      );
      const merged = { ...base, ...clean };

      // รูป: ใช้รูปจาก products.json (images/watch-N.svg) ก่อนเสมอ
      // ถ้าไม่มีค่อยใช้ URL จาก Supabase เป็นรูปสำรอง
      const dbImg = [row.image, row.image_url, row.img, row.photo]
        .map(v => String(v ?? '').trim())
        .find(v => v && isUrl(v));
      merged.image = base.image || dbImg || '';
      merged.fallbackImage = dbImg || '';

      // หมวดหมู่: แปลงให้ตรงกับปุ่มกรอง
      const rawMood = String(row.mood ?? base.mood ?? '').trim().toLowerCase();
      merged.mood = MOOD_ALIAS[rawMood] || base.mood || '';

      return merged;
    });
  }

  if (productList) {
    // ถ้ารูปโหลดไม่ขึ้น ให้สลับไปใช้รูปสำรอง (error ไม่ bubble จึงใช้ capture)
    productList.addEventListener('error', (e) => {
      const img = e.target;
      if (img.tagName !== 'IMG') return;
      const fb = img.dataset.fallback;
      if (fb && img.src !== fb) {
        img.src = fb;
      }
    }, true);

    loadProducts()
      .then(products => {
        const rawFilter = (urlParams.get('mood') || 'all').toLowerCase();
        const moodFilter = rawFilter === 'all' ? 'all' : (MOOD_ALIAS[rawFilter] || rawFilter);
        renderProducts(products, moodFilter);

        const filterBar = document.getElementById('filter-bar');
        if (filterBar) {
          const activeBtn = filterBar.querySelector(`[data-mood="${CSS.escape(moodFilter)}"]`);
          if (activeBtn) activeBtn.classList.add('active');

          filterBar.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
              filterBar.querySelectorAll('button').forEach(b => b.classList.remove('active'));
              e.target.classList.add('active');
              renderProducts(products, e.target.dataset.mood);
            }
          });
        }
      })
      .catch(err => {
        console.error(err);
        productList.innerHTML = '<p>โหลดสินค้าไม่สำเร็จ กรุณารีเฟรชหน้า</p>';
      });
  }

  // ==========================================
  // ส่วนหน้าสั่งซื้อ
  // ==========================================
  const orderForm = document.getElementById('orderForm');
  if (orderForm) {
    const itemInput = document.getElementById('items');
    const totalInput = document.getElementById('total');
    const qtyInput = document.getElementById('qty');
    const qtyMinus = document.getElementById('qtyMinus');
    const qtyPlus = document.getElementById('qtyPlus');

    const basePrice = Number(urlParams.get('price')) || 0;
    if (urlParams.has('item')) itemInput.value = urlParams.get('item');

    function updatePrice() {
      const qty = Math.max(1, Number(qtyInput.value) || 1);
      qtyInput.value = qty;
      totalInput.value = basePrice * qty;
    }

    if (basePrice > 0) {
      updatePrice();
      qtyMinus?.addEventListener('click', () => {
        if (Number(qtyInput.value) > 1) {
          qtyInput.value = Number(qtyInput.value) - 1;
          updatePrice();
        }
      });
      qtyPlus?.addEventListener('click', () => {
        qtyInput.value = Number(qtyInput.value) + 1;
        updatePrice();
      });
      qtyInput?.addEventListener('input', updatePrice);
    }

    orderForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const val = (id) => document.getElementById(id)?.value.trim() || '-';

      // items ส่งเป็นชื่อสินค้าล้วน ๆ เพื่อให้ trigger ใน Supabase จับคู่และตัดสต๊อกได้
      const order = {
        customer_name: val('customerName'),
        contact: val('contact'),
        address: val('address'),
        items: itemInput?.value || '-',
        quantity: Math.max(1, Number(qtyInput?.value) || 1),
        unit_price: basePrice,
        total: Number(totalInput?.value) || 0,
        note: val('note'),
      };

      const submitBtn = orderForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerText;
      submitBtn.innerText = 'กำลังส่งคำสั่งซื้อ...';
      submitBtn.disabled = true;

      const { error } = await sb.from('orders').insert(order);

      if (error) {
        console.error(error);
        alert(
          (error.message || '').includes('OUT_OF_STOCK')
            ? 'ขออภัย สินค้าในสต๊อกไม่เพียงพอ กรุณาลดจำนวนหรือเลือกรุ่นอื่น'
            : 'เกิดข้อผิดพลาดในการส่งข้อมูล กรุณาลองใหม่อีกครั้ง'
        );
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
        return;
      }
      window.location.href = 'thankyou.html';
    });
  }

  // ==========================================
  // ส่วน Admin (ใช้ฟอร์มล็อกอินใน admin.html)
  // ==========================================
  const ordersTableBody = document.querySelector('#ordersTable tbody');
  if (ordersTableBody) {
    const loginBox = document.getElementById('loginBox');
    const loginForm = document.getElementById('loginForm');
    const dashboard = document.getElementById('dashboard');
    const logoutBtn = document.getElementById('logoutBtn');

    async function loadOrders() {
      const { data, error } = await sb
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        ordersTableBody.innerHTML = '<tr><td colspan="8">โหลดออเดอร์ไม่สำเร็จ</td></tr>';
        return;
      }

      if (!data || data.length === 0) {
        ordersTableBody.innerHTML = '<tr><td colspan="8">ยังไม่มีคำสั่งซื้อ</td></tr>';
        return;
      }

      ordersTableBody.innerHTML = data.map(o => `
        <tr>
          <td>${esc(new Date(o.created_at).toLocaleString('th-TH'))}</td>
          <td>${esc(o.customer_name)}</td>
          <td>${esc(o.contact)}</td>
          <td>${esc(o.address)}</td>
          <td>${esc(o.items)}</td>
          <td>${esc(o.quantity ?? 1)}</td>
          <td>฿${esc(Number(o.total).toLocaleString('th-TH'))}</td>
          <td>${esc(o.note)}</td>
        </tr>
      `).join('');
    }

    async function refreshAdminView() {
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        if (loginBox) loginBox.style.display = 'none';
        if (dashboard) dashboard.style.display = 'block';
        if (logoutBtn) logoutBtn.style.display = '';
        await loadOrders();
      } else {
        if (loginBox) loginBox.style.display = 'block';
        if (dashboard) dashboard.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'none';
        ordersTableBody.innerHTML = '';
      }
    }

    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('adminEmail').value.trim();
      const password = document.getElementById('adminPassword').value;
      const { error: authError } = await sb.auth.signInWithPassword({ email, password });
      if (authError) {
        alert('ล็อกอินไม่สำเร็จ: ' + authError.message);
        return;
      }
      loginForm.reset();
      refreshAdminView();
    });

    logoutBtn?.addEventListener('click', async () => {
      await sb.auth.signOut();
      refreshAdminView();
    });

    refreshAdminView();
  }
});
