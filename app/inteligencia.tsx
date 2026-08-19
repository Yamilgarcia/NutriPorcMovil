import { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";
import SidebarMenu from "../components/SidebarMenu";

import { PieChart } from "react-native-chart-kit"; // Quitamos BarChart

const screenWidth = Dimensions.get("window").width;

export default function InteligenciaScreen() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  // Estados del Motor
  const [rankingDietas, setRankingDietas] = useState([]);
  const [insumosEstrella, setInsumosEstrella] = useState([]);

  // Estados de Interfaz
  const [filtroEtapa, setFiltroEtapa] = useState("Todas");
  const [modalFiltro, setModalFiltro] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);

  // =========================================================================
  // LÓGICA CORE: PROCESAMIENTO DE DATOS REALES (Desde Firebase)
  // =========================================================================
  const procesarInteligenciaNutricional = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);

    try {
      const qLotes = query(
        collection(db, "lotes"),
        where("fincaId", "==", user.uid),
      );
      const snapLotes = await getDocs(qLotes);

      let analisisDietas = [];
      let conteoInsumosExitosos = {};

      for (const docLote of snapLotes.docs) {
        const lote = { id: docLote.id, ...docLote.data() };

        const qPesos = query(
          collection(db, "lotes", lote.id, "historialPesos"),
          orderBy("fecha", "asc"),
        );
        const snapPesos = await getDocs(qPesos);
        const pesajes = snapPesos.docs.map((d) => d.data());

        // PESAJES INTERMEDIOS
        if (pesajes.length > 0) {
          let pesoAnterior = 20;
          let fechaAnterior = new Date(lote.fechaCreacion || Date.now());

          pesajes.forEach((p) => {
            const fechaActual = new Date(p.timestamp || p.fecha);
            let dias = Math.floor(
              (fechaActual.getTime() - fechaAnterior.getTime()) /
                (1000 * 60 * 60 * 24),
            );
            if (dias <= 0) dias = 1;

            let gmd = Math.round(
              ((p.pesoPromedio - pesoAnterior) / dias) * 1000,
            );
            if (isNaN(gmd)) gmd = 0;

            let arrayIngs = [];
            if (p.ingredientes) {
              arrayIngs = Array.isArray(p.ingredientes)
                ? p.ingredientes
                : p.ingredientes
                    .split(",")
                    .map((i) => i.trim())
                    .filter(Boolean);
            }

            analisisDietas.push({
              nombre: p.dietaAplicada || p.dieta || "Dieta Estándar",
              etapa: lote.etapa || "Desconocida",
              gmd: gmd,
              ingredientesOriginales: arrayIngs,
              ingredientesTxt:
                arrayIngs.length > 0
                  ? arrayIngs.join(", ")
                  : "Maíz, Soya, Suero",
            });

            if (gmd > 500 && arrayIngs.length > 0) {
              arrayIngs.forEach((ing) => {
                const insumoLimpio = ing.trim();
                if (insumoLimpio) {
                  conteoInsumosExitosos[insumoLimpio] =
                    (conteoInsumosExitosos[insumoLimpio] || 0) + 1;
                }
              });
            }
            pesoAnterior = p.pesoPromedio;
            fechaAnterior = fechaActual;
          });
        }

        // CIERRE FINAL
        if (lote.estado === "Histórico" || lote.estado === "CERRADO") {
          const fechaInicio = new Date(lote.fechaCreacion || Date.now());
          const fechaCierre = new Date(lote.fechaCierre || Date.now());
          let dias = Math.floor(
            (fechaCierre.getTime() - fechaInicio.getTime()) /
              (1000 * 60 * 60 * 24),
          );
          if (dias <= 0) dias = 1;

          const pesoAnterior =
            pesajes.length > 0 ? pesajes[pesajes.length - 1].pesoPromedio : 20;
          const pesoFinal =
            lote.pesoFinalPromedio ||
            lote.pesoFinal ||
            pesoAnterior + 1.5 * dias;

          let gmd = Math.round(((pesoFinal - pesoAnterior) / dias) * 1000);
          if (isNaN(gmd)) gmd = 0;

          let arrayIngsFinal = [];
          if (lote.ingredientesClave) {
            arrayIngsFinal = Array.isArray(lote.ingredientesClave)
              ? lote.ingredientesClave
              : lote.ingredientesClave
                  .split(",")
                  .map((i) => i.trim())
                  .filter(Boolean);
          }

          analisisDietas.push({
            nombre: lote.dietaFinal || lote.dietaAplicada || "Engorde Final",
            etapa: lote.etapa || "Cierre",
            gmd: gmd,
            ingredientesOriginales: arrayIngsFinal,
            ingredientesTxt:
              arrayIngsFinal.length > 0
                ? arrayIngsFinal.join(", ")
                : "Sorgo, Soya",
          });

          if (gmd > 500 && arrayIngsFinal.length > 0) {
            arrayIngsFinal.forEach((ing) => {
              const insumoLimpio = ing.trim();
              if (insumoLimpio) {
                conteoInsumosExitosos[insumoLimpio] =
                  (conteoInsumosExitosos[insumoLimpio] || 0) + 1;
              }
            });
          }
        }
      }

      analisisDietas.sort((a, b) => b.gmd - a.gmd);

      const topInsumos = Object.keys(conteoInsumosExitosos)
        .map((key) => ({
          nombre: key,
          casosDeExito: conteoInsumosExitosos[key],
        }))
        .sort((a, b) => b.casosDeExito - a.casosDeExito);

      setRankingDietas(analisisDietas);
      setInsumosEstrella(topInsumos);
    } catch (error) {
      console.error("Error al procesar inteligencia nutricional:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    procesarInteligenciaNutricional();
  }, []);

  const dietasFiltradas = useMemo(() => {
    if (filtroEtapa === "Todas") return rankingDietas;
    return rankingDietas.filter((d) => d.etapa === filtroEtapa);
  }, [rankingDietas, filtroEtapa]);

  const mostrarDemo = rankingDietas.length === 0;

  const datosDietas = mostrarDemo
    ? [
        {
          nombre: "Iniciador Soya-Plus",
          gmd: 850,
          etapa: "Destete",
          ingredientesTxt: "Soya, Maíz, Suero",
          ingredientesOriginales: ["Soya", "Maíz", "Suero"],
        },
        {
          nombre: "Engorde Plus",
          gmd: 790,
          etapa: "Engorde",
          ingredientesTxt: "Sorgo, Aceite, Soya",
          ingredientesOriginales: ["Sorgo", "Aceite", "Soya"],
        },
        {
          nombre: "Mezcla Económica",
          gmd: 600,
          etapa: "Desarrollo",
          ingredientesTxt: "Afrecho, Tortilla",
          ingredientesOriginales: ["Afrecho", "Tortilla"],
        },
      ]
    : dietasFiltradas.slice(0, 5);

  const datosInsumos = mostrarDemo
    ? [
        { nombre: "Harina de Soya", casosDeExito: 15 },
        { nombre: "Maíz", casosDeExito: 12 },
        { nombre: "Suero", casosDeExito: 8 },
      ]
    : insumosEstrella.slice(0, 4);

  const MEJOR_DIETA = datosDietas.length > 0 ? datosDietas[0] : null;
  const maxGMD =
    datosDietas.length > 0 ? Math.max(...datosDietas.map((d) => d.gmd)) : 1; // Para calcular porcentajes de la barra

  const COLORES_PIE = ["#137E35", "#F49F97", "#8F1914", "#EDDD99"];

  const chartConfig = {
    backgroundColor: "#ffffff",
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    color: (opacity = 1) => `rgba(19, 126, 53, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
  };

  const pieChartData = datosInsumos.map((ins, index) => ({
    name:
      ins.nombre.length > 12 ? ins.nombre.substring(0, 12) + ".." : ins.nombre,
    population: ins.casosDeExito,
    color: COLORES_PIE[index % COLORES_PIE.length],
    legendFontColor: "#64748B",
    legendFontSize: 11,
  }));

  const opcionesFiltro = [
    "Todas",
    "Destete",
    "Desarrollo",
    "Engorde",
    "Reproducción",
    "Gestación",
    "Lactancia",
  ];

  return (
    <View style={styles.mainContainer}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setMenuVisible(true)}
        >
          <Ionicons name="menu" size={28} color="#137E35" />
        </TouchableOpacity>
        <Text style={styles.headerLogo}>NutriPorc</Text>
        <View style={{ width: 28 }} />
      </View>

      <SidebarMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        currentRoute="/inteligencia"
      />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ENCABEZADO Y FILTRO */}
        <View style={styles.headerSection}>
          <View style={styles.titleContainer}>
            <Text style={styles.pageTitle}>
              Motor de Inteligencia Nutricional 🧠🐷
            </Text>
            <Text style={styles.pageSubtitle}>
              Análisis histórico de conversión alimenticia y rendimiento por
              lote.
            </Text>
          </View>

          <View style={styles.filterContainer}>
            <Text style={styles.filterLabel}>
              🔍 Filtrar ranking por etapa:
            </Text>
            <TouchableOpacity
              style={styles.filterBtn}
              onPress={() => setModalFiltro(true)}
            >
              <Text style={styles.filterBtnText}>
                {filtroEtapa === "Todas"
                  ? "🏆 Top Histórico General"
                  : `🐷 ${filtroEtapa}`}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#475569" />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#137E35"
            style={{ marginTop: 50 }}
          />
        ) : (
          <View style={styles.dashboardContent}>
            {/* TARJETA DE RECOMENDACIÓN INTELIGENTE */}
            {MEJOR_DIETA ? (
              <View style={styles.cardRecomendacion}>
                <View
                  style={{ flexDirection: "row", gap: 15, marginBottom: 15 }}
                >
                  <View style={styles.recomendacionIcon}>
                    <Ionicons name="bulb-outline" size={26} color="#0F172A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recomendacionTitle}>
                      La Mejor Opción para{" "}
                      {filtroEtapa === "Todas" ? "tu Granja" : filtroEtapa}
                    </Text>
                    <Text style={styles.recomendacionText}>
                      Revisando los registros de tus corrales, la comida{" "}
                      <Text style={{ fontWeight: "bold", color: "#0F172A" }}>
                        "{MEJOR_DIETA.nombre}"
                      </Text>{" "}
                      es la que mejor te rinde para los cerdos en{" "}
                      <Text style={{ fontWeight: "bold", color: "#0F172A" }}>
                        {MEJOR_DIETA.etapa}
                      </Text>
                      . Con esta mezcla, lograste que cada cerdo engordara unos{" "}
                      <Text style={styles.highlightGreen}>
                        {(MEJOR_DIETA.gmd / 1000).toFixed(2)} kilos diarios
                      </Text>
                      .
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.btnAplicar}
                  onPress={() => setModalOpen(true)}
                >
                  <Ionicons
                    name="document-text"
                    size={16}
                    color="#FFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.btnAplicarText}>Ver Receta Completa</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View
                style={[
                  styles.cardRecomendacion,
                  { backgroundColor: "#F8FAFC", borderLeftColor: "#94A3B8" },
                ]}
              >
                <Text style={styles.recomendacionTitle}>
                  No hay datos para esta etapa
                </Text>
                <Text style={styles.recomendacionText}>
                  Aún no has registrado pesajes o cerrado lotes en la etapa de{" "}
                  <Text style={{ fontWeight: "bold" }}>{filtroEtapa}</Text>.
                </Text>
              </View>
            )}

            {/* GRÁFICOS */}
            <View style={styles.chartsGrid}>
              {/* NUEVO: TOP 5 DIETAS (LISTA DE PROGRESO HORIZONTAL) */}
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>🏆 Top 5 Dietas</Text>
                <Text style={styles.chartSubtitle}>
                  Clasificación por Ganancia Media Diaria (GMD)
                </Text>

                <View style={styles.rankingContainer}>
                  {datosDietas.length > 0 ? (
                    datosDietas.map((dieta, index) => {
                      const percentage = (dieta.gmd / maxGMD) * 100;
                      return (
                        <View key={index} style={styles.rankingRow}>
                          <View style={styles.rankingHeader}>
                            <Text style={styles.rankingName} numberOfLines={1}>
                              <Text style={styles.rankingPosition}>
                                #{index + 1}
                              </Text>{" "}
                              {dieta.nombre}
                            </Text>
                            <Text style={styles.rankingValue}>
                              {dieta.gmd} g/día
                            </Text>
                          </View>
                          <View style={styles.progressBarBackground}>
                            <View
                              style={[
                                styles.progressBarFill,
                                { width: `${percentage}%` },
                              ]}
                            />
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <Text
                      style={{
                        color: "#94A3B8",
                        marginVertical: 20,
                        textAlign: "center",
                      }}
                    >
                      Sin datos suficientes
                    </Text>
                  )}
                </View>
              </View>

              {/* INSUMOS ESTRELLA */}
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>
                  ⭐ Insumos de Mayor Impacto
                </Text>
                <Text style={styles.chartSubtitle}>
                  Ingredientes repetidos en dietas exitosas.
                </Text>
                <View style={{ alignItems: "center", marginTop: 10 }}>
                  {datosInsumos.length > 0 ? (
                    <PieChart
                      data={pieChartData}
                      width={screenWidth - 60}
                      height={220}
                      chartConfig={chartConfig}
                      accessor={"population"}
                      backgroundColor={"transparent"}
                      paddingLeft={"0"}
                      center={[10, 0]}
                      absolute
                    />
                  ) : (
                    <Text style={{ color: "#94A3B8", marginVertical: 20 }}>
                      Sin datos suficientes
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* MODAL 1: FILTRO DE ETAPAS */}
      <Modal visible={modalFiltro} animationType="fade" transparent={true}>
        <View style={styles.modalOverlayDark}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Filtrar Ranking</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {opcionesFiltro.map((op) => (
                <TouchableOpacity
                  key={op}
                  style={[
                    styles.dropdownOptionBtn,
                    filtroEtapa === op && styles.dropdownOptionBtnActive,
                  ]}
                  onPress={() => {
                    setFiltroEtapa(op);
                    setModalFiltro(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      filtroEtapa === op && styles.dropdownOptionTextActive,
                    ]}
                  >
                    {op === "Todas" ? "🏆 Top Histórico General" : `🐷 ${op}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setModalFiltro(false)}
            >
              <Text style={styles.modalCancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: DETALLE DE RECETA */}
      {MEJOR_DIETA && (
        <Modal visible={isModalOpen} animationType="fade" transparent={true}>
          <View style={styles.modalOverlayDark}>
            <View style={styles.recipeModalBox}>
              <Text style={styles.recipeModalTitle}>
                📋 Detalle de la Receta
              </Text>
              <Text style={styles.recipeModalDesc}>
                Lleva esta información a tu bodega de alimentos.
              </Text>

              <View style={styles.recipeInfoBox}>
                <Text style={styles.recipeInfoText}>
                  <Text style={{ fontWeight: "bold" }}>Dieta:</Text>{" "}
                  {MEJOR_DIETA.nombre}
                </Text>
                <Text style={styles.recipeInfoText}>
                  <Text style={{ fontWeight: "bold" }}>Etapa Ideal:</Text>{" "}
                  {MEJOR_DIETA.etapa}
                </Text>
                <Text style={styles.recipeInfoText}>
                  <Text style={{ fontWeight: "bold" }}>
                    Rendimiento Esperado:{" "}
                  </Text>
                  <Text style={{ color: "#137E35", fontWeight: "900" }}>
                    +{(MEJOR_DIETA.gmd / 1000).toFixed(2)} kilos al día por
                    cerdo
                  </Text>
                </Text>
              </View>

              <Text style={styles.ingredientsTitle}>
                Ingredientes Clave a Mezclar:
              </Text>
              <View style={styles.ingredientsWrap}>
                {MEJOR_DIETA.ingredientesOriginales &&
                MEJOR_DIETA.ingredientesOriginales.length > 0 ? (
                  MEJOR_DIETA.ingredientesOriginales.map((ing, i) => (
                    <View key={i} style={styles.ingredientPill}>
                      <Text style={styles.ingredientPillText}>
                        {ing.trim()}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text
                    style={{
                      color: "#64748B",
                      fontStyle: "italic",
                      fontSize: 13,
                    }}
                  >
                    No se especificaron ingredientes.
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.recipeCloseBtn}
                onPress={() => setModalOpen(false)}
              >
                <Text style={styles.recipeCloseBtnText}>Cerrar Receta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
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

  headerSection: { flexDirection: "column", gap: 15, marginBottom: 20 },
  titleContainer: { flex: 1 },
  pageTitle: { fontSize: 24, fontWeight: "bold", color: "#0F172A" },
  pageSubtitle: { fontSize: 13, color: "#64748B", marginTop: 5 },

  filterContainer: { alignItems: "flex-start", marginTop: 5 },
  filterLabel: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "bold",
    marginBottom: 5,
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFF",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  filterBtnText: { fontSize: 13, color: "#0F172A", fontWeight: "bold" },

  dashboardContent: { gap: 20 },

  cardRecomendacion: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#FADBD8",
    borderLeftWidth: 6,
    borderLeftColor: "#F49F97",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  recomendacionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FEF9E7",
    justifyContent: "center",
    alignItems: "center",
  },
  recomendacionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 5,
  },
  recomendacionText: { fontSize: 13, color: "#475569", lineHeight: 20 },
  highlightGreen: { color: "#137E35", fontWeight: "bold" },
  btnAplicar: {
    flexDirection: "row",
    justifyContent: "center",
    backgroundColor: "#137E35",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 5,
  },
  btnAplicarText: { color: "#FFF", fontWeight: "bold", fontSize: 14 },

  chartsGrid: { gap: 20 },
  chartCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  chartTitle: { fontSize: 16, fontWeight: "bold", color: "#0F172A" },
  chartSubtitle: { fontSize: 12, color: "#64748B", marginTop: 2 },

  // Estilos del Nuevo Ranking List
  rankingContainer: { marginTop: 15 },
  rankingRow: { marginBottom: 15 },
  rankingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  rankingName: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "600",
    flex: 1,
    marginRight: 10,
  },
  rankingPosition: { color: "#137E35", fontWeight: "900", marginRight: 5 },
  rankingValue: { fontSize: 13, color: "#475569", fontWeight: "bold" },
  progressBarBackground: {
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#137E35",
    borderRadius: 4,
  },

  modalOverlayDark: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalBox: {
    width: "100%",
    maxWidth: 350,
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 15,
    textAlign: "center",
  },

  dropdownOptionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  dropdownOptionBtnActive: {
    backgroundColor: "#EFF6FF",
    borderBottomWidth: 0,
    borderRadius: 8,
  },
  dropdownOptionText: { fontSize: 14, color: "#334155" },
  dropdownOptionTextActive: { color: "#2563EB", fontWeight: "bold" },
  modalCancelBtn: {
    marginTop: 15,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
  },
  modalCancelBtnText: { color: "#64748B", fontWeight: "bold", fontSize: 13 },

  recipeModalBox: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 25,
  },
  recipeModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 5,
  },
  recipeModalDesc: { fontSize: 13, color: "#64748B", marginBottom: 20 },

  recipeInfoBox: {
    backgroundColor: "#F8FAFC",
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  recipeInfoText: { fontSize: 14, color: "#334155", marginBottom: 8 },

  ingredientsTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#334155",
    marginBottom: 10,
  },
  ingredientsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 25,
  },
  ingredientPill: {
    backgroundColor: "rgba(244, 159, 151, 0.2)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  ingredientPillText: { color: "#F49F97", fontSize: 12, fontWeight: "bold" },

  recipeCloseBtn: {
    backgroundColor: "#137E35",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  recipeCloseBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
});
