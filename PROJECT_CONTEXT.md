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
* **Comandos de Verificación**:
  * `npm test`: 12 suites pasadas, 138/138 tests OK.
  * `npx tsc --noEmit`: 0 errores de compilación TypeScript.
  * `npm run lint`: 0 advertencias o errores.
  * `npm run build`: Compilación de producción validada (25 rutas compiladas y prerenderizadas con Next.js 16.4.3 Turbopack).

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

## 14. Próximos Pasos (Fase 5)

* Módulo de simulación Monte Carlo para proyección de curvas de capital, drawdown máximo esperado y probabilidad de ruina / insolvencia.
* Exportación de informes avanzados de rendimiento en PDF y CSV para auditoría contable y cumplimiento tributario.
* Integración con feeds de precios en tiempo real vía WebSocket (Binance, Yahoo Finance o Interactive Brokers API).
* Aplicación de reglas avanzadas de gestión de riesgo dinámico (Kelly Criterion, Fixed Ratio de Ryan Jones).
