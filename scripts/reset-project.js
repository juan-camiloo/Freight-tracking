#!/usr/bin/env node
// Archivo: scripts/reset-project.js
// Descripcion: Script utilitario para reiniciar el proyecto a una estructura base.

/**
 * Este script reinicia el proyecto a un estado inicial.
 * Segun la opcion del usuario, mueve o elimina carpetas de codigo existentes.
 * Finalmente crea un nuevo directorio /app con archivos base.
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const root = process.cwd();
const oldDirs = ["app", "components", "hooks", "constants", "scripts"];
const exampleDir = "app-example";
const newAppDir = "app";
const exampleDirPath = path.join(root, exampleDir);

const indexContent = `import { Text, View } from "react-native";

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text>Edita app/index.tsx para cambiar esta pantalla.</Text>
    </View>
  );
}
`;

const layoutContent = `import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack />;
}
`;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const moveDirectories = async (userInput) => {
  try {
    if (userInput === "y") {
      // Crea el directorio app-example.
      await fs.promises.mkdir(exampleDirPath, { recursive: true });
      console.log(`Directorio /${exampleDir} creado.`);
    }

    // Mueve directorios antiguos a app-example o los elimina.
    for (const dir of oldDirs) {
      const oldDirPath = path.join(root, dir);
      if (fs.existsSync(oldDirPath)) {
        if (userInput === "y") {
          const newDirPath = path.join(root, exampleDir, dir);
          await fs.promises.rename(oldDirPath, newDirPath);
          console.log(`/${dir} movido a /${exampleDir}/${dir}.`);
        } else {
          await fs.promises.rm(oldDirPath, { recursive: true, force: true });
          console.log(`/${dir} eliminado.`);
        }
      } else {
        console.log(`/${dir} no existe, se omite.`);
      }
    }

    // Crea el nuevo directorio /app.
    const newAppDirPath = path.join(root, newAppDir);
    await fs.promises.mkdir(newAppDirPath, { recursive: true });
    console.log("\nNuevo directorio /app creado.");

    // Crea index.tsx.
    const indexPath = path.join(newAppDirPath, "index.tsx");
    await fs.promises.writeFile(indexPath, indexContent);
    console.log("app/index.tsx creado.");

    // Crea _layout.tsx.
    const layoutPath = path.join(newAppDirPath, "_layout.tsx");
    await fs.promises.writeFile(layoutPath, layoutContent);
    console.log("app/_layout.tsx creado.");

    console.log("\nReinicio del proyecto completado. Siguientes pasos:");
    console.log(
      `1. Ejecuta \`npx expo start\` para iniciar el servidor de desarrollo.\n2. Edita app/index.tsx para cambiar la pantalla principal.${
        userInput === "y"
          ? `\n3. Elimina /${exampleDir} cuando ya no necesites consultarlo.`
          : ""
      }`
    );
  } catch (error) {
    console.error(`Error durante la ejecucion del script: ${error.message}`);
  }
};

rl.question(
  "Deseas mover los archivos existentes a /app-example en lugar de eliminarlos? (Y/n): ",
  (answer) => {
    const userInput = answer.trim().toLowerCase() || "y";
    if (userInput === "y" || userInput === "n") {
      moveDirectories(userInput).finally(() => rl.close());
    } else {
      console.log("Entrada invalida. Ingresa 'Y' o 'N'.");
      rl.close();
    }
  }
);
