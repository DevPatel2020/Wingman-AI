import React from 'react';

interface FormattedMessageProps {
  text: string;
}

const FormattedMessage: React.FC<FormattedMessageProps> = ({ text }) => {
  // Pre-process text to add line breaks where appropriate if they're missing
  const preprocessText = (text: string): string => {
    if (!text) return '';
    
    // If text has very few line breaks, try to add them intelligently
    const lineBreakCount = (text.match(/\n/g) || []).length;
    const charCount = text.length;
    const lineBreakRatio = lineBreakCount / charCount;
    
    // If there are very few line breaks (less than 1 per 200 chars), add them
    if (lineBreakRatio < 0.005 && charCount > 100) {
      let processed = text;
      
      // Add line break after headings (word followed by colon)
      processed = processed.replace(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*):\*{0,2}\s+/g, (match) => {
        return match + '\n';
      });
      
      // Add line break after sentences ending with period followed by capital letter (but not in code blocks)
      processed = processed.replace(/([.!?])\s+([A-Z][a-z])/g, '$1\n\n$2');
      
      // Add line break before bullet points or numbered lists
      processed = processed.replace(/\s+([-*•]\s)/g, '\n$1');
      processed = processed.replace(/\s+(\d+[.)]\s)/g, '\n$1');
      
      return processed;
    }
    
    return text;
  };

  // Function to format the text with proper line breaks and structure
  const formatText = (text: string): React.ReactNode[] => {
    if (!text) return [];
    
    // Pre-process the text first
    const processedText = preprocessText(text);

    // First, handle code blocks (before splitting into paragraphs)
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
    let match;
    let keyCounter = 0;

    while ((match = codeBlockRegex.exec(processedText)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        const beforeText = processedText.substring(lastIndex, match.index);
        parts.push(...formatParagraphs(beforeText, keyCounter));
        keyCounter += 100; // Increment to avoid key conflicts
      }
      // Add code block
      parts.push(
        <pre
          key={`code-${keyCounter++}`}
          className="bg-gray-800/90 text-gray-100 p-3 rounded-lg my-2 overflow-x-auto text-[11px] font-mono border border-gray-700/50"
          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        >
          <code>{match[2].trim()}</code>
        </pre>
      );
      lastIndex = match.index + match[0].length;
    }
    // Add remaining text
    if (lastIndex < processedText.length) {
      const afterText = processedText.substring(lastIndex);
      parts.push(...formatParagraphs(afterText, keyCounter));
    }

    return parts.length > 0 ? parts : [<div key="empty">No content</div>];
  };

  // Format paragraphs with proper structure
  const formatParagraphs = (text: string, startKey: number): React.ReactNode[] => {
    // Split by double newlines (paragraphs) or single newline followed by specific patterns
    const paragraphs = text.split(/\n\n+/);
    
    return paragraphs.map((paragraph, pIdx) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return null;

      const key = startKey + pIdx;

      // Check for list items (lines starting with -, *, •, or numbers)
      if (/^[-*•]\s/.test(trimmed) || /^\d+[.)]\s/.test(trimmed)) {
        return formatList(trimmed, key);
      }

      // Check for headings (lines that are short and end with colon, are all caps, or match pattern like "Definition:**")
      const headingPattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*):\*{0,2}$/;
      if (trimmed.length < 100 && (trimmed.endsWith(':') || trimmed.endsWith(':**') || /^[A-Z\s]+$/.test(trimmed) || headingPattern.test(trimmed))) {
        const headingText = trimmed.replace(/:\*+$/, ':');
        return (
          <div key={key} className="mb-2 mt-3 first:mt-0">
            <strong className="text-sm font-semibold block mb-1">{headingText}</strong>
          </div>
        );
      }
      
      // Check for text that starts with a word followed by colon (like "Definition:** Min-max...")
      const colonPattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*):\*{0,2}\s+(.+)$/;
      const colonMatch = trimmed.match(colonPattern);
      if (colonMatch && colonMatch[1].length < 50) {
        return (
          <div key={key} className="mb-2 last:mb-0">
            <strong className="text-sm font-semibold block mb-1">{colonMatch[1]}:</strong>
            <div style={{ whiteSpace: 'pre-line' }}>
              {formatInlineText(colonMatch[2], key)}
            </div>
          </div>
        );
      }

      // Regular paragraph with inline formatting
      return (
        <div key={key} className="mb-2 last:mb-0" style={{ whiteSpace: 'pre-line' }}>
          {formatInlineText(trimmed, key)}
        </div>
      );
    }).filter(Boolean) as React.ReactNode[];
  };

  // Format list items
  const formatList = (text: string, key: number): React.ReactNode => {
    const lines = text.split('\n').filter(line => line.trim());
    return (
      <ul key={key} className="list-disc list-inside mb-2 space-y-1 ml-2">
        {lines.map((line, idx) => {
          // Remove list markers
          const cleaned = line.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '').trim();
          return (
            <li key={`${key}-${idx}`} className="text-xs">
              {formatInlineText(cleaned, `${key}-${idx}`)}
            </li>
          );
        })}
      </ul>
    );
  };

  // Format inline text with code, bold, etc.
  const formatInlineText = (text: string, key: number | string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let partKey = 0;

    // Handle inline code first
    const codeRegex = /`([^`]+)`/g;
    let match;

    while ((match = codeRegex.exec(text)) !== null) {
      // Add text before code
      if (match.index > lastIndex) {
        const beforeText = text.substring(lastIndex, match.index);
        parts.push(...formatBoldText(beforeText, `${key}-${partKey++}`));
      }
      // Add code
      parts.push(
        <code
          key={`${key}-code-${partKey++}`}
          className="bg-gray-800/70 text-gray-100 px-1.5 py-0.5 rounded text-[11px] font-mono"
        >
          {match[1]}
        </code>
      );
      lastIndex = match.index + match[0].length;
    }
    // Add remaining text
    if (lastIndex < text.length) {
      const afterText = text.substring(lastIndex);
      parts.push(...formatBoldText(afterText, `${key}-${partKey++}`));
    }

    return parts.length > 0 ? <>{parts}</> : text;
  };

  // Format bold text
  const formatBoldText = (text: string, key: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let match;
    let partKey = 0;

    while ((match = boldRegex.exec(text)) !== null) {
      // Add text before bold
      if (match.index > lastIndex) {
        parts.push(
          <span key={`${key}-${partKey++}`}>
            {text.substring(lastIndex, match.index)}
          </span>
        );
      }
      // Add bold text
      parts.push(
        <strong key={`${key}-${partKey++}`} className="font-semibold">
          {match[1]}
        </strong>
      );
      lastIndex = match.index + match[0].length;
    }
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(
        <span key={`${key}-${partKey++}`}>
          {text.substring(lastIndex)}
        </span>
      );
    }

    return parts.length > 0 ? parts : [<span key={key}>{text}</span>];
  };

  const formattedContent = formatText(text);

  return (
    <div className="formatted-message" style={{ lineHeight: '1.6' }}>
      {formattedContent.length > 0 ? formattedContent : <div style={{ whiteSpace: 'pre-line' }}>{text}</div>}
    </div>
  );
};

export default FormattedMessage;

