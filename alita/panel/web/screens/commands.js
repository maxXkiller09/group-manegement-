import { commandModules } from "./commands-data.js";
import { api } from "../api.js";
import { confirmDestructive, haptic, textElement, toast, userLabel } from "../ui.js";

const labels={admin:"Sirf Admin",owner:"Sirf Owner",member:"Sabke liye"};
const direct=new Set(["/ban","/tban","/unban","/kick","/mute","/tmute","/unmute"]);
const route=(id,key)=>`#/chats/${encodeURIComponent(id)}/${key}`;
const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;};

function iconTile(module){
 const wrap=el("span","ng-command-icon");wrap.setAttribute("aria-hidden","true");
 const ns="http://www.w3.org/2000/svg",svg=document.createElementNS(ns,"svg");svg.setAttribute("viewBox","0 0 48 48");
 const defs=document.createElementNS(ns,"defs"),grad=document.createElementNS(ns,"linearGradient");grad.id="ng-cmd-"+module.id;grad.setAttribute("x2","1");grad.setAttribute("y2","1");
 for(const [offset,color] of [["0%","#43a0ff"],["100%",module.id==="mutes"?"#7958e8":module.id==="warns"?"#e18a45":module.id==="locks"?"#20b6c8":"#6559e9"]]){const stop=document.createElementNS(ns,"stop");stop.setAttribute("offset",offset);stop.setAttribute("stop-color",color);grad.append(stop);}
 defs.append(grad);const bg=document.createElementNS(ns,"rect");bg.setAttribute("x","2");bg.setAttribute("y","2");bg.setAttribute("width","44");bg.setAttribute("height","44");bg.setAttribute("rx","14");bg.setAttribute("fill","url(#"+grad.id+")");
 const glyph=document.createElementNS(ns,"text");glyph.setAttribute("x","24");glyph.setAttribute("y","31");glyph.setAttribute("text-anchor","middle");glyph.setAttribute("font-size","22");glyph.setAttribute("font-weight","800");glyph.setAttribute("fill","#fff");glyph.textContent=({shield:"⛨",volume:"◖",alert:"!",lock:"▣"})[module.icon]||"•";
 svg.append(defs,bg,glyph);wrap.append(svg);return wrap;
}
function beginnerGuide(){
 const d=el("details","ng-command-guide"),s=el("summary","","Command kya hota hai?"),body=el("div","ng-command-guide-body");
 body.append(el("p","","Command ek chhota message hai jo / se shuru hota hai. NexGuard ise padhkar aapka bataya kaam karta hai."));
 const ol=el("ol","ng-command-steps");
 for(const line of ["Jis member ka message hai, use chat mein dhoondhein.","Message par thoda dabaye rakho, phir Reply chuno.","Reply box mein command aur zaroori baat likhkar bhejein."])ol.append(el("li","",line));
 body.append(ol);d.append(s,body);return d;
}
function copyButton(value){
 const b=el("button","ng-command-primary","Command copy karein");b.type="button";
 b.addEventListener("click",async()=>{try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);else{const t=document.createElement("textarea");t.value=value;t.className="ng-command-copy-fallback";document.body.append(t);t.select();const ok=document.execCommand("copy");t.remove();if(!ok)throw Error("copy unavailable");}haptic("success");toast("Command copy ho gaya. Group mein paste karke bhejein.");}catch{toast("Copy nahi hua. Command ko select karke copy karein.","error");}});
 return b;
}
function directForm(chatID,command){
 const box=el("section","ng-command-direct");box.append(el("h3","","Member par action"),el("p","ng-command-muted","Member ka Telegram ID chunein ya likhein. Action se pehle details check hongi."));
 const action=document.createElement("select");action.setAttribute("aria-label","Moderation action");
 for(const [v,l] of [["ban","Ban"],["tban","Tay time ke liye ban"],["kick","Kick"],["mute","Mute"],["tmute","Tay time ke liye mute"],["unban","Unban"],["unmute","Unmute"]])action.append(new Option(l,v));action.value=command.name.slice(1);
 const picker=document.createElement("select");picker.setAttribute("aria-label","Recent member");picker.append(new Option("Member chunein (optional)",""));
 const target=document.createElement("input");target.type="number";target.min="1";target.step="1";target.inputMode="numeric";target.placeholder="Ya Telegram user ID likhein";target.setAttribute("aria-label","Target Telegram user ID");
 picker.addEventListener("change",()=>{if(picker.value)target.value=picker.value;});
 api(`chats/${encodeURIComponent(chatID)}/top-members?days=90`).then(d=>{picker.replaceChildren(new Option("Member chunein (optional)",""));for(const m of (Array.isArray(d?.members)?d.members:[]))picker.append(new Option(userLabel(d.names,m.user_id),String(m.user_id)));}).catch(()=>picker.replaceChildren(new Option("Member list nahi mili — ID likhein","")));
 const duration=document.createElement("input");duration.type="number";duration.min="1";duration.max=String(366*86400);duration.value="3600";duration.placeholder="Time seconds mein (3600 = 1 hour)";duration.hidden=!["/tban","/tmute"].includes(command.name);
 action.addEventListener("change",()=>duration.hidden=action.value!=="tban"&&action.value!=="tmute");
 const reason=document.createElement("textarea");reason.maxLength=3000;reason.rows=2;reason.placeholder="Reason (optional)";
 const review=el("button","ng-command-primary","Action check karein");review.type="button";
 review.addEventListener("click",async()=>{const id=Number(target.value);if(!Number.isSafeInteger(id)||id<=0)return toast("Sahi Telegram user ID likhein.","error");const chosen=action.value,timed=chosen==="tban"||chosen==="tmute",seconds=timed?Number(duration.value):0;if(timed&&(!Number.isSafeInteger(seconds)||seconds<1||seconds>366*86400))return toast("Time 1 se 31622400 seconds ke beech dein.","error");
 const ok=await confirmDestructive({title:chosen.toUpperCase()+" member?",message:`Action: ${chosen}\nMember ID: ${id}${timed?`\nTime: ${seconds} seconds`:""}${reason.value.trim()?`\nReason: ${reason.value.trim()}`:""},action:"Confirm "+chosen});if(!ok)return;review.disabled=true;
 try{const result=await api(`chats/${encodeURIComponent(chatID)}/actions`,{method:"POST",body:{action:chosen,target_user_id:id,reason:reason.value.trim(),duration_seconds:seconds,confirmed:true}});toast(result.message||"Action apply ho gaya.");haptic("success");}catch(error){toast(error.message||"Action nahi ho paya.","error");haptic("error");}finally{review.disabled=false;}});
 box.append(action,picker,target,duration,reason,review);return box;
}
function openSheet(command,module,chatID,chat){
 const admin=chat?.role==="admin",allowed=command.access==="member"||admin;
 const backdrop=el("div","ng-quick-backdrop ng-command-backdrop"),sheet=el("section","ng-quick-sheet ng-command-sheet");
 sheet.setAttribute("role","dialog");sheet.setAttribute("aria-modal","true");sheet.setAttribute("aria-labelledby","ng-command-sheet-title");
 const grab=el("div","ng-sheet-grabber"),head=el("div","ng-sheet-head"),title=el("h2","ng-sheet-title",command.name);title.id="ng-command-sheet-title";
 const close=el("button","ng-sheet-close","×");close.type="button";close.setAttribute("aria-label","Close command details");
 const content=el("div","ng-command-sheet-content");content.append(el("p","ng-command-sheet-title",command.title),el("p","ng-command-muted",command.what),el("span","ng-command-access",labels[command.access]));
 if(command.caution)content.append(el("p","ng-command-caution",command.caution));
 content.append(el("h3","ng-command-section-title","Kaise use karein"),el("p","ng-command-how",command.how));
 if(command.action==="settings"){content.append(el("h3","ng-command-section-title","Mini App mein dekhein"));const box=el("div","ng-command-route");const a=el("a","ng-command-primary","Security Center kholein");a.href=route(chatID,"settings");box.append(a,el("p","ng-command-route-hint",command.routeHint));content.append(box);}
 else if(command.action==="mini"||(command.action==="conditional"&&admin)){content.append(el("h3","ng-command-section-title","Mini App mein dekhein"));const box=el("div","ng-command-route");const a=el("a","ng-command-primary",command.routeLabel);a.href=route(chatID,command.route);box.append(a,el("p","ng-command-route-hint",command.routeHint));content.append(box);}
 else{content.append(el("h3","ng-command-section-title","Command example"));const ex=el("div","ng-command-example");ex.append(el("code","",command.example));content.append(ex,copyButton(command.example));}
 if(command.action==="direct"&&admin&&direct.has(command.name)){const toggle=el("button","ng-command-secondary","Direct action form kholein");toggle.type="button";const holder=el("div","ng-command-direct-holder");holder.hidden=true;holder.append(directForm(chatID,command));toggle.addEventListener("click",()=>{holder.hidden=!holder.hidden;toggle.textContent=holder.hidden?"Direct action form kholein":"Direct action form band karein";haptic("selection");});content.append(toggle,holder);}
 if(!allowed){const blocked=el("div","ng-command-blocked");blocked.append(el("strong","",command.access==="owner"?"Sirf group owner ke liye":"Sirf group admin ke liye"),el("p","","Aapke account ke liye yeh action available nahi hai. Apne group admin se baat karein."));content.append(blocked);for(const b of content.querySelectorAll("button,a")){b.setAttribute("aria-disabled","true");b.addEventListener("click",e=>{e.preventDefault();toast("Is command ke liye admin access chahiye.","error");});}}
 head.append(title,close);sheet.append(grab,head,content);backdrop.append(sheet);
 const dismiss=()=>{backdrop.remove();document.removeEventListener("keydown",key);haptic("light");};const key=e=>{if(e.key==="Escape")dismiss();};
 close.addEventListener("click",dismiss);backdrop.addEventListener("click",e=>{if(e.target===backdrop)dismiss();});document.body.append(backdrop);document.addEventListener("keydown",key);close.focus();haptic("light");
}
function commandRow(command,module,chatID,chat){
 const row=el("button","ng-command-row");row.type="button";row.append(el("span","ng-command-row-name",command.name));
 const copy=el("span","ng-command-row-copy");copy.append(el("strong","",command.title),el("small","",command.what));
 row.append(copy,el("span","ng-command-access",labels[command.access]),el("span","ng-command-chevron","›"));row.addEventListener("click",()=>openSheet(command,module,chatID,chat));return row;
}
export function renderCommands(root,chatID,chat){
 let active=null;root.append(el("p","ng-command-intro","Commands samjhein, example copy karein aur zaroori Mini App page kholein."));
 const search=document.createElement("input");search.type="search";search.placeholder="Module ya command search karein…";search.setAttribute("aria-label","Search modules and commands");search.className="ng-command-search";root.append(search,beginnerGuide());
 const back=el("button","ng-command-back","‹ Sabhi modules");back.type="button";back.hidden=true;root.append(back);
 const heading=el("h2","ng-command-level-heading","Command modules"),content=el("div","ng-command-content");root.append(heading,content);
 function modules(query=""){active=null;back.hidden=true;heading.textContent="Command modules";search.hidden=false;content.replaceChildren();const q=query.trim().toLocaleLowerCase();const found=commandModules.filter(m=>[m.title,m.intro,...m.commands.flatMap(c=>[c.name,c.title,c.what])].join(" ").toLocaleLowerCase().includes(q));if(!found.length){content.append(el("p","ng-command-empty","Koi module ya command nahi mila. Doosra naam search karein."));return;}
 const grid=el("div","ng-command-grid");for(const m of found){const tile=el("button","ng-command-module");tile.type="button";tile.append(iconTile(m));const copy=el("span","ng-command-module-copy");copy.append(el("strong","",m.title),el("small","",m.intro));tile.append(copy,el("span","ng-command-count",String(m.commands.length)));tile.addEventListener("click",()=>{search.value="";showModule(m);haptic("selection");});grid.append(tile);}content.append(grid);}
 function showModule(m){active=m;back.hidden=false;heading.textContent=m.title;search.hidden=true;content.replaceChildren();const hero=el("section","ng-command-module-hero"),copy=el("div","ng-command-module-hero-copy");copy.append(el("h3","",m.title),el("p","",m.intro));hero.append(iconTile(m),copy);content.append(hero);const list=el("div","ng-command-list");for(const c of m.commands)list.append(commandRow(c,m,chatID,chat));content.append(list);}
 back.addEventListener("click",()=>{modules(search.value);haptic("light");});search.addEventListener("input",()=>{if(!active)modules(search.value);});modules();
}
