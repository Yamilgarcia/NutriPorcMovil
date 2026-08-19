import { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SidebarMenu from "../components/SidebarMenu";

// SDK Oficial de Google Gemini
import { GoogleGenAI } from "@google/genai";

// API Key integrada
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export default function ChatIAScreen() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [mensajeTexto, setMensajeTexto] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef(null);

  // Historial de mensajes (Empieza con el saludo de la IA)
  const [mensajes, setMensajes] = useState([
    {
      id: "1",
      role: "ai",
      text: "¡Hola! Soy NutriPorc AI, el núcleo de inteligencia de tu granja. ¿En qué te asesoro hoy?",
    },
  ]);

  const consultasFrecuentes = [
    "Raciones de Engorde",
    "Control de Enfermedades",
    "Manejo de Gestación",
  ];

  // =========================================================================
  // MOTOR DE IA: CONEXIÓN CON GEMINI
  // =========================================================================
  const enviarMensaje = async (textoUsuario = mensajeTexto) => {
    if (!textoUsuario.trim()) return;

    // 1. Añadimos el mensaje del usuario a la pantalla
    const newMensajeUser = {
      id: Date.now().toString(),
      role: "user",
      text: textoUsuario,
    };
    setMensajes((prev) => [...prev, newMensajeUser]);
    setMensajeTexto("");
    setIsTyping(true);

    try {
      // 2. Preparamos el contexto (Personalidad de NutriPorc)
      const promptContexto = `
        Eres NutriPorc AI, un asistente virtual experto en producción, nutrición y veterinaria porcina.
        Responde de manera profesional, directa y concisa.
        Si el usuario te hace una pregunta que NO tiene nada que ver con cerdos, granjas o veterinaria, 
        responde amablemente que solo estás programado para asesoría porcina.
        
        Pregunta del usuario: ${textoUsuario}
      `;

      // 3. Enviamos la petición a Gemini 1.5 Flash (El modelo estable)
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptContexto,
      });

      // 4. Añadimos la respuesta a la pantalla
      const respuestaIA = response.text;
      const newMensajeIA = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        text: respuestaIA,
      };

      setMensajes((prev) => [...prev, newMensajeIA]);
    } catch (error) {
      // Manejo de errores
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        text: "Hubo un error de conexión con mi núcleo neuronal. Por favor, revisa tu conexión a internet.",
      };
      setMensajes((prev) => [...prev, errorMsg]);
      console.error(error);
    } finally {
      setIsTyping(false);
    }
  };

  // =========================================================================
  // RENDERIZADO
  // =========================================================================
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
        currentRoute="/chatia"
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.chatContainer}>
          {/* CABECERA DEL CHAT */}
          <View style={styles.chatHeader}>
            <View style={styles.chatIconBox}>
              <Text style={{ fontSize: 24 }}>🐷</Text>
            </View>
            <View>
              <Text style={styles.chatTitle}>NutriPorc AI</Text>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>En línea y listo</Text>
              </View>
            </View>
          </View>

          {/* ÁREA DE MENSAJES */}
          <ScrollView
            style={styles.messagesArea}
            contentContainerStyle={{ padding: 20, paddingBottom: 10 }}
            ref={scrollViewRef}
            onContentSizeChange={() =>
              scrollViewRef.current?.scrollToEnd({ animated: true })
            }
          >
            {/* Consultas Frecuentes (Pills) */}
            <Text style={styles.frequentTitle}>Consultas frecuentes:</Text>
            <View style={styles.frequentPillsRow}>
              {consultasFrecuentes.map((consulta, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.frequentPill}
                  onPress={() => enviarMensaje(consulta)}
                >
                  <Text style={styles.frequentPillText}>{consulta}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Burbujas de Chat */}
            {mensajes.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.messageWrapper,
                  msg.role === "user"
                    ? styles.messageWrapperUser
                    : styles.messageWrapperAI,
                ]}
              >
                {msg.role === "ai" && (
                  <View style={styles.aiAvatar}>
                    <Text style={styles.aiAvatarText}>NP</Text>
                  </View>
                )}
                <View
                  style={[
                    styles.bubble,
                    msg.role === "user" ? styles.bubbleUser : styles.bubbleAI,
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      msg.role === "user"
                        ? styles.bubbleTextUser
                        : styles.bubbleTextAI,
                    ]}
                  >
                    {msg.text}
                  </Text>
                </View>
              </View>
            ))}

            {isTyping && (
              <View style={[styles.messageWrapper, styles.messageWrapperAI]}>
                <View style={styles.aiAvatar}>
                  <Text style={styles.aiAvatarText}>NP</Text>
                </View>
                <View
                  style={[
                    styles.bubble,
                    styles.bubbleAI,
                    { paddingVertical: 15 },
                  ]}
                >
                  <ActivityIndicator size="small" color="#27AE60" />
                </View>
              </View>
            )}
          </ScrollView>

          {/* ÁREA DE ESCRITURA */}
          <View style={styles.inputArea}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                placeholder="Escribe tu consulta o métrica aquí..."
                placeholderTextColor="#95A5A6"
                value={mensajeTexto}
                onChangeText={setMensajeTexto}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  mensajeTexto.trim()
                    ? styles.sendBtnActive
                    : styles.sendBtnInactive,
                ]}
                onPress={() => enviarMensaje()}
                disabled={!mensajeTexto.trim() || isTyping}
              >
                <Ionicons
                  name="send"
                  size={18}
                  color="#FFF"
                  style={{ marginLeft: 3 }}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
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

  chatContainer: {
    flex: 1,
    margin: 15,
    backgroundColor: "#FFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  // Cabecera Chat
  chatHeader: {
    backgroundColor: "#114D32",
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 15,
    zIndex: 10,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chatIconBox: {
    backgroundColor: "#1A6B46",
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1948A",
  },
  chatTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFF",
    marginBottom: 5,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#1A6B46",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#27AE60",
  },
  statusText: { fontSize: 11, color: "#A9DFBF", fontWeight: "bold" },

  // Área de Mensajes
  messagesArea: { flex: 1, backgroundColor: "#FDFEFE" },

  frequentTitle: { fontSize: 13, color: "#7F8C8D", marginBottom: 10 },
  frequentPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 25,
  },
  frequentPill: {
    backgroundColor: "#FFF",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E8F6EF",
  },
  frequentPillText: { fontSize: 12, color: "#114D32", fontWeight: "500" },

  messageWrapper: { flexDirection: "row", marginBottom: 20, width: "100%" },
  messageWrapperUser: { justifyContent: "flex-end" },
  messageWrapperAI: {
    justifyContent: "flex-start",
    alignItems: "flex-end",
    gap: 10,
  },

  aiAvatar: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
  },
  aiAvatarText: { color: "#F1948A", fontWeight: "900", fontSize: 12 },

  bubble: { maxWidth: "80%", padding: 15, borderRadius: 16 },
  bubbleUser: { backgroundColor: "#E8F6EF", borderBottomRightRadius: 4 },
  bubbleAI: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#F2F4F4",
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },

  bubbleText: { fontSize: 14, lineHeight: 22 },
  bubbleTextUser: { color: "#2C3E50" },
  bubbleTextAI: { color: "#34495E" },

  // Área de Escritura
  inputArea: {
    padding: 15,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#F2F4F4",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderWidth: 2,
    borderColor: "#27AE60",
    borderRadius: 25,
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 14,
    color: "#2C3E50",
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnActive: {
    backgroundColor: "#27AE60",
  },
  sendBtnInactive: {
    backgroundColor: "#BDC3C7",
  },
});
