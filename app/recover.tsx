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
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../services/firebaseConfig.js";

export default function RecoverScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const handleRecover = async () => {
    if (!email) {
      Alert.alert("Error", "Ingresa tu correo electrónico.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert(
        "Correo Enviado",
        "Revisa tu bandeja de entrada para resetear la contraseña.",
      );
      router.back();
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recuperar Contraseña</Text>
      <Text style={styles.subtitle}>
        Te enviaremos un enlace para crear una nueva.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Correo electrónico"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TouchableOpacity style={styles.button} onPress={handleRecover}>
        <Text style={styles.buttonText}>Enviar Enlace</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()} style={styles.linkButton}>
        <Text style={styles.linkText}>Volver al Login</Text>
      </TouchableOpacity>
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
    fontSize: 28,
    fontWeight: "bold",
    color: "#2C3E50",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "#7F8C8D",
    textAlign: "center",
    marginBottom: 30,
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
    backgroundColor: "#E67E22",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 15,
  },
  buttonText: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
  linkButton: { alignItems: "center" },
  linkText: { color: "#2980B9", fontSize: 14 },
});
