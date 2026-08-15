export const $ = (selector, root=document) => root.querySelector(selector);
export const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
export function el(tag, className='', attrs={}){
  const node=document.createElement(tag);
  if(className) node.className=className;
  for(const [key,value] of Object.entries(attrs||{})){
    if(key==='text') node.textContent=value;
    else if(key==='html') node.innerHTML=value;
    else if(key==='dataset') Object.assign(node.dataset,value||{});
    else if(key.startsWith('on') && typeof value==='function') node.addEventListener(key.slice(2),value);
    else if(value!==undefined && value!==null) node.setAttribute(key,String(value));
  }
  return node;
}
export function text(selector, fallback='—'){
  const node=typeof selector==='string'?$(selector):selector;
  const value=node?.textContent?.trim();
  return value||fallback;
}
export function callLegacy(name,...args){
  const fn=window[name];
  if(typeof fn==='function') return fn(...args);
  return undefined;
}
export function observeText(nodes, callback){
  const list=nodes.filter(Boolean);
  if(!list.length) return ()=>{};
  const observer=new MutationObserver(callback);
  list.forEach(node=>observer.observe(node,{subtree:true,childList:true,characterData:true,attributes:true}));
  return ()=>observer.disconnect();
}
export function afterPaint(fn){
  requestAnimationFrame(()=>requestAnimationFrame(fn));
}
