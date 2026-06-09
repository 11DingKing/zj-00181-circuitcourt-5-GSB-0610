import CircuitCourt, { ICircuitCourt } from "../models/CircuitCourt";

export interface LocationInfo {
  province: string;
  city: string;
  county: string;
}

export interface JurisdictionMatchResult {
  circuitCourt: ICircuitCourt;
  isCrossRegional: boolean;
  originalJurisdiction: string;
  matchConfidence: number;
}

export class JurisdictionService {
  static async matchCircuitCourt(
    location: LocationInfo,
  ): Promise<JurisdictionMatchResult | null> {
    const { province, city, county } = location;

    if (province !== "河南省") {
      return null;
    }

    let matchedCourt: ICircuitCourt | null = null;
    let matchConfidence = 0;

    const activeCourts = await CircuitCourt.find({ isActive: true });

    const isMultiRegion = this.checkMultiRegional(city, county);

    for (const court of activeCourts) {
      const countyMatch = court.coveredCounties.some(
        (coveredCounty) =>
          coveredCounty === county ||
          coveredCounty.includes(county) ||
          county.includes(coveredCounty),
      );
      if (countyMatch) {
        matchedCourt = court;
        matchConfidence = 100;
        break;
      }

      const cityMatch = court.coveredCities.some(
        (coveredCity) =>
          coveredCity === city ||
          coveredCity.includes(city) ||
          city.includes(coveredCity),
      );
      if (cityMatch && matchConfidence < 80) {
        matchedCourt = court;
        matchConfidence = 80;
      }
    }

    if (isMultiRegion && !matchedCourt) {
      matchedCourt = this.matchMultiRegionalCourt(activeCourts, city, county);
      matchConfidence = matchedCourt ? 90 : 0;
    }

    if (!matchedCourt) {
      matchedCourt =
        activeCourts.find((c) => c.code === "ZZ") || activeCourts[0] || null;
      matchConfidence = matchedCourt ? 50 : 0;
    }

    if (!matchedCourt) {
      return null;
    }

    const isCrossRegional = this.checkCrossRegional(
      matchedCourt,
      city,
      county,
      isMultiRegion,
    );
    const originalJurisdiction = `${city}${county}`;

    return {
      circuitCourt: matchedCourt,
      isCrossRegional,
      originalJurisdiction,
      matchConfidence,
    };
  }

  private static checkMultiRegional(city: string, county: string): boolean {
    const multiRegionKeywords = [
      "跨",
      "交界",
      "沿线",
      "流域",
      "沿岸",
      "走廊",
      "通道",
    ];
    const combined = `${city}${county}`;
    return multiRegionKeywords.some((keyword) => combined.includes(keyword));
  }

  private static matchMultiRegionalCourt(
    courts: ICircuitCourt[],
    city: string,
    county: string,
  ): ICircuitCourt | null {
    const allRegions = `${city}${county}`;
    let bestCourt: ICircuitCourt | null = null;
    let maxMatches = 0;

    for (const court of courts) {
      const allCovered = [...court.coveredCities, ...court.coveredCounties];
      const matchCount = allCovered.filter((region) =>
        allRegions.includes(region),
      ).length;
      if (matchCount > maxMatches) {
        maxMatches = matchCount;
        bestCourt = court;
      }
    }

    return bestCourt;
  }

  private static checkCrossRegional(
    court: ICircuitCourt,
    city: string,
    county: string,
    isMultiRegion: boolean,
  ): boolean {
    if (isMultiRegion) {
      return true;
    }

    const exactCountyMatch = court.coveredCounties.some(
      (c) => c === county || county.includes(c) || c.includes(county),
    );
    if (exactCountyMatch) {
      return false;
    }

    const exactCityMatch = court.coveredCities.some(
      (c) => c === city || city.includes(c) || c.includes(city),
    );
    if (exactCityMatch) {
      const countyBelongsToCourt = court.coveredCounties.some(
        (c) => c.includes(county) || county.includes(c),
      );
      return !countyBelongsToCourt;
    }

    return true;
  }

  static async getCourtByCode(code: string): Promise<ICircuitCourt | null> {
    return CircuitCourt.findOne({ code, isActive: true });
  }

  static async getAllCourts(): Promise<ICircuitCourt[]> {
    return CircuitCourt.find({ isActive: true }).sort({ code: 1 });
  }

  static async getCourtCoverage(): Promise<
    Array<{
      court: ICircuitCourt;
      coveredAreas: string[];
    }>
  > {
    const courts = await this.getAllCourts();
    return courts.map((court) => ({
      court,
      coveredAreas: [...court.coveredCities, ...court.coveredCounties],
    }));
  }
}
