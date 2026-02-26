"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string;
  username: string;
  credits: number;
  level: string;
};

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
};

type Conversation = {
  other_user: Profile;
  last_message: string;
  last_time: string;
  unread_count: number;
};

const LEVEL_COLORS: Record<string, string> = {
  Seedling: "#2d6a4f", Learner: "#1d4ed8", Contributor: "#7c3aed",
  Skilled: "#b45309", Expert: "#dc2626", Master: "#0891b2", Legend: "#d97706",
};

function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

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
  const bottomRef = useRef<HTMLDivElement>(null);
 const searchTimeout = useRef<any>(null);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Real-time subscription
  useEffect(() => {
    if (!profile || !activeConvo) return;
    const channel = supabase
      .channel("messages")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `receiver_id=eq.${profile.id}`,
      }, (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id === activeConvo.id) {
          setMessages(prev => [...prev, msg]);
          markRead(activeConvo.id);
        } else {
          loadConversations(profile.id);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, activeConvo]);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(prof);
    await loadConversations(user.id);
    setLoading(false);
  }

  async function loadConversations(userId: string) {
    // Get all messages involving this user
    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (!msgs) return;

    // Group by conversation partner
    const convoMap = new Map<string, { msgs: Message[] }>();
    msgs.forEach(msg => {
      const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      if (!convoMap.has(otherId)) convoMap.set(otherId, { msgs: [] });
      convoMap.get(otherId)!.msgs.push(msg);
    });

    // Fetch profiles for each conversation partner
    const convos: Conversation[] = [];
    for (const [otherId, data] of convoMap) {
      const { data: otherProf } = await supabase.from("profiles").select("*").eq("id", otherId).single();
      if (!otherProf) continue;
      const lastMsg = data.msgs[0];
      const unread = data.msgs.filter(m => m.receiver_id === userId && !m.is_read).length;
      convos.push({
        other_user: otherProf,
        last_message: lastMsg.content,
        last_time: lastMsg.created_at,
        unread_count: unread,
      });
    }
    setConversations(convos);
  }

  async function openConversation(other: Profile) {
    setActiveConvo(other);
    setShowNewChat(false);
    if (!profile) return;

    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${profile.id},receiver_id.eq.${other.id}),and(sender_id.eq.${other.id},receiver_id.eq.${profile.id})`
      )
      .order("created_at", { ascending: true });

    setMessages(data || []);
    await markRead(other.id);
    await loadConversations(profile.id);
  }

  async function markRead(senderId: string) {
    if (!profile) return;
    await supabase.from("messages")
      .update({ is_read: true })
      .eq("sender_id", senderId)
      .eq("receiver_id", profile.id)
      .eq("is_read", false);
  }

  async function sendMessage() {
    if (!profile || !activeConvo || !newMsg.trim()) return;
    setSending(true);
    const content = newMsg.trim();
    setNewMsg("");

    const { data: msg } = await supabase.from("messages").insert({
      sender_id: profile.id,
      receiver_id: activeConvo.id,
      content,
      is_read: false,
    }).select().single();

    if (msg) setMessages(prev => [...prev, msg]);

    // Notify receiver
    await supabase.from("notifications").insert({
      user_id: activeConvo.id,
      type: "message",
      title: `New message from ${profile.full_name}`,
      body: content.slice(0, 80),
      link: "/messages",
    });

    await loadConversations(profile.id);
    setSending(false);
  }

  async function handleSearchUsers(query: string) {
    setSearchUser(query);
    clearTimeout(searchTimeout.current);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", profile?.id || "")
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
        .limit(6);
      setSearchResults(data || []);
      setSearching(false);
    }, 350);
  }

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#faf8f4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>💬</div>
          <div style={{ color: "#666", fontSize: 15 }}>Loading messages…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f4", fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .convo-item { transition: background 0.15s; cursor: pointer; }
        .convo-item:hover { background: #f5f0e8 !important; }
        .convo-item.active { background: #e8f4e8 !important; }
        .send-btn { transition: all 0.15s; }
        .send-btn:hover:not(:disabled) { background: #1a4a36 !important; transform: translateY(-1px); }
        .msg-bubble { animation: popIn 0.15s ease; }
        @keyframes popIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        textarea:focus { outline: none; border-color: #2d6a4f !important; }
      `}</style>

      {/* Navbar */}
      <nav style={{ background: "#fff", borderBottom: "1.5px solid #e8e2d9", padding: "0 24px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <a href="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 2 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {[["Browse", "/listings"], ["Bounties", "/bounties"], ["Community", "/community"], ["Sessions", "/sessions"], ["Messages", "/messages"]].map(([label, href]) => (
            <a key={label} href={href} style={{ padding: "6px 14px", borderRadius: 8, color: href === "/messages" ? "#2d6a4f" : "#555", fontSize: 13, fontWeight: href === "/messages" ? 700 : 600, textDecoration: "none", background: href === "/messages" ? "#e8f4e8" : "transparent", position: "relative" }}>
              {label}
              {label === "Messages" && totalUnread > 0 && (
                <span style={{ position: "absolute", top: 2, right: 2, width: 8, height: 8, borderRadius: "50%", background: "#dc2626" }} />
              )}
            </a>
          ))}
        </div>
        <a href="/profile" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 10, background: "#f5f0e8", textDecoration: "none" }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: LEVEL_COLORS[profile?.level || "Seedling"], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff" }}>
            {getInitials(profile?.full_name || "")}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>@{profile?.username}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f", background: "#e8f4e8", padding: "2px 8px", borderRadius: 20 }}>{profile?.credits} cr</span>
        </a>
      </nav>

      {/* Main chat layout */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "320px 1fr", maxWidth: 1100, margin: "24px auto", width: "100%", padding: "0 20px", gap: 20, height: "calc(100vh - 106px)" }}>

        {/* Left sidebar — conversation list */}
        <div style={{ background: "#fff", borderRadius: 18, border: "1.5px solid #e8e2d9", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Sidebar header */}
          <div style={{ padding: "18px 20px", borderBottom: "1.5px solid #f0ece4" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 800, color: "#1a1a1a" }}>
                Messages
                {totalUnread > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, background: "#dc2626", color: "#fff", padding: "2px 8px", borderRadius: 20 }}>
                    {totalUnread}
                  </span>
                )}
              </div>
              <button
                onClick={() => { setShowNewChat(true); setActiveConvo(null); setSearchUser(""); setSearchResults([]); }}
                style={{ width: 32, height: 32, borderRadius: "50%", background: "#2d6a4f", color: "#fff", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}
              >
                +
              </button>
            </div>
          </div>

          {/* Conversation list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {conversations.length === 0 && !showNewChat && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#aaa" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>No messages yet</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Click + to start a conversation</div>
              </div>
            )}
            {conversations.map(convo => (
              <div
                key={convo.other_user.id}
                className={`convo-item ${activeConvo?.id === convo.other_user.id ? "active" : ""}`}
                onClick={() => openConversation(convo.other_user)}
                style={{ padding: "14px 20px", borderBottom: "1px solid #f5f0e8", display: "flex", gap: 12, alignItems: "center" }}
              >
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: LEVEL_COLORS[convo.other_user.level] || "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff" }}>
                    {getInitials(convo.other_user.full_name)}
                  </div>
                  {convo.unread_count > 0 && (
                    <div style={{ position: "absolute", top: -2, right: -2, width: 16, height: 16, borderRadius: "50%", background: "#dc2626", fontSize: 9, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {convo.unread_count}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: convo.unread_count > 0 ? 800 : 600, color: "#1a1a1a" }}>
                      {convo.other_user.full_name}
                    </span>
                    <span style={{ fontSize: 11, color: "#bbb", flexShrink: 0 }}>{timeAgo(convo.last_time)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: convo.unread_count > 0 ? "#333" : "#aaa", fontWeight: convo.unread_count > 0 ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>
                    {convo.last_message}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right side — chat window */}
        <div style={{ background: "#fff", borderRadius: 18, border: "1.5px solid #e8e2d9", display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* New chat search */}
          {showNewChat && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1.5px solid #f0ece4" }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 800, marginBottom: 14 }}>New Message</div>
                <input
                  value={searchUser}
                  onChange={e => handleSearchUsers(e.target.value)}
                  placeholder="Search by name or username…"
                  autoFocus
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "1.5px solid #e8e2d9", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
                />
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
                {searching && <div style={{ textAlign: "center", padding: 20, color: "#aaa", fontSize: 14 }}>Searching…</div>}
                {!searching && searchUser.length >= 2 && searchResults.length === 0 && (
                  <div style={{ textAlign: "center", padding: 20, color: "#aaa", fontSize: 14 }}>No users found</div>
                )}
                {searchResults.map(user => (
                  <div key={user.id} className="convo-item" onClick={() => openConversation(user)}
                    style={{ padding: "12px 24px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: LEVEL_COLORS[user.level] || "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                      {getInitials(user.full_name)}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{user.full_name}</div>
                      <div style={{ fontSize: 12, color: "#aaa" }}>@{user.username} · {user.level}</div>
                    </div>
                  </div>
                ))}
                {searchUser.length < 2 && (
                  <div style={{ padding: "20px 24px" }}>
                    <div style={{ fontSize: 13, color: "#aaa", marginBottom: 14 }}>Recent users on SkillCredit</div>
                    {/* Show existing conversation partners as quick picks */}
                    {conversations.slice(0, 5).map(c => (
                      <div key={c.other_user.id} className="convo-item" onClick={() => openConversation(c.other_user)}
                        style={{ padding: "10px 0", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #f5f0e8" }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: LEVEL_COLORS[c.other_user.level] || "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff" }}>
                          {getInitials(c.other_user.full_name)}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{c.other_user.full_name}</div>
                          <div style={{ fontSize: 12, color: "#aaa" }}>@{c.other_user.username}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!showNewChat && !activeConvo && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "#aaa" }}>
              <div style={{ fontSize: 52 }}>💬</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 800, color: "#ccc" }}>Your messages</div>
              <div style={{ fontSize: 14 }}>Select a conversation or start a new one</div>
              <button
                onClick={() => setShowNewChat(true)}
                style={{ marginTop: 8, padding: "10px 24px", borderRadius: 12, background: "#2d6a4f", color: "#fff", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
              >
                + New Message
              </button>
            </div>
          )}

          {/* Active conversation */}
          {activeConvo && !showNewChat && (
            <>
              {/* Chat header */}
              <div style={{ padding: "16px 24px", borderBottom: "1.5px solid #f0ece4", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: LEVEL_COLORS[activeConvo.level] || "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff" }}>
                  {getInitials(activeConvo.full_name)}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#1a1a1a" }}>{activeConvo.full_name}</div>
                  <div style={{ fontSize: 12, color: "#aaa" }}>@{activeConvo.username} · {activeConvo.level}</div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <a href="/listings" style={{ padding: "6px 14px", borderRadius: 10, background: "#f5f0e8", color: "#2d6a4f", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                    📚 View Listings
                  </a>
                </div>
              </div>

              {/* Messages area */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: "center", margin: "auto", color: "#bbb" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Start the conversation!</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Ask about their skills or say hi</div>
                  </div>
                )}

                {messages.map((msg, i) => {
                  const isMe = msg.sender_id === profile?.id;
                  const showAvatar = i === 0 || messages[i - 1].sender_id !== msg.sender_id;
                  return (
                    <div key={msg.id} className="msg-bubble" style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", gap: 8, alignItems: "flex-end" }}>
                      {!isMe && showAvatar ? (
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: LEVEL_COLORS[activeConvo.level] || "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                          {getInitials(activeConvo.full_name)}
                        </div>
                      ) : !isMe ? <div style={{ width: 28 }} /> : null}
                      <div style={{ maxWidth: "68%" }}>
                        <div style={{
                          padding: "10px 14px",
                          borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                          background: isMe ? "#2d6a4f" : "#f5f0e8",
                          color: isMe ? "#fff" : "#1a1a1a",
                          fontSize: 14,
                          lineHeight: 1.5,
                          wordBreak: "break-word",
                        }}>
                          {msg.content}
                        </div>
                        <div style={{ fontSize: 10, color: "#bbb", marginTop: 3, textAlign: isMe ? "right" : "left" }}>
                          {timeAgo(msg.created_at)}
                          {isMe && <span style={{ marginLeft: 4 }}>{msg.is_read ? "✓✓" : "✓"}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Message input */}
              <div style={{ padding: "16px 24px", borderTop: "1.5px solid #f0ece4", display: "flex", gap: 12, alignItems: "flex-end", flexShrink: 0 }}>
                <textarea
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                  rows={1}
                  style={{ flex: 1, padding: "11px 16px", borderRadius: 14, border: "1.5px solid #e8e2d9", fontSize: 14, fontFamily: "'DM Sans', sans-serif", resize: "none", maxHeight: 100, overflowY: "auto", lineHeight: 1.5 }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMsg.trim() || sending}
                  className="send-btn"
                  style={{ width: 44, height: 44, borderRadius: 12, background: newMsg.trim() ? "#2d6a4f" : "#e8e2d9", color: newMsg.trim() ? "#fff" : "#aaa", border: "none", fontSize: 18, cursor: newMsg.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                >
                  {sending ? "…" : "↑"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}