---
name: project_options_poc
description: "PoC de opciones del S&P 500: fuente Yahoo vía yfinance, forward por paridad, IV Black-76 propia, GEX y supuestos; OI casi a 0 fuera de horario"
metadata:
  type: project
---

# Opciones · PoC SPX

- **Estado**: PoC funcional (2026-11-24). Instantánea en memoria (TTL 5 min), sin histórico.
- **Leer si**: tocas `/opciones`, el GEX, la IV o quieres ampliar a otros subyacentes
- **Código**: core `src/core/options/` (`black76`, `chain_analytics`, `expiry_policy`,
  `vol_context`), adaptador `src/infrastructure/market_feeds/yfinance_option_chain.py`,
  servicio `src/applications/synopsis/options_service.py` (`UNDERLYINGS`)

**Fuente**: `yf.Ticker('^SPX')`, ~52 vencimientos listados; se cargan los ≤45 días + mensuales
(tercer viernes) hasta 400 días → ~38 vencimientos, ~16,5k contratos, ~2 s en paralelo.
Cotizaciones con 15 min de retraso.

**Método** (ver `ASSUMPTIONS`, que se envía al front):
- Forward y descuento por regresión de paridad (C−P frente a K, ±5% del spot). Con pocos días
  la pendiente es ruido → `parity_unit_discount` (D=1, mediana de K+C−P). Tipo implícito
  solo con ≥14 días.
- IV propia por bisección vectorizada (Black-76 sobre el mid OTM); la IV de Yahoo solo se
  compara. Sanidad: IV ATM 30d ≈ 21,9% con VIX 26,6 (el VIX incluye el skew).
- GEX = Γ·peso·100·S²·0,01, +calls/−puts (convención pública de dealers, supuesta).
  El perfil de gamma usa vol fija por strike (sticky strike).

**Limitación clave**: Yahoo da OI≈0 fuera de horario (2% de los contratos). La base `auto`
pondera por volumen y lo avisa; `open_interest` explícito se respeta y también se avisa.

**Siguiente paso natural**: guardar instantáneas diarias de la cadena (OI real, GEX en el
tiempo) → requiere tabla nueva en la BD = DDL → pedir OK al usuario antes.
