import path from "node:path";
import type { NextConfig } from "next";

// Sin output: "export" — este proyecto solo sirve las rutas de servidor (issue #69),
// se despliega en Vercel con runtime Node, no en IONOS.
const nextConfig: NextConfig = {
  // Las rutas importan código compartido de ../src/lib (fuera de este proyecto, ver tech.md):
  // la raíz de Turbopack tiene que cubrir el repo entero, no solo server/.
  turbopack: { root: path.join(__dirname, "..") },
};

export default nextConfig;
