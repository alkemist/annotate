export interface OrthPoints {
  x1: number,
  y1: number,
  x2: number,
  y2: number,
}

export interface NormPoints {
  xCenter: number,
  yCenter: number,
  w: number,
  h: number,
}

export abstract class YoloUtils {
  static calcOrthogonalPoints(
    xCenterNorm: number, yCenterNorm: number, wNorm: number, hNorm: number,
    wImg: number, hImg: number): OrthPoints {
    const wBox = wNorm * wImg;
    const hBox = hNorm * hImg;
    return {
      x1: (xCenterNorm * wImg) - wBox / 2,
      y1: (yCenterNorm * hImg) - hBox / 2,
      x2: xCenterNorm * wImg + wBox / 2,
      y2: yCenterNorm * hImg + hBox / 2,
    }
  }

  static calcNormPoints(
    x1: number, y1: number, x2: number, y2: number,
    wImg: number, hImg: number): NormPoints {
    const xTL = x1 < x2 ? x1 : x2;
    const xBR = x1 > x2 ? x1 : x2;
    const yTL = y1 < y2 ? y1 : y2;
    const yBR = y1 > y2 ? y1 : y2;

    const wBox = xBR - xTL;
    const hBox = yBR - yTL;
    return {
      xCenter: (xTL + (wBox / 2)) / wImg,
      yCenter: (yTL + (hBox / 2)) / hImg,
      w: wBox / wImg,
      h: hBox / hImg,
    }
  }
}
