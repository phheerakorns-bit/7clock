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
 
  const isUrl = (s) => /^(https?:)?\/\//i.test(s) || /^data:image\//i.test
