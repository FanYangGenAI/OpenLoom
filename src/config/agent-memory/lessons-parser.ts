export interface ParsedLessons {
  preferredUserName?: string;
  preferredAgentName?: string;
  tone?: string;
  languagePreference?: string;
  formatPreference?: string;
  workingAgreements: string[];
  updateLog: string[];
}

function parseKeyValue(content: string, key: string): string | undefined {
  const regex = new RegExp(`-\\s*${key}:\\s*(.*)`, 'i');
  const match = content.match(regex);
  const value = match?.[1]?.trim();
  if (!value) return undefined;
  return value;
}

function parseSectionList(content: string, sectionTitle: string, keepColonLines = false): string[] {
  const sectionPattern = new RegExp(`##\\s*${sectionTitle}[\\s\\S]*?(?=\\n##\\s|$)`, 'i');
  const section = content.match(sectionPattern)?.[0] ?? '';
  return section
    .split('\n')
    .filter((line) => line.trim().startsWith('- '))
    .map((line) => line.trim().slice(2).trim())
    .filter((line) => line.length > 0 && (keepColonLines || !line.includes(':')));
}

export function parseLessons(content: string): ParsedLessons {
  return {
    preferredUserName: parseKeyValue(content, 'preferred_user_name'),
    preferredAgentName: parseKeyValue(content, 'preferred_agent_name'),
    tone: parseKeyValue(content, 'tone'),
    languagePreference: parseKeyValue(content, 'language_preference'),
    formatPreference: parseKeyValue(content, 'format_preference'),
    workingAgreements: parseSectionList(content, 'WorkingAgreements'),
    updateLog: parseSectionList(content, 'UpdateLog', true),
  };
}
