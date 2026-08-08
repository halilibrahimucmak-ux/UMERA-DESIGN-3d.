import { requireAdmin } from '../lib/auth.js';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../lib/sheets.js';
export default async function handler(req,res){
  try {
    if(req.method==='GET') return res.json(await getProducts());
    await requireAdmin(req);
    if(req.method==='POST') return res.status(201).json(await createProduct(req.body));
    if(req.method==='PUT'){ const {id,...p}=req.body||{}; return res.json(await updateProduct(id,p)); }
    if(req.method==='DELETE'){ await deleteProduct(req.body?.id); return res.json({ok:true}); }
    return res.status(405).json({error:'Method not allowed'});
  } catch(e){ console.error(e); const code=e.message==='UNAUTHORIZED'?401:e.message==='NOT_FOUND'?404:500; return res.status(code).json({error:code===401?'Yetkisiz erişim.':e.message||'İşlem başarısız.'}); }
}
