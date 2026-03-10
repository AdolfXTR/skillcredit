"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string;
  username: string;
  credits: number;
  level: string;
  avatar_url?: string | null;
  xp_multiplier?: number;
  champion_title?: string;
  teaching_title?: string | null;
  teaching_title_ends_at?: string | null;
  rating_title?: string | null;
  rating_title_ends_at?: string | null;
};

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image_url?: string;
  message_type: string;
  is_read: boolean;
  is_deleted?: boolean;
  created_at: string;
  reply_to_id?: string | null;
  reply_to?: { content: string; sender_id: string } | null;
  reactions?: Record<string, string[]>;
};

type Conversation = {
  other_user: Profile;
  last_message: string;
  last_time: string;
  unread_count: number;
};

type CreditTransferPayload = {
  amount: number;
  note: string;
  from_id: string;
  to_id: string;
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

const CHAMPION_RING: Record<number, { border: string; glow: string; badge: string; label: string }> = {
  1: { border: "linear-gradient(135deg,#FFD700,#FFA500,#FFD700)", glow: "0 0 12px rgba(255,215,0,.55)", badge: "👑", label: "Champion" },
  2: { border: "linear-gradient(135deg,#C0C0C0,#A8A8A8,#C0C0C0)", glow: "0 0 10px rgba(192,192,192,.45)", badge: "🥈", label: "Runner-up" },
  3: { border: "linear-gradient(135deg,#CD7F32,#A0522D,#CD7F32)", glow: "0 0 10px rgba(205,127,50,.45)", badge: "🥉", label: "3rd Place" },
};

const QUICK_REACTIONS = ["❤️","😂","🔥","👍","🎉","🤯"];
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
function formatFileSize(bytes: number) {
  if (!bytes) return "";
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  return Math.round(bytes / 1024) + " KB";
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
function getChampionRank(xp_multiplier?: number): number {
  if (!xp_multiplier) return 0;
  if (xp_multiplier >= 1.25) return 1;
  if (xp_multiplier >= 1.15) return 2;
  if (xp_multiplier >= 1.1) return 3;
  return 0;
}
function getPerkLine(user: Profile): string {
  const rank = getChampionRank(user.xp_multiplier);
  const parts: string[] = [];
  if (rank > 0) parts.push(`${CHAMPION_RING[rank].badge} ${user.champion_title || CHAMPION_RING[rank].label}`);
  if (user.teaching_title && new Date(user.teaching_title_ends_at || 0) > new Date()) parts.push("🎓 Teacher");
  if (user.rating_title && new Date(user.rating_title_ends_at || 0) > new Date()) parts.push("⭐ Top Rated");
  return parts.join(" · ");
}

// ─── AVATAR ───────────────────────────────────────────────────────────────────
function Avatar({ profile, size = 36, online = false }: { profile: Profile; size?: number; online?: boolean }) {
  const color = LEVEL_COLORS[profile.level] || "#2d6a4f";
  const rank = getChampionRank(profile.xp_multiplier);
  const champ = rank > 0 ? CHAMPION_RING[rank] : null;
  return (
    <div style={{ position: "relative", flexShrink: 0, width: size, height: size }}>
      {champ && (
        <div style={{ position: "absolute", inset: -2, borderRadius: "50%", background: champ.border, padding: 2, zIndex: 0, boxShadow: champ.glow }}>
          <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "#fff" }} />
        </div>
      )}
      <div style={{ position: "absolute", inset: champ ? 2 : 0, borderRadius: "50%", overflow: "hidden", background: profile.avatar_url ? "transparent" : color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.34, fontWeight: 700, color: "#fff", zIndex: 1 }}>
        {profile.avatar_url
          ? <img src={profile.avatar_url} alt={profile.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          : getInitials(profile.full_name)
        }
      </div>
      {champ && <div style={{ position: "absolute", top: -5, right: -5, fontSize: size * 0.36, lineHeight: 1, zIndex: 2, filter: "drop-shadow(0 1px 2px rgba(0,0,0,.25))" }}>{champ.badge}</div>}
      {online && !champ && <div style={{ position: "absolute", bottom: 0, right: 0, width: 9, height: 9, borderRadius: "50%", background: "#22c55e", border: "2px solid #fff", zIndex: 2 }} />}
    </div>
  );
}

// ─── FILE BUBBLE ──────────────────────────────────────────────────────────────
function FileBubble({ content, isMe }: { content: string; isMe: boolean }) {
  let fp: { url: string; name: string; size?: number } | null = null;
  try { fp = JSON.parse(content); } catch { return null; }
  if (!fp?.url) return null;
  const ext = fp.name?.split(".").pop()?.toLowerCase() || "";
  const icon = ["pdf"].includes(ext) ? "📄" : ["doc","docx"].includes(ext) ? "📝" : ["xls","xlsx"].includes(ext) ? "📊" : ["zip","rar","7z"].includes(ext) ? "🗜️" : ["mp4","mov","avi"].includes(ext) ? "🎬" : ["mp3","wav"].includes(ext) ? "🎵" : "📎";
  return (
    <a href={fp.url} target="_blank" rel="noopener noreferrer"
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: isMe ? "rgba(255,255,255,0.15)" : "#f0f0f5", borderRadius: 12, border: isMe ? "1px solid rgba(255,255,255,0.2)" : "1px solid #e4e4ed", textDecoration: "none", minWidth: 200, maxWidth: 280 }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: isMe ? "rgba(255,255,255,0.2)" : "#e8e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: isMe ? "#fff" : "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>{fp.name}</p>
        <p style={{ fontSize: 11, color: isMe ? "rgba(255,255,255,0.65)" : "#999" }}>{fp.size ? formatFileSize(fp.size) : ""} · tap to download</p>
      </div>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: isMe ? "rgba(255,255,255,0.2)" : "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 13, color: "#fff" }}>↓</span>
      </div>
    </a>
  );
}

// ─── CREDIT TRANSFER BUBBLE ───────────────────────────────────────────────────
function CreditTransferBubble({ payload, isMe, senderName }: { payload: CreditTransferPayload; isMe: boolean; senderName: string }) {
  return (
    <div style={{ background: isMe ? "linear-gradient(135deg,#1a4a36,#2d6a4f)" : "linear-gradient(135deg,#fef9ec,#fef3c7)", borderRadius: 14, border: isMe ? "none" : "1.5px solid #fbbf24", padding: "14px 18px", maxWidth: 240, boxShadow: isMe ? "0 2px 12px rgba(45,106,79,0.25)" : "0 2px 12px rgba(251,191,36,0.15)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: isMe ? "rgba(255,255,255,0.15)" : "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>💰</div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: isMe ? "rgba(255,255,255,0.6)" : "#92400e", letterSpacing: 0.5 }}>CREDIT TRANSFER</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: isMe ? "#fff" : "#1a1a1a", fontFamily: "'Fraunces', serif", lineHeight: 1 }}>{payload.amount} cr</div>
        </div>
      </div>
      {payload.note && <div style={{ fontSize: 12, color: isMe ? "rgba(255,255,255,0.75)" : "#666", fontStyle: "italic", marginBottom: 6 }}>"{payload.note}"</div>}
      <div style={{ fontSize: 10, color: isMe ? "rgba(255,255,255,0.45)" : "#bbb" }}>
        {isMe ? "You sent" : `${senderName} sent you`} {payload.amount} credits
      </div>
    </div>
  );
}

// ─── CANCELLATION BUBBLE ──────────────────────────────────────────────────────
function parseCancellation(content: string): { name: string; action: string; title: string; reason: string } | null {
  const m = content.match(/^(.+?) (cancelled|declined) the session for "(.+?)": (.+)$/);
  if (!m) return null;
  return { name: m[1], action: m[2], title: m[3], reason: m[4] };
}

function CancellationBubble({ content, isMe }: { content: string; isMe: boolean }) {
  const info = parseCancellation(content);
  if (!info) return null;
  const isDecline = info.action === "declined";
  const accentColor = isDecline ? "#dc2626" : "#ea580c";
  const accentBg    = isDecline
    ? "linear-gradient(135deg,#dc2626,#b91c1c)"
    : "linear-gradient(135deg,#ea580c,#c2410c)";

  return (
    <div style={{
      maxWidth: 300,
      borderRadius: 16,
      overflow: "hidden",
      border: `1.5px solid ${isDecline ? "#fecaca" : "#fed7aa"}`,
      boxShadow: `0 3px 16px ${isDecline ? "rgba(239,68,68,0.10)" : "rgba(234,88,12,0.10)"}`,
      background: "#fff",
    }}>
      {/* Coloured header strip */}
      <div style={{ background: accentBg, padding: "10px 14px", display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
          {isDecline ? "❌" : "🚫"}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.7)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 1 }}>
            Session {isDecline ? "Declined" : "Cancelled"}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {info.title}
          </div>
        </div>
      </div>

      {/* Reason body */}
      <div style={{ padding: "11px 14px 13px" }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: "#bbb", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 7 }}>
          Reason
        </div>
        <div style={{
          fontSize: 12.5,
          color: "#444",
          lineHeight: 1.6,
          background: isDecline ? "#fef2f2" : "#fff7ed",
          borderRadius: 10,
          padding: "8px 11px",
          borderLeft: `3px solid ${accentColor}`,
          fontStyle: "italic",
        }}>
          "{info.reason}"
        </div>
        <div style={{ fontSize: 10.5, color: "#bbb", marginTop: 9, fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: accentColor, display: "inline-block", flexShrink: 0 }} />
          {isMe ? "You" : info.name} {info.action} this session · credits refunded
        </div>
      </div>
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [convoFilter, setConvoFilter] = useState<"all" | "teachers" | "students">("all");

  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [sendingCredits, setSendingCredits] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ msgId: string; x: number; y: number } | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<any>(null);
  const typingTimeout = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const presenceChannelRef = useRef<any>(null);
  const profileRef = useRef<Profile | null>(null);
  const activeConvoRef = useRef<Profile | null>(null);

  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { activeConvoRef.current = activeConvo; }, [activeConvo]);
  useEffect(() => { loadData(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => {
    const handler = () => { setContextMenu(null); setShowReactionPicker(null); };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase.channel(`messages-${profile.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${profile.id}` }, (payload) => {
        const msg = payload.new as Message;
        const cur = activeConvoRef.current;
        if (cur && msg.sender_id === cur.id) { setMessages(prev => [...prev, msg]); markRead(cur.id); }
        const p = profileRef.current;
        if (p) loadConversations(p.id);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.old.id ? { ...m, is_deleted: true, content: "[deleted]" } : m));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  useEffect(() => {
    if (!profile || !activeConvo) return;
    const roomId = [profile.id, activeConvo.id].sort().join("-");
    const ch = supabase.channel(`typing-${roomId}`, { config: { presence: { key: profile.id } } })
      .on("presence", { event: "sync" }, () => {
        const state = ch.presenceState() as Record<string, any[]>;
        const typers = Object.entries(state).filter(([uid, data]) => uid !== profile.id && data[0]?.isTyping).map(([uid]) => uid);
        setTypingUsers(typers);
      }).subscribe();
    presenceChannelRef.current = ch;
    return () => { supabase.removeChannel(ch); presenceChannelRef.current = null; };
  }, [profile, activeConvo]);

  function broadcastTyping(isTyping: boolean) { presenceChannelRef.current?.track({ isTyping }); }
  function handleTyping(val: string) {
    setNewMsg(val);
    broadcastTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => broadcastTyping(false), 2000);
  }

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
          setActiveConvo(targetUser); setShowNewChat(false);
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
    const { data: msgs } = await supabase.from("messages").select("*").or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).order("created_at", { ascending: false });
    if (!msgs) return;
    const convoMap = new Map<string, Message[]>();
    msgs.forEach(msg => {
      const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      if (!convoMap.has(otherId)) convoMap.set(otherId, []);
      convoMap.get(otherId)!.push(msg);
    });
    const otherIds = Array.from(convoMap.keys());
    if (otherIds.length === 0) { setConversations([]); return; }
    const { data: profiles } = await supabase.from("profiles").select("*").in("id", otherIds);
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    const convos: Conversation[] = [];
    for (const [otherId, ms] of convoMap) {
      const op = profileMap.get(otherId);
      if (!op) continue;
      const last = ms[0];
      const unread = ms.filter(m => m.receiver_id === userId && !m.is_read && !m.is_deleted).length;
      // Pretty label for cancellation messages in sidebar preview
      const isCancelMsg = parseCancellation(last.content);
      const lastText = last.is_deleted ? "🚫 Deleted"
        : last.message_type === "image" ? "📷 Photo"
        : last.message_type === "session_call" ? "📹 Video session"
        : last.message_type === "credit_transfer" ? "💰 Credits sent"
        : last.message_type === "file" ? "📎 File"
        : isCancelMsg ? `🚫 Session ${isCancelMsg.action}`
        : last.content;
      convos.push({ other_user: op, last_message: lastText, last_time: last.created_at, unread_count: unread });
    }
    setConversations(convos);
  }

  async function openConversation(other: Profile) {
    setActiveConvo(other); setShowNewChat(false); setShowEmoji(false); setReplyingTo(null);
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

  async function toggleReaction(msgId: string, emoji: string) {
    if (!profile) return;
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const reactions = { ...(msg.reactions || {}) };
    const users = reactions[emoji] || [];
    if (users.includes(profile.id)) {
      reactions[emoji] = users.filter(id => id !== profile.id);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else { reactions[emoji] = [...users, profile.id]; }
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions } : m));
    await supabase.from("messages").update({ reactions }).eq("id", msgId);
    setShowReactionPicker(null);
  }

  async function deleteMessage(msgId: string) {
    if (!profile) return;
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_deleted: true, content: "[deleted]" } : m));
    await supabase.from("messages").update({ is_deleted: true, content: "[deleted]", image_url: null }).eq("id", msgId).eq("sender_id", profile.id);
    setContextMenu(null);
  }

  async function handleSendCredits() {
    if (!profile || !activeConvo || !creditAmount) return;
    const amount = parseInt(creditAmount);
    if (isNaN(amount) || amount <= 0 || amount > profile.credits) return;
    setSendingCredits(true);
    await supabase.from("profiles").update({ credits: profile.credits - amount }).eq("id", profile.id);
    await supabase.rpc("increment_credits", { user_id: activeConvo.id, amount });
    const payload: CreditTransferPayload = { amount, note: creditNote, from_id: profile.id, to_id: activeConvo.id };
    const { data: msg } = await supabase.from("messages").insert({ sender_id: profile.id, receiver_id: activeConvo.id, content: JSON.stringify(payload), message_type: "credit_transfer", is_read: false }).select().single();
    if (msg) setMessages(prev => [...prev, msg]);
    setProfile(prev => prev ? { ...prev, credits: prev.credits - amount } : prev);
    try { await supabase.from("notifications").insert({ user_id: activeConvo.id, type: "credit_transfer", title: `${profile.full_name} sent you ${amount} credits!`, body: creditNote || "Credits received!", link: "/messages" }); } catch (_) {}
    try { await supabase.from("moderation_logs").insert({ mod_id: profile.id, target_id: activeConvo.id, target_type: "credit_transfer", action: "sent", reason: `${amount} credits`, author_id: profile.id }); } catch (_) {}
    setCreditAmount(""); setCreditNote(""); setShowCreditModal(false); setSendingCredits(false);
    await loadConversations(profile.id);
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

  async function handleAttachSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { alert("File must be under 20MB"); return; }
    setAttachFile(file); e.target.value = "";
  }

  async function uploadAttachment(file: File): Promise<string | null> {
    const path = `${profile!.id}/files/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("message-files").upload(path, file);
    if (error) {
      const { error: e2 } = await supabase.storage.from("message-images").upload("files/" + path, file);
      if (e2) return null;
      const { data } = supabase.storage.from("message-images").getPublicUrl("files/" + path);
      return data.publicUrl;
    }
    const { data } = supabase.storage.from("message-files").getPublicUrl(path);
    return data.publicUrl;
  }

  async function sendMessage() {
    if (!profile || !activeConvo) return;
    if (!newMsg.trim() && !imageFile && !attachFile) return;
    setSending(true); setShowEmoji(false);
    const capturedAttach = attachFile;
    const capturedImage = imageFile;
    let imageUrl: string | null = null;
    let fileUrl: string | null = null;
    if (capturedImage) {
      setUploading(true); setUploadProgress(30);
      imageUrl = await uploadImage(capturedImage);
      setUploadProgress(100); setTimeout(() => setUploadProgress(0), 400);
      setUploading(false); setImageFile(null); setImagePreview(null);
    }
    if (capturedAttach) {
      setUploading(true); setUploadProgress(30);
      fileUrl = await uploadAttachment(capturedAttach);
      setUploadProgress(100); setTimeout(() => setUploadProgress(0), 400);
      setUploading(false); setAttachFile(null);
    }
    const msgType = imageUrl ? "image" : fileUrl ? "file" : "text";
    const msgData: any = {
      sender_id: profile.id, receiver_id: activeConvo.id,
      content: fileUrl ? JSON.stringify({ url: fileUrl, name: capturedAttach!.name, size: capturedAttach!.size }) : (newMsg.trim() || ""),
      image_url: imageUrl, message_type: msgType, is_read: false,
    };
    if (replyingTo) msgData.reply_to_id = replyingTo.id;
    const { data: msg } = await supabase.from("messages").insert(msgData).select().single();
    if (msg) {
      const withReply = replyingTo ? { ...msg, reply_to: { content: replyingTo.content, sender_id: replyingTo.sender_id } } : msg;
      setMessages(prev => [...prev, withReply]);
    }
    setNewMsg(""); setReplyingTo(null); broadcastTyping(false);
    try { await supabase.from("notifications").insert({ user_id: activeConvo.id, type: "message", title: `New message from ${profile.full_name}`, body: imageUrl ? "📷 Sent a photo" : fileUrl ? `📎 ${capturedAttach!.name}` : newMsg.trim().slice(0, 80), link: "/messages" }); } catch (_) {}
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

  const totalUnread = conversations.reduce((s, c) => s + c.unread_count, 0);
  const grouped = groupByDate(messages.filter(m => !m.is_deleted || m.sender_id === profile?.id));

  const filteredConvos = conversations.filter(c => {
    if (convoFilter === "all") return true;
    const hasTitles = getPerkLine(c.other_user);
    if (convoFilter === "teachers") return hasTitles.includes("🎓") || hasTitles.includes("👑");
    if (convoFilter === "students") return !hasTitles.includes("🎓");
    return true;
  });

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F8F9FB", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap'); @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 32, height: 32, border: "3px solid #2d6a4f", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ color: "#999", fontSize: 13 }}>Loading messages…</p>
      </div>
    </div>
  );

  return (
    <div style={{ height: "100vh", background: "#F8F9FB", fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        a { text-decoration: none; }
        @keyframes popIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:none} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes typingBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #e0dbd4; border-radius: 999px; }
        .convo-item { transition: background 0.1s; cursor: pointer; border-radius: 12px; }
        .convo-item:hover { background: #f2f2f5 !important; }
        .convo-item.active { background: #eef6f2 !important; }
        .send-btn:hover:not(:disabled) { filter: brightness(1.08); }
        .emoji-btn { transition: transform 0.1s; cursor: pointer; border-radius: 6px; padding: 3px; font-size: 20px; display: inline-block; }
        .emoji-btn:hover { transform: scale(1.3); background: #f0f0f5; }
        .msg-in { animation: popIn 0.15s ease; }
        .img-msg { cursor: zoom-in; transition: opacity 0.1s; }
        .img-msg:hover { opacity: 0.9; }
        textarea:focus { outline: none; }
        input:focus { outline: none; }
        .nav-link { padding: 6px 12px; border-radius: 8px; color: #666; font-size: 13px; font-weight: 600; transition: all 0.12s; }
        .nav-link:hover { background: #f0f0f5; color: #333; }
        .nav-link.active { background: #eef6f2; color: #2d6a4f; }
        .reaction-pill { cursor: pointer; transition: transform 0.1s; border-radius: 999px; padding: 2px 8px; display: inline-flex; align-items: center; gap: 3px; font-size: 12px; border: 1px solid #e4e4ed; background: #fff; }
        .reaction-pill:hover { transform: scale(1.1); }
        .reaction-pill.mine { background: #eef6f2; border-color: #86efac; }
        .msg-actions { opacity: 0; transition: opacity 0.12s; }
        .msg-wrapper:hover .msg-actions { opacity: 1; }
        .ctx-item { padding: 8px 14px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.1s; border-radius: 8px; color: #333; }
        .ctx-item:hover { background: #f2f2f5; }
        .ctx-item.danger { color: #dc2626; }
        .ctx-item.danger:hover { background: #fef2f2; }
        .filter-tab { padding: 5px 14px; border-radius: 999px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1.5px solid transparent; transition: all 0.12s; background: transparent; color: #999; font-family: 'DM Sans', sans-serif; }
        .filter-tab:hover { color: #333; }
        .filter-tab.active { background: #eef6f2; color: #2d6a4f; border-color: #c6e8d4; }
        .action-btn { display: flex; align-items: center; gap: 6px; padding: 7px 15px; border-radius: 9px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1.5px solid transparent; transition: all 0.12s; font-family: 'DM Sans', sans-serif; text-decoration: none; }
        .action-btn:hover { filter: brightness(0.96); }
        .input-tool { width: 34px; height: 34px; border-radius: 9px; border: none; background: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 17px; transition: background 0.1s; flex-shrink: 0; color: #888; }
        .input-tool:hover { background: #f0f0f5; }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #ebebef", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, zIndex: 10 }}>
        <a href="/dashboard">
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display: "flex", gap: 2 }}>
          {[["Bounties", "/bounties"], ["Community", "/community"], ["Sessions", "/sessions"], ["Messages", "/messages"]].map(([l, h]) => (
            <a key={l} href={h} className={`nav-link ${h === "/messages" ? "active" : ""}`} style={{ position: "relative" }}>
              {l}
              {l === "Messages" && totalUnread > 0 && <span style={{ position: "absolute", top: 3, right: 3, width: 7, height: 7, borderRadius: "50%", background: "#ef4444", border: "1.5px solid #fff" }} />}
            </a>
          ))}
        </div>
        <a href="/profile" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 10, background: "#f5f5f8", textDecoration: "none" }}>
          {profile && <Avatar profile={profile} size={26} />}
          <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>@{profile?.username}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f", background: "#eef6f2", padding: "2px 8px", borderRadius: 20 }}>{profile?.credits} cr</span>
        </a>
      </nav>

      {/* ── LAYOUT ── */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "300px 1fr", overflow: "hidden" }}>

        {/* ── SIDEBAR ── */}
        <div style={{ background: "#fff", borderRight: "1px solid #ebebef", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid #f2f2f5", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 900, color: "#1a1a1a", display: "flex", alignItems: "center", gap: 8 }}>
                Messages
                {totalUnread > 0 && <span style={{ fontSize: 11, fontWeight: 800, background: "#ef4444", color: "#fff", padding: "1px 7px", borderRadius: 999 }}>{totalUnread}</span>}
              </span>
              <button onClick={() => { setShowNewChat(true); setActiveConvo(null); setSearchUser(""); setSearchResults([]); }}
                style={{ width: 28, height: 28, borderRadius: "50%", background: "#2d6a4f", color: "#fff", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, lineHeight: 1 }}>+</button>
            </div>
            <input placeholder="Search conversations…"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 9, border: "1.5px solid #ebebef", background: "#F8F9FB", color: "#333", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }} />
          </div>

          <div style={{ padding: "8px 12px", borderBottom: "1px solid #f2f2f5", display: "flex", gap: 4, flexShrink: 0 }}>
            {(["all", "teachers", "students"] as const).map(tab => (
              <button key={tab} className={`filter-tab ${convoFilter === tab ? "active" : ""}`} onClick={() => setConvoFilter(tab)}>
                {tab === "all" ? "All" : tab === "teachers" ? "🎓 Teachers" : "📚 Students"}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
            {filteredConvos.length === 0 ? (
              <div style={{ textAlign: "center", padding: "44px 20px", color: "#ccc" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>💬</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#bbb" }}>No conversations yet</div>
                <div style={{ fontSize: 12, marginTop: 4, color: "#ccc" }}>Click + to start chatting</div>
              </div>
            ) : filteredConvos.map(c => {
              const rank = getChampionRank(c.other_user.xp_multiplier);
              const perk = getPerkLine(c.other_user);
              return (
                <div key={c.other_user.id}
                  className={`convo-item ${activeConvo?.id === c.other_user.id ? "active" : ""}`}
                  onClick={() => openConversation(c.other_user)}
                  style={{ padding: "12px 10px", display: "flex", gap: 10, alignItems: "center", marginBottom: 2,
                    borderLeft: rank === 1 ? "2px solid #FFD700" : rank === 2 ? "2px solid #C0C0C0" : rank === 3 ? "2px solid #CD7F32" : "2px solid transparent" }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <Avatar profile={c.other_user} size={36} online />
                    {c.unread_count > 0 && (
                      <div style={{ position: "absolute", top: -2, right: -2, minWidth: 15, height: 15, borderRadius: 999, background: "#ef4444", fontSize: 8, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
                        {c.unread_count}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                      <span style={{ fontSize: 13.5, fontWeight: c.unread_count > 0 ? 800 : 600, color: "#1a1a1a" }}>{c.other_user.full_name}</span>
                      <span style={{ fontSize: 10, color: "#bbb", flexShrink: 0, marginLeft: 6 }}>{timeAgo(c.last_time)}</span>
                    </div>
                    {perk && <div style={{ fontSize: 10, fontWeight: 600, color: rank === 1 ? "#92400e" : "#6b7280", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{perk}</div>}
                    <div style={{ fontSize: 12, color: c.unread_count > 0 ? "#444" : "#aaa", fontWeight: c.unread_count > 0 ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
                      {c.unread_count > 0 && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2d6a4f", flexShrink: 0, display: "inline-block" }} />}
                      {c.last_message}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── MAIN PANEL ── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "#F8F9FB" }}>

          {showNewChat && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", animation: "fadeIn 0.15s ease", background: "#fff" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #f2f2f5", flexShrink: 0 }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a", marginBottom: 14 }}>New Message</div>
                <input value={searchUser} onChange={e => handleSearchUsers(e.target.value)} placeholder="Search by name or @username…" autoFocus
                  style={{ width: "100%", padding: "11px 15px", borderRadius: 11, border: "1.5px solid #ebebef", background: "#F8F9FB", color: "#333", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}
                  onFocus={e => e.target.style.borderColor = "#2d6a4f"} onBlur={e => e.target.style.borderColor = "#ebebef"} />
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px" }}>
                {searching && <div style={{ textAlign: "center", padding: 24, color: "#ccc", fontSize: 13 }}>Searching…</div>}
                {!searching && searchUser.length >= 2 && searchResults.length === 0 && <div style={{ textAlign: "center", padding: 24, color: "#ccc", fontSize: 13 }}>No users found</div>}
                {searchResults.map(user => (
                  <div key={user.id} className="convo-item" onClick={() => openConversation(user)} style={{ padding: "11px 12px", display: "flex", alignItems: "center", gap: 12, marginBottom: 3 }}>
                    <Avatar profile={user} size={40} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{user.full_name}</div>
                      <div style={{ fontSize: 12, color: "#aaa" }}>@{user.username} · {user.level}</div>
                    </div>
                  </div>
                ))}
                {searchUser.length < 2 && conversations.length > 0 && (
                  <>
                    <p style={{ fontSize: 11, color: "#ccc", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, fontWeight: 700 }}>Recent</p>
                    {conversations.slice(0, 6).map(c => (
                      <div key={c.other_user.id} className="convo-item" onClick={() => openConversation(c.other_user)} style={{ padding: "11px 12px", display: "flex", alignItems: "center", gap: 12, marginBottom: 3 }}>
                        <Avatar profile={c.other_user} size={38} />
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

          {!showNewChat && !activeConvo && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14 }}>
              <div style={{ width: 68, height: 68, borderRadius: "50%", background: "#eef6f2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>💬</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 800, color: "#ccc" }}>Your messages</div>
              <div style={{ fontSize: 13, color: "#bbb" }}>Select a conversation or start a new one</div>
              <button onClick={() => setShowNewChat(true)} style={{ marginTop: 4, padding: "10px 24px", borderRadius: 10, background: "#2d6a4f", color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                + New Message
              </button>
            </div>
          )}

          {activeConvo && !showNewChat && (
            <>
              {/* Chat header */}
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #ebebef", background: "#fff", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <Avatar profile={activeConvo} size={40} online />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a", marginBottom: 3, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {activeConvo.full_name}
                      {(() => {
                        const rank = getChampionRank(activeConvo.xp_multiplier);
                        return rank > 0 ? (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999,
                            background: rank === 1 ? "#fef9ec" : rank === 2 ? "#f3f4f6" : "#fef3ec",
                            color: rank === 1 ? "#92400e" : rank === 2 ? "#374151" : "#78350f",
                            border: `1px solid ${rank === 1 ? "#fbbf24" : rank === 2 ? "#d1d5db" : "#d97706"}` }}>
                            {CHAMPION_RING[rank].badge} {activeConvo.champion_title || CHAMPION_RING[rank].label}
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <div style={{ fontSize: 11, color: "#999", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                        @{activeConvo.username} · {activeConvo.level}
                      </span>
                      {activeConvo.teaching_title && new Date(activeConvo.teaching_title_ends_at || 0) > new Date() && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#eef6f2", color: "#2d6a4f", border: "1px solid #c6e8d4" }}>
                          🎓 {activeConvo.teaching_title}
                        </span>
                      )}
                      {activeConvo.rating_title && new Date(activeConvo.rating_title_ends_at || 0) > new Date() && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#fefce8", color: "#92400e", border: "1px solid #fde68a" }}>
                          ⭐ {activeConvo.rating_title}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button onClick={() => setShowCreditModal(true)} className="action-btn"
                      style={{ background: "#fef9ec", color: "#92400e", border: "1.5px solid #fbbf24" }}>
                      💰 Send Credits
                    </button>
                    <a href="/sessions" className="action-btn"
                      style={{ background: "#e8f4e8", color: "#2d6a4f", border: "1.5px solid #c6e8d4" }}>
                      📅 Sessions
                    </a>
                  </div>
                </div>
              </div>

              {/* Messages area */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 12px" }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: "center", paddingTop: "16vh" }}>
                    <Avatar profile={activeConvo} size={52} />
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 800, color: "#ccc", marginTop: 14, marginBottom: 4 }}>{activeConvo.full_name}</div>
                    <div style={{ fontSize: 13, color: "#ccc" }}>Say hello 👋</div>
                  </div>
                )}

                {grouped.map(group => (
                  <div key={group.date}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0 14px" }}>
                      <div style={{ flex: 1, height: 1, background: "#ebebef" }} />
                      <span style={{ fontSize: 11, color: "#bbb", fontWeight: 600, letterSpacing: 0.4 }}>{group.date}</span>
                      <div style={{ flex: 1, height: 1, background: "#ebebef" }} />
                    </div>

                    {group.messages.map((msg, i) => {
                      const isMe = msg.sender_id === profile?.id;
                      const prevMsg = group.messages[i - 1];
                      const nextMsg = group.messages[i + 1];
                      const isFirstInGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id;
                      const isLastInGroup = !nextMsg || nextMsg.sender_id !== msg.sender_id;
                      const reactionEntries = Object.entries(msg.reactions || {}).filter(([_, u]) => u.length > 0);

                      if (msg.message_type === "session_call") return null;

                      if (msg.message_type === "credit_transfer") {
                        let payload: CreditTransferPayload | null = null;
                        try { payload = JSON.parse(msg.content) as CreditTransferPayload; } catch { return null; }
                        return (
                          <div key={msg.id} className="msg-in" style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: 12 }}>
                            <CreditTransferBubble payload={payload} isMe={isMe} senderName={activeConvo.full_name} />
                          </div>
                        );
                      }

                      // ── Cancellation system message ──
                      if (!msg.is_deleted && parseCancellation(msg.content)) {
                        return (
                          <div key={msg.id} className="msg-in" style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: 16 }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: 4 }}>
                              <CancellationBubble content={msg.content} isMe={isMe} />
                              <div style={{ fontSize: 10, color: "#bbb", paddingLeft: 2, paddingRight: 2 }}>{formatTime(msg.created_at)}</div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={msg.id} className="msg-wrapper msg-in"
                          style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", gap: 8, alignItems: "flex-end",
                            marginBottom: reactionEntries.length > 0 ? 22 : (isLastInGroup ? 12 : 3), position: "relative" }}>

                          {!isMe && (
                            isLastInGroup
                              ? <Avatar profile={activeConvo} size={32} />
                              : <div style={{ width: 32, flexShrink: 0 }} />
                          )}

                          <div style={{ maxWidth: "62%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                            {msg.reply_to && (
                              <div style={{ marginBottom: 4, padding: "5px 10px", borderRadius: 8, background: "#f0f0f5", borderLeft: `2px solid ${isMe ? "#86efac" : "#2d6a4f"}`, fontSize: 11, color: "#999", maxWidth: "100%" }}>
                                <div style={{ fontWeight: 700, color: "#666", marginBottom: 1, fontSize: 10 }}>
                                  {msg.reply_to.sender_id === profile?.id ? "You" : activeConvo.full_name}
                                </div>
                                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {msg.reply_to.content?.slice(0, 60)}{(msg.reply_to.content?.length || 0) > 60 ? "…" : ""}
                                </div>
                              </div>
                            )}

                            {msg.message_type === "file" && !msg.is_deleted && (
                              <FileBubble content={msg.content} isMe={isMe} />
                            )}

                            {msg.message_type === "image" && msg.image_url && !msg.is_deleted && (
                              <img src={msg.image_url} alt="img" className="img-msg" onClick={() => setLightboxImg(msg.image_url!)}
                                style={{ maxWidth: 220, maxHeight: 260, objectFit: "cover", display: "block", borderRadius: isMe ? "14px 14px 2px 14px" : "14px 14px 14px 2px", marginBottom: msg.content && msg.content !== "" ? 3 : 0, border: "1px solid #e4e4ed" }} />
                            )}

                            {msg.message_type !== "file" && (msg.content || msg.is_deleted) && (
                              <div style={{
                                padding: "10px 14px",
                                borderRadius: isMe
                                  ? (isFirstInGroup ? "18px 18px 4px 18px" : isLastInGroup ? "4px 18px 18px 18px" : "4px 18px 18px 4px")
                                  : (isFirstInGroup ? "18px 18px 18px 4px" : isLastInGroup ? "18px 4px 18px 18px" : "18px 4px 4px 18px"),
                                background: msg.is_deleted ? "#f5f5f8" : isMe ? "#2d6a4f" : "#fff",
                                color: msg.is_deleted ? "#bbb" : isMe ? "#fff" : "#1a1a1a",
                                fontSize: msg.is_deleted ? 12 : 14,
                                lineHeight: 1.55,
                                wordBreak: "break-word",
                                border: isMe ? "none" : "1px solid #ebebef",
                                boxShadow: isMe ? "0 1px 4px rgba(45,106,79,0.18)" : "0 1px 3px rgba(0,0,0,0.05)",
                                fontStyle: msg.is_deleted ? "italic" : "normal",
                              }}>
                                {msg.is_deleted ? "🚫 Message deleted" : msg.content}
                              </div>
                            )}

                            {reactionEntries.length > 0 && (
                              <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 4, position: "absolute", bottom: -20, [isMe ? "right" : "left"]: 0 }}>
                                {reactionEntries.map(([emoji, users]) => (
                                  <button key={emoji} className={`reaction-pill ${users.includes(profile?.id || "") ? "mine" : ""}`} onClick={() => toggleReaction(msg.id, emoji)}>
                                    <span style={{ fontSize: 13 }}>{emoji}</span>
                                    <span style={{ fontSize: 10, color: "#888", fontWeight: 700 }}>{users.length}</span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {isLastInGroup && (
                              <div style={{ fontSize: 10, color: "#bbb", marginTop: 4, display: "flex", alignItems: "center", gap: 3 }}>
                                {formatTime(msg.created_at)}
                                {isMe && <span style={{ color: msg.is_read ? "#2d6a4f" : "#ccc", fontSize: 11 }}>{msg.is_read ? "✓✓" : "✓"}</span>}
                              </div>
                            )}
                          </div>

                          {!msg.is_deleted && (
                            <div className="msg-actions" style={{ display: "flex", alignItems: "center", gap: 2, alignSelf: "center", flexDirection: isMe ? "row" : "row-reverse" }}>
                              <div style={{ position: "relative" }}>
                                <button onClick={e => { e.stopPropagation(); setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id); }}
                                  style={{ width: 26, height: 26, borderRadius: "50%", background: "#fff", border: "1px solid #ebebef", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>😊</button>
                                {showReactionPicker === msg.id && (
                                  <div onClick={e => e.stopPropagation()} style={{ position: "absolute", [isMe ? "right" : "left"]: 0, bottom: 30, background: "#fff", borderRadius: 12, border: "1px solid #ebebef", padding: "6px 8px", display: "flex", gap: 4, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", zIndex: 10, animation: "slideUp 0.1s ease" }}>
                                    {QUICK_REACTIONS.map(emoji => (
                                      <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                                        style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", fontSize: 19, cursor: "pointer", transition: "transform 0.1s" }}
                                        onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.3)")}
                                        onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}>
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <button onClick={() => { setReplyingTo(msg); textareaRef.current?.focus(); }}
                                style={{ width: 26, height: 26, borderRadius: "50%", background: "#fff", border: "1px solid #ebebef", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>↩</button>
                              {isMe && (
                                <button onClick={e => { e.stopPropagation(); setContextMenu({ msgId: msg.id, x: e.clientX, y: e.clientY }); }}
                                  style={{ width: 26, height: 26, borderRadius: "50%", background: "#fff", border: "1px solid #ebebef", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "#999", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>⋯</button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {typingUsers.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0 10px", animation: "fadeIn 0.2s ease" }}>
                    <Avatar profile={activeConvo} size={28} />
                    <div style={{ background: "#fff", border: "1px solid #ebebef", borderRadius: "4px 14px 14px 14px", padding: "8px 14px", display: "flex", gap: 3, alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#bbb", animation: `typingBounce 1.2s ease ${i * 0.2}s infinite` }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: "#bbb" }}>{activeConvo.full_name.split(" ")[0]} is typing…</span>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {replyingTo && (
                <div style={{ padding: "8px 18px", background: "#f0fdf6", borderTop: "1px solid #c6e8d4", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <div style={{ width: 3, height: 36, borderRadius: 3, background: "#2d6a4f", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#2d6a4f", marginBottom: 1 }}>Replying to {replyingTo.sender_id === profile?.id ? "yourself" : activeConvo.full_name}</div>
                    <div style={{ fontSize: 12, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{replyingTo.content?.slice(0, 80)}</div>
                  </div>
                  <button onClick={() => setReplyingTo(null)} style={{ background: "none", border: "none", color: "#bbb", fontSize: 16, cursor: "pointer" }}>✕</button>
                </div>
              )}

              {imagePreview && (
                <div style={{ padding: "10px 18px", background: "#f0fdf6", borderTop: "1px solid #c6e8d4", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  <img src={imagePreview} alt="preview" style={{ height: 50, width: 50, objectFit: "cover", borderRadius: 8, border: "1.5px solid #c6e8d4" }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, color: "#2d6a4f", fontWeight: 700 }}>Image ready</p>
                    <p style={{ fontSize: 11, color: "#888" }}>{imageFile?.name}</p>
                  </div>
                  <button onClick={() => { setImagePreview(null); setImageFile(null); }} style={{ background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: 7, color: "#ef4444", fontSize: 12, fontWeight: 600, padding: "4px 10px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Remove</button>
                </div>
              )}

              {attachFile && (
                <div style={{ padding: "10px 18px", background: "#f5f5ff", borderTop: "1px solid #c7d2fe", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  <span style={{ fontSize: 26 }}>📎</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: "#3730a3", fontWeight: 700 }}>File ready</p>
                    <p style={{ fontSize: 11, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attachFile.name} · {formatFileSize(attachFile.size)}</p>
                  </div>
                  <button onClick={() => setAttachFile(null)} style={{ background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: 7, color: "#ef4444", fontSize: 12, fontWeight: 600, padding: "4px 10px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Remove</button>
                </div>
              )}

              {uploading && uploadProgress > 0 && (
                <div style={{ padding: "8px 18px", background: "#fff", borderTop: "1px solid #ebebef", flexShrink: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#888", marginBottom: 4 }}>
                    <span>Uploading…</span><span>{uploadProgress}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 99, background: "#ebebef", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#2d6a4f,#4ade80)", width: `${uploadProgress}%`, transition: "width 0.3s ease" }} />
                  </div>
                </div>
              )}

              {showEmoji && (
                <div style={{ padding: "10px 14px 8px", background: "#fff", borderTop: "1px solid #ebebef", display: "flex", flexWrap: "wrap", gap: 2, animation: "slideUp 0.12s ease", flexShrink: 0 }}>
                  {EMOJI_LIST.map(emoji => (
                    <span key={emoji} className="emoji-btn" onClick={() => { setNewMsg(prev => prev + emoji); textareaRef.current?.focus(); }}>{emoji}</span>
                  ))}
                </div>
              )}

              {/* Input bar */}
              <div style={{ padding: "10px 16px 12px", borderTop: "1px solid #ebebef", background: "#fff", display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
                <button className="input-tool" onClick={() => attachInputRef.current?.click()} title="Attach file" style={{ width: 36, height: 36, borderRadius: 10, background: "#f5f5f8", border: "1.5px solid #ebebef", fontSize: 18 }}>+</button>
                <input ref={attachInputRef} type="file" accept="*/*" style={{ display: "none" }} onChange={handleAttachSelect} />
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageSelect} />

                <div style={{ flex: 1, display: "flex", alignItems: "flex-end", background: "#F8F9FB", borderRadius: 14, border: "1.5px solid #ebebef", padding: "2px 10px 2px 14px", transition: "border-color 0.15s" }}
                  onFocusCapture={e => (e.currentTarget.style.borderColor = "#2d6a4f")}
                  onBlurCapture={e => (e.currentTarget.style.borderColor = "#ebebef")}>
                  <textarea ref={textareaRef} value={newMsg}
                    onChange={e => { handleTyping(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 110) + "px"; }}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Type a message…"
                    rows={1}
                    style={{ flex: 1, padding: "9px 0", background: "transparent", color: "#1a1a1a", fontSize: 14, fontFamily: "'DM Sans', sans-serif", resize: "none", maxHeight: 110, lineHeight: 1.5, border: "none", outline: "none" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 2, paddingBottom: 6 }}>
                    <button className="input-tool" onClick={() => fileInputRef.current?.click()} title="Photo">📷</button>
                    <button className="input-tool" onClick={() => setShowEmoji(p => !p)} title="Emoji"
                      style={{ color: showEmoji ? "#2d6a4f" : undefined }}>😊</button>
                  </div>
                </div>

                <button onClick={sendMessage} disabled={(!newMsg.trim() && !imageFile && !attachFile) || sending || uploading}
                  style={{ width: 40, height: 40, borderRadius: 12, background: (newMsg.trim() || imageFile || attachFile) && !sending && !uploading ? "#2d6a4f" : "#e8e8ef", color: (newMsg.trim() || imageFile || attachFile) ? "#fff" : "#bbb", border: "none", fontSize: 17, cursor: (newMsg.trim() || imageFile || attachFile) ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s", boxShadow: (newMsg.trim() || imageFile || attachFile) ? "0 2px 8px rgba(45,106,79,0.3)" : "none" }}>
                  {uploading ? "⏳" : sending ? "…" : "➤"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div onClick={() => setLightboxImg(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, cursor: "zoom-out", animation: "fadeIn 0.15s ease" }}>
          <img src={lightboxImg} alt="full" style={{ maxWidth: "88vw", maxHeight: "88vh", objectFit: "contain", borderRadius: 12 }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightboxImg(null)} style={{ position: "absolute", top: 18, right: 18, background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", width: 36, height: 36, borderRadius: "50%", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div onClick={e => e.stopPropagation()} style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, background: "#fff", borderRadius: 12, border: "1px solid #ebebef", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", zIndex: 200, padding: 6, minWidth: 160, animation: "slideUp 0.1s ease" }}>
          <div className="ctx-item" onClick={() => { const m = messages.find(m => m.id === contextMenu.msgId); if (m) { setReplyingTo(m); textareaRef.current?.focus(); } setContextMenu(null); }}>↩ Reply</div>
          <div className="ctx-item danger" onClick={() => deleteMessage(contextMenu.msgId)}>🗑️ Delete for everyone</div>
        </div>
      )}

      {/* Credit modal */}
      {showCreditModal && activeConvo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20, animation: "fadeIn 0.15s ease" }}>
          <div style={{ background: "#fff", borderRadius: 22, width: "100%", maxWidth: 400, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.16)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
              <div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 21, fontWeight: 900, color: "#1a1a1a", marginBottom: 3 }}>💰 Send Credits</div>
                <div style={{ fontSize: 12, color: "#aaa" }}>To {activeConvo.full_name} · Balance: <strong style={{ color: "#2d6a4f" }}>{profile?.credits} cr</strong></div>
              </div>
              <button onClick={() => setShowCreditModal(false)} style={{ background: "none", border: "none", color: "#ccc", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#999", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>Amount</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {[5, 10, 20, 50].map(amt => (
                  <button key={amt} onClick={() => setCreditAmount(String(amt))}
                    style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: `1.5px solid ${creditAmount === String(amt) ? "#2d6a4f" : "#ebebef"}`, background: creditAmount === String(amt) ? "#eef6f2" : "#F8F9FB", color: creditAmount === String(amt) ? "#2d6a4f" : "#555", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.12s" }}>
                    {amt}
                  </button>
                ))}
              </div>
              <input value={creditAmount} onChange={e => setCreditAmount(e.target.value.replace(/\D/g, ""))} placeholder="Custom amount…"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #ebebef", background: "#F8F9FB", color: "#1a1a1a", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#999", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>Note (optional)</label>
              <input value={creditNote} onChange={e => setCreditNote(e.target.value)} placeholder="e.g. Thanks for the session!"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #ebebef", background: "#F8F9FB", color: "#1a1a1a", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }} />
            </div>
            {creditAmount && parseInt(creditAmount) > (profile?.credits || 0) && (
              <div style={{ marginBottom: 14, padding: "9px 12px", borderRadius: 9, background: "#fef2f2", border: "1px solid #fca5a5", fontSize: 12, color: "#ef4444", fontWeight: 600 }}>
                ⚠️ Insufficient credits — you have {profile?.credits} cr.
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowCreditModal(false)} style={{ flex: 1, padding: "12px", borderRadius: 11, border: "1.5px solid #ebebef", background: "transparent", color: "#999", fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
              <button onClick={handleSendCredits} disabled={sendingCredits || !creditAmount || parseInt(creditAmount) <= 0 || parseInt(creditAmount) > (profile?.credits || 0)}
                style={{ flex: 2, padding: "12px", borderRadius: 11, border: "none", background: creditAmount && parseInt(creditAmount) > 0 && parseInt(creditAmount) <= (profile?.credits || 0) ? "#2d6a4f" : "#e8e8ef", color: creditAmount && parseInt(creditAmount) > 0 ? "#fff" : "#bbb", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s" }}>
                {sendingCredits ? "Sending…" : `💰 Send ${creditAmount || "0"} Credits`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}