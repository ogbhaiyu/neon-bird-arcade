// Country list with ISO 3166-1 alpha-2 codes
// Flag images served from flagcdn.com (free, no API key needed)

export const COUNTRIES: { code: string; name: string }[] = [
  { code: "af", name: "Afghanistan" },
  { code: "al", name: "Albania" },
  { code: "dz", name: "Algeria" },
  { code: "ar", name: "Argentina" },
  { code: "au", name: "Australia" },
  { code: "at", name: "Austria" },
  { code: "bd", name: "Bangladesh" },
  { code: "be", name: "Belgium" },
  { code: "br", name: "Brazil" },
  { code: "ca", name: "Canada" },
  { code: "cl", name: "Chile" },
  { code: "cn", name: "China" },
  { code: "co", name: "Colombia" },
  { code: "hr", name: "Croatia" },
  { code: "cz", name: "Czechia" },
  { code: "dk", name: "Denmark" },
  { code: "eg", name: "Egypt" },
  { code: "et", name: "Ethiopia" },
  { code: "fi", name: "Finland" },
  { code: "fr", name: "France" },
  { code: "de", name: "Germany" },
  { code: "gh", name: "Ghana" },
  { code: "gr", name: "Greece" },
  { code: "hk", name: "Hong Kong" },
  { code: "hu", name: "Hungary" },
  { code: "is", name: "Iceland" },
  { code: "in", name: "India" },
  { code: "id", name: "Indonesia" },
  { code: "ir", name: "Iran" },
  { code: "iq", name: "Iraq" },
  { code: "ie", name: "Ireland" },
  { code: "il", name: "Israel" },
  { code: "it", name: "Italy" },
  { code: "jp", name: "Japan" },
  { code: "ke", name: "Kenya" },
  { code: "kr", name: "South Korea" },
  { code: "my", name: "Malaysia" },
  { code: "mx", name: "Mexico" },
  { code: "ma", name: "Morocco" },
  { code: "nl", name: "Netherlands" },
  { code: "nz", name: "New Zealand" },
  { code: "ng", name: "Nigeria" },
  { code: "no", name: "Norway" },
  { code: "pk", name: "Pakistan" },
  { code: "pe", name: "Peru" },
  { code: "ph", name: "Philippines" },
  { code: "pl", name: "Poland" },
  { code: "pt", name: "Portugal" },
  { code: "ro", name: "Romania" },
  { code: "ru", name: "Russia" },
  { code: "sa", name: "Saudi Arabia" },
  { code: "sg", name: "Singapore" },
  { code: "za", name: "South Africa" },
  { code: "es", name: "Spain" },
  { code: "se", name: "Sweden" },
  { code: "ch", name: "Switzerland" },
  { code: "tw", name: "Taiwan" },
  { code: "th", name: "Thailand" },
  { code: "tr", name: "Türkiye" },
  { code: "ua", name: "Ukraine" },
  { code: "ae", name: "UAE" },
  { code: "gb", name: "United Kingdom" },
  { code: "us", name: "United States" },
  { code: "vn", name: "Vietnam" },
];

export function getFlagUrl(code: string | undefined, width: number = 40): string {
  if (!code) return "";
  // flagcdn.com supports widths: w20, w40, w80, w160, w320, etc.
  // Map requested width to one of the supported widths (rounding up/matching)
  let flagWidth = 40;
  if (width <= 20) {
    flagWidth = 20;
  } else if (width <= 40) {
    flagWidth = 40;
  } else if (width <= 80) {
    flagWidth = 80;
  } else if (width <= 160) {
    flagWidth = 160;
  } else {
    flagWidth = 320;
  }
  return `https://flagcdn.com/w${flagWidth}/${code.toLowerCase()}.png`;
}
