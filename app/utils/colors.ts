export const getYearColor = (year: number): string => {
  // Palette élargie avec des différences plus marquées
  const colorMap: Record<number, string> = {
    // Années récentes - teintes froides et claires
    2025: '#3a4a6c', // bleu-gris clair
    2024: '#1e3a7a', // bleu vif
    2023: '#1a4d5c', // bleu-vert émeraude
    2022: '#3a4a6a', // bleu-gris moyen

    // Années 2020-2021 - transition
    2021: '#3a2e6a', // bleu-violet
    2020: '#2a467a', // bleu-gris chaud

    // Années 2010-2019 - teintes moyennes
    2019: '#2a2a7a', // bleu nuit profond
    2018: '#1e2a8a', // bleu roi
    2017: '#1a5a6a', // bleu canard vif
    2016: '#1a5a4a', // vert bleuté
    2015: '#1a3a7a', // bleu marine
    2014: '#4a1e7a', // violet profond
    2013: '#1a5a4a', // vert émeraude
    2012: '#1e3a9a', // bleu ciel profond

    // Années 2000-2011 - teintes chaudes et foncées
    2011: '#1e293b', // slate-800 de base
    2010: '#2a467a', // bleu-gris chaud
    2009: '#3a4a6a', // bleu-gris moyen
    2008: '#1a3a8a', // bleu nuit clair
    2007: '#5a2a4a', // bordeaux
    2006: '#5a1e6a', // violet profond
    2005: '#3a1a7a', // bleu-violet foncé
    2004: '#2a1a5a', // bleu nuit profond
    2003: '#3a3a5a', // bleu-gris foncé
    2002: '#1a5a4a', // vert foncé
    2001: '#5a3a2a', // marron chaud
    2000: '#3a3a5a' // bleu-gris foncé
  }
  return colorMap[year] || '#1e293b' // slate-800 par défaut
}
