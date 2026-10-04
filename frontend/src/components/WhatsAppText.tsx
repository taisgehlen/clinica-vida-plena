import { Fragment } from 'react';

export function WhatsAppText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, lineIndex) => (
        <Fragment key={lineIndex}>
          {lineIndex > 0 && <br />}
          {line.split(/(\*[^*\n]+\*)/g).map((part, partIndex) =>
            part.startsWith('*') && part.endsWith('*') && part.length > 2 ? (
              <strong key={partIndex}>{part.slice(1, -1)}</strong>
            ) : (
              <Fragment key={partIndex}>{part}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </>
  );
}
