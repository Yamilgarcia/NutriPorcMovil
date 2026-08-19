import { Stack } from "expo-router";
import { ThemeProvider, DefaultTheme } from "@react-navigation/native";

export default function RootLayout() {
  return (
    // Esto obliga a toda la aplicación a comportarse en Modo Claro (letras oscuras)
    <ThemeProvider value={DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </ThemeProvider>
  );
}
