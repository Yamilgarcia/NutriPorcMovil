import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";
import SidebarMenu from "../components/SidebarMenu";
export default function LotesScreen() {
  const router = useRouter();

  // Estados Globales
  const [menuVisible, setMenuVisible] = useState(false);
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLote, setSelectedLote] = useState(null);

  // Estados de Visibilidad de Modales
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalEtapa, setModalEtapa] = useState(false);
  const [modalMortalidad, setModalMortalidad] = useState(false);
  const [modalPeso, setModalPeso] = useState(false);
  const [modalCerrar, setModalCerrar] = useState(false);

  // Estados de Formularios
  const [nombreLote, setNombreLote] = useState("");
  const [codigoLote, setCodigoLote] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [cantidadCerdos, setCantidadCerdos] = useState("");
  const [raza, setRaza] = useState("");
  const [etapa, setEtapa] = useState("Destete");

  const [fechaBaja, setFechaBaja] = useState("");
  const [cantidadBaja, setCantidadBaja] = useState("");
  const [causaBaja, setCausaBaja] = useState("");

  const [fechaPeso, setFechaPeso] = useState("");
  const [pesoPromedio, setPesoPromedio] = useState("");
  const [dieta, setDieta] = useState("");

  const [pesoFinal, setPesoFinal] = useState("");
  const [dietaFinal, setDietaFinal] = useState("");

  // =========================================================================
  // FUNCIONES DE VALIDACIÓN Y FORMATEO DE INPUTS
  // =========================================================================

  // Permite solo letras y espacios (ideal para Nombres y Razas)
  const formatSoloLetras = (text) => {
    return text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");
  };

  // Permite solo números (ideal para cantidades y pesos)
  const formatSoloNumeros = (text) => {
    return text.replace(/[^0-9]/g, "");
  };

  // Formatea automáticamente la fecha agregando las plecas DD/MM/YYYY
  const formatFecha = (text) => {
    let cleaned = text.replace(/\D/g, ""); // Solo deja los números
    if (cleaned.length > 2) {
      cleaned = cleaned.slice(0, 2) + "/" + cleaned.slice(2);
    }
    if (cleaned.length > 5) {
      cleaned = cleaned.slice(0, 5) + "/" + cleaned.slice(5, 9);
    }
    return cleaned;
  };

  // Validar que la fecha sea una fecha real en calendario (DD/MM/YYYY)
  const isValidDate = (dateString) => {
    const regEx = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateString.match(regEx)) return false;
    const [day, month, year] = dateString.split("/");
    const d = new Date(year, month - 1, day);
    return (
      d.getFullYear() == year && d.getMonth() == month - 1 && d.getDate() == day
    );
  };

  // =========================================================================

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      router.replace("/");
      return;
    }

    const q = query(
      collection(db, "lotes"),
      where("fincaId", "==", user.uid),
      where("estado", "==", "ACTIVO"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const lotesData = [];
        snapshot.forEach((doc) => {
          lotesData.push({ id: doc.id, ...doc.data() });
        });
        setLotes(lotesData);
        setLoading(false);
      },
      (error) => {
        Alert.alert("Error", "No se pudieron cargar los lotes.");
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const navigateTo = (route) => {
    setMenuVisible(false);
    if (route) router.replace(route);
  };

  const handleCrearLote = async () => {
    if (!nombreLote || !cantidadCerdos || !fechaInicio) {
      Alert.alert("Incompleto", "Llena los campos obligatorios.");
      return;
    }

    if (!isValidDate(fechaInicio)) {
      Alert.alert(
        "Fecha Inválida",
        "La fecha de inicio no es válida. Usa el formato DD/MM/AAAA.",
      );
      return;
    }

    try {
      const user = auth.currentUser;
      await addDoc(collection(db, "lotes"), {
        fincaId: user.uid,
        nombre: nombreLote,
        codigo: codigoLote || "S/N",
        fechaInicio,
        cantidadInicial: Number(cantidadCerdos),
        cantidadActual: Number(cantidadCerdos),
        raza: raza || "No especificada",
        etapa,
        estado: "ACTIVO",
        mortalidad: 0,
      });

      await updateDoc(doc(db, "fincas", user.uid), {
        cerdosActivos: increment(Number(cantidadCerdos)),
      });

      setModalNuevo(false);
      limpiarFormularios();
    } catch (error) {
      Alert.alert("Error", "No se pudo crear el lote.");
    }
  };

  const handleEditarLote = async () => {
    if (!nombreLote) {
      Alert.alert("Incompleto", "El nombre del lote no puede estar vacío.");
      return;
    }
    try {
      await updateDoc(doc(db, "lotes", selectedLote.id), {
        nombre: nombreLote,
        codigo: codigoLote,
      });
      setModalEditar(false);
    } catch (error) {
      Alert.alert("Error", "No se pudo actualizar.");
    }
  };

  const handleCambiarEtapa = async () => {
    try {
      await updateDoc(doc(db, "lotes", selectedLote.id), { etapa });
      setModalEtapa(false);
    } catch (error) {
      Alert.alert("Error", "No se pudo cambiar la etapa.");
    }
  };

  const handleReportarBaja = async () => {
    const bajas = Number(cantidadBaja);
    if (bajas <= 0 || bajas > selectedLote.cantidadActual) {
      Alert.alert("Error", "Cantidad inválida.");
      return;
    }
    if (!isValidDate(fechaBaja)) {
      Alert.alert("Fecha Inválida", "Ingresa una fecha correcta (DD/MM/AAAA).");
      return;
    }
    try {
      const user = auth.currentUser;
      const loteRef = doc(db, "lotes", selectedLote.id);

      await addDoc(collection(loteRef, "historialBajas"), {
        fecha: fechaBaja,
        cantidad: bajas,
        causa: causaBaja,
      });

      await updateDoc(loteRef, {
        cantidadActual: increment(-bajas),
        mortalidad: increment(bajas),
      });

      await updateDoc(doc(db, "fincas", user.uid), {
        cerdosActivos: increment(-bajas),
      });

      setModalMortalidad(false);
      limpiarFormularios();
    } catch (error) {
      Alert.alert("Error", "No se pudo registrar la baja.");
    }
  };

  const handleControlPeso = async () => {
    if (!pesoPromedio || !fechaPeso) {
      Alert.alert("Incompleto", "Ingresa la fecha y el peso promedio.");
      return;
    }
    if (!isValidDate(fechaPeso)) {
      Alert.alert("Fecha Inválida", "Ingresa una fecha correcta (DD/MM/AAAA).");
      return;
    }
    try {
      const loteRef = doc(db, "lotes", selectedLote.id);
      await addDoc(collection(loteRef, "historialPesos"), {
        fecha: fechaPeso,
        pesoPromedio: Number(pesoPromedio),
        dietaAplicada: dieta,
      });
      setModalPeso(false);
      limpiarFormularios();
      Alert.alert("Éxito", "Avance registrado.");
    } catch (error) {
      Alert.alert("Error", "No se pudo guardar el peso.");
    }
  };

  const handleCerrarLote = async () => {
    if (!pesoFinal) {
      Alert.alert("Incompleto", "Ingresa el peso final antes de cerrar.");
      return;
    }
    try {
      const user = auth.currentUser;

      await updateDoc(doc(db, "lotes", selectedLote.id), {
        estado: "CERRADO",
        fechaCierre: new Date().toISOString(),
        pesoFinalPromedio: Number(pesoFinal),
        dietaFinal,
      });

      await updateDoc(doc(db, "fincas", user.uid), {
        cerdosActivos: increment(-selectedLote.cantidadActual),
        lotesCerrados: increment(1),
      });

      setModalCerrar(false);
      limpiarFormularios();
    } catch (error) {
      Alert.alert("Error", "No se pudo cerrar el lote.");
    }
  };

  const limpiarFormularios = () => {
    setNombreLote("");
    setCodigoLote("");
    setFechaInicio("");
    setCantidadCerdos("");
    setRaza("");
    setCantidadBaja("");
    setCausaBaja("");
    setFechaBaja("");
    setPesoPromedio("");
    setDieta("");
    setFechaPeso("");
    setPesoFinal("");
    setDietaFinal("");
  };

  const abrirModalEditar = (lote) => {
    setSelectedLote(lote);
    setNombreLote(lote.nombre);
    setCodigoLote(lote.codigo);
    setModalEditar(true);
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
        <Text style={styles.headerLogo}>NutriPorc 🐷</Text>
        <View style={{ width: 28 }} />
      </View>

      <SidebarMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        currentRoute="/lotes"
      />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Gestión de Lotes</Text>
          <Text style={styles.pageSubtitle}>
            Control de etapas biológicas, inventario y mortalidad.
          </Text>
        </View>

        <View style={styles.filterBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar lote o código..."
          />
          <TouchableOpacity
            style={styles.newLotButton}
            onPress={() => setModalNuevo(true)}
          >
            <Text style={styles.newLotButtonText}>+ Nuevo Lote</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#27AE60"
            style={{ marginTop: 50 }}
          />
        ) : lotes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="file-tray-outline" size={60} color="#BDC3C7" />
            <Text style={styles.emptyStateTitle}>Sin lotes activos</Text>
            <Text style={styles.emptyStateDesc}>
              Aún no tienes registros. Presiona el botón "+ Nuevo Lote" para
              comenzar.
            </Text>
          </View>
        ) : (
          lotes.map((lote) => (
            <View key={lote.id} style={styles.lotCard}>
              <View style={styles.lotHeader}>
                <Text style={styles.lotName}>{lote.nombre}</Text>
                <View style={styles.lotBadges}>
                  <Text style={styles.lotCode}>Cód: {lote.codigo}</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{lote.estado}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.lotDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Población:</Text>
                  <Text style={styles.detailValue}>
                    {lote.cantidadActual} cerdos
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Etapa:</Text>
                  <Text style={styles.detailValueHighlight}>{lote.etapa}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Inicio:</Text>
                  <Text style={styles.detailValue}>{lote.fechaInicio}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Mortalidad:</Text>
                  <Text style={styles.detailValueDanger}>
                    {lote.mortalidad}
                  </Text>
                </View>
              </View>

              <View style={styles.lotActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => abrirModalEditar(lote)}
                >
                  <Ionicons name="pencil" size={14} color="#7F8C8D" />
                  <Text style={styles.actionBtnText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    setSelectedLote(lote);
                    setEtapa(lote.etapa);
                    setModalEtapa(true);
                  }}
                >
                  <Text style={styles.actionBtnText}>Cambiar Etapa</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    setSelectedLote(lote);
                    setModalMortalidad(true);
                  }}
                >
                  <Text style={styles.actionBtnText}>Reportar Baja</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    setSelectedLote(lote);
                    setModalPeso(true);
                  }}
                >
                  <Text style={styles.actionBtnText}>Control Peso</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.closeLotBtn}
                onPress={() => {
                  setSelectedLote(lote);
                  setModalCerrar(true);
                }}
              >
                <Text style={styles.closeLotBtnText}>Cerrar Lote</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* =========================================================================
                                 MODALES DE GESTIÓN
      ========================================================================= */}

      <Modal visible={modalNuevo} animationType="slide" transparent={true}>
        <View style={styles.modalCenter}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Registrar Nuevo Lote</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Nombre del Lote</Text>
              <TextInput
                style={styles.modalInput}
                value={nombreLote}
                onChangeText={(t) => setNombreLote(formatSoloLetras(t))}
                placeholder="Ej. Cerdos Premium"
              />
              <Text style={styles.inputLabel}>Código Interno</Text>
              <TextInput
                style={styles.modalInput}
                value={codigoLote}
                onChangeText={setCodigoLote}
                placeholder="Ej. 981"
              />
              <Text style={styles.inputLabel}>
                Fecha de Inicio (DD/MM/AAAA)
              </Text>
              <TextInput
                style={styles.modalInput}
                value={fechaInicio}
                onChangeText={(t) => setFechaInicio(formatFecha(t))}
                keyboardType="numeric"
                maxLength={10}
                placeholder="Ej: 11/08/2026"
              />
              <Text style={styles.inputLabel}>Cantidad de Cerdos</Text>
              <TextInput
                style={styles.modalInput}
                value={cantidadCerdos}
                onChangeText={(t) => setCantidadCerdos(formatSoloNumeros(t))}
                keyboardType="numeric"
                placeholder="Ej. 50"
              />
              <Text style={styles.inputLabel}>Raza (Opcional)</Text>
              <TextInput
                style={styles.modalInput}
                value={raza}
                onChangeText={(t) => setRaza(formatSoloLetras(t))}
                placeholder="Ej. Landrace"
              />

              <Text style={styles.inputLabel}>Etapa Biológica Inicial</Text>
              <View style={styles.etapaGrid}>
                {[
                  "Destete",
                  "Desarrollo",
                  "Engorde",
                  "Reproducción",
                  "Gestación",
                  "Lactancia",
                ].map((e) => (
                  <TouchableOpacity
                    key={e}
                    style={[
                      styles.etapaChip,
                      etapa === e && styles.etapaChipActive,
                    ]}
                    onPress={() => setEtapa(e)}
                  >
                    <Text
                      style={[
                        styles.etapaChipText,
                        etapa === e && styles.etapaChipTextActive,
                      ]}
                    >
                      {e}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalNuevo(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleCrearLote}
              >
                <Text style={styles.saveBtnText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalEditar} animationType="fade" transparent={true}>
        <View style={styles.modalCenter}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              Editar Info: {selectedLote?.nombre}
            </Text>
            <Text style={styles.inputLabel}>Nombre del Lote</Text>
            <TextInput
              style={styles.modalInput}
              value={nombreLote}
              onChangeText={(t) => setNombreLote(formatSoloLetras(t))}
            />
            <Text style={styles.inputLabel}>Código Interno</Text>
            <TextInput
              style={styles.modalInput}
              value={codigoLote}
              onChangeText={setCodigoLote}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalEditar(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleEditarLote}
              >
                <Text style={styles.saveBtnText}>Actualizar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalEtapa} animationType="fade" transparent={true}>
        <View style={styles.modalCenter}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              Cambiar Etapa: {selectedLote?.nombre}
            </Text>
            <Text style={styles.inputLabel}>Nueva Etapa Biológica</Text>
            <View style={styles.etapaGrid}>
              {[
                "Destete",
                "Desarrollo",
                "Engorde",
                "Reproducción",
                "Gestación",
                "Lactancia",
              ].map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[
                    styles.etapaChip,
                    etapa === e && styles.etapaChipActive,
                  ]}
                  onPress={() => setEtapa(e)}
                >
                  <Text
                    style={[
                      styles.etapaChipText,
                      etapa === e && styles.etapaChipTextActive,
                    ]}
                  >
                    {e}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalEtapa(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleCambiarEtapa}
              >
                <Text style={styles.saveBtnText}>Actualizar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalMortalidad} animationType="fade" transparent={true}>
        <View style={styles.modalCenter}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Reportar Mortalidad</Text>
            <Text style={{ color: "#7F8C8D", marginBottom: 15, fontSize: 12 }}>
              Población actual: {selectedLote?.cantidadActual} cerdos
            </Text>
            <Text style={styles.inputLabel}>Fecha de Baja (DD/MM/AAAA)</Text>
            <TextInput
              style={styles.modalInput}
              value={fechaBaja}
              onChangeText={(t) => setFechaBaja(formatFecha(t))}
              keyboardType="numeric"
              maxLength={10}
              placeholder="Ej. 11/08/2026"
            />
            <Text style={styles.inputLabel}>Cantidad (Cerdos fallecidos)</Text>
            <TextInput
              style={styles.modalInput}
              value={cantidadBaja}
              onChangeText={(t) => setCantidadBaja(formatSoloNumeros(t))}
              keyboardType="numeric"
            />
            <Text style={styles.inputLabel}>Causa</Text>
            <TextInput
              style={styles.modalInput}
              value={causaBaja}
              onChangeText={setCausaBaja}
              placeholder="Ej. Neumonía..."
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalMortalidad(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: "#E74C3C" }]}
                onPress={handleReportarBaja}
              >
                <Text style={styles.saveBtnText}>Registrar Baja</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalPeso} animationType="fade" transparent={true}>
        <View style={styles.modalCenter}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Control de Peso</Text>
            <Text style={styles.inputLabel}>Fecha de Pesaje</Text>
            <TextInput
              style={styles.modalInput}
              value={fechaPeso}
              onChangeText={(t) => setFechaPeso(formatFecha(t))}
              keyboardType="numeric"
              maxLength={10}
              placeholder="Ej. 11/08/2026"
            />
            <Text style={styles.inputLabel}>Peso Promedio Actual (kg)</Text>
            <TextInput
              style={styles.modalInput}
              value={pesoPromedio}
              onChangeText={(t) => setPesoPromedio(formatSoloNumeros(t))}
              keyboardType="numeric"
              placeholder="Ej: 50"
            />
            <Text style={styles.inputLabel}>Dieta Aplicada</Text>
            <TextInput
              style={styles.modalInput}
              value={dieta}
              onChangeText={setDieta}
              placeholder="Ej: Desarrollo Fase 1"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalPeso(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleControlPeso}
              >
                <Text style={styles.saveBtnText}>Registrar Avance</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalCerrar} animationType="slide" transparent={true}>
        <View style={styles.modalCenter}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              Cerrar Lote: {selectedLote?.nombre}
            </Text>
            <Text style={{ color: "#7F8C8D", marginBottom: 15, fontSize: 12 }}>
              Para enviar este lote al historial, ingresa los datos finales de
              rendimiento.
            </Text>
            <Text style={styles.inputLabel}>Peso Promedio Final (kg)</Text>
            <TextInput
              style={styles.modalInput}
              value={pesoFinal}
              onChangeText={(t) => setPesoFinal(formatSoloNumeros(t))}
              keyboardType="numeric"
              placeholder="Ej: 110"
            />
            <Text style={styles.inputLabel}>Nombre de Dieta Principal</Text>
            <TextInput
              style={styles.modalInput}
              value={dietaFinal}
              onChangeText={setDietaFinal}
              placeholder="Ej: Engorde Máximo"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalCerrar(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: "#E74C3C" }]}
                onPress={handleCerrarLote}
              >
                <Text style={styles.saveBtnText}>Archivar y Cerrar</Text>
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

  modalOverlay: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalCloseArea: { flex: 1 },
  drawer: {
    width: "80%",
    backgroundColor: "#FFF",
    padding: 20,
    paddingTop: 50,
    justifyContent: "space-between",
  },
  drawerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#ECF0F1",
    paddingBottom: 15,
    marginBottom: 10,
  },
  drawerTitle: { fontSize: 20, fontWeight: "bold", color: "#2C3E50" },
  drawerItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  drawerItemActive: {
    backgroundColor: "#E8F6EF",
    borderRadius: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 0,
  },
  drawerItemText: { fontSize: 16, color: "#7F8C8D" },
  drawerItemTextActive: { color: "#27AE60", fontWeight: "bold" },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderWidth: 1,
    borderColor: "#F5B7B1",
    borderRadius: 8,
    gap: 10,
    marginTop: 10,
  },
  logoutText: { color: "#E74C3C", fontWeight: "bold" },

  container: { padding: 20, paddingBottom: 50 },
  titleSection: { marginBottom: 20 },
  pageTitle: { fontSize: 24, fontWeight: "bold", color: "#2C3E50" },
  pageSubtitle: { fontSize: 12, color: "#7F8C8D", marginTop: 5 },

  filterBar: {
    backgroundColor: "#94C0A2",
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  searchInput: {
    backgroundColor: "#FFF",
    padding: 10,
    borderRadius: 8,
    fontSize: 14,
  },
  newLotButton: {
    backgroundColor: "#F1948A",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  newLotButtonText: { color: "#FFF", fontWeight: "bold" },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ECF0F1",
    borderStyle: "dashed",
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#7F8C8D",
    marginTop: 15,
  },
  emptyStateDesc: {
    fontSize: 13,
    color: "#95a5a6",
    textAlign: "center",
    marginTop: 10,
    paddingHorizontal: 30,
  },

  lotCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    marginBottom: 15,
  },
  lotHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  lotName: { fontSize: 18, fontWeight: "bold", color: "#2C3E50" },
  lotBadges: { flexDirection: "row", alignItems: "center", gap: 10 },
  lotCode: { fontSize: 12, color: "#7F8C8D" },
  statusBadge: {
    backgroundColor: "#E8F6EF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { color: "#27AE60", fontSize: 10, fontWeight: "bold" },
  lotDetails: { marginBottom: 15 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  detailLabel: { fontSize: 13, color: "#7F8C8D" },
  detailValue: { fontSize: 13, color: "#2C3E50", fontWeight: "600" },
  detailValueHighlight: { fontSize: 13, color: "#F1948A", fontWeight: "bold" },
  detailValueDanger: { fontSize: 13, color: "#E74C3C", fontWeight: "bold" },
  lotActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
    flexWrap: "wrap",
    gap: 5,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderWidth: 1,
    borderColor: "#ECF0F1",
    borderRadius: 8,
    alignItems: "center",
    flex: 1,
    minWidth: "22%",
  },
  actionBtnText: {
    fontSize: 10,
    color: "#7F8C8D",
    marginTop: 2,
    textAlign: "center",
  },
  closeLotBtn: {
    borderWidth: 1,
    borderColor: "#ECF0F1",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  closeLotBtnText: { color: "#7F8C8D", fontWeight: "600", fontSize: 12 },

  modalCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 20,
  },
  modalBox: {
    width: "100%",
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 20,
    maxHeight: "90%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 12,
    color: "#7F8C8D",
    marginBottom: 5,
    fontWeight: "bold",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#DFE6E9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    color: "#2C3E50",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 10,
  },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8 },
  cancelBtnText: { color: "#7F8C8D", fontWeight: "bold" },
  saveBtn: {
    backgroundColor: "#F1948A",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  saveBtnText: { color: "#FFF", fontWeight: "bold" },

  etapaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 15,
  },
  etapaChip: {
    borderWidth: 1,
    borderColor: "#DFE6E9",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  etapaChipActive: { backgroundColor: "#3498DB", borderColor: "#3498DB" },
  etapaChipText: { color: "#7F8C8D", fontSize: 12 },
  etapaChipTextActive: { color: "#FFF", fontWeight: "bold" },
});
