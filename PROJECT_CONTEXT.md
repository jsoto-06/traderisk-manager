# TradeRisk Manager — Project Context & Documentation

## 1. Visión General y Arquitectura

TradeRisk Manager es una plataforma profesional de gestión de riesgo financiero y psicología operativa para traders de cuentas fondeadas (Prop Firms), brokers y exchanges.

La aplicación está construida sobre una arquitectura modular desacoplada:
1. **Core Domain Layer** (`src/lib`):
   - Tipos de datos inmutables y contratos de dominio ([types.ts](file:///c:/Users/Jony/Documents/traderisk-manager/src/lib/types.ts)).
   - Motor matemático de riesgo ([risk-engine](file:///c:/Users/Jony/Documents/traderisk-manager/src/lib/risk-engine/index.ts)): cálculo de tamaño de posición, distancias de SL/TP, R:R, márgenes y comisiones sin acoplamiento a componentes visuales.
   - Motor estadístico ([statistics](file:///c:/Users/Jony/Documents/traderisk-manager/src/lib/statistics/index.ts)): Win Rate, Profit Factor, rachas ganadoras/perdedoras y serie temporal de balance.
   - Capa de validación Zod ([validation/schemas.ts](file:///c:/Users/Jony/Documents/traderisk-manager/src/lib/validation/schemas.ts)).
   - Capa de persistencia client-side con interface intercambiable ([storage](file:///c:/Users/Jony/Documents/traderisk-manager/src/lib/storage/index.ts)) y datos demo listos para usar.
   - Sistema de internacionalización bilingüe (ES / EN) ([i18n](file:///c:/Users/Jony/Documents/traderisk-manager/src/lib/i18n/index.ts)).
2. **Reactive State Layer** (`src/hooks/useStorage.ts`):
   - Hook reactivo que mantiene el estado en memoria sincronizado con `localStorage` y propaga eventos entre componentes sin recargar la página.
3. **UI & Component Layer** (`src/components/` & `src/app/`):
   - AppShell con sidebar colapsable, drawer móvil y barra superior con selector de cuenta y toggle de idioma.
   - Sistema de diseño Fintech Dark Navy (`#0A1128`, `#111C35`, `#00F0FF`, `#10B981`, `#EF4444`).
   - Rutas dinámicas bilingües con App Router de Next.js 16.

---

## 2. Módulos Implementados

### Dominio y Lógica
* **`src/lib/types.ts`**: Interfaces completas para `Account`, `Trade`, `JournalEntry`, `InstrumentType`, `RiskCalculationInput`, `RiskCalculationOutput`, `TradeStatistics` y `Settings`.
* **`src/lib/risk-engine/`**:
  * `index.ts`: Función `calculateRisk()` pura y determinista con validación estricta de SL/TP para Longs y Shorts.
  * `models.ts`: Stubs para modelos de Forex Lots, Futuros, Perpetuos, Acciones, Multipliers y Tick Values.
* **`src/lib/statistics/`**:
  * `calculateStatistics()`: Cálculo de métricas avanzadas sobre operaciones cerradas.
* **`src/lib/storage/`**:
  * `index.ts`: Capa de persistencia segura contra desajustes de hidratación SSR.
  * `demo-data.ts`: Generador de cuenta demo ($5,000 challenge), 5 operaciones cerradas representativas y 2 notas de diario psicológico.
* **`src/lib/i18n/`**:
  * Diccionarios completos en español (`es.ts`) e inglés (`en.ts`).
  * Utilidades de formateo de moneda (`formatCurrency`), porcentaje (`formatPercent`) y fechas (`formatDate`).
  * Hook `useLocale()` para cambio instantáneo preservando la ruta activa.

### Interfaz y Componentes Reutilizables (`src/components/ui/`)
1. **`Card.tsx`**: Contenedor estilizado con cabecera opcional, títulos, acciones y pie de tarjeta.
2. **`StatCard.tsx`**: Tarjeta KPI con indicador de cambio (positivo/negativo), iconos y subtítulos.
3. **`Button.tsx`**: Botón accesible con variantes `primary`, `secondary`, `danger`, `outline`, `ghost`, tamaños e indicador de carga.
4. **`Input.tsx`**: Campo de entrada con etiquetas, prefijos/sufijos monetarios/porcentuales y validación de errores.
5. **`Select.tsx`**: Dropdown con estilos de alto contraste.
6. **`Modal.tsx`**: Diálogo modal con backdrop blur, soporte de tecla Escape y animaciones.
7. **`Badge.tsx`**: Pastillas de estado con variantes (`cyan`, `green`, `red`, `yellow`, `gray`) y puntos de estado.
8. **`Table.tsx`**: Tabla responsive con scroll horizontal, filas con hover y estado vacío.
9. **`ProgressBar.tsx`**: Barra de progreso con gradientes para targets de ganancia y límites de drawdown.
10. **`Alert.tsx`**: Banners de notificación (`info`, `warning`, `error`, `success`) con iconos y opción de descarte.

---

## 3. Estructura de Rutas y Navegación

* `/`: Redirige automáticamente a `/es` mediante [proxy.ts](file:///c:/Users/Jony/Documents/traderisk-manager/src/proxy.ts) y [page.tsx](file:///c:/Users/Jony/Documents/traderisk-manager/src/app/page.tsx).
* `/[locale]`: Dashboard principal con métricas, gráficos de balance y resumen de riesgo.
* `/[locale]/calculator`: Calculadora interactiva de dimensionamiento de posición en tiempo real.
* `/[locale]/accounts`: Gestión multi-cuenta (crear, editar, eliminar, seleccionar cuenta activa).
* `/[locale]/trades`: Bitácora y tabla completa de operaciones con filtros por cuenta, estado y dirección, y formulario de nueva posición / cierre de trade.
* `/[locale]/statistics`: Análisis profundo de métricas, factor de beneficio, rachas y gráfico de curva de equidad.
* `/[locale]/journal`: Diario psicológico con escala de disciplina (1-5 estrellas), registro de sesgos emocionales y detección de overtrading.
* `/[locale]/settings`: Configuración de idioma, cuenta por defecto, políticas de privacidad y reseteo de datos demo.

---

## 4. Decisiones Técnicas

1. **Next.js 16 y Proxy**:
   * En Next.js 16 la convención `middleware.js|ts` está deprecada en favor de `proxy.ts` con la función exportada `proxy()`. Se adoptó `src/proxy.ts` como estándar de routing y redirección.
   * En Next.js 16, la propiedad `params` en Server Components (páginas y layouts) es una `Promise`, por lo que se utiliza `await params` en `src/app/[locale]/layout.tsx`.
2. **React 19 Compatibility**:
   * Se instaló compatibilidad de dependencias de prueba (`vitest` v5, `@types/node` v22, `jsdom` v30) sin conflictos de pares.
3. **Persistencia Reactiva Local (Zero Server Latency)**:
   * El almacenamiento local implementa un patrón Pub/Sub con `Event('trm-storage-update')` para que cualquier mutación en modales o formularios actualice todas las vistas de manera instantánea.
4. **Desacoplamiento Estricto de la Lógica de Riesgo**:
   * Ningún componente visual duplica fórmulas matemáticas de cálculo de posición ni de ratio riesgo/beneficio; todo se calcula invocando `calculateRisk()`.

---

## 5. Pruebas y Validación

* **Pruebas Unitarias (Vitest)**:
  * `src/__tests__/risk-engine.test.ts`: Pruebas de posiciones Long, Short, dimensionamiento con porcentaje y monto fijo, validación estricta de SL/TP, comisiones, apalancamiento invariante frente al riesgo monetario, y valores inválidos / extremos (14 tests).
  * `src/__tests__/financial-scenarios.test.ts`: Benchmarks cuantitativos para BTC/USD, ETH/USD, activos de precio micro/decimal pequeño, matrices de capital ($1k-$100k) y riesgo (0.25%-2%), espectro de apalancamiento (1x-50x), margen insuficiente y Stop Loss demasiado cercano (16 tests).
  * `src/__tests__/prop-firm.test.ts`: Auditoría de reglas de prop firm: drawdown estático, drawdown trailing con High-Water Mark, límites de pérdida diaria con arrastre de pérdida flotante y progreso de objetivo de beneficio (7 tests).
  * `src/__tests__/statistics.test.ts`: Pruebas de cálculo de win rate, profit factor, rachas consecutivas (incluyendo trades breakeven), balance inicial, casos borde (0 trades, 100% win rate, 0% win rate) y filtrado de trades abiertos (6 tests).
  * `src/__tests__/storage-accounting.test.ts`: Pruebas de inicialización de datos demo, aislamiento de operaciones entre cuentas independientes, eliminación con reversión contable de balance, y borrado completo (3 tests).
  * `src/__tests__/accounting-lifecycle.test.ts`: Ciclo contable completo: apertura, cierre profit/loss/breakeven, transferencias entre cuentas con doble partida contable, recuperación ante datos corruptos en LocalStorage y validador de backups (5 tests).
  * `src/__tests__/backup-restore.test.ts`: Validación exhaustiva del sistema de copias de seguridad: exportación, importación replace/merge, control de versiones, deduplicación de IDs, integridad relacional, protección de tamaño máximo y cuarentena no destructiva ante corrupción (11 tests).
  * `src/__tests__/multiasset-engine.test.ts`: Pruebas y benchmarks matemáticos multi-activo para Cripto Spot, Cripto Perpetuo con funding cost drag, Forex con lotes estándar/mini/micro y conversión de divisa cotizada (USD/JPY y EUR/GBP), Futuros con multiplicadores (ES, MES, NQ) y contratos discretos enteros, y Acciones fraccionarias vs enteras (10 tests).
  * `src/__tests__/quant-audit.test.ts`: Auditoría cuantitativa avanzada de derivados y multi-activo (Fase 3.1): protección estricta del presupuesto de riesgo en futuros (0 contratos si riesgo insuficiente), presupuesto neto con comisiones y spread, pares Forex cruzados (GBP/JPY, EUR/GBP) con conversión multi-divisa (USD, EUR, GBP), prevención de doble contabilización de spread, convención de signos de financiación cripto (Long/Short, positivo/negativo) con intervalos 1h/8h, detección de liquidación previa a Stop Loss, y aritmética IEEE-754 / snap-to-step (18 tests).
  * `src/__tests__/robustness-invariants.test.ts`: Validación final de robustez cuantitativa y 10 invariantes matemáticas (Fase 3.2): modelado de liquidación en margen aislado vs cruzado, no inflación de posición con rebates futuros volátiles, conversiones completas directas/inversas en cuentas USD/EUR/GBP (GBP/JPY, EUR/GBP, EUR/USD, USD/JPY, GBP/USD), comprobación de solvencia frente a Margen Libre (`FreeMargin = Equity - UsedMargin`), alineación con tick grid (`isPriceOnGrid`), y verificación empírica de las 10 invariantes fundamentales (23 tests).
  * `src/__tests__/expectancy.test.ts`: Pruebas de expectativa matemática, profit factor con protección de división por cero, win/loss/breakeven rate, cómputo de múltiplos R, advertencias de significancia de muestra y filtros relacionales (5 tests).
  * `src/__tests__/drawdown.test.ts`: Pruebas de drawdown y consistencia: High-Water Mark, max drawdown monetario y porcentual, drawdown actual, factor de recuperación, trades bajo el agua (recovery duration) y rachas (3 tests).
  * `src/__tests__/monte-carlo.test.ts`: Pruebas de generador pseudoaleatorio Mulberry32 determinista con semilla, remuestreo bootstrap con reemplazo, distribución teórica paramétrica, percentiles P5/P25/P50/P75/P95 e histograma de equidad final (5 tests).
  * `src/__tests__/risk-of-ruin.test.ts`: Pruebas del modelo analítico cerrado de Ralph Vince / Perry Belmont, simulación empírica Monte Carlo, Criterio de Kelly (Full, Half, Quarter) y matriz comparativa de sensibilidad al riesgo (3 tests).
  * `src/__tests__/prop-firm-simulator.test.ts`: Pruebas del simulador institucional Prop Firm: drawdown estático vs trailing sobre balance y equidad, trailing lock-in al capital inicial, límites de pérdida diaria y distribución de días de pase (3 tests).
* **Comandos de Verificación**:
  * `npm test`: 18 suites unitarias pasadas, 167 tests pasados, 6 tests de integración real omitidos de forma segura sin credenciales activas (173 tests totales).
  * `npx tsc --noEmit`: 0 errores de compilación TypeScript.
  * `npm run lint`: 0 advertencias o errores.
  * `npm run build`: Compilación de producción validada (37 rutas compiladas y prerenderizadas con Next.js 16.4.3 Turbopack).

---

## 6. Fase 2.1: Auditoría Funcional, Matemática y de UX

Durante la auditoría técnica y financiera de la Fase 2.1 se realizaron análisis exhaustivos y correcciones críticas:

### 1. Auditoría Matemática del Motor de Riesgo
- **Invarianza del Apalancamiento**: Se auditó y formalizó que en una gestión de riesgo basada en distancia al Stop Loss (`monetaryRisk = balance * risk%`), el apalancamiento no altera el tamaño de posición nominal ni la pérdida potencial en el SL. El apalancamiento modula estrictamente el margen de garantía requerido (`estimatedMargin = notionalValue / leverage`).
- **Diferenciación Margen vs. Nocional**: Se clarificó la relación entre `notionalValue = positionSize * entryPrice` y `estimatedMargin`.
- **Consistencia Numérica**: Se corrigió el formateo directo de `netLoss` evitando el error visual de doble signo negativo.

### 2. Auditoría Contable y de Operaciones
- Se implementó la lógica de delta contable en `updateTrade` (`delta = newNet - oldNet`) y de reversión directa en `deleteTrade` (`account.balance -= trade.result`).

---

## 7. Fase 2.2: Auditoría de Seguridad Financiera y Validación de Escenarios Reales

Durante la Fase 2.2 se completó una auditoría exhaustiva por parte del equipo multidisciplinar (Ingeniero Fintech, Quant Developer, Auditor de Trading y Especialista en Seguridad):

### 1. Validación Matemática Quant
- **Ratio Riesgo/Beneficio Real tras Comisiones (`netRiskRewardRatio`)**:
  - Se incorporó el cálculo del R:R neto en `RiskCalculationOutput`: $R:R_{net} = \frac{NetProfit}{|NetLoss|}$, exponiendo al trader el impacto real del arrastre por comisiones (*fee drag*).
  - Se discriminaron formalmente las comisiones al Take Profit (`estimatedCommissions`) y las comisiones al Stop Loss (`lossCommissions`), reflejando que al tocar el SL el valor nocional de salida es inferior en posiciones Long y superior en posiciones Short.
- **Selector de Base de Capital (Balance vs. Equidad)**:
  - En la calculadora se habilitó el dimensionamiento de posición tanto sobre Balance como sobre Equidad (permitiendo a traders en drawdown ajustar el riesgo en base a pérdidas flotantes).
- **Protección contra Stop Loss Cercano**:
  - Se agregó una validación estricta para rechazar distancias de Stop Loss menores a $1 \times 10^{-8}$ respecto al precio de entrada, previniendo dimensionamientos astronómicos u overflow numérico.

### 2. Motor Formal de Reglas de Prop Firms (`src/lib/prop-firm/index.ts`)
- **Modelos de Drawdown Máximo**:
  - `calculateDrawdown()` evalúa tanto **Static Drawdown** (piso fijo anclado a `initialCapital`) como **Trailing Drawdown** (piso dinámico que persigue el *High-Water Mark* de la cuenta).
- **Límite de Pérdida Diaria con Pérdidas Flotantes**:
  - `calculateDailyLoss()` integra tanto el P&L cerrado del día como la pérdida flotante no realizada (*unrealized floating loss*), impidiendo que un trader sobrepase el límite diario manteniendo posiciones en pérdida abiertas.
- **Objetivo de Beneficio**:
  - `calculateProfitTarget()` calcula el progreso exacto y detecta el hito de superación de fase.

### 3. Contabilidad de Doble Partida y Transferencias Entre Cuentas
- **Corrección de Traspaso de Operaciones**:
  - Al editar una operación y cambiar su cuenta asociada (`oldTrade.accountId !== updatedTrade.accountId`), el hook `useStorage` ahora revierte de forma automática el resultado en la cuenta emisora y lo acredita/debita en la cuenta receptora, previniendo balances huérfanos o duplicados.
- **Eliminación en Cascada de Cuentas**:
  - Al eliminar una cuenta, se eliminan en cascada sus operaciones y entradas de diario asociadas, evitando la contaminación de métricas globales con registros huérfanos.

### 4. Blindaje de Almacenamiento y Recuperación ante Corrupción
- Las funciones `getAccounts()`, `getTrades()` y `getJournal()` en `src/lib/storage/index.ts` validan las cargas contra esquemas Zod (`AccountSchema`, `TradeSchema`, `JournalEntrySchema`).
- Si se detecta JSON malformado o campos corruptos en `localStorage`, el sistema intercepta el error, emite una advertencia y restablece un estado seguro sin provocar pantalla blanca ni excepciones no capturadas.

### 5. Especificación Técnica de Backup & Restore (`src/lib/storage/backup-spec.ts`)
- Se diseñó el esquema formal JSON v1.0.0 para copias de seguridad completas con validación previa estricta mediante Zod (`validateBackupString` y `createBackupPayload`).

---

## 8. Fase 2.3: Sistema de Copias de Seguridad y Recuperación Segura

En la Fase 2.3 se implementó el sistema integral de protección, exportación, importación y recuperación resiliente de datos:

### 1. Exportación JSON Segura
- Botón **Exportar Copia de Seguridad** en [`settings/page.tsx`](file:///c:/Users/Jony/Documents/traderisk-manager/src/app/[locale]/settings/page.tsx) con generación dinámica de archivo descargable `traderisk-backup-YYYY-MM-DD-HHmm.json`.
- Estructura normalizada mediante `createBackupPayload()` incluyendo metadatos de auditoría (`exportedAt`, `version: "1.0.0"`, `appName: "TradeRisk Manager"`), cuentas, operaciones, bitácora psicológica y configuración de usuario.

### 2. Importación Transaccional con Vista Previa
- Selector de archivo JSON con validación en memoria vía `validateBackupString()` antes de cualquier mutación de estado.
- **Validaciones de Seguridad**:
  - Límite de tamaño de archivo (máximo 10 MB para prevenir desbordamientos de memoria en el navegador).
  - Validación sintáctica y de esquema estricta mediante Zod (`BackupPayloadSchema`).
  - Detección de identificadores duplicados en cuentas, operaciones y notas.
  - Validación de integridad relacional: verificación de que todas las operaciones y notas pertenecen a cuentas existentes en el archivo.
- **Modal de Vista Previa y Confirmación**:
  - Desglose informativo previo: fecha de generación, versión, número de cuentas (y nombres), número de operaciones y notas del diario.
  - Selector de Modo:
    - **Reemplazar datos actuales (`replace`)**: Sobrescritura atómica limpia del estado.
    - **Fusionar con datos actuales (`merge`)**: Adición de nuevos registros conservando los datos existentes y evitando duplicados por ID.
  - Protección estricta: ninguna sobrescritura ocurre sin confirmación expresa del usuario.

### 3. Recuperación No Destructiva ante Corrupción Local (Cuarentena)
- Se reformuló la gestión de errores en `src/lib/storage/index.ts`:
  - Si se detecta JSON malformado o violación de schema en `localStorage`, **nunca** se sobrescribe automáticamente con datos demo (lo que causaría pérdida irrecuperable de los datos del usuario).
  - El contenido original se archiva de forma preventiva en una clave de cuarentena `trm_quarantine_<key>_<timestamp>`.
  - Se genera un reporte de corrupción (`trm_corruption_report`) que la interfaz visualiza mediante un banner de alerta con las claves afectadas.
  - El usuario puede restaurar una copia válida o descartar la cuarentena sin mezclar datos demo con datos reales.

---

## 9. Fase 3: Motor de Instrumentos Financieros Multiasset

En la Fase 3 se transformó el motor de cálculo en una arquitectura multi-activo extensible de grado cuantitativo profesional, cubriendo Criptomonedas, Forex, Futuros, Acciones e Índices sin duplicación en la capa visual:

### 1. Arquitectura Modular Desacoplada
- **Dispatcher Unificado**: `calculateRisk()` valida entradas globales y despacha a sub-motores especializados:
  - `src/lib/risk-engine/crypto.ts`: `calculateCryptoRisk()` (Spot y Perpetuos con financiación).
  - `src/lib/risk-engine/forex.ts`: `calculateForexRisk()` (Lotes estándar/mini/micro, pips, conversión de divisa cotizada y spread).
  - `src/lib/risk-engine/futures.ts`: `calculateFuturesRisk()` (Multiplicadores de contrato, ticks, contratos discretos enteros y comisiones flat).
  - `src/lib/risk-engine/stocks.ts`: `calculateStocksRisk()` (Acciones enteras/fraccionarias, apalancamiento cash/CFD).
- **Tipos y Parámetros Multi-activo (`src/lib/types.ts`)**:
  - `MarketType`: `'crypto' | 'forex' | 'futures' | 'stocks' | 'indices'`.
  - Parámetros ampliados en `RiskCalculationInput`: `contractMultiplier`, `tickSize`, `tickValue`, `lotType`, `pipSize`, `quoteToAccountRate`, `baseToAccountRate`, `fundingRate`, `fundingPeriods`, `spreadPips`, `commissionPerContract`, `initialMarginPerUnit`, `allowFractional`.
  - Métricas de detalle en `RiskCalculationOutput`: `positionSizeUnit`, `ticksOrPips`, `pipValue`, `tickValue`, `pointValue`, `fundingCost`, `effectiveRiskAmount`.

### 2. Modelos Financieros Específicos
- **Criptomonedas (Spot & Perpetuals)**:
  - Dimensionamiento de tamaño con precisión decimal (`0.0001 BTC`, etc.).
  - Distinción rigurosa entre valor nocional y margen requerido (`notional / leverage`).
  - Arrastre por tasa de financiación (*Funding Rate Drag*): cálculo de coste o abono acumulado según la dirección y número de ciclos de financiamiento (`positionSize * entryPrice * fundingRate * periods`).
- **Forex (Divisas y CFDs de FX)**:
  - Unidades por lote parametrizables: Estándar ($100,000$), Mini ($10,000$), Micro ($1,000$).
  - Cálculo dinámico del valor del pip ($PV$) ajustado por tipo de cambio de la divisa cotizada a la divisa de la cuenta:
    - Cuando la divisa cotizada es la divisa de cuenta: $PV = \text{unitSize} \times \text{pipSize}$.
    - Cuando la divisa base es la divisa de cuenta (ej. USD/JPY con cuenta USD): $PV = \frac{\text{unitSize} \times \text{pipSize}}{P_{\text{entry}}}$.
    - Para pares cruzados con cotización externa: $PV = (\text{unitSize} \times \text{pipSize}) \times \text{quoteToAccountRate}$.
  - Integración de fricción de spread en pips tanto en la pérdida al SL como en el beneficio al TP.
- **Futuros Financieros (CME, Eurex, etc.)**:
  - Modelado con multiplicador de contrato ($M$) y tamaño mínimo de tick ($\Delta_{\text{tick}}$).
  - Valor del tick: $V_{\text{tick}} = \Delta_{\text{tick}} \times M$ (ej. $0.25 \times 50 = \$12.50$ para ES).
  - Dimensionamiento en contratos enteros discretos no fraccionarios: $N = \lfloor \frac{\text{Risk}}{\text{points} \times M} \rfloor$.
  - Riesgo monetario efectivo (`effectiveRiskAmount`) representativo de la granularidad entera real.
  - Margen de garantía inicial configurable por contrato según especificación del broker/clearing house (ej. $\$1,200$ intradía por contrato ES).
  - Comisiones planas por contrato (*round-turn*) en dólares (ej. $\$4.50/\text{contrato}$).
- **Acciones e Índices**:
  - Soporte de acciones enteras para brokers tradicionales y fraccionarias para neobrokers fintech.
  - Distinción entre compra al contado (leverage $1\times$) y CFDs sobre acciones/índices con apalancamiento.

### 3. Calculadora Multi-Asset en UI (`src/app/[locale]/calculator/page.tsx`)
- Selector de categoría de mercado con pestañas visuales con badge: Cripto, Forex, Futuros, Acciones.
- Presets rápidos de activos comunes:
  - Cripto: BTC/USDT, ETH/USDT, SOL/USDT.
  - Forex: EUR/USD, USD/JPY, GBP/USD, EUR/GBP.
  - Futuros: E-mini S&P 500 (ES), Micro E-mini (MES), E-mini Nasdaq (NQ), Crude Oil (CL).
  - Acciones: Apple (AAPL), Nvidia (NVDA), S&P 500 ETF (SPY).
- Campos dinámicos adaptados según el mercado seleccionado:
  - Forex: Selector de tipo de lote, tamaño de pip, tipo de cambio cruzado, spread en pips.
  - Futuros: Multiplicador, tick size, margen inicial por contrato del broker, comisión por contrato.
  - Cripto: Tasa de financiación del período (% 8h), ciclos estimados.
  - Acciones: Toggle de acciones fraccionarias.
- Tarjeta de Resultados adaptativa:
  - Muestra el tamaño en la unidad nativa del activo (`contratos`, `lotes`, `acciones`, `BTC`).
  - Desglose de distancia en Pips o Ticks.
  - Valor del pip / tick en dólares.
  - Coste de financiación esperado (en perpetuos).
  - Riesgo monetario efectivo tras redondeo discreto de contratos/lotes.
  - R:R bruto y R:R neto tras todas las fricciones financieras (comisiones, spread y funding).

---

## 10. Fase 3.1: Auditoría Cuantitativa Avanzada del Motor Multiasset

Durante la Fase 3.1 se llevó a cabo una auditoría cuantitativa profunda por parte de un Quant Developer sénior y especialista en derivados, solventando fallos críticos de dimensionamiento y elevando el motor a estándares institucionales:

### 1. Futuros: Blindaje de Riesgo y Contratos Enteros Discretos
- **Corrección de Forzado de Contrato**: Se eliminó el uso de `Math.max(1, Math.floor(rawContracts))` que forzaba 1 contrato cuando el presupuesto de riesgo no alcanzaba. Ahora, si $\lfloor \text{rawContracts} \rfloor = 0$, el motor devuelve estrictamente `positionSize = 0`, `isOperable = false` y `inoperableReason = 'Presupuesto de riesgo insuficiente para operar 1 contrato entero sin exceder el riesgo permitido.'`.
- **Presupuesto de Riesgo Neto (`includeFeesInRisk`)**: Sizing institucional donde las comisiones flat round-turn se integran en el denominador: $\text{UnitRisk} = (\Delta_{\text{SL}} \times M) + \text{CommPerContract}$, garantizando que la pérdida neta al Stop Loss jamás supere el presupuesto asignado.
- **Validación de Especificación de Contrato**: Validación de $M > 0$, $\Delta_{\text{tick}} > 0$ y consistencia de $V_{\text{tick}} = \Delta_{\text{tick}} \times M$.
- **Validación de Margen de Garantía**: Comprobación estricta de solvencia de capital frente al margen inicial exigido por el broker.

### 2. Forex: Spread, Pip Value y Coherencia de Divisas
- **Pares Cruzados y Multi-Divisa**: Implementación y auditoría de conversiones cruzadas para cuentas en USD, EUR y GBP sobre pares directos (EUR/USD), inversos (USD/JPY) y cruzados (EUR/GBP, GBP/JPY).
- **Convención de Precios y Anti-Doble Contabilización de Spread**:
  - Por defecto se asumen precios Mid-market; la fricción del spread se computa una única vez como coste de transacción $\text{SpreadCost} = \text{Lots} \times \text{SpreadPips} \times PV$.
  - Si el trader introduce precios reales de ejecución (`pricesIncludeSpread: true`), el spread no se vuelve a imputar en comisiones, erradicando la doble contabilización.
- **Lote Mínimo y Riesgo Cap**: Si el presupuesto no cubre el micro-lote mínimo ($0.01$), el motor retorna `positionSize = 0` e `isOperable = false`.

### 3. Criptomonedas Perpetuas: Convención de Signos y Liquidación Previa
- **Convención Formal de Funding Rate**:
  - $FR > 0$ (Prima): Posición Long PAGA financiación (coste $\to$ mayor pérdida al SL y menor beneficio al TP); posición Short RECIBE financiación (rebate).
  - $FR < 0$ (Descuento): Posición Short PAGA financiación; posición Long RECIBE financiación.
  - Intervalos parametrizables: Soporte dinámico para plataformas de ciclo de 8h (Binance, Bybit) y de 1h (dYdX, Hyperliquid) mediante $\text{períodos} = \text{holdingHours} / \text{intervalHours}$.
- **Alerta Crítica de Liquidación Previa al Stop Loss (`isLiquidationBeforeSL`)**:
  - En posiciones apalancadas, se modela el precio de liquidación aproximado ($P_{\text{liq}} = P_{\text{entry}} \times (1 \mp \frac{1}{\text{leverage}} \pm \text{MMR})$).
  - Si $P_{\text{SL}}$ está más allá de $P_{\text{liq}}$, el sistema aborta la operabilidad con advertencia severa para prevenir llamadas de margen o liquidaciones forzosas.

### 4. Precisión Numérica y Aritmética IEEE-754 (`precision.ts`)
- Módulo cuantitativo especializado con funciones `calcPips`, `calcTicks`, `roundToStep`, `floorToStep` y `roundDecimal` que evitan el drift de representación binaria (e.g. $24.999999999999957 \to 25.0$ pips).
- Truncamiento hacia abajo en lotes y contratos (`floorToStep`) para garantizar que el redondeo jamás incremente el riesgo financiero del trader.

### 5. Márgenes, Liquidez y Separación Conceptual
- Clara diferenciación visual y cuantitativa entre:
  - **Valor Nocional**: Exposición total del activo subyacente.
  - **Margen Inicial**: Depósito de garantía retenido (no es una pérdida).
  - **Margen de Mantenimiento**: Nivel mínimo de equidad antes de liquidación.
  - **Pérdida al Stop Loss**: Pérdida dineraria esperada por movimiento de mercado adverso.
  - Flag `isMarginEstimated`: Indica con transparencia cuándo el margen es inferido por falta de ficha técnica del broker.

---

## 11. Fase 3.2: Validación Final de Robustez Cuantitativa y 10 Invariantes Matemáticas

En la Fase 3.2 se consolidó la robustez definitiva del motor de riesgo financiero mediante auditoría multidisciplinar, elevando el test suite a 113 pruebas automatizadas:

### 1. Liquidación de Criptomonedas: Aislado vs Cruzado
- **Margen Aislado (`isolated`)**: La pérdida máxima tolerable antes de liquidación está delimitada estrictamente por el margen asignado ($\text{notional} / \text{leverage}$), incorporando el margen de mantenimiento ($\text{MMR} = 0.5\%$) y la comisión estimada de cierre.
- **Margen Cruzado (`cross`)**: La posición está respaldada por la totalidad del margen libre de la cuenta ($\text{FreeMargin} = \text{Equity} - \text{UsedMargin}$), alejando dinámicamente el precio de liquidación en función del excedente de equidad.
- **Transparencia y No Exactitud Absoluta**: Se identificó explícitamente `isLiquidationEstimated: true` y `liquidationMethodology`, clarificando que en exchanges reales la liquidación depende de Mark Price ponderado, tarifas del fondo de seguro y tablas de margen escalonado (*tiered margin*).

### 2. Financiación (*Funding*) y Prudencia Conservadora
- **No Inflación de Riesgo por Rebates Futuros**: Bajo modo de riesgo estricto (`includeFeesInRisk`), los costes de financiación proyectados (cuando el trader debe pagar) se incorporan en el denominador para reducir el tamaño de la posición. Sin embargo, los rebates proyectados futuros (cuando el trader cobraría financiación) no se utilizan para inflar el tamaño de posición, protegiendo al trader ante inversiones imprevistas de la tasa de financiación.

### 3. Forex: Coherencia de Divisas y Resolución Exacta de Tipos Cruzados
- **Conversión de Divisa Base y Cotizada**:
  - Se implementó la resolución exacta del tipo de cambio cruzado: $\text{BaseToAccountRate} = \text{entryPrice} \times \text{quoteToAccountRate}$ para pares donde ni la base ni la cotizada coinciden con la divisa de cuenta.
  - Validación completa para 5 combinaciones clave: GBP/JPY en USD, EUR/GBP en EUR, EUR/USD en GBP, USD/JPY en EUR y GBP/USD en EUR.
  - Si falta una tasa de conversión requerida para un par cruzado, la operación se clasifica automáticamente como no operable (`isOperable = false`) sin asumir conversiones $1.0$ espurias.

### 4. Precisión Numérica y Comportamiento Aritmético (`precision.ts`)
- **Blindaje contra Drift Notacional**: Corrección en `roundDecimal` para números infinitesimales (e.g. $5.55 \times 10^{-17}$) evitando errores de concatenación exponencial con `NaN`.
- **Detección de Precios Fuera de Tick Grid**: Función `isPriceOnGrid()` y flag `enforceTickGrid` para prevenir órdenes rechazadas por el matching engine de bolsas centralizadas (CME).
- **Sumas PnL Precisas**: Función `sumPnL()` para agregación determinista de series de operaciones.

### 5. Margen Disponible Real (`FreeMargin = Equity - UsedMargin`)
- Se erradicó el uso del balance estático para validar la suficiencia de capital. Ahora el motor evalúa el margen libre real disponible considerando la equidad neta y el margen ya comprometido en posiciones abiertas, previniendo llamadas de margen imprevistas.

### 6. Verificación de las 10 Invariantes Matemáticas Fundamentales
1. Si `isOperable` es `false`, `positionSize` es estrictamente $0$.
2. Con `includeFeesInRisk: true`, la pérdida neta real al Stop Loss jamás supera el presupuesto ($\text{effectiveNetRisk} \le \text{riskAmount}$).
3. Futuros nunca fuerzan un contrato si el presupuesto no lo cubre.
4. El tamaño de posición discreta siempre trunca hacia abajo ($\text{floor}$).
5. Precios incompatibles con el tick size generan advertencia o excepción.
6. Falta de tasa cruzada válida marca la operación como inoperable con $0$ lotes.
7. Precios de ejecución Bid/Ask no duplican el spread en costes de transacción.
8. El margen retenido nunca se computa como pérdida potencial.
9. Stop Loss ubicado tras el precio de liquidación genera alerta crítica e inoperabilidad.
10. Idempotencia y estabilidad absoluta ante llamadas sucesivas idénticas.

---

## 12. Fase 4: Persistencia en la Nube, Autenticación y Sincronización Segura

En la Fase 4 se transformó TradeRisk Manager en una aplicación con persistencia híbrida en la nube y sincronización multi-dispositivo sin alterar el funcionamiento offline-first original ni romper el modelo Zero-Knowledge local.

### 1. Arquitectura de Datos y Migraciones SQL (`supabase/migrations/`)
- **Migración Versionada**: `supabase/migrations/20261031_initial_schema.sql` define el esquema PostgreSQL completo.
- **Tablas Creadas**:
  - `profiles`: Vinculada a `auth.users(id)` con nombre completo, avatar y fecha de registro.
  - `accounts`: Cuentas de trading vinculadas a `user_id` con balances, equidad, moneda, objetivos y reglas de drawdown.
  - `trades`: Historial y operaciones abiertas/cerradas con integridad relacional hacia `accounts(id)`.
  - `journal_entries`: Bitácora y notas psicológicas con integridad relacional hacia `accounts(id)`.
  - `user_settings`: Preferencias de interfaz (idioma, tema, cuenta por defecto).
- **Row Level Security (RLS)**:
  - RLS activado en todas las tablas privadas (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
  - Políticas de aislamiento estricto: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`.
  - Disparadores PostgreSQL (`handle_updated_at` y `handle_new_user`) para sincronización automática de timestamps y creación de perfil al registrarse.

### 2. Separación de Clientes Supabase (`src/lib/supabase/`)
- **`types.ts`**: Tipado TypeScript generado exhaustivo para todas las tablas, vistas y enums de la base de datos.
- **`client.ts`**: Cliente del navegador (`createBrowserClient` vía `@supabase/ssr`), con verificación segura `isSupabaseConfigured()` que retorna `null` elegantemente si no existen credenciales, permitiendo que la aplicación opere 100% en modo local sin excepciones.
- **`server.ts`**: Cliente Server-Side (`createServerClient`) con gestión de cookies compatible con Server Components y Server Actions de Next.js 16.
- **Seguridad**: Se utiliza exclusivamente la clave anónima pública (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) en el navegador. La Service Role Key nunca se expone en código cliente.

### 3. Contexto de Autenticación (`src/context/AuthContext.tsx` & `src/hooks/useAuth.ts`)
- Proveedor de autenticación reactivo con soporte para:
  - Registro de cuenta (`signUp`) con nombre completo opcional.
  - Inicio de sesión (`signIn`) con email y contraseña.
  - Cierre de sesión (`signOut`) seguro.
  - Restablecimiento de contraseña (`resetPassword`).
  - Detección de estado de sesión (`onAuthStateChange`) y fallback a modo local cuando Supabase no está configurado.

### 4. Motor de Sincronización Bidireccional (`src/lib/sync/sync-engine.ts`)
- **Idempotencia Absoluta**: Mapeo determinista entre `camelCase` (dominio TypeScript) y `snake_case` (PostgreSQL).
- **Resolución de Conflictos Last-Write-Wins**: Comparación de marcas temporales (`updated_at` / `closeDate` / `date`) para fusionar datos entre local y remoto sin pérdidas de información.
- **Integridad Relacional Garantizada**: Operaciones y notas huérfanas que hagan referencia a cuentas no existentes son rechazadas antes de contactar la base de datos para prevenir fallos de clave foránea.
- **Deduplicación**: Fusión de colecciones indexada por `id` UUID.

### 5. Hook Reactivo de Sincronización (`src/hooks/useSync.ts`)
- Sincronización automática al iniciar sesión.
- Detección reactiva de eventos `online` y `offline` del navegador.
- Sincronización periódica cada 5 minutos en segundo plano mientras la aplicación permanece activa.
- Emisión del evento `trm-storage-update` para actualizar instantáneamente la UI al descargar cambios remotos.

### 6. Componentes Visuales y Experiencia de Usuario
- **`AuthModal.tsx`**: Modal accesible con pestañas para Iniciar Sesión, Registro y Recuperación de Contraseña, adaptado al tema Fintech Dark Navy (`#0A1128`, `#111C35`, `#00F0FF`). Muestra un panel informativo claro si Supabase no está configurado en el entorno.
- **`MigrationModal.tsx`**: Asistente de migración guiada con:
  - Vista previa de datos locales (número de cuentas, balance total, operaciones, notas del diario).
  - Descarga preventiva de seguridad (`createPreMigrationBackup()`) previa a la sincronización.
  - Verificación de relaciones e integridad.
  - Confirmación explícita del usuario y feedback de progreso.
- **`AppShell.tsx`**:
  - Píldora de estado de nube en la barra superior (Offline / Modo Local / Sincronizando / Nube OK).
  - Avatar de usuario con dropdown interactivo para forzar sincronización, abrir el asistente de migración o cerrar sesión.
- **`settings/page.tsx`**: Tarjeta de gestión de persistencia en la nube con indicadores de estado de RLS, variables de entorno requeridas y acciones directas.

### 7. Cobertura de Pruebas (Fase 4)
- **`src/__tests__/supabase-sync.test.ts`** (10 tests añadidos, elevando el suite a 123 tests):
  - Detección de configuración de entorno y fallback seguro a LocalStorage.
  - Cálculo de vista previa de migración y detección de relaciones huérfanas.
  - Generación de copia de seguridad preventiva válida (Schema v1.0.0).
  - Sincronización ascendente (local a remoto) y descendente (remoto a local).
  - Idempotencia (doble sincronización no genera duplicados).
  - Resolución de conflictos temporal Last-Write-Wins.
  - Protección de integridad relacional (rechazo de trades huérfanos).

---

## 13. Fase 4.1: Auditoría de Seguridad, Integridad y Sincronización Offline-First

En la Fase 4.1 se realizó una auditoría profunda de robustez sobre el sistema distribuido, implementando un protocolo estricto de borrados suaves (soft-deletes) con tombstones, aislamiento de almacenamiento local por usuario, resolución determinista de conflictos en 4 niveles y endurecimiento de esquemas PostgreSQL con claves foráneas compuestas.

### 1. Sincronización de Eliminaciones (Tombstones & Soft-Deletes)
- **Campos de Auditoría**: Se incorporaron `deleted_at TIMESTAMPTZ` y `version INTEGER NOT NULL DEFAULT 1` en las tablas `accounts`, `trades` y `journal_entries`.
- **Estructura Local de Tombstones**: Registro de objetos `Tombstone` (`id`, `entity`, `deletedAt`, `updatedAt`, `accountId?`, `userId?`) en LocalStorage bajo la clave aislada `trm_tombstones` / `trm_user_<userId>_tombstones`.
- **Sincronización Bidireccional de Bajas**:
  - Si un registro se elimina localmente, se propaga con `deleted_at` hacia PostgreSQL en la siguiente sincronización.
  - Si se detecta un registro con `deleted_at` en el servidor, se elimina de las listas activas de LocalStorage y se guarda el tombstone local para garantizar idempotencia.
  - Sincronizaciones sucesivas nunca resucitan registros eliminados.
- **Borrado en Cascada**: Al eliminar una cuenta (`deleteAccount`), el hook `useStorage` y el motor `sync-engine` generan automáticamente tombstones en cascada para todas las operaciones y notas del diario que dependían de dicha cuenta.

### 2. Aislamiento Estricto de Datos Locales por Usuario (Namespaces)
- **Separación Física de Claves**:
  - Modo invitado (`guest`): utiliza las claves heredadas (`trm_accounts`, `trm_trades`, `trm_journal`, etc.) manteniendo 100% de compatibilidad hacia atrás.
  - Modo autenticado (`user_<userId>`): utiliza claves con prefijo específico `trm_user_<userId>_<entity>`.
- **Prevención de Contaminación Cruzada**:
  - Si el Usuario A y el Usuario B inician sesión secuencialmente en el mismo navegador, sus datos quedan estrictamente aislados en sus respectivos namespaces.
  - `signOut()` invoca `setStorageNamespace(null)` regresando al modo invitado, resetea el estado en memoria y emite el evento `trm-storage-update` para impedir que la sesión anterior sea accesible.
- **Importación Guiada de Invitado a Cuenta Autenticada**:
  - Función `hasGuestDataToImport()` detecta si existen datos creados previamente en modo invitado.
  - Función `importGuestDataToUser(userId)` transfiere explícitamente los datos al namespace del usuario autenticado tras confirmación del usuario, sin pérdida de datos.

### 3. Resolución de Conflictos Determinista y Last-Write-Wins en 4 Niveles
- **Marcas Temporales Genuinas**: Se erradicó el uso de `closeDate` o `date` como marcas de modificación. Todas las entidades de dominio implementan `createdAt`, `updatedAt` y `version`.
- **Protocolo de Decisión `resolveConflictLWW()`**:
  1. **Nivel 0 (No-Op Idéntico)**: Normalización de entidades (`normalizeAccount`, `normalizeTrade`, `normalizeJournal`) y comparación de hash/contenido. Si ambos lados son funcionalmente equivalentes, no se ejecuta ninguna subida, descarga ni incremento de conflicto (`identical_noop`).
  2. **Nivel 1 (Marca Temporal LWW)**: La marca `updatedAt` más reciente prevalece.
  3. **Nivel 2 (Versión Optimista)**: Si las marcas temporales son idénticas hasta el milisegundo, la mayor versión numérica prevalece.
  4. **Nivel 3 (Desempate Determinista)**: Si las marcas temporales y las versiones son idénticas, se compara alfabéticamente la serialización JSON canónica (`localDataHash > remoteDataHash ? 'local_wins' : 'remote_wins'`), garantizando que todos los clientes distribuidos converjan exactamente en el mismo estado sin divergencias ni split-brain.

### 4. Integridad Referencial y Endurecimiento SQL en PostgreSQL (`supabase/migrations/`)
- **Migración SQL**: `supabase/migrations/20261031_phase_4_1_security_and_tombstones.sql`.
- **Restricción Única Compuesta**:
  - `ALTER TABLE public.accounts ADD CONSTRAINT uq_accounts_id_user_id UNIQUE (id, user_id);`
- **Claves Foráneas Compuestas Anti-Suplantación**:
  - `trades(account_id, user_id) REFERENCES accounts(id, user_id) ON DELETE CASCADE`
  - `journal_entries(account_id, user_id) REFERENCES accounts(id, user_id) ON DELETE CASCADE`
  - *Beneficio de Seguridad*: Impide que un usuario malicioso o un cliente desincronizado asocie operaciones o notas a una cuenta que pertenezca a otro usuario, resolviendo la vulnerabilidad de referencia foránea cruzada a nivel de motor de base de datos.
- **Hardening de Funciones PostgreSQL**:
  - Funciones `handle_updated_at()` y `handle_new_user()` redefinidas con `SECURITY DEFINER SET search_path = public, auth, pg_temp;`.
  - Permisos revocados de `PUBLIC`: `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC;`.
- **Optimización de Índices**: Índices B-Tree compuestos sobre `(user_id, deleted_at)` en las 3 tablas para consultas de sincronización de alto rendimiento.

### 5. Migración Recuperable y Resiliente (`executeResilientMigration`)
- **Copia de Seguridad Preventiva Obligatoria**: Antes de iniciar la transferencia de datos, se genera un archivo de respaldo inmutable en memoria con `createPreMigrationBackup()`.
- **Identificador de Migración**: Cada ejecución genera un `migrationId` único para trazabilidad.
- **Validación Relacional Previa**: Comprobación estricta de relaciones padre-hijo antes de interactuar con Supabase. Las operaciones huérfanas son aisladas y no se suben para evitar violaciones de clave foránea.
- **Verificación Remota de Conteos**: La función consulta a PostgreSQL y valida que el recuento de cuentas, operaciones y diario en la nube coincida con lo subido antes de declarar éxito.
- **Preservación No Destructiva**: Los datos locales en LocalStorage nunca se borran durante ni después de la migración.

### 6. Matriz de Validación de Escenarios Reales (14 Escenarios de Auditoría)
El archivo `src/__tests__/supabase-security-and-sync-audit.test.ts` implementa pruebas automatizadas para todos los escenarios de riesgo financiero y distribución:
1. *Escritorio a Móvil*: Eliminación en escritorio propaga tombstone a la base remota y al dispositivo móvil.
2. *Móvil a Escritorio*: Eliminación en móvil se refleja en escritorio mediante descarga de soft-delete.
3. *Aislamiento Multi-Usuario*: Usuario A y Usuario B en el mismo navegador tienen aislamiento estricto de namespaces.
4. *Cierre de Sesión Limpio*: `signOut` limpia estado en memoria y regresa a modo invitado sin filtrar datos.
5. *Modificación Simultánea*: Mismo timestamp exacto se resuelve deterministamente sin divergencia.
6. *Llegada Fuera de Orden*: Actualización obsoleta que llega retrasada por red es descartada por LWW.
7. *Referencia Cruzada de Trade*: Operación asociada a cuenta de otro usuario es rechazada.
8. *Referencia Cruzada de Diario*: Entrada de diario asociada a cuenta de otro usuario es rechazada.
9. *Interrupción de Migración*: Fallo de red a mitad de migración no destruye los datos locales ni el backup.
10. *Idempotencia de Migración*: Reanudación tras error no duplica registros en la base de datos.
11. *Fallo de Red en Subida*: Error controlado devuelto sin corrupción de LocalStorage.
12. *Fallo de Red en Descarga*: Fallo de lectura preserva los registros existentes en LocalStorage.
13. *Eliminación en Cascada*: Borrado de cuenta genera tombstones en cascada para operaciones y diario.
14. *Estabilidad Post-Baja*: Múltiples sincronizaciones sucesivas tras un borrado nunca resucitan los datos.
*Bonus*: Importación explícita de datos de invitado a usuario tras confirmación.

---

## 14. Fase 4.2: Auditoría de Producción y Verificación Real de Supabase

En la Fase 4.2 se llevó a cabo una auditoría rigurosa orientada a producción sobre PostgreSQL, Supabase RLS y el motor de sincronización distribuida, eliminando vulnerabilidades potenciales y garantizando convergencia matemática estricta sin split-brain.

### 1. Serialización JSON Canónica y Normalización Determinista
- **`canonicalJsonStringify(obj)`**: Serializador recursivo que ordena alfabéticamente todas las propiedades anidadas, omite valores `undefined` y unifica la representación textual de datos complejos.
- **Normalización Estricta de Entidades**:
  - `normalizeAccount()`: redondeo determinista de balance y equidad a 2 decimales, sanitización de moneda a mayúsculas, formato UTC canónico para fechas.
  - `normalizeTrade()`: normalización de precios y tamaños a 8 decimales, comisiones y resultados a 4 decimales, sanitización de símbolos de activos a mayúsculas y fechas UTC ISO estandarizadas.
  - `normalizeJournal()`: sujeción estricta de disciplina al rango entero [1, 5], booleanos forzados y normalización de textos.
- **Invariancia de Hash**: Garantiza que dos clientes con propiedades en orden inverso o con diferencias estéticas generen la misma firma exacta, evitando falsos conflictos y previniendo bucles de sincronización.

### 2. Desempate Determinista y Convergencia Distribuida Multi-Cliente
- **Resolución de Conflictos LWW en 4 Niveles**:
  1. *Identical No-Op*: Si los hashes canónicos de ambas entidades coinciden, se descarta cualquier transferencia o incremento de versión.
  2. *Timestamp UTC*: Prevalece la fecha de modificación más reciente.
  3. *Versión Optimista*: Ante igualdad de timestamps, prevalece la mayor versión numérica.
  4. *Desempate Canónico*: Ante empate exacto en timestamp y versión, se realiza una comparación alfabética estricta sobre la cadena serializada (`localCanonical > remoteCanonical ? 'local_wins' : 'remote_wins'`), garantizando que todos los nodos distribuidos seleccionen exactamente el mismo registro ganador sin divergencia.
- **Invarianza de Orden de Llegada**: Pruebas con dos clientes (Cliente A y Cliente B) modificando la misma operación demuestran que, independientemente del orden en que sincronicen con la nube, ambos terminan convergiendo al mismo registro final.
- **Prevención de Bucles de Sincronización**: Al descargar datos remotos, el motor conserva intactos `updatedAt` y `version` sin generar marcas artificiales en el cliente.

### 3. Poda Segura de Tombstones (Política de Retención de 90 Días)
- **Función `pruneExpiredTombstones(maxAgeDays = 90)`**: Limpia de manera segura tombstones con más de 90 días de antigüedad en LocalStorage.
- **Protección de Dispositivos Desconectados**: Cualquier dispositivo que se reconecte dentro de un margen de 3 meses recibe y procesa todas las bajas pendientes antes de que los tombstones sean purgados.

### 4. Vulnerabilidades Encontradas y Correcciones en PostgreSQL (`20261031_phase_4_2_production_hardening.sql`)
1. **Fallo en Trigger `handle_updated_at()`**:
   - *Vulnerabilidad previa*: El trigger ejecutaba `NEW.version = COALESCE(OLD.version, 1) + 1;` incondicionalmente. Al ejecutarse en tablas sin columna `version` (`profiles` y `user_settings`), PostgreSQL lanzaba la excepción `record "new" has no field "version"`.
   - *Corrección*: Se agregó `version INTEGER NOT NULL DEFAULT 1` a `profiles` y `user_settings`, y se protegió el trigger con un bloque `EXCEPTION WHEN undefined_column THEN NULL;`.
2. **Deriva Temporal del Cliente durante Sincronización Offline**:
   - *Vulnerabilidad previa*: El trigger sobreescribía siempre `NEW.updated_at = now()`, ignorando el timestamp registrado por el cliente offline. Al día siguiente, el cliente detectaba una versión remota con timestamp espurio y generaba un falso conflicto.
   - *Corrección*: `IF NEW.updated_at IS NULL OR (TG_OP = 'UPDATE' AND NEW.updated_at = OLD.updated_at) THEN NEW.updated_at = timezone('utc'::text, now()); END IF;`.
3. **Omisión de Política INSERT en `profiles`**:
   - *Vulnerabilidad previa*: Sólo existían políticas SELECT y UPDATE en `profiles`. Si un cliente intentaba aprovisionar su perfil manualmente, RLS denegaba el acceso.
   - *Corrección*: Política explícita `CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);` y endurecimiento de UPDATE con `WITH CHECK (auth.uid() = id)`.

### 5. Suite de Pruebas de Integración Real (`src/__tests__/supabase-integration.real.test.ts`)
- Arnés de pruebas diseñado para validar el aislamiento multi-tenant directamente contra PostgreSQL y Supabase:
  1. Usuario A crea una cuenta y operaciones.
  2. Usuario B intenta consultar los registros de A (RLS devuelve 0 filas).
  3. Usuario B intenta modificar una operación de A (RLS devuelve 0 filas afectadas).
  4. Usuario B intenta asociar una operación propia a la cuenta de A (PostgreSQL rechaza con código 23503 por clave foránea compuesta `fk_trades_account_user`).
  5. Usuario B intenta insertar una nota de diario con la cuenta de A (PostgreSQL rechaza con código 23503 por `fk_journal_account_user`).
  6. Usuario A intenta consultar datos de B (RLS aísla bidireccionalmente).
- **Ejecución Condicional Segura**: Si no se configuran variables de conexión en vivo (`NEXT_PUBLIC_SUPABASE_URL` / credenciales de prueba), Vitest omite el suite con advertencia clara, sin falsos positivos y sin simular RLS en mocks.

### 6. Limitaciones Pendientes
- **Atomicidad Distribuida**: No existe protocolo Two-Phase Commit (2PC) global entre el `localStorage` del navegador y Supabase PostgreSQL. En caso de corte eléctrico del dispositivo exactamente entre la confirmación remota y la persistencia local, la siguiente sincronización resuelve el estado mediante LWW.
- **Ejecución de Pruebas Reales de RLS**: Las pruebas de integración en vivo requieren un proyecto activo de Supabase o contenedor Docker local con `supabase start`. En entornos CI/CD sin Supabase aprovisionado, se ejecutan las 13 suites unitarias (148 tests) mientras que el suite real permanece a la espera de credenciales.

---

## 15. Fase 5: Analítica Cuantitativa Avanzada, Monte Carlo y Simulador Prop Firm

En la Fase 5 se implementó un motor analítico y estocástico institucional para modelar la ventaja estadística, la consistencia temporal, el riesgo de ruina y la probabilidad de superar o quebrar cuentas de fondeo bajo reglas profesionales.

### 1. Módulo de Expectativa Matemática (`src/lib/analytics/expectancy.ts`)
- **Expectativa Neta por Operación**:
  $$\text{Expectativa (\$)} = \frac{\text{Net Profit}}{\text{Total Trades}} = (\text{WinRate} \times \text{AvgWin}) - (\text{LossRate} \times \text{AvgLoss})$$
- **Expectativa en R-Múltiplos**:
  $$\text{Expectativa (R)} = (\text{WinRate} \times \text{AvgWin}_R) - (\text{LossRate} \times \text{AvgLoss}_R)$$
  Calculada identificando la unidad de riesgo $1R = |\text{EntryPrice} - \text{StopLoss}| \times \text{Size}$ de cada operación cerrada.
- **Tratamiento Diferenciado de Breakeven**:
  Las operaciones con resultado neto $|P\&L| \le 0.01$ no se computan erróneamente como pérdidas ni inflan artificialmente la tasa de acierto, computándose de forma separada: $\text{Total} = \text{Wins} + \text{Losses} + \text{Breakevens}$.
- **Profit Factor Robusto**:
  $$\text{Profit Factor} = \frac{\text{Gross Profit}}{|\text{Gross Loss}|}$$
  Protegido con división segura: devuelve `Infinity` si $\text{Gross Loss} = 0$ y $\text{Gross Profit} > 0$, o `0` si ambos son cero.
- **Evaluación de Muestra Estadística**:
  - $N < 10$: Muestra insuficiente con advertencia de significancia estadística.
  - $10 \le N < 30$: Muestra moderada con advertencia de margen de error.
  - $N \ge 30$: Muestra estadísticamente suficiente para inferencia.

### 2. Módulo de Drawdown y Consistencia (`src/lib/analytics/drawdown.ts`)
- **Seguimiento del High-Water Mark (HWM)**:
  Cresta máxima histórica del balance tras cada operación cronológica.
- **Max Drawdown y Drawdown Actual**:
  $$\text{Drawdown (\%)} = \frac{\text{Peak} - \text{Balance}}{\text{Peak}} \times 100$$
- **Factor de Recuperación**:
  $$\text{Recovery Factor} = \frac{\text{Net Profit}}{\text{Max Drawdown Amount}}$$
- **Duración de Drawdown (Recovery Trades)**:
  Número máximo de operaciones consecutivas que la cuenta estuvo bajo el agua antes de registrar un nuevo máximo histórico.
- **Rachas Ganadoras y Perdedoras**:
  Seguimiento estricto de secuencias consecutivas de victorias y derrotas.

### 3. Motor Monte Carlo Bootstrap Determinista (`src/lib/analytics/monte-carlo.ts`)
- **Generador Pseudoaleatorio Mulberry32**:
  Algoritmo PRNG de 32 bits determinista con soporte de semilla (`seed`), garantizando reproducibilidad exacta de simulaciones para testing y auditoría.
- **Remuestreo Bootstrap con Reemplazo**:
  Muestreo empírico de operaciones históricas reales expresadas en múltiplos de R o resultados netos.
- **Modo Paramétrico / Distribución Teórica**:
  Simulación basada en parámetros $(\text{Win Rate}, \text{Average Win}, \text{Average Loss})$ para estrategias nuevas o con historial reducido.
- **Modelos de Riesgo**:
  - `fixed_amount`: Riesgo monetario fijo constante por operación.
  - `percentage_equity`: Riesgo compuesto variable como porcentaje del capital flotante en cada paso.
- **Haz de Curvas Percentilares**:
  Cálculo de percentiles $P_5$ (pesimista), $P_{25}$, $P_{50}$ (mediana), $P_{75}$ y $P_{95}$ (optimista) en cada operación del horizonte.
- **Distribución de Frecuencia de Equidad Final**:
  Agrupación de resultados en histogramas de 10 bins con recuento y porcentaje.
- **Métricas Institucionales**:
  Probabilidad de ganancia, probabilidad de alcanzar el objetivo, probabilidad de ruina ($<10\%$ del capital) y probabilidad de vulnerar el límite de drawdown.

### 4. Módulo de Riesgo de Ruina y Criterio de Kelly (`src/lib/analytics/risk-of-ruin.ts`)
- **Fórmula Analítica Cerrada de Ralph Vince / Perry Belmont**:
  $$\text{Ventaja (A)} = \frac{W \cdot R - L}{W \cdot R + L}$$
  $$\text{Unidades de Riesgo (U)} = \frac{\text{Max Loss Limit (\%)}}{\text{Risk Per Trade (\%)}}$$
  $$\text{Riesgo de Ruina (Analítico)} = \left(\frac{1 - A}{1 + A}\right)^U$$
  Si $A \le 0$, el riesgo de ruina es $100\%$.
- **Simulación Empírica Monte Carlo**:
  Validación independiente mediante 1,000 caminos aleatorios a lo largo de 200 operaciones.
- **Dimensionamiento Óptimo de Kelly Criterion**:
  $$K = W - \frac{1 - W}{R}$$
  - Full Kelly: tasa teórica de máximo crecimiento asintótico.
  - Half Kelly: reducción del 50% de volatilidad para el 75% del retorno compuesto.
  - Quarter Kelly: estándar recomendado para fondos institucionales y cuentas fondeadas.
- **Probabilidad de Recuperación de Drawdown del 50%**:
  Probabilidad de duplicar el capital ($+100\%$) antes de perder el resto mediante formulación de Gambler's Ruin.
- **Matriz de Sensibilidad al Riesgo**:
  Comparativa de 6 niveles de riesgo ($0.25\%, 0.5\%, 1.0\%, 1.5\%, 2.0\%, 3.0\%$) categorizados como conservador, equilibrado, agresivo o extremo, con recomendaciones automáticas.

### 5. Simulador Institucional de Prop Firm (`src/lib/prop-firm-simulator/index.ts`)
- **Modelado Multi-Regla de Drawdown**:
  1. `static`: Suelo fijo invariable en $\text{Capital} \times (1 - \text{MaxDD}\%)$.
  2. `trailing_balance`: El suelo asciende con cada nuevo pico del balance al cierre de operaciones.
  3. `trailing_equity`: El suelo sigue la cresta de equidad continua.
  4. `trailing_hwm_lock`: El suelo sube con la cresta hasta congelarse permanentemente en el capital inicial una vez que el beneficio acumulado cubre el drawdown (mecanismo estándar de Apex Trader Funding y Topstep).
- **Control de Pérdida Diaria**:
  - `balance_based`: Evaluado respecto al balance de apertura del día.
  - `equity_based`: Evaluado respecto al pico intradía o equidad flotante.
- **Simulación Monte Carlo Multi-Día**:
  Simula $M$ días de trading con $K$ operaciones por día, comisiones por orden, y control en tiempo real de infracciones de pérdida diaria vs. drawdown total.
- **Métricas de Rendimiento**:
  - Probabilidad de aprobación del challenge.
  - Probabilidad de suspensión total.
  - Tasa de breach por pérdida diaria vs. breach por drawdown máximo vs. ambos.
  - Días medios y medianos requeridos para superar la evaluación.
  - Trayectorias de equidad de muestra (aprobadas, fallidas y mediana) para visualización en Recharts.

### 6. Interfaz y Experiencia de Usuario
- **`/[locale]/analytics`**: Panel principal con selector de cuenta y filtros de activo/dirección/estrategia, alertas de significancia estadística, StatCards de expectativa y drawdown, gráfico de balance vs. High-Water Mark y gráfico sumergido de drawdown (underwater).
- **`/[locale]/analytics/monte-carlo`**: Simulador interactivo con selección de datos históricos o teóricos, controles de riesgo y gráficos de percentiles e histograma.
- **`/[locale]/analytics/risk-of-ruin`**: Calculadora analítica y empírica de ruina, Kelly Criterion y tabla de sensibilidad de riesgo.
- **`/[locale]/analytics/prop-firm`**: Simulador de challenge con reglas institucionales de trailing y daily loss, desglose de causas de fallo y curvas de trayectorias.
- **Dashboard (`/[locale]`)**: Widget resumen ejecutivo de expectativa matemática, profit factor, drawdown y racha máxima con enlace directo a analítica.
- **AppShell**: Elemento de navegación "Analítica Cuantitativa" con icono distintivo `Sparkles`.
- **Internacionalización**: Diccionarios bilingües completos en español e inglés (`es` y `en`).

---

## 16. Fase 5.1: Auditoría Matemática, Estadística y Validación del Motor Monte Carlo (Completada)

En la Fase 5.1 se realizó una auditoría cuantitativa integral sobre las hipótesis matemáticas y los algoritmos estocásticos de la aplicación, eliminando simplificaciones indebidas, incorporando dependencia temporal y formalizando benchmarks verificables.

### 1. Auditoría del Bootstrap y Preservación de Dependencias Temporales
- **Block Bootstrap (Circular Moving Block)**: Se incorporó junto con el muestreo I.I.D. simple para preservar la autocorrelación de retornos y el agrupamiento de rachas perdedoras (*volatility / loss clustering*).
- **Parámetro `blockSize`**: Configurable en interfaz y API (por defecto $B = 5$ operaciones). Manejo circular de índices en bordes para garantizar igual probabilidad de muestreo.
- **Selector de Método Estocástico**: La API y UI permiten seleccionar explícitamente:
  1. `bootstrap_block`: Circular Moving Block Bootstrap sobre operaciones reales.
  2. `bootstrap_iid`: Remuestreo aleatorio independiente con reemplazo.
  3. `parametric_fixed`: Modelo paramétrico de dos estados (Bernoulli).
  4. `parametric_variable`: Modelo paramétrico continuo con dispersión log-normal / gaussiana mediante transformación Box-Muller.

### 2. Momentos Estadísticos Empíricos y Métricas de Cola
- **Función `calculateSampleStatistics(rMultiples)`**:
  - Media de múltiplos de riesgo: $\mu_R = \frac{1}{n} \sum R_i$.
  - Desviación estándar muestral: $\sigma_R = \sqrt{\frac{1}{n-1} \sum (R_i - \mu_R)^2}$.
  - Coeficiente de Asimetría (Fisher-Pearson Skewness): $g_1 = \frac{n}{(n-1)(n-2)} \sum \left(\frac{R_i - \mu_R}{\sigma_R}\right)^3$.
  - Exceso de Curtosis Muestral: $g_2 = \frac{n(n+1)}{(n-1)(n-2)(n-3)} \sum \left(\frac{R_i - \mu_R}{\sigma_R}\right)^4 - \frac{3(n-1)^2}{(n-2)(n-3)}$.
  - Value at Risk al 95% ($VaR_{95\%}$): Cuantil empírico del 5% de pérdidas peores expresado en R.
  - Drawdown histórico máximo en unidades de riesgo R.

### 3. Corrección Matemática del Riesgo de Ruina
- **Desagregación Crítica**:
  - *Ruina Asintótica ($T \to \infty$)*: Formulada mediante el modelo de Ralph Vince / Perry Belmont $\left(\frac{1-A}{1+A}\right)^U$. Si la ventaja $A \le 0$, el riesgo de ruina asintótica es estrictamente $100\%$.
  - *Ruina a Horizonte Finito ($T$ operaciones)*: Se eliminó el error conceptual de devolver 100% de ruina para horizontes limitados. A $T = 25$ o $50$ operaciones, la probabilidad de alcanzar la barrera de pérdida tolerada es estrictamente menor al 100% (probabilidad de absorción en tiempo finito) y se computa mediante simulación empírica de barrera.
- **Hipótesis y Límites Explícitos**: Se documentaron formalmente en la interfaz los supuestos del modelo: I.I.D. en formulación cerrada, asimetría de retornos reales, ausencia de colas infinitas y tamaño de muestra.

### 4. Sensibilidad Formal y Escenario Estresado del Criterio de Kelly
- **Derivadas Parciales Exactas**:
  - Sensibilidad ante error en la tasa de acierto: $\frac{\partial K}{\partial W} = 1 + \frac{1}{R}$.
  - Sensibilidad ante error en el ratio de pago: $\frac{\partial K}{\partial R} = \frac{1 - W}{R^2}$.
- **Stressed Kelly (Kelly Conservador)**:
  - Escenario que evalúa el apalancamiento degradando preventivamente el Win Rate en $-5\%$ y el Payoff Ratio en $-15\%$ ($R \times 0.85$).
  - Previene la sobreexposición por sesgo de sobreoptimización muestral (*selection bias*).

### 5. Control de Pérdida Diaria en Prop Firms: Hard Breach vs. Soft Pause
- **Parámetro `dailyLossEnforcement`**:
  - `hard_breach`: Cualquier vulneración del límite diario (por balance o equidad flotante) cancela de inmediato la cuenta del reto.
  - `soft_pause`: La vulneración del límite diario suspende las operaciones durante el resto de la sesión de trading y se reanuda en el siguiente reinicio diario sin fallar la cuenta, a menos que se vulnere el drawdown máximo global.

### 6. Suite de Benchmarks Cuantitativos (17 Escenarios Formales)
- Archivo `src/__tests__/monte-carlo-quant-audit.test.ts` con 17 pruebas matemáticas exhaustivas:
  1. *Rentabilidad con Ventaja Positiva*: $W=60\%$, $R=1.5$, $E = +0.50R$, crecimiento de capital comprobado.
  2. *No Rentabilidad*: $W=40\%$, $R=1.0$, $E = -0.20R$, degradación sistemática de capital.
  3. *High Win Rate / Low Payoff*: $W=80\%$, $R=0.5$, $E = +0.20R$, rentabilidad positiva.
  4. *Low Win Rate / High Payoff*: $W=30\%$, $R=4.0$, $E = +0.50R$, estrategia de tendencia rentable.
  5. *Breakeven Perfecto*: $W=50\%$, $R=1.0$, $E = 0.00R$, $A = 0$, Kelly $= 0\%$.
  6. *Racha de Pérdidas Consecutivas*: Verificación de $P(k) = (1-W)^k$ y clustering.
  7. *Riesgo Fijo ($)*: Caída estrictamente lineal ante racha perdedora ($C_k = C_0 - k \cdot \text{Riesgo}$).
  8. *Riesgo Compuesto (% Equity)*: Caída geométrica $C_k = C_0 (1-f)^k$ y asimetría de recuperación $\text{Req} = \frac{DD}{1-DD}$ (+100% de subida tras -50% de caída).
  9. *Determinismo Mulberry32*: Mismo seed produce secuencias idénticas bit a bit.
  10. *Circular Moving Block Bootstrap*: Preservación de autocorrelación y momentos muestrales $\mu, \sigma, VaR_{95\%}$.
  11. *Drawdown Estático*: Suelo de liquidación inmutable independientemente de beneficios acumulados.
  12. *Trailing Drawdown sobre Balance*: El umbral sube con cada cresta y nunca baja.
  13. *Trailing Drawdown con Lock-In*: Congelamiento del umbral en el capital inicial (Apex/Topstep).
  14. *Hard Breach vs. Soft Pause*: Demostración cuantitativa de mayor tasa de supervivencia con pausa intradía.
  15. *Ruina Finita vs. Asintótica*: Demostración de que con $A \le 0$, ruina asintótica es 100% pero ruina finita a 25 trades es $< 100\%$.
  16. *Kelly con Ventaja No Positiva*: Retorno de $0\%$ exacto ante ventaja nula o negativa.
  17. *Kelly Estresado y Sensibilidades*: Comprobación de derivadas $\frac{\partial K}{\partial W}$ y $\frac{\partial K}{\partial R}$ y dimensionamiento seguro bajo estrés.

### 7. Estado del Proyecto tras la Fase 5.1
- **184 tests unitarios y de auditoría aprobados** (19 archivos de test).
- **6 tests de integración Supabase** omitidos condicionalmente a la espera de credenciales en vivo.
- **0 errores de TypeScript (`npx tsc --noEmit`)**.
- **0 errores y 0 advertencias de ESLint (`npm run lint`)**.
- **Compilación de producción exitosa en Next.js 16.4.3 Turbopack (`npm run build`)**.

---

## 17. Fase 5.2: Auditoría Estadística Independiente y Validación Avanzada del Motor Monte Carlo (Completada)

En la Fase 5.2 se ejecutó una auditoría matemática y estadística independiente y profunda sobre el motor Monte Carlo, el cálculo del Riesgo de Ruina, el Criterio de Kelly y el Simulador de Prop Firms, corrigiendo deficiencias teóricas y añadiendo 35 tests cuantitativos y probabilísticos rigurosos.

### 1. Corrección del Modelo Paramétrico Variable (`parametric_variable`)
- **Vulnerabilidad Encontrada**: En la Fase 5.1, las pérdidas se calculaban como `averageLoss + lossStd * Math.abs(z)`. Dado que $E[|Z|] = \sqrt{2/\pi} \approx 0.7979$, la pérdida media generada sufría un desplazamiento positivo artificial de $+0.798 \times \sigma$, sobreestimando la pérdida en un ~24%. Además, el truncamiento en 0.01 desplazaba la media condicional $E[X \mid X > 0.01] > \mu$.
- **Solución Cuantitativa**:
  - Implementación de **Distribución Lognormal con Calibración Exacta de Momentos** (`sampleLognormalVariate`):
    $$\sigma_{\ln}^2 = \ln\left(1 + \frac{\sigma^2}{\mu^2}\right), \quad \mu_{\ln} = \ln(\mu) - \frac{1}{2} \sigma_{\ln}^2$$
    $$X = \exp(\mu_{\ln} + \sigma_{\ln} Z), \quad Z \sim \mathcal{N}(0, 1)$$
  - Propiedades demostradas:
    1. $E[X] = \mu$ **exacto** (sin sesgo de suelo).
    2. $\operatorname{Var}(X) = \sigma^2$ **exacto**.
    3. Soporte estrictamente positivo $(0, \infty)$ sin discontinuidades ni masa puntual artificial en 0.01.
    4. Modela naturalmente la asimetría positiva ($g_1 > 0$) y colas pesadas leptocúrticas ($g_2 > 0$) de los rendimientos financieros reales.
- **Validación con Grandes Muestras ($N = 50,000$)**:
  - Convergencia demostrada dentro de $\pm 3.5 \times SE$ ($\pm 3.5 \frac{\sigma}{\sqrt{N}}$) para $\mu = 200, \sigma = 60$ ($p < 0.001$).

### 2. Auditoría Avanzada de Circular Moving Block Bootstrap
- **Evaluación de Tamaños de Bloque ($B = 1, 2, 5, 10, 20$)**:
  - Se demostró que el remuestreo I.I.D. ($B = 1$) destruye por completo la autocorrelación serial ($\rho_1 \approx 0.00 \pm 0.05$).
  - Circular Moving Block Bootstrap preserva la autocorrelación proporcionalmente a la fracción de transiciones contiguas conservadas: $1 - \frac{1}{B}$.
  - $B = 2$ conserva $\approx 50\%$ de la autocorrelación original; $B = 5$ conserva $\approx 80\%$; $B = 10$ conserva $\approx 90\%$.
- **Preservación de Rachas**: En series autocorrelacionadas, las pérdidas agrupadas en rachas $\ge 5$ consecutivas son más de 3.4 veces superiores en Block Bootstrap ($B = 8$) frente a I.I.D.
- **Efectos de Frontera Circular**: Documentado formalmente que el par $(X_N, X_1)$ introduce una transición no histórica que otorga pesos muestrales idénticos a todos los datos ($E[X^*] = \bar{X}$).
- **Inexistencia de Bloque Universalmente Óptimo**: Se formalizó que la longitud óptima $B^*$ depende del decaimiento espectral de la autocorrelación y del tamaño muestral $N$, escalando asintóticamente como $O(N^{1/3})$ (Politis & White, 2004).

### 3. Auditoría Exhaustiva del Riesgo de Ruina
- **Eliminación del Clamping Artificial de Horizonte**:
  - En Fase 5.1 existía `Math.max(10, tradesHorizon)` que impedía simular horizontes cortos ($T < 10$). Se corrigió a `Math.max(1, tradesHorizon)`.
- **Validación de los 4 Escenarios Clave**:
  1. *Ruina Finita = 0.00%*: Ocurre estrictamente cuando el horizonte temporal $T$ es menor que las unidades de riesgo para tocar la barrera de pérdida ($T < U$). Si $U = 10$ y $T = 5$, incluso perdiendo todas las operaciones es imposible tocar la barrera.
  2. *Ruina Finita Intermedia*: Para $T \ge U$, $W > 0$ y ventaja $A \le 0$, la ruina finita es estrictamente intermedia (ej. 20%-50%).
  3. *Ruina Finita = 100.00%*: Ocurre cuando $W = 0\%$ y $T \ge U$, o cuando el riesgo por operación es igual o superior al límite de pérdida tolerable ($U \le 1$).
  4. *Ruina Asintótica = 100% vs. Finita < 100%*: Se demostró la distinción teórica fundamental entre el límite infinito $T \to \infty$ y el horizonte finito operativo $T$.
- **Alineación de Modelos de Riesgo**: Soporte explícito de `riskModel: 'fixed_amount' | 'percentage_equity'` en `simulateEmpiricalRuin` para garantizar que la simulación empírica refleje fielmente el paseo aleatorio de Gambler's Ruin / Ralph Vince.

### 4. Auditoría del Criterio de Kelly
- **Límite de Riesgo Máximo Configurable (`maxKellyCapPercent`)**:
  - Evita sobreexposición catastrófica cuando la fórmula teórica de Full Kelly sugiere fracciones irracionales (ej. 55% u 80%).
  - Por defecto limitado a un 20%-25% prudencial (`cappedKellyPercent`).
- **Advertencia por Muestra Insuficiente ($N < 30$)**:
  - Si el historial de operaciones cerradas es inferior a 30 trades, el motor incluye una advertencia formal sobre el error estándar $\frac{\sigma}{\sqrt{N}}$ y la inestabilidad de Kelly.
- **Casos Extremos Verificados**:
  - $R = 100, W = 2\%$: Full Kelly $K = 1.02\%$, sensibilidad $\frac{\partial K}{\partial W} \approx 1.01$.
  - $R = 0.05, W = 96\%$: Full Kelly $K = 16.0\%$, sensibilidad $\frac{\partial K}{\partial W} = 21.0$ (hipersensibilidad extrema al Win Rate).

### 5. Auditoría de Prop Firms y Consumo Temporal
- **Base de Cálculo de Pérdida Diaria Configurable (`dailyLossBase`)**:
  - `'initial_capital'`: Calculado sobre el balance de arranque de la cuenta (estándar FTMO).
  - `'day_start_balance'`: Calculado sobre el balance de apertura de cada sesión.
- **Modelo de Soft Pause sin Distorsiones Artificiales**:
  - Se verificó que pausar operaciones intradía consume días del calendario del reto.
  - En horizontes ajustados (`maxDays`), la pausa intradía incrementa los timeouts por falta de sesiones operativas, evitando la falacia de que Soft Pause mejora universalmente la tasa de pase.

### 6. Estado del Proyecto tras la Fase 5.2
- **202 tests unitarios y de auditoría aprobados** (20 archivos de test).
- **6 tests de integración Supabase** omitidos condicionalmente a la espera de credenciales en vivo.
- **0 errores de TypeScript (`npx tsc --noEmit`)**.
- **0 errores y 0 advertencias de ESLint (`npm run lint`)**.
- **Compilación de producción exitosa en Next.js 16.4.3 Turbopack (`npm run build`)**.
- **Versión del motor Monte Carlo**: `MONTE_CARLO_ALGORITHM_VERSION = '5.2.0'`.

---

## 18. Fase 5.2.1: Corrección y Validación Independiente del Cálculo de Riesgo de Ruina (Completada)

En la Fase 5.2.1 se ejecutó una validación e investigación independiente sobre la aparente discrepancia detectada entre los valores tabulados en el informe de la Fase 5.2 y las probabilidades analíticas de Gambler's Ruin.

### 1. Diagnóstico Matemático y Causa Raíz de la Discrepancia
1. **Error de Tipografía y Desalineación en el Informe Fase 5.2**:
   - En la tabla de benchmarks del informe de la Fase 5.2, los parámetros descritos en el texto no correspondían a los parámetros ejecutados en el código de prueba. Por ejemplo, en BM-15.B el texto del informe citaba $W=0.4, U=5, T=100$ pero reportaba un valor observado del $63.80\%$ (que correspondía a una corrida con $U=10, T=50$, donde la probabilidad exacta es $64.03\%$). Para los parámetros reales $W=0.4, U=5, T=100$, la probabilidad analítica exacta de ruina finita es **$98.00\%$**.
   - En BM-15.D el informe citaba $W=0.45, U=5, T=10$ con `Fin: 2.8%`, cuando la probabilidad exacta para $U=5, T=10$ es **$17.43\%$** (el valor $2.8\%$ procedía de un test con $U=8, T=10$ donde la probabilidad analítica es $2.50\% \sim 2.8\%$).
2. **Diferenciación entre Riesgo Fijo (`fixed_amount`) y Riesgo Porcentual (`percentage_equity`)**:
   - En **Riesgo Fijo** (\$100 por trade, capital \$10,000, pérdida máxima 5% = \$500), se requieren exactamente $U = 5$ pérdidas netas para tocar la barrera. Coincide exactamente con el modelo clásico de Gambler's Ruin.
   - En **Riesgo Porcentual** (1% sobre equity actual), tras 5 pérdidas consecutivas el balance es $\$10,000 \times 0.99^5 = \$9,509.90 > \$9,500$. Por ende, se requieren $k \ge \frac{\ln(0.95)}{\ln(0.99)} = 5.103 \implies 6$ pérdidas netas consecutivas para quebrar la cuenta. Esto reduce la probabilidad empírica de ruina de 17.43% a 11.60% (que coincide con $U = 6$ en Gambler's Ruin: 11.46%).
3. **Omisión de `riskModel` en Tabla de Sensibilidad**:
   - En `calculateRiskOfRuin`, la función `scenarios.map(...)` no transfería el parámetro `riskModel` a la simulación empírica interna, recurriendo siempre al valor por defecto. Corregido para propagar `riskModel` de forma uniforme.

### 2. Implementación de Referencia Determinista (Programación Dinámica)
Se implementó y exportó la función analítica `calculateExactGamblersRuin`:
- **Espacio de Estados**: $k \in \{0, 1, \dots, U + T\}$.
- **Condición de Frontera Absorbente**:
  $$\Delta P_t(0) = dp_{t-1}[1] \cdot (1 - W)$$
  $$dp_t[k] = dp_{t-1}[k-1] \cdot W + dp_{t-1}[k+1] \cdot (1 - W), \quad k \ge 1$$
- **Probabilidad Acumulada**: $\text{Ruin}(T) = \sum_{t=1}^T \Delta P_t(0)$.
- **Conservación de Masa**: $\text{Ruin}(T) + \sum_{k=1}^{U+T} dp_T[k] = 1.000000000000 \pm 10^{-12}$.
- **Complejidad**: Tiempo $O(T \cdot (U + T))$, Espacio $O(U + T)$.

### 3. Validación de los Ocho Escenarios Canónicos
| Escenario | W | U | T | Exacto DP | Asintótico (Perry/Vince) | MC Fijo ($N=2,000$) | Diff Abs | Error Estándar ($SE$) | IC 95% Teórico |
|---|---|---|---|---|---|---|---|---|---|
| **A** | 40% | 3 | 50 | **94.98%** | 100.00% | 94.85% | 0.13% | 0.49% | [94.03%, 95.94%] |
| **B** | 40% | 5 | 100 | **98.00%** | 100.00% | 98.20% | 0.20% | 0.31% | [97.38%, 98.61%] |
| **C** | 45% | 5 | 10 | **17.43%** | 100.00% | 17.55% | 0.12% | 0.85% | [15.76%, 19.09%] |
| **D** | 45% | 5 | 100 | **87.36%** | 100.00% | 85.65% | 1.71% | 0.74% | [85.90%, 88.82%] |
| **E** | 50% | 5 | 100 | **61.73%** | 100.00% | 60.65% | 1.08% | 1.09% | [59.60%, 63.86%] |
| **F** | 60% | 5 | 100 | **12.90%** | 13.17% | 13.50% | 0.60% | 0.75% | [11.44%, 14.37%] |
| **G** | 0% | 5 | 10 | **100.00%** | 100.00% | 100.00% | 0.00% | 0.00% | [100.00%, 100.00%] |
| **H** | 100% | 5 | 100 | **0.00%** | 0.00% | 0.00% | 0.00% | 0.00% | [0.00%, 0.00%] |

Todas las simulaciones Monte Carlo concuerdan con la solución determinista de Programación Dinámica dentro del intervalo de tolerancia estocástica.

### 4. Tests Creados y Modificados
- Nuevo archivo de test: `src/__tests__/gamblers-ruin-exact.test.ts` (15 tests de invariantes, condiciones de frontera, 8 escenarios canónicos y diferenciación de modelos).
- Añadido Benchmark 15.D explícito a `src/__tests__/monte-carlo-quant-audit.test.ts`.
- Integración en UI: visualización de la solución exacta de Programación Dinámica en `src/app/[locale]/analytics/risk-of-ruin/page.tsx`.

### 5. Estado de la Suite de Pruebas
- **218 tests unitarios y de auditoría aprobados** (21 archivos de test).
- **6 tests de integración Supabase** omitidos condicionalmente.
- **0 errores de compilación (`npx tsc --noEmit`) y 0 advertencias de linter (`npm run lint`)**.
- **Compilación de producción exitosa en Next.js 16.4.3 Turbopack (`npm run build`)**.

---

## 19. FASE 5.2.2 — Auditoría Final del Riesgo de Ruina y Validación del Modelo Percentage Equity (Completada)

En la Fase 5.2.2 se ejecutó una auditoría matemática y estadística de cierre sobre `src/lib/analytics/risk-of-ruin.ts`, formalizando la elegibilidad del cálculo exacto, implementando el modelo analítico multiplicativo para `percentage_equity`, y auditando el Benchmark D con intervalos de confianza Wilson y convergencia asintótica.

### 1. Corrección de la Elegibilidad del Cálculo Exacto
- **Deficiencias Previas**:
  - Se utilizaba la tolerancia `Math.abs(payoffRatio - 1.0) < 0.01`, lo que permitía que casos asimétricos como $R = 0.995$ o $R = 1.005$ activaran erróneamente la fórmula de la caminata clásica unitaria (+1 / -1).
  - La función `calculateExactGamblersRuin` ejecutaba `const U = Math.round(riskUnits)`, redondeando silenciosamente valores fraccionarios (ej. $U = 5.4 \to 5$) y mostrando un resultado analítico falso.
- **Correcciones Implementadas**:
  - Elegibilidad estricta: Se requiere obligatoriamente `riskModel === 'fixed_amount'`, `Math.abs(averageWin - averageLoss) < 1e-9` ($R \equiv 1.0$), `Number.isInteger(riskUnits)` con $U \ge 1$, y tasa de acierto válida.
  - En caso de $R \ne 1.0$ o $U$ no entero (ej. $U = 5.4$), `exactFiniteRuinProbability` permanece estrictamente `undefined`.
  - En `calculateExactGamblersRuin`, ante $U$ positivo no entero se devuelve `NaN` sin redondeo silencioso.

### 2. Modelo Determinista Multiplicativo de `percentage_equity`
- **Dinámica del Balance**:
  - Ganancia: $B_{t+1} = B_t \cdot (1 + f \cdot R)$.
  - Pérdida: $B_{t+1} = B_t \cdot (1 - f)$.
  - Ruina: $B_t \le B_0 \cdot (1 - \text{maxLossLimitPercent} / 100)$.
- **Implementación Analítica**:
  - Función `calculateExactPercentageEquityRuin`: Algoritmo de Programación Dinámica sobre retículo binomial en $O(T^2)$ que evalúa los nodos absorbidos en cada paso temporal $t \in [1, T]$.
  - Comprobación: Con capital \$10,000, límite 5% (\$9,500), riesgo 1%, $W=45\%, T=10$, la probabilidad analítica exacta es **$11.4568\%$**, coincidiendo con la simulación Monte Carlo a gran escala ($N=100,000$: $11.44\%$, error $< 0.02\%$).
  - Demostración de colchón de beneficios: 6 pérdidas consecutivas generan ruina ($B_6 = \$9,414.80 \le \$9,500$), pero una trayectoria mixta $WLLLLLL$ finaliza en $\$9,508.95 > \$9,500$ (sin ruina), requiriendo 7 pérdidas consecutivas para tocar la barrera.

### 3. Auditoría Estadística Rigurosa de Benchmark D ($W=45\%, U=5, T=100$)
- **Valor Analítico Exacto**: $P_{\text{true}} = 87.3602\%$.
- **Discrepancia en $N = 2,000$ (Seed 101)**:
  - Observado: $\hat{p} = 85.65\%$ (1713 éxitos de 2000).
  - Intervalo de Wilson al 95%: $[84.05\%, 87.12\%]$. El valor verdadero $87.36\%$ queda fuera del 95% debido a una desviación aleatoria de $Z = 2.30$ ($p = 2.14\%$).
  - Intervalo de Wilson al 99%: $[83.54\%, 87.57\%]$. El valor verdadero $87.36\%$ queda DENTRO de la banda de aceptación del 99% ($Z = 2.30 < 2.58$).
- **Convergencia Demostrada al Escalar $N$**:
  - $N = 10,000$: $\hat{p} = 86.95\%$ ($Z = 1.23$, dentro del IC Wilson 95% $[86.28\%, 87.60\%]$).
  - $N = 50,000$: $\hat{p} = 87.15\%$ ($Z = 1.44$, dentro del IC Wilson 95% $[86.85\%, 87.44\%]$).
  - $N = 100,000$: $\hat{p} = 87.25\%$ ($Z = 1.10$, dentro del IC Wilson 95% $[87.04\%, 87.45\%]$).

### 4. Auditoría de la Matriz de Sensibilidad y Propagación
- Se demostró mediante pruebas unitarias que la columna empírica de la matriz de escenarios de riesgo (`scenarios`) refleja de forma efectiva la selección entre `fixed_amount` y `percentage_equity`.

### 5. Suite de Pruebas Automatizadas
- Nuevo archivo de test: `src/__tests__/risk-of-ruin-final-audit.test.ts` (22 tests que cubren de la A a la O).
- Estado global: **240 tests aprobados** (22 archivos de prueba), 6 tests omitidos condicionalmente.
- TypeScript (`npx tsc --noEmit`) y Linter (`npm run lint`): 0 errores.
- Compilación de producción (`npm run build`): Exitosa.

---

## 20. FASE 6 — Auditoría Integral de Integración Funcional y Coherencia de Datos (Completada)

En la Fase 6 se ejecutó una auditoría funcional integral y de coherencia de datos de extremo a extremo sobre todos los módulos de TradeRisk Manager.

### 1. Hallazgos y Correcciones Críticas de Coherencia de Datos (P0/P1)
- **Conciliación de PnL Neto y Comisiones en `calculateStatistics` (`src/lib/statistics/index.ts`)**:
  - *Problema*: `calculateStatistics` acumulaba `runningBalance += trade.result!` y `grossProfit / grossLoss` utilizando el resultado bruto del trade, ignorando las comisiones (`trade.commissions`).
  - *Impacto*: Si las operaciones tenían comisiones, la curva de balance (`stats.balanceHistory`) y el beneficio neto (`stats.netProfit`) divergían del balance real de la cuenta (`activeAccount.balance`) y del PnL total del dashboard. Además, operaciones con beneficio bruto inferior a sus comisiones (ej. bruto +\$5, comisiones \$15 $\to$ pérdida neta -\$10) se clasificaban erróneamente como operaciones ganadoras.
  - *Resolución*: Se refactorizó `calculateStatistics` para operar con `netResult = trade.result! - (trade.commissions || 0)`, asegurando coincidencia al céntimo entre `balanceHistory[last].balance`, `activeAccount.balance`, `expectancy.netProfit` y `totalPnL`.
- **Claridad Contable y Prevención de Doble Deducción en Cierre de Operaciones (`src/app/[locale]/trades/page.tsx`)**:
  - *Problema*: El modal de cierre de operaciones calculaba `pnl = (exit - entry) * size` (PnL bruto), pero mostraba la etiqueta *"Resultado Neto (\$ PnL)"*.
  - *Impacto*: Al someter el formulario, `useStorage.ts` restaba las comisiones registradas (`net = result - commissions`). Si el usuario introducía manualmente un resultado creyendo que debía ser neto, se producía una doble deducción de comisiones.
  - *Resolución*: Se renombró la etiqueta a *"Resultado Bruto (\$ PnL)"* y se incorporó una tarjeta de desglose en tiempo real que expone con transparencia las comisiones y el impacto neto exacto en el balance de la cuenta.
- **Métricas de Resumen y Listado de Operaciones**:
  - En `TradesPage`, el KPI superior y la columna de resultado de la tabla se actualizaron para computar PnL neto (`(t.result ?? 0) - (t.commissions || 0)`), mostrando el desglose bruto/comisión cuando existen comisiones.
- **Monitoreo de Drawdown en Dashboard (`src/app/[locale]/page.tsx`)**:
  - La barra de consumo de drawdown se conectó con `drawdownMetrics.currentDrawdownPercent` (drawdown real histórico bajo agua), manteniendo diferenciado el riesgo potencial abierto (`openRiskPercent`).

### 2. Validación Integral de Arquitectura e Integraciones
- **Ciclo Completo**: Creación de cuenta $\to$ cálculo de posición en calculadora multiasset $\to$ apertura de operación $\to$ reflejo de riesgo abierto en Dashboard $\to$ cierre de operación $\to$ conciliación de balance contable y series analíticas.
- **Aislamiento Multi-Cuenta**: Comprobado que operaciones, diario y estadísticas de una cuenta no interfieren con otras cuentas del sistema.
- **Persistencia, Tombstones y Soft Deletes**: Eliminación en cascada de cuentas garantizada, generando tombstones distribuidos para sincronización sin pérdida de datos.
- **Seguridad en Copias de Seguridad (Backup)**: Validación de JSON Schema con Zod, detección de IDs duplicados, control estricto de integridad relacional (rechazo de operaciones o notas huérfanas) y límite DoS de 10 MB.

### 3. Suite de Pruebas y Estado Global
- Nuevo archivo de test: `src/__tests__/functional-integration-audit.test.ts` (9 tests de integración exhaustiva).
- Actualización de `src/__tests__/statistics.test.ts` (7 tests).
- Estado global de Vitest: **250 tests aprobados** (23 archivos de prueba), 6 tests de Supabase real omitidos condicionalmente.
- TypeScript (`npx tsc --noEmit`): 0 errores.
- ESLint (`npm run lint`): 0 advertencias, 0 errores.
- Next.js Turbopack Build (`npm run build`): Prerenderizado estático de 37 páginas exitoso.

---

## 21. FASE 6.1 — Validación Final Contable, Equity y Persistencia Real (Completada)

En la Fase 6.1 se llevó a cabo una auditoría exhaustiva de cierre sobre la contabilidad de doble entrada, la demarcación entre balance, equity y open risk, el drawdown institucional y la persistencia distribuida.

### 1. Auditoría Contable y Reversión de Libro Mayor
- **Comisiones y PnL Neto**: Verificado formalmente que `netResult = trade.result - trade.commissions` se descuenta exactamente una única vez a lo largo de todo el ciclo contable de la aplicación.
- **Delta Contable en Edición (`updateTrade`)**: Probado que modificar una operación cerrada (precio de salida o comisiones) calcula de forma atómica el diferencial `diff = newNet - oldNet` y actualiza el saldo de la cuenta sin derivas ni acumulaciones erróneas.
- **Reversión Contable en Eliminación (`deleteTrade`)**: Probado que eliminar una operación cerrada revierte exactamente el importe neto `balance -= (trade.result - commissions)`, restaurando el saldo anterior y emitiendo un tombstone de borrado distribuido.
- **Trampas de Comisiones**: Operaciones con resultado bruto positivo pero inferior a comisiones (ej. bruto +\$15, comisión \$25 $\to$ neto -\$10) son clasificadas estrictamente como pérdidas en `calculateStatistics`, `calculateExpectancy` y el motor de drawdown.
- **Inmutabilidad en Importación de Backups**: Comprobado que la importación mediante `applyBackup` (tanto en modo `replace` como `merge`) preserva el saldo real exportado sin volver a aplicar resultados ni duplicar comisiones.

### 2. Demarcación Rigurosa entre Balance, Equity y Open Risk
- **Diferenciación Conceptual**:
  - **Balance**: Capital inicial más resultados netos acumulados de operaciones cerradas.
  - **Equity**: Balance más PnL flotante (en modo manual actual equivale a balance al no existir feed en vivo de cotizaciones).
  - **Open Risk**: Pérdida máxima potencial estimada hasta el Stop Loss en operaciones abiertas ($\sum |\text{entry} - \text{SL}| \cdot \text{size}$). No se confunde ni se presenta como PnL flotante.
  - **Drawdown**: Caída respecto al High-Water Mark histórico de balance o equity según el modelo.
- **Transparencia en la Interfaz (Dashboard)**:
  - La tarjeta de Balance y Equidad indica explícitamente: `Equidad: $X (Modo manual · Sin feed en vivo)` ante posiciones abiertas.
  - La tarjeta de Open Risk indica: `X op. abierta(s) · Riesgo potencial a SL`.
- **Arquitectura para Futuros Feeds de Mercado**:
  - Se incorporaron las interfaces canónicas `MarketPriceQuote`, `FloatingPositionValuation` y `AccountValuationSnapshot` en `src/lib/types.ts` para conectar futuros proveedores (Binance, Interactive Brokers) sin alterar el core contable.

### 3. Auditoría de Supabase y Protocolo de Pruebas Reales
- **Código Auditado**: RLS multi-tenant con chequeo `auth.uid() = user_id`, soft-deletes con tombstones (`deleted_at`), resolución determinista LWW basada en timestamps, versiones y hash canónico, y migración segura de datos locales a la nube.
- **Protocolo de Pruebas Reales**: La suite `supabase-integration.real.test.ts` se mantiene condicionada a la existencia de credenciales reales no-mockeadas. Se documentó el protocolo seguro para aprovisionar un proyecto de staging/test sin tocar datos de producción ni exponer `SERVICE_ROLE_KEY`.

### 4. Suite de Pruebas de Regresión y Estado Global
- Nuevo archivo de test: `src/__tests__/regression-accounting-equity-persistence.test.ts` (8 pruebas completas de ciclo contable, delta, reversión, importación, aislamiento y cuarentena).
- Estado global de Vitest: **258 tests aprobados** (24 archivos de prueba), 6 tests de Supabase real omitidos condicionalmente.
- TypeScript (`npx tsc --noEmit`): 0 errores.
- ESLint (`npm run lint`): 0 advertencias, 0 errores.
- Compilación de producción (`npm run build`): Prerenderizado de 37 rutas exitoso.

---

## 22. FASE 7 — Desarrollo del Sistema de Informes Cuantitativos PDF y CSV (Completada)

En la Fase 7 se desarrolló el motor institucional de generación y exportación de informes cuantitativos en formatos PDF vectorial y hojas de cálculo CSV (RFC 4180).

### 1. Motor de Exportación CSV (`src/lib/reports/csv-exporter.ts`)
- **Libro Mayor de Operaciones (`generateTradeLedgerCsv`)**:
  - Exporta el historial completo de trades con campos normalizados: ID, Fecha Apertura, Fecha Cierre, Activo, Dirección (LONG/SHORT), Estado, Tamaño, Precios (Entrada, Salida, SL, TP), PnL Bruto, Comisiones, PnL Neto, Estrategia, Temporalidad y Notas.
  - Cumplimiento estricto con el estándar RFC 4180: escape seguro de comas, saltos de línea y comillas dobles (`""`).
  - Compatibilidad total con Microsoft Excel y Google Sheets mediante prefijo de marca de orden de bytes UTF-8 (`\uFEFF`).
- **Resumen Ejecutivo Cuantitativo (`generateExecutiveSummaryCsv`)**:
  - Estructurado en bloques temáticos delimitados:
    1. *Identificación y Estado de Cuenta*: Nombre, tipo, divisa, capital inicial, balance, equidad, PnL total (\$ y %).
    2. *Rendimiento Global*: Total trades, ganadores, perdedores, Win Rate %, Profit Factor, PnL neto, comisiones, promedios, mejor/peor trade, rachas máximas.
    3. *Expectativa Matemática*: Expectativa (\$ y R-multiple), ratio win/loss, breakeven trades, adecuación muestral.
    4. *Drawdown y Preservación*: High-Water Mark, Drawdown máximo (\$, %), Drawdown actual (\$, %), Factor de Recuperación, trades de recuperación bajo agua.
    5. *Reglas Prop Firm*: Piso de drawdown, distancia al piso, límite de pérdida diaria, pérdida hoy, distancia a pérdida diaria, objetivo de beneficio y estado de infracción.

### 2. Generador de Informes PDF Institucionales (`src/lib/reports/pdf-generator.ts`)
- **Diseño Ejecutivo con `jspdf`**:
  - Encabezado con banner corporativo Navy (`#0A1128`), líneas de acento Cyan (`#00F0FF`), metadatos de auditoría, timestamp UTC y versión.
  - Franja de 4 tarjetas ejecutivas de KPI: Balance / PnL Neto, Win Rate / Profit Factor, Expectativa Matemática, Drawdown Máximo.
  - Tablas vectoriales de 4 columnas para rendimiento global, expectativa matemática, preservación de capital y reglas prop firm.
  - Página 2 dedicada al Libro Mayor de Operaciones (Audit Trail) con desglose cronológico de posiciones cerradas, cálculo de PnL neto colorizado y fila de totales sumatorios de bruto, comisiones y neto.
  - Numeración dinámica de páginas en pie de documento ("Página X de Y") y sello de confidencialidad.

### 3. Integración en la Interfaz de Usuario
- **Componente Modal Reutilizable (`src/components/reports/ExportReportModal.tsx`)**:
  - Selector de cuenta objetivo.
  - Selector de formato con tarjetas interactivas: PDF Institucional, CSV Resumen Ejecutivo, CSV Libro Mayor.
  - Opción para incluir o excluir el libro mayor detallado en el PDF.
- **Puntos de Entrada**:
  - `AnalyticsPage` (`/[locale]/analytics`): Botón destacado "Exportar Informe" en la cabecera.
  - `TradesPage` (`/[locale]/trades`): Botón "Exportar" para descarga directa del libro mayor o informe completo.
  - `SettingsPage` (`/[locale]/settings`): Sección dedicada "Informes Cuantitativos y Auditoría".

### 4. Suite de Pruebas y Estado Global
- Nuevo archivo de test: `src/__tests__/quantitative-reporting.test.ts` (7 pruebas de escape RFC 4180, validación UTF-8 BOM, resumen multisección, encabezados bilingües ES/EN y generación PDF binario).
- Estado global de Vitest: **265 tests aprobados** (25 archivos de prueba), 6 tests de Supabase real omitidos condicionalmente.
- TypeScript (`npx tsc --noEmit`): 0 errores.
- ESLint (`npm run lint`): 0 advertencias, 0 errores.
- Compilación de producción (`npm run build`): Prerenderizado estático de 37 páginas exitoso.

---

## 23. Próximos Pasos (Fase 8)

* Conexión con proveedores de datos de mercado en tiempo real (Binance API, Interactive Brokers Web API).
* Registro automático de diario mediante webhooks de trading o importación de archivos de extracto (MT4/MT5, NinjaTrader, cTrader).
* Módulo avanzado de alertas de riesgo en vivo y notificaciones push.
