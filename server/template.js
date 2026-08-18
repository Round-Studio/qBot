const TAG_RE = /\{\{\s*([#^/]?)\s*([a-zA-Z0-9_.]+)\s*\}\}/;

function getPath(data, key) {
  if (key === '.') return data;
  let value = data;
  for (const part of key.split('.')) {
    if (value == null) return undefined;
    value = value[part];
  }
  return value;
}

export function renderTemplate(template, data) {
  if (template == null) return '';
  return renderBlock(String(template), data);
}

function renderBlock(template, data) {
  let result = '';
  let i = 0;
  while (i < template.length) {
    const rest = template.slice(i);
    const match = rest.match(TAG_RE);
    if (!match) {
      result += rest;
      break;
    }
    result += rest.slice(0, match.index);
    const [, op, key] = match;
    const tag = match[0];
    const afterTag = rest.slice(match.index + tag.length);

    if (op === '#' || op === '^') {
      const closeTag = `{{/${key}}}`;
      const closeIdx = afterTag.indexOf(closeTag);
      if (closeIdx === -1) {
        result += tag;
        i += match.index + tag.length;
        continue;
      }
      const inner = afterTag.slice(0, closeIdx);
      const value = getPath(data, key);
      if (op === '#') {
        if (Array.isArray(value)) {
          for (const item of value) {
            result += typeof item === 'object' && item !== null
              ? renderBlock(inner, item)
              : renderBlock(inner, data);
          }
        } else if (value) {
          result += renderBlock(inner, data);
        }
      } else {
        const empty = Array.isArray(value) ? value.length === 0 : !value;
        if (empty) result += renderBlock(inner, data);
      }
      i += match.index + tag.length + closeIdx + closeTag.length;
    } else {
      const value = getPath(data, key);
      result += value == null ? '' : String(value);
      i += match.index + tag.length;
    }
  }
  return result;
}