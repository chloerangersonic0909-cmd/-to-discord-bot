import React, { useEffect, useState } from 'react';
import { Activity, Bell, Bot, Check, ChevronDown, Code2, Home, Menu, Moon, Palette, Plus, Search, Server, Settings, ShieldCheck, Sun, UserRound, Users, X, Github, Trash2, Copy, Save, Terminal, FileCode2, Pencil } from 'lucide-react';

const menu = [
  ['ภาพรวม', Home], ['บอตของฉัน', Bot], ['คำสั่งและโค้ด', Code2],
  ['กิจกรรม', Activity], ['การแจ้งเตือน', Bell], ['โปรไฟล์', UserRound],
  ['การตั้งค่า', Settings], ['ผู้ดูแลระบบ', ShieldCheck]
];
const starterBots = [
  { id: 1, name: 'TO Helper', tag: 'ตัวอย่างบอต', status: 'ออนไลน์', servers: 12 },
  { id: 2, name: 'Music Studio', tag: 'ตัวอย่างบอต', status: 'ออฟไลน์', servers: 4 }
];
function Toggle({ value, onChange }) {
  return <button className={'toggle ' + (value ? 'on' : '')} onClick={() => onChange(!value)} aria-label="สลับการตั้งค่า"><i /></button>;
}
function CardStat({ icon: Icon, label, value, note }) {
  return <div className="stat"><span className="stat-icon"><Icon size={19}/></span><p>{label}</p><strong>{value}</strong><small>{note}</small></div>;
}
export default function App() {
  const [page, setPage] = useState('ภาพรวม');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [bots, setBots] = useState(starterBots);
  const [name, setName] = useState('TO Admin');
  const [email, setEmail] = useState('admin@example.com');
  const [dark, setDark] = useState(true);
  const [accent, setAccent] = useState('violet');
  const [alerts, setAlerts] = useState(true);
  const [compact, setCompact] = useState(false);
  const [filter, setFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [message, setMessage] = useState('');
  const [commands, setCommands] = useState(() => {
    try { return JSON.parse(localStorage.getItem('toDiscordBotCommands') || '[]'); } catch { return []; }
  });
  const [commandName, setCommandName] = useState('');
  const [commandDescription, setCommandDescription] = useState('');
  const [commandType, setCommandType] = useState('slash');
  const [commandLanguage, setCommandLanguage] = useState('javascript');
  const [commandCode, setCommandCode] = useState("import { SlashCommandBuilder } from 'discord.js';\n\nexport default {\n  data: new SlashCommandBuilder()\n    .setName('hello')\n    .setDescription('ทักทายผู้ใช้'),\n  async execute(interaction) {\n    await interaction.reply('สวัสดีครับ 👋');\n  }\n};");
  const [editingCommandId, setEditingCommandId] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authUser, setAuthUser] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');
  const getToken = () => sessionStorage.getItem('toDiscordBotToken');
  const apiFetch = async (path, options = {}) => {
    const token = getToken();
    const response = await fetch(apiUrl + path, {
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(options.headers || {}) }
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'คำขอไม่สำเร็จ');
    return data;
  };
  const loadBots = async () => {
    if (!getToken()) return;
    try {
      const data = await apiFetch('/api/bots');
      setBots(data.bots.map(bot => ({ ...bot, tag: 'บันทึกในบัญชี', status: 'ออฟไลน์', servers: 0 })));
    } catch (error) { notify(error.message || 'โหลดรายการบอตไม่สำเร็จ'); }
  };
  useEffect(() => {
    const restoreSession = async () => {
      if (!getToken()) return;
      try {
        const data = await apiFetch('/api/me');
        setAuthUser(data.user); setName(data.user.name); setEmail(data.user.email);
        const botData = await apiFetch('/api/bots');
        setBots(botData.bots.map(bot => ({ ...bot, tag: 'บันทึกในบัญชี', status: 'ออฟไลน์', servers: 0 })));
      } catch {
        sessionStorage.removeItem('toDiscordBotToken');
        setAuthUser(null);
      }
    };
    restoreSession();
  }, []);
  const notify = (text) => { setMessage(text); window.setTimeout(() => setMessage(''), 2600); };
  useEffect(() => {
    try { localStorage.setItem('toDiscordBotCommands', JSON.stringify(commands)); }
    catch { notify('พื้นที่จัดเก็บในอุปกรณ์เต็ม ไม่สามารถบันทึกคำสั่งได้'); }
  }, [commands]);
  const resetCommandForm = () => {
    setCommandName(''); setCommandDescription(''); setCommandType('slash'); setCommandLanguage('javascript');
    setCommandCode("import { SlashCommandBuilder } from 'discord.js';\n\nexport default {\n  data: new SlashCommandBuilder()\n    .setName('hello')\n    .setDescription('ทักทายผู้ใช้'),\n  async execute(interaction) {\n    await interaction.reply('สวัสดีครับ 👋');\n  }\n};");
    setEditingCommandId(null);
  };
  const saveCommand = (e) => {
    e.preventDefault();
    const normalizedName = commandName.trim().toLowerCase().replace(/^\//, '');
    if (!/^[a-z0-9_-]{1,32}$/.test(normalizedName)) { notify('ชื่อคำสั่งต้องเป็น a-z, 0-9, _ หรือ - และยาวไม่เกิน 32 ตัว'); return; }
    if (!commandDescription.trim() || !commandCode.trim()) { notify('กรอกคำอธิบายและโค้ดก่อนบันทึก'); return; }
    const record = { id: editingCommandId || Date.now(), name: normalizedName, description: commandDescription.trim(), type: commandType, language: commandLanguage, code: commandCode, updatedAt: new Date().toISOString() };
    setCommands(current => editingCommandId ? current.map(item => item.id === editingCommandId ? record : item) : [record, ...current]);
    resetCommandForm();
    notify(editingCommandId ? 'อัปเดตคำสั่งในคลังแล้ว' : 'บันทึกคำสั่งลงคลังแล้ว');
  };
  const editCommand = (command) => {
    setCommandName(command.name); setCommandDescription(command.description); setCommandType(command.type);
    setCommandLanguage(command.language); setCommandCode(command.code); setEditingCommandId(command.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); notify('คัดลอกโค้ดแล้ว'); }
    catch { notify('คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกและคัดลอกโค้ด'); }
  };
  const filtered = bots.filter(b => b.name.toLowerCase().includes(filter.toLowerCase()));
  const handleAuth = async (e) => {
    e.preventDefault(); setAuthBusy(true);
    try {
      const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = authMode === 'register' ? { name: authName, email: authEmail, password: authPassword } : { email: authEmail, password: authPassword };
      const data = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      sessionStorage.setItem('toDiscordBotToken', data.token);
      setAuthUser(data.user); setName(data.user.name); setEmail(data.user.email); setAuthOpen(false); setAuthPassword('');
      await loadBots();
      notify(authMode === 'register' ? 'สมัครสมาชิกสำเร็จ' : 'เข้าสู่ระบบสำเร็จ');
    } catch (error) { notify(error.message || 'เชื่อมต่อ Backend ไม่สำเร็จ'); }
    finally { setAuthBusy(false); }
  };
  const addBot = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      if (authUser) {
        const data = await apiFetch('/api/bots', { method: 'POST', body: JSON.stringify({ name: newName.trim() }) });
        setBots(current => [{ ...data.bot, tag: 'บันทึกในบัญชี', status: 'ออฟไลน์', servers: 0 }, ...current]);
        notify('บันทึกบอตลงบัญชีแล้ว');
      } else {
        setBots(current => [...current, { id: Date.now(), name: newName.trim(), tag: 'ข้อมูลตัวอย่าง (ยังไม่บันทึก)', status: 'ออฟไลน์', servers: 0 }]);
        notify('เพิ่มเฉพาะตัวอย่าง กรุณาเข้าสู่ระบบเพื่อบันทึกถาวร');
      }
      setNewName(''); setAdding(false);
    } catch (error) { notify(error.message || 'บันทึกบอตไม่สำเร็จ'); }
  };
  const removeBot = async (bot) => {
    try {
      if (authUser && Number.isInteger(Number(bot.id))) await apiFetch('/api/bots/' + bot.id, { method: 'DELETE' });
      setBots(current => current.filter(item => item.id !== bot.id));
      notify(authUser ? 'ลบบอตจากบัญชีแล้ว' : 'นำบอตออกจากรายการตัวอย่างแล้ว');
    } catch (error) { notify(error.message || 'ลบบอตไม่สำเร็จ'); }
  };
  const logout = () => {
    sessionStorage.removeItem('toDiscordBotToken');
    setAuthUser(null); setAuthOpen(false); setName('ผู้ใช้'); setEmail(''); setBots(starterBots);
    notify('ออกจากระบบแล้ว');
  };
  return <div className={'app ' + (dark ? 'dark' : 'light') + ' accent-' + accent + (compact ? ' compact' : '')}>
    <aside className={'sidebar ' + (mobileMenu ? 'open' : '')}>
      <div className="brand"><div className="logo"><Bot size={25}/></div><div><b>TO <span>Discord BOT</span></b><small>CONTROL CENTER</small></div><button className="close-menu" onClick={() => setMobileMenu(false)}><X size={20}/></button></div>
      <button className="workspace"><span className="workspace-icon"><Server size={18}/></span><span><b>Workspace หลัก</b><small>{authUser?.plan === 'premium' ? 'แพ็กเกจ Premium' : 'แพ็กเกจ Free · 1 บอต'}</small></span><ChevronDown size={15}/></button>
      <nav>{menu.map(([label, Icon], i) => <button key={label} className={'nav-item ' + (page === label ? 'selected' : '')} onClick={() => {setPage(label);setMobileMenu(false)}}><Icon size={18}/><span>{label}</span>{label === 'การแจ้งเตือน' && <i className="pink-dot"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help"><ShieldCheck size={18}/><b>ศูนย์ช่วยเหลือ</b><p>คู่มือและเอกสารการเชื่อมต่อ Discord</p><a href="https://discord.com/developers/docs/intro" target="_blank" rel="noreferrer">เปิดเอกสาร Discord ↗</a></div><div className="side-user"><div className="avatar">TO</div><div><b>{name}</b><small>Workspace Admin</small></div><button onClick={() => setPage('โปรไฟล์')}>•••</button></div></div>
    </aside>
    {mobileMenu && <button className="scrim" onClick={() => setMobileMenu(false)} aria-label="ปิดเมนู"/>}
    <main className="main">
      <header className="topbar"><div className="crumb"><button className="mobile-menu" onClick={() => setMobileMenu(true)}><Menu size={20}/></button>Workspace <span>/</span> <b>{page}</b></div><div className="top-actions"><label className="search"><Search size={16}/><input placeholder="ค้นหาบอต..." value={filter} onChange={e => setFilter(e.target.value)}/></label><button className="icon-btn" onClick={() => setDark(!dark)} title="เปลี่ยนธีม">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button><button className="icon-btn" onClick={() => setPage('การแจ้งเตือน')}><Bell size={18}/></button>{authUser ? <button className="secondary auth-trigger" onClick={logout}>ออกจากระบบ</button> : <button className="secondary auth-trigger" onClick={() => setAuthOpen(true)}>เข้าสู่ระบบ</button>}<button className="avatar" onClick={() => setPage('โปรไฟล์')}>TO</button></div></header>
      <section className="content">
        {page === 'ภาพรวม' && <>
          <div className="page-head"><div><label className="eyebrow">BOT MANAGEMENT PLATFORM</label><h1>ยินดีต้อนรับกลับมา, {name} <em>✦</em></h1><p>ภาพรวมการจัดการ Discord Bot ของคุณในที่เดียว</p></div><button className="primary" onClick={() => setAdding(true)}><Plus size={17}/> เพิ่มบอตใหม่</button></div>
          <div className="hero"><div className="hero-text"><label>✦ CONTROL YOUR COMMUNITY</label><h2>จัดการบอตของคุณ<br/><span>ได้ในที่เดียว</span></h2><p>ติดตามสถานะและจัดการ Workspace ได้ง่ายจากหน้าจอเดียว</p><button onClick={() => setPage('บอตของฉัน')}>ไปที่บอตของฉัน　→</button></div><div className="hero-art"><div className="ring ring1"/><div className="ring ring2"/><div className="bot-art"><Bot size={80}/></div><div className="float-tag">● ระบบ Dashboard</div></div></div>
          <div className="section-head"><div><h2>ภาพรวมระบบ</h2><p>ข้อมูลตัวอย่างสำหรับออกแบบหน้าจอ</p></div><span className="demo-label">● DEMO DATA</span></div>
          <div className="stats"><CardStat icon={Bot} label="บอตทั้งหมด" value={bots.length} note="ใน Workspace"/><CardStat icon={Activity} label="ออนไลน์" value={bots.filter(b=>b.status==='ออนไลน์').length} note="สถานะตัวอย่าง ไม่ใช่ข้อมูลสด"/><CardStat icon={Server} label="เซิร์ฟเวอร์รวม" value={bots.reduce((n,b)=>n+b.servers,0)} note="ค่าตัวอย่าง"/><CardStat icon={ShieldCheck} label="ระบบ API" value="รอตั้งค่า" note="ยังไม่เชื่อม Backend"/></div>
          <div className="columns"><div className="panel"><div className="panel-head"><div><h3>บอตของฉัน</h3><p>รายการบอตใน Workspace</p></div><button className="link" onClick={() => setPage('บอตของฉัน')}>ดูทั้งหมด →</button></div>{filtered.slice(0,4).map(bot => <div className="bot-row" key={bot.id}><div className="bot-icon"><Bot size={20}/></div><div className="bot-info"><b>{bot.name}</b><small>{bot.tag}</small></div><span className={'status ' + (bot.status==='ออนไลน์'?'online':'offline')}>{bot.status}</span></div>)}<button className="add-row" onClick={() => setAdding(true)}><Plus size={15}/> เพิ่มบอตอีกตัว</button></div><div className="panel"><div className="panel-head"><div><h3>กิจกรรมล่าสุด</h3><p>ตัวอย่างการแสดงผล</p></div></div><div className="activity"><span><Check size={15}/></span><div><b>Dashboard พร้อมใช้งาน</b><small>โหลด UI สำเร็จ · วันนี้</small></div></div><div className="activity"><span><Bot size={15}/></span><div><b>เพิ่มบอตตัวอย่าง</b><small>TO Helper · วันนี้</small></div></div><div className="activity"><span><Settings size={15}/></span><div><b>Workspace เริ่มต้น</b><small>ธีมมืด · วันนี้</small></div></div></div></div>
          <div className="footnote"><ShieldCheck size={15}/> สถานะบอตและตัวเลขทั้งหมดเป็นข้อมูลจำลอง ยังไม่ได้เชื่อม Discord API</div>
        </>}
        {page === 'บอตของฉัน' && <><div className="page-head"><div><label className="eyebrow">BOT WORKSPACE</label><h1>บอตของฉัน</h1><p>จัดการรายการบอตของคุณ</p></div><button className="primary" onClick={() => setAdding(true)}><Plus size={17}/> เพิ่มบอต</button></div><div className="bot-grid">{filtered.map(bot => <div className="panel bot-card" key={bot.id}><div className="bot-card-head"><div className="bot-icon big"><Bot size={26}/></div><button className="icon-btn" onClick={() => removeBot(bot)}><Trash2 size={16}/></button></div><h3>{bot.name}</h3><p>{bot.tag}</p><span className={'status ' + (bot.status==='ออนไลน์'?'online':'offline')}>{bot.status}</span><div className="bot-stats"><div><small>เซิร์ฟเวอร์</small><b>{bot.servers}</b></div><div><small>Uptime</small><b>—</b></div></div><button className="secondary full" onClick={() => notify('ต้องเชื่อม Discord API และ Backend ก่อน')}>ดูรายละเอียด</button></div>)}</div>{filtered.length===0&&<div className="panel empty">ไม่พบบอตที่ค้นหา</div>}</>}
        {page === 'คำสั่งและโค้ด' && <>
          <div className="page-head"><div><label className="eyebrow">COMMAND STUDIO</label><h1>คำสั่งและโค้ด</h1><p>สร้าง แก้ไข และเก็บโค้ดคำสั่ง Discord ไว้ในแอปเดียว</p></div><a className="secondary" href="https://github.com/chloerangersonic0909-cmd/-to-discord-bot" target="_blank" rel="noreferrer"><Github size={16}/> Repository ↗</a></div>
          <div className="command-banner"><div className="command-banner-icon"><Terminal size={22}/></div><div><b>Command Studio</b><p>ตัวช่วยจัดระเบียบคำสั่ง Slash / Prefix พร้อมโค้ด JavaScript หรือ Python</p></div><span className="command-count">{commands.length} คำสั่ง</span></div>
          <div className="command-layout">
            <form className="panel command-editor" onSubmit={saveCommand}>
              <div className="panel-head"><div><h3><FileCode2 size={17}/> {editingCommandId ? 'แก้ไขคำสั่ง' : 'ลงทะเบียนคำสั่งใหม่'}</h3><p>กรอกข้อมูลและวางโค้ดของคำสั่ง</p></div><span className="editor-dot"/></div>
              <label>ชื่อคำสั่ง<input value={commandName} onChange={e=>setCommandName(e.target.value)} placeholder="เช่น help หรือ ping" maxLength={32} required/><small>ไม่ต้องใส่ / นำหน้า</small></label>
              <label>คำอธิบาย<input value={commandDescription} onChange={e=>setCommandDescription(e.target.value)} placeholder="อธิบายว่าคำสั่งนี้ทำอะไร" maxLength={100} required/></label>
              <div className="command-fields"><label>รูปแบบคำสั่ง<select value={commandType} onChange={e=>setCommandType(e.target.value)}><option value="slash">Slash Command /คำสั่ง</option><option value="prefix">Prefix Command เช่น !help</option></select></label><label>ภาษาโค้ด<select value={commandLanguage} onChange={e=>{const lang=e.target.value;setCommandLanguage(lang);if(lang==='python')setCommandCode("import discord\nfrom discord import app_commands\n\n@app_commands.command(name='hello', description='ทักทายผู้ใช้')\nasync def hello(interaction: discord.Interaction):\n    await interaction.response.send_message('สวัสดีครับ 👋')");else setCommandCode("import { SlashCommandBuilder } from 'discord.js';\n\nexport default {\n  data: new SlashCommandBuilder()\n    .setName('hello')\n    .setDescription('ทักทายผู้ใช้'),\n  async execute(interaction) {\n    await interaction.reply('สวัสดีครับ 👋');\n  }\n};");}}><option value="javascript">JavaScript · discord.js</option><option value="python">Python · discord.py</option></select></label></div>
              <label className="code-label">โค้ดคำสั่ง <span>{commandLanguage === 'python' ? 'PY' : 'JS'}</span></label><textarea className="code-input" value={commandCode} onChange={e=>setCommandCode(e.target.value)} spellCheck="false" autoCapitalize="off" autoCorrect="off" required/>
              <p className="hint">บันทึกนี้เก็บไว้ในอุปกรณ์ก่อน ยังไม่ส่งคำสั่งไปลงทะเบียนกับ Discord โดยตรง การซิงก์จริงต้องมีบอต Token และ Backend ที่ปลอดภัย</p>
              <div className="command-actions"><button type="button" className="secondary" onClick={()=>copyText(commandCode)}><Copy size={15}/> คัดลอกโค้ด</button><button className="primary"><Save size={15}/>{editingCommandId ? 'บันทึกการแก้ไข' : 'บันทึกคำสั่ง'}</button>{editingCommandId && <button type="button" className="icon-btn" onClick={resetCommandForm} title="ยกเลิกแก้ไข"><X size={17}/></button>}</div>
            </form>
            <div className="panel command-library"><div className="panel-head"><div><h3>คลังคำสั่งของฉัน</h3><p>คำสั่งที่บันทึกไว้ในอุปกรณ์นี้</p></div><span className="library-badge">{commands.length}</span></div>
              {commands.length === 0 ? <div className="command-empty"><div><Code2 size={25}/></div><b>ยังไม่มีคำสั่งในคลัง</b><p>สร้างคำสั่งแรกจากฟอร์ม แล้วคำสั่งจะปรากฏที่นี่</p></div> : commands.map(command=><article className="command-item" key={command.id}><div className="command-item-top"><div className="command-item-icon"><Code2 size={17}/></div><div className="command-item-title"><b>{command.type==='slash' ? '/' : '!'}{command.name}</b><small>{command.description}</small></div><span className="command-lang">{command.language==='python'?'PY':'JS'}</span></div><div className="command-item-actions"><button className="secondary" onClick={()=>editCommand(command)} type="button"><Pencil size={13}/> แก้ไข</button><button className="secondary" onClick={()=>copyText(command.code)} type="button"><Copy size={13}/> คัดลอก</button><button className="icon-btn" onClick={()=>{setCommands(current=>current.filter(item=>item.id!==command.id));if(editingCommandId===command.id)resetCommandForm();notify('ลบคำสั่งจากคลังแล้ว');}} type="button" title="ลบคำสั่ง"><Trash2 size={15}/></button></div></article>)}
              <div className="command-library-footer"><span><Check size={14}/> บันทึกอัตโนมัติในอุปกรณ์</span><button className="link" onClick={()=>copyText(JSON.stringify(commands,null,2))} type="button">ส่งออก JSON ↗</button></div>
            </div>
          </div>
          <div className="panel file-panel"><div className="panel-head"><div><h3>โครงสร้างโปรเจกต์</h3><p>ไฟล์หลักของแอป</p></div></div><div className="file-line">📁　src/ <small>หน้าแอปและสไตล์</small></div><div className="file-line">📄　App.jsx <small>React Dashboard + Command Studio</small></div><div className="file-line">📄　styles.css <small>ธีมและ Responsive</small></div><div className="file-line">📁　server/ <small>Backend API scaffold</small></div><div className="file-line">📄　capacitor.config.json <small>Android wrapper config</small></div></div>
        </>}
        {page === 'กิจกรรม' && <><div className="page-head"><div><label className="eyebrow">ACTIVITY LOG</label><h1>กิจกรรม</h1><p>บันทึกกิจกรรมตัวอย่างของแอป</p></div></div><div className="panel"><div className="activity"><span><Check size={15}/></span><div><b>Dashboard พร้อมใช้งาน</b><small>โหลด UI สำเร็จ · วันนี้</small></div></div><div className="activity"><span><Settings size={15}/></span><div><b>ตั้งค่าธีมเริ่มต้น</b><small>ธีมมืดและสีม่วง · วันนี้</small></div></div></div></>}
        {page === 'การแจ้งเตือน' && <><div className="page-head"><div><label className="eyebrow">NOTIFICATIONS</label><h1>การแจ้งเตือน</h1><p>กำหนดการแจ้งเตือนภายในแอป</p></div></div><div className="panel settings"><div className="setting-row"><div><b>เปิดการแจ้งเตือนในแอป</b><p>แสดงข้อความสถานะภายใน Dashboard</p></div><Toggle value={alerts} onChange={setAlerts}/></div><div className="setting-row"><div><b>แจ้งเตือนสถานะบอต</b><p>ต้องเชื่อมต่อ Backend และ Discord API</p></div><Toggle value={alerts} onChange={setAlerts}/></div><p className="hint">Push notifications ยังไม่ได้ตั้งค่าในเวอร์ชันนี้</p></div></>}
        {page === 'โปรไฟล์' && <><div className="page-head"><div><label className="eyebrow">YOUR ACCOUNT</label><h1>โปรไฟล์ผู้ใช้</h1><p>จัดการข้อมูลโปรไฟล์ตัวอย่าง</p></div></div><div className="panel profile"><div className="cover"/><div className="profile-head"><div className="avatar profile-avatar">TO</div><div><h2>{name}</h2><p>{email}</p><span className="role">{authUser ? (authUser.plan === 'premium' ? 'แพ็กเกจ Premium' : 'แพ็กเกจ Free · จำกัด 1 บอต') : 'ตัวอย่าง · เข้าสู่ระบบเพื่อบันทึก'}</span></div></div><div className="form"><label>ชื่อที่แสดง<input value={name} onChange={e=>setName(e.target.value)}/></label><label>อีเมล<input type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><button className="primary" onClick={async()=>{try{if(!authUser){notify('เข้าสู่ระบบก่อนบันทึกโปรไฟล์');return;}const data=await apiFetch('/api/me',{method:'PATCH',body:JSON.stringify({name,email})});setAuthUser(data.user);setName(data.user.name);setEmail(data.user.email);notify('บันทึกโปรไฟล์แล้ว');}catch(error){notify(error.message||'บันทึกโปรไฟล์ไม่สำเร็จ');}}}>บันทึกการเปลี่ยนแปลง</button></div></div></>}
        {page === 'การตั้งค่า' && <><div className="page-head"><div><label className="eyebrow">PREFERENCES</label><h1>การตั้งค่า</h1><p>ปรับแต่งรูปลักษณ์และประสบการณ์ใช้งาน</p></div></div><div className="panel settings"><h3 className="setting-title"><Palette size={18}/> รูปลักษณ์</h3><div className="setting-row"><div><b>ธีมมืด</b><p>สลับโหมดสว่างและมืด</p></div><Toggle value={dark} onChange={setDark}/></div><div className="setting-row"><div><b>สีหลัก</b><p>เลือกสีที่ใช้กับปุ่มและเมนู</p></div><div className="colors">{['violet','cyan','blue','green'].map(c=><button key={c} className={'color '+c+' '+(accent===c?'chosen':'')} onClick={()=>setAccent(c)} aria-label={c}/>)}</div></div><div className="setting-row"><div><b>โหมดกระชับ</b><p>ลดช่องว่างของรายการ</p></div><Toggle value={compact} onChange={setCompact}/></div><h3 className="setting-title second"><Bell size={18}/> การแจ้งเตือน</h3><div className="setting-row"><div><b>แจ้งเตือนในแอป</b><p>เปิดหรือปิดข้อความแจ้งเตือน</p></div><Toggle value={alerts} onChange={setAlerts}/></div><p className="hint">การตั้งค่าปัจจุบันอยู่ใน state ของหน้าเว็บ ยังไม่เก็บถาวร</p></div></>}
        {page === 'ผู้ดูแลระบบ' && <><div className="page-head"><div><label className="eyebrow">ADMINISTRATION</label><h1>ผู้ดูแลระบบ</h1><p>ภาพรวมสิทธิ์และสถานะ Backend</p></div><span className="role"><ShieldCheck size={14}/> Admin UI</span></div><div className="stats"><CardStat icon={Users} label="ผู้ใช้" value="—" note="ยังไม่เชื่อมฐานข้อมูล"/><CardStat icon={Server} label="Backend" value="รอตั้งค่า" note="ยังไม่ Deploy"/><CardStat icon={ShieldCheck} label="สิทธิ์" value="รอตั้งค่า" note="ต้องตรวจสอบฝั่งเซิร์ฟเวอร์"/><CardStat icon={Activity} label="Audit Log" value="—" note="ยังไม่มีข้อมูลจริง"/></div><div className="panel warning"><ShieldCheck size={22}/><div><b>หน้าผู้ดูแลระบบเป็นต้นแบบ</b><p>ก่อนใช้งานจริง ต้องตรวจสิทธิ์ใน Backend ไม่ใช่แค่ซ่อนปุ่มในหน้าเว็บ และต้องมีระบบบันทึกกิจกรรมเพื่อการตรวจสอบ</p></div></div></>}
      </section>
      <footer>TO Discord BOT <span>•</span> UI Preview <span className="footer-right">Designed for mobile ✦</span></footer>
    </main>
    {adding && <div className="modal-bg" onClick={()=>setAdding(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><label className="eyebrow">NEW BOT</label><h2>เพิ่มบอตในรายการ</h2><p>เพิ่มชื่อเพื่อแสดงใน Dashboard</p></div><button className="icon-btn" onClick={()=>setAdding(false)}><X size={19}/></button></div><form onSubmit={addBot}><label>ชื่อบอต<input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} placeholder="เช่น TO Helper" required/></label><p className="hint">ฟอร์มนี้ไม่รับหรือบันทึก Bot Token เพื่อความปลอดภัย การเชื่อม Discord จริงจะเพิ่มใน Backend ภายหลัง</p><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setAdding(false)}>ยกเลิก</button><button className="primary"><Plus size={16}/> เพิ่มบอต</button></div></form></div></div>}
    {authOpen && <div className="modal-bg" onClick={() => setAuthOpen(false)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><label className="eyebrow">ACCOUNT ACCESS</label><h2>{authMode === 'register' ? 'สร้างบัญชี' : 'เข้าสู่ระบบ'}</h2><p>บัญชีจะเชื่อมกับ Backend เมื่อกำหนด API URL แล้ว</p></div><button className="icon-btn" onClick={() => setAuthOpen(false)}><X size={19}/></button></div><form onSubmit={handleAuth}>{authMode === 'register' && <label>ชื่อที่แสดง<input value={authName} onChange={e=>setAuthName(e.target.value)} autoComplete="name" required minLength={2}/></label>}<label>อีเมล<input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} autoComplete="email" required/></label><label>รหัสผ่าน<input type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} minLength={authMode === 'register' ? 8 : 1} required/></label><p className="hint">{authMode === 'register' ? 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' : 'ใช้บัญชีที่สมัครไว้ใน Backend ของแอป'}</p><button className="primary full" disabled={authBusy}>{authBusy ? 'กำลังเชื่อมต่อ…' : (authMode === 'register' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ')}</button></form><button className="link auth-switch" onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')}>{authMode === 'register' ? 'มีบัญชีแล้ว? เข้าสู่ระบบ' : 'ยังไม่มีบัญชี? สมัครสมาชิก'}</button></div></div>}
    {message && <div className="toast"><Check size={16}/>{message}</div>}
  </div>;
}
