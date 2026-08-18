import { COUNTRIES, type CountryOption } from '@/shared/lib/countries'

/** ITU-T E.164 country calling codes keyed by ISO 3166-1 alpha-2. */
const DIAL_BY_CODE: Record<string, string> = {
  AF: '93',
  AL: '355',
  DZ: '213',
  AD: '376',
  AO: '244',
  AG: '1',
  AR: '54',
  AM: '374',
  AU: '61',
  AT: '43',
  AZ: '994',
  BS: '1',
  BH: '973',
  BD: '880',
  BB: '1',
  BY: '375',
  BE: '32',
  BZ: '501',
  BJ: '229',
  BT: '975',
  BO: '591',
  BA: '387',
  BW: '267',
  BR: '55',
  BN: '673',
  BG: '359',
  BF: '226',
  BI: '257',
  CV: '238',
  KH: '855',
  CM: '237',
  CA: '1',
  CF: '236',
  TD: '235',
  CL: '56',
  CN: '86',
  CO: '57',
  KM: '269',
  CG: '242',
  CD: '243',
  CR: '506',
  CI: '225',
  HR: '385',
  CU: '53',
  CY: '357',
  CZ: '420',
  DK: '45',
  DJ: '253',
  DM: '1',
  DO: '1',
  EC: '593',
  EG: '20',
  SV: '503',
  GQ: '240',
  ER: '291',
  EE: '372',
  SZ: '268',
  ET: '251',
  FJ: '679',
  FI: '358',
  FR: '33',
  GA: '241',
  GM: '220',
  GE: '995',
  DE: '49',
  GH: '233',
  GR: '30',
  GD: '1',
  GT: '502',
  GN: '224',
  GW: '245',
  GY: '592',
  HT: '509',
  HN: '504',
  HU: '36',
  IS: '354',
  IN: '91',
  ID: '62',
  IR: '98',
  IQ: '964',
  IE: '353',
  IL: '972',
  IT: '39',
  JM: '1',
  JP: '81',
  JO: '962',
  KZ: '7',
  KE: '254',
  KI: '686',
  KP: '850',
  KR: '82',
  KW: '965',
  KG: '996',
  LA: '856',
  LV: '371',
  LB: '961',
  LS: '266',
  LR: '231',
  LY: '218',
  LI: '423',
  LT: '370',
  LU: '352',
  MG: '261',
  MW: '265',
  MY: '60',
  MV: '960',
  ML: '223',
  MT: '356',
  MH: '692',
  MR: '222',
  MU: '230',
  MX: '52',
  FM: '691',
  MD: '373',
  MC: '377',
  MN: '976',
  ME: '382',
  MA: '212',
  MZ: '258',
  MM: '95',
  NA: '264',
  NR: '674',
  NP: '977',
  NL: '31',
  NZ: '64',
  NI: '505',
  NE: '227',
  NG: '234',
  MK: '389',
  NO: '47',
  OM: '968',
  PK: '92',
  PW: '680',
  PS: '970',
  PA: '507',
  PG: '675',
  PY: '595',
  PE: '51',
  PH: '63',
  PL: '48',
  PT: '351',
  QA: '974',
  RO: '40',
  RU: '7',
  RW: '250',
  KN: '1',
  LC: '1',
  VC: '1',
  WS: '685',
  SM: '378',
  ST: '239',
  SA: '966',
  SN: '221',
  RS: '381',
  SC: '248',
  SL: '232',
  SG: '65',
  SK: '421',
  SI: '386',
  SB: '677',
  SO: '252',
  ZA: '27',
  SS: '211',
  ES: '34',
  LK: '94',
  SD: '249',
  SR: '597',
  SE: '46',
  CH: '41',
  SY: '963',
  TW: '886',
  TJ: '992',
  TZ: '255',
  TH: '66',
  TL: '670',
  TG: '228',
  TO: '676',
  TT: '1',
  TN: '216',
  TR: '90',
  TM: '993',
  TV: '688',
  UG: '256',
  UA: '380',
  AE: '971',
  GB: '44',
  US: '1',
  UY: '598',
  UZ: '998',
  VU: '678',
  VA: '39',
  VE: '58',
  VN: '84',
  YE: '967',
  ZM: '260',
  ZW: '263',
}

export type DialCountryOption = CountryOption & { dial: string }

export const DIAL_COUNTRIES: DialCountryOption[] = COUNTRIES.map((c) => ({
  ...c,
  dial: DIAL_BY_CODE[c.code] ?? '',
})).filter((c) => c.dial)

const byCode = new Map(DIAL_COUNTRIES.map((c) => [c.code, c]))

export function dialCodeForCountry(countryCode: string): string | null {
  return byCode.get(countryCode.trim().toUpperCase())?.dial ?? null
}

export function findDialCountry(countryCode: string): DialCountryOption | null {
  return byCode.get(countryCode.trim().toUpperCase()) ?? null
}

export function filterDialCountries(query: string, limit = 80): DialCountryOption[] {
  const q = query.trim().toLowerCase().replace(/^\+/, '')
  if (!q) return DIAL_COUNTRIES.slice(0, limit)
  const matched = DIAL_COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.dial.includes(q) ||
      `+${c.dial}`.includes(q),
  )
  matched.sort((a, b) => {
    const aName = a.name.toLowerCase()
    const bName = b.name.toLowerCase()
    const score = (c: DialCountryOption, name: string) => {
      if (c.code.toLowerCase() === q || c.dial === q || `+${c.dial}` === `+${q}`) return 0
      if (name.startsWith(q) || c.dial.startsWith(q)) return 1
      return 2
    }
    const diff = score(a, aName) - score(b, bName)
    if (diff !== 0) return diff
    return a.name.localeCompare(b.name)
  })
  return matched.slice(0, limit)
}

/** Digits only; strip a single leading trunk 0 commonly typed with local numbers. */
export function normalizeNationalNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length > 1 && digits.startsWith('0')) return digits.replace(/^0+/, '')
  return digits
}

/** Build E.164 (+countrycode + national digits). Empty if national part missing. */
export function composeE164(dial: string, nationalRaw: string): string {
  const dialDigits = dial.replace(/\D/g, '')
  const national = normalizeNationalNumber(nationalRaw)
  if (!dialDigits || !national) return ''
  return `+${dialDigits}${national}`
}

/** When several countries share a dial code, prefer these ISO codes. */
const DIAL_COUNTRY_PRIORITY = [
  'US',
  'CA',
  'GB',
  'AU',
  'ZA',
  'IN',
  'DE',
  'FR',
  'BR',
  'MX',
  'NG',
  'KE',
  'AE',
]

/**
 * Best-effort split of an E.164 value into ISO country + national digits.
 * Prefers `preferredCountry` when its dial matches, then longer dial codes,
 * then a short priority list for shared codes like +1.
 */
export function splitE164(
  value: string,
  preferredCountry?: string,
): { countryCode: string; dial: string; national: string } | null {
  const compact = value.trim().replace(/[\s()-]/g, '')
  if (!compact.startsWith('+')) return null
  const digits = compact.slice(1).replace(/\D/g, '')
  if (!digits) return null

  if (preferredCountry) {
    const pref = findDialCountry(preferredCountry)
    if (pref && digits.startsWith(pref.dial)) {
      return {
        countryCode: pref.code,
        dial: pref.dial,
        national: digits.slice(pref.dial.length),
      }
    }
  }

  let best: DialCountryOption | null = null
  for (const c of DIAL_COUNTRIES) {
    if (!digits.startsWith(c.dial)) continue
    if (!best) {
      best = c
      continue
    }
    if (c.dial.length > best.dial.length) {
      best = c
      continue
    }
    if (c.dial.length < best.dial.length) continue
    const cRank = DIAL_COUNTRY_PRIORITY.indexOf(c.code)
    const bRank = DIAL_COUNTRY_PRIORITY.indexOf(best.code)
    const cScore = cRank === -1 ? 999 : cRank
    const bScore = bRank === -1 ? 999 : bRank
    if (cScore < bScore) best = c
  }
  if (!best) return null
  return {
    countryCode: best.code,
    dial: best.dial,
    national: digits.slice(best.dial.length),
  }
}
