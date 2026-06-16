#!/usr/bin/env node

import { argv } from 'node:process';

// Color helper using standard ANSI escape codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Bright foreground colors
  brightBlack: '\x1b[90m',
  brightBlue: '\x1b[94m',
  brightCyan: '\x1b[96m',
};

// Help menu content
const HELP_TEXT = `
${colors.bold}${colors.brightBlue}Google News CLI${colors.reset} - Get the latest news directly in your terminal

${colors.bold}Usage:${colors.reset}
  gnews [options]

${colors.bold}Options:${colors.reset}
  -s, --search <query>   Search Google News for specific keywords
  -t, --topic <topic>     Filter headlines by topic:
                          ${colors.dim}world, nation, business, technology, entertainment, sports, science, health${colors.reset}
  -l, --limit <number>    Limit the number of headlines shown (default: 10)
  -h, --help              Show this help menu

${colors.bold}Examples:${colors.reset}
  node index.js
  node index.js --topic technology
  node index.js --search "artificial intelligence" --limit 5
`;

// Helper to convert date string to relative time
function getRelativeTime(dateString) {
  try {
    const now = new Date();
    const past = new Date(dateString);
    if (isNaN(past.getTime())) return dateString;
    
    const elapsed = now - past;
    const msPerMinute = 60 * 1000;
    const msPerHour = msPerMinute * 60;
    const msPerDay = msPerHour * 24;
    
    if (elapsed < msPerMinute) {
      return 'just now';
    } else if (elapsed < msPerHour) {
      const mins = Math.round(elapsed / msPerMinute);
      return `${mins}m ago`;
    } else if (elapsed < msPerDay) {
      const hours = Math.round(elapsed / msPerHour);
      return `${hours}h ago`;
    } else {
      const days = Math.round(elapsed / msPerDay);
      return `${days}d ago`;
    }
  } catch {
    return dateString;
  }
}

// Parses Google News RSS XML
function parseRSS(xmlText) {
  const items = [];
  const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g);
  
  for (const match of itemMatches) {
    const itemContent = match[1];
    
    const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
    const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const sourceMatch = itemContent.match(/<source[^>]*>([\s\S]*?)<\/source>/);
    
    // Clean helper to strip CDATA and common HTML entities
    const clean = (str) => {
      if (!str) return '';
      return str
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .trim();
    };

    let fullTitle = clean(titleMatch ? titleMatch[1] : '');
    const source = clean(sourceMatch ? sourceMatch[1] : '');
    
    // Google News RSS titles usually end with " - Source Name".
    // Let's strip the source name from the title if it's there to keep it clean.
    let title = fullTitle;
    if (source && title.endsWith(` - ${source}`)) {
      title = title.substring(0, title.length - ` - ${source}`.length);
    }

    items.push({
      title,
      link: clean(linkMatch ? linkMatch[1] : ''),
      pubDate: clean(pubDateMatch ? pubDateMatch[1] : ''),
      source: source || 'Unknown Source',
    });
  }
  
  return items;
}

// Simple arguments parser
function parseArgs() {
  const args = {
    search: null,
    topic: null,
    limit: 10,
    help: false
  };
  
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      args.help = true;
    } else if (arg === '-s' || arg === '--search') {
      args.search = argv[++i] || null;
    } else if (arg === '-t' || arg === '--topic') {
      args.topic = argv[++i] || null;
    } else if (arg === '-l' || arg === '--limit') {
      const val = parseInt(argv[++i], 10);
      if (!isNaN(val) && val > 0) {
        args.limit = val;
      }
    }
  }
  
  return args;
}

async function main() {
  const args = parseArgs();
  
  if (args.help) {
    console.log(HELP_TEXT);
    return;
  }
  
  // Construct Feed URL
  let feedUrl = 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en';
  let feedTitle = 'Top Headlines';
  
  if (args.search) {
    const query = encodeURIComponent(args.search);
    feedUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
    feedTitle = `Search Results for "${args.search}"`;
  } else if (args.topic) {
    const validTopics = ['world', 'nation', 'business', 'technology', 'entertainment', 'sports', 'science', 'health'];
    const selectedTopic = args.topic.toLowerCase();
    
    if (!validTopics.includes(selectedTopic)) {
      console.error(`${colors.red}Error: Invalid topic "${args.topic}".${colors.reset}`);
      console.error(`Valid topics are: ${validTopics.join(', ')}`);
      return;
    }
    
    feedUrl = `https://news.google.com/rss/headlines/section/topic/${selectedTopic.toUpperCase()}?hl=en-US&gl=US&ceid=US:en`;
    feedTitle = `${selectedTopic.charAt(0).toUpperCase() + selectedTopic.slice(1)} News`;
  }
  
  // Render Banner
  console.log(`\n${colors.bold}${colors.brightBlue}┌────────────────────────────────────────────────────────┐`);
  console.log(`│                    GOOGLE NEWS CLI                     │`);
  console.log(`└────────────────────────────────────────────────────────┘${colors.reset}`);
  console.log(`${colors.dim}Feed: ${colors.reset}${colors.bold}${feedTitle}${colors.reset}`);
  console.log(`${colors.dim}Fetching feed...${colors.reset}\n`);
  
  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const xmlText = await response.text();
    const articles = parseRSS(xmlText);
    
    if (articles.length === 0) {
      console.log(`${colors.yellow}No articles found.${colors.reset}\n`);
      return;
    }
    
    const displayedArticles = articles.slice(0, args.limit);
    
    displayedArticles.forEach((article, index) => {
      const num = `${index + 1}.`.padEnd(4);
      const relativeTime = getRelativeTime(article.pubDate);
      
      console.log(`${colors.bold}${colors.brightCyan}${num}${colors.reset}${colors.bold}${article.title}${colors.reset}`);
      console.log(`    ${colors.green}${article.source}${colors.reset} ${colors.dim}• ${relativeTime}${colors.reset}`);
      console.log(`    ${colors.dim}${colors.underline}${article.link}${colors.reset}\n`);
    });
    
    if (articles.length > args.limit) {
      console.log(`${colors.dim}Showing ${args.limit} of ${articles.length} articles. Run with --limit <num> to see more.${colors.reset}\n`);
    }
    
  } catch (error) {
    console.error(`${colors.red}Error fetching or parsing news feed:${colors.reset}`, error.message);
    console.log();
  }
}

main();
