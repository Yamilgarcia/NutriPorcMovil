import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import SidebarMenu from "../components/SidebarMenu";
export default function DashboardScreen() {
  const router = useRouter();

  // Estados de la interfaz
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false); // Estado para el menú lateral

  // Estados de los datos (CRUD Perfil)
  const [userData, setUserData] = useState(null);
  const [nombreFinca, setNombreFinca] = useState("");
  const [productor, setProductor] = useState("");
  const [ubicacion, setUbicacion] = useState("");

  // Estados Dinámicos de Estadísticas
  const [cerdosActivos, setCerdosActivos] = useState(0);
  const [lotesCerrados, setLotesCerrados] = useState(0);

  // Cargar datos al iniciar
  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        router.replace("/");
        return;
      }

      const docRef = doc(db, "fincas", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);
        setNombreFinca(data.nombreFinca || "");
        setProductor(data.productor || "");
        setUbicacion(data.ubicacion || "");

        setCerdosActivos(data.cerdosActivos || 0);
        setLotesCerrados(data.lotesCerrados || 0);
      }
    } catch (error) {
      Alert.alert("Error", "No se pudieron cargar los datos de la finca.");
    } finally {
      setLoading(false);
    }
  };

  // Guardar cambios
  const handleSaveChanges = async () => {
    if (!nombreFinca || !productor || !ubicacion) {
      Alert.alert(
        "Campos vacíos",
        "Por favor llena todos los campos de la granja.",
      );
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      const docRef = doc(db, "fincas", user.uid);

      await updateDoc(docRef, {
        nombreFinca,
        productor,
        ubicacion,
      });

      setUserData({ ...userData, nombreFinca, productor, ubicacion });
      setIsEditing(false);
      Alert.alert("Éxito", "Perfil actualizado correctamente.");
    } catch (error) {
      Alert.alert("Error", "No se pudieron guardar los cambios.");
    } finally {
      setLoading(false);
    }
  };

  // Purgar cuenta
  const handleDeleteAccount = () => {
    Alert.alert(
      "Zona de Peligro",
      "¿Estás seguro de que deseas eliminar tu cuenta y todos los datos de la finca? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const user = auth.currentUser;
              if (user) {
                await deleteDoc(doc(db, "fincas", user.uid));
                await user.delete();
                Alert.alert("Cuenta Eliminada", "Tus datos han sido purgados.");
                router.replace("/");
              }
            } catch (error) {
              Alert.alert(
                "Error",
                "Necesitas volver a iniciar sesión para realizar esta acción por seguridad.",
              );
            }
          },
        },
      ],
    );
  };

  const navigateTo = (route) => {
    setMenuVisible(false);
    if (route) router.replace(route);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#27AE60" />
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      {/* HEADER PERSONALIZADO */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setMenuVisible(true)} // Ahora sí abre el menú
        >
          <Ionicons name="menu" size={28} color="#27AE60" />
        </TouchableOpacity>
        <Text style={styles.headerLogo}>NutriPorc 🐷</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* MENÚ LATERAL TIPO HAMBURGUESA (ALINEADO A LA IZQUIERDA) */}
      <SidebarMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        currentRoute="/dashboard"
      />

      {/* CONTENIDO PRINCIPAL DEL DASHBOARD */}
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Ionicons name="settings-sharp" size={20} color="#2C3E50" />
              <Text style={styles.cardTitle}>Perfil Productivo</Text>
            </View>

            {!isEditing && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setIsEditing(true)}
              >
                <Ionicons name="pencil" size={14} color="#27AE60" />
                <Text style={styles.editButtonText}>Modificar</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider} />

          {isEditing ? (
            <View style={styles.editModeContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nombre de la Granja</Text>
                <TextInput
                  style={styles.input}
                  value={nombreFinca}
                  onChangeText={setNombreFinca}
                  placeholder="Ej. PruebaFinca"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Productor / Administrador</Text>
                <TextInput
                  style={styles.input}
                  value={productor}
                  onChangeText={setProductor}
                  placeholder="Ej. Productor Principal"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Ubicación Geográfica</Text>
                <TextInput
                  style={styles.input}
                  value={ubicacion}
                  onChangeText={setUbicacion}
                  placeholder="Ej. Santo Tomás, Chontales"
                />
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setIsEditing(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveChanges}
                >
                  <Text style={styles.saveButtonText}>Guardar Cambios</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.readModeContainer}>
              <View style={styles.dataRow}>
                <View style={styles.dataCol}>
                  <Text style={styles.label}>UNIDAD PRODUCTIVA</Text>
                  <Text style={styles.value}>{userData?.nombreFinca}</Text>
                </View>
                <View style={styles.dataCol}>
                  <Text style={styles.label}>ADMINISTRADOR</Text>
                  <Text style={styles.value}>{userData?.productor}</Text>
                </View>
              </View>
              <View style={styles.dataRow}>
                <View style={styles.dataCol}>
                  <Text style={styles.label}>UBICACIÓN</Text>
                  <Text style={styles.value}>{userData?.ubicacion}</Text>
                </View>
                <View style={styles.dataCol}>
                  <Text style={styles.label}>LICENCIA DE ACCESO</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>PRO</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{cerdosActivos}</Text>
            <Text style={styles.statLabel}>CERDOS ACTIVOS</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{lotesCerrados}</Text>
            <Text style={styles.statLabel}>LOTES CERRADOS (HISTÓRICOS)</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.dangerButton}
          onPress={handleDeleteAccount}
        >
          <Text style={styles.dangerButtonText}>
            Desactivar Cuenta y Purgar Datos de Firestore
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#FAF9F6" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header
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
  headerLogo: { fontSize: 24, fontWeight: "900", color: "#8E2827" },

  // Drawer
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
  drawerLinks: { flex: 1 },
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

  // Content
  container: { flexGrow: 1, padding: 20, backgroundColor: "#FAF9F6" },
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
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitleContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: "bold", color: "#2C3E50" },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F6EF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  editButtonText: { color: "#27AE60", fontSize: 12, fontWeight: "bold" },
  divider: { height: 1, backgroundColor: "#ECF0F1", marginVertical: 15 },
  readModeContainer: { gap: 20 },
  dataRow: { flexDirection: "row", justifyContent: "space-between" },
  dataCol: { flex: 1 },
  label: {
    fontSize: 10,
    color: "#95a5a6",
    fontWeight: "bold",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  value: { fontSize: 14, color: "#2C3E50", fontWeight: "500" },
  badge: {
    backgroundColor: "#27AE60",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: { color: "#FFF", fontSize: 10, fontWeight: "bold" },
  editModeContainer: {
    borderLeftWidth: 3,
    borderLeftColor: "#27AE60",
    paddingLeft: 15,
  },
  inputGroup: { marginBottom: 15 },
  input: {
    borderWidth: 1,
    borderColor: "#DFE6E9",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: "#2C3E50",
    backgroundColor: "#FDFDFD",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 10,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: "#F1F2F6",
  },
  cancelButtonText: { color: "#7F8C8D", fontWeight: "600" },
  saveButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: "#1E8449",
  },
  saveButtonText: { color: "#FFF", fontWeight: "bold" },
  statsContainer: { flexDirection: "row", gap: 15, marginBottom: 30 },
  statCard: {
    flex: 1,
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  statNumber: { fontSize: 28, fontWeight: "900", color: "#27AE60" },
  statLabel: {
    fontSize: 9,
    color: "#95a5a6",
    fontWeight: "bold",
    marginTop: 5,
    textAlign: "center",
  },
  dangerButton: {
    alignSelf: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#95a5a6",
    paddingBottom: 2,
  },
  dangerButtonText: { color: "#95a5a6", fontSize: 12 },
});
