import { Signal, Wifi, BatteryFull } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { storage } from '../../storage/StorageService.ts'
import { ColorField } from './AppearanceEditor.tsx'
interface Skin { background: string; ink: string; wallpaper: string }
const DEFAULT: Skin = { background: '#dce7ef', ink: '#263b4b', wallpaper: '' }
export function CharacterPhone({ namespace, charId, name, children }: { namespace: string; charId: string; name: string; children: ReactNode }) {
  const [skin,setSkin]=useState<Skin>(DEFAULT)
  const [editing,setEditing]=useState(false)
  const [note,setNote]=useState('')
  useEffect(()=>{let alive=true;void storage.getBag<Skin>(namespace,`phone_skin_${charId}`).then(s=>{if(alive)setSkin(s??DEFAULT)});return()=>{alive=false}},[namespace,charId])
  const patch=(p:Partial<Skin>)=>{const next={...skin,...p};setSkin(next);void storage.setBag(namespace,`phone_skin_${charId}`,next).catch(()=>setNote('保存失败，请检查存储空间'))}
  return <section className="hz-phone-frame mt-3" style={{background:skin.background,color:skin.ink,backgroundImage:skin.wallpaper?'url('+JSON.stringify(skin.wallpaper)+')':undefined,backgroundSize:'cover',backgroundPosition:'center'}}>
    <div className="hz-phone-island"/><div className="mb-5 flex justify-between text-[10px]"><span>{new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</span><span className="flex gap-1"><Signal size={12}/><Wifi size={12}/><BatteryFull size={14}/></span></div>
    <p className="text-center text-xl font-semibold">{name}的手机</p><p className="mb-4 mt-1 text-center text-[10px] opacity-65"></p>
    <div className="hz-phone-home">{children}</div>
    <button className="mt-6 w-full rounded-xl bg-white/60 py-2 text-xs text-slate-700" onClick={()=>setEditing(!editing)}>个性化这台手机</button>
    {editing&&<div className="mt-3 space-y-3 rounded-2xl bg-white/90 p-3 text-slate-800"><ColorField label="手机背景" value={skin.background} onChange={background=>patch({background})}/><ColorField label="图标文字" value={skin.ink} onChange={ink=>patch({ink})}/><label className="block text-xs">角色壁纸<input className="mt-1 w-full" type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>6*1024*1024){setNote('壁纸请控制在 6MB 内');return}const r=new FileReader();r.onload=()=>patch({wallpaper:String(r.result)});r.readAsDataURL(f)}}/></label><button className="chip" onClick={()=>patch(DEFAULT)}>恢复默认</button>{note&&<p className="text-xs">{note}</p>}</div>}
    <span className="mx-auto mt-6 block h-1 w-20 rounded-full bg-current opacity-30"/>
  </section>
}
