import { storage } from '../storage/StorageService.ts'
import { walletTask } from './wallet.ts'
export const HOME_GOODS=[
 {id:'tomato',name:'番茄',price:4,kind:'食材'},{id:'egg',name:'鸡蛋',price:3,kind:'食材'},{id:'rice',name:'大米',price:5,kind:'食材'},{id:'greens',name:'青菜',price:3,kind:'食材'},{id:'beef',name:'牛肉',price:15,kind:'食材'},
 {id:'studio',name:'向阳小公寓',price:2800,kind:'房产'},{id:'garden',name:'花园小屋',price:8800,kind:'房产'},{id:'riverside',name:'临河大平层',price:18000,kind:'房产'},
 {id:'sofa',name:'奶油色沙发',price:260,kind:'家具',slot:'客厅'},{id:'table',name:'原木餐桌',price:180,kind:'家具',slot:'餐厅'},{id:'bed',name:'柔软大床',price:380,kind:'家具',slot:'卧室'},{id:'bookshelf',name:'落地书架',price:220,kind:'家具',slot:'书房'},{id:'plant',name:'窗边绿植',price:50,kind:'家具',slot:'窗台'},{id:'sofa-blue',name:'雾蓝色沙发',price:320,kind:'家具',slot:'客厅'},
] as const
export const RECIPES=[{id:'eggs',name:'番茄炒蛋',parts:{tomato:2,egg:2}},{id:'ricebowl',name:'牛肉蔬菜饭',parts:{rice:1,beef:1,greens:1}},{id:'friedrice',name:'蛋炒饭',parts:{rice:1,egg:1,greens:1}}] as const
export interface HomeState { stock:Record<string,number>;houses:string[];current:string;furniture:string[];rooms:Record<string,Record<string,string>>;meals:Array<{name:string;at:number}> }
export const EMPTY_HOME:HomeState={stock:{},houses:[],current:'',furniture:[],rooms:{},meals:[]}
export function homeAction(namespace:string,change:(s:HomeState,coins:number)=>{state:HomeState;coins:number}){return walletTask(namespace,()=>storage.updateEconomy<HomeState>(namespace,'home_life_v1',(s,c)=>change(s??EMPTY_HOME,c)))}
export function buyHomeItem(s:HomeState,coins:number,id:string){
 const item=HOME_GOODS.find(g=>g.id===id);if(!item)throw Error('商品不存在')
 if(item.kind==='房产'&&s.houses.includes(id)||item.kind==='家具'&&s.furniture.includes(id))throw Error('已经拥有了')
 const state=item.kind==='食材'?{...s,stock:{...s.stock,[id]:(s.stock[id]??0)+1}}:item.kind==='房产'?{...s,houses:[...s.houses,id],current:s.current||id}:{...s,furniture:[...s.furniture,id]}
 return {state,coins:coins-item.price}
}
export function cookMeal(s:HomeState,coins:number,id:string){
 const recipe=RECIPES.find(r=>r.id===id);if(!recipe)throw Error('菜谱不存在')
 const stock={...s.stock}
 for(const [part,qty] of Object.entries(recipe.parts)){if((stock[part]??0)<qty)throw Error('食材不足，请先采购');stock[part]-=qty}
 return {state:{...s,stock,meals:[{name:recipe.name,at:Date.now()},...s.meals].slice(0,30)},coins}
}
export function furnishHome(s:HomeState,coins:number,id:string){
 const item=HOME_GOODS.find(g=>g.id===id);if(!s.current||!s.houses.includes(s.current))throw Error('请先购买并选择一套房子')
 if(!item||!('slot' in item)||!s.furniture.includes(id))throw Error('请先购买这件家具')
 return {state:{...s,rooms:{...s.rooms,[s.current]:{...s.rooms[s.current],[item.slot]:id}}},coins}
}
