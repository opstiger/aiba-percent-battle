(function(global){
  "use strict";

  const state={file:null,previewUrl:null,result:null,userImg:null,analysis:null,poster:null,busy:false};

  function $(id){return document.getElementById(id);}
  function safeToast(txt,color){if(typeof toast==="function")toast(txt,color||"#ffd23f");}
  function setState(fn){Object.assign(state,fn);}
  function quoteEscape(s){return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}
  function dnaShell(body){
    if(typeof showPanel==="function")showPanel(`<section class="dnaPanel">${body}</section>`);
  }
  function start(){
    if(global.G)G.state="nba-dna";
    if(typeof ensureAudio==="function")ensureAudio(true,true);
    dnaUpload();
  }
  function dnaUpload(){
    dnaShell(`
      <div class="dnaHero">
        <small>NBA DNA</small>
        <h1>让我看看你的投篮。</h1>
        <p>上传一张投篮姿势照片，匹配你的 Mamba DNA。</p>
      </div>
      <div class="dnaCompare">
        <figure class="dnaRef"><img src="${NBADNAPoseAnalyzer.refUrl}" alt="Kobe 标准投篮姿势"><figcaption>KOBE BRYANT · 24</figcaption></figure>
        <label class="dnaDrop" for="nbaDnaFile">
          <input id="nbaDnaFile" type="file" accept="image/*" onchange="nbaDnaPickPhoto(event)">
          <span id="nbaDnaPreview">${state.previewUrl?`<img src="${state.previewUrl}" alt="你的投篮照片">`:"<b>上传照片</b><em>完整投篮姿势效果最好</em>"}</span>
        </label>
      </div>
      <div class="dnaActions">
        <button class="btn gold" onclick="nbaDnaRun()">生成 NBA DNA</button>
        <button class="btn sm" onclick="showMenu()">返回封面</button>
      </div>`);
  }
  function pickPhoto(event){
    const file=event&&event.target&&event.target.files&&event.target.files[0];
    if(!file)return;
    if(state.previewUrl)URL.revokeObjectURL(state.previewUrl);
    const previewUrl=URL.createObjectURL(file);
    state.file=file;state.previewUrl=previewUrl;
    const box=$("nbaDnaPreview");
    if(box)box.innerHTML=`<img src="${previewUrl}" alt="你的投篮照片">`;
  }
  function progress(label){
    dnaShell(`
      <div class="dnaScan">
        <small>NBA DNA</small>
        <h1>${label}</h1>
        <div class="dnaScanBar"><i></i></div>
        <p>正在匹配 Mamba DNA，别眨眼。</p>
      </div>`);
  }
  function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
  function analysisScoreRows(result){
    if(global.NBADNAPoseVisualizer&&NBADNAPoseVisualizer.scoreRows)return NBADNAPoseVisualizer.scoreRows(result);
    return [
      {name:"出手点",score:result.parts.shooting},
      {name:"手肘角度",score:result.parts.elbow},
      {name:"身体轴线",score:result.parts.balance},
      {name:"跟随动作",score:result.parts.follow}
    ];
  }
  async function playFallbackAnalysis(result){
    const rows=analysisScoreRows(result);
    dnaShell(`
      <div class="dnaAnalyzer fallback">
        <div class="dnaAnalyzerHead">
          <small>NBA DNA LAB</small>
          <h1>正在打印 Mamba DNA</h1>
          <p id="nbaDnaStageText">扫描你的出手姿势</p>
        </div>
        <div class="dnaFallbackStage">
          <div class="dnaFallbackPhoto">${state.previewUrl?`<img src="${state.previewUrl}" alt="你的投篮照片">`:""}</div>
          <div class="dnaFallbackTrace">
            <i class="bone b1"></i><i class="bone b2"></i><i class="bone b3"></i><i class="bone b4"></i>
            <b class="dot d1"></b><b class="dot d2"></b><b class="dot d3"></b><b class="dot d4"></b>
            <em></em>
          </div>
        </div>
        <div class="dnaTape" id="nbaDnaTape">
          <span data-step="0">扫描你的出手姿势</span>
          <span data-step="1">滑入 Kobe 标准骨架</span>
          <span data-step="2">重叠手肘与出手点</span>
          <span data-step="3">打印关键节点相似度</span>
        </div>
        <div class="dnaNodePrint" id="nbaDnaNodePrint">
          ${rows.map(r=>`<b>${quoteEscape(r.name)}<em>${Math.round(r.score)}%</em></b>`).join("")}
        </div>
      </div>`);
    const stageText=$("nbaDnaStageText");
    const tape=Array.from(document.querySelectorAll("#nbaDnaTape span"));
    const nodes=Array.from(document.querySelectorAll("#nbaDnaNodePrint b"));
    for(let step=0;step<4;step++){
      tape.forEach((el,i)=>el.classList.toggle("active",i<=step));
      nodes.forEach((el,i)=>el.classList.toggle("active",i<step));
      if(stageText&&tape[step])stageText.textContent=tape[step].textContent;
      await sleep(step===0?760:860);
    }
    nodes.forEach(el=>el.classList.add("active"));
    await sleep(520);
  }
  async function playAnalysis(analyzed,result){
    if(!global.NBADNAPoseVisualizer){await playFallbackAnalysis(result);return;}
    const rows=analysisScoreRows(result);
    dnaShell(`
      <div class="dnaAnalyzer">
        <div class="dnaAnalyzerHead">
          <small>NBA DNA LAB</small>
          <h1>正在对齐 Mamba 出手曲线</h1>
          <p id="nbaDnaStageText">扫描你的出手姿势</p>
        </div>
        <div class="dnaAnalyzerStage">
          <canvas id="nbaDnaAnalysisCanvas" width="640" height="760"></canvas>
        </div>
        <div class="dnaTape" id="nbaDnaTape">
          <span data-step="0">扫描你的出手姿势</span>
          <span data-step="1">滑入 Kobe 标准骨架</span>
          <span data-step="2">重叠手肘与出手点</span>
          <span data-step="3">打印关键节点相似度</span>
        </div>
        <div class="dnaNodePrint" id="nbaDnaNodePrint">
          ${rows.map(r=>`<b>${quoteEscape(r.name)}<em>${Math.round(r.score)}%</em></b>`).join("")}
        </div>
      </div>`);
    const canvas=$("nbaDnaAnalysisCanvas"),stageText=$("nbaDnaStageText");
    const tape=Array.from(document.querySelectorAll("#nbaDnaTape span"));
    const nodes=Array.from(document.querySelectorAll("#nbaDnaNodePrint b"));
    try{
      await NBADNAPoseVisualizer.animate(canvas,analyzed,result,p=>{
        const step=p<.25?0:(p<.5?1:(p<.72?2:3));
        tape.forEach((el,i)=>el.classList.toggle("active",i<=step));
        nodes.forEach((el,i)=>el.classList.toggle("active",p>(.64+i*.075)));
        if(stageText)stageText.textContent=tape[step]?tape[step].textContent:"打印关键节点相似度";
      });
    }catch(e){
      await playFallbackAnalysis(result);
      return;
    }
    await sleep(260);
  }
  async function run(){
    if(state.busy)return;
    if(!state.file){safeToast("先给我一张投篮照片","#ff8d7a");return;}
    state.busy=true;progress("读取你的球场基因");
    try{
      const analyzed=await NBADNAPoseAnalyzer.analyzeFile(state.file);
      const seed=state.file.size+(state.file.lastModified||0);
      const result=analyzed.engine==="pose"?NBADNAScoreEngine.score(analyzed.user,analyzed.ref):NBADNAScoreEngine.fallbackScore(seed);
      state.result=result;state.userImg=analyzed.img;state.analysis=analyzed;
      await playAnalysis(analyzed,result);
      showResult(result,analyzed.img);
    }catch(e){
      const result=NBADNAScoreEngine.fallbackScore(state.file.size+(state.file.lastModified||0));
      state.result=result;state.analysis={img:null,refImg:null,user:null,ref:null,engine:"style"};
      await playAnalysis(state.analysis,result);
      showResult(result,null);
    }finally{state.busy=false;}
  }
  function bars(parts){
    return [
      ["出手动作",parts.shooting],
      ["手肘稳定",parts.elbow],
      ["身体平衡",parts.balance],
      ["跟随动作",parts.follow]
    ].map(r=>`<div class="dnaStat"><span>${r[0]}</span><b>${r[1]}%</b><i><em style="width:${r[1]}%"></em></i></div>`).join("");
  }
  function rewardMarkup(result){
    return result.rewards.length?`<div class="dnaRewards"><small>UNLOCKED</small>${result.rewards.map(x=>`<span>${x}</span>`).join("")}</div>`:`<div class="dnaRewards locked"><small>NEXT UNLOCK</small><span>70% 解锁 Mamba 投篮动作</span></div>`;
  }
  function showResult(result,img){
    const coach=result.coach.map(x=>`<li>${quoteEscape(x)}</li>`).join("");
    dnaShell(`
      <div id="nbaDnaResultVisual" class="dnaResultVisual"></div>
      <div class="dnaCard">
        <small>YOUR NBA DNA</small>
        <div class="dnaPercent">${result.total}%</div>
        <h1>${result.star}</h1>
        <p>${quoteEscape(result.line)}</p>
      </div>
      <div class="dnaGrid">
        <div class="dnaStats">${bars(result.parts)}</div>
        <div class="dnaCoach"><b>AI 教练一句话</b><ol>${coach}</ol></div>
      </div>
      ${rewardMarkup(result)}
      <div class="dnaActions">
        <button class="btn gold" onclick="nbaDnaBuildPoster()">生成分享海报</button>
        <button class="btn green" onclick="nbaDnaReset()">再测一次</button>
        <button class="btn sm" onclick="showMenu()">继续游戏</button>
      </div>
      <div id="nbaDnaPosterMount" class="dnaPosterMount"></div>`);
    const mount=$("nbaDnaResultVisual");
    if(mount&&global.NBADNAPoseVisualizer){
      const canvas=document.createElement("canvas");
      canvas.width=640;canvas.height=760;
      NBADNAPoseVisualizer.snapshot(canvas,state.analysis||{img,refImg:null,user:null,ref:null},result);
      mount.appendChild(canvas);
    }
    state.poster=null;
  }
  function buildPoster(){
    if(!state.result)return;
    const canvas=NBADNAShareCard.build(state.result,state.userImg,state.analysis);
    state.poster=canvas;
    const mount=$("nbaDnaPosterMount");
    if(mount){
      mount.innerHTML="";
      mount.appendChild(canvas);
      const actions=document.createElement("div");
      actions.className="dnaActions";
      actions.innerHTML='<button class="btn gold" onclick="nbaDnaSavePoster()">保存图片</button><button class="btn sm" onclick="nbaDnaSharePoster()">一键分享</button>';
      mount.appendChild(actions);
    }
  }
  function savePoster(){if(state.poster)NBADNAShareCard.save(state.poster);}
  async function sharePoster(){
    if(!state.poster)buildPoster();
    if(!state.poster||!state.result)return;
    try{await NBADNAShareCard.share(state.poster,state.result);safeToast("分享面板已打开","#7CFC6B");}
    catch(e){safeToast("已生成海报，保存后发出去","#ffd23f");}
  }
  function reset(){
    state.file=null;state.result=null;state.userImg=null;state.analysis=null;state.poster=null;
    if(state.previewUrl)URL.revokeObjectURL(state.previewUrl);
    state.previewUrl=null;dnaUpload();
  }

  global.startNBADNA=start;
  global.nbaDnaPickPhoto=pickPhoto;
  global.nbaDnaRun=run;
  global.nbaDnaReset=reset;
  global.nbaDnaBuildPoster=buildPoster;
  global.nbaDnaSavePoster=savePoster;
  global.nbaDnaSharePoster=sharePoster;
})(window);
