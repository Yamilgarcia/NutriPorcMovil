import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
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

import { LineChart } from "react-native-chart-kit";

const screenWidth = Dimensions.get("window").width;

export default function MonitoreoScreen() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  // Estados de Datos
  const [lotes, setLotes] = useState([]);
  const [selectedLote, setSelectedLote] = useState(null);
  const [historialPesos, setHistorialPesos] = useState([]);

  // Estados del Formulario
  const [fechaPesaje, setFechaPesaje] = useState(
    new Date().toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
  );
  const [pesoPromedio, setPesoPromedio] = useState("");

  // Estados de Edición
  const [editingId, setEditingId] = useState(null);
  const [editPeso, setEditPeso] = useState("");

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const qLotes = query(
      collection(db, "lotes"),
      where("fincaId", "==", user.uid),
      where("estado", "==", "ACTIVO"),
    );
    const unsubLotes = onSnapshot(qLotes, (snap) => {
      const lData = [];
      snap.forEach((doc) => lData.push({ id: doc.id, ...doc.data() }));
      setLotes(lData);
      setLoading(false);
    });

    return () => unsubLotes();
  }, []);

  useEffect(() => {
    if (!selectedLote) {
      setHistorialPesos([]);
      return;
    }

    const qPesos = query(
      collection(db, "lotes", selectedLote.id, "historialPesos"),
      orderBy("fecha", "asc"),
    );
    const unsubPesos = onSnapshot(qPesos, (snap) => {
      const pData = [];
      snap.forEach((doc) => pData.push({ id: doc.id, ...doc.data() }));
      setHistorialPesos(pData);
    });

    return () => unsubPesos();
  }, [selectedLote]);

  // =========================================================================
  // FUNCIONES CRUD
  // =========================================================================
  const handleGuardarPeso = async () => {
    if (!selectedLote) {
      Alert.alert(
        "Incompleto",
        "Selecciona primero el corral que vas a monitorear.",
      );
      return;
    }
    if (!fechaPesaje || !pesoPromedio) {
      Alert.alert("Incompleto", "Ingresa la fecha y el peso promedio.");
      return;
    }

    try {
      await addDoc(collection(db, "lotes", selectedLote.id, "historialPesos"), {
        fecha: fechaPesaje,
        pesoPromedio: Number(pesoPromedio),
        origen: "MANUAL",
        timestamp: new Date().toISOString(),
      });
      setPesoPromedio("");
    } catch (error) {
      Alert.alert("Error", "No se pudo guardar el registro.");
    }
  };

  const handleActualizarPeso = async (id) => {
    if (!editPeso) {
      Alert.alert("Incompleto", "El peso no puede estar vacío.");
      return;
    }
    try {
      await updateDoc(doc(db, "lotes", selectedLote.id, "historialPesos", id), {
        pesoPromedio: Number(editPeso),
      });
      setEditingId(null);
    } catch (error) {
      Alert.alert("Error", "No se pudo actualizar.");
    }
  };

  const handleEliminarPeso = async (id) => {
    Alert.alert("Confirmar", "¿Estás seguro de eliminar este pesaje?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(
            doc(db, "lotes", selectedLote.id, "historialPesos", id),
          );
        },
      },
    ]);
  };

  const chartLabels =
    historialPesos.length > 0
      ? historialPesos.map((p) => p.fecha.substring(0, 5))
      : ["Sin datos"];
  const chartData =
    historialPesos.length > 0 ? historialPesos.map((p) => p.pesoPromedio) : [0];

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
        currentRoute="/monitoreo"
      />

      {/* =========================================================================
                                     CONTENIDO PRINCIPAL
      ========================================================================= */}
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Monitoreo de Crecimiento</Text>
          <Text style={styles.pageSubtitle}>
            Registra el peso promedio del corral y analiza su desarrollo frente
            a la curva esperada.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#27AE60"
            style={{ marginTop: 50 }}
          />
        ) : (
          <View style={styles.gridLayout}>
            <View style={styles.leftColumn}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>1. Corral a Monitorear</Text>
                <View style={styles.loteList}>
                  {lotes.map((lote) => (
                    <TouchableOpacity
                      key={lote.id}
                      style={[
                        styles.loteItem,
                        selectedLote?.id === lote.id && styles.loteItemActive,
                      ]}
                      onPress={() => setSelectedLote(lote)}
                    >
                      <Text
                        style={[
                          styles.loteItemText,
                          selectedLote?.id === lote.id &&
                            styles.loteItemTextActive,
                        ]}
                      >
                        {lote.codigo} - {lote.etapa} ({lote.cantidadActual}{" "}
                        cerdos)
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {lotes.length === 0 && (
                    <Text
                      style={{
                        color: "#7F8C8D",
                        fontSize: 13,
                        padding: 10,
                        textAlign: "center",
                      }}
                    >
                      No hay corrales activos en tu granja.
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>2. Nuevo Pesaje</Text>

                <Text style={styles.inputLabel}>Fecha de Muestreo:</Text>
                <View style={styles.inputIconWrapper}>
                  <TextInput
                    style={styles.inputField}
                    value={fechaPesaje}
                    onChangeText={(t) =>
                      setFechaPesaje(t.replace(/[^0-9/]/g, ""))
                    }
                  />
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color="#7F8C8D"
                    style={styles.inputIcon}
                  />
                </View>

                <Text style={styles.inputLabel}>Peso Promedio (lbs):</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="Ej. 45.5"
                  value={pesoPromedio}
                  onChangeText={(t) =>
                    setPesoPromedio(t.replace(/[^0-9.]/g, ""))
                  }
                  keyboardType="numeric"
                />

                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleGuardarPeso}
                >
                  <Ionicons name="save-outline" size={18} color="#FFF" />
                  <Text style={styles.saveBtnText}>Guardar Peso</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.rightColumn}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  Curva de Crecimiento del Lote
                </Text>
                {historialPesos.length < 2 ? (
                  <View style={styles.emptyChartBox}>
                    <Text style={styles.emptyChartText}>
                      Registra al menos 2 pesajes para visualizar la curva de
                      crecimiento.
                    </Text>
                  </View>
                ) : (
                  <View style={{ alignItems: "center", marginLeft: -20 }}>
                    <LineChart
                      data={{
                        labels: chartLabels,
                        datasets: [
                          {
                            data: chartData,
                            strokeWidth: 2,
                            color: (opacity = 1) =>
                              `rgba(16, 185, 129, ${opacity})`,
                          },
                        ],
                      }}
                      width={
                        screenWidth > 768 ? screenWidth / 2 : screenWidth - 80
                      }
                      height={250}
                      chartConfig={{
                        backgroundColor: "#FFF",
                        backgroundGradientFrom: "#FFF",
                        backgroundGradientTo: "#FFF",
                        decimalPlaces: 1,
                        color: (opacity = 1) =>
                          `rgba(189, 195, 199, ${opacity})`,
                        labelColor: (opacity = 1) =>
                          `rgba(100, 116, 139, ${opacity})`,
                        style: { borderRadius: 16 },
                        propsForDots: {
                          r: "5",
                          strokeWidth: "2",
                          stroke: "#10b981",
                          fill: "#FFF",
                        },
                      }}
                      bezier
                      style={{ marginVertical: 8, borderRadius: 16 }}
                    />
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        marginTop: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: "#10B981",
                          borderWidth: 2,
                          borderColor: "#10B981",
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          color: "#10B981",
                          fontWeight: "bold",
                        }}
                      >
                        Peso Real (lbs)
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Historial de Registros</Text>
                {!selectedLote ? (
                  <Text
                    style={{
                      textAlign: "center",
                      color: "#7F8C8D",
                      marginVertical: 20,
                    }}
                  >
                    Selecciona un corral para ver su historial.
                  </Text>
                ) : historialPesos.length === 0 ? (
                  <Text
                    style={{
                      textAlign: "center",
                      color: "#7F8C8D",
                      marginVertical: 20,
                    }}
                  >
                    No hay registros para este corral.
                  </Text>
                ) : (
                  historialPesos.map((item) => {
                    const isEditing = editingId === item.id;
                    return (
                      <View key={item.id} style={styles.historyRow}>
                        {isEditing ? (
                          <View style={styles.historyEditContainer}>
                            <TextInput
                              style={styles.historyEditInput}
                              value={editPeso}
                              onChangeText={(t) =>
                                setEditPeso(t.replace(/[^0-9.]/g, ""))
                              }
                              keyboardType="numeric"
                              autoFocus
                            />
                            <TouchableOpacity
                              style={styles.historyActionBtn}
                              onPress={() => handleActualizarPeso(item.id)}
                            >
                              <Ionicons name="save" size={16} color="#27AE60" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.historyActionBtn}
                              onPress={() => setEditingId(null)}
                            >
                              <Ionicons
                                name="close"
                                size={16}
                                color="#E74C3C"
                              />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <>
                            <View style={styles.historyInfo}>
                              <Text style={styles.historyWeight}>
                                {item.pesoPromedio} lbs
                              </Text>
                              <Ionicons
                                name="calendar-outline"
                                size={14}
                                color="#E74C3C"
                              />
                              <Text style={styles.historyDate}>
                                {item.fecha}
                              </Text>
                            </View>
                            <View style={styles.historyActions}>
                              <TouchableOpacity
                                style={styles.historyActionBtn}
                                onPress={() => {
                                  setEditingId(item.id);
                                  setEditPeso(item.pesoPromedio.toString());
                                }}
                              >
                                <Ionicons
                                  name="pencil"
                                  size={16}
                                  color="#F39C12"
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.historyActionBtn}
                                onPress={() => handleEliminarPeso(item.id)}
                              >
                                <Ionicons
                                  name="trash"
                                  size={16}
                                  color="#7F8C8D"
                                />
                              </TouchableOpacity>
                            </View>
                          </>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
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
  pageTitle: { fontSize: 24, fontWeight: "bold", color: "#0F172A" },
  pageSubtitle: { fontSize: 13, color: "#64748B", marginTop: 5 },

  gridLayout: { flexDirection: "column", gap: 20 },
  leftColumn: { gap: 20 },
  rightColumn: { gap: 20 },

  card: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 15,
  },

  loteList: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    maxHeight: 150,
  },
  loteItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: "#F8FAFC" },
  loteItemActive: { backgroundColor: "#F0FDF4" },
  loteItemText: { fontSize: 13, color: "#334155" },
  loteItemTextActive: { color: "#047857", fontWeight: "bold" },

  inputLabel: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "bold",
    marginBottom: 8,
    marginTop: 10,
  },
  inputIconWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    backgroundColor: "#FFF",
  },
  inputField: {
    flex: 1,
    padding: 12,
    fontSize: 14,
    color: "#0F172A",
    borderWidth: 0,
    borderRadius: 8,
  },
  inputIcon: { paddingRight: 10 },

  saveBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#85B695",
    padding: 15,
    borderRadius: 8,
    marginTop: 15,
    gap: 8,
  },
  saveBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },

  emptyChartBox: {
    height: 200,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyChartText: { color: "#64748B", fontSize: 13, textAlign: "center" },

  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  historyInfo: { flexDirection: "row", alignItems: "center", gap: 8 },
  historyWeight: { fontSize: 16, fontWeight: "900", color: "#0F172A" },
  historyDate: { fontSize: 13, color: "#64748B" },

  historyActions: { flexDirection: "row", gap: 5 },
  historyActionBtn: {
    padding: 6,
    backgroundColor: "#FFF",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  historyEditContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  historyEditInput: {
    flex: 1,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
});
