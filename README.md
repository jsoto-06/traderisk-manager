# TradeRisk Manager (TRM)

![Next.js](https://img.shields.io/badge/Next.js-16.4.3-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript)
![Turbopack](https://img.shields.io/badge/Turbopack-Enabled-orange?style=for-the-badge)
![Vitest](https://img.shields.io/badge/Vitest-395%20Passed-green?style=for-the-badge&logo=vitest)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css)

**TradeRisk Manager** es una plataforma institucional y cuantitativa diseñada para la **supervisión en tiempo real, gestión de disciplina de riesgo, contabilidad analítica y auditoría de carteras en trading manual**.

---

## ⚠️ Principio Fundamental de Diseño: 0 Automatizaciones Operativas

TradeRisk Manager está concebido bajo el principio estricto de **supervisión analítica y protección de capital humano**:

- 🚫 **Sin ejecución automática**: No abre, no modifica ni cierra órdenes en brokers o exchanges.
- 🚫 **Sin custodia ni claves privadas de trading**: Las conexiones de mercado son exclusivamente de lectura de feeds públicos o subscripciones WebSocket públicas.
- 🚫 **Sin alteración de Stop Loss**: El motor alerta, calcula, audita e informa; el operador humano conserva en todo momento el control y la responsabilidad de la ejecución.

---

## 🚀 Funcionalidades Principales

### 1. Motor de Valoración Cuantitativa Multi-Activo (Paso 8.2)
- **Modelos Financieros Especializados por Activo**:
  - **Spot**: Criptomonedas y metales al contado (compra cash y ventas cortas con supervisión de borrow).
  - **Cripto USD-M**: Futuros perpetuos lineales con liquidación en USDT/USDC y seguimiento de financiación devengada (`accruedFunding`).
  - **Cripto Coin-M**: Futuros perpetuos inversos con colateral en criptomoneda base (BTC/ETH) y curva asimétrica hiperbólica de PnL en base.
  - **Forex**: Lotes estándar, mini y micro con cálculo exacto de pips, valor monetario del pip (`pipValueInQuote`), swaps y conversión FX cruzada.
  - **Futuros Regulados**: Contratos CME / Eurex (ES, NQ, CL, GC) con inferencia automática de multiplicadores contractuales y valor de tick.
  - **Renta Variable**: Acciones al contado (`cash_stock`) y Equity CFDs (`equity_cfd`) con modelado de apalancamiento y tasas de préstamo (`borrowRate` diario y anual ACT/365).
- **Integridad de Equity y High-Water Mark (H1)**:
  - Procedencia histórica verificada de HWM (`HistoricalHwmReference`), con bloqueo explícito de declaraciones no auditadas (`user_attested`).
  - Unificación de base de valoración (`valuationBase`): `equity` con posiciones abiertas y `ledgerBalance` sin posiciones.
  - Modos operativos canónicos: `realtime_feed` (100% fiable y completo) vs `manual_closed` ante degradaciones (`stale`, `manual`, `offline`, `spike`).
- **Clasificación Jerárquica y Validación Numérica (H6 & H7)**:
  - 8 niveles de inferencia determinista de activos con fallback seguro a `'unknown'`.
  - Validación numérica previa que erradica la propagación de `NaN`, divisiones por cero o infinitos.

### 2. Calculadora de Tamaño de Posición y Gestión de Riesgo
- Dimensionamiento de posiciones por capital fijo, porcentaje de balance o porcentaje de equidad.
- Cálculo de lotes / contratos / acciones exactos a partir del nivel de Stop Loss y Take Profit.
- Ratios Riesgo/Beneficio (R:R), distancia monetaria en pips/puntos y proyección de drawdown en caso de fallo.

### 3. Simulador y Monitor de Cuentas Prop Firm
- **Reglas Institucionales Estrictas**:
  - Trailing Drawdown dinámico calculado desde el High-Water Mark o trailing balance según el contrato.
  - Límite de pérdida diaria (**Daily Loss Limit**) con reinicio formal a las 17:00 NY (soporte automático EDT/EST).
  - Alerta de proximidad y detección instantánea de infracción de reglas de fondeo.

### 4. Análisis Cuantitativo y Riesgo de Ruina
- **Riesgo de Ruina Analítico**: Fórmulas exactas de Ruina del Jugador (Gambler's Ruin), Perry Kaufman y Ralph Vince.
- **Simulación Monte Carlo**:
  - 10,000 iteraciones con remuestreo bootstrap sobre el historial de operaciones.
  - Intervalos de confianza del 95% y 99% para Drawdown Máximo, racha perdedora y expectativa matemática.

### 5. Diario de Operaciones y Libro Mayor Contable (Audit Trail)
- Registro cronológico inmutable de trades ejecutados, comisiones, swaps y funding.
- Reconciliación contable de balance (`ledgerBalance`) y segregación de costes liquidados vs pendientes.
- Etiquetado de operaciones por estrategia, marco temporal (timeframe) y notas operativas.

### 6. Informes Cuantitativos y Exportación Ejecutiva
- Generación de informes vectoriales institucionales en PDF mediante `jspdf`.
- Exportación a CSV en estándar RFC 4180 con soporte de codificación UTF-8 BOM para Resumen Ejecutivo y Libro Mayor.
- Desglose de KPIs: Profit Factor, Win Rate, Expectativa Matemática (\$ y R-multiple), Factor de Recuperación.

### 7. Arquitectura de Almacenamiento Resiliente y Seguridad
- **Cuarentena Automática No Destructiva**: Si el almacenamiento local (`localStorage`) sufre corrupción de sintaxis JSON, los datos se preservan en una clave de cuarentena (`trm_quarantine_*`) sin provocar caídas de la aplicación.
- **Sincronización Híbrida Segura**: Integración con Supabase para sincronización en la nube con Row Level Security (RLS).
- **Internacionalización Completa**: Soporte bilingüe integral (Español / Inglés) mediante `next-intl`.

---

## 🛠️ Tecnologías y Dependencias

- **Framework**: [Next.js 16.4.3](https://nextjs.org/) con compilador **Turbopack** y Partial Prerendering.
- **Lenguaje**: [TypeScript 5.x](https://www.typescriptlang.org/) bajo modo estricto (`strict: true`).
- **Librería UI**: [React 19](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/) y [Lucide Icons](https://lucide.dev/).
- **Generación de Informes**: [jspdf](https://github.com/parallax/jsPDF) y formateo tabular analítico.
- **Testing & QA**: [Vitest 5.x](https://vitest.dev/) con entorno JSDOM y suites deterministas sin mocks frágiles.
- **Sincronización y Persistencia**: [@supabase/supabase-js](https://supabase.com/).

---

## 📦 Instalación y Puesta en Marcha

### Prerrequisitos
- **Node.js**: versión 18.18.0 o superior (recomendado Node 20 LTS o 22 LTS).
- **npm** (o yarn / pnpm).
- **Git**.

### 1. Clonar el Repositorio
```bash
git clone https://github.com/jsoto-06/traderisk-manager.git
cd traderisk-manager
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno (Opcional para Supabase)
Copia el archivo de ejemplo o crea un `.env.local` si deseas utilizar sincronización en la nube con Supabase (en su defecto, la aplicación opera de forma 100% autónoma en modo local):
```env
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
```

### 4. Iniciar Servidor de Desarrollo
```bash
npm run dev
```
Abre en tu navegador [http://localhost:3000](http://localhost:3000).

---

## 📋 Guía Rápida de Uso

1. **Gestión de Cuentas** (`/[locale]/accounts`):
   - Crea tu cuenta de trading seleccionando el tipo (`PropFirm`, `Personal`, `Exchange`, `Broker`).
   - Define el capital inicial, apalancamiento, divisa base (USD, EUR, etc.), regla de drawdown (estático o trailing) y límite de pérdida diaria.
2. **Calculadora de Posición** (`/[locale]/calculator`):
   - Introduce el activo (`BTC/USDT`, `EUR/USD`, `ES`, `AAPL`), el precio de entrada y el Stop Loss.
   - La calculadora deduce automáticamente el modelo del instrumento y sugiere el tamaño exacto en unidades, lotes o contratos para cumplir tu porcentaje de riesgo.
3. **Registro y Diario de Operaciones** (`/[locale]/trades`):
   - Registra operaciones manuales abiertas o cerradas con comisiones, precios de salida y métricas R:R.
4. **Panel de Estadísticas y Analítica** (`/[locale]/statistics` y `/[locale]/analytics`):
   - Visualiza tu curva de equidad, evolución de balance, factor de beneficio y drawdown acumulado.
   - Ejecuta simulaciones de Monte Carlo y cálculos de probabilidad de ruina en las secciones dedicadas.
5. **Exportación de Informes** (`/[locale]/settings` o botones de exportación):
   - Descarga en 1 clic un informe ejecutivo en PDF institucional o exporta tu libro mayor en CSV para auditoría contable o fiscal.

---

## 🧪 Pruebas, Verificación y Control de Calidad

El proyecto cuenta con un blindaje cuantitativo verificado mediante **395 pruebas deterministas**:

```bash
# Ejecutar todas las pruebas unitarias y de integración
npx vitest run

# Comprobación de tipos en TypeScript (estricto)
npx tsc --noEmit

# Análisis estático de código con ESLint
npm run lint

# Compilación de producción con Turbopack
npm run build
```

---

## 📂 Estructura del Proyecto

```
traderisk-manager/
├── src/
│   ├── app/                     # Rutas Next.js App Router (bilingüe /[locale]/...)
│   ├── components/              # Componentes UI (modales, tablas, tarjetas, gráficos)
│   ├── lib/
│   │   ├── market-data/         # Normalización de cotizaciones públicas (MarketPriceQuote)
│   │   ├── reports/             # Generador de PDF institucional y exportador CSV
│   │   ├── risk-engine/         # Precisión decimal, redondeos matemáticos y ruina
│   │   ├── storage/             # Almacenamiento local resiliente con cuarentena
│   │   ├── supabase/            # Adaptador y sincronización segura con Supabase
│   │   └── valuation/           # Motor de valoración cuantitativa multi-activo
│   │       ├── calculators/     # Calculadores de Spot, USD-M, Coin-M, Forex, Futuros y Stocks
│   │       ├── catalog.ts       # Clasificación jerárquica de activos (H6)
│   │       ├── engine.ts        # Orquestador MultiAssetValuationEngine
│   │       ├── risk.ts          # Métricas de riesgo dinámico
│   │       ├── types.ts         # Contratos TypeScript de valoración y HWM (H1)
│   │       └── validation.ts    # Validadores numéricos estrictos (H7)
│   └── __tests__/               # Suites de pruebas Vitest (395 tests deterministas)
├── PROJECT_CONTEXT.md           # Memoria técnica completa y registro de fases
├── next.config.ts               # Configuración Next.js
└── package.json                 # Dependencias y scripts
```

---

## 📄 Licencia

Este proyecto se distribuye bajo la licencia **MIT**. Consulte el archivo `LICENSE` para más detalles.
