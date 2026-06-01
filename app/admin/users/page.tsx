"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, JSX } from "react";
import { 
  LogOut, ArrowLeft, Users, UserPlus, Shield, Trash2, Save, 
  X, Plus, Search, AlertCircle, UserCheck, CheckCircle,
  Edit2, MoreVertical, ChevronDown, Filter, Crown, BookOpen, School,
  Menu, ChevronUp
} from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  userRoles?: { role: { id: string; name: string; description: string } }[];
}

interface Role {
  id: string;
  name: string;
  description: string;
}

const roleColors: Record<string, { bg: string; text: string; border: string; icon: JSX.Element }> = {
  ADMIN: { 
    bg: "bg-purple-500/20", 
    text: "text-purple-300", 
    border: "border-purple-500/30",
    icon: <Crown size={12} className="text-purple-400" />
  },
  HEAD_TEACHER: { 
    bg: "bg-blue-500/20", 
    text: "text-blue-300", 
    border: "border-blue-500/30",
    icon: <BookOpen size={12} className="text-blue-400" />
  },
  CLASS_TEACHER: { 
    bg: "bg-green-500/20", 
    text: "text-green-300", 
    border: "border-green-500/30",
    icon: <School size={12} className="text-green-400" />
  },
  TEACHER: { 
    bg: "bg-gray-500/20", 
    text: "text-gray-300", 
    border: "border-gray-500/30",
    icon: <UserCheck size={12} className="text-gray-400" />
  }
};

const roleLabels: Record<string, string> = {
  ADMIN: "Администратор",
  HEAD_TEACHER: "Завуч",
  CLASS_TEACHER: "Классный руководитель",
  TEACHER: "Учитель"
};

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    role: "TEACHER"
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Проверка прав доступа
  useEffect(() => {
    if (status === "loading") return;
    
    if (!session) {
      router.replace("/login");
      return;
    }
    
    const roles = (session?.user?.roles as string[]) || [];
    if (!roles.includes("ADMIN")) {
      router.replace("/");
      return;
    }
  }, [session, status, router]);

  // Загрузка пользователей и ролей
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, rolesRes] = await Promise.all([
          fetch("/api/admin/users"),
          fetch("/api/admin/roles")
        ]);
        
        const usersData = await usersRes.json();
        const rolesData = await rolesRes.json();
        
        setUsers(usersData);
        setFilteredUsers(usersData);
        setRoles(rolesData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (session && session?.user?.roles?.includes("ADMIN")) {
      fetchData();
    }
  }, [session]);

  // Фильтрация
  useEffect(() => {
    if (searchQuery) {
      setFilteredUsers(users.filter(user => 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
      ));
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);

  const toggleExpand = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  // Добавление пользователя
  const handleAddUser = async () => {
    if (!formData.email || !formData.name) {
      alert("Заполните все поля");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        alert("Пользователь добавлен");
        setShowAddModal(false);
        setFormData({ email: "", name: "", role: "TEACHER" });
        
        const usersRes = await fetch("/api/admin/users");
        const usersData = await usersRes.json();
        setUsers(usersData);
        setFilteredUsers(usersData);
      } else {
        const error = await response.json();
        alert(error.error || "Ошибка при добавлении");
      }
    } catch (error) {
      console.error("Error adding user:", error);
      alert("Ошибка при добавлении");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Обновление ролей пользователя
  const handleAssignRole = async (userId: string, roleId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId })
      });
      
      if (response.ok) {
        const usersRes = await fetch("/api/admin/users");
        const usersData = await usersRes.json();
        setUsers(usersData);
        setFilteredUsers(usersData);
      } else {
        const error = await response.json();
        alert(error.error || "Ошибка при назначении роли");
      }
    } catch (error) {
      console.error("Error assigning role:", error);
      alert("Ошибка при назначении роли");
    }
  };

  // Удаление роли у пользователя
  const handleRemoveRole = async (userId: string, roleId: string, roleName: string) => {
    if (!confirm(`Удалить роль "${roleLabels[roleName] || roleName}" у пользователя?`)) return;
    
    try {
      const response = await fetch(`/api/admin/users/${userId}/roles?roleId=${roleId}`, {
        method: "DELETE"
      });
      
      if (response.ok) {
        const usersRes = await fetch("/api/admin/users");
        const usersData = await usersRes.json();
        setUsers(usersData);
        setFilteredUsers(usersData);
      } else {
        alert("Ошибка при удалении роли");
      }
    } catch (error) {
      console.error("Error removing role:", error);
      alert("Ошибка при удалении роли");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/login");
  };

  if (!mounted || status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a2332] to-[#2b3858]">
        <div className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl text-center border border-white/20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-3 text-gray-300 text-sm">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!session || !session?.user?.roles?.includes("ADMIN")) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a2332] to-[#2b3858]">
      {/* Шапка */}
      <div className="bg-white/10 backdrop-blur-lg border-b border-white/20 sticky top-0 z-20">
        <div className="px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/admin")}
                className="w-8 h-8 flex items-center justify-center bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-all"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <Users size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Персонал</p>
                <p className="text-xs text-gray-400">Управление сотрудниками</p>
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setShowAddModal(true)}
                className="w-8 h-8 flex items-center justify-center bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-all"
              >
                <UserPlus size={16} />
              </button>
              <button
                onClick={handleLogout}
                className="w-8 h-8 flex items-center justify-center bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 max-w-full">
        {/* Поиск */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20 mb-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по имени или email..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Статистика */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20 mb-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Всего сотрудников:</span>
            <span className="text-white font-bold text-lg">{filteredUsers.length}</span>
          </div>
        </div>

        {/* Список сотрудников */}
        <div className="space-y-2">
          {filteredUsers.map((user) => {
            const userRoles = user.userRoles?.map(ur => ur.role) || [];
            const availableRoles = roles.filter(role => !userRoles.some(ur => ur.id === role.id));
            const isExpanded = expandedUsers.has(user.id);
            
            return (
              <div key={user.id} className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                        <Users size={14} className="text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white text-sm truncate">{user.name}</p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex flex-wrap gap-1 justify-end max-w-[120px]">
                        {userRoles.slice(0, 2).map((role) => {
                          const colors = roleColors[role.name] || roleColors.TEACHER;
                          return (
                            <div
                              key={role.id}
                              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${colors.bg} ${colors.text} border ${colors.border}`}
                            >
                              {colors.icon}
                              <span className="hidden xs:inline">{roleLabels[role.name]?.substring(0, 2)}</span>
                              <span className="xs:hidden">{roleLabels[role.name]?.charAt(0)}</span>
                              <button
                                onClick={() => handleRemoveRole(user.id, role.id, role.name)}
                                className="ml-0.5 hover:text-red-300"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          );
                        })}
                        {userRoles.length > 2 && (
                          <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded-full">
                            +{userRoles.length - 2}
                          </span>
                        )}

                      </div>
                      {availableRoles.length > 0 && (
                        <button
                          onClick={() => toggleExpand(user.id)}
                          className="w-6 h-6 flex items-center justify-center bg-white/5 text-white hover:bg-white/10 rounded-lg transition-all"
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Блок назначения ролей - раскрывающийся */}
                  {isExpanded && availableRoles.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/10">
                      <div className="flex flex-wrap gap-1">
                        {availableRoles.map((role) => (
                          <button
                            key={role.id}
                            onClick={() => handleAssignRole(user.id, role.id)}
                            className="px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg text-[10px] transition-all flex items-center gap-1"
                          >
                            <Plus size={10} />
                            {roleLabels[role.name] || role.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {filteredUsers.length === 0 && (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center border border-white/20">
              <Users size={40} className="text-gray-500 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Нет сотрудников</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-3 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg text-xs transition-all"
              >
                Добавить сотрудника
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно добавления сотрудника */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md p-3">
          <div className="w-full max-w-md bg-gradient-to-br from-[#1a2332] to-[#2b3858] rounded-xl shadow-2xl border border-white/20 overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <UserPlus size={18} className="text-white" />
                  <h3 className="text-base font-bold text-white">Добавить сотрудника</h3>
                </div>
                <button onClick={() => setShowAddModal(false)} className="text-white/70 hover:text-white">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-white text-xs mb-1">ФИО *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Иванов Иван Иванович"
                  className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div>
                <label className="block text-white text-xs mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="ivanov@school.ru"
                  className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div>
                <label className="block text-white text-xs mb-1">Начальная роль</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.name} className="bg-[#1a2332]">
                      {roleLabels[role.name] || role.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-4 border-t border-white/10 bg-white/5 flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-sm"
              >
                Отмена
              </button>
              <button
                onClick={handleAddUser}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg transition-all text-sm disabled:opacity-50"
              >
                {isSubmitting ? "Добавление..." : "Добавить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}