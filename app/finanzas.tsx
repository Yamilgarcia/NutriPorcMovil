import { useState, useEffect, useMemo } from "react";
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
  limit,
} from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";
import SidebarMenu from "../components/SidebarMenu";

export default function FinanzasScreen() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  // Pestañas (Tabs)
  const [activeTab, setActiveTab] = useState("ACTUAL");

  // Datos
  const [lotesActivos, setLotesActivos] = useState([]);
  const [lotesCerrados, setLotesCerrados] = useState([]);
  const [selectedLote, setSelectedLote] = useState(null);
  const [modalLotes, setModalLotes] = useState(false);

  const [ultimoPesaje, setUltimoPesaje] = useState(null);
  const [transacciones, setTransacciones] = useState([]);

  // Formulario Transacción
  const [txTipo, setTxTipo] = useState("GASTO"); // "GASTO" | "INGRESO"
  const [txCategoria, setTxCategoria] = useState("Alimento");
  const [modalCategoria, setModalCategoria] = useState(false);
  const [txConcepto, setTxConcepto] = useState("");
  const [txMonto, setTxMonto] = useState("");

  // Edición en línea
  const [editingTxId, setEditingTxId] = useState(null);
  const [editTxConcepto, setEditTxConcepto] = useState("");
  const [editTxMonto, setEditTxMonto] = useState("");

  // Cierre de Lote
  const [ingresoFinalVenta, setIngresoFinalVenta] = useState("");
  const [showBalanceCierre, setShowBalanceCierre] = useState(false);

  // =========================================================================
  // CARGA DE DATOS
  // =========================================================================
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const qLotes = query(
      collection(db, "lotes"),
      where("fincaId", "==", user.uid),
    );
    const unsubLotes = onSnapshot(qLotes, (snap) => {
      const activos = [];
      const cerrados = [];
      snap.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        if (data.estado === "ACTIVO") activos.push(data);
        else cerrados.push(data);
      });
      setLotesActivos(activos);
      setLotesCerrados(cerrados);
      setLoading(false);
    });

    return () => unsubLotes();
  }, []);

  useEffect(() => {
    if (!selectedLote) {
      setTransacciones([]);
      setUltimoPesaje(null);
      return;
    }

    const qTx = query(
      collection(db, "lotes", selectedLote.id, "transacciones"),
      orderBy("timestamp", "desc"),
    );
    const unsubTx = onSnapshot(qTx, (snap) => {
      const txData = [];
      snap.forEach((doc) => txData.push({ id: doc.id, ...doc.data() }));
      setTransacciones(txData);
    });

    const qPesos = query(
      collection(db, "lotes", selectedLote.id, "historialPesos"),
      orderBy("fecha", "desc"),
      limit(1),
    );
    const unsubPesos = onSnapshot(qPesos, (snap) => {
      if (!snap.empty)
        setUltimoPesaje({ id: snap.docs[0].id, ...snap.docs[0].data() });
      else setUltimoPesaje(null);
    });

    return () => {
      unsubTx();
      unsubPesos();
    };
  }, [selectedLote]);

  // =========================================================================
  // CÁLCULOS FINANCIEROS
  // =========================================================================
  const finanzas = useMemo(() => {
    let totalGastos = 0;
    let totalVentasParciales = 0;

    transacciones.forEach((tx) => {
      if (tx.tipo === "GASTO") totalGastos += tx.monto;
      if (tx.tipo === "INGRESO") totalVentasParciales += tx.monto;
    });

    const pesoCerdo = ultimoPesaje ? ultimoPesaje.pesoPromedio : 0;
    const cantidadCerdos = selectedLote ? selectedLote.cantidadActual : 0;
    const biomasaLbs = pesoCerdo * cantidadCerdos;

    const costoPorLibra = biomasaLbs > 0 ? totalGastos / biomasaLbs : 0;

    return {
      totalGastos,
      totalVentasParciales,
      biomasaLbs,
      pesoCerdo,
      costoPorLibra,
    };
  }, [transacciones, ultimoPesaje, selectedLote]);

  // =========================================================================
  // OPERACIONES CRUD
  // =========================================================================
  const formatDecimal = (text) => text.replace(/[^0-9.]/g, "");

  const handleGuardarTransaccion = async () => {
    if (!selectedLote) {
      alert("Selecciona un lote.");
      return;
    }
    if (!txConcepto || !txMonto) {
      alert("Ingresa el concepto y el monto.");
      return;
    }

    try {
      await addDoc(collection(db, "lotes", selectedLote.id, "transacciones"), {
        fecha: new Date().toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
        tipo: txTipo,
        categoria: txCategoria,
        concepto: txConcepto,
        monto: Number(txMonto),
        timestamp: new Date().toISOString(),
      });
      setTxConcepto("");
      setTxMonto("");
    } catch (error) {
      console.error("Error al guardar la transacción", error);
    }
  };

  const handleActualizarTransaccion = async (id) => {
    if (!editTxMonto) return;
    try {
      await updateDoc(doc(db, "lotes", selectedLote.id, "transacciones", id), {
        concepto: editTxConcepto,
        monto: Number(editTxMonto),
      });
      setEditingTxId(null);
    } catch (error) {
      console.error("Error al actualizar", error);
    }
  };

  const handleEliminarTransaccion = async (id) => {
    try {
      await deleteDoc(doc(db, "lotes", selectedLote.id, "transacciones", id));
    } catch (error) {
      console.error("Error al anular la transacción", error);
    }
  };

  const handleArchivarLote = async () => {
    const vFinal = Number(ingresoFinalVenta) || 0;
    const gananciaNeta =
      vFinal + finanzas.totalVentasParciales - finanzas.totalGastos;

    try {
      await updateDoc(doc(db, "lotes", selectedLote.id), {
        estado: "CERRADO",
        fechaCierre: new Date().toISOString(),
        finanzasCierre: {
          gastosTotales: finanzas.totalGastos,
          ventasParciales: finanzas.totalVentasParciales,
          ventaFinal: vFinal,
          gananciaNeta: gananciaNeta,
        },
      });
      setSelectedLote(null);
      setShowBalanceCierre(false);
      setIngresoFinalVenta("");
      setActiveTab("HISTORIAL");
    } catch (error) {
      console.error("Error al cerrar el lote", error);
    }
  };

  const kpisHistorial = useMemo(() => {
    let ganancia = 0;
    let invertido = 0;
    let vendidos = 0;
    lotesCerrados.forEach((l) => {
      ganancia += l.finanzasCierre?.gananciaNeta || 0;
      invertido += l.finanzasCierre?.gastosTotales || 0;
      vendidos += l.cantidadInicial || 0;
    });
    return { ganancia, invertido, vendidos };
  }, [lotesCerrados]);

  const categoriasTransaccion =
    txTipo === "GASTO"
      ? [
          "Alimento",
          "Vacunas/Medicinas",
          "Mano de Obra",
          "Transporte",
          "Insumos",
          "Otros",
        ]
      : [
          "Venta de Cerdo (Parcial)",
          "Venta de Subproducto",
          "Ajuste a favor",
          "Otros",
        ];

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
        currentRoute="/finanzas"
      />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Libro Mayor y Rentabilidad</Text>
          <Text style={styles.pageSubtitle}>
            Controla tu inversión y analiza tus reportes de ganancias.
          </Text>
        </View>

        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "ACTUAL" && styles.tabBtnActive,
            ]}
            onPress={() => setActiveTab("ACTUAL")}
          >
            <Ionicons
              name="wallet-outline"
              size={16}
              color={activeTab === "ACTUAL" ? "#8E2827" : "#7F8C8D"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "ACTUAL" && styles.tabTextActive,
              ]}
            >
              Operación Actual
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "HISTORIAL" && styles.tabBtnActive,
            ]}
            onPress={() => setActiveTab("HISTORIAL")}
          >
            <Ionicons
              name="bar-chart-outline"
              size={16}
              color={activeTab === "HISTORIAL" ? "#8E2827" : "#7F8C8D"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "HISTORIAL" && styles.tabTextActive,
              ]}
            >
              Historial y Reportes
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#27AE60" />
        ) : activeTab === "ACTUAL" ? (
          <>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                marginBottom: 20,
              }}
            >
              <TouchableOpacity
                style={styles.dropdownBtn}
                onPress={() => setModalLotes(true)}
              >
                <Text
                  style={
                    selectedLote
                      ? styles.dropdownText
                      : styles.dropdownTextPlaceholder
                  }
                >
                  {selectedLote
                    ? `${selectedLote.nombre || selectedLote.codigo} (${selectedLote.cantidadActual} cerdos)`
                    : "Seleccionar Lote Activo"}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#7F8C8D" />
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 20 }}
            >
              <View style={[styles.kpiCard, { borderLeftColor: "#F5B7B1" }]}>
                <Text style={styles.kpiLabel}>Estado de Biomasa Real</Text>
                <Text style={styles.kpiValueMain}>
                  Peso Actual: {finanzas.pesoCerdo} lbs{" "}
                  <Text style={{ fontSize: 12, fontWeight: "normal" }}>
                    / cerdo
                  </Text>
                </Text>
                <Text style={styles.kpiSubText}>
                  Masa estimada: {finanzas.biomasaLbs.toFixed(0)} lbs en corral.
                </Text>
                <View style={styles.kpiBadge}>
                  <Text style={styles.kpiBadgeText}>
                    Sincronizado con Monitoreo
                  </Text>
                </View>
              </View>

              <View style={[styles.kpiCard, { borderLeftColor: "#E74C3C" }]}>
                <Text style={styles.kpiLabel}>Inversión Total (Gastos)</Text>
                <Text style={styles.kpiValueBig}>
                  C${" "}
                  {finanzas.totalGastos.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </Text>
                {finanzas.totalVentasParciales > 0 && (
                  <Text
                    style={[
                      styles.kpiSubText,
                      { color: "#27AE60", fontWeight: "bold" },
                    ]}
                  >
                    + C$ {finanzas.totalVentasParciales} en ventas previas
                  </Text>
                )}
              </View>

              <View
                style={[
                  styles.kpiCard,
                  { borderLeftColor: "#27AE60", marginRight: 0 },
                ]}
              >
                <Text style={styles.kpiLabel}>Costo de Prod. por Libra</Text>
                <Text style={styles.kpiValueBig}>
                  C$ {finanzas.costoPorLibra.toFixed(2)}
                </Text>
              </View>
            </ScrollView>

            {/* ========================================================= */}
            {/* FORMULARIO REGISTRAR TRANSACCIÓN (DISEÑO MÓVIL CORREGIDO) */}
            {/* ========================================================= */}
            <View
              style={[
                styles.formCard,
                txTipo === "GASTO"
                  ? styles.formCardGasto
                  : styles.formCardIngreso,
              ]}
            >
              <View style={styles.formHeader}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
                >
                  <Ionicons
                    name="trending-down-outline"
                    size={18}
                    color="#2C3E50"
                  />
                  <Text style={styles.formTitle}>Registrar Transacción</Text>
                </View>
                <View style={styles.toggleGroup}>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      txTipo === "GASTO" && styles.toggleBtnGasto,
                    ]}
                    onPress={() => {
                      setTxTipo("GASTO");
                      setTxCategoria("Alimento");
                    }}
                  >
                    <Text
                      style={[
                        styles.toggleBtnText,
                        txTipo === "GASTO" && styles.toggleBtnTextActive,
                      ]}
                    >
                      Registrar Gasto
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      txTipo === "INGRESO" && styles.toggleBtnIngreso,
                    ]}
                    onPress={() => {
                      setTxTipo("INGRESO");
                      setTxCategoria("Venta de Cerdo (Parcial)");
                    }}
                  >
                    <Text
                      style={[
                        styles.toggleBtnText,
                        txTipo === "INGRESO" && styles.toggleBtnTextActive,
                      ]}
                    >
                      Venta Parcial
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* CAMPOS APILADOS PARA MÓVIL */}
              <View style={styles.inputStack}>
                <Text style={styles.inputLabel}>Categoría</Text>
                <TouchableOpacity
                  style={styles.inputBox}
                  onPress={() => setModalCategoria(true)}
                >
                  <Text style={styles.inputText}>{txCategoria}</Text>
                  <Ionicons name="chevron-down" size={14} color="#7F8C8D" />
                </TouchableOpacity>
              </View>

              <View style={styles.inputStack}>
                <Text style={styles.inputLabel}>Concepto / Descripción</Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder={
                    txTipo === "GASTO"
                      ? "Ej. Hierro y Vitaminas"
                      : "Ej. Venta de 1 cerdo"
                  }
                  value={txConcepto}
                  onChangeText={setTxConcepto}
                />
              </View>

              <View style={styles.inputsRow}>
                <View style={[styles.inputStack, { flex: 1, marginBottom: 0 }]}>
                  <Text style={styles.inputLabel}>Monto (C$)</Text>
                  <TextInput
                    style={styles.inputBox}
                    placeholder="0.00"
                    value={txMonto}
                    onChangeText={(t) => setTxMonto(formatDecimal(t))}
                    keyboardType="numeric"
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    {
                      backgroundColor:
                        txTipo === "GASTO" ? "#E74C3C" : "#10B981",
                    },
                  ]}
                  onPress={handleGuardarTransaccion}
                >
                  <Text style={styles.submitBtnText}>
                    Guardar {txTipo === "GASTO" ? "Egreso" : "Ingreso"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* LIBRO DE MOVIMIENTOS */}
            <View style={styles.listCard}>
              <Text style={styles.listTitle}>Libro de Movimientos</Text>
              {transacciones.length === 0 ? (
                <Text style={styles.emptyListText}>
                  No hay registros financieros.
                </Text>
              ) : (
                transacciones.map((tx) => {
                  const isEditing = editingTxId === tx.id;
                  const isGasto = tx.tipo === "GASTO";
                  return (
                    <View key={tx.id} style={styles.txRow}>
                      <View style={styles.txInfo}>
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 10,
                            alignItems: "center",
                            marginBottom: 5,
                          }}
                        >
                          <Text style={styles.txDate}>{tx.fecha}</Text>
                          <View
                            style={[
                              styles.txBadge,
                              {
                                backgroundColor: isGasto
                                  ? "#FDEDEC"
                                  : "#ECFDF5",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.txBadgeText,
                                { color: isGasto ? "#E74C3C" : "#10B981" },
                              ]}
                            >
                              {tx.tipo}
                            </Text>
                          </View>
                        </View>

                        {isEditing ? (
                          <View style={{ gap: 5 }}>
                            <TextInput
                              style={styles.editInput}
                              value={editTxConcepto}
                              onChangeText={setEditTxConcepto}
                              placeholder="Concepto"
                            />
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 5,
                              }}
                            >
                              <Text style={{ color: "#7F8C8D" }}>C$</Text>
                              <TextInput
                                style={[styles.editInput, { flex: 1 }]}
                                value={editTxMonto}
                                onChangeText={(t) =>
                                  setEditTxMonto(formatDecimal(t))
                                }
                                keyboardType="numeric"
                                placeholder="Monto"
                              />
                            </View>
                          </View>
                        ) : (
                          <>
                            <Text style={styles.txCategory}>
                              {tx.categoria}
                            </Text>
                            <Text style={styles.txConcept}>{tx.concepto}</Text>
                          </>
                        )}
                      </View>

                      <View style={styles.txActionsCol}>
                        {!isEditing && (
                          <Text
                            style={[
                              styles.txAmount,
                              { color: isGasto ? "#2C3E50" : "#10B981" },
                            ]}
                          >
                            {isGasto ? "-" : "+"} C${" "}
                            {tx.monto.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </Text>
                        )}
                        <View
                          style={{ flexDirection: "row", gap: 8, marginTop: 8 }}
                        >
                          {isEditing ? (
                            <>
                              <TouchableOpacity
                                style={styles.actionIconBtn}
                                onPress={() =>
                                  handleActualizarTransaccion(tx.id)
                                }
                              >
                                <Ionicons
                                  name="save"
                                  size={16}
                                  color="#27AE60"
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.actionIconBtn}
                                onPress={() => setEditingTxId(null)}
                              >
                                <Ionicons
                                  name="close"
                                  size={16}
                                  color="#E74C3C"
                                />
                              </TouchableOpacity>
                            </>
                          ) : (
                            <>
                              <TouchableOpacity
                                style={styles.actionIconBtn}
                                onPress={() => {
                                  setEditingTxId(tx.id);
                                  setEditTxConcepto(tx.concepto);
                                  setEditTxMonto(tx.monto.toString());
                                }}
                              >
                                <Ionicons
                                  name="pencil"
                                  size={14}
                                  color="#F39C12"
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.actionIconBtn,
                                  {
                                    backgroundColor: "#FDEDEC",
                                    borderColor: "#FADBD8",
                                  },
                                ]}
                                onPress={() => handleEliminarTransaccion(tx.id)}
                              >
                                <Text
                                  style={{
                                    fontSize: 10,
                                    color: "#E74C3C",
                                    fontWeight: "bold",
                                  }}
                                >
                                  Anular
                                </Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* VENTA Y CIERRE DE LOTE */}
            <View style={styles.closeCard}>
              <Text style={styles.closeTitle}>Venta y Cierre de Lote</Text>
              <Text style={styles.closeDesc}>
                Simula tu cierre final ingresando el dinero que recibiste por
                los cerdos que quedan en el corral.
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                  marginTop: 15,
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>
                    Ingreso Final por Venta (C$)
                  </Text>
                  <TextInput
                    style={styles.inputBox}
                    placeholder="Ej. 45000.00"
                    value={ingresoFinalVenta}
                    onChangeText={(t) => setIngresoFinalVenta(formatDecimal(t))}
                    keyboardType="numeric"
                  />
                </View>
                <TouchableOpacity
                  style={styles.calcBtn}
                  onPress={() => setShowBalanceCierre(true)}
                >
                  <Text style={styles.calcBtnText}>Calcular Rendimiento</Text>
                </TouchableOpacity>
              </View>

              {showBalanceCierre && (
                <View style={styles.balanceBox}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 15,
                    }}
                  >
                    <Ionicons name="bar-chart" size={18} color="#2C3E50" />
                    <Text style={{ fontWeight: "bold", color: "#2C3E50" }}>
                      Balance de Cierre de Lote
                    </Text>
                  </View>

                  <View style={styles.balanceGrid}>
                    <View>
                      <Text style={styles.balanceLabel}>Venta Final</Text>
                      <Text style={styles.balanceValue}>
                        C${" "}
                        {Number(ingresoFinalVenta).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.balanceLabel}>
                        + Ventas Parciales Previas
                      </Text>
                      <Text style={[styles.balanceValue, { color: "#27AE60" }]}>
                        C$ {finanzas.totalVentasParciales.toFixed(2)}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.balanceLabel}>
                        - Total Invertido (Gastos)
                      </Text>
                      <Text style={[styles.balanceValue, { color: "#E74C3C" }]}>
                        C$ {finanzas.totalGastos.toFixed(2)}
                      </Text>
                    </View>
                    <View style={{ width: "100%", marginTop: 10 }}>
                      <Text style={styles.balanceLabel}>
                        {Number(ingresoFinalVenta) +
                          finanzas.totalVentasParciales -
                          finanzas.totalGastos >=
                        0
                          ? "Ganancia Neta"
                          : "Pérdida Neta"}
                      </Text>
                      <Text
                        style={[
                          styles.balanceValueBig,
                          {
                            color:
                              Number(ingresoFinalVenta) +
                                finanzas.totalVentasParciales -
                                finanzas.totalGastos >=
                              0
                                ? "#27AE60"
                                : "#E74C3C",
                          },
                        ]}
                      >
                        C${" "}
                        {(
                          Number(ingresoFinalVenta) +
                          finanzas.totalVentasParciales -
                          finanzas.totalGastos
                        ).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.confirmCloseBtn}
                    onPress={handleArchivarLote}
                  >
                    <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                    <Text style={styles.confirmCloseBtnText}>
                      Confirmar y Archivar Lote
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </>
        ) : (
          <View style={{ marginTop: 10 }}>
            <View style={styles.kpiReportRow}>
              <View
                style={[styles.kpiReportCard, { backgroundColor: "#FDEDEC" }]}
              >
                <Text style={styles.kpiLabel}>Ganancia Neta (Histórica)</Text>
                <Text style={[styles.kpiValueBig, { color: "#C0392B" }]}>
                  C${" "}
                  {kpisHistorial.ganancia.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </Text>
              </View>
              <View
                style={[styles.kpiReportCard, { backgroundColor: "#E8F6EF" }]}
              >
                <Text style={styles.kpiLabel}>Total Invertido (Histórico)</Text>
                <Text style={[styles.kpiValueBig, { color: "#27AE60" }]}>
                  C${" "}
                  {kpisHistorial.invertido.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </Text>
              </View>
            </View>

            <View style={styles.listCard}>
              <Text style={styles.listTitle}>
                Registro de Lotes Finalizados
              </Text>
              {lotesCerrados.length === 0 ? (
                <Text style={styles.emptyListText}>
                  Aún no has finalizado ningún lote.
                </Text>
              ) : (
                lotesCerrados.map((lote) => {
                  const fCierre = lote.finanzasCierre || {};
                  return (
                    <View key={lote.id} style={styles.closedRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.closedDate}>
                          {lote.fechaCierre
                            ? new Date(lote.fechaCierre).toLocaleDateString()
                            : "N/A"}
                        </Text>
                        <Text style={styles.closedName}>
                          {lote.nombre || lote.codigo}
                        </Text>
                        <Text style={styles.closedSub}>
                          {lote.cantidadInicial} cerdos
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.closedLabel}>
                          Rentabilidad Final
                        </Text>
                        <Text
                          style={[
                            styles.closedProfit,
                            {
                              color:
                                fCierre.gananciaNeta >= 0
                                  ? "#27AE60"
                                  : "#E74C3C",
                            },
                          ]}
                        >
                          {fCierre.gananciaNeta >= 0 ? "+" : ""}C${" "}
                          {Number(fCierre.gananciaNeta || 0).toLocaleString(
                            "en-US",
                            { minimumFractionDigits: 2 },
                          )}
                        </Text>
                        <Text style={styles.closedLabel}>
                          Costo: C${" "}
                          {Number(fCierre.gastosTotales || 0).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* MODAL: SELECCIONAR LOTE */}
      <Modal visible={modalLotes} animationType="fade" transparent={true}>
        <View style={styles.modalCenter}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Seleccionar Lote Activo</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {lotesActivos.map((lote) => (
                <TouchableOpacity
                  key={lote.id}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedLote(lote);
                    setModalLotes(false);
                  }}
                >
                  <Text style={styles.dropdownItemTitle}>
                    {lote.nombre || lote.codigo}
                  </Text>
                  <Text style={styles.dropdownItemSub}>
                    {lote.cantidadActual} cerdos | Etapa: {lote.etapa}
                  </Text>
                </TouchableOpacity>
              ))}
              {lotesActivos.length === 0 && (
                <Text
                  style={{
                    textAlign: "center",
                    color: "#7F8C8D",
                    marginTop: 20,
                  }}
                >
                  No hay lotes activos.
                </Text>
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setModalLotes(false)}
            >
              <Text style={styles.modalCancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: SELECCIONAR CATEGORÍA */}
      <Modal visible={modalCategoria} animationType="fade" transparent={true}>
        <View style={styles.modalCenter}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Seleccionar Categoría</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {categoriasTransaccion.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setTxCategoria(cat);
                    setModalCategoria(false);
                  }}
                >
                  <Text style={styles.dropdownItemTitle}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setModalCategoria(false)}
            >
              <Text style={styles.modalCancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
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

  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    marginBottom: 20,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: { borderBottomColor: "#8E2827" },
  tabText: { fontSize: 14, color: "#64748B", fontWeight: "bold" },
  tabTextActive: { color: "#8E2827" },

  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#3498DB",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dropdownText: { fontSize: 12, color: "#2C3E50", fontWeight: "bold" },
  dropdownTextPlaceholder: {
    fontSize: 12,
    color: "#3498DB",
    fontWeight: "bold",
  },

  kpiCard: {
    backgroundColor: "#FFF",
    borderRadius: 8,
    padding: 15,
    width: 220,
    marginRight: 15,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  kpiLabel: {
    fontSize: 11,
    color: "#0F172A",
    fontWeight: "bold",
    marginBottom: 8,
  },
  kpiValueMain: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 4,
  },
  kpiSubText: { fontSize: 11, color: "#64748B" },
  kpiBadge: {
    backgroundColor: "#F2D7D5",
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 8,
  },
  kpiBadgeText: { fontSize: 9, color: "#922B21", fontWeight: "bold" },
  kpiValueBig: { fontSize: 24, fontWeight: "900", color: "#0F172A" },

  // Estilos Corregidos de Formulario para Móvil
  formCard: {
    backgroundColor: "#FFF",
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderStyle: "dashed",
    marginBottom: 20,
  },
  formCardGasto: { borderColor: "#F5B7B1" },
  formCardIngreso: { borderColor: "#A2D9CE" },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  formTitle: { fontSize: 14, fontWeight: "bold", color: "#2C3E50" },
  toggleGroup: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
    padding: 2,
  },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 4 },
  toggleBtnGasto: { backgroundColor: "#E74C3C" },
  toggleBtnIngreso: { backgroundColor: "#10B981" },
  toggleBtnText: { fontSize: 11, fontWeight: "bold", color: "#64748B" },
  toggleBtnTextActive: { color: "#FFF" },

  // Contenedores apilados en vez de horizontales para que no se aplaste en pantallas de celular
  inputStack: { marginBottom: 15 },
  inputsRow: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  inputLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 4,
  },
  inputBox: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    padding: 10,
    fontSize: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inputText: { fontSize: 13, color: "#2C3E50" },
  submitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
  },
  submitBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 13 },

  listCard: {
    backgroundColor: "#FFF",
    borderRadius: 8,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    marginBottom: 20,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 15,
  },
  emptyListText: {
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 12,
    paddingVertical: 20,
  },

  txRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingVertical: 12,
  },
  txInfo: { flex: 1, paddingRight: 10 },
  txDate: { fontSize: 10, color: "#64748B" },
  txBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  txBadgeText: { fontSize: 8, fontWeight: "bold" },
  txCategory: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 2,
  },
  txConcept: { fontSize: 11, color: "#64748B" },
  txActionsCol: { alignItems: "flex-end", justifyContent: "center" },
  txAmount: { fontSize: 14, fontWeight: "900" },
  actionIconBtn: {
    padding: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  editInput: {
    borderWidth: 1,
    borderColor: "#F39C12",
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 12,
  },

  closeCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  closeTitle: { fontSize: 14, fontWeight: "bold", color: "#2C3E50" },
  closeDesc: { fontSize: 11, color: "#64748B", marginTop: 4 },
  calcBtn: {
    backgroundColor: "#F5B7B1",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 6,
    justifyContent: "center",
  },
  calcBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 12 },

  balanceBox: {
    backgroundColor: "#FDEDEC",
    borderWidth: 1,
    borderColor: "#FADBD8",
    borderRadius: 8,
    padding: 15,
    marginTop: 15,
  },
  balanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 15,
    marginBottom: 15,
  },
  balanceLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "bold",
    marginBottom: 2,
  },
  balanceValue: { fontSize: 14, fontWeight: "bold", color: "#2C3E50" },
  balanceValueBig: { fontSize: 18, fontWeight: "900" },
  confirmCloseBtn: {
    flexDirection: "row",
    backgroundColor: "#E74C3C",
    paddingVertical: 12,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  confirmCloseBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 13 },

  kpiReportRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  kpiReportCard: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  closedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingVertical: 12,
  },
  closedDate: { fontSize: 10, color: "#64748B", marginBottom: 2 },
  closedName: { fontSize: 13, fontWeight: "bold", color: "#0F172A" },
  closedSub: { fontSize: 11, color: "#64748B" },
  closedLabel: { fontSize: 10, color: "#64748B" },
  closedProfit: { fontSize: 14, fontWeight: "900", marginVertical: 2 },

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
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 15,
  },
  dropdownItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ECF0F1",
  },
  dropdownItemTitle: { fontSize: 14, fontWeight: "bold", color: "#2C3E50" },
  dropdownItemSub: { fontSize: 11, color: "#7F8C8D", marginTop: 2 },
  modalCancelBtn: {
    marginTop: 15,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#F1F2F6",
    borderRadius: 8,
  },
  modalCancelBtnText: { color: "#7F8C8D", fontWeight: "bold", fontSize: 13 },
});
