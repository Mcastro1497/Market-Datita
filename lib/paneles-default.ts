/**
 * Paneles armados de fábrica para la página de Equity.
 *
 * DE DÓNDE SALE ESTO
 * ECO manda ticker y código CFI, nada más: no hay panel, ni sector, ni país en
 * ninguna tabla. Así que la clasificación vive acá, escrita a mano, y hay que
 * mantenerla. No se guarda en la base porque no es un dato de mercado que cambie
 * con la rueda: es una etiqueta editorial.
 *
 * QUÉ REVISAR
 * El panel líder de BYMA se recompone cada trimestre. Los tickers que no estén
 * clasificados caen en "Otros" y se ven ahí: si aparecen muchos, es que entraron
 * CEDEARs nuevos y hay que sumarlos.
 */

/** Panel líder del Merval. Cambia cada trimestre; verificar contra BYMA. */
export const PANEL_LIDER = [
  "ALUA", "BBAR", "BMA", "BYMA", "CEPU", "COME", "CRES", "ECOG", "EDN", "GGAL",
  "LOMA", "METR", "PAMP", "SUPV", "TGNO4", "TGSU2", "TRAN", "TXAR", "VALO", "YPFD",
] as const

/**
 * CEDEARs por sector. Los ETF van aparte a propósito: un SPY o un XLE no tienen
 * sector, son un vehículo. Meterlos con las acciones ensucia cualquier lectura
 * sectorial.
 */
export const SECTORES_CEDEAR: Record<string, string[]> = {
  "ETF e índices": [
    "ACWI", "ARKK", "CIBR", "COPX", "DIA", "EEM", "EFA", "ESGU", "ETHA", "EWJ",
    "EWY", "EWZ", "FXI", "GDX", "GLD", "IBB", "IBIT", "ICLN", "IEMG", "IEUR",
    "IJH", "ILF", "ITA", "IVE", "IVV", "IVW", "IWM", "PSQ", "QQQ", "RSP",
    "SH", "SLV", "SMH", "SPHQ", "SPXL", "SPY", "TQQQ", "URA", "USO", "VEA",
    "VIG", "VXX", "XLB", "XLC", "XLE", "XLF", "XLI", "XLK", "XLP", "XLRE",
    "XLU", "XLV", "XLY", "XME",
  ],
  "Semiconductores": [
    "ADI", "ALAB", "AMAT", "AMD", "ARM", "ASML", "AVGO", "INTC", "KLAC", "LRCX",
    "MRVL", "MU", "NVDA", "QCOM", "SNDK", "SWKS", "TSM", "TXN", "WDC",
  ],
  "Tecnología": [
    "AAPL", "ACN", "ADBE", "ADP", "AI", "ANET", "BB", "BIDU", "CLS", "CRM",
    "CRWD", "CRWV", "CSCO", "DELL", "DOCU", "ERIC", "GLOB", "GLW", "GOOGL", "GRMN",
    "HPQ", "IBM", "INFY", "MSFT", "MSI", "NBIS", "NOKA", "NOW", "ONDS", "ORCL",
    "PANW", "PATH", "PLTR", "RGTI", "SAP", "SATL", "SHOP", "SNOW", "TEAM", "TWLO",
    "VRSN", "XROX", "ZM",
  ],
  "Bancos y finanzas": [
    "AEG", "AIG", "AXP", "BBAS3", "BBD", "BBDC3", "BBV", "BCS", "BNY", "BRKB",
    "BSBR", "BX", "C", "EFX", "FMCC", "FNMA", "GS", "HDB", "HSBC", "IBKR",
    "IBN", "ING", "ITUB", "ITUB3", "JPM", "KB", "LYG", "MA", "MFG", "MS",
    "MUFG", "NMR", "SAN", "SPGI", "USB", "V", "WFC",
  ],
  "Cripto y fintech": [
    "BMNR", "COIN", "FISV", "HOOD", "HUT", "IREN", "MSTR", "NU", "PAGS", "PYPL",
    "RIOT", "STNE", "UPST", "XP", "XYZ",
  ],
  "Energía": [
    "BKR", "BP", "CCJ", "COP", "CVX", "E", "EQNR", "FSLR", "GLNG", "GPRK",
    "HAL", "NXE", "OKLO", "OXY", "PBR", "PETR3", "PRIO3", "PSX", "SHEL", "SLB",
    "TTE", "UGP", "VIST", "XOM",
  ],
  "Materiales y minería": [
    "AEM", "AVY", "BAK", "BHP", "BIOX", "CDE", "CSNA3", "CX", "DD", "DOW",
    "ECL", "FCX", "GFI", "GGB", "HL", "HMY", "IFF", "IP", "KGC", "LAC",
    "LIN", "MOS", "MP", "MUX", "NEM", "NG", "NUE", "PAAS", "RIO", "SCCO",
    "SHW", "SID", "SUZ", "SUZB3", "VALE", "VALE3",
  ],
  "Salud": [
    "ABBV", "ABT", "AMGN", "AZN", "BAYN", "BIIB", "BMY", "CAH", "CVS", "DHR",
    "GILD", "GSK", "HAPV3", "HIMS", "ISRG", "JNJ", "LLY", "MDT", "MRK", "MRNA",
    "NTRA", "NVO", "NVS", "PFE", "PHG", "TEM", "TMO", "UNH", "VRTX",
  ],
  "Consumo": [
    "AAP", "ABEV", "ABEV3", "ABNB", "ADGO", "AKO.B", "AMZN", "ANF", "ARCO", "BABA",
    "BKNG", "CCL", "CL", "COST", "DECK", "DEO", "EBAY", "ETSY", "F", "FMX",
    "GM", "GT", "HD", "HMC", "HOG", "HSY", "JD", "JMIA", "KMB", "KO",
    "KOFM", "LND", "LREN3", "LVS", "MCD", "MDLZ", "MELI", "MGLU3", "MO", "NATU3",
    "NIO", "NKE", "ORLY", "PDD", "PEP", "PG", "PM", "RACE", "ROST", "SBUX",
    "SE", "STLA", "SYY", "TCOM", "TGT", "TJX", "TM", "TRIP", "TSLA", "UL",
    "URBN", "WMT", "XPEV",
  ],
  "Industria y transporte": [
    "AAL", "ASR", "BA", "CAAP", "CAR", "CAT", "DAL", "DE", "FDX", "GE", "GEV",
    "HON", "HWM", "LMT", "MMM", "PAC", "PBI", "PCAR", "RENT3", "RKLB", "RTX",
    "SIEGY", "SNA", "SPCE", "UAL", "UBER", "UNP", "WEGE3",
  ],
  "Comunicación y entretenimiento": [
    "AMX", "ASTS", "DISN", "EA", "JOYY", "META", "NFLX", "NTES", "PINS", "RBLX",
    "ROKU", "SNAP", "SONY", "SPOT", "T", "TIMB", "TIMS3", "TMUS", "TV", "VIV",
    "VIVT3", "VOD", "VZ", "YELP",
  ],
  "Servicios públicos e inmobiliario": [
    "CEG", "ELPC", "KEP", "NEE", "NGG", "O", "PLD", "SBS", "SBSP3", "TLN",
    "VST", "WELL",
  ],
}

/**
 * CEDEARs por región. Sólo se listan los que NO son de EEUU: el resto cae ahí
 * por descarte, que es la mayoría. "Brasil" incluye tanto el ADR (VALE, PBR)
 * como el ticker de B3 terminado en dígito (VALE3, PETR3), que conviven.
 */
export const REGIONES_CEDEAR: Record<string, string[]> = {
  "Brasil": [
    "ABEV", "ABEV3", "BAK", "BBAS3", "BBD", "BBDC3", "BPA11", "BSBR", "CSNA3", "ELPC",
    "GGB", "HAPV3", "ITUB", "ITUB3", "LND", "LREN3", "MGLU3", "NATU3", "NU", "PAGS",
    "PBR", "PETR3", "PRIO3", "RENT3", "SBS", "SBSP3", "SID", "STNE", "SUZ", "SUZB3",
    "TIMB", "TIMS3", "UGP", "VALE", "VALE3", "VIV", "VIVT3", "WEGE3", "XP",
  ],
  "Argentina": ["ADGO", "BIOX", "CAAP", "GLOB", "GPRK", "MELI", "SATL", "VIST"],
  "LatAm (resto)": ["AKO.B", "AMX", "ARCO", "ASR", "CX", "FMX", "KOFM", "PAC", "SCCO", "TV"],
  "Europa": [
    "ARM", "ASML", "AZN", "BAYN", "BBV", "BCS", "BP", "DEO", "E", "EQNR",
    "ERIC", "GSK", "HSBC", "ING", "LYG", "NBIS", "NGG", "NOKA", "NVO", "NVS",
    "PHG", "RACE", "SAN", "SAP", "SHEL", "SIEGY", "SPOT", "STLA", "TTE", "UL",
    "VOD",
  ],
  "Asia": [
    "BABA", "BIDU", "HDB", "HMC", "IBN", "INFY", "JD", "JOYY", "KB", "KEP",
    "MFG", "MUFG", "NIO", "NMR", "NTES", "PDD", "SE", "SONY", "TCOM", "TM",
    "TSM", "XPEV",
  ],
  "Global / otros": ["AEG", "BHP", "GFI", "HMY", "IREN", "JMIA", "LIN", "RIO", "TEAM"],
}

/** Tickers que quedaron sin clasificar. Se muestran en "Otros" para que se vean. */
export function sinClasificar(tickers: string[], mapa: Record<string, string[]>) {
  const conocidos = new Set(Object.values(mapa).flat())
  return tickers.filter((t) => !conocidos.has(t))
}
