(function (root) {
  "use strict";

  const whitespaceRegex = /\s+/g;
  const specialCharRegex = /[^A-Z0-9_]/g;
  const nonAlphaNumericRegex = /[^A-Za-z0-9]+/g;
  const acronymBoundaryRegex = /([A-Z]+)([A-Z][a-z])/g;
  const camelBoundaryRegex = /([a-z0-9])([A-Z])/g;
  const repeatedUnderscoreRegex = /_+/g;

  function normalizeSegment(value) {
    return analyzeSegment(value).result;
  }

  function normalizeSegments(values) {
    return values.map(normalizeSegment).join("_");
  }

  function buildBaseLibEntryId(namespaceValue, idValue) {
    return `${getBaseLibNamespacePrefix(namespaceValue)}-${normalizeSegment(idValue)}`;
  }

  function buildRitsuLibEntryId(modIdValue, modelTypeValue, idValue) {
    return `${normalizePublicStem(modIdValue)}_${normalizePublicStem(modelTypeValue)}_${normalizePublicStem(idValue)}`;
  }

  function normalizePublicStem(value) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error("Public stem must not be empty.");
    }

    let normalized = value.trim().replace(nonAlphaNumericRegex, "_");
    normalized = normalized.replace(acronymBoundaryRegex, "$1_$2");
    normalized = normalized.replace(camelBoundaryRegex, "$1_$2");
    normalized = normalized.replace(repeatedUnderscoreRegex, "_");
    return normalized.replace(/^_+|_+$/g, "").toUpperCase();
  }

  function getBaseLibNamespacePrefix(value) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error("Namespace must not be empty.");
    }

    const firstSegment = value.trim().split(".")[0].trim();
    if (firstSegment.length === 0) {
      throw new Error("Namespace prefix must not be empty.");
    }

    return firstSegment.toUpperCase();
  }

  function analyzeSegment(value) {
    if (typeof value !== "string") {
      throw new Error("Segment must be a string.");
    }

    const trimmed = value.trim();
    const afterCamelCase = replaceGameCamelCase(trimmed);
    const afterUppercase = afterCamelCase.toUpperCase();
    const afterWhitespace = afterUppercase.replace(whitespaceRegex, "_");
    const result = afterWhitespace.replace(specialCharRegex, "");

    return {
      input: value,
      trimmed,
      afterCamelCase,
      afterUppercase,
      afterWhitespace,
      result,
      tokens: result.length === 0 ? [] : result.split("_"),
    };
  }

  function replaceGameCamelCase(value) {
    let result = "";
    let appendFrom = 0;
    let searchFrom = 0;

    while (searchFrom < value.length) {
      const match = findGameCamelCaseMatch(value, searchFrom);
      if (match === null) {
        break;
      }

      result += value.slice(appendFrom, match.index);
      result += `${match.group1}_${match.group2}`;
      appendFrom = match.index + match.length;
      searchFrom = appendFrom;
    }

    return result + value.slice(appendFrom);
  }

  function findGameCamelCaseMatch(value, searchFrom) {
    for (let index = searchFrom; index < value.length; index += 1) {
      if (isAsciiAlphaNumeric(value[index]) && index + 1 < value.length && isAsciiUpper(value[index + 1])) {
        return {
          index,
          length: 2,
          group1: value[index],
          group2: value[index + 1],
        };
      }

      if (index === searchFrom && index !== 0 && isAsciiUpper(value[index])) {
        return {
          index,
          length: 1,
          group1: "",
          group2: value[index],
        };
      }
    }

    return null;
  }

  function isAsciiAlphaNumeric(char) {
    return /^[A-Za-z0-9]$/.test(char);
  }

  function isAsciiUpper(char) {
    return /^[A-Z]$/.test(char);
  }

  root.RitsuLibEntryId = Object.freeze({
    analyzeSegment,
    buildBaseLibEntryId,
    buildRitsuLibEntryId,
    getBaseLibNamespacePrefix,
    normalizePublicStem,
    normalizeSegment,
    normalizeSegments,
  });
})(globalThis);
