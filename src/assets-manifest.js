(function(global){
  "use strict";

  const coverStars=Object.freeze([
    {id:"k24",n:"科比·布莱恩特",t:"五届总冠军 · 关键球专家",r:95,col:[0x111111,0x4a3a12],num:24,
     cover:"assets/aiba-covers/cover-k24.webp",coverVideo:"assets/aiba-covers/cover-k24-lite.mp4",skin:0xa87550,shoe:0xf1c641,headband:false,wrist:null,sleeve:0x111111,hair:0x201812,hairStyle:"buzz",beard:0x201812,beardStyle:"goatee",shortsColor:0x111111},
    {id:"j23",n:"迈克尔·乔丹",t:"六届总冠军 · 后仰跳投",r:96,col:[0xce1141,0x111111],num:23,
     cover:"assets/aiba-covers/cover-j23.webp",coverVideo:"assets/aiba-covers/cover-j23-lite.mp4",skin:0x9c6947,shoe:0x111111,headband:false,wrist:null,sleeve:null,hair:0x201711,hairStyle:"bald",beard:0x201711,beardStyle:"moustache",shortsColor:0xce1141},
    {id:"a03",n:"阿伦·艾弗森",t:"四届得分王 · 交叉步突破",r:92,col:[0xf7f7f7,0x1d428a],num:3,
     cover:"assets/aiba-covers/cover-a03.webp",coverVideo:"assets/aiba-covers/cover-a03-lite.mp4",skin:0xa67450,shoe:0xf0f0eb,headband:0xffffff,wrist:null,sleeve:0xffffff,hair:0x211a16,hairStyle:"cornrows",beard:0x211a16,beardStyle:"goatee",shortsColor:0xf7f7f7},
    {id:"v15",n:"文斯·卡特",t:"八届全明星 · 2000扣篮冠军",r:90,col:[0x5a2d81,0x111111],num:15,
     cover:"assets/aiba-covers/cover-v15.webp",coverVideo:"assets/aiba-covers/cover-v15-lite.mp4",skin:0x92613f,shoe:0xeeeeea,headband:false,wrist:null,sleeve:null,hair:0x231b16,hairStyle:"bald",beard:false,beardStyle:"none",shortsColor:0x5a2d81},
    {id:"t01",n:"特雷西·麦克格雷迪",t:"七届全明星 · 左手远投",r:91,col:[0x006bb6,0xffffff],num:1,
     cover:"assets/aiba-covers/cover-t01.webp",coverVideo:"assets/aiba-covers/cover-t01-lite.mp4",skin:0x976746,shoe:0xeeeeea,headband:false,wrist:null,sleeve:0x111111,hair:0x221912,hairStyle:"buzz",beard:0x221912,beardStyle:"goatee",shortsColor:0x006bb6}
  ]);

  const audio=Object.freeze({
    bgm:"assets/aiba-audio/menu-basketball-dubstep.mp3",
    crowd:"assets/aiba-audio/crowd-basketball-game.mp3",
    crowdCheer:"assets/aiba-audio/crowd-cheer-stadium.mp3",
    rain:"assets/aiba-audio/rain-light-loop.mp3",
    ocean:"assets/aiba-audio/ocean-waves-loop.mp3",
    gull:"assets/aiba-audio/gull-call.mp3",
    voiceBase:"assets/aiba-audio/voices/",
    applause:"assets/aiba-audio/sfx/crowd-cheer-indoor-01.mp3",
    boo:"assets/aiba-audio/sfx/crowd-boo-01.mp3",
    horn:"",
    buzzer:"assets/aiba-audio/sfx/game-horn-01.mp3",
    startWhistle:"assets/aiba-audio/sfx/start-whistle-01.mp3",
    shoeSqueak:"assets/aiba-audio/sfx/shoe-squeak-01.mp3",
    bounce:"assets/aiba-audio/sfx/bounce-indoor-01.mp3",
    bounce2:"assets/aiba-audio/sfx/bounce-indoor-02.mp3",
    bounceSequence:"assets/aiba-audio/sfx/bounce-sequence-indoor-01.mp3",
    swish:"assets/aiba-audio/sfx/swish-01.mp3",
    swish2:"assets/aiba-audio/sfx/swish-02.mp3",
    swish3:"assets/aiba-audio/sfx/swish-03.mp3",
    clank:"assets/aiba-audio/sfx/rim-miss-01.mp3",
    clank2:"assets/aiba-audio/sfx/rim-miss-02.mp3",
    rimMake:"assets/aiba-audio/sfx/rim-make-01.mp3",
    crowdFinalMake:"assets/aiba-audio/crowd_final_make_01.mp3",
    crowdFinalMiss:"assets/aiba-audio/crowd_final_miss_01.mp3"
  });

  global.AIBA_ASSETS=Object.freeze({coverStars,audio});
})(window);
