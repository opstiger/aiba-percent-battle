/* Approved four-family / four-palette wardrobe. Legacy palettes remain registered
 * for saved references and lab tools. Player assignment uses only the approved
 * sixteen combinations, selected deterministically by identity and jersey color.
 * Matching teammates may share a combination; palette fidelity takes precedence
 * over the previous requirement to give every player a unique colorway.
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
  j23:'RetroHighPanels',k24:'RetroHighPanels',a03:'RetroHighPanels',v15:'RetroHighPanels',t01:'RetroHighPanels',
  curry:'AirRunnerPanels',thompson:'AirRunnerPanels',lillard:'AirRunnerPanels',ionescu:'AirRunnerPanels',
  bird:'CanvasHighPanels',allen:'CanvasHighPanels',miller:'CanvasHighPanels',korver:'CanvasHighPanels',
  h13:'StripeMidPanels',stojakovic:'StripeMidPanels',taurasi:'StripeMidPanels',
  'sue-bird':'StripeMidPanels',nova24:'StripeMidPanels'
 });
 // Jordan uses the approved red/black palette.
 const PINNED_COLORWAY=Object.freeze({j23:'approved_RetroHighPanels_red'});
 function hash(id){let h=2166136261;const s=String(id||'');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
 const rgb=c=>[(c>>16)&255,(c>>8)&255,c&255];
 // Weighted RGB distance — close enough for snapping a jersey to one of 14 swatches.
 function distance(a,b){const [r1,g1,b1]=rgb(a),[r2,g2,b2]=rgb(b);
  return 2*(r1-r2)**2+4*(g1-g2)**2+3*(b1-b2)**2;}

 const APPROVED=Object.freeze({
  mono:{main:0x252932,accent:0x8a9097,light:0xf0eee7,dark:0x171a20},
  red:{main:0xad292b,accent:0x241d22,light:0xf0e9df,dark:0x201c20},
  blue:{main:0x234573,accent:0xc99b50,light:0xf1e5ce,dark:0x142238},
  green:{main:0x315b47,accent:0xc2a17b,light:0xeee9d9,dark:0x1b3028}
 });
 const approvedNames=[];
 for(const family of FAMILIES)for(const [id,p]of Object.entries(APPROVED)){
  const name='approved_'+family+'_'+id,canvas=family==='CanvasHighPanels',air=family==='AirRunnerPanels';
  AIBARetroHigh.registerColorway(name,{outsole:p.dark,outsoleEdge:p.dark,midsole:p.light,foxingTape:p.light,
   toeBox:p.light,toeCap:p.main,toeBumper:p.light,shellToe:p.light,mudguard:p.main,
   quarterPanel:canvas?p.main:p.light,stripePanel:p.main,sidePatch:0xf1eee5,airWindow:p.accent,
   heelCounter:p.main,heelClip:p.main,collar:p.main,tongue:p.dark,eyestay:p.main,
   laceBlock:canvas?p.light:p.dark,brandMark:canvas?p.dark:air?p.main:p.dark});
  approvedNames.push(name);
 }
 function socksFor(colorway){
  const id=String(colorway).split('_').pop(),spec=APPROVED[id]||SPECS[colorway]||SPECS.redBlackWhite;
  return {sock:spec.light||LIGHT,sockStripe:spec.main};
 }
 function forStar(star){
  if(!star)return null;
  const id=star.id||star.n||'custom',family=FAMILY_BY_STAR[id]||FAMILIES[hash(id)%FAMILIES.length];
  const jersey=star.col?.[0]??0x252932;
  const tone=id==='j23'?'red':Object.keys(APPROVED).sort((a,b)=>distance(APPROVED[a].main,jersey)-distance(APPROVED[b].main,jersey))[0];
  const colorway='approved_'+family+'_'+tone;
  return {family,colorway,...socksFor(colorway)};
 }
 function assign(stars){return Object.fromEntries((stars||[]).filter(s=>s&&s.id).map(s=>[s.id,forStar(s)]));}
 window.AIBAShoeColorways=Object.freeze({names:NAMES,specs:SPECS,families:FAMILIES,pinned:PINNED_COLORWAY,
  palette,assign,forStar,socksFor,familyByStar:FAMILY_BY_STAR,approved:APPROVED,approvedNames});
})();
