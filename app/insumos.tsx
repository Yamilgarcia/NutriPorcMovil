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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";
import SidebarMenu from "../components/SidebarMenu";

export default function InsumosScreen() {
  // Estados Globales
  const [menuVisible, setMenuVisible] = useState(false);
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("A-Z"); // 'A-Z' o 'Z-A'

  // Estados de Formulario: Nuevo Insumo
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoProteina, setNuevoProteina] = useState("");
  const [nuevoEnergia, setNuevoEnergia] = useState("");
  const [nuevoFibra, setNuevoFibra] = useState("");
  const [nuevoCosto, setNuevoCosto] = useState("");

  // Estados Interactivos de Tarjetas (Edición en línea y Eliminación)
  const [editingId, setEditingId] = useState(null);
  const [editCosto, setEditCosto] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  // =========================================================================
  // FUNCIONES DE VALIDACIÓN
  // =========================================================================

  // Permite letras, números, espacios, porcentaje y paréntesis (Ej: "Harina de Soya (48%)")
  const formatNombreInsumo = (text) => {
    return text.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s()%]/g, "");
  };

  // Permite números y un solo punto decimal (Ej: "2.5" o "3500")
  const formatDecimales = (text) => {
    let formatted = text.replace(/[^0-9.]/g, "");
    const parts = formatted.split(".");
    if (parts.length > 2) {
      formatted = parts[0] + "." + parts.slice(1).join("");
    }
    return formatted;
  };

  // =========================================================================
  // LECTURA DE DATOS (READ)
  // =========================================================================

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Consultamos los insumos de esta finca específica
    const q = query(
      collection(db, "insumos"),
      where("fincaId", "==", user.uid),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const insumosData = [];
        snapshot.forEach((doc) => {
          insumosData.push({ id: doc.id, ...doc.data() });
        });
        setInsumos(insumosData);
        setLoading(false);
      },
      (error) => {
        Alert.alert("Error", "No se pudieron cargar los insumos.");
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  // =========================================================================
  // OPERACIONES CRUD
  // =========================================================================

  const handleCrearInsumo = async () => {
    if (
      !nuevoNombre ||
      !nuevoProteina ||
      !nuevoEnergia ||
      !nuevoFibra ||
      !nuevoCosto
    ) {
      Alert.alert("Incompleto", "Por favor llena todos los campos del insumo.");
      return;
    }

    try {
      const user = auth.currentUser;
      await addDoc(collection(db, "insumos"), {
        fincaId: user.uid,
        nombre: nuevoNombre,
        proteina: Number(nuevoProteina),
        energia: Number(nuevoEnergia),
        fibra: Number(nuevoFibra),
        precioActual: Number(nuevoCosto),
        origen: "PROPIO", // Etiqueta para permitir eliminación (igual que tu mockup)
        fechaCreacion: new Date().toISOString(),
      });

      // Limpiar formulario tras guardar
      setNuevoNombre("");
      setNuevoProteina("");
      setNuevoEnergia("");
      setNuevoFibra("");
      setNuevoCosto("");
    } catch (error) {
      Alert.alert("Error", "No se pudo añadir el insumo.");
    }
  };

  const handleActualizarPrecio = async (id) => {
    if (!editCosto) {
      Alert.alert("Inválido", "Ingresa un precio válido.");
      return;
    }
    try {
      await updateDoc(doc(db, "insumos", id), {
        precioActual: Number(editCosto),
      });
      setEditingId(null);
      setEditCosto("");
    } catch (error) {
      Alert.alert("Error", "No se pudo actualizar el precio.");
    }
  };

  const handleEliminarInsumo = async (id) => {
    try {
      await deleteDoc(doc(db, "insumos", id));
      setDeletingId(null);
    } catch (error) {
      Alert.alert("Error", "No se pudo eliminar el insumo.");
    }
  };

  // =========================================================================
  // LÓGICA DE FILTROS Y ORDENAMIENTO
  // =========================================================================

  const insumosFiltrados = insumos
    .filter((item) =>
      item.nombre.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => {
      if (sortOrder === "A-Z") return a.nombre.localeCompare(b.nombre);
      if (sortOrder === "Z-A") return b.nombre.localeCompare(a.nombre);
      return 0;
    });

  // =========================================================================
  // RENDERIZADO
  // =========================================================================

  return (
    <View style={styles.mainContainer}>
      {/* HEADER + SIDEBAR MENU */}
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
        currentRoute="/insumos"
      />

      <ScrollView contentContainerStyle={styles.container}>
        {/* BARRA DE BÚSQUEDA Y ORDEN */}
        <View style={styles.filterSection}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#7F8C8D" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar subproducto..."
              placeholderTextColor="#7F8C8D"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity
            style={styles.sortBtn}
            onPress={() => setSortOrder(sortOrder === "A-Z" ? "Z-A" : "A-Z")}
          >
            <Text style={styles.sortBtnText}>Ordenar {sortOrder}</Text>
            <Ionicons name="swap-vertical" size={14} color="#2C3E50" />
          </TouchableOpacity>
        </View>

        {/* FORMULARIO: AÑADIR NUEVO SUBPRODUCTO */}
        <View style={styles.addFormContainer}>
          <View style={styles.addFormHeader}>
            <Ionicons name="add-circle-outline" size={20} color="#2C3E50" />
            <Text style={styles.addFormTitle}>Añadir Nuevo Subproducto</Text>
          </View>

          <View style={styles.addFormGrid}>
            <TextInput
              style={styles.addInput}
              placeholder="Nombre (ej. Suero)"
              placeholderTextColor="#7F8C8D"
              value={nuevoNombre}
              onChangeText={(t) => setNuevoNombre(formatNombreInsumo(t))}
            />
            <View style={styles.addInputRow}>
              <TextInput
                style={[styles.addInput, { flex: 1 }]}
                placeholder="% Proteína"
                placeholderTextColor="#7F8C8D"
                value={nuevoProteina}
                onChangeText={(t) => setNuevoProteina(formatDecimales(t))}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.addInput, { flex: 1 }]}
                placeholder="Energía (Kcal)"
                placeholderTextColor="#7F8C8D"
                value={nuevoEnergia}
                onChangeText={(t) => setNuevoEnergia(formatDecimales(t))}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.addInputRow}>
              <TextInput
                style={[styles.addInput, { flex: 1 }]}
                placeholder="% Fibra"
                placeholderTextColor="#7F8C8D"
                value={nuevoFibra}
                onChangeText={(t) => setNuevoFibra(formatDecimales(t))}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.addInput, { flex: 1 }]}
                placeholder="Costo C$/lb"
                placeholderTextColor="#7F8C8D"
                value={nuevoCosto}
                onChangeText={(t) => setNuevoCosto(formatDecimales(t))}
                keyboardType="numeric"
              />
            </View>
            <TouchableOpacity
              style={styles.saveAddBtn}
              onPress={handleCrearInsumo}
            >
              <Text style={styles.saveAddBtnText}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* LISTADO DE TARJETAS */}
        {loading ? (
          <ActivityIndicator
            size="large"
            color="#27AE60"
            style={{ marginTop: 50 }}
          />
        ) : (
          <View style={styles.cardsGrid}>
            {insumosFiltrados.map((item) => {
              const isEditing = editingId === item.id;
              const isDeleting = deletingId === item.id;

              // ESTADO 1: CONFIRMACIÓN DE ELIMINACIÓN
              if (isDeleting) {
                return (
                  <View
                    key={item.id}
                    style={[styles.card, styles.cardDeleting]}
                  >
                    <Ionicons
                      name="warning"
                      size={32}
                      color="#E74C3C"
                      style={{ alignSelf: "center", marginBottom: 10 }}
                    />
                    <Text style={styles.deleteTitle}>¿Eliminar Insumo?</Text>
                    <Text style={styles.deleteDesc}>
                      Borrarás {item.nombre} de tu inventario. Esta acción no se
                      puede deshacer.
                    </Text>
                    <View style={styles.deleteActions}>
                      <TouchableOpacity
                        style={styles.deleteCancelBtn}
                        onPress={() => setDeletingId(null)}
                      >
                        <Text style={styles.deleteCancelBtnText}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteConfirmBtn}
                        onPress={() => handleEliminarInsumo(item.id)}
                      >
                        <Text style={styles.deleteConfirmBtnText}>
                          Sí, Eliminar
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }

              // ESTADO 2: LECTURA Y EDICIÓN
              return (
                <View
                  key={item.id}
                  style={[styles.card, isEditing && styles.cardEditing]}
                >
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{item.nombre}</Text>
                      <View style={styles.badgeRow}>
                        <View
                          style={[
                            styles.badge,
                            item.origen === "PROPIO"
                              ? styles.badgePropio
                              : styles.badgeApp,
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              item.origen === "PROPIO"
                                ? styles.badgeTextPropio
                                : styles.badgeTextApp,
                            ]}
                          >
                            {item.origen}
                          </Text>
                        </View>
                        {item.origen === "PROPIO" && !isEditing && (
                          <TouchableOpacity
                            onPress={() => setDeletingId(item.id)}
                            style={styles.deleteIconBtn}
                          >
                            <Text style={styles.deleteIconText}>X</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>

                  <View style={styles.nutritionInfo}>
                    <View style={styles.nutriRow}>
                      <Text style={styles.nutriLabel}>Proteína:</Text>
                      <Text style={styles.nutriValue}>{item.proteina}%</Text>
                    </View>
                    <View style={styles.nutriRow}>
                      <Text style={styles.nutriLabel}>Energía:</Text>
                      <Text style={styles.nutriValue}>{item.energia} Kcal</Text>
                    </View>
                    <View style={styles.nutriRow}>
                      <Text style={styles.nutriLabel}>Fibra:</Text>
                      <Text style={styles.nutriValue}>{item.fibra}%</Text>
                    </View>
                  </View>

                  <View style={styles.priceContainer}>
                    <Text style={styles.priceLabel}>
                      Precio Actual (C$/lb):
                    </Text>
                    {isEditing ? (
                      <TextInput
                        style={styles.priceInputEditing}
                        value={editCosto}
                        onChangeText={(t) => setEditCosto(formatDecimales(t))}
                        keyboardType="numeric"
                        autoFocus
                      />
                    ) : (
                      <TouchableOpacity
                        style={styles.priceInputBox}
                        onPress={() => {
                          setEditingId(item.id);
                          setEditCosto(item.precioActual.toString());
                        }}
                      >
                        <Text style={styles.priceInputValue}>
                          {item.precioActual}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {isEditing && (
                    <View style={styles.editActions}>
                      <TouchableOpacity
                        style={styles.editCancelBtn}
                        onPress={() => setEditingId(null)}
                      >
                        <Text style={styles.editCancelBtnText}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.editConfirmBtn}
                        onPress={() => handleActualizarPrecio(item.id)}
                      >
                        <Ionicons name="checkmark" size={14} color="#FFF" />
                        <Text style={styles.editConfirmBtnText}>Confirmar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}

            {insumosFiltrados.length === 0 && (
              <Text style={styles.emptyText}>No se encontraron insumos.</Text>
            )}
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

  // Filtros
  filterSection: { flexDirection: "row", gap: 10, marginBottom: 20 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  searchInput: { flex: 1, paddingVertical: 10, paddingLeft: 8, fontSize: 14 },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    gap: 5,
  },
  sortBtnText: { fontSize: 13, color: "#2C3E50" },

  // Formulario Añadir (Fondo Verde)
  addFormContainer: {
    backgroundColor: "#85B695",
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  addFormHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 15,
  },
  addFormTitle: { fontSize: 16, fontWeight: "bold", color: "#2C3E50" },
  addFormGrid: { gap: 10 },
  addInputRow: { flexDirection: "row", gap: 10 },
  addInput: {
    backgroundColor: "#FFF",
    borderRadius: 6,
    padding: 10,
    fontSize: 13,
    color: "#2C3E50",
  },
  saveAddBtn: {
    backgroundColor: "#F1948A",
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 5,
  },
  saveAddBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 14 },

  // Cuadrícula de Tarjetas
  cardsGrid: { gap: 15 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },

  // Estado Edición
  cardEditing: { borderColor: "#F39C12", borderWidth: 2 },

  // Estado Eliminar
  cardDeleting: {
    backgroundColor: "#FDEDEC",
    borderColor: "#E74C3C",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#E74C3C",
    marginBottom: 5,
  },
  deleteDesc: {
    fontSize: 12,
    color: "#C0392B",
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  deleteActions: { flexDirection: "row", gap: 10 },
  deleteCancelBtn: {
    backgroundColor: "#FFF",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  deleteCancelBtnText: { color: "#7F8C8D", fontWeight: "bold" },
  deleteConfirmBtn: {
    backgroundColor: "#E74C3C",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 6,
  },
  deleteConfirmBtnText: { color: "#FFF", fontWeight: "bold" },

  // Contenido de Tarjeta
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 4,
  },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeApp: { backgroundColor: "#FDEDEC" },
  badgeTextApp: { color: "#E74C3C", fontSize: 9, fontWeight: "bold" },
  badgePropio: { backgroundColor: "#FEF9E7" },
  badgeTextPropio: { color: "#F39C12", fontSize: 9, fontWeight: "bold" },
  deleteIconBtn: {
    backgroundColor: "#FDEDEC",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  deleteIconText: { color: "#E74C3C", fontSize: 10, fontWeight: "bold" },

  nutritionInfo: { marginBottom: 15, gap: 5 },
  nutriRow: { flexDirection: "row", justifyContent: "space-between" },
  nutriLabel: { fontSize: 12, color: "#7F8C8D" },
  nutriValue: { fontSize: 12, color: "#2C3E50", fontWeight: "600" },

  priceContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 5,
  },
  priceLabel: { fontSize: 13, color: "#2C3E50", fontWeight: "500" },
  priceInputBox: {
    borderWidth: 1,
    borderColor: "#DFE6E9",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 15,
    minWidth: 60,
    alignItems: "center",
  },
  priceInputValue: { fontSize: 13, color: "#2C3E50", fontWeight: "bold" },
  priceInputEditing: {
    borderWidth: 2,
    borderColor: "#F39C12",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 60,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "bold",
    color: "#2C3E50",
    backgroundColor: "#FFF",
  },

  editActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
    gap: 10,
  },
  editCancelBtn: {
    flex: 1,
    backgroundColor: "#F1F2F6",
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  editCancelBtnText: { color: "#7F8C8D", fontSize: 12, fontWeight: "bold" },
  editConfirmBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#27AE60",
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  editConfirmBtnText: { color: "#FFF", fontSize: 12, fontWeight: "bold" },

  emptyText: { textAlign: "center", marginTop: 20, color: "#7F8C8D" },
});
