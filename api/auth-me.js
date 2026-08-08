import { requireAdmin } from '../lib/auth.js';
export default async function handler(req,res){ try { const p=await requireAdmin(req); res.json({authenticated:true,user:{username:p.username,role:p.role}}); } catch { res.status(401).json({authenticated:false}); } }
