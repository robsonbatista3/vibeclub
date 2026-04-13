import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Coins, 
  DollarSign, 
  Activity, 
  Shield, 
  Video, 
  CreditCard, 
  LogOut,
  ChevronRight,
  Search,
  MoreVertical,
  Ban,
  CheckCircle,
  XCircle,
  LayoutDashboard
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { db, auth } from '../../firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  getDocs, 
  where, 
  orderBy, 
  limit,
  Timestamp
} from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { approveCreatorApplication, rejectCreatorApplication, manuallyAddCoins } from '../../services/firebaseService';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';

// --- Components ---

const AddCoinsModal = ({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: any }) => {
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(parseInt(amount))) return;
    
    setIsSubmitting(true);
    try {
      await manuallyAddCoins(user.id, parseInt(amount));
      onClose();
      setAmount('');
    } catch (error) {
      console.error("Error adding coins:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#1a1a1a] border border-white/10 rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold">Adicionar Moedas</h3>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <XCircle className="w-6 h-6 text-white/40" />
            </button>
          </div>

          <div className="flex items-center gap-4 mb-8 p-4 bg-white/5 rounded-2xl border border-white/5">
            <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} className="w-12 h-12 rounded-full" />
            <div>
              <p className="font-bold">{user.displayName}</p>
              <p className="text-xs text-white/40">Saldo atual: {user.coins || 0} moedas</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2 px-1">Quantidade</label>
              <div className="relative">
                <Coins className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-yellow-500" />
                <input 
                  type="number" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ex: 100"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:border-pink-500 transition-all font-bold text-lg"
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-white/20 mt-2 px-1">Use valores negativos para remover moedas.</p>
            </div>

            <button 
              type="submit"
              disabled={isSubmitting || !amount}
              className="w-full bg-pink-600 hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all active:scale-95 shadow-lg shadow-pink-600/20 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>Confirmar Adição</>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
  <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-2xl ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      {trend && (
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend > 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <p className="text-white/40 text-sm font-medium">{title}</p>
    <h3 className="text-3xl font-bold mt-1">{value}</h3>
  </div>
);

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCoins: 0,
    totalRevenue: 0,
    onlineUsers: 0
  });
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    // Real-time stats
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      let totalCoins = 0;
      snap.docs.forEach(doc => totalCoins += (doc.data().coins || 0));
      setStats(prev => ({ 
        ...prev, 
        totalUsers: snap.size,
        totalCoins: totalCoins
      }));
      
      const sorted = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => b.createdAt?.toMillis() - a.createdAt?.toMillis())
        .slice(0, 5);
      setRecentUsers(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "users");
    });

    const unsubTransactions = onSnapshot(collection(db, "transactions"), (snap) => {
      let totalRev = 0;
      snap.docs.forEach(doc => {
        if (doc.data().status === 'completed' && doc.data().type === 'purchase') {
          totalRev += (doc.data().amount || 0);
        }
      });
      setStats(prev => ({ ...prev, totalRevenue: totalRev }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "transactions");
    });

    // Mock chart data
    setChartData([
      { name: 'Seg', users: 400, rev: 2400 },
      { name: 'Ter', users: 300, rev: 1398 },
      { name: 'Qua', users: 200, rev: 9800 },
      { name: 'Qui', users: 278, rev: 3908 },
      { name: 'Sex', users: 189, rev: 4800 },
      { name: 'Sab', users: 239, rev: 3800 },
      { name: 'Dom', users: 349, rev: 4300 },
    ]);

    return () => {
      unsubUsers();
      unsubTransactions();
    };
  }, []);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Usuários" value={stats.totalUsers} icon={Users} color="bg-blue-500" trend={12} />
        <StatCard title="Moedas em Circulação" value={stats.totalCoins} icon={Coins} color="bg-yellow-500" trend={5} />
        <StatCard title="Faturamento Total" value={`R$ ${stats.totalRevenue}`} icon={DollarSign} color="bg-green-500" trend={8} />
        <StatCard title="Usuários Online" value={Math.floor(stats.totalUsers * 0.15)} icon={Activity} color="bg-pink-500" trend={-2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white/5 border border-white/10 p-8 rounded-3xl">
          <h3 className="text-xl font-bold mb-6">Crescimento de Usuários</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #ffffff20', borderRadius: '12px' }}
                  itemStyle={{ color: '#ec4899' }}
                />
                <Area type="monotone" dataKey="users" stroke="#ec4899" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 p-8 rounded-3xl">
          <h3 className="text-xl font-bold mb-6">Novos Usuários</h3>
          <div className="space-y-4">
            {recentUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-4">
                  <img src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`} className="w-10 h-10 rounded-full" />
                  <div>
                    <p className="font-bold">{u.displayName}</p>
                    <p className="text-xs text-white/40">{u.role}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const UserManagement = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isCoinsModalOpen, setIsCoinsModalOpen] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "users");
    });
    return unsub;
  }, []);

  const handleOpenCoinsModal = (user: any) => {
    setSelectedUser(user);
    setIsCoinsModalOpen(true);
  };

  const handleToggleBan = async (userId: string, isBanned: boolean) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        isBanned: !isBanned
      });
    } catch (error) {
      console.error("Error toggling ban:", error);
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.id.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gerenciar Usuários</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input 
            type="text" 
            placeholder="Buscar usuário..." 
            className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-pink-500 transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-white/40 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-medium">Usuário</th>
              <th className="px-6 py-4 font-medium">Papel</th>
              <th className="px-6 py-4 font-medium">Saldo</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredUsers.map((u) => (
              <tr key={u.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <img src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`} className="w-8 h-8 rounded-full" />
                    <div>
                      <p className="font-bold text-sm">{u.displayName}</p>
                      <p className="text-xs text-white/40">{u.id.slice(0, 8)}...</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${u.role === 'creator' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 text-yellow-400 font-bold text-sm">
                    <Coins className="w-4 h-4" />
                    {u.coins || 0}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {u.isBanned ? (
                    <span className="flex items-center gap-1 text-red-500 text-xs font-bold">
                      <XCircle className="w-3 h-3" /> Banido
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-green-500 text-xs font-bold">
                      <CheckCircle className="w-3 h-3" /> Ativo
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => handleOpenCoinsModal(u)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors text-yellow-400"
                      title="Adicionar Moedas"
                    >
                      <Coins className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleToggleBan(u.id, u.isBanned)}
                      className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${u.isBanned ? 'text-green-500' : 'text-red-500'}`}
                      title={u.isBanned ? 'Desbanir' : 'Banir'}
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedUser && (
        <AddCoinsModal 
          isOpen={isCoinsModalOpen} 
          onClose={() => setIsCoinsModalOpen(false)} 
          user={selectedUser} 
        />
      )}
    </div>
  );
};

const LiveManagement = () => {
  const [lives, setLives] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "lives"), (snap) => {
      setLives(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "lives");
    });
    return unsub;
  }, []);

  const handleEndLive = async (liveId: string) => {
    try {
      await updateDoc(doc(db, "lives", liveId), {
        status: 'offline'
      });
    } catch (error) {
      console.error("Error ending live:", error);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Lives Ativas</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {lives.filter(l => l.status === 'online').map((l) => (
          <div key={l.id} className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden group">
            <div className="relative aspect-video">
              <img src={`https://picsum.photos/seed/${l.id}/400/225`} className="w-full h-full object-cover opacity-60" />
              <div className="absolute top-4 left-4 bg-pink-500 px-2 py-1 rounded-md text-[10px] font-bold animate-pulse">AO VIVO</div>
              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-pink-500" />
                <span className="text-xs font-bold">{l.viewerCount || 0} assistindo</span>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${l.creatorId}`} className="w-10 h-10 rounded-full border border-pink-500" />
                <div>
                  <h4 className="font-bold">{l.title}</h4>
                  <p className="text-xs text-white/40">{l.creatorName}</p>
                </div>
              </div>
              <button 
                onClick={() => handleEndLive(l.id)}
                className="w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 py-3 rounded-2xl font-bold transition-all active:scale-95"
              >
                Encerrar Live
              </button>
            </div>
          </div>
        ))}
        {lives.filter(l => l.status === 'online').length === 0 && (
          <div className="col-span-full py-20 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
            <Video className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/40">Nenhuma live ativa no momento.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const PaymentManagement = () => {
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "transactions"), orderBy("createdAt", "desc")), (snap) => {
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "transactions");
    });
    return unsub;
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Histórico de Pagamentos</h2>
      <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-white/40 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-medium">ID Transação</th>
              <th className="px-6 py-4 font-medium">Usuário</th>
              <th className="px-6 py-4 font-medium">Valor</th>
              <th className="px-6 py-4 font-medium">Tipo</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 font-mono text-xs text-white/60">{p.id.slice(0, 12)}...</td>
                <td className="px-6 py-4 text-sm">{p.userId.slice(0, 8)}...</td>
                <td className="px-6 py-4">
                  <span className="font-bold text-green-500">R$ {p.amount}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/5 uppercase">{p.type}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${p.status === 'completed' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-white/40">
                  {p.createdAt?.toDate().toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ApplicationManagement = () => {
  const [applications, setApplications] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "creator_applications"), orderBy("createdAt", "desc")), (snap) => {
      setApplications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "creator_applications");
    });
    return unsub;
  }, []);

  const handleApprove = async (appId: string, userId: string) => {
    try {
      await approveCreatorApplication(appId, userId);
    } catch (error) {
      console.error("Error approving application:", error);
    }
  };

  const handleReject = async (appId: string) => {
    try {
      await rejectCreatorApplication(appId);
    } catch (error) {
      console.error("Error rejecting application:", error);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Solicitações de Criador</h2>
      <div className="grid grid-cols-1 gap-6">
        {applications.filter(a => a.status === 'pending').map((app) => (
          <div key={app.id} className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col md:flex-row justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-pink-500/20 rounded-2xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-pink-500" />
                </div>
                <div>
                  <h4 className="font-bold text-lg">{app.userName}</h4>
                  <p className="text-sm text-white/40">{app.userEmail}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-white/40 uppercase font-bold tracking-wider mb-1">Motivo</p>
                  <p className="text-white/80 bg-white/5 p-4 rounded-2xl border border-white/5">{app.reason}</p>
                </div>
                {app.socialMedia && (
                  <div>
                    <p className="text-xs text-white/40 uppercase font-bold tracking-wider mb-1">Redes Sociais</p>
                    <p className="text-pink-500 font-medium">{app.socialMedia}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex md:flex-col gap-3 justify-center">
              <button 
                onClick={() => handleApprove(app.id, app.userId)}
                className="flex-1 md:flex-none bg-green-500 hover:bg-green-600 text-white font-bold px-8 py-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" /> Aprovar
              </button>
              <button 
                onClick={() => handleReject(app.id)}
                className="flex-1 md:flex-none bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 px-8 py-3 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <XCircle className="w-5 h-5" /> Rejeitar
              </button>
            </div>
          </div>
        ))}
        {applications.filter(a => a.status === 'pending').length === 0 && (
          <div className="py-20 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
            <Shield className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/40">Nenhuma solicitação pendente.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main Admin Layout ---

export default function AdminPanel() {
  const { user, profile, loading } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');
  const navigate = useNavigate();

  useEffect(() => {
    const isBootstrapAdmin = user?.email === 'robsonbatista3@gmail.com' || user?.email === 'robson0441@gmail.com';
    if (!loading) {
      if (!user) {
        console.log("AdminPanel: No user, redirecting to home");
        navigate('/');
      } else if (profile?.role !== 'admin' && !isBootstrapAdmin) {
        console.log("AdminPanel: User is not admin, role:", profile?.role, "redirecting to home");
        navigate('/');
      }
    }
  }, [user, profile, loading, navigate]);

  const isBootstrapAdmin = user?.email === 'robsonbatista3@gmail.com' || user?.email === 'robson0441@gmail.com';
  if (loading || (profile?.role !== 'admin' && !isBootstrapAdmin)) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
          <p className="text-white/40 text-sm animate-pulse">Verificando credenciais de administrador...</p>
        </div>
      </div>
    );
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Usuários', icon: Users },
    { id: 'lives', label: 'Lives', icon: Video },
    { id: 'payments', label: 'Pagamentos', icon: CreditCard },
    { id: 'applications', label: 'Solicitações', icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      {/* Sidebar */}
      <aside className="w-72 bg-[#111] border-r border-white/5 flex flex-col">
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tighter">VibeAdmin</h1>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${
                activeView === item.id 
                  ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20' 
                  : 'text-white/40 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-bold text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-8 border-t border-white/5">
          <button 
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-white/40 hover:bg-red-500/10 hover:text-red-500 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-bold text-sm">Sair do Painel</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-12">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h2 className="text-3xl font-bold capitalize">{activeView}</h2>
            <p className="text-white/40 mt-1">Bem-vindo de volta ao centro de controle.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-bold text-sm">{user.displayName}</p>
              <p className="text-[10px] text-pink-500 font-bold uppercase tracking-widest">Administrador</p>
            </div>
            <img src={user.photoURL || ""} className="w-12 h-12 rounded-2xl border-2 border-white/10" />
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeView === 'dashboard' && <AdminDashboard />}
            {activeView === 'users' && <UserManagement />}
            {activeView === 'lives' && <LiveManagement />}
            {activeView === 'payments' && <PaymentManagement />}
            {activeView === 'applications' && <ApplicationManagement />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
