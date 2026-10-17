import React, { type ReactNode } from 'react';

/** Renders bold, italic, and code safely as React elements without HTML injection. */
function renderInline(text: string): ReactNode[] {
  const tokenRegex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.includes('\n')) {
      const sublines = part.split('\n');
      return (
        <React.Fragment key={index}>
          {sublines.map((line, subIndex) => (
            <React.Fragment key={subIndex}>
              {subIndex > 0 && <br />}
              {line}
            </React.Fragment>
          ))}
        </React.Fragment>
      );
    }
    return part;
  });
}

function normalizeMarkdown(raw: string): string {
  return raw
    // Break before numbered list items if they are inline (e.g. "...India 2. **Parkway...")
    .replace(/([^\n])\s+(\d+\.\s+(?:\*\*|[A-Z]))/g, '$1\n$2')
    // Break after numbered list items if next sentence is inline (e.g. "...India Which one...")
    .replace(/(\b\d{5,6}[,\s\w]*?)\s+(Which one|Once you|Please|Let me|Would you)/g, '$1\n\n$2')
    // Break before bullet points if inline (e.g. "...data on: * Annual...")
    .replace(/([^\n])\s+(\*\s+[A-Z])/g, '$1\n$2')
    // Break after colon before lists (e.g. "data on: *")
    .replace(/(:\s*)(\*|\d+\.)/g, ':\n\n$2');
}

export function FormattedMessage({ text }: { text: string }) {
  if (!text) return null;

  const normalized = normalizeMarkdown(text);
  const rawBlocks = normalized.split(/\n\s*\n/);

  return (
    <>
      {rawBlocks.map((block, blockIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);

        // Check if block is an ordered list
        const isOrderedList = lines.every((l) => /^\d+[\.\)]\s/.test(l));
        if (isOrderedList) {
          return (
            <ol key={blockIdx} style={{ margin: '8px 0', paddingLeft: '20px' }}>
              {lines.map((line, lineIdx) => {
                const itemText = line.replace(/^\d+[\.\)]\s*/, '');
                return <li key={lineIdx}>{renderInline(itemText)}</li>;
              })}
            </ol>
          );
        }

        // Check if block is an unordered list
        const isUnorderedList = lines.every((l) => /^[\*\-\•]\s/.test(l));
        if (isUnorderedList) {
          return (
            <ul key={blockIdx} style={{ margin: '8px 0', paddingLeft: '20px' }}>
              {lines.map((line, lineIdx) => {
                const itemText = line.replace(/^[\*\-\•]\s*/, '');
                return <li key={lineIdx}>{renderInline(itemText)}</li>;
              })}
            </ul>
          );
        }

        // Mixed block containing list items
        const hasListItems = lines.some((l) => /^[\*\-\•\d+\.]\s/.test(l));
        if (hasListItems) {
          const elements: ReactNode[] = [];
          let currentList: { type: 'ol' | 'ul'; items: string[] } | null = null;

          const flushList = () => {
            if (!currentList) return;
            const ListTag = currentList.type;
            elements.push(
              <ListTag key={`list-${elements.length}`} style={{ margin: '8px 0', paddingLeft: '20px' }}>
                {currentList.items.map((it, idx) => (
                  <li key={idx}>{renderInline(it)}</li>
                ))}
              </ListTag>
            );
            currentList = null;
          };

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const isOl = /^\d+[\.\)]\s/.test(line);
            const isUl = /^[\*\-\•]\s/.test(line);

            if (isOl) {
              if (currentList && currentList.type !== 'ol') flushList();
              if (!currentList) currentList = { type: 'ol', items: [] };
              currentList.items.push(line.replace(/^\d+[\.\)]\s*/, ''));
            } else if (isUl) {
              if (currentList && currentList.type !== 'ul') flushList();
              if (!currentList) currentList = { type: 'ul', items: [] };
              currentList.items.push(line.replace(/^[\*\-\•]\s*/, ''));
            } else {
              flushList();
              elements.push(
                <p key={`p-${elements.length}`} style={{ margin: '6px 0' }}>
                  {renderInline(line)}
                </p>
              );
            }
          }
          flushList();
          return <React.Fragment key={blockIdx}>{elements}</React.Fragment>;
        }

        return (
          <p key={blockIdx} style={{ margin: '6px 0' }}>
            {renderInline(trimmed)}
          </p>
        );
      })}
    </>
  );
}
