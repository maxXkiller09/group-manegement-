import { telegram } from "./api.js";
import { renderChat, renderSection } from "./screens/chat.js";
import { renderChats } from "./screens/chats.js";
import { renderHome } from "./screens/home.js";
import { blocksLeave, confirmDestructive, haptic, leaveScreen, setLeaveGuard, supports } from "./ui.js";
telegram?.ready(); telegram?.expand();
if (supports("6.1")) { telegram.setHeaderColor("secondary_bg_color"); telegram.setBackgroundColor("secondary_bg_color"); }
const root=document.getElementById("app");
function launchChatID(){const q=new URLSearchParams(window.location.search).get("chat");const s=/^chat_(-?\d+)$/.exec(telegram?.initDataUnsafe?.start_param??"")?.[1];const v=q||s||"";return /^-?\d+$/.test(v)&&v!=="0"?v:null;}
const routePattern=/^#\/chats\/(-?\d+)(?:\/([a-z-]+))?$/;
function parentRoute(hash){const m=routePattern.exec(hash);if(!m)return null;return m[2]?`#/chats/${m[1]}`:"#/groups";}
function syncBackButton(){if(!supports("6.1"))return;if(parentRoute(location.hash))telegram.BackButton.show();else telegram.BackButton.hide();}
function renderNavigation(){document.getElementById("nexguard-nav")?.remove();const nav=document.createElement("nav");nav.id="nexguard-nav";nav.className="bottom-nav";nav.setAttribute("aria-label","Main navigation");const h=location.hash;const active=h.startsWith("#/chats/")||h==="#/groups"?"groups":h==="#/account"?"account":h==="#/activity"?"inbox":"home";for(const [key,glyph,label,href] of [["home","⌂","Home","#/"],["groups","▦","Groups","#/groups"],["add","+","Add","add"],["inbox","▤","Inbox","#/activity"],["account","◉","Account","#/account"]]){const a=document.createElement("a");a.className="bottom-nav-item"+(key===active?" active":"")+(key==="add"?" add-tab":"");a.href=key==="add"?"https://t.me/NexGuardd_Bot?startgroup=true":href;a.append(document.createTextNode(glyph),Object.assign(document.createElement("span"),{textContent:label}));nav.append(a);}document.body.append(nav);}
function render(){leaveScreen();syncBackButton();renderNavigation();window.scrollTo(0,0);const h=location.hash,m=routePattern.exec(h);if(m&&m[2])return renderSection(root,m[1],m[2]);if(m)return renderChat(root,m[1]);if(h==="#/groups")return renderChats(root);if(h==="#/account")return renderHome(root,"account");if(h==="#/activity")return renderHome(root,"activity");return renderHome(root);}
let currentHash="",confirming=false;
async function navigate(){const target=location.hash;if(target===currentHash)return;if(blocksLeave()){history.replaceState(null,"",currentHash||location.pathname+location.search);if(confirming)return;confirming=true;const ok=await confirmDestructive({title:"Discard changes?",message:"You have unsaved changes on this screen. Leaving now loses them.",action:"Discard"}).finally(()=>confirming=false);if(!ok)return;setLeaveGuard(null);location.hash=target;return;}currentHash=target;render();}
if(root){if(!location.hash){const id=launchChatID();if(id)history.replaceState(null,"",`#/chats/${id}`);}if(supports("6.1"))telegram.BackButton.onClick(()=>{const p=parentRoute(location.hash);if(p){haptic("light");location.hash=p;}});window.addEventListener("hashchange",navigate);currentHash=location.hash;render();}
