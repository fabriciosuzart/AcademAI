import React, { useState, useEffect } from "react";
import "./Perfil.css";

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
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([]);
  const [activeTab, setActiveTab] = useState<
    "agendamentos" | "usuarios" | "equipamentos" | "configuracoes"
  >("agendamentos");
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
  const [editEquipmentStatus, setEditEquipmentStatus] = useState("available");
  const [editEquipmentRequiresTraining, setEditEquipmentRequiresTraining] =
    useState(false);

  // Estados para adição de equipamentos
  const [isAddEquipmentModalOpen, setIsAddEquipmentModalOpen] = useState(false);
  const [addEquipmentName, setAddEquipmentName] = useState("");
  const [addEquipmentSpecs, setAddEquipmentSpecs] = useState("");
  const [addEquipmentDescription, setAddEquipmentDescription] = useState("");
  const [addEquipmentQuantity, setAddEquipmentQuantity] = useState(1);
  const [addEquipmentStatus, setAddEquipmentStatus] = useState("available");
  const [addEquipmentRequiresTraining, setAddEquipmentRequiresTraining] =
    useState(false);
  const [addEquipmentImageFile, setAddEquipmentImageFile] =
    useState<File | null>(null);
  const [addEquipmentImagePreview, setAddEquipmentImagePreview] = useState<
    string | null
  >(null);

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
      const res = await fetch(
        `http://localhost:3000/api/users/${editingUser.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editName,
            email: editEmail,
            ra: editRa,
            trainings: editTrainings.join(","),
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        alert("Erro ao salvar usuário: " + (data.error || "Falha no servidor"));
        return;
      }
      await fetchAdminUsers();
      closeEditModal();
      alert("Usuário atualizado com sucesso.");
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      alert("Erro de conexão ao salvar usuário.");
    }
  };

  const handleDeleteUser = async () => {
    if (!editingUser) return;
    if (
      !window.confirm(
        `Tem certeza que deseja excluir o usuário ${editingUser.name}? Esta ação é irreversível.`,
      )
    )
      return;

    try {
      const res = await fetch(
        `http://localhost:3000/api/users/${editingUser.id}`,
        {
          method: "DELETE",
        },
      );

      if (res.ok) {
        alert("Usuário excluído com sucesso!");
        closeEditModal();
        fetchAdminUsers();
      } else {
        const data = await res.json();
        alert("Erro ao excluir: " + data.error);
      }
    } catch (error) {
      console.error("Erro ao excluir usuário", error);
      alert("Erro de conexão com o servidor.");
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

    // Se tiver ID, busca os agendamentos no banco
    if (userId) {
      fetchAppointments(userId);
    }
  }, []);

  // Função para buscar agendamentos no servidor
  const fetchAppointments = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:3000/api/appointments/${id}`);
      const data = await res.json();
      setAppointments(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Erro ao buscar histórico:", e);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const res = await fetch("http://localhost:3000/api/users");
      const data = await res.json();
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

      const grouped = data.reduce(
        (acc: any, item: any) => {
          const baseName = item.name.replace(/\s*(0\d|A\d|\d+)$/i, "").trim();
          if (!acc[baseName]) {
            acc[baseName] = {
              id: item.id,
              name: baseName,
              description: item.description,
              status: item.status,
              imagePath: item.imagePath || item.img,
              quantity: 1,
              items: [item],
            };
          } else {
            acc[baseName].quantity = (acc[baseName].quantity || 1) + 1;
            acc[baseName].items.push(item);
          }
          return acc;
        },
        {} as Record<string, EquipmentItem>,
      );

      setEquipmentItems(Object.values(grouped));
    } catch (e) {
      console.error("Erro ao buscar/agrupar equipamentos do admin:", e);
    }
  };

  const isAdmin = userRole === "ADMIN";

  useEffect(() => {
    if (isAdmin) {
      fetchAdminUsers();
      fetchEquipment();
    }
  }, [isAdmin]);

  const displayRole = isAdmin
    ? "Administrador"
    : userRole === "TEACHER" || userRole === "PROFESSOR"
      ? "Professor"
      : "Aluno";

  const totalReservations = appointments.length;
  const semesterHours = 47;
  const projectCount = 4;
  const completedTrainings = [true, true, true, false];

  const filteredAppointments =
    appointmentFilter === "todos"
      ? appointments
      : appointments.filter(
          (appt) => appt.status?.toLowerCase() === appointmentFilter,
        );

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

  const getStatusClass = (status: string) => {
    const normalized = status?.toLowerCase?.();
    if (normalized?.includes("disp") || normalized === "available")
      return "available";
    if (normalized?.includes("uso") || normalized === "in-use") return "in-use";
    return "maintenance";
  };

  const formatStatusText = (status: string) => {
    const normalized = status?.toLowerCase?.();
    if (normalized?.includes("disp") || normalized === "available")
      return "Disponível";
    if (normalized?.includes("uso") || normalized === "in-use") return "Em uso";
    return "Em manutenção";
  };

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

  const upcomingAppointment =
    sortedAppointments.find(
      (appt) => appt.status?.toLowerCase() !== "cancelado",
    ) || sortedAppointments[0];

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPassword.length < 6 || newPassword.length < 6)
      return alert("A senha deve ter no mínimo 6 caracteres.");
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
        alert("✅ " + data.message);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        alert("❌ Erro: " + data.error);
      }
    } catch (error) {
      alert("Erro de conexão com o servidor.");
    }
  };

  const handleToggleStatus = async (item: any) => {
    try {
      const isMaintenance = getStatusClass(item.status) === "maintenance";
      const newStatus = isMaintenance ? "available" : "maintenance";

      const res = await fetch(
        `http://localhost:3000/api/equipment/${item.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        },
      );

      if (res.ok) {
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
    } catch (error) {
      console.error("Erro ao atualizar status", error);
      alert("Erro de conexão com o servidor.");
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
    setEditEquipmentStatus("available");
    setEditEquipmentRequiresTraining(false);
  };

  const handleEditEquipmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEquipment || !editingEquipment.items?.[0]) return;

    try {
      const equipmentId = editingEquipment.items[0].id;
      const res = await fetch(
        `http://localhost:3000/api/equipment/${equipmentId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editEquipmentName,
            specs: editEquipmentSpecs,
            description: editEquipmentDescription,
            quantity: editEquipmentQuantity,
            status: editEquipmentStatus,
            requiresTraining: editEquipmentRequiresTraining,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        alert(
          "Erro ao salvar equipamento: " + (data.error || "Falha no servidor"),
        );
        return;
      }
      await fetchEquipment();
      closeEditEquipmentModal();
      alert("Equipamento atualizado com sucesso.");
    } catch (error) {
      console.error("Erro ao atualizar equipamento:", error);
      alert("Erro de conexão ao salvar equipamento.");
    }
  };

  const openAddEquipmentModal = () => {
    setAddEquipmentName("");
    setAddEquipmentSpecs("");
    setAddEquipmentDescription("");
    setAddEquipmentQuantity(1);
    setAddEquipmentStatus("available");
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

      const res = await fetch("http://localhost:3000/api/equipment", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(
          "Erro ao adicionar equipamento: " +
            (data.error || "Falha no servidor"),
        );
        return;
      }
      await fetchEquipment();
      closeAddEquipmentModal();
      alert("Equipamento adicionado com sucesso!");
    } catch (error) {
      console.error("Erro ao adicionar equipamento:", error);
      alert("Erro de conexão ao salvar equipamento.");
    }
  };

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
                  <strong>{semesterHours}h</strong>
                </div>
                <div className="stats-card">
                  <span>Projetos</span>
                  <strong>{projectCount}</strong>
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
                      ●
                    </span>
                    <span>{training}</span>
                    {completedTrainings[index] && (
                      <span className="training-check">✓</span>
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
              </>
            )}
            <button
              type="button"
              className={`panel-tab ${activeTab === "configuracoes" ? "active" : ""}`}
              onClick={() => setActiveTab("configuracoes")}
            >
              Configurações
            </button>
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
                    <button type="button" className="secondary-btn">
                      Ver detalhes
                    </button>
                    <button type="button" className="ghost-btn">
                      Reagendar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty-card">Nenhum agendamento encontrado.</div>
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
                    Nenhum agendamento para este filtro.
                  </li>
                ) : (
                  filteredAppointments.map((appt) => (
                    <li key={appt.id} className="schedule-item">
                      <div>
                        <strong>{appt.equipment}</strong>
                        <p>
                          {appt.date
                            ? appt.date.split("-").reverse().join("/")
                            : "Data não informada"}{" "}
                          • {appt.startTime || "??:??"} -{" "}
                          {appt.endTime || "??:??"}
                        </p>
                      </div>
                      <div className="schedule-meta">
                        <span className={`status-badge ${appt.status}`}>
                          {appt.status}
                        </span>
                        <div className="schedule-actions">
                          <button type="button" className="secondary-btn">
                            Reagendar
                          </button>
                          <button type="button" className="ghost-btn danger">
                            Cancelar
                          </button>
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
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id}>
                        <td className="user-name-cell">{user.name}</td>
                        <td>{user.email}</td>
                        <td>{user.ra}</td>
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
                            Editar
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
                            objectFit: "cover",
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
                          className={`status-pill ${getStatusClass(item.status)}`}
                        >
                          {formatStatusText(item.status).toUpperCase()}
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
                          className={`ghost-btn small icon-only ${getStatusClass(item.status) === "maintenance" ? "play-btn" : "pause-btn"}`}
                          onClick={() => handleGroupPauseClick(item)}
                          title={
                            getStatusClass(item.status) === "maintenance"
                              ? "Disponibilizar"
                              : "Pausar para Manutenção"
                          }
                        >
                          {getStatusClass(item.status) === "maintenance" ? (
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
            </div>
          )}
        </div>
      </div>

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
                        {isSelected && <span className="check-icon">✓</span>}
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
                  onClick={handleDeleteUser}
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
                    <option value="available">Disponível</option>
                    <option value="in-use">Em uso</option>
                    <option value="maintenance">Em manutenção</option>
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
                  {[
                    { value: "available", label: "DISPONÍVEL" },
                    { value: "in-use", label: "EM USO" },
                    { value: "maintenance", label: "EM MANUTENÇÃO" },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`status-radio-pill ${addEquipmentStatus === opt.value ? "selected-" + opt.value : ""}`}
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
                      Status: {formatStatusText(unit.status)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`ghost-btn small icon-only ${getStatusClass(unit.status) === "maintenance" ? "play-btn" : "pause-btn"}`}
                    onClick={() => handleToggleStatus(unit)}
                    title={
                      getStatusClass(unit.status) === "maintenance"
                        ? "Disponibilizar"
                        : "Pausar para Manutenção"
                    }
                  >
                    {getStatusClass(unit.status) === "maintenance" ? (
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
