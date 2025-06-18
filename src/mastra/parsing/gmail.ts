import * as cheerio from 'cheerio';

/**
 * Gmail DOM Parser for Browser MCP Tool
 * Efficiently extracts actionable data from Gmail DOM responses
 */

export class GmailDOMParser {
  urlPatterns: {
    inbox: RegExp;
    email: RegExp;
    compose: RegExp;
    search: RegExp;
    label: RegExp;
  };
  constructor() {
    this.urlPatterns = {
      inbox: /gmail\.com\/mail\/u\/\d+\/#inbox/,
      email: /gmail\.com\/mail\/u\/\d+\/#inbox\/[a-zA-Z0-9]+/,
      compose: /gmail\.com\/mail\/u\/\d+\/#compose/,
      search: /gmail\.com\/mail\/u\/\d+\/#search/,
      label: /gmail\.com\/mail\/u\/\d+\/#label/
    };
  }

  /**
   * Main parsing function - routes to appropriate parser based on URL
   */
  parse(htmlContent: string, url: string) {
    const $ = cheerio.load(htmlContent);
    if (this.urlPatterns.inbox.test(url)) {
      return this.parseInboxView($, url);
    } else if (this.urlPatterns.email.test(url)) {
      return this.parseEmailView($, url);
    } else if (this.urlPatterns.compose.test(url)) {
      return this.parseComposeView($, url);
    } else if (this.urlPatterns.search.test(url)) {
      return this.parseSearchView($, url);
    } else {
      return this.parseGenericView($, url);
    }
  }

  /**
   * Parse Gmail Inbox View
   */
  parseInboxView($: cheerio.CheerioAPI, url: string) {
    const result: any = {
      view: 'inbox',
      url,
      timestamp: new Date().toISOString(),
      emails: [] as any[],
      actions: {
        compose: null,
        refresh: null,
        selectAll: null,
        bulkActions: [] as any[]
      },
      navigation: {
        labels: [] as any[],
        folders: [] as any[]
      },
      pagination: null
    };
    // Extract email list
    $('div[role="main"] table tbody tr, div[role="main"] div[role="listitem"]').each((i, row) => {
      const $row = $(row);
      const email = this.extractEmailRowData($row);
      if (email && email.subject) {
        result.emails.push(email);
      }
    });
    // Extract navigation actions
    result.actions.compose = this.extractElement($, 'button[aria-label*="Compose"], button:contains("Compose")');
    result.actions.refresh = this.extractElement($, 'button[aria-label*="Refresh"], button[title*="Refresh"]');
    result.actions.selectAll = this.extractElement($, 'button[aria-label*="Select"], input[type="checkbox"][title*="Select"]');
    // Extract bulk actions
    $('button[aria-label*="Delete"], button[aria-label*="Archive"], button[aria-label*="Mark"]').each((i, btn) => {
      const action = this.extractElement($(btn));
      if (action) result.actions.bulkActions.push(action);
    });
    // Extract navigation labels
    $('a[href*="#label"], a[href*="#inbox"], a[href*="#starred"]').each((i, link) => {
      const $link = $(link);
      const label = {
        name: $link.text().trim(),
        href: $link.attr('href'),
        ref: $link.attr('ref') || this.findClosestRef($link),
        unreadCount: this.extractUnreadCount($link)
      };
      if (label.name) {
        if (label.href && (label.href.includes('#inbox') || label.href.includes('#starred'))) {
          result.navigation.folders.push(label);
        } else {
          result.navigation.labels.push(label);
        }
      }
    });
    // Extract pagination
    const paginationText = $('div:contains("of"), span:contains("of")').text();
    if (paginationText) {
      result.pagination = this.parsePaginationText(paginationText);
    }
    return result;
  }

  /**
   * Parse individual email view
   */
  parseEmailView($: cheerio.CheerioAPI, url: string) {
    const result: any = {
      view: 'email',
      url,
      timestamp: new Date().toISOString(),
      email: {
        subject: '',
        from: '',
        to: [] as any[],
        date: '',
        body: '',
        attachments: [] as any[]
      },
      actions: {
        reply: null,
        replyAll: null,
        forward: null,
        delete: null,
        archive: null,
        back: null,
        star: null,
        markUnread: null
      },
      navigation: {
        previous: null,
        next: null
      }
    };
    // Extract email content
    result.email.subject = $('h2, [aria-label*="Subject"], [data-legacy-thread-id] h2').first().text().trim();
    result.email.from = this.extractSender($);
    result.email.to = this.extractRecipients($);
    result.email.date = this.extractEmailDate($);
    result.email.body = this.extractEmailBody($);
    result.email.attachments = this.extractAttachments($);
    // Extract action buttons
    result.actions.reply = this.extractElement($, 'button[aria-label*="Reply"], button:contains("Reply")');
    result.actions.replyAll = this.extractElement($, 'button[aria-label*="Reply all"], button:contains("Reply all")');
    result.actions.forward = this.extractElement($, 'button[aria-label*="Forward"], button:contains("Forward")');
    result.actions.delete = this.extractElement($, 'button[aria-label*="Delete"], button[title*="Delete"]');
    result.actions.archive = this.extractElement($, 'button[aria-label*="Archive"], button[title*="Archive"]');
    result.actions.back = this.extractElement($, 'button[aria-label*="Back"], a[href*="#inbox"]');
    result.actions.star = this.extractElement($, 'button[aria-label*="star"], button[title*="star"]');
    result.actions.markUnread = this.extractElement($, 'button[aria-label*="unread"], button[title*="unread"]');
    // Extract navigation
    result.navigation.previous = this.extractElement($, 'button[aria-label*="Older"], button[aria-label*="Previous"]');
    result.navigation.next = this.extractElement($, 'button[aria-label*="Newer"], button[aria-label*="Next"]');
    return result;
  }

  /**
   * Parse compose view
   */
  parseComposeView($: cheerio.CheerioAPI, url: string) {
    const result: any = {
      view: 'compose',
      url,
      timestamp: new Date().toISOString(),
      form: {
        to: null,
        cc: null,
        bcc: null,
        subject: null,
        body: null
      },
      actions: {
        send: null,
        discard: null,
        minimize: null,
        attachFile: null
      }
    };
    // Extract form fields
    result.form.to = this.extractElement($, 'input[name="to"], textarea[aria-label*="To"]');
    result.form.cc = this.extractElement($, 'input[name="cc"], textarea[aria-label*="Cc"]');
    result.form.bcc = this.extractElement($, 'input[name="bcc"], textarea[aria-label*="Bcc"]');
    result.form.subject = this.extractElement($, 'input[name="subjectbox"], input[aria-label*="Subject"]');
    result.form.body = this.extractElement($, 'div[aria-label*="Message Body"], div[contenteditable="true"]');
    // Extract action buttons
    result.actions.send = this.extractElement($, 'button[aria-label*="Send"], button:contains("Send")');
    result.actions.discard = this.extractElement($, 'button[aria-label*="Discard"], button:contains("Discard")');
    result.actions.minimize = this.extractElement($, 'button[aria-label*="Minimize"], button[aria-label*="Pop-out"]');
    result.actions.attachFile = this.extractElement($, 'button[aria-label*="Attach"], input[type="file"]');
    return result;
  }

  /**
   * Parse search results view
   */
  parseSearchView($: cheerio.CheerioAPI, url: string) {
    const inboxData = this.parseInboxView($, url);
    inboxData.view = 'search';
    // Extract search query
    const searchQuery = $('input[aria-label*="Search"], input[name="q"]').val() || '';
    inboxData.searchQuery = searchQuery;
    return inboxData;
  }

  /**
   * Generic fallback parser
   */
  parseGenericView($: cheerio.CheerioAPI, url: string) {
    return {
      view: 'unknown',
      url,
      timestamp: new Date().toISOString(),
      availableActions: this.extractAllInteractiveElements($),
      pageTitle: $('title').text() || '',
      alerts: this.extractAlerts($)
    };
  }

  /**
   * Extract email row data from inbox
   */
  extractEmailRowData($row: any) {
    const email: any = {
      id: null,
      ref: null,
      from: '',
      subject: '',
      snippet: '',
      date: '',
      isUnread: false,
      isStarred: false,
      isImportant: false,
      hasAttachment: false,
      labels: [] as any[],
      actions: {
        open: null,
        select: null,
        star: null,
        important: null
      }
    };
    // Extract basic info
    email.ref = $row.attr('ref') || this.findClosestRef($row);
    email.isUnread = $row.text().includes('unread') || $row.find('[aria-label*="unread"]').length > 0;
    // Extract sender
    const senderElement = $row.find('span[email], span[title*="@"], td:nth-child(4), td:nth-child(5)').first();
    email.from = senderElement.text().trim();
    // Extract subject and snippet
    const subjectElement = $row.find('a[href*="#inbox"], span[id*="thread"]').first();
    const fullText = subjectElement.text().trim();
    if (fullText.includes(' - ')) {
      const parts = fullText.split(' - ');
      email.subject = parts[0].trim();
      email.snippet = parts.slice(1).join(' - ').trim();
    } else {
      email.subject = fullText;
    }
    // Extract date
    const dateElement = $row.find('span[title*="2025"], span[title*="2024"], td:last-child').last();
    email.date = dateElement.text().trim() || dateElement.attr('title');
    // Extract status indicators
    email.isStarred = $row.find('button[aria-label*="Starred"], img[alt*="Starred"]').length > 0;
    email.isImportant = $row.find('button[aria-label*="Important"], img[alt*="Important"]').length > 0;
    email.hasAttachment = $row.find('img[alt*="attachment"], span:contains("attachment")').length > 0;
    // Extract actionable elements
    email.actions.open = this.extractElement($row.find('a[href*="#inbox"]'));
    email.actions.select = this.extractElement($row.find('input[type="checkbox"]'));
    email.actions.star = this.extractElement($row.find('button[aria-label*="star"]'));
    email.actions.important = this.extractElement($row.find('button[aria-label*="Important"]'));
    return email;
  }

  /**
   * Extract actionable element data
   */
  extractElement($element: any, selector: string | null = null): any {
    const $el = selector ? $element(selector).first() : $element;
    if ($el.length === 0) return null;
    return {
      ref: $el.attr('ref') || this.findClosestRef($el),
      tag: $el.prop('tagName') ? String($el.prop('tagName')).toLowerCase() : '',
      type: $el.attr('type'),
      ariaLabel: $el.attr('aria-label'),
      title: $el.attr('title'),
      text: $el.text().trim().substring(0, 100),
      href: $el.attr('href'),
      value: $el.val ? $el.val() : undefined,
      isDisabled: $el.prop('disabled') || $el.attr('aria-disabled') === 'true'
    };
  }

  /**
   * Find closest element with ref attribute
   */
  findClosestRef($element: any): string | null {
    let current = $element;
    for (let i = 0; i < 10; i++) {
      if (current.attr('ref')) return current.attr('ref');
      current = current.parent();
      if (current.length === 0) break;
    }
    return null;
  }

  /**
   * Extract unread count from navigation elements
   */
  extractUnreadCount($element: any): number {
    const text = $element.text();
    const match = text.match(/(\d+)(?:\s+unread)?$/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Parse pagination text like "1–25 of 1,234"
   */
  parsePaginationText(text: string) {
    const match = text.match(/(\d+)(?:[–-](\d+))?\s+of\s+([\d,]+)/);
    if (!match) return null;
    return {
      start: parseInt(match[1]),
      end: parseInt(match[2] || match[1]),
      total: parseInt(match[3].replace(/,/g, ''))
    };
  }

  /**
   * Extract email sender information
   */
  extractSender($: cheerio.CheerioAPI): any {
    const senderSelectors = [
      '[data-hovercard-id*="@"]',
      'span[email]',
      'span[title*="@"]',
      '.go span[title]'
    ];
    for (const selector of senderSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        return {
          name: element.text().trim(),
          email: element.attr('email') || element.attr('title') || ''
        };
      }
    }
    return { name: '', email: '' };
  }

  /**
   * Extract email recipients
   */
  extractRecipients($: cheerio.CheerioAPI): any[] {
    const recipients: any[] = [];
    $('[data-hovercard-id*="@"], span[email]').each((i, el) => {
      const $el = $(el);
      recipients.push({
        name: $el.text().trim(),
        email: $el.attr('email') || $el.attr('data-hovercard-id') || ''
      });
    });
    return recipients;
  }

  /**
   * Extract email date
   */
  extractEmailDate($: cheerio.CheerioAPI): string {
    const dateSelectors = [
      'span[title*="2025"]',
      'span[title*="2024"]',
      '.g3[title]',
      'td:contains("AM"), td:contains("PM")'
    ];
    for (const selector of dateSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        return element.attr('title') || element.text().trim();
      }
    }
    return '';
  }

  /**
   * Extract email body content
   */
  extractEmailBody($: cheerio.CheerioAPI): string {
    const bodySelectors = [
      'div[dir="ltr"][style*="font-family"]',
      '.ii.gt div',
      '[data-smartmail="gmail_signature"]',
      '.a3s.aiL'
    ];
    for (const selector of bodySelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        return element.text().trim().substring(0, 1000); // Limit body length
      }
    }
    return '';
  }

  /**
   * Extract attachments
   */
  extractAttachments($: cheerio.CheerioAPI): any[] {
    const attachments: any[] = [];
    $('span[download], a[download], .aZo').each((i, el) => {
      const $el = $(el);
      attachments.push({
        name: $el.text().trim() || $el.attr('download'),
        size: $el.siblings().text().match(/\(([^\)]+)\)/)?.[1] || '',
        downloadRef: $el.attr('ref') || this.findClosestRef($el)
      });
    });
    return attachments;
  }

  /**
   * Extract alerts and notifications
   */
  extractAlerts($: cheerio.CheerioAPI): any[] {
    const alerts: any[] = [];
    $('[role="alert"], .vh, .aKz').each((i, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      if (text) {
        alerts.push({
          type: 'info',
          message: text,
          dismissRef: this.extractElement($el.find('button, a')),
          hasUndo: text.toLowerCase().includes('undo')
        });
      }
    });
    return alerts;
  }

  /**
   * Extract all interactive elements for unknown views
   */
  extractAllInteractiveElements($: cheerio.CheerioAPI): any[] {
    const elements: any[] = [];
    $('button, a, input, select, textarea').each((i, el) => {
      const element = this.extractElement($(el));
      if (element && element.ref) {
        elements.push(element);
      }
    });
    return elements.slice(0, 50); // Limit to prevent overflow
  }

  /**
   * Utility function to truncate long responses
   */
  truncateResponse(data: any, maxSize = 50000) {
    const jsonString = JSON.stringify(data, null, 2);
    if (jsonString.length <= maxSize) return data;
    // Truncate emails array if too long
    if (data.emails && data.emails.length > 10) {
      data.emails = data.emails.slice(0, 10);
      data.truncated = { emails: true, originalCount: data.emails.length };
    }
    // Truncate email body if too long
    if (data.email && data.email.body && data.email.body.length > 500) {
      data.email.body = data.email.body.substring(0, 500) + '...';
      data.truncated = { ...data.truncated, body: true };
    }
    return data;
  }
}

// Usage example:
export const parseGmailDOM = (htmlContent: string, url: string) => {
  const parser = new GmailDOMParser();
  const result = parser.parse(htmlContent, url);
  return parser.truncateResponse(result);
};

// Utility: Summarize parsed Gmail DOM result for LLM context
export function summarizeParsedGmailDOM(parsed: any): string {
  if (!parsed) return 'No Gmail data.';
  if (parsed.view === 'inbox' || parsed.view === 'search') {
    if (!parsed.emails || parsed.emails.length === 0) return 'No emails found.';
    return parsed.emails
      .slice(0, 10)
      .map((e: any, i: number) => `${i + 1}. From: ${e.from} | Subject: ${e.subject} | Snippet: ${e.snippet}`)
      .join('\n');
  }
  if (parsed.view === 'email') {
    return `Subject: ${parsed.email.subject}\nFrom: ${typeof parsed.email.from === 'object' ? parsed.email.from.name + ' <' + parsed.email.from.email + '>' : parsed.email.from}\nTo: ${Array.isArray(parsed.email.to) ? parsed.email.to.map((r: any) => r.name || r.email).join(', ') : ''}\nDate: ${parsed.email.date}\nBody: ${parsed.email.body?.substring(0, 300)}`;
  }
  if (parsed.view === 'compose') {
    return 'Gmail compose window is open.';
  }
  return parsed.pageTitle ? `Page: ${parsed.pageTitle}` : 'Unknown Gmail view.';
}

// YAML snapshot summarization (for Stagehand/Browserbase)
export function extractEmailRowsFromYaml(text: string) {
  // Only match rows that look like emails (e.g., have a time, sender, and subject)
  const rowRegex = /- row "([^"]+)" \[ref=([\w\d]+)\]:/g;
  const rows = [];
  let match;
  while ((match = rowRegex.exec(text)) !== null) {
    const details = match[1];
    const ref = match[2];
    // Heuristic: must have at least 4 comma-separated parts and a time/date pattern
    const parts = details.split(',');
    if (
      parts.length >= 4 &&
      /(\d{1,2}:\d{2}\s*(AM|PM)?|Mon|Tue|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(details)
    ) {
      rows.push({ ref, details });
    }
  }
  return rows;
}

export function summarizeYamlSnapshot(text: string) {
  // Extract key lines: alerts, navigation, inbox counts, and any 'Conversation moved to Trash' or similar
  const lines = text.split('\n');
  const summaryLines = [];
  for (const line of lines) {
    if (/alert/.test(line) || /navigation/.test(line) || /Inbox/.test(line) || /unread messages/.test(line) || /Conversation moved to Trash/.test(line) || /Page URL:/.test(line) || /Page Title:/.test(line)) {
      summaryLines.push(line.trim());
    }
    if (summaryLines.length > 10) break;
  }
  // Extract email rows
  const emailRows = extractEmailRowsFromYaml(text);
  let emailSection = '';
  if (emailRows.length) {
    emailSection = '\n# Visible Emails';
    emailRows.slice(0, 10).forEach((row, i) => {
      emailSection += `\n${i + 1}. [ref=${row.ref}] ${row.details}`;
    });
  }
  if (summaryLines.length === 0 && !emailSection) {
    // fallback: show first 3 lines
    return lines.slice(0, 3).join('\n') + '\n... (truncated, summarized)';
  }
  return summaryLines.join('\n') + emailSection + '\n... (summary, summarized)';
}
