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
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
} from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";
import SidebarMenu from "../components/SidebarMenu";

import Svg, { Path, Circle, Line, Text as SvgText } from "react-native-svg";

const screenWidth = Dimensions.get("window").width;

// =========================================================================
// LÓGICA DE NEGOCIO MATEMÁTICA
// =========================================================================
const calcularPuntoOptimoLote = (
  lote,
  ultimoPesaje,
  precioVenta,
  costoAlimento,
) => {
  if (!lote || !ultimoPesaje) return null;

  let pesoActual = ultimoPesaje.pesoPromedio;
  const cantidadCerdos = lote.cantidadActual;

  let historial = [];
  let gananciaMaxima = -Infinity;
  let diaOptimoIndex = 0;

  let pesoSimulado = pesoActual;
  let costoAcumulado = 0;

  for (let dia = 0; dia <= 30; dia++) {
    const ingresoPorCerdo = pesoSimulado * precioVenta;
    const gananciaNetaPorCerdo = ingresoPorCerdo - costoAcumulado;
    const gananciaNetaLote = gananciaNetaPorCerdo * cantidadCerdos;

    historial.push({
      diaExt: dia,
      peso: parseFloat(pesoSimulado.toFixed(1)),
      ingreso: ingresoPorCerdo,
      costoMantenimiento: costoAcumulado,
      gananciaNeta: parseFloat(gananciaNetaLote.toFixed(2)),
    });

    if (gananciaNetaLote > gananciaMaxima) {
      gananciaMaxima = gananciaNetaLote;
      diaOptimoIndex = dia;
    }

    const gananciaDiariaPeso = pesoSimulado > 220 ? 1.2 : 1.8;
    pesoSimulado += gananciaDiariaPeso;

    const consumoDiarioLbs = pesoSimulado * 0.04;
    costoAcumulado += consumoDiarioLbs * costoAlimento;
  }

  const gananciaDiaCero = historial[0].gananciaNeta;
  historial = historial.map((h) => {
    const porcentajeCambio =
      ((h.gananciaNeta - gananciaDiaCero) / (Math.abs(gananciaDiaCero) || 1)) *
      100;
    return { ...h, porcentajeCambio: parseFloat(porcentajeCambio.toFixed(2)) };
  });

  return { historial, diaOptimo: historial[diaOptimoIndex] };
};

export default function MaximizadorScreen() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  const [lotes, setLotes] = useState([]);
  const [selectedLote, setSelectedLote] = useState(null);
  const [modalLotes, setModalLotes] = useState(false);

  const [ultimoPesaje, setUltimoPesaje] = useState(null);
  const [loadingPesaje, setLoadingPesaje] = useState(false);

  const [precioVenta, setPrecioVenta] = useState("41");
  const [costoAlimento, setCostoAlimento] = useState("16.5");
  const [diasSimulacion, setDiasSimulacion] = useState(0);

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
      setUltimoPesaje(null);
      return;
    }

    setLoadingPesaje(true);
    const qPesos = query(
      collection(db, "lotes", selectedLote.id, "historialPesos"),
      orderBy("fecha", "desc"),
      limit(1),
    );

    const unsubPesos = onSnapshot(qPesos, (snap) => {
      if (!snap.empty) {
        setUltimoPesaje({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setUltimoPesaje(null);
      }
      setLoadingPesaje(false);
      setDiasSimulacion(0);
    });

    return () => unsubPesos();
  }, [selectedLote]);

  const simulacion = useMemo(() => {
    const pVenta = parseFloat(precioVenta) || 0;
    const cAlimento = parseFloat(costoAlimento) || 0;

    const resultado = calcularPuntoOptimoLote(
      selectedLote,
      ultimoPesaje,
      pVenta,
      cAlimento,
    );
    if (!resultado) return null;

    return {
      historial: resultado.historial,
      diaOptimo: resultado.diaOptimo,
      diaSeleccionado: resultado.historial[diasSimulacion],
    };
  }, [selectedLote, ultimoPesaje, precioVenta, costoAlimento, diasSimulacion]);

  // =========================================================================
  // LÓGICA DE DIBUJADO DE GRÁFICO (Corregida a líneas rectas sin olas)
  // =========================================================================
  const getChartData = () => {
    if (!simulacion) return null;

    const width = screenWidth - 80;
    const height = 200;
    const paddingX = 20;
    const paddingY = 40;

    const minG = Math.min(...simulacion.historial.map((h) => h.gananciaNeta));
    const maxG = Math.max(...simulacion.historial.map((h) => h.gananciaNeta));
    const rangoG = maxG - minG || 1;

    const getX = (dia) => paddingX + (dia / 30) * (width - paddingX * 2);
    const getY = (ganancia) =>
      height -
      paddingY -
      ((ganancia - minG) / rangoG) * (height - paddingY * 2);

    // Dibuja una línea limpia (L) en lugar de una curva de Bézier (C) que causaba el efecto serrucho
    const pathData = simulacion.historial.reduce((acc, h, i) => {
      const x = getX(h.diaExt);
      const y = getY(h.gananciaNeta);
      if (i === 0) return `M ${x} ${y}`;
      return `${acc} L ${x} ${y}`;
    }, "");

    const areaData = `${pathData} L ${getX(30)} ${height - paddingY} L ${getX(0)} ${height - paddingY} Z`;

    return {
      width,
      height,
      paddingX,
      paddingY,
      getX,
      getY,
      pathData,
      areaData,
    };
  };

  const chart = getChartData();
  const formatDecimal = (text) => text.replace(/[^0-9.]/g, "");

  // Controladores del Stepper (Reemplazo del slider buggeado)
  const sumarDia = () => {
    if (diasSimulacion < 30) setDiasSimulacion((prev) => prev + 1);
  };
  const restarDia = () => {
    if (diasSimulacion > 0) setDiasSimulacion((prev) => prev - 1);
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
        currentRoute="/maximizador"
      />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Maximizador de Ganancia</Text>
          <Text style={styles.pageSubtitle}>
            Selecciona un lote para predecir su punto óptimo de venta basado en
            el consumo de alimento y ganancia de peso.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#27AE60" />
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Selecciona un Lote</Text>
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
                    ? `${selectedLote.codigo} (Etapa: ${selectedLote.etapa}) - ${selectedLote.cantidadActual} cerdos`
                    : "-- Selecciona un lote --"}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#7F8C8D" />
              </TouchableOpacity>
            </View>

            {loadingPesaje ? (
              <View
                style={[
                  styles.card,
                  { alignItems: "center", paddingVertical: 40 },
                ]}
              >
                <ActivityIndicator size="large" color="#27AE60" />
                <Text style={{ marginTop: 10, color: "#7F8C8D" }}>
                  Analizando historial biológico...
                </Text>
              </View>
            ) : !simulacion ? (
              <View style={[styles.card, { paddingVertical: 50 }]}>
                <Text style={styles.emptyStateText}>
                  {!selectedLote
                    ? "Selecciona un lote arriba para comenzar."
                    : "No hay datos suficientes para calcular el punto óptimo. Registra al menos un pesaje en este lote."}
                </Text>
              </View>
            ) : (
              <View style={styles.resultsContainer}>
                {/* BANNER ÓPTIMO CORREGIDO (Columna apilada para pantallas estrechas) */}
                <View
                  style={[
                    styles.optimalBanner,
                    simulacion.diaOptimo.diaExt <= 5 && styles.optimalUrgent,
                  ]}
                >
                  <View style={styles.optimalHeader}>
                    <Ionicons
                      name="time-outline"
                      size={28}
                      color={
                        simulacion.diaOptimo.diaExt <= 5 ? "#E74C3C" : "#27AE60"
                      }
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optimalTitle}>
                        {simulacion.diaOptimo.diaExt === 0
                          ? "¡Rentabilidad Máxima HOY!"
                          : `Ventana Óptima: +${simulacion.diaOptimo.diaExt} días`}
                      </Text>
                      <Text style={styles.optimalSub}>
                        Sugerencia de salida al mercado óptima.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.optimalStatBox}>
                    <Text style={styles.optimalStatLabel}>
                      GANANCIA MÁXIMA PROYECTADA
                    </Text>
                    <Text style={styles.optimalStatValue}>
                      C${" "}
                      {simulacion.diaOptimo.gananciaNeta.toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                      )}
                    </Text>
                  </View>
                </View>

                {/* INPUTS DE MERCADO */}
                <View style={styles.marketInputsRow}>
                  <View style={styles.marketInputCol}>
                    <Text style={styles.inputLabel}>
                      Precio Venta (C$/lb pie)
                    </Text>
                    <View style={styles.marketInputWrapper}>
                      <Text style={styles.currencySymbol}>C$</Text>
                      <TextInput
                        style={styles.marketInput}
                        value={precioVenta}
                        onChangeText={(t) => setPrecioVenta(formatDecimal(t))}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  <View style={styles.marketInputCol}>
                    <Text style={styles.inputLabel}>
                      Costo Alimento (C$/lb)
                    </Text>
                    <View style={styles.marketInputWrapper}>
                      <Text style={styles.currencySymbol}>C$</Text>
                      <TextInput
                        style={styles.marketInput}
                        value={costoAlimento}
                        onChangeText={(t) => setCostoAlimento(formatDecimal(t))}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>

                {/* GRÁFICA DE PROYECCIÓN (SVG) */}
                <View style={styles.card}>
                  <View style={styles.chartLegend}>
                    <View style={styles.legendItem}>
                      <View
                        style={[
                          styles.legendDot,
                          { backgroundColor: "#10B981" },
                        ]}
                      />
                      <Text style={styles.legendText}>Pico Óptimo</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View
                        style={[
                          styles.legendDot,
                          { backgroundColor: "#F59E0B" },
                        ]}
                      />
                      <Text style={styles.legendText}>Simulación</Text>
                    </View>
                  </View>

                  {chart && (
                    <View style={{ alignItems: "center", marginTop: 20 }}>
                      <Svg width={chart.width} height={chart.height}>
                        {/* Eje X y Y */}
                        <Line
                          x1={chart.paddingX}
                          y1={chart.height - chart.paddingY}
                          x2={chart.width - chart.paddingX}
                          y2={chart.height - chart.paddingY}
                          stroke="#E2E8F0"
                          strokeWidth="2"
                        />

                        {/* Línea segmentada del punto óptimo */}
                        <Line
                          x1={chart.getX(simulacion.diaOptimo.diaExt)}
                          y1={chart.paddingY}
                          x2={chart.getX(simulacion.diaOptimo.diaExt)}
                          y2={chart.height - chart.paddingY}
                          stroke="#10B981"
                          strokeDasharray="5, 5"
                          strokeWidth="1.5"
                        />

                        {/* Área sombreada */}
                        <Path
                          d={chart.areaData}
                          fill="#3498DB"
                          fillOpacity="0.1"
                        />

                        {/* Curva de Ganancia limpia */}
                        <Path
                          d={chart.pathData}
                          fill="none"
                          stroke="#3498DB"
                          strokeWidth="3"
                          strokeLinejoin="round"
                        />

                        {/* Punto Óptimo */}
                        <Circle
                          cx={chart.getX(simulacion.diaOptimo.diaExt)}
                          cy={chart.getY(simulacion.diaOptimo.gananciaNeta)}
                          r="6"
                          fill="#10B981"
                        />
                        <SvgText
                          x={chart.getX(simulacion.diaOptimo.diaExt)}
                          y={chart.getY(simulacion.diaOptimo.gananciaNeta) - 15}
                          fill="#10B981"
                          fontSize="10"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          Pico (+{simulacion.diaOptimo.diaExt}d)
                        </SvgText>

                        {/* Punto de Simulación Actual */}
                        <Circle
                          cx={chart.getX(simulacion.diaSeleccionado.diaExt)}
                          cy={chart.getY(
                            simulacion.diaSeleccionado.gananciaNeta,
                          )}
                          r="6"
                          fill="#F59E0B"
                          stroke="#FFF"
                          strokeWidth="2"
                        />

                        {/* Etiquetas Eje X */}
                        <SvgText
                          x={chart.getX(0)}
                          y={chart.height - 15}
                          fill="#94A3B8"
                          fontSize="10"
                          textAnchor="middle"
                        >
                          Hoy
                        </SvgText>
                        <SvgText
                          x={chart.getX(15)}
                          y={chart.height - 15}
                          fill="#94A3B8"
                          fontSize="10"
                          textAnchor="middle"
                        >
                          +15d
                        </SvgText>
                        <SvgText
                          x={chart.getX(30)}
                          y={chart.height - 15}
                          fill="#94A3B8"
                          fontSize="10"
                          textAnchor="middle"
                        >
                          +30d
                        </SvgText>
                      </Svg>
                    </View>
                  )}
                </View>

                {/* SIMULADOR DE TIEMPO TEMPORAL (Precisión con Stepper) */}
                <View style={styles.simulatorCard}>
                  <Text style={styles.simulatorTitle}>
                    Controlador de Simulación
                  </Text>

                  {/* STEPPER DE PRECISIÓN (Reemplaza al Slider) */}
                  <View style={styles.stepperContainer}>
                    <TouchableOpacity
                      style={[
                        styles.stepperBtn,
                        diasSimulacion === 0 && styles.stepperBtnDisabled,
                      ]}
                      onPress={restarDia}
                      disabled={diasSimulacion === 0}
                    >
                      <Ionicons
                        name="remove"
                        size={24}
                        color={diasSimulacion === 0 ? "#BDC3C7" : "#0F172A"}
                      />
                    </TouchableOpacity>

                    <View style={styles.stepperValueBox}>
                      <Text style={styles.stepperValueText}>
                        +{diasSimulacion}
                      </Text>
                      <Text style={styles.stepperValueLabel}>días</Text>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.stepperBtn,
                        diasSimulacion === 30 && styles.stepperBtnDisabled,
                      ]}
                      onPress={sumarDia}
                      disabled={diasSimulacion === 30}
                    >
                      <Ionicons
                        name="add"
                        size={24}
                        color={diasSimulacion === 30 ? "#BDC3C7" : "#0F172A"}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.simResultBox}>
                    {diasSimulacion === simulacion.diaOptimo.diaExt ? (
                      <Text style={styles.simResultText}>
                        🎯{" "}
                        <Text style={{ fontWeight: "900", color: "#0F172A" }}>
                          Estás posicionado en el punto exacto de rentabilidad
                          máxima.
                        </Text>{" "}
                        El Ingreso Marginal iguala al Costo de alimentación.
                      </Text>
                    ) : (
                      <>
                        <Text style={styles.simResultText}>
                          Si decides vender en{" "}
                          <Text style={{ fontWeight: "900", color: "#0F172A" }}>
                            +{diasSimulacion} días
                          </Text>
                          , la ganancia estimada cambia a{" "}
                          <Text style={{ fontWeight: "900", color: "#0F172A" }}>
                            C${" "}
                            {simulacion.diaSeleccionado.gananciaNeta.toLocaleString(
                              "en-US",
                              { minimumFractionDigits: 2 },
                            )}
                          </Text>
                          .
                        </Text>
                        <View
                          style={[
                            styles.profitBadge,
                            {
                              backgroundColor:
                                simulacion.diaSeleccionado.porcentajeCambio >= 0
                                  ? "#ECFDF5"
                                  : "#FEF2F2",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.profitBadgeText,
                              {
                                color:
                                  simulacion.diaSeleccionado.porcentajeCambio >=
                                  0
                                    ? "#047857"
                                    : "#B91C1C",
                              },
                            ]}
                          >
                            Ganancia{" "}
                            {simulacion.diaSeleccionado.porcentajeCambio >= 0
                              ? "sube"
                              : "cae"}{" "}
                            {Math.abs(
                              simulacion.diaSeleccionado.porcentajeCambio,
                            )}
                            % respecto a hoy
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* MODAL Lotes */}
      <Modal visible={modalLotes} animationType="slide" transparent={true}>
        <View style={styles.modalCenter}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Selecciona un Lote</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {lotes.map((lote) => (
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
                    Etapa: {lote.etapa} | Población: {lote.cantidadActual}{" "}
                    cerdos
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setModalLotes(false)}
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
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
  pageTitle: { fontSize: 24, fontWeight: "bold", color: "#0F172A" },
  pageSubtitle: { fontSize: 13, color: "#64748B", marginTop: 5 },

  card: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 15,
  },
  emptyStateText: {
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 14,
    lineHeight: 22,
    paddingHorizontal: 20,
  },

  dropdownBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 15,
    backgroundColor: "#FFF",
  },
  dropdownText: { fontSize: 14, color: "#0F172A" },
  dropdownTextPlaceholder: { fontSize: 14, color: "#94A3B8" },

  resultsContainer: { marginTop: 10 },

  // BANNER ÓPTIMO - Rediseñado para evitar recortes de pantalla
  optimalBanner: {
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  optimalUrgent: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  optimalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    marginBottom: 15,
  },
  optimalTitle: { fontSize: 18, fontWeight: "bold", color: "#0F172A" },
  optimalSub: { fontSize: 12, color: "#047857", marginTop: 2 },
  optimalStatBox: {
    backgroundColor: "#FFF",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  optimalStatLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#64748B",
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  optimalStatValue: { fontSize: 20, fontWeight: "900", color: "#0F172A" },

  marketInputsRow: { flexDirection: "row", gap: 15, marginBottom: 20 },
  marketInputCol: { flex: 1 },
  inputLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#64748B",
    marginBottom: 8,
  },
  marketInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "bold",
    marginRight: 5,
  },
  marketInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "bold",
    color: "#0F172A",
  },

  chartLegend: { flexDirection: "row", justifyContent: "flex-end", gap: 15 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: "#64748B", fontWeight: "500" },

  simulatorCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  simulatorTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 20,
    textAlign: "center",
  },

  // STEPPER NATIVO (Reemplazo del Slider)
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginBottom: 25,
  },
  stepperBtn: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  stepperBtnDisabled: {
    backgroundColor: "#F1F5F9",
    borderColor: "#F1F5F9",
    elevation: 0,
  },
  stepperValueBox: { alignItems: "center", minWidth: 80 },
  stepperValueText: { fontSize: 26, fontWeight: "900", color: "#F59E0B" },
  stepperValueLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "bold",
    textTransform: "uppercase",
  },

  simResultBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  simResultText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 22,
    marginBottom: 15,
  },
  profitBadge: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  profitBadgeText: { fontSize: 11, fontWeight: "bold" },

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
    fontSize: 18,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 15,
  },
  dropdownItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#ECF0F1",
  },
  dropdownItemTitle: { fontSize: 16, fontWeight: "bold", color: "#2C3E50" },
  dropdownItemSub: { fontSize: 12, color: "#7F8C8D", marginTop: 5 },
  cancelBtn: {
    marginTop: 20,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#F1F2F6",
    borderRadius: 8,
  },
  cancelBtnText: { color: "#7F8C8D", fontWeight: "bold" },
});
