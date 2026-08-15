"use strict";

const G={
  state:"boot",mode:"contest",diff:"normal",stage:"semi",
  opponents:[],finalist:null,
  seq:[],shotIdx:0,moneyRack:2,
  timer:70,running:false,buzzed:false,
  score:0,streak:0,charging:false,power:0,canShoot:false,moving:false,
  shots:[],stats:{best:0,moneyM:0,moneyT:0,deepM:0,deepT:0},
  semiScore:0,finalScore:0,tiebreakN:0,cheer:0,tNow:0,
  battleSpot:2,battleOpp:null,battleOppScore:0,battleNext:1.2,battleOver:false,finalRun:false,
  battleStock:null,battleReadyAt:null,superStock:0,superSeenMe:0,superSeenOpp:0,
  superChanceId:0,superResolvedId:0,battleChargeSuperChanceId:0,
  rush:null,rushResultRecord:null,audioCueLast:null,passCatch:null
};
const PAUSE={on:false,state:null,mode:null,wasRunning:false,canShoot:false,rushVariant:null,practice:false};
