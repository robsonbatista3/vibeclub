import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { loginWithGoogle, logout } from './services/firebaseService';
import { 
  Video, 
  Coins, 
  User as UserIcon, 
  LogOut, 
  Search, 
  Heart, 
  MessageSquare, 
  Plus,
  Tv,
  Shield,
  CheckCircle,
  XCircle,
  Edit2,
  Image as ImageIcon,
  Grid,
  Upload,
  X,
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AdminPanel from './components/admin/AdminPanel';
import LiveRoom from './components/LiveRoom';
import { purchaseCoins, submitCreatorApplication, updateProfile, createPost, uploadFile, followUser, unfollowUser, markNotificationAsRead } from './services/firebaseService';
import { db } from './firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';

import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

function NotificationsModal({ isOpen, onClose, notifications }: { isOpen: boolean, onClose: () => void, notifications: any[] }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-[2rem] p-8 shadow-2xl max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="text-pink-500" /> Notificações
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X className="w-5 h-5 text-white/40" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 text-white/5 mx-auto mb-4" />
              <p className="text-white/40">Nenhuma notificação por aqui.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={`p-4 rounded-2xl border transition-all ${notif.read ? 'bg-white/5 border-white/5 opacity-60' : 'bg-pink-500/5 border-pink-500/20'}`}
                onClick={() => !notif.read && markNotificationAsRead(notif.id)}
              >
                <div className="flex gap-4">
                  {notif.fromPhoto ? (
                    <img src={notif.fromPhoto} className="w-10 h-10 rounded-full border border-white/10" alt="" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center">
                      <Bell className="w-5 h-5 text-pink-500" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-sm">{notif.title}</p>
                      <span className="text-[10px] text-white/20">
                        {notif.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed">{notif.message}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

function CreatorApplicationModal({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: any }) {
  const [reason, setReason] = useState('');
  const [socialMedia, setSocialMedia] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    setIsSubmitting(true);
    try {
      await submitCreatorApplication(
        user.uid,
        user.displayName || 'Usuário',
        user.email || '',
        reason,
        socialMedia
      );
      onClose();
    } catch (error) {
      console.error('Error submitting application:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-[2rem] p-8 shadow-2xl"
      >
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Tv className="text-pink-500" /> Tornar-se Criador
        </h2>
        <p className="text-white/40 mb-8 text-sm">Preencha o formulário abaixo para solicitar o cargo de criador.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">Por que você quer ser um criador?</label>
            <textarea 
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-pink-500 transition-colors min-h-[100px]"
              placeholder="Conte-nos um pouco sobre o que você pretende transmitir..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">Redes Sociais (opcional)</label>
            <input 
              type="text"
              value={socialMedia}
              onChange={(e) => setSocialMedia(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-pink-500 transition-colors"
              placeholder="Instagram, Twitter, etc."
            />
          </div>

          <div className="flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-pink-500 hover:bg-pink-600 text-white font-bold py-4 rounded-2xl transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function EditProfileModal({ isOpen, onClose, user, profile }: { isOpen: boolean, onClose: () => void, user: any, profile: any }) {
  const [name, setName] = useState(profile?.displayName || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(profile?.photoURL || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (profile && isOpen) {
      setName(profile.displayName || '');
      setBio(profile.bio || '');
      setPreviewUrl(profile.photoURL || '');
      setSelectedFile(null);
    }
  }, [profile, isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let finalPhotoURL = previewUrl;
      if (selectedFile) {
        finalPhotoURL = await uploadFile(selectedFile, `profiles/${user.uid}/${Date.now()}_${selectedFile.name}`);
      }
      await updateProfile(user.uid, { displayName: name, bio, photoURL: finalPhotoURL });
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-[2rem] p-8 shadow-2xl">
        <h2 className="text-2xl font-bold mb-6">Editar Perfil</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center mb-6">
            <div className="relative group cursor-pointer" onClick={() => document.getElementById('profile-upload')?.click()}>
              <img 
                src={previewUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                className="w-24 h-24 rounded-3xl object-cover border-2 border-pink-500/50 group-hover:opacity-50 transition-opacity"
                alt="Preview"
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload className="w-6 h-6 text-white" />
              </div>
            </div>
            <input 
              id="profile-upload"
              type="file" 
              accept="image/*" 
              onChange={handleFileChange} 
              className="hidden" 
            />
            <p className="text-xs text-white/40 mt-2">Clique para alterar a foto</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">Nome de Exibição</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-pink-500 transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-pink-500 transition-colors min-h-[80px]" />
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-4 rounded-2xl transition-all active:scale-95 disabled:opacity-50">
            {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function CreatePostModal({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: any }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setIsSubmitting(true);
    try {
      const imageUrl = await uploadFile(selectedFile, `posts/${user.uid}/${Date.now()}_${selectedFile.name}`);
      await createPost(user.uid, user.displayName || 'Usuário', imageUrl, caption);
      onClose();
      setSelectedFile(null);
      setPreviewUrl('');
      setCaption('');
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-[2rem] p-8 shadow-2xl">
        <h2 className="text-2xl font-bold mb-6">Nova Publicação</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div 
            className={`relative aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-colors cursor-pointer overflow-hidden ${
              previewUrl ? 'border-pink-500/50' : 'border-white/10 hover:border-pink-500/30'
            }`}
            onClick={() => document.getElementById('post-upload')?.click()}
          >
            {previewUrl ? (
              <>
                <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Upload className="w-8 h-8 text-white" />
                </div>
              </>
            ) : (
              <>
                <ImageIcon className="w-12 h-12 text-white/20 mb-2" />
                <p className="text-sm text-white/40">Clique para selecionar uma foto</p>
              </>
            )}
          </div>
          <input 
            id="post-upload"
            type="file" 
            accept="image/*" 
            onChange={handleFileChange} 
            className="hidden" 
          />

          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">Legenda</label>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-pink-500 transition-colors min-h-[80px]" placeholder="Escreva algo..." />
          </div>
          <button type="submit" disabled={isSubmitting || !selectedFile} className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-4 rounded-2xl transition-all active:scale-95 disabled:opacity-50">
            {isSubmitting ? 'Publicando...' : 'Publicar'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function CoinShopModal({ isOpen, onClose, userId }: { isOpen: boolean, onClose: () => void, userId: string }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const packages = [
    { coins: 100, price: 10, label: 'Bronze' },
    { coins: 500, price: 45, label: 'Prata', popular: true },
    { coins: 1000, price: 80, label: 'Ouro' },
    { coins: 5000, price: 350, label: 'Diamante' },
  ];

  const handlePurchase = async (pkg: any) => {
    setIsProcessing(true);
    setError(null);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          coins: pkg.coins,
          price: pkg.price,
          label: pkg.label,
        }),
      });

      const session = await response.json();
      if (session.url) {
        // Stripe Checkout cannot be loaded in an iframe. 
        // We open it in a new tab for the best experience.
        window.open(session.url, '_blank');
        onClose(); // Close the modal after opening the tab
      } else {
        throw new Error(session.error || 'Falha ao criar sessão de checkout. Verifique as chaves do Stripe.');
      }
    } catch (err: any) {
      console.error('Error processing purchase:', err);
      setError(err.message || 'Erro ao processar pagamento.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-[2rem] p-8 shadow-2xl"
      >
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Coins className="text-yellow-400" /> Loja de Moedas
        </h2>
        <p className="text-white/40 mb-8 text-sm">Escolha um pacote para recarregar seu saldo com segurança via Stripe. O pagamento será aberto em uma nova aba.</p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-sm font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {packages.map((pkg) => (
            <button
              key={pkg.coins}
              disabled={isProcessing}
              onClick={() => handlePurchase(pkg)}
              className={`relative flex items-center justify-between p-5 rounded-2xl border transition-all active:scale-[0.98] disabled:opacity-50 ${
                pkg.popular 
                  ? 'bg-pink-500/10 border-pink-500/50 hover:bg-pink-500/20' 
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              {pkg.popular && (
                <span className="absolute -top-2 -right-2 bg-pink-500 text-[10px] font-bold px-2 py-0.5 rounded-full">POPULAR</span>
              )}
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${pkg.popular ? 'bg-pink-500' : 'bg-yellow-500'}`}>
                  <Coins className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-bold">{pkg.coins} Moedas</p>
                  <p className="text-xs text-white/40">{pkg.label}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-green-500">R$ {pkg.price}</p>
              </div>
            </button>
          ))}
        </div>

        <button 
          onClick={onClose}
          disabled={isProcessing}
          className="w-full mt-8 text-white/40 hover:text-white text-sm font-medium transition-colors"
        >
          Cancelar
        </button>
      </motion.div>
    </div>
  );
}

function PaymentSuccess() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full bg-[#1a1a1a] border border-white/10 rounded-[2.5rem] p-10 text-center shadow-2xl"
      >
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-3xl font-bold mb-4">Pagamento Confirmado!</h2>
        <p className="text-white/60 mb-8">Suas moedas serão adicionadas ao seu saldo em instantes. Obrigado pela compra!</p>
        <button 
          onClick={() => navigate('/')}
          className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-4 rounded-2xl transition-all active:scale-95"
        >
          Voltar para o App
        </button>
      </motion.div>
    </div>
  );
}

function PaymentCancel() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full bg-[#1a1a1a] border border-white/10 rounded-[2.5rem] p-10 text-center shadow-2xl"
      >
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-3xl font-bold mb-4">Pagamento Cancelado</h2>
        <p className="text-white/60 mb-8">O processo de pagamento foi interrompido. Nenhuma cobrança foi realizada.</p>
        <button 
          onClick={() => navigate('/')}
          className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl border border-white/10 transition-all active:scale-95"
        >
          Tentar Novamente
        </button>
      </motion.div>
    </div>
  );
}

function MainApp() {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('feed');
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isCreatorModalOpen, setIsCreatorModalOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [activeLiveId, setActiveLiveId] = useState<string | null>(null);
  const [lives, setLives] = useState<any[]>([]);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      setLives([]);
      setUserPosts([]);
      return;
    }
    const qLives = query(collection(db, "lives"), where("status", "==", "online"));
    const unsubLives = onSnapshot(qLives, (snap) => {
      setLives(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Lives listener error:", error);
    });

    const qPosts = query(
      collection(db, "posts"), 
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsubPosts = onSnapshot(qPosts, (snap) => {
      setUserPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("User posts listener error:", error);
    });

    const qNotifs = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsubNotifs = onSnapshot(qNotifs, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Notifications listener error:", error);
    });

    const qFollowing = query(
      collection(db, "followers"),
      where("followerId", "==", user.uid)
    );
    const unsubFollowing = onSnapshot(qFollowing, (snap) => {
      setFollowing(snap.docs.map(d => d.data().followedId));
    }, (error) => {
      console.error("Following listener error:", error);
    });

    return () => {
      unsubLives();
      unsubPosts();
      unsubNotifs();
      unsubFollowing();
    };
  }, [user]);

  const handleStartLive = async () => {
    if (!user || profile?.role !== 'creator') return;
    
    try {
      const docRef = await addDoc(collection(db, "lives"), {
        creatorId: user.uid,
        creatorName: user.displayName,
        title: `${user.displayName}'s Live`,
        price: 0,
        status: 'online',
        viewerCount: 0,
        maxWindows: 1,
        slots: [],
        startedAt: serverTimestamp()
      });
      setActiveLiveId(docRef.id);
    } catch (error) {
      console.error("Error starting live:", error);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-pink-500/30">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/20">
            <Video className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            VibeClub
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3 bg-white/5 rounded-full pl-2 pr-4 py-1 border border-white/10">
              {(profile?.role === 'admin' || user.email === 'robsonbatista3@gmail.com' || user.email === 'robson0441@gmail.com') && (
                <button 
                  onClick={() => {
                    console.log("Navigating to admin...");
                    navigate('/admin');
                  }}
                  className="p-1.5 hover:bg-white/10 rounded-full text-pink-500 transition-colors cursor-pointer"
                  style={{ zIndex: 100 }}
                  title="Painel Admin"
                >
                  <Shield className="w-5 h-5" />
                </button>
              )}
              <div className="flex items-center gap-1.5 text-yellow-400 font-bold text-sm">
                <Coins className="w-4 h-4" />
                <span>{profile?.coins || 0}</span>
              </div>
              <button 
                onClick={() => setIsNotificationsOpen(true)}
                className="p-1.5 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-all relative"
                title="Notificações"
              >
                <Bell className="w-5 h-5" />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-pink-500 rounded-full border-2 border-black" />
                )}
              </button>
              <img 
                src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                className="w-8 h-8 rounded-full border border-white/20"
                alt="Profile"
              />
            </div>
          ) : (
            <button 
              onClick={loginWithGoogle}
              className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-2 rounded-full font-semibold transition-all active:scale-95 shadow-lg shadow-pink-600/20"
            >
              Entrar
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-24 px-4 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'feed' && (
            <motion.div 
              key="feed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Lives em Destaque</h2>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-pink-500/10 text-pink-500 rounded-full text-xs font-bold border border-pink-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse" />
                    AO VIVO
                  </span>
                </div>
              </div>

              {/* Real Lives from Firestore */}
              {lives.map((live) => (
                <div 
                  key={live.id} 
                  onClick={() => setActiveLiveId(live.id)}
                  className="relative aspect-[9/16] bg-white/5 rounded-3xl overflow-hidden border border-white/10 group cursor-pointer"
                >
                  <img 
                    src={`https://picsum.photos/seed/${live.id}/720/1280`} 
                    className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
                    alt="Live Preview"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  
                  <div className="absolute top-4 left-4 flex gap-2">
                    <span className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                      <Tv className="w-3 h-3 text-pink-500" />
                      {live.viewerCount || 0} assistindo
                    </span>
                  </div>

                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="flex items-center gap-3 mb-3">
                      <img 
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${live.creatorId}`} 
                        className="w-12 h-12 rounded-2xl border-2 border-pink-500 shadow-xl"
                        alt="Creator"
                      />
                      <div>
                        <h3 className="font-bold text-lg">{live.title}</h3>
                        <p className="text-white/60 text-sm">@{live.creatorName}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveLiveId(live.id);
                        }}
                        className="flex-1 bg-white text-black font-bold py-3 rounded-2xl hover:bg-white/90 transition-colors active:scale-95"
                      >
                        Assistir
                      </button>
                      {user && user.uid !== live.creatorId && (
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (following.includes(live.creatorId)) {
                              await unfollowUser(user.uid, live.creatorId);
                            } else {
                              await followUser(user.uid, live.creatorId, user.displayName || 'Usuário', user.photoURL || '');
                            }
                          }}
                          className={`px-4 rounded-2xl font-bold transition-all active:scale-95 border ${
                            following.includes(live.creatorId) 
                              ? 'bg-white/10 border-white/20 text-white' 
                              : 'bg-pink-600 border-pink-500 text-white hover:bg-pink-700'
                          }`}
                        >
                          {following.includes(live.creatorId) ? 'Seguindo' : 'Seguir'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {lives.length === 0 && (
                <div className="py-20 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                  <Tv className="w-12 h-12 text-white/10 mx-auto mb-4" />
                  <p className="text-white/40">Nenhuma live ativa no momento.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {user ? (
                <div className="text-center">
                  <div className="relative inline-block mb-4">
                    <img 
                      src={profile?.photoURL || user.photoURL || ""} 
                      className="w-32 h-32 rounded-3xl border-4 border-pink-500/20 shadow-2xl mx-auto object-cover"
                      alt="Profile"
                    />
                    <button 
                      onClick={() => setIsEditProfileOpen(true)}
                      className="absolute -bottom-2 -right-2 bg-pink-500 p-2 rounded-xl shadow-lg hover:bg-pink-600 transition-colors"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                  </div>
                  <h2 className="text-2xl font-bold">{profile?.displayName || user.displayName}</h2>
                  <p className="text-white/40 mb-2 text-sm">ID: {user.uid.slice(0, 8)}</p>
                  {profile?.bio && (
                    <p className="text-white/60 mb-6 max-w-sm mx-auto italic">"{profile.bio}"</p>
                  )}

                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-white/5 p-4 rounded-3xl border border-white/10">
                      <p className="text-white/40 text-sm mb-1">Saldo</p>
                      <div className="flex items-center justify-center gap-2 text-2xl font-bold text-yellow-400">
                        <Coins className="w-6 h-6" />
                        {profile?.coins || 0}
                      </div>
                    </div>
                    <div className="bg-white/5 p-4 rounded-3xl border border-white/10">
                      <p className="text-white/40 text-sm mb-1">Tipo de Conta</p>
                      <p className="text-xl font-bold capitalize">{profile?.role || 'User'}</p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-12">
                    <button 
                      onClick={() => setIsShopOpen(true)}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Coins className="w-5 h-5" />
                      Comprar Moedas
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => setIsCreatePostOpen(true)}
                        className="bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl border border-white/10 transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <ImageIcon className="w-5 h-5" />
                        Postar Foto
                      </button>
                      <button 
                        onClick={() => setIsCreatorModalOpen(true)}
                        className="bg-pink-500/10 hover:bg-pink-500/20 text-pink-500 font-bold py-4 rounded-2xl border border-pink-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Tv className="w-5 h-5" />
                        Ser Criador
                      </button>
                    </div>
                    {(profile?.role === 'admin' || user.email === 'robsonbatista3@gmail.com' || user.email === 'robson0441@gmail.com') && (
                      <button 
                        onClick={() => navigate('/admin')}
                        className="w-full bg-pink-500/10 hover:bg-pink-500/20 text-pink-500 font-bold py-4 rounded-2xl border border-pink-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Shield className="w-5 h-5" />
                        Acessar Painel Admin
                      </button>
                    )}
                    <button 
                      onClick={logout}
                      className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold py-4 rounded-2xl border border-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <LogOut className="w-5 h-5" />
                      Sair da Conta
                    </button>
                  </div>

                  {/* Gallery Section */}
                  <div className="text-left">
                    <div className="flex items-center gap-2 mb-6">
                      <Grid className="w-5 h-5 text-pink-500" />
                      <h3 className="text-lg font-bold">Minhas Publicações</h3>
                    </div>
                    
                    {userPosts.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {userPosts.map((post) => (
                          <div key={post.id} className="aspect-square bg-white/5 rounded-xl overflow-hidden border border-white/5 group relative">
                            <img 
                              src={post.imageUrl} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                              alt="Post"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                              <Heart className="w-4 h-4 text-white fill-white" />
                              <span className="text-xs font-bold">{post.likes || 0}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                        <ImageIcon className="w-10 h-10 text-white/10 mx-auto mb-3" />
                        <p className="text-white/40 text-sm">Você ainda não postou nenhuma foto.</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-20">
                  <UserIcon className="w-16 h-16 text-white/20 mx-auto mb-4" />
                  <h2 className="text-xl font-bold mb-2">Acesse seu perfil</h2>
                  <p className="text-white/40 mb-8 text-sm">Faça login para gerenciar suas moedas e lives.</p>
                  <button 
                    onClick={loginWithGoogle}
                    className="bg-white text-black px-8 py-3 rounded-full font-bold active:scale-95 transition-all"
                  >
                    Entrar com Google
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-black/80 backdrop-blur-xl border-t border-white/10 px-6 py-3 pb-8 flex justify-around items-center z-50">
        <button 
          onClick={() => setActiveTab('feed')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'feed' ? 'text-pink-500' : 'text-white/40'}`}
        >
          <Tv className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Lives</span>
        </button>
        
        <button 
          onClick={() => {
            if (profile?.role === 'creator') {
              handleStartLive();
            } else {
              setActiveTab('feed');
            }
          }}
          className="w-14 h-14 bg-gradient-to-tr from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-pink-500/30 active:scale-90 transition-transform -mt-10 border-4 border-black"
        >
          <Plus className="w-8 h-8 text-white" />
        </button>

        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'profile' ? 'text-pink-500' : 'text-white/40'}`}
        >
          <UserIcon className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Perfil</span>
        </button>
      </nav>

      {user && (
        <CoinShopModal 
          isOpen={isShopOpen} 
          onClose={() => setIsShopOpen(false)} 
          userId={user.uid} 
        />
      )}

      {user && (
        <CreatorApplicationModal 
          isOpen={isCreatorModalOpen} 
          onClose={() => setIsCreatorModalOpen(false)} 
          user={user} 
        />
      )}

      {activeLiveId && user && (
        <LiveRoom 
          liveId={activeLiveId} 
          user={user} 
          profile={profile} 
          onClose={() => setActiveLiveId(null)} 
        />
      )}

      {user && (
        <>
          <EditProfileModal 
            isOpen={isEditProfileOpen} 
            onClose={() => setIsEditProfileOpen(false)} 
            user={user} 
            profile={profile} 
          />
          <CreatePostModal 
            isOpen={isCreatePostOpen} 
            onClose={() => setIsCreatePostOpen(false)} 
            user={user} 
          />
          <NotificationsModal 
            isOpen={isNotificationsOpen} 
            onClose={() => setIsNotificationsOpen(false)} 
            notifications={notifications}
          />
        </>
      )}
    </div>
  );
}

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<MainApp />} />
      <Route path="/admin" element={<AdminPanel />} />
      <Route path="/payment-success" element={<PaymentSuccess />} />
      <Route path="/payment-cancel" element={<PaymentCancel />} />
    </Routes>
  );
}

