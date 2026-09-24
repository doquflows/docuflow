export const renderInlineMd = (s: string): string =>
  s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="df-code">$1</code>');
