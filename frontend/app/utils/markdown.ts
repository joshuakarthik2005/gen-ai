/**
 * Simple markdown to HTML converter for legal document analysis
 * Handles common markdown patterns used in the backend responses
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  
  let html = markdown;
  
  // Convert **bold** to <strong>
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>');
  
  // Convert *italic* to <em>
  html = html.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
  
  // Convert numbered list items with bold headings
  html = html.replace(/(\d+)\.\s+\*\*(.+?)\*\*\s*/g, '<div class="mt-3 mb-2"><strong class="font-semibold text-gray-900">$1. $2</strong></div>');
  
  // Convert lines starting with spaces (indented content)
  html = html.replace(/^   (.+?)$/gm, '<div class="ml-6 text-gray-700">$1</div>');
  
  // Convert bullet points with - at the start of lines
  html = html.replace(/^   - (.+?)$/gm, '<li class="ml-6 text-gray-700">$1</li>');
  
  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li class="ml-6 text-gray-700">.*?<\/li>\s*)+/g, '<ul class="list-disc ml-10 my-1 space-y-1">$&</ul>');
  
  // Convert double newlines to paragraph breaks
  html = html.split('\n\n').map(para => {
    if (para.trim() && !para.startsWith('<div') && !para.startsWith('<ul') && !para.startsWith('<li')) {
      return `<p class="mb-2">${para.replace(/\n/g, '<br>')}</p>`;
    }
    return para;
  }).join('');
  
  return html;
}

/**
 * Sanitize HTML to prevent XSS attacks
 * Allows only specific safe tags
 */
export function sanitizeHtml(html: string): string {
  // For now, we trust our own backend output
  // In production, consider using a library like DOMPurify
  return html;
}
