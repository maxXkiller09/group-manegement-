import { api } from "../api.js?v=2026.11.17-phase1a";
import { clear, loading, setHeader, showError, textElement, toast } from "../ui.js?v=2026.11.16-bootfix1";

const PRESETS = {
  khula: { label: "Khula", description: "Basic protection", values: {
    "captcha.enabled": false, "captcha.mode": "math", "captcha.timeout": 2, "captcha.action": "kick", "captcha.max_attempts": 3,
    "antiflood.limit": 10, "antiflood.action": "tmute", "antiflood.action_time": 3600, "antiflood.delete_messages": false,
    "warns.limit": 5, "warns.mode": "tmute", "warns.action_time": 3600, "warns.expiry": 604800, "antiraid.auto_threshold": 0,
  }},
  balanced: { label: "Balanced", description: "Recommended balance", values: {
    "captcha.enabled": true, "captcha.mode": "math", "captcha.timeout": 2, "captcha.action": "kick", "captcha.max_attempts": 3,
    "antiflood.limit": 7, "antiflood.action": "tmute", "antiflood.action_time": 3600, "antiflood.delete_messages": true,
    "warns.limit": 3, "warns.mode": "tmute", "warns.action_time": 3600, "warns.expiry": 604800, "antiraid.auto_threshold": 0,
  }},
  sakht: { label: "Sakht", description: "Strict protection", values: {
    "captcha.enabled": true, "captcha.mode": "math", "captcha.timeout": 2, "captcha.action": "kick", "captcha.max_attempts": 3,
    "antiflood.limit": 5, "antiflood.action": "tmute", "antiflood.action_time": 21600, "antiflood.delete_messages": true,
    "warns.limit": 2, "warns.mode": "tmute", "warns.action_time": 21600, "warns.expiry": 259200, "antiraid.auto_threshold": 10,
  }},
};
const GROUPS = [
  ["captcha", "Captcha", "Naye members ko verify karne ke rules."],
  ["antiflood", "Flood", "Ek member ke 60 seconds ke andar limit se zyada messages par action hoga."],
  ["warns", "Warnings", "Warnings ki limit aur action update honge."],
  ["antiraid", "Antiraid", "Tez joins par automatic raid mode trigger hoga."],
];
const LABELS = {
  "captcha.enabled":"Captcha", "captcha.mode":"Captcha type", "captcha.timeout":"Answer time", "captcha.action":"Captcha fail action", "captcha.max_attempts":"Attempts",
  "antiflood.limit":"Flood limit", "antiflood.action":"Flood action", "antiflood.action_time":"Flood action duration", "antiflood.delete_messages":"Delete flood messages",
  "warns.limit":"Warning limit", "warns.mode":"Warning action", "warns.action_time":"Warning action duration", "warns.expiry":"Warning expiry",
  "antiraid.auto_threshold":"Automatic raid threshold", "greetings.welcome_enabled":"Welcome new members",
};
function indexFields(data) {
  const map = new Map();
  for (const module of data.modules || []) for (const field of module.fields || []) map.set(module.key + "." + field.key, field);
  return map;
}
function same(a,b) { return Array.isArray(a)&&Array.isArray(b) ? a.length===b.length&&a.every((v,i)=>v===b[i]) : a===b; }
function duration(n) {
  if (!Number.isInteger(n)||n<0) return "Unknown";
  if (!n) return "0s";
  const out=[];
  for (const [unit,size] of [["d",86400],["h",3600],["m",60],["s",1]]) if(n>=size){out.push(Math.floor(n/size)+unit);n%=size;}
  return out.join(" ");
}
function showValue(key,value) {
  if (key.endsWith(".enabled")||key.endsWith(".delete_messages")) return value?"On":"Off";
  if (key.endsWith("_time")||key==="warns.expiry") return duration(value);
  if (key==="antiraid.auto_threshold") return value===0?"Off":value+" joins / 60 sec";
  if (key==="antiflood.limit") return value===0?"Off":value+" messages";
  return String(value);
}
function lessProtection(key,before,after) {
  if(typeof before==="boolean"&&typeof after==="boolean") return before&&!after;
  if(["antiflood.limit","warns.limit","captcha.timeout","captcha.max_attempts"].includes(key)) return Number(after)>Number(before);
  if(key==="antiraid.auto_threshold") return Number(before)>0&&(Number(after)===0||Number(after)>Number(before));
  if(key==="warns.expiry") return Number(after)>0&&(Number(before)===0||Number(after)<Number(before));
  if(["antiflood.action_time","warns.action_time"].includes(key)) return Number(after)<Number(before);
  return false;
}
function svgIcon(ok) {
  const ns="http://www.w3.org/2000/svg",svg=document.createElementNS(ns,"svg");
  svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("class",ok?"ng-setup-status-icon success":"ng-setup-status-icon failure");
  svg.setAttribute("fill","none");svg.setAttribute("stroke","currentColor");svg.setAttribute("stroke-width","2");svg.setAttribute("stroke-linecap","round");svg.setAttribute("stroke-linejoin","round");
  const circle=document.createElementNS(ns,"circle");circle.setAttribute("cx","12");circle.setAttribute("cy","12");circle.setAttribute("r","9");
  const path=document.createElementNS(ns,"path");path.setAttribute("d",ok?"m8 12 2.5 2.5L16 9":"m9 9 6 6m0-6-6 6");svg.append(circle,path);return svg;
}
function panel(title,copy) { const el=document.createElement("section");el.className="ng-setup-card";el.append(textElement("h3",title,"ng-setup-card-title"),textElement("p",copy,"ng-setup-copy"));return el; }
function button(label,cls,fn) { const b=textElement("button",label,cls);b.type="button";b.addEventListener("click",fn);return b; }
function allOff(map) {
  return [["captcha.enabled",false],["antiflood.limit",0],["antiraid.auto_threshold",0],["antispam.aispam_enabled",false],["antispam.spamdb_enabled",false],["antispam.probation_enabled",false]].every(([k,v])=>map.has(k)&&same(map.get(k).value,v));
}

export async function renderProtectionSetup(root,chatID,chat={}) {
  clear(root);setHeader("Protection Setup",chat.title||"Your Telegram group");root.append(loading("Loading protection settings…"));
  const route=window.location.hash;let initial;
  try { initial=await api("chats/"+encodeURIComponent(chatID)+"/settings"); }
  catch(error){if(window.location.hash===route)showError(root,error,()=>renderProtectionSetup(root,chatID,chat));return;}
  if(window.location.hash!==route)return;
  const original=indexFields(initial),accessOK=chat.role==="admin"&&Boolean(chat.bot_admin)&&!initial.read_only;
  const state={step:1,preset:"",welcome:"unchanged",saved:[],failed:{},applied:{}};
  function planned() {
    const changes=new Map(),values=PRESETS[state.preset]?.values||{};
    for(const [key,value] of Object.entries(values)){const field=original.get(key);if(field?.writable&&!same(field.value,value))changes.set(key,value);}
    if(state.welcome!=="unchanged"){const key="greetings.welcome_enabled",value=state.welcome==="on",field=original.get(key);if(field?.writable&&!same(field.value,value))changes.set(key,value);}
    return changes;
  }
  const settingsURL="chats/"+encodeURIComponent(chatID)+"/settings";
  const getSettings=()=>api(settingsURL);
  const patch=changes=>api(settingsURL,{method:"PATCH",body:{changes}});
  function draw() {
    clear(root);
    const back=textElement("a","‹ Back to group","back-link");back.href="#/chats/"+encodeURIComponent(chatID);root.append(back);
    root.append(textElement("span","STEP "+state.step+" OF 3","ng-setup-eyebrow"),textElement("h2","Protection Setup","ng-setup-title"));
    if(state.step===1){
      const box=panel("Access check","Presets apply only when your Telegram account and NexGuard have admin access.");
      const checks=document.createElement("div");checks.className="ng-setup-checks";
      for(const [label,ok] of [["Admin access",chat.role==="admin"],["Bot is admin",Boolean(chat.bot_admin)]]){
        const row=document.createElement("div");row.className="ng-setup-check-row";row.append(svgIcon(ok),textElement("span",label,"ng-setup-check-label"),textElement("strong",ok?"Available":"Required",ok?"ng-setup-ok":"ng-setup-warn"));checks.append(row);
      }
      box.append(checks);
      if(!accessOK)box.append(textElement("p",chat.role!=="admin"?"Aap group admin nahi ho. Presets read-only rahenge.":"NexGuard ko group admin banao. Admin access ke bina settings apply nahi hongi.","callout warn"));
      else box.append(textElement("p","Can restrict ka verified field existing API mein nahi milta, isliye fake check nahi dikhaya gaya.","ng-setup-muted"));
      root.append(box);const next=button("Continue","primary",()=>{if(accessOK){state.step=2;draw();}});next.disabled=!accessOK;root.append(next);return;
    }
    if(state.step===2){
      const box=panel("Choose a protection preset","Preset sirf listed settings update karega. Locks aur AI Spam isme include nahi hain.");
      const choices=document.createElement("div");choices.className="ng-setup-presets";
      for(const [key,preset] of Object.entries(PRESETS)){
        const label=document.createElement("label");label.className="ng-setup-preset"+(state.preset===key?" selected":"");
        const radio=document.createElement("input");radio.type="radio";radio.name="ng-setup-preset";radio.value=key;radio.checked=state.preset===key;radio.addEventListener("change",()=>{state.preset=key;draw();});
        label.append(radio,textElement("strong",preset.label,"ng-setup-preset-title"),textElement("span",preset.description,"ng-setup-copy"));choices.append(label);
      }
      box.append(choices,textElement("p","Locks ke liye Security Center ya /lock command use karo.","ng-setup-muted"),textElement("p","AI Spam ke liye global AI setup chahiye.","ng-setup-muted"));
      const welcome=panel("Optional: Welcome message","Current setting: "+(original.get("greetings.welcome_enabled")?.value?"On":"Off")+". Default: unchanged.");
      const select=document.createElement("select");select.className="ng-setup-select";
      for(const [value,label] of [["unchanged","No change"],["on","Turn on"],["off","Turn off"]]){const option=new Option(label,value);option.selected=state.welcome===value;select.append(option);}
      select.addEventListener("change",()=>{state.welcome=select.value;});welcome.append(select,textElement("p","Existing welcome text stays unchanged. Default-message fallback is not confirmed by current code.","ng-setup-muted"));
      root.append(box,welcome);root.append(button("Review changes","primary",()=>{if(!state.preset){toast("Choose a preset first.","error");return;}state.step=3;draw();}));return;
    }
    const changes=planned(),review=panel("Review before applying","Sirf changed settings dikhengi. Apply se pehle values check kar lo.");
    if(!changes.size)review.append(textElement("p","Is preset se current settings mein koi change nahi hoga.","ng-setup-muted"));
    for(const [group,label,note] of GROUPS){
      const rows=Array.from(changes.entries()).filter(([key])=>key.startsWith(group+"."));
      if(!rows.length)continue;
      review.append(textElement("h4",label,"ng-setup-group-title"),textElement("p",note,"ng-setup-muted"));
      for(const [key,value] of rows){
        const row=document.createElement("div");row.className="ng-setup-diff";const copy=document.createElement("span");copy.className="ng-setup-diff-copy";
        copy.append(textElement("strong",LABELS[key]||key,"ng-setup-diff-label"),textElement("span",showValue(key,original.get(key)?.value)+" → "+showValue(key,value),"ng-setup-diff-value"));row.append(copy);
        if(lessProtection(key,original.get(key)?.value,value))row.append(textElement("span","Protection kam hogi","ng-setup-amber"));review.append(row);
      }
    }
    if(changes.has("antiraid.auto_threshold")&&changes.get("antiraid.auto_threshold")===10){
      review.append(textElement("h4","Antiraid preview","ng-setup-group-title"),textElement("p","10 eligible joins / 60 seconds par raid mode trigger hoga.","ng-setup-copy"));
      review.append(textElement("p","Raid ke dauran naye members kuch der ke liye ban honge","ng-setup-copy"));
      review.append(textElement("p","Raid duration: "+duration(original.get("antiraid.raid_time")?.value)+" (current)","ng-setup-muted"));
      review.append(textElement("p","New-member temporary ban: "+duration(original.get("antiraid.raid_action_time")?.value)+" (current)","ng-setup-muted"));
      review.append(textElement("p","Antiraid ke liye Redis chahiye","ng-setup-amber"));
    }
    if(changes.has("greetings.welcome_enabled"))review.append(textElement("p","Welcome: "+showValue("greetings.welcome_enabled",original.get("greetings.welcome_enabled")?.value)+" → "+showValue("greetings.welcome_enabled",changes.get("greetings.welcome_enabled")),"ng-setup-copy"));
    root.append(review,button("Apply changes","primary",()=>void apply()),button("Back","secondary",()=>{state.step=2;draw();}));
  }
  async function apply(retryOnly=false){
    const pending=planned();const changes=retryOnly?new Map(Array.from(pending).filter(([key])=>Object.prototype.hasOwnProperty.call(state.failed,key))):pending;if(!changes.size)return;
    let saved=[],failed={};
    try{const result=await patch(Object.fromEntries(changes));saved=result.saved||Array.from(changes.keys());failed=result.failed||{};}
    catch(error){const payload=error.payload||{};saved=payload.saved||[];failed=payload.failed||{};if(!saved.length&&!Object.keys(failed).length){toast(error.message||"Could not apply settings.","error");draw();return;}}
    state.saved=Array.from(new Set(state.saved.concat(saved)));state.failed=failed;
    if(state.saved.length){try{const latest=indexFields(await getSettings());for(const key of state.saved)if(latest.has(key))state.applied[key]=latest.get(key).value;}catch(error){toast("Save verify read failed; Undo will re-check each field.","error");}}
    state.step=4;resultScreen();
  }
  function resultScreen(){
    clear(root);root.append(textElement("span","RESULT","ng-setup-eyebrow"),textElement("h2","Apply result","ng-setup-title"));
    const saved=panel("Saved: "+state.saved.length,"API ne in fields ko save report kiya.");
    for(const key of state.saved){const row=document.createElement("div");row.className="ng-setup-result-row";row.append(svgIcon(true),textElement("span",LABELS[key]||key,"ng-setup-copy"));saved.append(row);}root.append(saved);
    const failed=Object.keys(state.failed);
    if(failed.length){const box=panel("Failed: "+failed.length,"Sirf failed fields retry honge.");for(const key of failed){const row=document.createElement("div");row.className="ng-setup-result-row";row.append(svgIcon(false),textElement("span",(LABELS[key]||key)+": "+state.failed[key],"ng-setup-copy"));box.append(row);}box.append(button("Retry failed","secondary",()=>void apply(true)));root.append(box);}
    if(state.saved.length)root.append(button("Undo saved changes","secondary",()=>void undo()));
    root.append(button("Back to group","primary",()=>{window.location.hash="#/chats/"+encodeURIComponent(chatID);}));
  }
  async function undo(){
    const restored=[],skipped=[],failed=[];
    for(const key of state.saved){
      if(!original.has(key)||!Object.prototype.hasOwnProperty.call(state.applied,key)){skipped.push(key);continue;}
      try{
        const latest=indexFields(await getSettings());
        if(!latest.has(key)||!same(latest.get(key).value,state.applied[key])){skipped.push(key);continue;}
        const response=await patch({[key]:original.get(key).value});
        if(response.saved?.includes(key)||!response.failed?.[key])restored.push(key);else failed.push(key);
      }catch(error){if(error.payload?.failed?.[key])failed.push(key);else skipped.push(key);}
    }
    clear(root);root.append(textElement("h2","Undo result","ng-setup-title"),textElement("p","Restored: "+restored.length,"ng-setup-copy"));
    if(skipped.length)root.append(textElement("p","Skipped because value changed after apply or could not be re-checked: "+skipped.map(k=>LABELS[k]||k).join(", "),"ng-setup-amber"));
    if(failed.length)root.append(textElement("p","Restore failed: "+failed.map(k=>LABELS[k]||k).join(", "),"callout warn"));
    root.append(button("Back to group","primary",()=>{window.location.hash="#/chats/"+encodeURIComponent(chatID);}));
  }
  draw();
  if(allOff(original))root.append(textElement("p","Is group mein available protection settings abhi off hain. Protection Setup se preset choose kar sakte ho.","ng-setup-suggestion"));
}
