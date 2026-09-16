/* 14 shared shoe colorways plus the per-star assignment.
 *
 * Shared, not per-player: the factory bakes colour into vertex colours, so one
 * colorway = one cached geometry. 14 keeps the resource count flat while still
 * letting every star's shoes agree with their jersey.
 *
 * Two rules the assignment has to satisfy at once:
 *   1. the shoe reads as part of the kit  -> colorway is the nearest of the 14 to
 *      the jersey's main colour;
 *   2. nobody on court wears the same shoe -> (family, colorway) pairs are unique
 *      across the roster; a star whose first choice is taken falls to the next
 *      nearest. Order is fixed, so the result is the same on every machine.
 */
(()=>{
 if(!window.AIBARetroHigh||!window.AIBAShoeStyles)throw Error('shoe-colorways.js must load after shoe-styles.js');

 const LIGHT=0xe9e8e3,BONE=0xd8d7d1,INK=0x17181a;
 /* One spec row builds every panel of every family, so a new family never needs
    14 palettes hand-written — it only needs its panel names to appear here. */
 function palette({main,accent,sole=INK,light=LIGHT,dark=INK}){
  return {
   outsole:sole,outsoleEdge:sole,midsole:BONE,foxingTape:light,
   toeBox:light,toeCap:main,toeBumper:light,shellToe:main,mudguard:main,
   quarterPanel:light,stripePanel:main,sidePatch:light,airWindow:accent,
   heelCounter:main,heelClip:main,collar:main,tongue:dark,eyestay:dark,
   laceBlock:dark,brandMark:dark
  };
 }
 /* main 跟球衣主色,accent 跟球衣副色。袜子用 light 做筒、main 做条,
    和鞋面同源,所以不会出现"鞋对了袜子不对"。 */
 const SPECS=Object.freeze({
  redBlackWhite  :{main:0xb8322b,accent:0x18191b},
  royalGold      :{main:0x1d428a,accent:0xffc72c},
  crimsonWhite   :{main:0xce1141,accent:0xf7f7f7},
  goldRoyal      :{main:0xffc72c,accent:0x1d428a,dark:0x1d428a},
  celticGreen    :{main:0x007a33,accent:0xffffff},
  forestBlack    :{main:0x00632a,accent:0x111111},
  paceGold       :{main:0xfdbb30,accent:0x002d62,dark:0x002d62},
  blazeRed       :{main:0xe03a3e,accent:0x111111},
  hawkRed        :{main:0xc8102e,accent:0x26282a},
  kingsPurple    :{main:0x5a2d81,accent:0x8a8d8f},
  mintNight      :{main:0x6eceb2,accent:0x101820,dark:0x101820},
  plumOrange     :{main:0x2b1a4e,accent:0xe56020},
  pineGold       :{main:0x2c5234,accent:0xffc600},
  midnightCyan   :{main:0x11151c,accent:0x6ff3ff,sole:0x2a2f38}
 });
 const NAMES=Object.freeze(Object.keys(SPECS));
 for(const [name,spec]of Object.entries(SPECS))AIBARetroHigh.registerColorway(name,palette(spec));

 const FAMILIES=Object.freeze(['RetroHighPanels','StripeMidPanels','CanvasHighPanels','AirRunnerPanels']);
 /* 品系按球员风格分派,不是随机:控卫/现代射手走低帮,经典射手走帆布高帮,
    乔丹保持已上线的 RetroHigh。没列到的球星走 id 哈希兜底,同一个人每次进游戏一样。 */
 const FAMILY_BY_STAR=Object.freeze({
  j23:'RetroHighPanels',
  curry:'AirRunnerPanels',thompson:'AirRunnerPanels',lillard:'AirRunnerPanels',ionescu:'AirRunnerPanels',
  bird:'CanvasHighPanels',allen:'CanvasHighPanels',miller:'CanvasHighPanels',korver:'CanvasHighPanels',
  h13:'StripeMidPanels',stojakovic:'StripeMidPanels',taurasi:'StripeMidPanels',
  'sue-bird':'StripeMidPanels',nova24:'StripeMidPanels'
 });
 /* 已验收上线的外观不能被这次分配改掉:乔丹保持 v2.27.0 的 classicRedBlackWhite
    (它在工厂原有的四套里,不占 14 套共享配色的名额)。 */
 const PINNED_COLORWAY=Object.freeze({j23:'classicRedBlackWhite'});
 function hash(id){let h=2166136261;const s=String(id||'');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
 const rgb=c=>[(c>>16)&255,(c>>8)&255,c&255];
 // Weighted RGB distance — close enough for snapping a jersey to one of 14 swatches.
 function distance(a,b){const [r1,g1,b1]=rgb(a),[r2,g2,b2]=rgb(b);
  return 2*(r1-r2)**2+4*(g1-g2)**2+3*(b1-b2)**2;}

 let table=null,tableKey='';
 function assign(stars){
  const list=(stars||[]).filter(s=>s&&s.id);
  const key=list.map(s=>s.id).join(',');
  if(table&&tableKey===key)return table;
  const taken=new Set(),out={};
  // Fixed iteration order keeps the outcome identical across machines and runs.
  for(const star of list.slice().sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)){
   const family=FAMILY_BY_STAR[star.id]||FAMILIES[hash(star.id)%FAMILIES.length];
   const jersey=(star.col&&star.col[0])!=null?star.col[0]:0x808080;
   const ranked=NAMES.slice().sort((a,b)=>distance(SPECS[a].main,jersey)-distance(SPECS[b].main,jersey));
   let colorway=PINNED_COLORWAY[star.id]||ranked.find(n=>!taken.has(family+':'+n))||ranked[0];
   taken.add(family+':'+colorway);
   out[star.id]={family,colorway,...socksFor(colorway)};
  }
  table=out;tableKey=key;return out;
 }
 function socksFor(colorway){
  // 钉住的配色不在 SPECS 里,袜子退回红黑白那套,和已上线的乔丹一致。
  const spec=SPECS[colorway]||SPECS.redBlackWhite;
  return {sock:spec.light||LIGHT,sockStripe:spec.main};
 }
 /* 单个球星的鞋。没有名册时(自定义球星、预览)也要给出稳定结果。 */
 function forStar(star,roster){
  if(!star||!star.id)return null;
  const map=assign(roster&&roster.length?roster:[star]);
  if(map[star.id])return map[star.id];
  const family=FAMILY_BY_STAR[star.id]||FAMILIES[hash(star.id)%FAMILIES.length];
  const jersey=(star.col&&star.col[0])!=null?star.col[0]:0x808080;
  const colorway=PINNED_COLORWAY[star.id]||NAMES.slice().sort((a,b)=>distance(SPECS[a].main,jersey)-distance(SPECS[b].main,jersey))[0];
  return {family,colorway,...socksFor(colorway)};
 }
 window.AIBAShoeColorways=Object.freeze({names:NAMES,specs:SPECS,families:FAMILIES,pinned:PINNED_COLORWAY,
  palette,assign,forStar,socksFor,familyByStar:FAMILY_BY_STAR});
})();
