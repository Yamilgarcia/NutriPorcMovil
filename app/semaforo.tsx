import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
} from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";
import SidebarMenu from "../components/SidebarMenu";

// =========================================================================
// SUB-COMPONENTE: TARJETA DE LOTE (Maneja su propio historial)
// =========================================================================
const LoteCard = ({ lote, onOpenForm, onOpenDelete }) => {
  const [incidencias, setIncidencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const qIncidencias = query(
      collection(db, "lotes", lote.id, "incidencias"),
      orderBy("fecha", "desc"),
    );
    const unsub = onSnapshot(qIncidencias, (snap) => {
      const data = [];
      snap.forEach((d) => data.push({ id: d.id, ...d.data() }));
      setIncidencias(data);
      setLoading(false);
    });
    return () => unsub();
  }, [lote.id]);

  // Lógica del Semáforo Biológico
  let statusColor = "#27AE60"; // Verde
  let statusTitle = "Normal";
  let diagnostico = "El lote presenta parámetros de salud normales.";
  let accion = "Continuar monitoreo habitual.";

  if (lote.mortalidad > 3) {
    statusColor = "#E74C3C"; // Rojo
    statusTitle = "Alerta Crítica";
    diagnostico = "Alta mortalidad registrada en el lote.";
    accion = "Aislamiento inmediato e intervención veterinaria urgente.";
  } else if (lote.mortalidad > 0 || incidencias.length > 0) {
    statusColor = "#F39C12"; // Amarillo
    statusTitle = "Observación";
    diagnostico =
      "Se han registrado bajas históricas o tratamientos recientes.";
    accion =
      "Revisar calidad de agua, temperatura del galpón y comportamiento.";
  }

  return (
    <View style={[styles.card, { borderColor: statusColor, borderWidth: 1.5 }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={styles.cardTitle}>{lote.nombre || lote.codigo}</Text>
        </View>
        <View style={styles.pigCountBadge}>
          <Text style={styles.pigCountText}>{lote.cantidadActual} cerdos</Text>
        </View>
      </View>

      <Text style={styles.diagnosisText}>
        <Text style={{ fontWeight: "bold", color: "#2C3E50" }}>
          Diagnóstico:{" "}
        </Text>
        {diagnostico}
      </Text>
      <Text style={styles.diagnosisText}>
        <Text style={{ fontWeight: "bold", color: "#2C3E50" }}>
          Acción sugerida:{" "}
        </Text>
        {accion}
      </Text>

      {/* Historial Médico */}
      {!loading && incidencias.length > 0 && (
        <View style={styles.historySection}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              marginBottom: 5,
            }}
          >
            <Text>💊</Text>
            <Text style={{ fontSize: 12, color: "#2C3E50" }}>
              {incidencias.length} Tratados
            </Text>
          </View>

          <TouchableOpacity
            style={styles.toggleHistoryBtn}
            onPress={() => setShowHistory(!showHistory)}
          >
            <Ionicons
              name={showHistory ? "arrow-up" : "arrow-down"}
              size={12}
              color="#FFF"
            />
            <Text style={styles.toggleHistoryText}>
              {showHistory
                ? "Ocultar historial médico"
                : "Ver línea de tiempo médica"}
            </Text>
          </TouchableOpacity>

          {showHistory && (
            <View style={styles.historyList}>
              {incidencias.map((inc) => (
                <View key={inc.id} style={styles.historyItem}>
                  <Text style={styles.historyDate}>
                    {new Date(inc.fecha).toISOString().split("T")[0]}
                  </Text>
                  <Text style={styles.historyActionTitle}>
                    {inc.tipoAccion}
                  </Text>
                  {inc.notas ? (
                    <Text style={styles.historyNotes}>{inc.notas}</Text>
                  ) : null}

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                      marginTop: 5,
                    }}
                  >
                    <Text>💊</Text>
                    <Text style={styles.historyMeds}>
                      {inc.medicamento || "Sin medicamento"}
                    </Text>
                  </View>

                  <View style={styles.historyActionsRow}>
                    <TouchableOpacity
                      style={styles.historyEditBtn}
                      onPress={() => onOpenForm(lote, inc)}
                    >
                      <Ionicons name="pencil" size={12} color="#F39C12" />
                      <Text style={styles.historyEditTxt}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.historyDelBtn}
                      onPress={() => onOpenDelete(lote.id, inc.id)}
                    >
                      <Ionicons name="trash" size={12} color="#E74C3C" />
                      <Text style={styles.historyDelTxt}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <TouchableOpacity
        style={styles.addIncidentBtn}
        onPress={() => onOpenForm(lote, null)}
      >
        <Ionicons name="medkit" size={14} color="#FFF" />
        <Text style={styles.addIncidentText}>Registrar Incidencia Médica</Text>
      </TouchableOpacity>
    </View>
  );
};

// =========================================================================
// PANTALLA PRINCIPAL
// =========================================================================
export default function SemaforoScreen() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lotes, setLotes] = useState([]);

  // Estados del Formulario (Crear/Editar)
  const [modalFormVisible, setModalFormVisible] = useState(false);
  const [formMode, setFormMode] = useState("CREATE"); // "CREATE" | "EDIT"
  const [selectedLote, setSelectedLote] = useState(null);
  const [editIncId, setEditIncId] = useState(null);

  const [tipoAccion, setTipoAccion] = useState("Iniciar Tratamiento Médico");
  const [medicamento, setMedicamento] = useState("");
  const [notas, setNotas] = useState("");

  // Modal Custom Dropdown
  const [modalDropdown, setModalDropdown] = useState(false);
  const opcionesAccion = [
    "Iniciar Tratamiento Médico",
    "Descartar (Falsa Alarma)",
    "Aislamiento de Cerdos",
  ];

  // Modal Custom Delete (El que reemplaza la alerta de Localhost)
  const [modalDelete, setModalDelete] = useState(false);
  const [deleteData, setDeleteData] = useState({ loteId: null, incId: null });

  // =========================================================================
  // CARGA DE LOTES
  // =========================================================================
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const qLotes = query(
      collection(db, "lotes"),
      where("fincaId", "==", user.uid),
      where("estado", "==", "ACTIVO"),
    );
    const unsub = onSnapshot(qLotes, (snap) => {
      const data = [];
      snap.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      setLotes(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // =========================================================================
  // CONTROLADORES DE MODALES
  // =========================================================================
  const openForm = (lote, incidencia) => {
    setSelectedLote(lote);
    if (incidencia) {
      setFormMode("EDIT");
      setEditIncId(incidencia.id);
      setTipoAccion(incidencia.tipoAccion);
      setMedicamento(incidencia.medicamento);
      setNotas(incidencia.notas);
    } else {
      setFormMode("CREATE");
      setEditIncId(null);
      setTipoAccion("Iniciar Tratamiento Médico");
      setMedicamento("");
      setNotas("");
    }
    setModalFormVisible(true);
  };

  const openDeleteConfirm = (loteId, incId) => {
    setDeleteData({ loteId, incId });
    setModalDelete(true);
  };

  // =========================================================================
  // OPERACIONES CRUD
  // =========================================================================
  const handleSaveIncidencia = async () => {
    if (!tipoAccion) {
      alert("Selecciona un tipo de acción.");
      return;
    }

    try {
      if (formMode === "CREATE") {
        await addDoc(collection(db, "lotes", selectedLote.id, "incidencias"), {
          fecha: new Date().toISOString(),
          tipoAccion,
          medicamento,
          notas,
        });
      } else {
        await updateDoc(
          doc(db, "lotes", selectedLote.id, "incidencias", editIncId),
          {
            tipoAccion,
            medicamento,
            notas,
          },
        );
      }
      setModalFormVisible(false);
    } catch (error) {
      console.error("Error al guardar incidencia", error);
    }
  };

  const confirmarEliminacion = async () => {
    try {
      await deleteDoc(
        doc(db, "lotes", deleteData.loteId, "incidencias", deleteData.incId),
      );
      setModalDelete(false);
    } catch (error) {
      console.error("Error al eliminar", error);
    }
  };

  return (
    <View style={styles.mainContainer}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setMenuVisible(true)}
        >
          <Ionicons name="menu" size={28} color="#27AE60" />
        </TouchableOpacity>
        <Text style={styles.headerLogo}>NutriPorc</Text>
        <View style={{ width: 28 }} />
      </View>

      <SidebarMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        currentRoute="/semaforo"
      />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Semáforo Epidemiológico 🚨</Text>
          <Text style={styles.pageSubtitle}>
            Control de incidencias biológicas y monitoreo sanitario automático.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#27AE60"
            style={{ marginTop: 50 }}
          />
        ) : (
          <View style={styles.cardsGrid}>
            {lotes.map((lote) => (
              <LoteCard
                key={lote.id}
                lote={lote}
                onOpenForm={openForm}
                onOpenDelete={openDeleteConfirm}
              />
            ))}
            {lotes.length === 0 && (
              <Text
                style={{ textAlign: "center", color: "#7F8C8D", marginTop: 20 }}
              >
                No hay lotes activos para monitorear.
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL 1: FORMULARIO CREAR/EDITAR INCIDENCIA */}
      {/* ========================================================================= */}
      <Modal visible={modalFormVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlayDark}>
          <View style={styles.modalBox}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                marginBottom: 20,
              }}
            >
              <Ionicons
                name={formMode === "CREATE" ? "medkit" : "pencil"}
                size={24}
                color="#0F172A"
              />
              <Text style={styles.modalTitle}>
                {formMode === "CREATE"
                  ? `Registrar Incidencia: ${selectedLote?.nombre || selectedLote?.codigo}`
                  : "Editar Incidencia Médica"}
              </Text>
            </View>

            <Text style={styles.inputLabel}>Tipo de Acción</Text>
            <TouchableOpacity
              style={styles.dropdownInput}
              onPress={() => setModalDropdown(true)}
            >
              <Text style={styles.dropdownInputText}>{tipoAccion}</Text>
              <Ionicons name="chevron-down" size={16} color="#0F172A" />
            </TouchableOpacity>

            <Text style={styles.inputLabel}>
              Medicamento Aplicado (Opcional)
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ej. Enrofloxacina, Penicilina..."
              value={medicamento}
              onChangeText={setMedicamento}
            />

            <Text style={styles.inputLabel}>
              Notas / Diagnóstico del Productor
            </Text>
            <TextInput
              style={[
                styles.textInput,
                { height: 80, textAlignVertical: "top" },
              ]}
              placeholder="Describe los síntomas observados..."
              value={notas}
              onChangeText={setNotas}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalFormVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveIncidencia}
              >
                <Text style={styles.saveBtnText}>
                  {formMode === "CREATE"
                    ? "Guardar en Historial"
                    : "Actualizar Registro"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: CUSTOM DROPDOWN PARA EL FORMULARIO */}
      {/* ========================================================================= */}
      <Modal visible={modalDropdown} animationType="fade" transparent={true}>
        <View style={styles.modalOverlayDark}>
          <View style={[styles.modalBox, { padding: 10 }]}>
            {opcionesAccion.map((op) => (
              <TouchableOpacity
                key={op}
                style={[
                  styles.dropdownOptionBtn,
                  tipoAccion === op && styles.dropdownOptionBtnActive,
                ]}
                onPress={() => {
                  setTipoAccion(op);
                  setModalDropdown(false);
                }}
              >
                <Text
                  style={[
                    styles.dropdownOptionText,
                    tipoAccion === op && styles.dropdownOptionTextActive,
                  ]}
                >
                  {op}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: CONFIRMACIÓN DE ELIMINACIÓN (REEMPLAZA ALERTA DE NAVEGADOR)      */}
      {/* ========================================================================= */}
      <Modal visible={modalDelete} animationType="fade" transparent={true}>
        <View style={styles.modalOverlayDark}>
          <View style={styles.customAlertBox}>
            <View style={styles.alertIconCircle}>
              <Ionicons name="trash-bin" size={32} color="#E74C3C" />
            </View>
            <Text style={styles.alertTitle}>¿Eliminar Registro?</Text>
            <Text style={styles.alertDesc}>
              Estás a punto de borrar este registro médico del historial. Esta
              acción no se puede deshacer.
            </Text>

            <View style={styles.alertButtonsRow}>
              <TouchableOpacity
                style={styles.alertCancelBtn}
                onPress={() => setModalDelete(false)}
              >
                <Text style={styles.alertCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.alertConfirmBtn}
                onPress={confirmarEliminacion}
              >
                <Text style={styles.alertConfirmText}>Sí, Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#FAF9F6" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  menuButton: { padding: 5, backgroundColor: "#E8F6EF", borderRadius: 8 },
  headerLogo: { fontSize: 20, fontWeight: "900", color: "#8E2827" },
  container: { padding: 20, paddingBottom: 50 },

  titleSection: { marginBottom: 20 },
  pageTitle: { fontSize: 22, fontWeight: "bold", color: "#0F172A" },
  pageSubtitle: { fontSize: 13, color: "#64748B", marginTop: 5 },

  cardsGrid: { flexDirection: "column", gap: 15 },

  // Tarjetas de Semáforo
  card: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 10,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusDot: { width: 14, height: 14, borderRadius: 7 },
  cardTitle: { fontSize: 16, fontWeight: "bold", color: "#0F172A" },
  pigCountBadge: {
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  pigCountText: { fontSize: 11, fontWeight: "bold", color: "#0F172A" },

  diagnosisText: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 18,
    marginBottom: 8,
  },

  historySection: { marginTop: 10 },
  toggleHistoryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#34495E",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 10,
  },
  toggleHistoryText: { color: "#FFF", fontSize: 10 },

  historyList: {
    backgroundColor: "#FEF9E7",
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: "#FDEBD0",
    marginBottom: 15,
  },
  historyItem: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F5CBA7",
  },
  historyDate: {
    fontSize: 11,
    color: "#0F172A",
    fontWeight: "bold",
    marginBottom: 5,
  },
  historyActionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 5,
  },
  historyNotes: { fontSize: 12, color: "#334155", marginBottom: 5 },
  historyMeds: { fontSize: 12, color: "#0F172A", fontWeight: "bold" },

  historyActionsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  historyEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF0D9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#F5CBA7",
  },
  historyEditTxt: { fontSize: 10, color: "#D68910", fontWeight: "bold" },
  historyDelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FDEDEC",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FADBD8",
  },
  historyDelTxt: { fontSize: 10, color: "#C0392B", fontWeight: "bold" },

  addIncidentBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0F172A",
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  addIncidentText: { color: "#FFF", fontWeight: "bold", fontSize: 13 },

  // Formularios y Modales Genéricos
  modalOverlayDark: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalBox: {
    width: "100%",
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#0F172A" },
  inputLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#334155",
    marginBottom: 6,
    marginTop: 15,
  },
  dropdownInput: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 12,
  },
  dropdownInputText: { fontSize: 14, color: "#0F172A" },
  textInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#0F172A",
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 25,
  },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 15 },
  cancelBtnText: { color: "#64748B", fontWeight: "bold" },
  saveBtn: {
    backgroundColor: "#F1948A",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  saveBtnText: { color: "#FFF", fontWeight: "bold" },

  dropdownOptionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 6,
  },
  dropdownOptionBtnActive: { backgroundColor: "#EFF6FF" },
  dropdownOptionText: { fontSize: 14, color: "#334155" },
  dropdownOptionTextActive: { color: "#2563EB", fontWeight: "bold" },

  // Alerta de Eliminación Personalizada (Reemplazo de Localhost)
  customAlertBox: {
    width: "85%",
    maxWidth: 340,
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 25,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  alertIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FDEDEC",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 10,
  },
  alertDesc: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 20,
  },
  alertButtonsRow: { flexDirection: "row", width: "100%", gap: 10 },
  alertCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    alignItems: "center",
  },
  alertCancelText: { color: "#475569", fontWeight: "bold", fontSize: 14 },
  alertConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#E74C3C",
    borderRadius: 10,
    alignItems: "center",
  },
  alertConfirmText: { color: "#FFF", fontWeight: "bold", fontSize: 14 },
});
