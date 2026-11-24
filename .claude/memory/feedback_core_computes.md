---
name: feedback_core_computes
description: "Toda cifra derivada (cambios, pendientes de curva, distancias, griegas) se calcula en screener_core y sale por /api/v2 con su unidad y sus avisos"
metadata:
  type: feedback
---

# El front no calcula

- **Estado**: vigente
- **Leer si**: una pantalla necesita un número que la API aún no da
- **Código**: `../screener_core/src/core/markets`, `../screener_core/src/core/options`

En la v0 se coló un cálculo en el front (la pendiente 10a−5a de la curva) y se movió al core
como miembro `spread` del catálogo. Igual con "% desde máximo" y "distancia a la media" de
una rentabilidad, que estaban en % y pasaron a pb.

**Why:** la lógica vive en el dominio (hexagonal); así es testeable y reutilizable, y las
unidades son coherentes en toda la app.
**How to apply:** si falta un dato, añadirlo al core (servicio + test + DTO) y reflejarlo en
`src/lib/types.ts`. El front solo formatea (`src/lib/format.ts`). Los `warnings` del core se
muestran siempre (componente `Warnings`): ni rellenar ni ocultar huecos.
