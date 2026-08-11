import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../services/firebaseConfig.js";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Ingresa correo y contraseña.");
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/dashboard");
    } catch (error) {
      Alert.alert(
        "Error de Acceso",
        "Credenciales incorrectas o usuario no existe.",
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>NutriPorc Pro</Text>
      <Text style={styles.subtitle}>Gestión Inteligente de Fincas</Text>

      <TextInput
        style={styles.input}
        placeholder="Correo electrónico"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Iniciar Sesión</Text>
      </TouchableOpacity>

      <View style={styles.footerLinks}>
        <TouchableOpacity onPress={() => router.push("/recover")}>
          <Text style={styles.linkText}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/register")}>
          <Text style={styles.linkText}>Crear una cuenta nueva</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#F5F5F5",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2C3E50",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#7F8C8D",
    textAlign: "center",
    marginBottom: 40,
  },
  input: {
    backgroundColor: "#FFF",
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  button: {
    backgroundColor: "#27AE60",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
  footerLinks: { alignItems: "center", gap: 15 },
  linkText: { color: "#2980B9", fontSize: 14, fontWeight: "500" },
});
