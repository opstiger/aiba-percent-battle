(function(global){
  "use strict";

  const coverStars=Object.freeze([
    {id:"k24",n:"K-24 黑曼巴",t:"黑金后仰 · 关键球杀手",r:95,col:[0x111111,0x4a3a12],num:24,
     cover:"assets/aiba-covers/cover-k24.webp",coverVideo:"assets/aiba-covers/cover-k24-lite.mp4",skin:0x8d5524,shoe:0x552583,headband:false,wrist:0xfdb927,sleeve:0x111111,hair:0x101010,hairStyle:"fade",beard:true},
    {id:"j23",n:"J-23 飞翼",t:"红黑飞人 · 空中统治",r:96,col:[0xce1141,0x111111],num:23,
     cover:"assets/aiba-covers/cover-j23.webp",coverVideo:"assets/aiba-covers/cover-j23-lite.mp4",skin:0x8d5524,shoe:0xce1141,headband:false,wrist:0x111111,sleeve:0x111111,hair:0x101010,hairStyle:"bald",beard:0x1a1a1a},
    {id:"a03",n:"A-03 电闪",t:"街头控卫 · 交叉步之王",r:92,col:[0xf7f7f7,0x1d428a],num:3,
     cover:"assets/aiba-covers/cover-a03.webp",coverVideo:"assets/aiba-covers/cover-a03-lite.mp4",skin:0x8d5524,shoe:0xffffff,headband:0xffffff,wrist:0x111111,sleeve:0x111111,hair:0x141414,hairStyle:"cornrows",beard:true},
    {id:"v15",n:"V-15 空袭",t:"紫电暴扣 · 高光制造机",r:90,col:[0x5a2d81,0x111111],num:15,
     cover:"assets/aiba-covers/cover-v15.webp",coverVideo:"assets/aiba-covers/cover-v15-lite.mp4",skin:0x9c6b43,shoe:0x7b2cff,headband:false,wrist:0x7b2cff,sleeve:0x111111,hair:0x101010,hairStyle:"bald",beard:false},
    {id:"t01",n:"T-01 弧光",t:"蓝白长臂 · 左手远射",r:91,col:[0x006bb6,0xffffff],num:1,
     cover:"assets/aiba-covers/cover-t01.webp",coverVideo:"assets/aiba-covers/cover-t01-lite.mp4",skin:0x8d5524,shoe:0x1d6dff,headband:false,wrist:0xffffff,sleeve:0x111111,hair:0x101010,hairStyle:"fade",beard:false}
  ]);

  const audio=Object.freeze({
    bgm:"assets/aiba-audio/menu-basketball-dubstep.mp3",
    crowd:"assets/aiba-audio/crowd-basketball-game.mp3",
    crowdCheer:"assets/aiba-audio/crowd-cheer-stadium.mp3",
    rain:"assets/aiba-audio/rain-light-loop.mp3",
    ocean:"assets/aiba-audio/ocean-waves-loop.mp3",
    gull:"assets/aiba-audio/gull-call.mp3",
    voiceBase:"assets/aiba-audio/voices/",
    applause:"",
    boo:"",
    horn:"",
    buzzer:"",
    bounce:"",
    swish:"assets/aiba-audio/swish.mp3",
    clank:"assets/aiba-audio/clank.mp3"
  });

  global.AIBA_ASSETS=Object.freeze({coverStars,audio});
})(window);
