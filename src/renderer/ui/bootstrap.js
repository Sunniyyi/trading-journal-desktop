import { initDesktopShell } from './shell.js';

function start(){
  try{initDesktopShell();}
  catch(error){console.error('[Desktop UI v2] Initialisation impossible',error);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
