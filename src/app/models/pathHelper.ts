export abstract class PathHelper {
  static findCommonPath(paths: string[]) {
    if (!paths.length) return '';

    // Sépare chaque chemin en segments
    const splitPaths = paths.map(path => path.split(/[/\\]+/));

    // Trouver la longueur minimale des chemins
    const minLength = Math.min(...splitPaths.map(segments => segments.length));

    let commonSegments = [];
    for (let i = 0; i < minLength; i++) {
      // Récupère le segment actuel pour tous les chemins
      const segment = splitPaths[0][i];

      // Vérifie si ce segment est commun à tous les chemins
      if (splitPaths.every(segments => segments[i] === segment)) {
        commonSegments.push(segment);
      } else {
        break;
      }
    }

    // Joindre les segments communs pour former le chemin commun
    return commonSegments.join('/');
  }
}
