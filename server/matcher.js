// 指令匹配系统
// 每条指令由 keywords（触发关键词）+ prefixes（可选前缀，如 "." "/" "。"）组成。
// 匹配优先级：先取最多前缀的第一条匹配；相同前缀内按指令在配置中的顺序。

export const DEFAULT_PREFIXES = ['.', '/', '。'];

// 匹配指令，返回 { command, args } 或 null
export function matchCommand(content, commands, defaultPrefixes = DEFAULT_PREFIXES) {
  if (!content) return null;
  let text = content.trim();
  if (!text) return null;

  // 去掉开头的 @机器人 提及
  text = text.replace(/^@[^\s]+\s*/, '').trim();
  if (!text) return null;

  const lower = text.toLowerCase();

  for (const cmd of commands) {
    if (!cmd || cmd.enabled === false) continue;
    const prefixes = Array.isArray(cmd.prefixes) && cmd.prefixes.length ? cmd.prefixes : defaultPrefixes;
    let keywords = Array.isArray(cmd.keywords) ? cmd.keywords.filter(Boolean) : [];
    if (!keywords.length) keywords = [String(cmd.name || '')];
    if (!keywords.length) continue;

    for (const prefix of prefixes) {
      for (const kw of keywords) {
        const token = String(prefix + kw).toLowerCase();
        if (lower === token) return { command: cmd, args: [] };
        if (lower.startsWith(token + ' ')) {
          const rest = text.slice(token.length).trim();
          const args = rest ? rest.split(/\s+/) : [];
          return { command: cmd, args };
        }
      }
    }
  }
  return null;
}

// 从旧的 patterns（如 [".bb", "/bb", "。bb"]）迁移出 prefixes + keywords
export function migratePatterns(patterns) {
  const prefixes = new Set();
  const keywords = new Set();
  for (const pattern of (patterns || [])) {
    const p = String(pattern).trim();
    if (!p) continue;
    const m = p.match(/^([^\p{L}\p{N}_\-]+)(.+)$/u);
    if (m) {
      prefixes.add(m[1]);
      keywords.add(m[2].split(/\s+/)[0]);
    } else {
      keywords.add(p.split(/\s+/)[0]);
    }
  }
  return {
    prefixes: prefixes.size ? [...prefixes] : [],
    keywords: keywords.size ? [...keywords] : [],
  };
}

// 指令的默认展示触发词
export function firstPattern(cmd, defaultPrefixes = DEFAULT_PREFIXES) {
  const prefixes = Array.isArray(cmd.prefixes) && cmd.prefixes.length ? cmd.prefixes : defaultPrefixes;
  const keywords = Array.isArray(cmd.keywords) && cmd.keywords.length ? cmd.keywords : [String(cmd.name || '')];
  const prefix = prefixes[0] || '';
  const kw = keywords[0] || cmd.name || '';
  return prefix + kw;
}

// 所有触发词（用于帮助信息展示）
export function allPatterns(cmd, defaultPrefixes = DEFAULT_PREFIXES) {
  const prefixes = Array.isArray(cmd.prefixes) && cmd.prefixes.length ? cmd.prefixes : defaultPrefixes;
  const keywords = Array.isArray(cmd.keywords) && cmd.keywords.length ? cmd.keywords : [String(cmd.name || '')];
  const out = [];
  for (const prefix of prefixes) {
    for (const kw of keywords) out.push(prefix + kw);
  }
  return out;
}