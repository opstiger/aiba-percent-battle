(function(global){
  "use strict";

  const state={mp:null,files:null,pose:null,ref:null,refImg:null,refInfo:null};
  const refUrl="assets/nba-dna/kobe-reference.jpg";
  const IMPORTANT=[0,11,12,13,14,15,16,23,24,25,26,27,28,29,30,31,32];

  function url(path){return new URL(path,document.baseURI).href;}
  function loadImage(src){
    return new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>reject(new Error("image-load"));
      img.crossOrigin="anonymous";
      img.src=src;
    });
  }
  function fileToImage(file){
    return new Promise((resolve,reject)=>{
      const objectUrl=URL.createObjectURL(file);
      const img=new Image();
      img.onload=()=>resolve({img,objectUrl});
      img.onerror=()=>{URL.revokeObjectURL(objectUrl);reject(new Error("image-load"));};
      img.src=objectUrl;
    });
  }
  async function loadPose(){
    if(state.pose)return state.pose;
    const mp=await import(url("vendor/mediapipe/vision_bundle.mjs"));
    const files=await mp.FilesetResolver.forVisionTasks(url("vendor/mediapipe/wasm"));
    const options={baseOptions:{modelAssetPath:url("assets/aiba-vision/pose_landmarker_lite.task"),delegate:"CPU"},runningMode:"IMAGE",numPoses:3,
      minPoseDetectionConfidence:.25,minPosePresenceConfidence:.25,minTrackingConfidence:.25,outputSegmentationMasks:false};
    state.pose=await mp.PoseLandmarker.createFromOptions(files,options);
    state.mp=mp;state.files=files;
    return state.pose;
  }
  function conf(p){return p?(p.visibility==null?(p.presence==null?1:p.presence):p.visibility):0;}
  function ok(p){return !!p&&conf(p)>.18;}
  function poseQuality(lm){
    if(!lm||!lm.length)return 0;
    const count=IMPORTANT.reduce((n,i)=>n+(ok(lm[i])?1:0),0);
    const avg=IMPORTANT.reduce((n,i)=>n+conf(lm[i]),0)/IMPORTANT.length;
    const leftRaised=ok(lm[15])&&ok(lm[11])&&lm[15].y<lm[11].y?1:0;
    const rightRaised=ok(lm[16])&&ok(lm[12])&&lm[16].y<lm[12].y?1:0;
    const arms=[13,14,15,16,19,20].reduce((n,i)=>n+(ok(lm[i])?1:0),0);
    const legs=[23,24,25,26,27,28,29,30,31,32].reduce((n,i)=>n+(ok(lm[i])?1:0),0);
    const torso=ok(lm[11])+ok(lm[12])+ok(lm[23])+ok(lm[24]);
    return count*1.1+avg*8+(leftRaised+rightRaised)*3+arms*.8+legs*.35+torso*1.2;
  }
  function bestLandmarks(result){
    const sets=result&&result.landmarks?result.landmarks:[];
    if(!sets.length)return null;
    let best=null,bestScore=-1,bestIndex=0;
    sets.forEach((lm,i)=>{
      const score=poseQuality(lm);
      if(score>bestScore){best=lm;bestScore=score;bestIndex=i;}
    });
    return best?{landmarks:best,score:bestScore,index:bestIndex,count:sets.length}:null;
  }
  async function detect(img){
    const pose=await loadPose();
    const result=pose.detect(img);
    const best=bestLandmarks(result);
    return best&&best.landmarks?best.landmarks:null;
  }
  function drawToCanvas(img,opts){
    opts=opts||{};
    const size=opts.size||960,cv=document.createElement("canvas"),ctx=cv.getContext("2d");
    const iw=img.naturalWidth||img.videoWidth||img.width,ih=img.naturalHeight||img.videoHeight||img.height;
    const portrait=ih>=iw,tw=portrait?Math.round(size*.72):size,th=portrait?size:Math.round(size*.72);
    cv.width=tw;cv.height=th;
    ctx.fillStyle="#05070d";ctx.fillRect(0,0,tw,th);
    const scale=opts.cover?Math.max(tw/iw,th/ih):Math.min(tw/iw,th/ih);
    const dw=iw*scale,dh=ih*scale,dx=(tw-dw)/2,dy=(th-dh)/2;
    if(opts.flip){ctx.translate(tw,0);ctx.scale(-1,1);ctx.drawImage(img,dx,dy,dw,dh);}
    else ctx.drawImage(img,dx,dy,dw,dh);
    return cv;
  }
  async function detectDetailed(input,label){
    const pose=await loadPose();
    const variants=[
      {name:"original",image:input},
      {name:"fit960",image:drawToCanvas(input,{size:960})},
      {name:"fit720",image:drawToCanvas(input,{size:720})},
      {name:"cover960",image:drawToCanvas(input,{size:960,cover:true})},
      {name:"flip960",image:drawToCanvas(input,{size:960,flip:true})}
    ];
    let best=null;
    for(const v of variants){
      try{
        const found=bestLandmarks(pose.detect(v.image));
        if(found&&v.name.indexOf("flip")===0&&found.landmarks){
          found.landmarks=found.landmarks.map(p=>({...p,x:1-p.x}));
        }
        if(found&&(!best||found.score>best.score))best={...found,variant:v.name,label};
      }catch(e){}
    }
    return best||{landmarks:null,score:0,index:-1,count:0,variant:"none",label};
  }
  async function referenceLandmarks(){
    if(state.ref)return state.ref;
    const img=await loadImage(refUrl);
    state.refImg=img;
    state.refInfo=await detectDetailed(img,"ref");
    state.ref=state.refInfo.landmarks;
    return state.ref;
  }
  async function analyzeFile(file){
    const loaded=await fileToImage(file);
    try{
      const ref=await referenceLandmarks();
      const userInfo=await detectDetailed(loaded.img,"user");
      const user=userInfo.landmarks;
      return {user,ref,img:loaded.img,refImg:state.refImg,objectUrl:loaded.objectUrl,engine:"pose",
        poseInfo:{user:userInfo,ref:state.refInfo,userOk:!!user,refOk:!!ref}};
    }catch(e){
      return {user:null,ref:null,img:loaded.img,refImg:state.refImg,objectUrl:loaded.objectUrl,engine:"style",error:e,
        poseInfo:{userOk:false,refOk:!!state.ref,ref:state.refInfo}};
    }
  }

  global.NBADNAPoseAnalyzer={analyzeFile,referenceLandmarks,refUrl};
})(window);
