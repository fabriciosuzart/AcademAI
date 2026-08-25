import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Circle, ShieldCheck, User } from "lucide-react";
import "./Perfil.css";
import { STATUS, OPCOES_STATUS, classeStatus, ehManutencao, rotuloStatus } from "../../utils/status";
import { agruparPorModelo } from "../../utils/equipamentos";

const trainingModules = [
  "Impressora 3D Finder",
  "Impressora 3D Bambu LAB",
  "Cortadora a Laser",
  "Prototipadora",
];

const parseEquipmentDescription = (desc: string | null | undefined) => {
  if (!desc) return { specs: "", description: "", requiresTraining: false };
  try {
    const parsed = JSON.parse(desc);
    if (parsed && typeof parsed === "object") {
      return {
        specs: parsed.specs || "",
        description: parsed.description || "",
        requiresTraining: !!parsed.requiresTraining,
      };
    }
  } catch (e) {
    // Fallback para formato anterior
  }
  // Lógica de fallback
  const hasTraining =
    desc.toLowerCase().includes("treino") ||
    desc.toLowerCase().includes("obrigatório");
  const cleanDesc = desc.replace(/\n?TREINO OBRIGATÓRIO/gi, "").trim();
  return {
    specs: "",
    description: cleanDesc,
    requiresTraining: hasTraining,
  };
};

interface AdminUser {
  id: string;
  name: string;
  email: string;
  ra?: string | null;
  role?: string;
  trainings?: string;
  isActive?: boolean;
}

interface DocumentoIA {
  nome: string;
  tamanho: number;
  modificadoEm: string;
  blocos: number;
}

interface EquipmentItem {
  id: string | number;
  name: string;
  description?: string | null;
  imagePath?: string | null;
  status: string;
  quantity?: number;
  items?: any[];
}

const Perfil: React.FC = () => {
  // Estado para guardar os dados do usuário
  const [userData, setUserData] = useState({ name: "", email: "", ra: "" });
  const [userRole, setUserRole] = useState("ALUNO");

  // Estado para guardar o histórico de agendamentos
  const [appointments, setAppointments] = useState<any[]>([]);
  const [viewAllAppointments, setViewAllAppointments] = useState(false);

  // Estatísticas dinâmicas do semestre (RF17 / #14)
  const [semesterStats, setSemesterStats] = useState({
    semesterHours: 0,
    projectCount: 0,
    completedTrainings: ''
  });
  const [loadingStats, setLoadingStats] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([]);
  const [activeTab, setActiveTab] = useState<
    "agendamentos" | "usuarios" | "equipamentos" | "treinamento" | "configuracoes"
  >("agendamentos");
  // Papel escolhido no seletor, ainda nao salvo, indexado pelo id do usuario.
  const [userRoleEdit, setUserRoleEdit] = useState<Record<string, string>>({});

  // Treinamento da IA (RAG). Veio do painel admin, onde a tela era cega: subia
  // o arquivo e nunca mais se sabia o que a assistente tinha lido.
  const [file, setFile] = useState<File | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [messageAI, setMessageAI] = useState("");
  const [msgTypeAI, setMsgTypeAI] = useState<"success" | "error" | "info">("info");
  const [documentos, setDocumentos] = useState<DocumentoIA[]>([]);
  const [totalVetores, setTotalVetores] = useState(0);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Estado das Vozes (Jarvis Mode)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(localStorage.getItem('preferredVoiceURI') || '');

  useEffect(() => {
    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const uri = e.target.value;
    setSelectedVoiceURI(uri);
    localStorage.setItem('preferredVoiceURI', uri);
  };
  const [appointmentFilter, setAppointmentFilter] = useState<
    "todos" | "aprovado" | "pendente" | "concluido" | "cancelado"
  >("todos");
  const [userSearch, setUserSearch] = useState("");
  const [searchFilter, setSearchFilter] = useState<
    "todos" | "nome" | "email" | "ra"
  >("todos");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [pauseModalGroup, setPauseModalGroup] = useState<EquipmentItem | null>(
    null,
  );
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRa, setEditRa] = useState("");
  const [editTrainings, setEditTrainings] = useState<string[]>([]);

  // Estados para edição de equipamentos
  const [editingEquipment, setEditingEquipment] = useState<any>(null);
  const [isEditEquipmentModalOpen, setIsEditEquipmentModalOpen] =
    useState(false);
  const [editEquipmentName, setEditEquipmentName] = useState("");
  const [editEquipmentSpecs, setEditEquipmentSpecs] = useState("");
  const [editEquipmentDescription, setEditEquipmentDescription] = useState("");
  const [editEquipmentQuantity, setEditEquipmentQuantity] = useState(1);
  const [editEquipmentStatus, setEditEquipmentStatus] = useState<string>(STATUS.DISPONIVEL);
  const [editEquipmentRequiresTraining, setEditEquipmentRequiresTraining] =
    useState(false);

  // Estados para adição de equipamentos
  const [isAddEquipmentModalOpen, setIsAddEquipmentModalOpen] = useState(false);
  const [addEquipmentName, setAddEquipmentName] = useState("");
  const [addEquipmentSpecs, setAddEquipmentSpecs] = useState("");
  const [addEquipmentDescription, setAddEquipmentDescription] = useState("");
  const [addEquipmentQuantity, setAddEquipmentQuantity] = useState(1);
  const [addEquipmentStatus, setAddEquipmentStatus] = useState<string>(STATUS.DISPONIVEL);
  const [addEquipmentRequiresTraining, setAddEquipmentRequiresTraining] =
    useState(false);
  const [addEquipmentImageFile, setAddEquipmentImageFile] =
    useState<File | null>(null);
  const [addEquipmentImagePreview, setAddEquipmentImagePreview] = useState<
    string | null
  >(null);

  // Estado para visualização de detalhes de agendamento
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);

  // Estados para gerenciar bloqueios de datas
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const [blockDateStr, setBlockDateStr] = useState("");

  const [blockReason, setBlockReason] = useState("");
  const [blockEquipmentId, setBlockEquipmentId] = useState("");

  const openEditUser = (user: AdminUser) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRa(user.ra || "");
    setEditTrainings(user.trainings ? user.trainings.split(",") : []);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingUser(null);
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const res = await api.put(`/users/${editingUser.id}`, {
        name: editName,
        email: editEmail,
        ra: editRa,
        trainings: editTrainings.join(","),
      });
      if (res.status === 200) {
        await fetchAdminUsers();
        closeEditModal();
        alert("Usuário atualizado com sucesso.");
      }
    } catch (error: any) {
      console.error("Erro ao atualizar usuário:", error);
      alert("Erro ao salvar usuário: " + (error.response?.data?.error || "Falha no servidor"));
    }
  };

  const handleDeleteUser = async (userToDelete?: AdminUser) => {
    const target = userToDelete || editingUser;
    if (!target) return;
    if (
      !window.confirm(
        `Tem certeza que deseja excluir o usuário ${target.name}? Esta ação apagará também os agendamentos dele e é irreversível.`,
      )
    )
      return;

    try {
      const res = await api.delete(`/users/${target.id}`);
      if (res.status === 200) {
        alert("Usuário excluído com sucesso!");
        if (editingUser?.id === target.id) closeEditModal();
        fetchAdminUsers();
      }
    } catch (error: any) {
      console.error("Erro ao excluir usuário", error);
      alert("Erro ao excluir: " + (error.response?.data?.error || "Erro de conexão com o servidor."));
    }
  };

  const handleToggleActive = async (user: any) => {
    const action = user.isActive ? "desativar" : "ativar";
    if (!window.confirm(`Tem certeza que deseja ${action} a conta de ${user.name}?`)) return;

    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`http://localhost:3000/api/users/${user.id}/toggle-active`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        alert(`Conta ${action}da com sucesso!`);
        fetchAdminUsers();
      } else {
        const data = await res.json();
        alert("Erro: " + data.error);
      }
    } catch (error) {
      alert("Erro de conexão ao alterar status.");
    }
  };

  // Alterar o papel do usuario (RF04). Vinha do painel admin, que era a unica
  // tela capaz de fazer isso — o perfil editava tudo menos o papel.
  const handleChangeRole = async (userId: string | number) => {
    const chave = String(userId);
    const novoPapel = userRoleEdit[chave];
    if (!novoPapel) return;
    try {
      await api.put(`/users/${userId}`, { role: novoPapel });
      setUserRoleEdit((prev) => {
        const copia = { ...prev };
        delete copia[chave];
        return copia;
      });
      await fetchAdminUsers();
      alert("Perfil atualizado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao alterar perfil", error);
      alert("Erro ao alterar perfil: " + (error.response?.data?.error || "Erro de conexão."));
    }
  };

  // ── Treinamento da IA ────────────────────────────────────────────
  const fetchDocumentos = async () => {
    setLoadingDocs(true);
    try {
      const res = await api.get("/train/documents");
      setDocumentos(res.data.documentos || []);
      setTotalVetores(res.data.totalVetores || 0);
    } catch (error) {
      console.error("Erro ao listar documentos da IA", error);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setMessageAI(`Arquivo selecionado: ${e.target.files[0].name}`);
      setMsgTypeAI("info");
    }
  };

  const handleUploadAI = async () => {
    if (!file) return;
    setLoadingAI(true);
    setMessageAI("Processando o arquivo... isso pode levar alguns segundos.");
    setMsgTypeAI("info");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/train", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      // O backend ja devolvia estes numeros; a tela antiga os descartava e
      // escrevia so "IA Treinada com sucesso!".
      const { blocosIndexados, totalVetores: total } = res.data || {};
      setMessageAI(
        blocosIndexados !== undefined
          ? `Documento indexado: ${blocosIndexados} bloco(s) novo(s), ${total} no total.`
          : "Documento indexado com sucesso!",
      );
      setMsgTypeAI("success");
      setFile(null);
      await fetchDocumentos();
    } catch (error: any) {
      setMessageAI(error.response?.data?.error || "Erro de conexão.");
      setMsgTypeAI("error");
    } finally {
      setLoadingAI(false);
    }
  };

  const handleDeleteDocumento = async (nome: string) => {
    if (!window.confirm(`Remover "${nome}" da base de conhecimento?\nA assistente deixará de responder com base nele.`)) return;
    try {
      const res = await api.delete(`/train/documents/${encodeURIComponent(nome)}`);
      setMessageAI(`"${nome}" removido (-${res.data.vetoresRemovidos} blocos).`);
      setMsgTypeAI("success");
      await fetchDocumentos();
    } catch (error: any) {
      setMessageAI(error.response?.data?.error || "Erro ao remover documento.");
      setMsgTypeAI("error");
    }
  };

  const formatarTamanho = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDeleteEquipment = async (id: number, name: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o equipamento "${name}"?\nEsta ação apagará também os agendamentos associados a ele e é irreversível.`)) return;

    try {
      const res = await api.delete(`/equipment/${id}`);
      if (res.status === 200) {
        alert("Equipamento excluído com sucesso!");
        fetchEquipment();
      }
    } catch (error: any) {
      console.error("Erro ao excluir equipamento", error);
      alert("Erro ao excluir: " + (error.response?.data?.error || "Erro de conexão com o servidor."));
    }
  };

  // Ao carregar a página
  useEffect(() => {
    // Busca os dados salvos no localStorage (pelo Login.tsx)
    const name = localStorage.getItem("userName") || "Usuário";
    let email = localStorage.getItem("userEmail");
    if (!email || email === "undefined" || email === "null")
      email = "Não informado";

    let ra = localStorage.getItem("userRA") || localStorage.getItem("userRa");
    if (!ra || ra === "undefined" || ra === "null") ra = "Não informado";

    const role = localStorage.getItem("userRole") || "ALUNO";
    const userId = localStorage.getItem("userId");

    // Atualiza o estado
    setUserData({ name, email, ra });
    setUserRole(role);

    // Se tiver ID, busca os agendamentos no banco e as estatísticas dinâmicas
    if (userId) {
      fetchAppointments(userId, false);
      fetchStats(userId);
    }
  }, []);

  // Recarrega agendamentos ao mudar o toggle
  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (userId) {
      fetchAppointments(userId, viewAllAppointments);
    }
  }, [viewAllAppointments]);

  // Função para buscar agendamentos no servidor
  const fetchAppointments = async (id: string, all: boolean) => {
    try {
      const url = all ? '/appointments/all-history' : `/appointments/${id}`;
      const res = await api.get(url);
      setAppointments(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Erro ao buscar histórico:", e);
    }
  };

  const handleCancelAppointment = async (apptId: number) => {
    if (!window.confirm("Tem certeza que deseja cancelar esta reserva?")) return;

    const userId = localStorage.getItem("userId");
    try {
      const res = await api.put(`/appointments/${apptId}/cancel`);
      if (res.status === 200) {
        alert("Reserva cancelada com sucesso!");
        if (userId) fetchAppointments(userId, viewAllAppointments);
      }
    } catch (error: any) {
      console.error("Erro ao cancelar reserva:", error);
      alert("Erro ao cancelar: " + (error.response?.data?.error || "Erro de conexão"));
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const res = await api.get("/users");
      const data = res.data;
      setAdminUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Erro ao buscar usuários do admin:", e);
    }
  };

  const fetchEquipment = async () => {
    try {
      const res = await fetch("http://localhost:3000/api/equipment");
      const data = await res.json();
      if (!Array.isArray(data)) return;

      // Mesmo agrupamento do catalogo publico, para as duas telas contarem a
      // mesma historia. O grupo vem do campo `modelo`, nao de regex no nome.
      const grupos = agruparPorModelo(data).map((g) => ({
        id: g.unidades[0].id,
        name: g.name,
        description: g.description,
        status: g.status,
        imagePath: g.imagePath || g.img,
        quantity: g.quantidade,
        items: g.unidades,
      }));

      setEquipmentItems(grupos as EquipmentItem[]);
    } catch (e) {
      console.error("Erro ao buscar/agrupar equipamentos do admin:", e);
    }
  };

  const fetchBlockedDates = async () => {
    try {
      const res = await api.get('/blocked-dates');
      setBlockedDates(res.data);
    } catch (e) {
      console.error("Erro ao buscar datas bloqueadas", e);
    }
  };

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!blockDateStr) return;
    try {
      await api.post('/blocked-dates', {
        date: blockDateStr,
        reason: blockReason,
        equipmentId: blockEquipmentId || null
      });
      alert("Data bloqueada com sucesso!");
      fetchBlockedDates();
      setBlockDateStr('');
      setBlockReason('');
      setBlockEquipmentId('');
    } catch (error: any) {
      alert("Erro ao bloquear data: " + (error.response?.data?.error || "Verifique se a data já está bloqueada."));
    }
  };

  const handleRemoveBlock = async (id: number) => {
    if(!window.confirm("Deseja remover este bloqueio?")) return;
    try {
      await api.delete(`/blocked-dates/${id}`);
      fetchBlockedDates();
    } catch(e) {
      alert("Erro ao remover bloqueio.");
    }
  };

  const isAdmin = userRole === "ADMIN";
  // O professor nao administra cadastro (por isso nao ve as abas de usuarios e
  // equipamentos), mas aprova reservas — e essa tela so existe no painel.
  const podeVerPainel = isAdmin || userRole === "PROFESSOR";

  useEffect(() => {
    if (isAdmin) {
      fetchAdminUsers();
      fetchEquipment();
      fetchBlockedDates();
    }
  }, [isAdmin]);

  const displayRole = isAdmin
    ? "Administrador"
    : userRole === "TEACHER" || userRole === "PROFESSOR"
      ? "Professor"
      : "Aluno";

  const totalReservations = appointments.length;

  // Estatísticas dinâmicas (RF17) — substituem valores hard-coded
  const fetchStats = async (userId: string) => {
    setLoadingStats(true);
    try {
      const res = await api.get(`/users/${userId}/stats`);
      setSemesterStats(res.data);
    } catch (e) {
      console.error('Erro ao buscar estatísticas:', e);
    } finally {
      setLoadingStats(false);
    }
  };

  const { semesterHours, projectCount, completedTrainings: trainingsStr } = semesterStats;

  // Monta array booleano de treinamentos concluídos a partir da string CSV do banco
  const completedTrainings = trainingModules.map(module =>
    trainingsStr.split(',').map(t => t.trim()).includes(module)
  );

  const filteredAppointments =
    appointmentFilter === "todos"
      ? appointments
      : appointments.filter((appt) => {
        if (!appt.status) return false;
        const s = appt.status.toLowerCase();
        if (appointmentFilter === "cancelado") return s === "cancelada" || s === "cancelado";
        if (appointmentFilter === "aprovado") return s === "aprovada" || s === "aprovado";
        if (appointmentFilter === "concluido") return s === "concluida" || s === "concluido";
        if (appointmentFilter === "pendente") return s === "pendente";
        if (appointmentFilter === "rejeitado") return s === "rejeitada" || s === "rejeitado" || s === "recusado";
        return s === appointmentFilter;
      });

  const filteredUsers = adminUsers.filter((user) => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return true;
    if (searchFilter === "nome") return user.name.toLowerCase().includes(term);
    if (searchFilter === "email")
      return user.email.toLowerCase().includes(term);
    if (searchFilter === "ra")
      return (user.ra ?? "").toLowerCase().includes(term);
    return (
      user.name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      (user.ra ?? "").toLowerCase().includes(term)
    );
  });

  const needsTraining = (item: EquipmentItem) => {
    const parsed = parseEquipmentDescription(item.description);
    return (
      parsed.requiresTraining || item.name?.toLowerCase().includes("cortadora")
    );
  };

  const sortedAppointments = [...appointments].sort((a, b) => {
    const dateA = a.date || "";
    const dateB = b.date || "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return (a.startTime || "").localeCompare(b.startTime || "");
  });

  // O card se chama "Próximo agendamento", mas nao olhava data nenhuma: pegava
  // a primeira reserva da lista, mesmo vencida. E o filtro de canceladas nunca
  // funcionou, porque o banco grava CANCELADA e a comparacao era com
  // "cancelado" no masculino.
  const hojeISO = new Date().toISOString().slice(0, 10);
  const upcomingAppointment = sortedAppointments.find((appt) => {
    const s = appt.status?.toLowerCase() ?? "";
    const ativa = s !== "cancelada" && s !== "cancelado"
      && s !== "rejeitada" && s !== "rejeitado"
      && s !== "concluida" && s !== "concluido";
    return ativa && (appt.date || "") >= hojeISO;
  });

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPassword.length < 8 || newPassword.length < 8)
      return alert("A senha deve ter no mínimo 8 caracteres."); // RF01
    if (newPassword !== confirmPassword)
      return alert("As senhas não coincidem.");

    const userId = localStorage.getItem("userId");
    try {
      const res = await fetch("http://localhost:3000/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        alert("Erro: " + data.error);
      }
    } catch (error) {
      alert("Erro de conexão com o servidor.");
    }
  };

  const handleToggleStatus = async (item: any) => {
    try {
      const newStatus = ehManutencao(item.status) ? STATUS.DISPONIVEL : STATUS.MANUTENCAO;

      const formData = new FormData();
      formData.append('name', item.name);
      formData.append('status', newStatus);
      formData.append('description', '');
      formData.append('specs', '');
      formData.append('requiresTraining', 'false');
      formData.append('quantity', '1');

      const res = await api.put(`/equipment/${item.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.status === 200) {
        if (pauseModalGroup) {
          setPauseModalGroup((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              items: prev.items?.map((i: any) =>
                i.id === item.id ? { ...i, status: newStatus } : i,
              ),
            };
          });
        }
        fetchEquipment();
      }
    } catch (error: any) {
      console.error("Erro ao atualizar status", error);
      alert("Erro ao atualizar status: " + (error.response?.data?.error || "Erro de conexão."));
    }
  };

  const handleGroupPauseClick = (group: EquipmentItem) => {
    if (group.quantity === 1 && group.items && group.items.length > 0) {
      handleToggleStatus(group.items[0]);
    } else {
      setPauseModalGroup(group);
    }
  };

  const openEditEquipment = (item: EquipmentItem) => {
    setEditingEquipment(item);
    setEditEquipmentName(item.name);

    const { specs, description, requiresTraining } = parseEquipmentDescription(
      item.description,
    );

    setEditEquipmentSpecs(specs);
    setEditEquipmentDescription(description);
    setEditEquipmentQuantity(item.quantity || 1);
    setEditEquipmentStatus(item.status);
    setEditEquipmentRequiresTraining(requiresTraining);
    setIsEditEquipmentModalOpen(true);
  };

  const closeEditEquipmentModal = () => {
    setIsEditEquipmentModalOpen(false);
    setEditingEquipment(null);
    setEditEquipmentName("");
    setEditEquipmentSpecs("");
    setEditEquipmentDescription("");
    setEditEquipmentQuantity(1);
    setEditEquipmentStatus(STATUS.DISPONIVEL);
    setEditEquipmentRequiresTraining(false);
  };

  const handleEditEquipmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEquipment || !editingEquipment.items?.[0]) return;

    try {
      const equipmentId = editingEquipment.items[0].id;
      const formData = new FormData();
      formData.append('name', editEquipmentName);
      formData.append('specs', editEquipmentSpecs);
      formData.append('description', editEquipmentDescription);
      formData.append('quantity', String(editEquipmentQuantity));
      formData.append('status', editEquipmentStatus);
      formData.append('requiresTraining', String(editEquipmentRequiresTraining));

      const res = await api.put(`/equipment/${equipmentId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.status === 200) {
        await fetchEquipment();
        closeEditEquipmentModal();
        alert("Equipamento atualizado com sucesso.");
      }
    } catch (error: any) {
      console.error("Erro ao atualizar equipamento:", error);
      alert("Erro ao salvar equipamento: " + (error.response?.data?.error || "Falha no servidor"));
    }
  };

  const openAddEquipmentModal = () => {
    setAddEquipmentName("");
    setAddEquipmentSpecs("");
    setAddEquipmentDescription("");
    setAddEquipmentQuantity(1);
    setAddEquipmentStatus(STATUS.DISPONIVEL);
    setAddEquipmentRequiresTraining(false);
    setAddEquipmentImageFile(null);
    setAddEquipmentImagePreview(null);
    setIsAddEquipmentModalOpen(true);
  };

  const closeAddEquipmentModal = () => {
    setIsAddEquipmentModalOpen(false);
    setAddEquipmentImagePreview(null);
    setAddEquipmentImageFile(null);
  };

  const handleAddEquipmentImageChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setAddEquipmentImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () =>
        setAddEquipmentImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAddEquipmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEquipmentName.trim()) return;

    try {
      const formData = new FormData();
      formData.append("name", addEquipmentName.trim());
      formData.append("specs", addEquipmentSpecs);
      formData.append("description", addEquipmentDescription);
      formData.append("quantity", String(addEquipmentQuantity));
      formData.append("status", addEquipmentStatus);
      formData.append("requiresTraining", String(addEquipmentRequiresTraining));
      if (addEquipmentImageFile) {
        formData.append("image", addEquipmentImageFile);
      }

      const res = await api.post("/equipment", formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.status === 201 || res.status === 200) {
        await fetchEquipment();
        closeAddEquipmentModal();
        alert("Equipamento adicionado com sucesso!");
      }
    } catch (error: any) {
      console.error("Erro ao adicionar equipamento:", error);
      alert("Erro ao adicionar equipamento: " + (error.response?.data?.error || "Falha no servidor"));
    }
  };

  // ── Leitura de Tela por Voz ─────────────────────────────
  useEffect(() => {
    const handleReadScreen = () => {
      let text = `Você está na página do seu perfil, ${userData.name}. `;
      if (isAdmin) {
         text += `Você está na visão de administrador. Existem ${adminUsers.length} usuários cadastrados e ${appointments.length} agendamentos no histórico.`;
      } else {
         text += `Este semestre você tem ${totalReservations} reservas concluídas, totalizando ${semesterHours} horas de uso em ${projectCount} projetos. Você concluiu ${completedTrainings.filter(Boolean).length} de ${trainingModules.length} treinamentos disponíveis.`;
      }
      window.dispatchEvent(new CustomEvent('voice-speak', { detail: { text } }));
    };
    window.addEventListener('voice-read-screen', handleReadScreen);
    return () => window.removeEventListener('voice-read-screen', handleReadScreen);
  }, [userData.name, isAdmin, totalReservations, semesterHours, projectCount, completedTrainings, adminUsers.length, appointments.length]);

  return (
    <div className="profile-container">
      <div className="profile-grid">
        {/* COLUNA 1: CARTÃO DE DADOS PESSOAIS*/}
        <div className="profile-card info-card">
          {/* Avatar com a inicial do nome */}
          <div className="avatar-circle">
            {userData.name.charAt(0).toUpperCase()}
          </div>

          <div className="profile-heading">
            <div>
              <h2>{userData.name}</h2>
              <span className="role-pill">{displayRole}</span>
            </div>
          </div>

          <div className="info-row">
            <span>E-mail</span>
            <strong>{userData.email}</strong>
          </div>
          <div className="info-row2">
            <span>R.A.</span>
            <strong>{userData.ra}</strong>
          </div>

          <hr className="divider" />

          {!isAdmin && (
            <>
              <p className="semestre-label">Uso neste Semestre</p>
              <div className="stats-grid">
                <div className="stats-card">
                  <span>Reservas</span>
                  <strong>{totalReservations}</strong>
                </div>
                <div className="stats-card">
                  <span>Horas</span>
                  <strong>{loadingStats ? '…' : `${semesterHours}h`}</strong>
                </div>
                <div className="stats-card">
                  <span>Equipamentos</span>
                  <strong>{loadingStats ? '…' : projectCount}</strong>
                </div>
              </div>

              <div className="training-header">
                <h3 className="training-title">Treinamentos</h3>
                <h3 className="training-counter">
                  {completedTrainings.filter(Boolean).length}/
                  {trainingModules.length}
                </h3>
              </div>
              <ul className="training-list">
                {trainingModules.map((training, index) => (
                  <li
                    key={training}
                    className={completedTrainings[index] ? "done" : "pending"}
                  >
                    <span
                      className="training-dot"
                      style={{
                        color: completedTrainings[index]
                          ? "#10b981"
                          : "#ef4444",
                      }}
                    >
                      <Circle size={10} fill="currentColor" aria-hidden="true" />
                    </span>
                    <span>{training}</span>
                    {completedTrainings[index] && (
                      <span className="training-check"><Check size={14} aria-hidden="true" /></span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="training-note">
                Necessário para reservar certos equipamentos.
              </p>
            </>
          )}
        </div>

        {/* COLUNA 2: AGENDAMENTOS / CONFIGURAÇÕES */}
        <div className="profile-card right-panel">
          <div className="panel-tabs">
            <button
              type="button"
              className={`panel-tab ${activeTab === "agendamentos" ? "active" : ""}`}
              onClick={() => setActiveTab("agendamentos")}
            >
              Agendamentos
              <span className="tab-badge">{appointments.length}</span>
            </button>
            {isAdmin && (
              <>
                <button
                  type="button"
                  className={`panel-tab ${activeTab === "usuarios" ? "active" : ""}`}
                  onClick={() => setActiveTab("usuarios")}
                >
                  Usuários
                </button>
                <button
                  type="button"
                  className={`panel-tab ${activeTab === "equipamentos" ? "active" : ""}`}
                  onClick={() => setActiveTab("equipamentos")}
                >
                  Equipamentos
                </button>
                <button
                  type="button"
                  className={`panel-tab ${activeTab === "treinamento" ? "active" : ""}`}
                  onClick={() => { setActiveTab("treinamento"); fetchDocumentos(); }}
                >
                  Treinamento IA
                </button>
              </>
            )}
            <button
              type="button"
              className={`panel-tab ${activeTab === "configuracoes" ? "active" : ""}`}
              onClick={() => setActiveTab("configuracoes")}
            >
              Configurações
            </button>

            {/* Sai da pagina, ao contrario das outras abas — por isso o
                destaque e a seta. O painel guarda as quatro telas que nao
                moram aqui: visao geral, reservas pendentes, calendario e IA.
                O professor so enxerga Reservas Pendentes la dentro; a trava
                por papel ja existe no proprio painel. */}
            {podeVerPainel && (
              <Link to="/admin" className="panel-tab panel-tab-link">
                <ShieldCheck size={15} aria-hidden="true" />
                Painel
                <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            )}
          </div>

          {activeTab === "agendamentos" ? (
            <div className="panel-content">
              {upcomingAppointment ? (
                <div className="upcoming-card">
                  <div className="upcoming-date">
                    <strong>
                      {new Date(upcomingAppointment.date)
                        .getDate()
                        .toString()
                        .padStart(2, "0")}
                    </strong>
                    <span>
                      {new Date(upcomingAppointment.date).toLocaleDateString(
                        "pt-BR",
                        { month: "short", weekday: "short" },
                      )}
                    </span>
                  </div>
                  <div className="upcoming-meta">
                    <span className="upcoming-label">Próximo agendamento</span>
                    <strong>
                      {upcomingAppointment.equipment || "Agendamento"}
                    </strong>
                    <p>
                      {upcomingAppointment.startTime || "---"} –{" "}
                      {upcomingAppointment.endTime || "---"} •{" "}
                      {upcomingAppointment.location ||
                        upcomingAppointment.room ||
                        "Sala não informada"}
                    </p>
                  </div>
                  <div className="upcoming-actions">
                    <button type="button" className="secondary-btn" onClick={() => {
                      if (appointments.length > 0) {
                        setSelectedAppointment(appointments[0]);
                      }
                    }}>
                      Ver detalhes
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => {
                      alert("Para reagendar, cancele este agendamento na lista abaixo e faça um novo na tela de Equipamentos.");
                    }}>
                      Reagendar
                    </button>
                  </div>
                </div>
              ) : (
                // Este card mostra so o proximo agendamento futuro, entao
                // "nenhum encontrado" mentia quando havia varios no passado.
                <div className="empty-card">Nenhum agendamento futuro.</div>
              )}

              {userRole === "ADMIN" && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#cbd5e1', fontSize: '0.9rem' }}>
                    <input 
                      type="checkbox" 
                      checked={viewAllAppointments} 
                      onChange={(e) => setViewAllAppointments(e.target.checked)} 
                      style={{ marginRight: '8px' }}
                    />
                    Ver todos os agendamentos (Histórico Global)
                  </label>
                </div>
              )}

              <div className="filter-row">
                {[
                  "todos",
                  "aprovado",
                  "pendente",
                  "concluido",
                  "cancelado",
                ].map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={`filter-chip ${appointmentFilter === status ? "active" : ""}`}
                    onClick={() => setAppointmentFilter(status as any)}
                  >
                    {status === "todos"
                      ? "Todos"
                      : status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>

              <ul className="schedule-list">
                {filteredAppointments.length === 0 ? (
                  <li className="schedule-empty">
                    {/* Culpar o filtro quando o banco esta vazio manda o
                        usuario procurar no lugar errado. */}
                    {appointments.length === 0
                      ? "Nenhuma reserva cadastrada ainda."
                      : "Nenhuma reserva com este status."}
                  </li>
                ) : (
                  filteredAppointments.map((appt) => (
                    <li key={appt.id} className="schedule-item">
                      <div>
                        <strong>{appt.equipment?.name || appt.equipment || "Agendamento"}</strong>
                        {viewAllAppointments && appt.user && (
                          <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '2px', marginBottom: '4px' }}>
                            <User size={16} aria-hidden="true" /> {appt.user || appt.user?.name} ({appt.userRole || appt.user?.role})
                          </div>
                        )}
                        <p>
                          {appt.date
                            ? appt.date.split("-").reverse().join("/")
                            : "Data não informada"}{" "}
                          • {appt.startTime || appt.time || "??:??"} -{" "}
                          {appt.endTime || "??:??"}
                        </p>
                      </div>
                      <div className="schedule-meta">
                        <span className={`perfil-status-badge ${appt.status}`}>
                          {appt.status}
                        </span>
                        <div className="schedule-actions">
                          <button type="button" className="secondary-btn" onClick={() => setSelectedAppointment(appt)}>
                            Ver detalhes
                          </button>
                          <button type="button" className="ghost-btn" onClick={() => alert("Para reagendar, cancele este agendamento e faça um novo na tela de Equipamentos.")}>
                            Reagendar
                          </button>
                          {['PENDENTE', 'APROVADO', 'APROVADA'].includes(appt.status?.toUpperCase()) && (
                            <button type="button" className="ghost-btn danger" onClick={() => handleCancelAppointment(appt.id)}>
                              Cancelar
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : activeTab === "usuarios" ? (
            <div className="panel-content admin-users-panel">
              <div className="admin-panel-header">
                <div>
                  <h2>Usuários</h2>
                  <p>
                    {adminUsers.length} de {adminUsers.length} usuários
                  </p>
                </div>
              </div>

              <div className="search-row">
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Buscar por nome, e-mail ou R.A..."
                />
              </div>

              <div className="filter-row users-filter-row">
                {["todos", "nome", "email", "ra"].map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={`filter-chip ${searchFilter === filter ? "active" : ""}`}
                    onClick={() => setSearchFilter(filter as any)}
                  >
                    {filter === "todos"
                      ? "Todos"
                      : filter === "nome"
                        ? "Nome"
                        : filter === "email"
                          ? "E-mail"
                          : "R.A."}
                  </button>
                ))}
              </div>

              <div className="user-table-wrapper">
                <table className="user-table">
                  <thead>
                    <tr>
                      <th>Usuário</th>
                      <th>E-mail</th>
                      <th>R.A.</th>
                      <th>Perfil</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id}>
                        <td className="user-name-cell">{user.name}</td>
                        <td>{user.email}</td>
                        <td>
                          <div className="role-cell">
                            <select
                              className="role-select"
                              value={userRoleEdit[String(user.id)] ?? user.role ?? "ALUNO"}
                              disabled={user.role === "ADMIN"}
                              title={
                                user.role === "ADMIN"
                                  ? "O perfil de um administrador não pode ser alterado"
                                  : "Alterar perfil de acesso"
                              }
                              onChange={(e) =>
                                setUserRoleEdit((prev) => ({ ...prev, [String(user.id)]: e.target.value }))
                              }
                            >
                              <option value="ALUNO">Estudante</option>
                              <option value="PROFESSOR">Professor</option>
                              <option value="ADMIN">Administrador</option>
                            </select>
                            {userRoleEdit[String(user.id)] &&
                              userRoleEdit[String(user.id)] !== user.role && (
                              <button
                                type="button"
                                className="ghost-btn small success"
                                onClick={() => handleChangeRole(user.id)}
                              >
                                Salvar
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`status-pill ${user.isActive === false ? 'manutencao' : 'disponivel'}`}>
                            {user.isActive === false ? 'DESATIVADO' : 'ATIVO'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="ghost-btn small"
                            onClick={() => openEditUser(user)}
                            disabled={user.role === "ADMIN"}
                            title={
                              user.role === "ADMIN"
                                ? "Perfis de administrador não podem ser editados"
                                : "Editar usuário"
                            }
                          >
                            <span className="button-icon" aria-hidden="true">
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M4 17.25V21h3.75L17.81 10.94l-3.75-3.75L4 17.25Z"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M14.06 4.93994c.39-.39 1.02-.39 1.41 0l2.54 2.54c.39.39.39 1.02 0 1.41l-1.83 1.83-3.75-3.75 1.63-1.63Z"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          </button>
                          <button
                            type="button"
                            className={`ghost-btn small ${user.isActive === false ? 'success' : 'danger'}`}
                            onClick={() => handleToggleActive(user)}
                            title={user.isActive === false ? 'Ativar conta' : 'Desativar conta'}
                          >
                            {user.isActive === false ? 'Ativar' : 'Desativar'}
                          </button>
                          <button
                            type="button"
                            className="ghost-btn small danger"
                            onClick={() => handleDeleteUser(user)}
                            disabled={user.role === "ADMIN"}
                            title={user.role === "ADMIN" ? "Admins não podem ser excluídos" : "Excluir usuário"}
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === "equipamentos" ? (
            <div className="panel-content admin-equipment-panel">
              <div className="admin-panel-header">
                <div>
                  <h2>Equipamentos</h2>
                  <p>
                    {equipmentItems.length} de {equipmentItems.length}{" "}
                    equipamentos cadastrados
                  </p>
                </div>
              </div>

              <div className="equipment-grid">
                {equipmentItems.map((item) => (
                  <div key={item.id} className="equipment-card">
                    <div className="equipment-image">
                      {item.imagePath ? (
                        <img
                          src={`http://localhost:3000${item.imagePath}`}
                          alt={item.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            // 'contain' + fundo branco: as imagens sao normalizadas
                            // em quadrado branco, entao nada precisa ser cortado.
                            objectFit: "contain",
                            background: "#ffffff",
                          }}
                        />
                      ) : (
                        <span>Imagem</span>
                      )}
                    </div>
                    <div className="equipment-body">
                      <strong>{item.name}</strong>
                      <div className="equipment-meta-row">
                        {item.quantity && item.quantity >= 1 && (
                          <span className="equipment-tag">
                            QTD: {item.quantity}
                          </span>
                        )}
                        <span
                          className={`status-pill ${classeStatus(item.status)}`}
                        >
                          {rotuloStatus(item.status).toUpperCase()}
                        </span>
                        {needsTraining(item) && (
                          <span className="equipment-tag training">TREINO</span>
                        )}
                      </div>
                      <div className="equipment-actions-row">
                        <button
                          type="button"
                          className="ghost-btn small flex-1"
                          onClick={() => openEditEquipment(item)}
                        >
                          <span className="button-icon" aria-hidden="true">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M4 17.25V21h3.75L17.81 10.94l-3.75-3.75L4 17.25Z"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M14.06 4.93994c.39-.39 1.02-.39 1.41 0l2.54 2.54c.39.39.39 1.02 0 1.41l-1.83 1.83-3.75-3.75 1.63-1.63Z"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="ghost-btn small flex-1 danger"
                          onClick={() => handleDeleteEquipment(Number(item.id), item.name)}
                          title="Excluir equipamento"
                          style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}
                        >
                          <span className="button-icon" aria-hidden="true">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/>
                            </svg>
                          </span>
                          Excluir
                        </button>
                        <button
                          type="button"
                          className={`ghost-btn small icon-only ${ehManutencao(item.status) ? "play-btn" : "pause-btn"}`}
                          onClick={() => handleGroupPauseClick(item)}
                          title={
                            ehManutencao(item.status)
                              ? "Disponibilizar"
                              : "Pausar para Manutenção"
                          }
                        >
                          {ehManutencao(item.status) ? (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          ) : (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="add-equipment-card">
                  <button
                    type="button"
                    className="add-equipment-button"
                    onClick={openAddEquipmentModal}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ) : activeTab === "treinamento" ? (
            <div className="panel-content treinamento-panel">
              <div className="admin-panel-header">
                <div>
                  <h2>Treinamento da IA</h2>
                  <p>
                    {documentos.length} documento(s) na base &middot; {totalVetores} bloco(s) indexado(s)
                  </p>
                </div>
              </div>

              <div className="settings-card">
                <h3>Enviar documento</h3>
                <p className="treino-ajuda">
                  A assistente responde a partir destes arquivos. Formatos aceitos:
                  <strong> PDF, DOCX, MD e TXT</strong>. PDF e DOCX passam pela conversão
                  do Docling (Python); MD e TXT são lidos direto.
                </p>
                <input
                  type="file"
                  className="sleek-input"
                  accept=".pdf,.docx,.md,.txt"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  className="save-btn"
                  onClick={handleUploadAI}
                  disabled={!file || loadingAI}
                >
                  {loadingAI ? "Processando..." : "Treinar IA"}
                </button>
                {messageAI && (
                  <p className={`treino-msg treino-msg-${msgTypeAI}`}>{messageAI}</p>
                )}
              </div>

              <div className="settings-card">
                <h3>O que a assistente já leu</h3>
                {loadingDocs ? (
                  <p className="treino-ajuda">Carregando documentos...</p>
                ) : documentos.length === 0 ? (
                  <p className="treino-ajuda">
                    Nenhum documento na base. Sem eles a assistente não tem o que
                    responder sobre o laboratório.
                  </p>
                ) : (
                  <ul className="doc-lista">
                    {documentos.map((doc) => (
                      <li key={doc.nome} className="doc-item">
                        <div className="doc-info">
                          <strong>{doc.nome}</strong>
                          <span>
                            {formatarTamanho(doc.tamanho)} &middot; {doc.blocos} bloco(s) &middot;{" "}
                            {new Date(doc.modificadoEm).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="ghost-btn small danger"
                          onClick={() => handleDeleteDocumento(doc.nome)}
                          title="Remover da base de conhecimento"
                        >
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div className="panel-content settings-panel">
              <div className="settings-card">
                <h3>Dados pessoais</h3>
                <div className="settings-grid">
                  <div className="profile-photo">
                    <span>{userData.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="settings-fields">
                    <label>Nome completo</label>
                    <input type="text" value={userData.name} readOnly />
                    <label>E-mail</label>
                    <input type="email" value={userData.email} readOnly />
                    <label>R.A. (somente leitura)</label>
                    <input type="text" value={userData.ra} readOnly />
                    <label>Telefone</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(11) 9 0000-0000"
                    />
                  </div>
                </div>
                <div className="settings-actions">
                  <button type="button" className="ghost-btn">
                    Trocar foto
                  </button>
                  <button type="button" className="secondary-btn">
                    Salvar alterações
                  </button>
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-header">
                  <h3>Trocar senha</h3>
                  <span>Segurança</span>
                </div>
                <form onSubmit={handlePasswordUpdate} className="password-form">
                  <label>Senha atual</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <label>Nova senha</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <label>Confirmar nova senha</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <div className="password-help">
                    <span>mín. 8 caracteres</span>
                    <span>1 letra maiúscula</span>
                    <span>1 número</span>
                    <span>1 símbolo especial</span>
                  </div>
                  <button type="submit" className="secondary-btn">
                    Atualizar senha
                  </button>
                </form>
              </div>

              <div className="settings-card">
                <h3>Configurações de Voz (Jarvis Mode)</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '15px' }}>
                  Escolha qual voz o assistente utilizará para ler notificações e telas. As opções disponíveis dependem do seu navegador e sistema operacional.
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label htmlFor="voiceSelect" style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>Voz Preferida:</label>
                  <select 
                    id="voiceSelect" 
                    value={selectedVoiceURI} 
                    onChange={handleVoiceChange}
                    style={{ padding: '10px', borderRadius: '8px', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155' }}
                  >
                    <option value="">-- Padrão do Sistema --</option>
                    {voices.map(v => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ marginTop: '20px' }}>
                  <button 
                    className="primary-btn small" 
                    onClick={() => {
                       const u = new SpeechSynthesisUtterance("Testando a nova voz do assistente Academ AI.");
                       const selected = voices.find(v => v.voiceURI === selectedVoiceURI);
                       if (selected) u.voice = selected;
                       window.speechSynthesis.speak(u);
                    }}
                  >
                    Testar Voz
                  </button>
                </div>
              </div>

              {isAdmin && (
                <div className="settings-card">
                  <div className="settings-header">
                    <h3>Feriados e Recessos</h3>
                    <span>Bloqueio de Agenda</span>
                  </div>
                  <form onSubmit={handleAddBlock} className="password-form" style={{ marginBottom: '20px' }}>
                    <label>Data</label>
                    <input
                      type="date"
                      value={blockDateStr}
                      onChange={(e) => setBlockDateStr(e.target.value)}
                      required
                    />
                    <label>Equipamento (Deixe em branco para bloquear o laboratório todo)</label>
                    <select
                      value={blockEquipmentId}
                      onChange={(e) => setBlockEquipmentId(e.target.value)}
                      style={{ padding: '14px 16px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.04)', color: '#f8fafc', marginBottom: '14px', width: '100%' }}
                    >
                      <option value="" style={{ color: 'black' }}>-- Todos os Equipamentos (Geral) --</option>
                      {equipmentItems.map(eq => (
                          <option key={eq.id} value={eq.id} style={{ color: 'black' }}>{eq.name}</option>
                      ))}
                    </select>
                    <label>Motivo (Ex: Feriado Nacional)</label>
                    <input
                      type="text"
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="Ex: Emenda de feriado..."
                    />
                    <button type="submit" className="secondary-btn" style={{ marginTop: '10px' }}>
                      Bloquear Data
                    </button>
                  </form>

                  <h4>Datas Bloqueadas Ativas</h4>
                  <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {blockedDates.length === 0 ? (
                      <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Nenhuma data bloqueada.</p>
                    ) : (
                      blockedDates.map(block => (
                        <div key={block.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: '8px' }}>
                          <div>
                            <strong style={{ display: 'block', color: '#f8fafc' }}>{block.date.split('-').reverse().join('/')}</strong>
                            <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                              {block.equipment ? `Apenas: ${block.equipment.name}` : 'Bloqueio Geral (Todos)'} 
                              {block.reason ? ` - ${block.reason}` : ''}
                            </span>
                          </div>
                          <button type="button" onClick={() => handleRemoveBlock(block.id)} className="ghost-btn danger small">
                            Remover
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Detalhes do Agendamento */}
      {selectedAppointment && (
        <div className="modal-overlay">
          <div className="modal-content appointment-details-modal">
            <div className="modal-header">
              <h2>Detalhes do Agendamento</h2>
              <button className="close-modal-btn" onClick={() => setSelectedAppointment(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <span className="detail-label">Equipamento:</span>
                <span className="detail-value">{selectedAppointment.equipment?.name || selectedAppointment.equipment || "Agendamento"}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Data:</span>
                <span className="detail-value">{selectedAppointment.date ? selectedAppointment.date.split("-").reverse().join("/") : "Não informada"}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Horário:</span>
                <span className="detail-value">{selectedAppointment.startTime || selectedAppointment.time || "??:??"} às {selectedAppointment.endTime || "??:??"}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Status:</span>
                <span className={`perfil-status-badge ${selectedAppointment.status}`}>{selectedAppointment.status}</span>
              </div>
              
              {selectedAppointment.user && (
                <div className="detail-row">
                  <span className="detail-label">Usuário:</span>
                  <span className="detail-value">{selectedAppointment.user?.name || selectedAppointment.user} ({selectedAppointment.userRole || selectedAppointment.user?.role})</span>
                </div>
              )}

              {selectedAppointment.justification && (
                <div className="detail-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span className="detail-label" style={{ marginBottom: '8px' }}>Justificativa / Motivo:</span>
                  <div className="detail-value" style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', width: '100%', fontStyle: 'italic' }}>
                    "{selectedAppointment.justification}"
                  </div>
                </div>
              )}

              {selectedAppointment.rejectionReason && (
                <div className="detail-row" style={{ flexDirection: 'column', alignItems: 'flex-start', marginTop: '10px' }}>
                  <span className="detail-label" style={{ marginBottom: '8px', color: '#ef4444' }}>Motivo da Recusa:</span>
                  <div className="detail-value" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px', borderRadius: '8px', width: '100%' }}>
                    {selectedAppointment.rejectionReason}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="secondary-btn" onClick={() => setSelectedAppointment(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && editingUser && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div
            className="modal-card edit-user-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "600px" }}
          >
            <div className="modal-header">
              <div>
                <h3
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  Editar perfil
                </h3>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={closeEditModal}
              >
                ×
              </button>
            </div>
            <form className="edit-user-form" onSubmit={handleEditUserSubmit}>
              <div className="form-group">
                <label className="sleek-label">NOME DO USUÁRIO</label>
                <input
                  type="text"
                  className="sleek-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label className="sleek-label">E-MAIL</label>
                  <input
                    type="email"
                    className="sleek-input"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group flex-1">
                  <label className="sleek-label">R.A.</label>
                  <input
                    type="text"
                    className="sleek-input"
                    value={editRa}
                    onChange={(e) => setEditRa(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="sleek-label">TREINAMENTOS CONCLUÍDOS</label>
                <div className="training-tags-container">
                  {trainingModules.map((module) => {
                    const isSelected = editTrainings.includes(module);
                    return (
                      <button
                        type="button"
                        key={module}
                        className={`training-tag-btn ${isSelected ? "selected" : ""}`}
                        onClick={() => {
                          if (isSelected) {
                            setEditTrainings((prev) =>
                              prev.filter((t) => t !== module),
                            );
                          } else {
                            setEditTrainings((prev) => [...prev, module]);
                          }
                        }}
                      >
                        {isSelected && <span className="check-icon"><Check size={14} aria-hidden="true" /></span>}
                        {module}
                      </button>
                    );
                  })}
                </div>
              </div>

              <hr className="divider" style={{ margin: "20px 0" }} />

              <div className="modal-actions-footer">
                <button
                  type="button"
                  className="ghost-btn danger-btn"
                  onClick={() => handleDeleteUser()}
                >
                  Excluir Usuário
                </button>
                <div className="right-actions">
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={closeEditModal}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="secondary-btn"
                    style={{ padding: "8px 16px" }}
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditEquipmentModalOpen && editingEquipment && (
        <div className="modal-overlay" onClick={closeEditEquipmentModal}>
          <div
            className="modal-card edit-user-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "600px" }}
          >
            <div className="modal-header">
              <div>
                <h3
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  Editar equipamento
                </h3>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={closeEditEquipmentModal}
              >
                ×
              </button>
            </div>
            <form
              className="edit-user-form"
              onSubmit={handleEditEquipmentSubmit}
            >
              <div className="form-group">
                <label className="sleek-label">NOME DO EQUIPAMENTO</label>
                <input
                  type="text"
                  className="sleek-input"
                  value={editEquipmentName}
                  onChange={(e) => setEditEquipmentName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="sleek-label">ESPECIFICAÇÕES</label>
                <input
                  type="text"
                  className="sleek-input"
                  value={editEquipmentSpecs}
                  onChange={(e) => setEditEquipmentSpecs(e.target.value)}
                  placeholder="Ex: 40W CO₂ - área 600x300mm"
                />
              </div>

              <div className="form-group">
                <label className="sleek-label">DESCRIÇÃO</label>
                <textarea
                  className="sleek-input"
                  value={editEquipmentDescription}
                  onChange={(e) => setEditEquipmentDescription(e.target.value)}
                  placeholder="Descrição do equipamento"
                  style={{ minHeight: "80px", fontFamily: "inherit" }}
                />
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label className="sleek-label">QUANTIDADE DISPONÍVEL</label>
                  <input
                    type="number"
                    className="sleek-input"
                    value={editEquipmentQuantity}
                    onChange={(e) =>
                      setEditEquipmentQuantity(parseInt(e.target.value) || 1)
                    }
                    min="1"
                  />
                </div>
                <div className="form-group flex-1">
                  <label className="sleek-label">STATUS ATUAL</label>
                  <select
                    className="sleek-input"
                    value={editEquipmentStatus}
                    onChange={(e) => setEditEquipmentStatus(e.target.value)}
                    style={{ cursor: "pointer" }}
                  >
                    {OPCOES_STATUS.map(({ valor, rotulo }) => (
                      <option key={valor} value={valor}>{rotulo}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="sleek-label">TREINAMENTO OBRIGATÓRIO</label>
                <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      checked={editEquipmentRequiresTraining}
                      onChange={() => setEditEquipmentRequiresTraining(true)}
                    />
                    <span>Sim</span>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      checked={!editEquipmentRequiresTraining}
                      onChange={() => setEditEquipmentRequiresTraining(false)}
                    />
                    <span>Não</span>
                  </label>
                </div>
              </div>

              <hr className="divider" style={{ margin: "20px 0" }} />

              <div className="modal-actions-footer">
                <div className="right-actions">
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={closeEditEquipmentModal}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="secondary-btn"
                    style={{ padding: "8px 16px" }}
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddEquipmentModalOpen && (
        <div className="modal-overlay" onClick={closeAddEquipmentModal}>
          <div
            className="modal-card edit-user-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "600px" }}
          >
            <div className="modal-header">
              <div>
                <h3
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Novo equipamento
                </h3>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={closeAddEquipmentModal}
              >
                ×
              </button>
            </div>
            <form
              className="edit-user-form"
              onSubmit={handleAddEquipmentSubmit}
            >
              {/* Image upload */}
              <div className="form-group">
                <label className="sleek-label">IMAGEM DO EQUIPAMENTO</label>
                <div
                  className="image-upload-zone"
                  onClick={() =>
                    document
                      .getElementById("add-equipment-image-input")
                      ?.click()
                  }
                  style={{
                    border: "2px dashed rgba(56,189,248,0.35)",
                    borderRadius: "14px",
                    padding: "16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    minHeight: "110px",
                    background: "rgba(56,189,248,0.04)",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  {addEquipmentImagePreview ? (
                    <img
                      src={addEquipmentImagePreview}
                      alt="Preview"
                      style={{
                        maxHeight: "100px",
                        maxWidth: "100%",
                        borderRadius: "8px",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        color: "#94a3b8",
                        fontSize: "0.9rem",
                        textAlign: "center",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          marginBottom: "6px",
                          lineHeight: 0,
                        }}
                      ></span>
                      Clique para enviar uma imagem
                    </span>
                  )}
                  <input
                    id="add-equipment-image-input"
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleAddEquipmentImageChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="sleek-label">NOME DO EQUIPAMENTO</label>
                <input
                  type="text"
                  className="sleek-input"
                  value={addEquipmentName}
                  onChange={(e) => setAddEquipmentName(e.target.value)}
                  placeholder="Ex.: Impressora 3D Prusa MK4"
                  required
                />
              </div>

              <div className="form-group">
                <label className="sleek-label">ESPECIFICAÇÕES</label>
                <input
                  type="text"
                  className="sleek-input"
                  value={addEquipmentSpecs}
                  onChange={(e) => setAddEquipmentSpecs(e.target.value)}
                  placeholder="Ex.: FDM · 250×210×220mm · PLA/PETG"
                />
              </div>

              <div className="form-group">
                <label className="sleek-label">DESCRIÇÃO</label>
                <textarea
                  className="sleek-input"
                  value={addEquipmentDescription}
                  onChange={(e) => setAddEquipmentDescription(e.target.value)}
                  placeholder="Descrição resumida do equipamento e seu uso."
                  style={{ minHeight: "80px", fontFamily: "inherit" }}
                />
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label className="sleek-label">QUANTIDADE DISPONÍVEL</label>
                  <input
                    type="number"
                    className="sleek-input"
                    value={addEquipmentQuantity}
                    onChange={(e) =>
                      setAddEquipmentQuantity(parseInt(e.target.value) || 1)
                    }
                    min="1"
                  />
                </div>
                <div className="form-group flex-1">
                  <label className="sleek-label">
                    TREINAMENTO OBRIGATÓRIO?
                  </label>
                  <div
                    style={{ display: "flex", gap: "16px", marginTop: "8px" }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="add-training"
                        checked={addEquipmentRequiresTraining}
                        onChange={() => setAddEquipmentRequiresTraining(true)}
                      />
                      <span>Sim</span>
                    </label>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="add-training"
                        checked={!addEquipmentRequiresTraining}
                        onChange={() => setAddEquipmentRequiresTraining(false)}
                      />
                      <span>Não</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="sleek-label">STATUS ATUAL</label>
                <div className="status-radio-group">
                  {OPCOES_STATUS.map(({ valor, rotulo }) => ({ value: valor, label: rotulo.toUpperCase() })).map((opt) => (
                    <label
                      key={opt.value}
                      className={`status-radio-pill ${addEquipmentStatus === opt.value ? "selected-" + classeStatus(opt.value) : ""}`}
                      style={{ cursor: "pointer" }}
                    >
                      <input
                        type="radio"
                        name="add-status"
                        value={opt.value}
                        checked={addEquipmentStatus === opt.value}
                        onChange={() => setAddEquipmentStatus(opt.value)}
                        style={{ display: "none" }}
                      />
                      <span className="status-radio-dot" />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <hr className="divider" style={{ margin: "20px 0" }} />

              <div className="modal-actions-footer">
                <div className="right-actions">
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={closeAddEquipmentModal}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="secondary-btn"
                    style={{ padding: "8px 16px" }}
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {pauseModalGroup && (
        <div className="modal-overlay" onClick={() => setPauseModalGroup(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Alterar Status: {pauseModalGroup.name}</h3>
                <p>
                  Este equipamento possui múltiplas unidades. Escolha qual
                  deseja alterar.
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setPauseModalGroup(null)}
              >
                ×
              </button>
            </div>

            <div
              className="equipment-unit-list"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                marginTop: "20px",
                marginBottom: "24px",
              }}
            >
              {pauseModalGroup.items?.map((unit) => (
                <div
                  key={unit.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "rgba(255,255,255,0.05)",
                    padding: "12px 16px",
                    borderRadius: "12px",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "#f8fafc" }}>
                      {unit.name}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "#94a3b8",
                        marginTop: "4px",
                      }}
                    >
                      Status: {rotuloStatus(unit.status)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`ghost-btn small icon-only ${ehManutencao(unit.status) ? "play-btn" : "pause-btn"}`}
                    onClick={() => handleToggleStatus(unit)}
                    title={
                      ehManutencao(unit.status)
                        ? "Disponibilizar"
                        : "Pausar para Manutenção"
                    }
                  >
                    {ehManutencao(unit.status) ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    ) : (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setPauseModalGroup(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Perfil;
