import { useState, useRef, useEffect } from "react";

const C = {
  bg:"#0d0e12", panel:"#13151c", card:"#1a1d27", border:"#252836",
  orange:"#ff6b2b", green:"#22c55e", yellow:"#f59e0b", red:"#ef4444",
  blue:"#3d9eff", text:"#f0f0f5", muted:"#6b7080",
};

const DIFF_COLOR = { Easy:C.green, Medium:C.yellow, Hard:C.orange, Expert:C.red };

const LEVELS = [
  { id:"beginner",     icon:"🌱", label:"Beginner",     desc:"First project, basic tools only" },
  { id:"intermediate", icon:"⚙️", label:"Intermediate",  desc:"Some experience, power tools ok" },
  { id:"advanced",     icon:"🔥", label:"Advanced",      desc:"Comfortable with complex builds" },
];

const EXAMPLES = [
  "A computer cockpit gaming chair setup",
  "A standing desk from plywood and steel pipes",
  "A wall-mounted vertical herb garden from PVC",
  "A Raspberry Pi home security camera",
  "A wooden storage bench with hidden compartment",
  "An LED ring light for video calls",
];

// ─── ASSEMBLY LOADING ANIMATION ────────────────────────────────
function AssemblyLoader({ project }) {
  const [frame, setFrame] = useState(0);
  const [msg, setMsg] = useState(0);

  const msgs = [
    "Scanning your project...",
    "Sourcing materials...",
    "Calculating tools needed...",
    "Building safety checklist...",
    "Assembling step-by-step guide...",
    "Almost ready...",
  ];

  useEffect(() => {
    const t1 = setInterval(() => setFrame(f => f + 1), 120);
    const t2 = setInterval(() => setMsg(m => Math.min(m + 1, msgs.length - 1)), 1400);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  const pieces = [
    { id:"base",   x:90,  y:155, w:120, h:16, color:C.orange,   delay:0 },
    { id:"leftL",  x:90,  y:60,  w:12,  h:95, color:C.blue,     delay:3 },
    { id:"rightL", x:198, y:60,  w:12,  h:95, color:C.blue,     delay:6 },
    { id:"arch",   x:90,  y:48,  w:120, h:24, color:C.orange,   delay:9, rx:12 },
    { id:"seat",   x:108, y:105, w:84,  h:50, color:"#2a2d3a",  delay:12 },
    { id:"monitor",x:115, y:62,  w:70,  h:40, color:C.panel,    delay:15 },
    { id:"mBorder",x:115, y:62,  w:70,  h:40, color:C.blue,     delay:15, fill:false },
    { id:"kbd",    x:100, y:128, w:50,  h:10, color:"#1e2030",  delay:18 },
    { id:"glow1",  x:90,  y:168, w:120, h:4,  color:C.orange,   delay:21 },
  ];

  const TOTAL_FRAMES = 200;
  const progress = Math.min(frame / TOTAL_FRAMES, 1);

  const getPieceStyle = (piece) => {
    const startProgress = piece.delay / 100;
    const localP = Math.max(0, Math.min(1, (progress - startProgress) / 0.25));
    const eased = localP < 0.5 ? 2*localP*localP : -1+(4-2*localP)*localP;
    const fromY = piece.y - 80;
    const fromX = piece.id.includes("right") ? piece.x + 60 : piece.id.includes("left") ? piece.x - 60 : piece.x;
    return {
      x: fromX + (piece.x - fromX) * eased,
      y: fromY + (piece.y - fromY) * eased,
      opacity: eased,
    };
  };

  const sparkAngles = [0,45,90,135,180,225,270,315];
  const sparkP = Math.max(0, (progress - 0.85) / 0.15);

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px", gap:24 }}>

      {/* SVG Assembly */}
      <div style={{ position:"relative", width:300, height:220 }}>
        <svg width="300" height="220" style={{ overflow:"visible" }}>
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Grid lines for workshop feel */}
          {[0,1,2,3,4,5].map(i => (
            <line key={`h${i}`} x1="0" y1={i*40} x2="300" y2={i*40} stroke={C.border} strokeWidth="0.5" opacity="0.4"/>
          ))}
          {[0,1,2,3,4,5,6,7].map(i => (
            <line key={`v${i}`} x1={i*50} y1="0" x2={i*50} y2="220" stroke={C.border} strokeWidth="0.5" opacity="0.4"/>
          ))}

          {/* Assembly pieces */}
          {pieces.map(piece => {
            const ps = getPieceStyle(piece);
            if (piece.fill === false) return (
              <rect key={piece.id} x={ps.x} y={ps.y} width={piece.w} height={piece.h}
                rx={piece.rx||3} fill="none" stroke={piece.color} strokeWidth="1.5"
                opacity={ps.opacity} filter="url(#glow)"/>
            );
            return (
              <rect key={piece.id} x={ps.x} y={ps.y} width={piece.w} height={piece.h}
                rx={piece.rx||3} fill={piece.color}
                opacity={ps.opacity * (piece.id==="glow1" ? 0.6 : 1)}
                filter={piece.id==="glow1"?"url(#glow)":undefined}/>
            );
          })}

          {/* Connecting dots appear mid-assembly */}
          {progress > 0.5 && [
            [90,60],[210,60],[90,155],[210,155]
          ].map(([cx,cy],i) => (
            <circle key={i} cx={cx} cy={cy} r={4} fill={C.orange}
              opacity={Math.min(1, (progress-0.5)/0.2)}
              filter="url(#glow)"/>
          ))}

          {/* Spark burst at completion */}
          {sparkP > 0 && sparkAngles.map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const dist = sparkP * 30;
            return (
              <line key={i}
                x1={150} y1={100}
                x2={150 + Math.cos(rad)*dist} y2={100 + Math.sin(rad)*dist}
                stroke={i%2===0?C.orange:C.yellow} strokeWidth="2"
                strokeLinecap="round"
                opacity={1-sparkP}/>
            );
          })}

          {/* Check mark at full completion */}
          {progress > 0.95 && (
            <g opacity={Math.min(1,(progress-0.95)/0.05)} filter="url(#glow)">
              <circle cx="150" cy="100" r="22" fill={C.green} opacity="0.15"/>
              <polyline points="138,100 146,108 163,91"
                fill="none" stroke={C.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </g>
          )}
        </svg>

        {/* Floating part labels */}
        {progress < 0.3 && (
          <div style={{ position:"absolute", top:10, left:10, fontSize:11, color:C.orange, fontFamily:"monospace", fontWeight:700, opacity:1-progress/0.3 }}>
            {["BASE_PLATE", "FRAME_L", "ARCH_TOP"][Math.floor(frame/20)%3]}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ width:"100%", maxWidth:260 }}>
        <div style={{ background:C.border, borderRadius:4, height:4, marginBottom:10 }}>
          <div style={{ background:`linear-gradient(90deg,${C.orange},${C.yellow})`, height:"100%", borderRadius:4, width:`${Math.round(progress*100)}%`, transition:"width 0.1s" }}/>
        </div>
        <div style={{ fontSize:14, color:C.muted, textAlign:"center", minHeight:20, transition:"opacity 0.3s" }}>
          {msgs[msg]}
        </div>
      </div>

      {/* Project name */}
      <div style={{ fontSize:13, color:C.orange, fontWeight:700, letterSpacing:1, opacity:0.7, textAlign:"center" }}>
        {project.length > 40 ? project.slice(0,40)+"..." : project}
      </div>
    </div>
  );
}

// ─── STEP GRAPHIC ───────────────────────────────────────────────
function StepGraphic({ index, color }) {
  const graphs = [
    <svg viewBox="0 0 120 70" width="120" height="70">
      <rect x="10" y="28" width="100" height="14" rx="2" fill={color+"22"} stroke={color} strokeWidth="1.2"/>
      {[0,10,20,30,40,50,60,70,80,90,100].map((x,i)=>(
        <line key={i} x1={10+x} y1="28" x2={10+x} y2={i%5===0?"20":"24"} stroke={color} strokeWidth="0.8"/>
      ))}
      <line x1="45" y1="14" x2="45" y2="42" stroke={C.orange} strokeWidth="1.5" strokeDasharray="3,2"/>
      <text x="48" y="19" fill={C.orange} fontSize="7" fontFamily="monospace">35cm</text>
    </svg>,
    <svg viewBox="0 0 120 70" width="120" height="70">
      <rect x="15" y="20" width="90" height="30" rx="3" fill={color+"22"} stroke={color} strokeWidth="1.2"/>
      <line x1="60" y1="15" x2="60" y2="55" stroke={C.orange} strokeWidth="2" strokeDasharray="4,3"/>
      <polygon points="55,10 65,10 60,18" fill={C.orange}/>
      <polygon points="55,60 65,60 60,52" fill={C.orange}/>
      <text x="64" y="38" fill={color} fontSize="8" fontFamily="monospace">CUT</text>
    </svg>,
    <svg viewBox="0 0 120 70" width="120" height="70">
      <rect x="10" y="28" width="100" height="18" rx="3" fill={color+"22"} stroke={color} strokeWidth="1.2"/>
      {[25,50,75].map((x,i)=>(
        <g key={i}>
          <circle cx={x} cy="37" r="5" fill="none" stroke={C.orange} strokeWidth="1.2"/>
          <line x1={x} y1="28" x2={x} y2="18" stroke={C.orange} strokeWidth="1.2" strokeDasharray="2,2"/>
          <polygon points={`${x-3},18 ${x+3},18 ${x},12`} fill={C.orange}/>
        </g>
      ))}
    </svg>,
    <svg viewBox="0 0 120 70" width="120" height="70">
      <rect x="5" y="25" width="45" height="20" rx="3" fill={color+"33"} stroke={color} strokeWidth="1.2"/>
      <rect x="70" y="25" width="45" height="20" rx="3" fill={color+"33"} stroke={color} strokeWidth="1.2"/>
      <line x1="50" y1="35" x2="70" y2="35" stroke={C.orange} strokeWidth="2" strokeDasharray="4,3"/>
      <circle cx="60" cy="35" r="7" fill={C.orange}/>
      <text x="56.5" y="38.5" fill="#fff" fontSize="9" fontWeight="bold">+</text>
    </svg>,
    <svg viewBox="0 0 120 70" width="120" height="70">
      <rect x="15" y="15" width="90" height="40" rx="6" fill={color+"22"} stroke={color} strokeWidth="1.2"/>
      <polyline points="30,38 48,50 88,25" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="60" cy="35" r="16" fill="none" stroke={C.green} strokeWidth="1" strokeDasharray="3,3" opacity="0.5"/>
    </svg>,
  ];
  return <div style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>{graphs[index % graphs.length]}</div>;
}

// ─── MAIN ──────────────────────────────────────────────────────
export default function MakeIt() {
  const [screen, setScreen]     = useState("home");
  const [level, setLevel]       = useState(null);
  const [prompt, setPrompt]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [plan, setPlan]         = useState(null);
  const [tab, setTab]           = useState("steps");
  const [done, setDone]         = useState(new Set());
  const [chat, setChat]         = useState([]);
  const [chatQ, setChatQ]       = useState("");
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chat, loading]);

  const callAI = async (userMsg, sys) => {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:1000, system:sys, messages:[{role:"user",content:userMsg}] }),
    });
    const d = await r.json();
    return d.content?.[0]?.text || "";
  };

  const generate = async () => {
    setLoading(true); setPlan(null); setDone(new Set()); setChat([]); setTab("steps");
    setScreen("build");
    const sys = `You are MakeIt AI — expert maker guide. Respond ONLY with valid JSON, no markdown fences.
Return exactly:
{"title":"...","tagline":"...","estimatedTime":"...","estimatedCost":"...","overview":"...","safety":[{"icon":"emoji","rule":"..."}],"materials":[{"name":"...","qty":"...","approxCost":"$X","tip":"..."}],"tools":[{"name":"...","required":true,"alternative":"...or null"}],"steps":[{"title":"...","duration":"X min","difficulty":"Easy|Medium|Hard|Expert","what":"...","how":"...","safetyNote":"...or null"}],"proTips":["..."],"finalNote":"..."}
Level: ${level}. Beginner=6-8 steps, Intermediate=8-12, Advanced=10-15. Be specific with measurements.`;
    try {
      const raw = await callAI(`Build: ${prompt}\nLevel: ${level}`, sys);
      const clean = raw.replace(/```json|```/g,"").trim();
      setPlan(JSON.parse(clean));
      setChat([{role:"ai", text:`Your **${JSON.parse(clean).title}** plan is ready! Ask me anything about the build. 💪`}]);
    } catch(e) {
      setChat([{role:"ai", text:"Couldn't generate plan. Try rephrasing your idea."}]);
    }
    setLoading(false);
  };

  const sendChat = async () => {
    if (!chatQ.trim() || loading) return;
    const q = chatQ.trim(); setChatQ("");
    setChat(p => [...p, {role:"user",text:q}]);
    setLoading(true);
    const ctx = plan ? `Building: ${plan.title}. Steps: ${plan.steps.map((s,i)=>`${i+1}.${s.title}`).join(",")}` : "";
    const sys = `You are MakeIt AI — helpful maker guide. ${ctx} Answer build questions concisely (3-5 sentences). Use plain language.`;
    try {
      const reply = await callAI(q, sys);
      setChat(p => [...p, {role:"ai",text:reply}]);
    } catch { setChat(p => [...p, {role:"ai",text:"Try again."}]); }
    setLoading(false);
  };

  const toggleDone = i => setDone(p => { const n=new Set(p); n.has(i)?n.delete(i):n.add(i); return n; });
  const pct = plan ? Math.round((done.size/plan.steps.length)*100) : 0;

  const B = {
    app:{ background:C.bg, minHeight:"100vh", color:C.text, fontFamily:"'Inter',system-ui,sans-serif", display:"flex", flexDirection:"column", maxWidth:480, margin:"0 auto" },
    // home
    hero:{ padding:"36px 22px 24px", background:`linear-gradient(160deg,${C.panel},${C.bg})`, borderBottom:`1px solid ${C.border}` },
    eyebrow:{ fontSize:10, fontWeight:700, letterSpacing:3, color:C.orange, marginBottom:10 },
    h1:{ fontSize:32, fontWeight:900, lineHeight:1.1, margin:"0 0 10px", letterSpacing:-1 },
    sub:{ fontSize:14, color:C.muted, lineHeight:1.6, margin:"0 0 22px" },
    inputBox:{ background:C.card, borderRadius:14, border:`1.5px solid ${C.border}`, overflow:"hidden" },
    ta:{ width:"100%", background:"transparent", border:"none", outline:"none", color:C.text, fontSize:15, padding:"14px 16px 10px", resize:"none", fontFamily:"inherit", boxSizing:"border-box" },
    taFoot:{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", borderTop:`1px solid ${C.border}` },
    charC:{ fontSize:11, color:C.muted },
    nextBtn:{ background:C.orange, color:"#fff", border:"none", borderRadius:10, padding:"9px 18px", fontSize:14, fontWeight:700, cursor:"pointer" },
    exWrap:{ padding:"20px 20px 0" },
    secLbl:{ fontSize:10, fontWeight:700, letterSpacing:2, color:C.muted, marginBottom:10 },
    exChip:{ width:"100%", background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"11px 14px", fontSize:13, color:C.text, cursor:"pointer", textAlign:"left", marginBottom:8, display:"flex", alignItems:"center", gap:8 },
    // level
    lvlWrap:{ flex:1, padding:"28px 20px" },
    back:{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:13, marginBottom:22, padding:0 },
    lvlTitle:{ fontSize:22, fontWeight:800, marginBottom:4, letterSpacing:-0.5 },
    lvlSub:{ fontSize:13, color:C.muted, marginBottom:24 },
    lvlCard:(a)=>({ background:a?C.orange+"22":C.card, border:`1.5px solid ${a?C.orange:C.border}`, borderRadius:14, padding:"16px 18px", cursor:"pointer", display:"flex", alignItems:"center", gap:12, marginBottom:10 }),
    lvlIcon:{ fontSize:26, width:44, height:44, display:"flex", alignItems:"center", justifyContent:"center", background:C.panel, borderRadius:10 },
    lvlName:{ fontSize:15, fontWeight:700, marginBottom:2 },
    lvlDesc:{ fontSize:12, color:C.muted },
    buildBtn:{ marginTop:24, background:C.orange, color:"#fff", border:"none", borderRadius:14, padding:"15px", fontSize:15, fontWeight:800, width:"100%", cursor:"pointer" },
    // build header
    bHdr:{ background:C.panel, borderBottom:`1px solid ${C.border}`, padding:"14px 16px" },
    bBack:{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:12, marginBottom:8, padding:0 },
    bTitle:{ fontSize:18, fontWeight:800, margin:"0 0 6px", letterSpacing:-0.5 },
    bMeta:{ display:"flex", gap:10, flexWrap:"wrap" },
    badge:(col)=>({ fontSize:11, fontWeight:700, color:col, background:col+"22", padding:"2px 10px", borderRadius:20 }),
    progWrap:{ padding:"12px 16px", background:C.panel, borderBottom:`1px solid ${C.border}` },
    progTrack:{ background:C.border, borderRadius:3, height:4, marginBottom:6 },
    progFill:{ background:`linear-gradient(90deg,${C.orange},${C.yellow})`, height:"100%", borderRadius:3, transition:"width 0.4s" },
    progRow:{ display:"flex", justifyContent:"space-between", fontSize:11 },
    tabs:{ display:"flex", background:C.panel, borderBottom:`1px solid ${C.border}` },
    tabB:(a)=>({ flex:1, padding:"11px 4px", background:"none", border:"none", borderBottom:a?`2px solid ${C.orange}`:`2px solid transparent`, color:a?C.orange:C.muted, fontSize:11, fontWeight:700, cursor:"pointer", letterSpacing:0.5 }),
    scroll:{ flex:1, overflowY:"auto", padding:"14px 14px 80px" },
    // step card
    sCard:(d)=>({ background:d?C.green+"0d":C.card, border:`1px solid ${d?C.green+"44":C.border}`, borderRadius:12, marginBottom:10, overflow:"hidden" }),
    sHdr:(col)=>({ background:col+"11", borderBottom:`1px solid ${col+"33"}`, padding:"10px 14px", display:"flex", alignItems:"center", gap:8 }),
    sNum:(col)=>({ width:26, height:26, borderRadius:"50%", background:col+"22", border:`2px solid ${col}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:col, flexShrink:0 }),
    sTitle:{ flex:1, fontSize:13, fontWeight:700 },
    sDur:{ fontSize:10, color:C.muted, background:C.panel, padding:"2px 7px", borderRadius:10 },
    diffB:(d)=>({ fontSize:10, fontWeight:800, letterSpacing:0.8, color:DIFF_COLOR[d]||C.muted, background:(DIFF_COLOR[d]||C.muted)+"22", padding:"2px 8px", borderRadius:10 }),
    gfxBox:{ height:100, background:C.panel, display:"flex", alignItems:"center", justifyContent:"center", padding:"8px 16px" },
    sBdy:{ padding:"12px 14px" },
    sWhat:{ fontSize:14, fontWeight:600, marginBottom:5, lineHeight:1.4 },
    sHow:{ fontSize:12, color:C.muted, lineHeight:1.6, marginBottom:8 },
    warnBox:{ background:C.red+"11", border:`1px solid ${C.red+"33"}`, borderRadius:7, padding:"7px 11px", fontSize:12, color:C.red, marginBottom:8 },
    checkB:(d)=>({ width:"100%", padding:"9px", borderRadius:9, border:`1.5px solid ${d?C.green:C.border}`, background:d?C.green+"22":"transparent", color:d?C.green:C.muted, cursor:"pointer", fontSize:13, fontWeight:700 }),
    // list items
    lCard:{ background:C.card, border:`1px solid ${C.border}`, borderRadius:11, marginBottom:8, padding:"12px 14px" },
    lRow:{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 },
    lName:{ fontSize:14, fontWeight:600 },
    lQty:{ fontSize:13, color:C.orange, fontWeight:700 },
    lTip:{ fontSize:12, color:C.muted, lineHeight:1.4 },
    lCost:{ fontSize:12, color:C.green, fontWeight:600, marginBottom:2 },
    reqB:{ fontSize:10, fontWeight:700, letterSpacing:0.8, color:C.blue, background:C.blue+"22", padding:"2px 8px", borderRadius:10 },
    // safety
    sfCard:{ background:C.card, border:`1px solid ${C.yellow+"44"}`, borderRadius:11, padding:"12px 14px", marginBottom:8, display:"flex", gap:10, alignItems:"flex-start" },
    sfIcon:{ fontSize:22, flexShrink:0 },
    sfText:{ fontSize:13, lineHeight:1.5 },
    ovCard:{ background:C.card, border:`1px solid ${C.border}`, borderRadius:11, padding:"14px", marginBottom:10 },
    ptCard:{ background:C.orange+"11", border:`1px solid ${C.orange+"33"}`, borderRadius:11, padding:"12px 14px", marginBottom:8 },
    // chat
    chatScroll:{ flex:1, overflowY:"auto", padding:"14px 14px 0", display:"flex", flexDirection:"column", gap:10 },
    bubble:(r)=>({ maxWidth:"85%", alignSelf:r==="user"?"flex-end":"flex-start", background:r==="user"?C.orange:C.card, border:`1px solid ${r==="user"?C.orange:C.border}`, borderRadius:r==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px", padding:"9px 13px", fontSize:13, lineHeight:1.6 }),
    chatFoot:{ padding:"10px 14px", background:C.panel, borderTop:`1px solid ${C.border}`, display:"flex", gap:8, alignItems:"flex-end" },
    chatIn:{ flex:1, background:C.card, border:`1px solid ${C.border}`, borderRadius:11, padding:"9px 12px", color:C.text, fontSize:13, fontFamily:"inherit", outline:"none", resize:"none", minHeight:40 },
    sendB:{ background:C.orange, border:"none", borderRadius:9, width:40, height:40, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  };

  const css = `*{box-sizing:border-box} ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px} @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}`;

  if (screen === "home") return (
    <div style={B.app}>
      <style>{css}</style>
      <div style={B.hero}>
        <div style={B.eyebrow}>⚡ AI MAKER GUIDE</div>
        <h1 style={B.h1}>Build<br/><span style={{color:C.orange}}>anything.</span></h1>
        <p style={B.sub}>Describe what you want to make — get tools, materials, safety guide, and step-by-step visual instructions.</p>
        <div style={B.inputBox}>
          <textarea style={B.ta} placeholder="What do you want to build? e.g. 'A cockpit gaming chair setup'" value={prompt} onChange={e=>setPrompt(e.target.value.slice(0,280))} rows={3}/>
          <div style={B.taFoot}>
            <span style={B.charC}>{prompt.length}/280</span>
            <button style={B.nextBtn} onClick={()=>prompt.trim()&&setScreen("level")}>Next →</button>
          </div>
        </div>
      </div>
      <div style={B.exWrap}>
        <div style={B.secLbl}>IDEAS TO START WITH</div>
        {EXAMPLES.map((ex,i)=>(
          <button key={i} style={B.exChip} onClick={()=>setPrompt(ex)}>
            <span style={{color:C.orange}}>→</span>{ex}
          </button>
        ))}
      </div>
    </div>
  );

  if (screen === "level") return (
    <div style={B.app}>
      <style>{css}</style>
      <div style={B.lvlWrap}>
        <button style={B.back} onClick={()=>setScreen("home")}>← Back</button>
        <div style={B.lvlTitle}>Your skill level?</div>
        <div style={B.lvlSub}>This shapes how detailed the instructions get.</div>
        {LEVELS.map(l=>(
          <button key={l.id} style={B.lvlCard(level===l.id)} onClick={()=>setLevel(l.id)}>
            <div style={B.lvlIcon}>{l.icon}</div>
            <div style={{flex:1}}>
              <div style={B.lvlName}>{l.label}</div>
              <div style={B.lvlDesc}>{l.desc}</div>
            </div>
            {level===l.id && <span style={{color:C.orange}}>✓</span>}
          </button>
        ))}
        {level && <button style={B.buildBtn} onClick={generate}>⚡ Generate My Build Plan</button>}
      </div>
    </div>
  );

  if (screen === "build" && loading && !plan) return (
    <div style={{...B.app, height:"100vh"}}>
      <style>{css}</style>
      <div style={B.bHdr}>
        <button style={B.bBack} onClick={()=>{setScreen("home");setLoading(false);}}>← Back</button>
        <div style={{fontSize:12, color:C.muted}}>Generating your build plan...</div>
      </div>
      <AssemblyLoader project={prompt}/>
    </div>
  );

  if (screen === "build" && plan) {
    const TABS = [["steps","📋 STEPS"],["parts","🔩 PARTS"],["safety","🛡 SAFETY"],["chat","💬 ASK"]];
    return (
      <div style={{...B.app, height:"100vh", overflow:"hidden"}}>
        <style>{css}</style>
        <div style={B.bHdr}>
          <button style={B.bBack} onClick={()=>setScreen("home")}>← New Build</button>
          <div style={B.bTitle}>{plan.title}</div>
          <div style={B.bMeta}>
            <span style={B.badge(C.orange)}>⏱ {plan.estimatedTime}</span>
            <span style={B.badge(C.green)}>💰 {plan.estimatedCost}</span>
            <span style={B.badge(C.blue)}>📊 {level}</span>
          </div>
        </div>
        {tab==="steps" && (
          <div style={B.progWrap}>
            <div style={B.progTrack}><div style={{...B.progFill, width:`${pct}%`}}/></div>
            <div style={B.progRow}>
              <span style={{color:C.muted}}>{done.size}/{plan.steps.length} steps done</span>
              <span style={{color:pct===100?C.green:C.orange, fontWeight:700}}>{pct}%</span>
            </div>
          </div>
        )}
        <div style={B.tabs}>
          {TABS.map(([id,lbl])=>(
            <button key={id} style={B.tabB(tab===id)} onClick={()=>setTab(id)}>{lbl}</button>
          ))}
        </div>

        {tab==="steps" && (
          <div style={B.scroll}>
            {plan.steps.map((step,i)=>{
              const d = done.has(i);
              const col = DIFF_COLOR[step.difficulty]||C.blue;
              return (
                <div key={i} style={B.sCard(d)}>
                  <div style={B.sHdr(col)}>
                    <div style={B.sNum(d?C.green:col)}>{d?"✓":i+1}</div>
                    <span style={B.sTitle}>{step.title}</span>
                    <span style={B.diffB(step.difficulty)}>{step.difficulty}</span>
                    <span style={B.sDur}>{step.duration}</span>
                  </div>
                  <div style={B.gfxBox}><StepGraphic index={i} color={d?C.green:col}/></div>
                  <div style={B.sBdy}>
                    <div style={B.sWhat}>{step.what}</div>
                    <div style={B.sHow}>{step.how}</div>
                    {step.safetyNote && <div style={B.warnBox}>⚠️ {step.safetyNote}</div>}
                    <button style={B.checkB(d)} onClick={()=>toggleDone(i)}>
                      {d?"✅ Done — tap to undo":"Mark Complete"}
                    </button>
                  </div>
                </div>
              );
            })}
            {pct===100 && (
              <div style={{...B.ovCard, background:C.green+"11", border:`1px solid ${C.green+"44"}`, textAlign:"center", padding:24}}>
                <div style={{fontSize:32, marginBottom:8}}>🎉</div>
                <div style={{fontSize:17, fontWeight:800, color:C.green, marginBottom:6}}>Build Complete!</div>
                <div style={{fontSize:13, color:C.muted}}>{plan.finalNote}</div>
              </div>
            )}
          </div>
        )}

        {tab==="parts" && (
          <div style={B.scroll}>
            <div style={B.secLbl}>MATERIALS</div>
            {plan.materials.map((m,i)=>(
              <div key={i} style={B.lCard}>
                <div style={B.lRow}><span style={B.lName}>{m.name}</span><span style={B.lQty}>{m.qty}</span></div>
                <div style={B.lCost}>{m.approxCost}</div>
                {m.tip && <div style={B.lTip}>💡 {m.tip}</div>}
              </div>
            ))}
            <div style={{...B.secLbl, marginTop:16}}>TOOLS</div>
            {plan.tools.map((t,i)=>(
              <div key={i} style={B.lCard}>
                <div style={B.lRow}><span style={B.lName}>{t.name}</span><span style={B.reqB}>{t.required?"REQUIRED":"OPTIONAL"}</span></div>
                {t.alternative && <div style={B.lTip}>🔄 Alt: {t.alternative}</div>}
              </div>
            ))}
          </div>
        )}

        {tab==="safety" && (
          <div style={B.scroll}>
            <div style={B.ovCard}>
              <div style={{fontSize:10, fontWeight:700, letterSpacing:2, color:C.muted, marginBottom:8}}>OVERVIEW</div>
              <div style={{fontSize:13, color:C.muted, lineHeight:1.7}}>{plan.overview}</div>
            </div>
            <div style={{...B.secLbl, color:C.yellow}}>⚠️ SAFETY RULES</div>
            {plan.safety.map((s,i)=>(
              <div key={i} style={B.sfCard}>
                <div style={B.sfIcon}>{s.icon}</div>
                <div style={B.sfText}>{s.rule}</div>
              </div>
            ))}
            {plan.proTips?.length > 0 && <>
              <div style={{...B.secLbl, color:C.orange, marginTop:12}}>🔥 PRO TIPS</div>
              {plan.proTips.map((t,i)=>(
                <div key={i} style={B.ptCard}><div style={{fontSize:13, lineHeight:1.5}}>→ {t}</div></div>
              ))}
            </>}
          </div>
        )}

        {tab==="chat" && (
          <div style={{flex:1, display:"flex", flexDirection:"column", overflow:"hidden"}}>
            <div ref={chatRef} style={B.chatScroll}>
              {chat.map((m,i)=>(
                <div key={i} style={B.bubble(m.role)}>{m.text}</div>
              ))}
              {loading && (
                <div style={{...B.bubble("ai"), display:"flex", gap:5, alignItems:"center"}}>
                  {[0,1,2].map(i=>(
                    <div key={i} style={{width:6,height:6,borderRadius:"50%",background:C.orange,animation:`pulse 1s ${i*0.25}s infinite`}}/>
                  ))}
                </div>
              )}
            </div>
            <div style={B.chatFoot}>
              <textarea style={B.chatIn} placeholder="Ask anything about this build..." value={chatQ}
                onChange={e=>setChatQ(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat();}}}
                rows={1}/>
              <button style={B.sendB} onClick={sendChat}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return <div style={B.app}><div style={{padding:40,color:C.muted,textAlign:"center"}}>Loading...</div></div>;
}
