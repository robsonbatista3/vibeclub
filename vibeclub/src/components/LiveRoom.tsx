import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Users, 
  Heart, 
  Gift, 
  Plus, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff,
  Coins,
  LayoutGrid,
  MoreHorizontal,
  Send,
  UserPlus
} from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot, collection, query, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { joinLiveSlot, updateMaxWindows, sendGift } from '../services/firebaseService';

interface LiveRoomProps {
  liveId: string;
  user: any;
  profile: any;
  onClose: () => void;
}

// --- Sub-components ---

const LiveVideo = ({ creatorId, creatorName, isLocal }: { creatorId: string, creatorName: string, isLocal?: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let currentStream: MediaStream | null = null;

    if (isLocal && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          currentStream = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => console.error("Error accessing camera:", err));
    }

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isLocal]);

  return (
    <div className="absolute inset-0 bg-[#0a0a0a]">
      {isLocal ? (
        <video 
          ref={videoRef}
          autoPlay 
          muted 
          playsInline 
          className="w-full h-full object-cover opacity-90 scale-x-[-1]" 
        />
      ) : (
        <img 
          src={`https://picsum.photos/seed/${creatorId}/1080/1920`} 
          className="w-full h-full object-cover opacity-90" 
          alt="Live stream"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80" />
      <div className="absolute bottom-4 left-4 flex items-center gap-2">
        <span className="bg-pink-500 text-[9px] font-bold px-2 py-0.5 rounded-md shadow-lg">HOST</span>
        <p className="text-xs font-bold text-white drop-shadow-md">{creatorName}</p>
      </div>
    </div>
  );
};

const ParticipantsGrid = ({ slots, maxWindows, onJoin, currentUserId }: { slots: any[], maxWindows: number, onJoin: () => void, currentUserId: string }) => (
  <div className="absolute top-24 right-4 w-32 grid grid-cols-2 gap-2 z-20 max-h-[50vh] overflow-y-auto no-scrollbar">
    {Array.from({ length: Math.min(maxWindows, 10) }).map((_, idx) => {
      const slot = slots[idx];
      const isMe = slot?.userId === currentUserId;
      
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          key={idx}
          className={`relative aspect-square rounded-xl overflow-hidden border transition-all shadow-xl ${
            slot 
              ? 'bg-white/10 border-white/20' 
              : 'bg-black/40 border-dashed border-white/10 flex items-center justify-center'
          }`}
        >
          {slot ? (
            <>
              {isMe ? (
                <LocalParticipantVideo />
              ) : (
                <img 
                  src={slot.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${slot.userId}`} 
                  className="w-full h-full object-cover" 
                  alt={slot.userName}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <p className="absolute bottom-1 left-1 right-1 text-[7px] font-bold truncate text-center text-white">{slot.userName}</p>
            </>
          ) : (
            <button 
              onClick={onJoin}
              className="w-full h-full flex items-center justify-center text-white/20 hover:text-white/40 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </motion.div>
      );
    })}
  </div>
);

const LocalParticipantVideo = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let currentStream: MediaStream | null = null;

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        currentStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => console.error("Error accessing camera for slot:", err));

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <video 
      ref={videoRef}
      autoPlay 
      muted 
      playsInline 
      className="w-full h-full object-cover scale-x-[-1]" 
    />
  );
};

const ChatOverlay = ({ messages }: { messages: any[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="absolute bottom-24 left-4 right-12 max-h-[35vh] overflow-hidden z-20 pointer-events-none">
      <div 
        ref={scrollRef}
        className="flex flex-col gap-1 overflow-y-auto no-scrollbar pointer-events-auto"
      >
        {messages.length === 0 && (
          <div className="bg-black/20 backdrop-blur-sm px-3 py-1 rounded-xl border border-white/5 self-start">
            <p className="text-[10px] text-white/40 italic">Bem-vindo ao chat! Seja gentil e respeite as regras.</p>
          </div>
        )}
        {messages.map((msg) => (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            key={msg.id} 
            className="flex items-start"
          >
            <div className="bg-black/20 backdrop-blur-sm px-3 py-1 rounded-xl border border-white/5 max-w-full">
              <p className="text-[12px] leading-tight">
                <span className="font-bold text-pink-400 mr-1.5">{msg.userName}:</span>
                <span className={`${msg.isGift ? 'text-yellow-400 font-bold' : 'text-white/90'}`}>
                  {msg.text}
                  {msg.isGift && ` (${msg.giftAmount} moedas) 🎁`}
                </span>
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const ControlsBar = ({ 
  onSendMessage, 
  onSendGift, 
  onJoinRequest, 
  isCreator, 
  isMuted, 
  setIsMuted, 
  isVideoOff, 
  setIsVideoOff
}: any) => {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text);
    setText('');
  };

  return (
    <div className="absolute bottom-6 left-4 right-4 z-30 flex items-center gap-2">
      <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2 bg-white/10 backdrop-blur-xl border border-white/10 rounded-full px-4 py-0.5">
        <input 
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Diga algo..."
          className="flex-1 bg-transparent border-none py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
        />
        <button type="submit" className="text-pink-500 hover:text-pink-400 transition-colors">
          <Send className="w-5 h-5" />
        </button>
      </form>

      <div className="flex items-center gap-2">
        <button 
          onClick={onSendGift}
          className="w-11 h-11 bg-yellow-500 hover:bg-yellow-600 text-black rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg shadow-yellow-500/20"
        >
          <Gift className="w-5 h-5" />
        </button>
        
        {!isCreator && (
          <button 
            onClick={onJoinRequest}
            className="w-11 h-11 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-all active:scale-90"
          >
            <UserPlus className="w-5 h-5" />
          </button>
        )}

        {isCreator && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500' : 'bg-white/10'}`}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-500' : 'bg-white/10'}`}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
          </div>
        )}

        <button className="w-11 h-11 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-all active:scale-90">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// --- Main Component ---

export default function LiveRoom({ liveId, user, profile, onClose }: LiveRoomProps) {
  const [live, setLive] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  useEffect(() => {
    const unsubLive = onSnapshot(doc(db, "lives", liveId), (doc) => {
      if (doc.exists()) {
        setLive({ id: doc.id, ...doc.data() });
      }
    }, (error) => {
      console.error("Live document listener error:", error);
    });

    const q = query(
      collection(db, "lives", liveId, "messages"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const unsubMessages = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse());
    }, (error) => {
      console.error("Live messages listener error:", error);
    });

    return () => {
      unsubLive();
      unsubMessages();
    };
  }, [liveId]);

  const handleSendMessage = async (text: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "lives", liveId, "messages"), {
        userId: user.uid,
        userName: user.displayName || "Usuário",
        text: text,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleSendGift = async () => {
    try {
      await sendGift(liveId, user.uid, user.displayName, 50); // Default 50 coins gift
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleJoinSlot = async () => {
    if (!live) return;
    if (live.slots?.some((s: any) => s.userId === user.uid)) {
      alert("Você já está em uma janela!");
      return;
    }
    if (live.slots?.length >= (live.maxWindows || 0)) {
      alert("Não há janelas disponíveis no momento.");
      return;
    }

    try {
      await joinLiveSlot(liveId, user.uid, user.displayName, user.photoURL, live.slots || []);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleSetMaxWindows = async (count: number) => {
    try {
      await updateMaxWindows(liveId, count);
    } catch (error) {
      console.error("Error updating windows:", error);
    }
  };

  if (!live) return null;

  const isCreator = live.creatorId === user.uid;
  const slots = live.slots || [];
  const maxWindows = live.maxWindows || 0;

  return (
    <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center p-0 md:p-4">
      <div className="relative w-full h-full max-w-md bg-[#0a0a0a] md:rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/5">
        {/* Header Overlay */}
        <div className="absolute top-6 left-4 right-4 z-30 flex items-center justify-between">
          <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md p-1 pr-3 rounded-full border border-white/10">
            <img 
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${live.creatorId}`} 
              className="w-8 h-8 rounded-full border border-pink-500" 
              alt="Creator"
            />
            <div>
              <p className="text-[11px] font-bold leading-none text-white">{live.creatorName}</p>
              <p className="text-[9px] text-white/60 flex items-center gap-1">
                <Users className="w-2 h-2" /> {live.viewerCount || 0}
              </p>
            </div>
            <button className="ml-2 bg-pink-500 text-[9px] font-bold px-3 py-1 rounded-full hover:bg-pink-600 transition-colors">
              Seguir
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5">
              <Coins className="w-3 h-3 text-yellow-400" />
              <span className="text-[10px] font-bold text-white">{profile?.coins || 0}</span>
            </div>
            <button 
              onClick={onClose}
              className="w-8 h-8 bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <LiveVideo 
          creatorId={live.creatorId} 
          creatorName={live.creatorName} 
          isLocal={isCreator} 
        />
        
        <ParticipantsGrid 
          slots={slots} 
          maxWindows={maxWindows} 
          onJoin={handleJoinSlot} 
          currentUserId={user.uid}
        />
        
        <ChatOverlay messages={messages} />
        
        <ControlsBar 
          onSendMessage={handleSendMessage}
          onSendGift={handleSendGift}
          onJoinRequest={handleJoinSlot}
          isCreator={isCreator}
          isMuted={isMuted}
          setIsMuted={setIsMuted}
          isVideoOff={isVideoOff}
          setIsVideoOff={setIsVideoOff}
        />

        {/* Creator Window Selector (Overlay for Creator) */}
        {isCreator && (
          <div className="absolute top-20 left-4 z-30 flex flex-col gap-1.5">
            <div className="flex flex-col gap-1.5 bg-black/30 backdrop-blur-md p-1.5 rounded-2xl border border-white/10">
              {[1, 2, 4, 6, 8, 10].map(n => (
                <button
                  key={n}
                  onClick={() => handleSetMaxWindows(n)}
                  className={`w-8 h-8 rounded-xl text-[10px] font-bold transition-all ${maxWindows === n ? 'bg-pink-500 text-white' : 'text-white/40 hover:bg-white/10'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
