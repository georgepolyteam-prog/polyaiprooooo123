import { useState, useEffect } from 'react';

// Restricted jurisdictions from Kalshi Member Agreement v1.6
// Country codes (ISO 3166-1 alpha-2)
const RESTRICTED_COUNTRY_CODES = [
  'US', // United States
  'AF', // Afghanistan
  'DZ', // Algeria
  'AO', // Angola
  'AU', // Australia
  'BY', // Belarus
  'BE', // Belgium
  'BO', // Bolivia
  'BG', // Bulgaria
  'BF', // Burkina Faso
  'CM', // Cameroon
  'CA', // Canada
  'CF', // Central African Republic
  'CI', // Ivory Coast
  'CU', // Cuba
  'CD', // Congo
  'ET', // Ethiopia
  'FR', // France
  'HT', // Haiti
  'IR', // Iran
  'IQ', // Iraq
  'IT', // Italy
  'KE', // Kenya
  'LA', // Laos
  'LB', // Lebanon
  'LY', // Libya
  'ML', // Mali
  'MC', // Monaco
  'MZ', // Mozambique
  'MM', // Myanmar
  'NA', // Namibia
  'NI', // Nicaragua
  'NE', // Niger
  'KP', // North Korea
  'CN', // China
  'PL', // Poland
  'RU', // Russia
  'SG', // Singapore
  'SO', // Somalia
  'SS', // South Sudan
  'SD', // Sudan
  'CH', // Switzerland
  'SY', // Syria
  'TW', // Taiwan
  'TH', // Thailand
  'UA', // Ukraine
  'AE', // UAE
  'GB', // United Kingdom
  'VE', // Venezuela
  'YE', // Yemen
  'ZW', // Zimbabwe
];

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  AF: 'Afghanistan',
  DZ: 'Algeria',
  AO: 'Angola',
  AU: 'Australia',
  BY: 'Belarus',
  BE: 'Belgium',
  BO: 'Bolivia',
  BG: 'Bulgaria',
  BF: 'Burkina Faso',
  CM: 'Cameroon',
  CA: 'Canada',
  CF: 'Central African Republic',
  CI: 'Ivory Coast',
  CU: 'Cuba',
  CD: 'Congo',
  ET: 'Ethiopia',
  FR: 'France',
  HT: 'Haiti',
  IR: 'Iran',
  IQ: 'Iraq',
  IT: 'Italy',
  KE: 'Kenya',
  LA: 'Laos',
  LB: 'Lebanon',
  LY: 'Libya',
  ML: 'Mali',
  MC: 'Monaco',
  MZ: 'Mozambique',
  MM: 'Myanmar',
  NA: 'Namibia',
  NI: 'Nicaragua',
  NE: 'Niger',
  KP: 'North Korea',
  CN: 'China',
  PL: 'Poland',
  RU: 'Russia',
  SG: 'Singapore',
  SO: 'Somalia',
  SS: 'South Sudan',
  SD: 'Sudan',
  CH: 'Switzerland',
  SY: 'Syria',
  TW: 'Taiwan',
  TH: 'Thailand',
  UA: 'Ukraine',
  AE: 'United Arab Emirates',
  GB: 'United Kingdom',
  VE: 'Venezuela',
  YE: 'Yemen',
  ZW: 'Zimbabwe',
};

interface GeoData {
  country_code: string;
  country_name: string;
}

interface GeoRestrictionResult {
  isRestricted: boolean;
  countryCode: string | null;
  countryName: string | null;
  loading: boolean;
  error: string | null;
}

const CACHE_KEY = 'kalshi_geo_restriction';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function useGeoRestriction(): GeoRestrictionResult {
  const [isRestricted, setIsRestricted] = useState(false);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [countryName, setCountryName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkGeo = async () => {
      try {
        // Check cache first
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL_MS) {
            setCountryCode(data.countryCode);
            setCountryName(data.countryName);
            setIsRestricted(data.isRestricted);
            setLoading(false);
            return;
          }
        }

        // Fetch geo data from ipapi.co (free tier: 1000 req/day)
        const response = await fetch('https://ipapi.co/json/', {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch geo data');
        }

        const data: GeoData = await response.json();
        const code = data.country_code?.toUpperCase();
        const name = data.country_name || COUNTRY_NAMES[code] || code;
        const restricted = RESTRICTED_COUNTRY_CODES.includes(code);

        setCountryCode(code);
        setCountryName(name);
        setIsRestricted(restricted);

        // Cache the result
        sessionStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            data: { countryCode: code, countryName: name, isRestricted: restricted },
            timestamp: Date.now(),
          })
        );

        console.log(`[Geo] Detected: ${name} (${code}) - Restricted: ${restricted}`);
      } catch (err) {
        console.error('[Geo] Failed to detect location:', err);
        setError('Failed to detect location');
        // Default to not restricted on error to avoid blocking legitimate users
        setIsRestricted(false);
      } finally {
        setLoading(false);
      }
    };

    checkGeo();
  }, []);

  return { isRestricted, countryCode, countryName, loading, error };
}
