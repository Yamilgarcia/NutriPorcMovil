import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";
import SidebarMenu from "../components/SidebarMenu";

// 1. IMPORTAMOS LAS NUEVAS LIBRERÍAS DE PDF Y COMPARTIR
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

export default function FormuladorScreen() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  // Datos de Firebase
  const [lotes, setLotes] = useState([]);
  const [insumos, setInsumos] = useState([]);

  // Estados del Formulario
  const [selectedLote, setSelectedLote] = useState(null);
  const [modalLotes, setModalLotes] = useState(false);
  const [searchInsumo, setSearchInsumo] = useState("");
  const [selectedInsumos, setSelectedInsumos] = useState([]);

  // Estados de Resultados
  const [showResults, setShowResults] = useState(false);
  const [porcentajes, setPorcentajes] = useState({});

  // Planificación de Duración
  const [frecuenciaDia, setFrecuenciaDia] = useState(2);
  const [duracion, setDuracion] = useState("2");
  const [duracionTipo, setDuracionTipo] = useState("Semanas");

  const getRequerimientos = (etapa) => {
    switch (etapa) {
      case "Destete":
        return { proteina: 20, energia: 3200, consumoDiaKg: 0.8 };
      case "Desarrollo":
        return { proteina: 16, energia: 3100, consumoDiaKg: 1.8 };
      case "Engorde":
        return { proteina: 14, energia: 3000, consumoDiaKg: 2.8 };
      case "Gestación":
        return { proteina: 13, energia: 2900, consumoDiaKg: 2.2 };
      case "Lactancia":
        return { proteina: 15, energia: 3300, consumoDiaKg: 5.5 };
      case "Reproducción":
        return { proteina: 14, energia: 3000, consumoDiaKg: 2.5 };
      default:
        return { proteina: 15, energia: 3000, consumoDiaKg: 2.0 };
    }
  };

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
    });

    const qInsumos = query(
      collection(db, "insumos"),
      where("fincaId", "==", user.uid),
    );
    const unsubInsumos = onSnapshot(qInsumos, (snap) => {
      const iData = [];
      snap.forEach((doc) => iData.push({ id: doc.id, ...doc.data() }));
      setInsumos(iData);
      setLoading(false);
    });

    return () => {
      unsubLotes();
      unsubInsumos();
    };
  }, []);

  const toggleInsumo = (insumo) => {
    if (selectedInsumos.find((i) => i.id === insumo.id)) {
      setSelectedInsumos(selectedInsumos.filter((i) => i.id !== insumo.id));
    } else {
      setSelectedInsumos([...selectedInsumos, insumo]);
    }
    setShowResults(false);
  };

  const generarMezcla = () => {
    if (!selectedLote) {
      Alert.alert("Error", "Selecciona un lote destino.");
      return;
    }
    if (selectedInsumos.length === 0) {
      Alert.alert("Error", "Selecciona insumos.");
      return;
    }

    const porcInicial = 100 / selectedInsumos.length;
    const nuevosPorcentajes = {};
    selectedInsumos.forEach((ins) => {
      nuevosPorcentajes[ins.id] = porcInicial.toFixed(2);
    });
    setPorcentajes(nuevosPorcentajes);
    setShowResults(true);
  };

  const handlePorcentajeChange = (id, value) => {
    const cleanValue = value.replace(/[^0-9.]/g, "");
    setPorcentajes({ ...porcentajes, [id]: cleanValue });
  };

  const requerimientos = getRequerimientos(selectedLote?.etapa);
  let totalProteina = 0;
  let totalEnergia = 0;
  let costo100Lbs = 0;
  let sumaPorcentajes = 0;

  if (showResults) {
    selectedInsumos.forEach((ins) => {
      const p = parseFloat(porcentajes[ins.id]) || 0;
      sumaPorcentajes += p;
      totalProteina += (ins.proteina * p) / 100;
      totalEnergia += (ins.energia * p) / 100;
      costo100Lbs += ins.precioActual * p;
    });
  }

  const numDuracion = parseFloat(duracion) || 0;
  const diasTotal = duracionTipo === "Semanas" ? numDuracion * 7 : numDuracion;
  const loteKgDiario =
    (selectedLote?.cantidadActual || 0) * requerimientos.consumoDiaKg;
  const loteLbsDiario = loteKgDiario * 2.20462;

  const totalMezclaLbs = loteLbsDiario * diasTotal;
  const totalMezclaKg = loteKgDiario * diasTotal;
  const totalMezclaQQ = totalMezclaLbs / 100;

  const costoTotalEstimado = (totalMezclaLbs / 100) * costo100Lbs;
  const racionesTotales = diasTotal * frecuenciaDia;
  const racionPorComidaLbs =
    racionesTotales > 0 ? totalMezclaLbs / racionesTotales : 0;
  const racionPorComidaKg =
    racionesTotales > 0 ? totalMezclaKg / racionesTotales : 0;

  const insumosFiltrados = insumos.filter((i) =>
    i.nombre.toLowerCase().includes(searchInsumo.toLowerCase()),
  );

  // 2. FUNCIÓN GENERADORA DE PDF PROFESIONAL
  const generarYCompartirPDF = async () => {
    try {
      const htmlContent = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #2C3E50; }
              .header { text-align: center; border-bottom: 3px solid #8E2827; padding-bottom: 15px; margin-bottom: 30px; }
              .title { font-size: 28px; font-weight: 900; color: #8E2827; margin: 0; }
              .subtitle { font-size: 14px; color: #7F8C8D; margin-top: 5px; }
              .box { background-color: #F8F9F9; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #E0E0E0; }
              .box-green { background-color: #E8F6EF; border: 1px solid #27AE60; }
              .row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
              .label { font-weight: bold; color: #34495E; }
              .value { font-weight: bold; color: #27AE60; }
              h2 { font-size: 18px; color: #2C3E50; margin-bottom: 15px; border-bottom: 1px solid #BDC3C7; padding-bottom: 5px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { border: 1px solid #BDC3C7; padding: 12px; text-align: left; font-size: 14px; }
              th { background-color: #27AE60; color: #FFF; }
              tr:nth-child(even) { background-color: #F2F4F4; }
              .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #95A5A6; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 class="title">NutriPorc Pro</h1>
              <p class="subtitle">Reporte Oficial de Formulación de Dietas</p>
            </div>

            <div class="row">
              <div><span class="label">Lote Destino:</span> ${selectedLote?.nombre}</div>
              <div><span class="label">Etapa Biológica:</span> ${selectedLote?.etapa}</div>
              <div><span class="label">Población:</span> ${selectedLote?.cantidadActual} cerdos</div>
            </div>

            <div class="box box-green" style="margin-top: 20px;">
              <h2>Planificación y Costos Estimados</h2>
              <div class="row"><span class="label">Periodo Planificado:</span> <span>${duracion} ${duracionTipo}</span></div>
              <div class="row"><span class="label">Mezcla Total a Preparar:</span> <span class="value">${totalMezclaQQ.toFixed(2)} Quintales (${totalMezclaLbs.toFixed(1)} lbs)</span></div>
              <div class="row"><span class="label">Costo Total de Inversión:</span> <span class="value">C$ ${costoTotalEstimado.toFixed(2)}</span></div>
              <div class="row"><span class="label">Costo por 100 lbs:</span> <span>C$ ${costo100Lbs.toFixed(2)}</span></div>
            </div>

            <div class="box">
              <h2>Aporte Nutricional Logrado</h2>
              <div class="row"><span class="label">Proteína Bruta:</span> <span>${totalProteina.toFixed(2)}% (Req: ${requerimientos.proteina}%)</span></div>
              <div class="row"><span class="label">Energía:</span> <span>${totalEnergia.toFixed(0)} Kcal (Req: ${requerimientos.energia} Kcal)</span></div>
            </div>

            <h2>Hoja de Mezcla (Ingredientes a Comprar/Usar)</h2>
            <table>
              <tr>
                <th>Subproducto</th>
                <th>Proporción (%)</th>
                <th>Libras a mezclar (lbs)</th>
                <th>Quintales (qq)</th>
              </tr>
              ${selectedInsumos
                .map((ins) => {
                  const p = parseFloat(porcentajes[ins.id]) || 0;
                  const lbs = totalMezclaLbs * (p / 100);
                  const qq = lbs / 100;
                  return `
                <tr>
                  <td><strong>${ins.nombre}</strong></td>
                  <td>${p.toFixed(2)}%</td>
                  <td>${lbs.toFixed(2)} lbs</td>
                  <td>${qq.toFixed(2)} qq</td>
                </tr>
                `;
                })
                .join("")}
            </table>

            <div class="footer">
              Generado automáticamente por NutriPorc Pro - Inteligencia Nutricional
            </div>
          </body>
        </html>
      `;

      // Generar el archivo físico temporal en la memoria del celular
      const { uri } = await Print.printToFileAsync({ html: htmlContent });

      // Levantar el menú nativo para compartir (WhatsApp, Guardar Archivos, Drive, etc)
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          UTI: ".pdf",
          mimeType: "application/pdf",
        });
      } else {
        Alert.alert("Listo", "El PDF se generó en la ruta: " + uri);
      }
    } catch (error) {
      Alert.alert("Error", "Hubo un problema al generar el documento PDF.");
      console.error(error);
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
        currentRoute="/formulador"
      />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Formulador de Dietas</Text>
          <Text style={styles.pageSubtitle}>
            Genera raciones de mínimo costo basadas en los requerimientos
            nutricionales.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#27AE60"
            style={{ marginTop: 50 }}
          />
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Configurar Ración</Text>

              <Text style={styles.inputLabel}>Seleccionar Lote Destino:</Text>
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
                    ? `${selectedLote.nombre} (Etapa: ${selectedLote.etapa})`
                    : "-- Selecciona un lote --"}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#7F8C8D" />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>
                Insumos Disponibles (Marca para incluir en la mezcla):
              </Text>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color="#7F8C8D" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar insumo..."
                  value={searchInsumo}
                  onChangeText={setSearchInsumo}
                />
              </View>

              <View style={styles.insumosGrid}>
                {insumosFiltrados.map((insumo) => {
                  const isSelected = selectedInsumos.find(
                    (i) => i.id === insumo.id,
                  );
                  return (
                    <TouchableOpacity
                      key={insumo.id}
                      style={[
                        styles.insumoChip,
                        isSelected && styles.insumoChipSelected,
                      ]}
                      onPress={() => toggleInsumo(insumo)}
                    >
                      <Ionicons
                        name={isSelected ? "checkbox" : "square-outline"}
                        size={18}
                        color={isSelected ? "#27AE60" : "#BDC3C7"}
                      />
                      <Text
                        style={[
                          styles.insumoChipText,
                          isSelected && styles.insumoChipTextSelected,
                        ]}
                      >
                        {insumo.nombre}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.selectionCount}>
                {selectedInsumos.length} seleccionados
              </Text>

              <TouchableOpacity
                style={[
                  styles.generateBtn,
                  selectedInsumos.length > 0 && selectedLote
                    ? styles.generateBtnActive
                    : {},
                ]}
                onPress={generarMezcla}
              >
                <Text style={styles.generateBtnText}>
                  Generar Mezcla Sugerida
                </Text>
              </TouchableOpacity>
            </View>

            {showResults && (
              <View style={styles.cardResults}>
                <Text style={styles.cardTitle}>Hoja de Mezcla</Text>

                <View style={styles.yellowBanner}>
                  <View>
                    <Text style={styles.bannerTitle}>Receta Sugerida</Text>
                    <Text style={styles.bannerSubtitle}>
                      Base de cálculo: 100 lbs
                    </Text>
                  </View>
                  <Text style={styles.bannerTag}>Interactivo</Text>
                </View>

                <View style={styles.progressContainer}>
                  <View style={styles.progressRow}>
                    <Text style={styles.progressLabel}>Proteína Bruta</Text>
                    <Text style={styles.progressValues}>
                      {totalProteina.toFixed(2)}% / {requerimientos.proteina}%
                    </Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min((totalProteina / requerimientos.proteina) * 100, 100)}%`,
                          backgroundColor:
                            totalProteina >= requerimientos.proteina
                              ? "#27AE60"
                              : "#3498DB",
                        },
                      ]}
                    />
                  </View>

                  <View style={[styles.progressRow, { marginTop: 15 }]}>
                    <Text style={styles.progressLabel}>Energía (Kcal)</Text>
                    <Text style={styles.progressValues}>
                      {totalEnergia.toFixed(0)} / {requerimientos.energia}
                    </Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min((totalEnergia / requerimientos.energia) * 100, 100)}%`,
                          backgroundColor:
                            totalEnergia >= requerimientos.energia
                              ? "#27AE60"
                              : "#2C3E50",
                        },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.divider} />

                <Text style={[styles.inputLabel, { marginBottom: 15 }]}>
                  Ajuste manual de fórmula ({sumaPorcentajes.toFixed(1)}% /
                  100%):
                </Text>
                {selectedInsumos.map((ins) => (
                  <View key={ins.id} style={styles.sliderRow}>
                    <Text style={styles.sliderLabel} numberOfLines={1}>
                      {ins.nombre}
                    </Text>
                    <View style={styles.sliderControls}>
                      <View style={styles.fakeSliderLine}>
                        <View
                          style={[
                            styles.fakeSliderThumb,
                            {
                              left: `${Math.min(parseFloat(porcentajes[ins.id] || 0), 100)}%`,
                            },
                          ]}
                        />
                      </View>
                      <TextInput
                        style={styles.percentInput}
                        value={String(porcentajes[ins.id] || "")}
                        onChangeText={(t) => handlePorcentajeChange(ins.id, t)}
                        keyboardType="numeric"
                      />
                      <Text style={{ fontSize: 12, color: "#7F8C8D" }}>%</Text>
                    </View>
                  </View>
                ))}

                <View style={styles.costBanner}>
                  <View>
                    <Text style={styles.costLabel}>Peso Total Mezcla</Text>
                    <Text style={styles.costValueTitle}>
                      {sumaPorcentajes.toFixed(0)}%
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.costLabel}>Costo x 100 lbs</Text>
                    <Text style={styles.costValueTitle}>
                      C$ {costo100Lbs.toFixed(2)}
                    </Text>
                  </View>
                </View>

                <View style={styles.planCard}>
                  <Text style={styles.planTitle}>
                    Plan de Alimentación Diaria
                  </Text>
                  <View
                    style={{ flexDirection: "row", gap: 10, marginTop: 10 }}
                  >
                    <View style={styles.planBox}>
                      <Text style={styles.planBoxLabel}>Por Cerdo</Text>
                      <Text style={styles.planBoxValue}>
                        {requerimientos.consumoDiaKg} kg
                      </Text>
                    </View>
                    <View style={[styles.planBox, { borderColor: "#FADBD8" }]}>
                      <Text style={styles.planBoxLabel}>
                        Lote ({selectedLote?.cantidadActual} cerdos)
                      </Text>
                      <Text style={[styles.planBoxValue, { color: "#2C3E50" }]}>
                        {loteKgDiario.toFixed(1)} kg
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.analysisCard}>
                  <View style={styles.addFormHeader}>
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color="#2C3E50"
                    />
                    <Text style={styles.addFormTitle}>
                      Análisis de Duración y Planificación
                    </Text>
                  </View>
                  <Text style={styles.analysisDesc}>
                    Calcula cuánto alimento preparar y qué cantidad de cada
                    insumo comprar para una duración objetivo.
                  </Text>

                  <View style={styles.durationInputRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Duración deseada:</Text>
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <TextInput
                          style={[
                            styles.modalInput,
                            { flex: 1, marginBottom: 0 },
                          ]}
                          value={duracion}
                          onChangeText={(t) =>
                            setDuracion(t.replace(/[^0-9]/g, ""))
                          }
                          keyboardType="numeric"
                        />
                        <TouchableOpacity
                          style={[
                            styles.modalInput,
                            {
                              flex: 1.5,
                              marginBottom: 0,
                              justifyContent: "center",
                            },
                          ]}
                          onPress={() =>
                            setDuracionTipo(
                              duracionTipo === "Semanas" ? "Días" : "Semanas",
                            )
                          }
                        >
                          <Text style={{ color: "#2C3E50" }}>
                            {duracionTipo}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={styles.durationInputRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>
                        Frecuencia de alimentación al día:
                      </Text>
                      <View style={styles.freqControls}>
                        <TouchableOpacity
                          style={styles.freqBtn}
                          onPress={() =>
                            setFrecuenciaDia(Math.max(1, frecuenciaDia - 1))
                          }
                        >
                          <Text style={styles.freqBtnText}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.freqValue}>
                          {frecuenciaDia} comidas
                        </Text>
                        <TouchableOpacity
                          style={styles.freqBtn}
                          onPress={() => setFrecuenciaDia(frecuenciaDia + 1)}
                        >
                          <Text style={styles.freqBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={styles.totalsBox}>
                    <Text style={styles.totalsTitle}>
                      Total de mezcla a preparar:
                    </Text>
                    <Text style={styles.totalsBigGreen}>
                      {totalMezclaQQ.toFixed(2)} qq
                    </Text>
                    <Text style={styles.totalsSub}>
                      ({totalMezclaLbs.toFixed(1)} lbs /{" "}
                      {totalMezclaKg.toFixed(0)} kg)
                    </Text>

                    <View style={styles.totalsGrid}>
                      <View style={styles.totalsCol}>
                        <Text style={styles.totalsLabel}>COSTO ESTIMADO</Text>
                        <Text style={styles.totalsValueGreen}>
                          C$ {costoTotalEstimado.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.totalsCol}>
                        <Text style={styles.totalsLabel}>RACIONES TOTALES</Text>
                        <Text style={styles.totalsValueGreen}>
                          {racionesTotales} comidas
                        </Text>
                      </View>
                    </View>

                    <View style={{ marginTop: 15 }}>
                      <Text style={styles.totalsLabel}>
                        RACIÓN PARA EL LOTE POR COMIDA:
                      </Text>
                      <Text style={styles.totalsValueGreen}>
                        {racionPorComidaKg.toFixed(1)} kg /{" "}
                        {racionPorComidaLbs.toFixed(1)} lbs
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.inputLabel,
                      { marginTop: 20, marginBottom: 10 },
                    ]}
                  >
                    Ingredientes para preparar (Mezcla de lote):
                  </Text>
                  {selectedInsumos.map((ins) => {
                    const p = parseFloat(porcentajes[ins.id]) || 0;
                    const lbsNecesarias = totalMezclaLbs * (p / 100);
                    const qqNecesarios = lbsNecesarias / 100;
                    const kgNecesarios = lbsNecesarias / 2.20462;
                    return (
                      <View key={ins.id} style={styles.ingredientReqBox}>
                        <Text style={styles.ingReqTitle}>{ins.nombre}</Text>
                        <Text style={styles.ingReqSub}>
                          {p.toFixed(2)}% de la mezcla
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "flex-end",
                            marginTop: 10,
                          }}
                        >
                          <Text style={styles.ingReqBigGreen}>
                            {qqNecesarios.toFixed(2)} qq
                          </Text>
                          <Text style={styles.ingReqSub}>
                            ({lbsNecesarias.toFixed(1)} lbs /{" "}
                            {kgNecesarios.toFixed(1)} kg)
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* 3. BOTÓN CONECTADO A LA FUNCIÓN DE GENERAR PDF */}
                <TouchableOpacity
                  style={styles.printBtn}
                  onPress={generarYCompartirPDF}
                >
                  <Ionicons name="print-outline" size={18} color="#27AE60" />
                  <Text style={styles.printBtnText}>
                    Imprimir / Exportar PDF
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={modalLotes} animationType="slide" transparent={true}>
        <View style={styles.modalCenter}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Selecciona un Lote Destino</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {lotes.map((lote) => (
                <TouchableOpacity
                  key={lote.id}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedLote(lote);
                    setModalLotes(false);
                    setShowResults(false);
                  }}
                >
                  <Text style={styles.dropdownItemTitle}>{lote.nombre}</Text>
                  <Text style={styles.dropdownItemSub}>
                    Etapa: {lote.etapa} | Población: {lote.cantidadActual}
                  </Text>
                </TouchableOpacity>
              ))}
              {lotes.length === 0 && (
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
  pageTitle: { fontSize: 24, fontWeight: "bold", color: "#2C3E50" },
  pageSubtitle: { fontSize: 12, color: "#7F8C8D", marginTop: 5 },

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
  cardResults: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 40,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 20,
  },

  inputLabel: {
    fontSize: 13,
    color: "#2C3E50",
    fontWeight: "bold",
    marginBottom: 8,
  },
  dropdownBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DFE6E9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  dropdownText: { fontSize: 14, color: "#2C3E50" },
  dropdownTextPlaceholder: { fontSize: 14, color: "#95a5a6" },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#DFE6E9",
    marginBottom: 15,
  },
  searchInput: { flex: 1, paddingVertical: 10, paddingLeft: 8, fontSize: 14 },

  insumosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },
  insumoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FDEDEC",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
    width: "48%",
  },
  insumoChipSelected: { backgroundColor: "#E8F6EF", borderColor: "#27AE60" },
  insumoChipText: { fontSize: 12, color: "#2C3E50", flex: 1 },
  insumoChipTextSelected: { fontWeight: "bold", color: "#27AE60" },
  selectionCount: {
    fontSize: 11,
    color: "#7F8C8D",
    textAlign: "right",
    marginBottom: 20,
  },

  generateBtn: {
    backgroundColor: "#BDC3C7",
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  generateBtnActive: { backgroundColor: "#85B695" },
  generateBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },

  yellowBanner: {
    backgroundColor: "#FEF9E7",
    padding: 15,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  bannerTitle: { fontSize: 16, fontWeight: "bold", color: "#2C3E50" },
  bannerSubtitle: { fontSize: 12, color: "#7F8C8D", marginTop: 2 },
  bannerTag: { fontSize: 12, fontWeight: "bold", color: "#2C3E50" },

  progressContainer: { marginBottom: 20 },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  progressLabel: { fontSize: 13, color: "#7F8C8D", fontWeight: "bold" },
  progressValues: { fontSize: 13, color: "#2C3E50", fontWeight: "bold" },
  progressBarBg: {
    height: 10,
    backgroundColor: "#ECF0F1",
    borderRadius: 5,
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", borderRadius: 5 },
  divider: { height: 1, backgroundColor: "#ECF0F1", marginVertical: 20 },

  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  sliderLabel: { flex: 1, fontSize: 13, color: "#2C3E50" },
  sliderControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1.5,
  },
  fakeSliderLine: {
    flex: 1,
    height: 4,
    backgroundColor: "#FADBD8",
    borderRadius: 2,
    position: "relative",
  },
  fakeSliderThumb: {
    width: 14,
    height: 14,
    backgroundColor: "#F1948A",
    borderRadius: 7,
    position: "absolute",
    top: -5,
    marginLeft: -7,
  },
  percentInput: {
    borderWidth: 1,
    borderColor: "#DFE6E9",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    width: 50,
    textAlign: "center",
    fontSize: 12,
  },

  costBanner: {
    backgroundColor: "#FEF9E7",
    padding: 20,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 20,
  },
  costLabel: { fontSize: 11, color: "#7F8C8D", marginBottom: 5 },
  costValueTitle: { fontSize: 22, fontWeight: "900", color: "#2C3E50" },

  planCard: {
    borderWidth: 1,
    borderColor: "#D5F5E3",
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  planTitle: { fontSize: 14, fontWeight: "bold", color: "#2C3E50" },
  planBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#FADBD8",
    borderRadius: 8,
    padding: 12,
  },
  planBoxLabel: { fontSize: 11, color: "#7F8C8D", marginBottom: 5 },
  planBoxValue: { fontSize: 18, fontWeight: "bold", color: "#E74C3C" },

  analysisCard: {
    backgroundColor: "#FADBD8",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  addFormHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  addFormTitle: { fontSize: 15, fontWeight: "bold", color: "#2C3E50" },
  analysisDesc: {
    fontSize: 12,
    color: "#2C3E50",
    marginBottom: 20,
    lineHeight: 18,
  },
  durationInputRow: { marginBottom: 15 },
  modalInput: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#DFE6E9",
    borderRadius: 8,
    padding: 10,
    color: "#2C3E50",
  },
  freqControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DFE6E9",
  },
  freqBtn: { padding: 12, paddingHorizontal: 20 },
  freqBtnText: { fontSize: 18, color: "#7F8C8D", fontWeight: "bold" },
  freqValue: {
    flex: 1,
    textAlign: "center",
    fontSize: 14,
    color: "#27AE60",
    fontWeight: "bold",
  },

  totalsBox: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 20,
    marginTop: 10,
  },
  totalsTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 5,
  },
  totalsBigGreen: { fontSize: 28, fontWeight: "900", color: "#27AE60" },
  totalsSub: {
    fontSize: 12,
    color: "#2C3E50",
    fontWeight: "bold",
    marginBottom: 20,
  },
  totalsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#ECF0F1",
    paddingTop: 15,
  },
  totalsCol: { flex: 1 },
  totalsLabel: {
    fontSize: 10,
    color: "#2C3E50",
    fontWeight: "bold",
    marginBottom: 5,
  },
  totalsValueGreen: { fontSize: 16, color: "#27AE60", fontWeight: "bold" },

  ingredientReqBox: {
    backgroundColor: "#FFF",
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  ingReqTitle: { fontSize: 14, fontWeight: "bold", color: "#2C3E50" },
  ingReqSub: { fontSize: 11, color: "#7F8C8D", marginTop: 2 },
  ingReqBigGreen: { fontSize: 18, fontWeight: "bold", color: "#27AE60" },

  printBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 2,
    borderColor: "#27AE60",
    paddingVertical: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  printBtnText: { color: "#27AE60", fontWeight: "bold", fontSize: 14 },

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
