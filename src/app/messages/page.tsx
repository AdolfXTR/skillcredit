"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string;
  username: string;
  credits: number;
  level: string;
  avatar_url?: string | null;
};

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image_url?: string;
  message_type: string;
  is_read: boolean;
  created_at: string;
};

type Conversation = {
  other_user: Profile;
  last_message: string;
  last_time: string;
  unread_count: number;
};

type CallPayload = {
  room: string;
  started_at: string;
  duration_minutes: number;
  status: "active" | "ended";
  ended_by?: string;
};

const LEVEL_COLORS: Record<string, string> = {
  Seedling: "#2d6a4f", Learner: "#1d4ed8", Contributor: "#7c3aed",
  Skilled: "#b45309", Expert: "#dc2626", Master: "#0891b2", Legend: "#d97706",
};

const EMOJI_LIST = [
  "😀","😂","😍","🥰","😎","🤔","😅","🤩","😭","😤",
  "👍","👏","🔥","❤️","💯","🎉","✨","💪","🙏","👀",
  "😊","🥹","😆","🤣","😇","🥳","😴","🤯","😱","🫶",
  "💬","📚","🎯","🏆","💰","🌱","⚡","🎓","✅","🚀",
];

function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}
function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
}
function groupByDate(messages: Message[]) {
  const groups: { date: string; messages: Message[] }[] = [];
  let currentDate = "";
  messages.forEach(msg => {
    const d = new Date(msg.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    let label = d.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
    if (d.toDateString() === today.toDateString()) label = "Today";
    else if (d.toDateString() === yesterday.toDateString()) label = "Yesterday";
    if (label !== currentDate) { currentDate = label; groups.push({ date: label, messages: [] }); }
    groups[groups.length - 1].messages.push(msg);
  });
  return groups;
}
function getRoomName(idA: string, idB: string) {
  const slug = [idA, idB].sort().join("").replace(/-/g, "").slice(0, 20);
  return `skillcredit-${slug}`;
}

// ─── AVATAR COMPONENT ─────────────────────────────────────────────────────────
function Avatar({ profile, size = 38, online = false }: { profile: Profile; size?: number; online?: boolean }) {
  const color = LEVEL_COLORS[profile.level] || "#2d6a4f";
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
        background: profile.avatar_url ? "transparent" : color,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.34, fontWeight: 700, color: "#fff",
      }}>
        {profile.avatar_url
          ? <img src={profile.avatar_url} alt={profile.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          : getInitials(profile.full_name)
        }
      </div>
      {online && <div style={{ position: "absolute", bottom: 1, right: 1, width: 9, height: 9, borderRadius: "50%", background: "#22c55e", border: "2px solid #fff" }} />}
    </div>
  );
}

// ─── SESSION TIMER ────────────────────────────────────────────────────────────
function SessionTimer({ startedAt, durationMinutes, onExpire }: { startedAt: string; durationMinutes: number; onExpire: () => void }) {
  const total = durationMinutes * 60;
  const [remaining, setRemaining] = useState(total);
  const [elapsed, setElapsed] = useState(0);
  const calledExpire = useRef(false);

  useEffect(() => {
    const tick = () => {
      const elap = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      const rem = Math.max(total - elap, 0);
      setElapsed(elap); setRemaining(rem);
      if (rem === 0 && !calledExpire.current) { calledExpire.current = true; onExpire(); }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, total]);

  const pct = Math.min((elapsed / total) * 100, 100);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isLow = remaining < 300;
  const color = isLow ? "#dc2626" : "#2d6a4f";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div style={{ position: "relative", width: 40, height: 40, flexShrink: 0 }}>
        <svg width="40" height="40" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="20" cy="20" r="16" fill="none" stroke="#f0ece4" strokeWidth="3" />
          <circle cx="20" cy="20" r="16" fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${(pct / 100) * 100.5} 100.5`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.5s ease" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 9, fontWeight: 800, color, fontFamily: "'Fraunces', serif" }}>{mins}</span>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 900, color: isLow ? "#dc2626" : "#1a1a1a", fontFamily: "'Fraunces', serif", lineHeight: 1 }}>
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>
        <div style={{ fontSize: 9, color: isLow ? "#dc2626" : "#aaa", fontWeight: 600 }}>{isLow ? "⚠️ ending soon" : "remaining"}</div>
      </div>
    </div>
  );
}

// ─── VIDEO CALL PANEL ─────────────────────────────────────────────────────────
function VideoCallPanel({ payload, currentUserId, otherUser, onEnd }: { payload: CallPayload; currentUserId: string; otherUser: Profile; onEnd: () => void }) {
  const [joined, setJoined] = useState(false);
  const ended = payload.status === "ended";

  if (ended) {
    return (
      <div style={{ background: "#faf8f4", borderRadius: 14, border: "1.5px solid #e8e2d9", padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#f0ece4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📹</div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#555" }}>Video session ended</p>
          <p style={{ fontSize: 11, color: "#bbb" }}>
            {payload.duration_minutes}min · {new Date(payload.started_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 16, border: "2px solid #2d6a4f", overflow: "hidden", background: "#fff", boxShadow: "0 4px 24px rgba(45,106,79,0.12)" }}>
      <div style={{ padding: "10px 16px", background: "linear-gradient(135deg,#1a4a36,#2d6a4f)", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", animation: "pulse 1.5s infinite" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Live Session · {otherUser.full_name}</span>
        </div>
        <SessionTimer startedAt={payload.started_at} durationMinutes={payload.duration_minutes} onExpire={onEnd} />
        <button onClick={onEnd} style={{ padding: "5px 13px", borderRadius: 8, background: "rgba(220,38,38,0.85)", color: "#fff", border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>End</button>
      </div>
      {!joined && (
        <div style={{ padding: "28px 24px", textAlign: "center", background: "#f9fdfb" }}>
          <div style={{ fontSize: 46, marginBottom: 10 }}>🎥</div>
          <p style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 900, color: "#1a1a1a", marginBottom: 6 }}>Ready to join?</p>
          <p style={{ fontSize: 13, color: "#888", lineHeight: 1.65, marginBottom: 20 }}>Your browser will ask for camera & mic permission.<br />The session timer has already started!</p>
          <button onClick={() => setJoined(true)} style={{ padding: "11px 30px", borderRadius: 12, background: "#2d6a4f", color: "#fff", border: "none", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 3px 14px rgba(45,106,79,0.25)" }}>
            📹 Join Video Call
          </button>
          <p style={{ fontSize: 11, color: "#bbb", marginTop: 12 }}>Powered by Jitsi Meet · end-to-end encrypted · free</p>
        </div>
      )}
      {joined && <iframe src={`https://meet.jit.si/${payload.room}`} allow="camera; microphone; fullscreen; display-capture; autoplay" style={{ width: "100%", height: 450, border: "none", display: "block" }} title="Video Session" />}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function MessagesPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchUser, setSearchUser] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [startingCall, setStartingCall] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase.channel(`messages-${profile.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${profile.id}` }, (payload) => {
        const msg = payload.new as Message;
        if (activeConvo && msg.sender_id === activeConvo.id) { setMessages(prev => [...prev, msg]); markRead(activeConvo.id); }
        loadConversations(profile.id);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const updated = payload.new as Message;
        setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, activeConvo]);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (prof) setProfile(prof);
    await loadConversations(user.id);

    const openWith = sessionStorage.getItem("openMessageWith");
    if (openWith) {
      sessionStorage.removeItem("openMessageWith");
      const { data: targetUser } = await supabase.from("profiles").select("*").eq("id", openWith).single();
      if (targetUser) {
        setTimeout(async () => {
          setActiveConvo(targetUser); setShowNewChat(false); setShowEmoji(false);
          const { data: msgs } = await supabase.from("messages").select("*")
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetUser.id}),and(sender_id.eq.${targetUser.id},receiver_id.eq.${user.id})`)
            .order("created_at", { ascending: true });
          setMessages(msgs || []);
          await supabase.from("messages").update({ is_read: true }).eq("sender_id", targetUser.id).eq("receiver_id", user.id).eq("is_read", false);
          await loadConversations(user.id);
          setTimeout(() => textareaRef.current?.focus(), 150);
        }, 400);
      }
    }
    setLoading(false);
  }

  async function loadConversations(userId: string) {
    const { data: msgs } = await supabase.from("messages").select("*")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (!msgs) return;

    const convoMap = new Map<string, Message[]>();
    msgs.forEach(msg => {
      const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      if (!convoMap.has(otherId)) convoMap.set(otherId, []);
      convoMap.get(otherId)!.push(msg);
    });

    const convos: Conversation[] = [];
    for (const [otherId, ms] of convoMap) {
      const { data: op } = await supabase.from("profiles").select("*").eq("id", otherId).single();
      if (!op) continue;
      const last = ms[0];
      const unread = ms.filter(m => m.receiver_id === userId && !m.is_read).length;
      const lastText = last.message_type === "image" ? "📷 Photo" : last.message_type === "session_call" ? "📹 Video session" : last.content;
      convos.push({ other_user: op, last_message: lastText, last_time: last.created_at, unread_count: unread });
    }
    setConversations(convos);
  }

  async function openConversation(other: Profile) {
    setActiveConvo(other); setShowNewChat(false); setShowEmoji(false);
    if (!profile) return;
    const { data } = await supabase.from("messages").select("*")
      .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${other.id}),and(sender_id.eq.${other.id},receiver_id.eq.${profile.id})`)
      .order("created_at", { ascending: true });
    setMessages(data || []);
    await markRead(other.id);
    await loadConversations(profile.id);
    setTimeout(() => textareaRef.current?.focus(), 100);
  }

  async function markRead(senderId: string) {
    if (!profile) return;
    await supabase.from("messages").update({ is_read: true }).eq("sender_id", senderId).eq("receiver_id", profile.id).eq("is_read", false);
  }

  async function startVideoSession() {
    if (!profile || !activeConvo || startingCall) return;
    const alreadyActive = messages.some(m => {
      if (m.message_type !== "session_call") return false;
      try { return (JSON.parse(m.content) as CallPayload).status === "active"; } catch { return false; }
    });
    if (alreadyActive) { alert("There's already an active session in this conversation!"); return; }
    setStartingCall(true);

    const { data: sessionRow } = await supabase.from("sessions").select("listing:listing_id(duration)")
      .or(`and(teacher_id.eq.${profile.id},learner_id.eq.${activeConvo.id}),and(teacher_id.eq.${activeConvo.id},learner_id.eq.${profile.id})`)
      .eq("status", "upcoming").order("proposed_time", { ascending: true }).limit(1).maybeSingle();

    const duration = (sessionRow?.listing as any)?.duration || 60;
    const room = getRoomName(profile.id, activeConvo.id);
    const payload: CallPayload = { room, started_at: new Date().toISOString(), duration_minutes: duration, status: "active" };

    const { data: msg } = await supabase.from("messages").insert({ sender_id: profile.id, receiver_id: activeConvo.id, content: JSON.stringify(payload), message_type: "session_call", is_read: false }).select().single();
    if (msg) setMessages(prev => [...prev, msg]);

    try {
      await supabase.from("notifications").insert({ user_id: activeConvo.id, type: "session_call", title: `${profile.full_name} started a video session`, body: "Join now in Messages!", link: "/messages" });
    } catch (_) {}

    await loadConversations(profile.id);
    setStartingCall(false);
  }

  async function endVideoSession(msgId: string) {
    if (!profile) return;
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    try {
      const p = JSON.parse(msg.content) as CallPayload;
      p.status = "ended"; p.ended_by = profile.id;
      await supabase.from("messages").update({ content: JSON.stringify(p) }).eq("id", msgId);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: JSON.stringify(p) } : m));
    } catch (_) {}
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5MB"); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function uploadImage(file: File): Promise<string | null> {
    const ext = file.name.split(".").pop();
    const path = `${profile!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("message-images").upload(path, file);
    if (error) return null;
    const { data } = supabase.storage.from("message-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function sendMessage() {
    if (!profile || !activeConvo) return;
    if (!newMsg.trim() && !imageFile) return;
    setSending(true); setShowEmoji(false);
    let imageUrl: string | null = null;
    if (imageFile) { setUploading(true); imageUrl = await uploadImage(imageFile); setUploading(false); setImageFile(null); setImagePreview(null); }
    const msgData = { sender_id: profile.id, receiver_id: activeConvo.id, content: newMsg.trim() || "", image_url: imageUrl, message_type: imageUrl ? "image" : "text", is_read: false };
    const { data: msg } = await supabase.from("messages").insert(msgData).select().single();
    if (msg) setMessages(prev => [...prev, msg]);
    setNewMsg("");
    try { await supabase.from("notifications").insert({ user_id: activeConvo.id, type: "message", title: `New message from ${profile.full_name}`, body: imageUrl ? "📷 Sent a photo" : newMsg.trim().slice(0, 80), link: "/messages" }); } catch (_) {}
    await loadConversations(profile.id);
    setSending(false);
  }

  async function handleSearchUsers(query: string) {
    setSearchUser(query);
    clearTimeout(searchTimeout.current);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("*").neq("id", profile?.id || "").or(`username.ilike.%${query}%,full_name.ilike.%${query}%`).limit(8);
      setSearchResults(data || []);
      setSearching(false);
    }, 300);
  }

  const activeCallMsg = messages.find(m => {
    if (m.message_type !== "session_call") return false;
    try { return (JSON.parse(m.content) as CallPayload).status === "active"; } catch { return false; }
  });

  const totalUnread = conversations.reduce((s, c) => s + c.unread_count, 0);
  const grouped = groupByDate(messages);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#faf8f4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap'); @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 32, height: 32, border: "2px solid #2d6a4f", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ color: "#aaa", fontSize: 13 }}>Loading messages...</p>
      </div>
    </div>
  );

  return (
    <div style={{ height: "100vh", background: "#faf8f4", fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        a { text-decoration: none; }
        @keyframes popIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #e0dbd4; border-radius: 999px; }
        .convo-item { transition: background 0.12s; cursor: pointer; border-radius: 10px; }
        .convo-item:hover { background: #f5f0e8 !important; }
        .convo-item.active { background: #e8f4e8 !important; }
        .send-btn { transition: all 0.15s; }
        .send-btn:hover:not(:disabled) { transform: scale(1.05); }
        .emoji-btn { transition: transform 0.1s; cursor: pointer; border-radius: 6px; padding: 3px; font-size: 19px; display: inline-block; }
        .emoji-btn:hover { transform: scale(1.3); background: #f5f0e8; }
        .msg-in { animation: popIn 0.18s ease; }
        .tool-btn { background: #f5f0e8; border: 1.5px solid #e8e2d9; border-radius: 8px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 15px; transition: all 0.12s; flex-shrink: 0; }
        .tool-btn:hover { background: #ede8de; }
        .img-msg { cursor: zoom-in; transition: opacity 0.12s; border-radius: 12px; }
        .img-msg:hover { opacity: 0.88; }
        textarea:focus { outline: none; }
        input:focus { outline: none; }
        .nav-link { padding: 6px 12px; border-radius: 8px; color: #666; font-size: 13px; font-weight: 600; transition: all 0.12s; }
        .nav-link:hover { background: #f5f0e8; color: #333; }
        .nav-link.active { background: #e8f4e8; color: #2d6a4f; }
        .call-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(45,106,79,0.28) !important; }
      `}</style>

      {/* NAVBAR */}
      <nav style={{ background: "#fff", borderBottom: "1.5px solid #e8e2d9", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <a href="/dashboard">
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display: "flex", gap: 2 }}>
          {[["Browse", "/listings"], ["Bounties", "/bounties"], ["Community", "/community"], ["Sessions", "/sessions"], ["Messages", "/messages"]].map(([l, h]) => (
            <a key={l} href={h} className={`nav-link ${h === "/messages" ? "active" : ""}`} style={{ position: "relative" }}>
              {l}
              {l === "Messages" && totalUnread > 0 && <span style={{ position: "absolute", top: 4, right: 4, width: 7, height: 7, borderRadius: "50%", background: "#dc2626", border: "1.5px solid #fff" }} />}
            </a>
          ))}
        </div>
        <a href="/profile" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 10, background: "#f5f0e8", textDecoration: "none" }}>
          {profile && <Avatar profile={profile} size={26} />}
          <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>@{profile?.username}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f", background: "#e8f4e8", padding: "2px 8px", borderRadius: 20 }}>{profile?.credits} cr</span>
        </a>
      </nav>

      {/* LAYOUT */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "300px 1fr", overflow: "hidden" }}>

        {/* SIDEBAR */}
        <div style={{ background: "#fff", borderRight: "1.5px solid #e8e2d9", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1.5px solid #f0ece4", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 800, color: "#1a1a1a" }}>
                Messages
                {totalUnread > 0 && <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 700, background: "#dc2626", color: "#fff", padding: "1px 7px", borderRadius: 999 }}>{totalUnread}</span>}
              </span>
              <button onClick={() => { setShowNewChat(true); setActiveConvo(null); setSearchUser(""); setSearchResults([]); }}
                style={{ width: 26, height: 26, borderRadius: "50%", background: "#2d6a4f", color: "#fff", border: "none", fontSize: 17, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                +
              </button>
            </div>
            <input placeholder="Search conversations..." style={{ width: "100%", padding: "7px 11px", borderRadius: 8, border: "1.5px solid #e8e2d9", background: "#faf8f4", color: "#333", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }} />
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "6px" }}>
            {conversations.length === 0 ? (
              <div style={{ textAlign: "center", padding: "44px 20px", color: "#bbb" }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>💬</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>No conversations yet</div>
                <div style={{ fontSize: 11, marginTop: 3 }}>Click + to start chatting</div>
              </div>
            ) : conversations.map(c => (
              <div key={c.other_user.id}
                className={`convo-item ${activeConvo?.id === c.other_user.id ? "active" : ""}`}
                onClick={() => openConversation(c.other_user)}
                style={{ padding: "10px 10px", display: "flex", gap: 10, alignItems: "center", marginBottom: 1 }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <Avatar profile={c.other_user} size={40} online />
                  {c.unread_count > 0 && (
                    <div style={{ position: "absolute", top: -2, right: -2, minWidth: 15, height: 15, borderRadius: 999, background: "#dc2626", fontSize: 8, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
                      {c.unread_count}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: c.unread_count > 0 ? 700 : 600, color: "#1a1a1a" }}>{c.other_user.full_name}</span>
                    <span style={{ fontSize: 10, color: "#bbb", flexShrink: 0 }}>{timeAgo(c.last_time)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: c.unread_count > 0 ? "#555" : "#aaa", fontWeight: c.unread_count > 0 ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.last_message}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MAIN PANEL */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "#faf8f4" }}>

          {/* NEW CHAT SEARCH */}
          {showNewChat && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", animation: "fadeIn 0.15s ease", background: "#fff" }}>
              <div style={{ padding: "18px 22px", borderBottom: "1.5px solid #f0ece4", flexShrink: 0 }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 800, color: "#1a1a1a", marginBottom: 12 }}>New Message</div>
                <input value={searchUser} onChange={e => handleSearchUsers(e.target.value)} placeholder="Search by name or @username..." autoFocus
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e8e2d9", background: "#faf8f4", color: "#333", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}
                  onFocus={e => e.target.style.borderColor = "#2d6a4f"} onBlur={e => e.target.style.borderColor = "#e8e2d9"} />
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
                {searching && <div style={{ textAlign: "center", padding: 20, color: "#bbb", fontSize: 13 }}>Searching...</div>}
                {!searching && searchUser.length >= 2 && searchResults.length === 0 && (
                  <div style={{ textAlign: "center", padding: 20, color: "#bbb", fontSize: 13 }}>No users found for "{searchUser}"</div>
                )}
                {searchResults.map(user => (
                  <div key={user.id} className="convo-item" onClick={() => openConversation(user)}
                    style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 12, marginBottom: 3 }}>
                    <Avatar profile={user} size={42} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{user.full_name}</div>
                      <div style={{ fontSize: 12, color: "#aaa" }}>@{user.username} · {user.level}</div>
                    </div>
                  </div>
                ))}
                {searchUser.length < 2 && conversations.length > 0 && (
                  <>
                    <p style={{ fontSize: 11, color: "#bbb", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, fontWeight: 600 }}>Recent</p>
                    {conversations.slice(0, 6).map(c => (
                      <div key={c.other_user.id} className="convo-item" onClick={() => openConversation(c.other_user)}
                        style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 12, marginBottom: 3 }}>
                        <Avatar profile={c.other_user} size={40} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{c.other_user.full_name}</div>
                          <div style={{ fontSize: 12, color: "#aaa" }}>@{c.other_user.username}</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* EMPTY STATE */}
          {!showNewChat && !activeConvo && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#e8f4e8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>💬</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 800, color: "#ccc" }}>Your messages</div>
              <div style={{ fontSize: 13, color: "#bbb" }}>Select a conversation or start a new one</div>
              <button onClick={() => setShowNewChat(true)} style={{ marginTop: 6, padding: "10px 24px", borderRadius: 10, background: "#2d6a4f", color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                + New Message
              </button>
            </div>
          )}

          {/* ACTIVE CHAT */}
          {activeConvo && !showNewChat && (
            <>
              {/* Chat header */}
              <div style={{ padding: "12px 20px", borderBottom: "1.5px solid #e8e2d9", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, background: "#fff" }}>
                <Avatar profile={activeConvo} size={38} online />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{activeConvo.full_name}</div>
                  <div style={{ fontSize: 11, color: "#aaa" }}>@{activeConvo.username} · {activeConvo.level} · Online</div>
                </div>
                {activeCallMsg ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 13px", borderRadius: 20, background: "#e8f9f0", border: "1.5px solid #4ade80" }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "pulse 1.5s infinite" }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#166534" }}>Session live ↓</span>
                  </div>
                ) : (
                  <button className="call-btn" onClick={startVideoSession} disabled={startingCall}
                    style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 16px", borderRadius: 10, background: "#2d6a4f", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: startingCall ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 10px rgba(45,106,79,0.18)", opacity: startingCall ? 0.7 : 1, transition: "all 0.15s" }}>
                    {startingCall ? "⏳ Starting…" : "📹 Start Session"}
                  </button>
                )}
                <a href="/sessions" style={{ padding: "6px 14px", borderRadius: 8, background: "#e8f4e8", color: "#2d6a4f", fontSize: 12, fontWeight: 700, border: "1.5px solid #c6e8d4" }}>📅 Sessions</a>
                <a href="/listings" style={{ padding: "6px 14px", borderRadius: 8, background: "#f5f0e8", color: "#555", fontSize: 12, fontWeight: 700, border: "1.5px solid #e8e2d9" }}>📚 Browse Skills</a>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 8px" }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: "center", paddingTop: "18vh" }}>
                    <Avatar profile={activeConvo} size={50} />
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 800, color: "#999", marginBottom: 4, marginTop: 12 }}>{activeConvo.full_name}</div>
                    <div style={{ fontSize: 12, color: "#bbb", marginBottom: 20 }}>Say hello 👋</div>
                    <div style={{ background: "#f0fdf4", border: "1.5px dashed #4ade80", borderRadius: 14, padding: "16px 22px", maxWidth: 300, margin: "0 auto" }}>
                      <div style={{ fontSize: 22, marginBottom: 6 }}>📹</div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#166534", marginBottom: 3 }}>Have a session booked?</p>
                      <p style={{ fontSize: 11, color: "#888", lineHeight: 1.6 }}>Hit <strong>"Start Session"</strong> above to kick off a video call with a live countdown timer!</p>
                    </div>
                  </div>
                )}

                {grouped.map(group => (
                  <div key={group.date}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
                      <div style={{ flex: 1, height: 1, background: "#ede8de" }} />
                      <span style={{ fontSize: 10, color: "#bbb", fontWeight: 600, letterSpacing: 0.5 }}>{group.date}</span>
                      <div style={{ flex: 1, height: 1, background: "#ede8de" }} />
                    </div>

                    {group.messages.map((msg, i) => {
                      const isMe = msg.sender_id === profile?.id;
                      const prevMsg = group.messages[i - 1];
                      const nextMsg = group.messages[i + 1];
                      const sameSenderPrev = prevMsg?.sender_id === msg.sender_id;
                      const sameSenderNext = nextMsg?.sender_id === msg.sender_id;
                      const showAvatar = !isMe && !sameSenderNext;

                      if (msg.message_type === "session_call") {
                        let payload: CallPayload | null = null;
                        try { payload = JSON.parse(msg.content) as CallPayload; } catch { return null; }
                        return (
                          <div key={msg.id} style={{ margin: "14px 0" }}>
                            <VideoCallPanel payload={payload} currentUserId={profile?.id || ""} otherUser={activeConvo} onEnd={() => endVideoSession(msg.id)} />
                          </div>
                        );
                      }

                      return (
                        <div key={msg.id} className="msg-in"
                          style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", gap: 7, alignItems: "flex-end", marginBottom: sameSenderNext ? 2 : 8 }}>
                          {!isMe ? (
                            showAvatar
                              ? <Avatar profile={activeConvo} size={26} />
                              : <div style={{ width: 26, flexShrink: 0 }} />
                          ) : null}

                          <div style={{ maxWidth: "65%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                            {msg.message_type === "image" && msg.image_url && (
                              <img src={msg.image_url} alt="img" className="img-msg" onClick={() => setLightboxImg(msg.image_url!)}
                                style={{ maxWidth: 240, maxHeight: 280, objectFit: "cover", display: "block", marginBottom: msg.content ? 3 : 0, border: "1.5px solid #e8e2d9" }} />
                            )}
                            {msg.content && (
                              <div style={{
                                padding: "9px 13px",
                                borderRadius: isMe ? (sameSenderPrev ? "16px 4px 4px 16px" : "16px 16px 4px 16px") : (sameSenderPrev ? "4px 16px 16px 4px" : "4px 16px 16px 16px"),
                                background: isMe ? "#2d6a4f" : "#fff",
                                color: isMe ? "#fff" : "#1a1a1a",
                                fontSize: 14, lineHeight: 1.5, wordBreak: "break-word",
                                border: isMe ? "none" : "1.5px solid #e8e2d9",
                                boxShadow: isMe ? "none" : "0 1px 3px rgba(0,0,0,0.04)",
                              }}>
                                {msg.content}
                              </div>
                            )}
                            {(!sameSenderNext || nextMsg?.sender_id !== msg.sender_id) && (
                              <div style={{ fontSize: 10, color: "#bbb", marginTop: 3, display: "flex", alignItems: "center", gap: 3 }}>
                                {formatTime(msg.created_at)}
                                {isMe && <span style={{ color: msg.is_read ? "#2d6a4f" : "#bbb" }}>{msg.is_read ? "✓✓" : "✓"}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Image preview bar */}
              {imagePreview && (
                <div style={{ padding: "10px 18px", background: "#e8f4e8", borderTop: "1.5px solid #c6e8d4", display: "flex", alignItems: "center", gap: 12 }}>
                  <img src={imagePreview} style={{ height: 52, width: 52, objectFit: "cover", borderRadius: 7, border: "1.5px solid #c6e8d4" }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, color: "#2d6a4f", fontWeight: 600 }}>Image ready to send</p>
                    <p style={{ fontSize: 11, color: "#888" }}>{imageFile?.name}</p>
                  </div>
                  <button onClick={() => { setImagePreview(null); setImageFile(null); }} style={{ background: "#fce8e8", border: "1.5px solid #fca5a5", borderRadius: 7, color: "#dc2626", fontSize: 12, fontWeight: 600, padding: "4px 10px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Remove</button>
                </div>
              )}

              {/* Emoji picker */}
              {showEmoji && (
                <div style={{ padding: "10px 14px", background: "#fff", borderTop: "1.5px solid #e8e2d9", display: "flex", flexWrap: "wrap", gap: 2, animation: "slideUp 0.12s ease" }}>
                  {EMOJI_LIST.map(emoji => (
                    <span key={emoji} className="emoji-btn" onClick={() => { setNewMsg(prev => prev + emoji); textareaRef.current?.focus(); }}>{emoji}</span>
                  ))}
                </div>
              )}

              {/* Input */}
              <div style={{ padding: "10px 14px", borderTop: "1.5px solid #e8e2d9", background: "#fff", display: "flex", gap: 7, alignItems: "flex-end", flexShrink: 0 }}>
                <button className="tool-btn" onClick={() => fileInputRef.current?.click()} title="Send photo">📷</button>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageSelect} />
                <button className="tool-btn" onClick={() => setShowEmoji(p => !p)} title="Emoji" style={{ background: showEmoji ? "#e8f4e8" : "#f5f0e8", borderColor: showEmoji ? "#c6e8d4" : "#e8e2d9" }}>😊</button>
                <textarea ref={textareaRef} value={newMsg}
                  onChange={e => { setNewMsg(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 110) + "px"; }}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                  rows={1}
                  style={{ flex: 1, padding: "9px 13px", borderRadius: 11, border: "1.5px solid #e8e2d9", background: "#faf8f4", color: "#1a1a1a", fontSize: 14, fontFamily: "'DM Sans', sans-serif", resize: "none", maxHeight: 110, lineHeight: 1.5, transition: "border-color 0.15s" }}
                  onFocus={e => e.target.style.borderColor = "#2d6a4f"} onBlur={e => e.target.style.borderColor = "#e8e2d9"} />
                <button onClick={sendMessage} disabled={(!newMsg.trim() && !imageFile) || sending || uploading} className="send-btn"
                  style={{ width: 38, height: 38, borderRadius: 10, background: (newMsg.trim() || imageFile) ? "#2d6a4f" : "#e8e2d9", color: (newMsg.trim() || imageFile) ? "#fff" : "#bbb", border: "none", fontSize: 16, cursor: (newMsg.trim() || imageFile) ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {uploading ? "⏳" : sending ? "…" : "↑"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div onClick={() => setLightboxImg(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, cursor: "zoom-out", animation: "fadeIn 0.15s ease" }}>
          <img src={lightboxImg} style={{ maxWidth: "88vw", maxHeight: "88vh", objectFit: "contain", borderRadius: 10 }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightboxImg(null)} style={{ position: "absolute", top: 18, right: 18, background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: "50%", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
      )}
    </div>
  );
}