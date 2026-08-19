import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { auth } from "../services/firebaseConfig";

export default function SidebarMenu({ visible, onClose, currentRoute }) {
  const router = useRouter();

  const navigateTo = (route) => {
    onClose();
    // Solo navegamos si la ruta existe y no estamos ya en ella
    if (route && route !== currentRoute) {
      router.replace(route);
    }
  };

  // Lista maestra de todas las opciones de tu app
  const menuItems = [
    { title: "Inicio", route: "/Dashboard" },
    { title: "Lotes y Cerdos", route: "/lotes" },
    { title: "Biblioteca de Insumos", route: "/insumos" }, // Rutas futuras
    { title: "Formulador de Dietas", route: "/formulador" },
    { title: "Módulo de Monitoreo de Peso", route: "/monitoreo" },
    { title: "Maximizador de Ganancia", route: "/maximizador" },
    { title: "Control Financiero", route: "/finanzas" },
    { title: "Semáforo Epidemiológico", route: "/semaforo" },
    { title: "Inteligencia", route: "/inteligencia" },
    { title: "ChatIA", route: "/chatia" },
  ];

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.drawer}>
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>Menú</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#E74C3C" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {menuItems.map((item, index) => {
              const isActive = currentRoute === item.route;
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.drawerItem,
                    isActive && styles.drawerItemActive,
                  ]}
                  onPress={() => navigateTo(item.route)}
                >
                  <Text
                    style={[
                      styles.drawerItemText,
                      isActive && styles.drawerItemTextActive,
                    ]}
                  >
                    {item.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => {
              auth.signOut();
              onClose();
              router.replace("/");
            }}
          >
            <Ionicons name="log-out-outline" size={20} color="#E74C3C" />
            <Text style={styles.logoutText}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>
        <Pressable style={styles.modalCloseArea} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
});
