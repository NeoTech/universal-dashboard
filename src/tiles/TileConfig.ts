export type TileType =
  // ── Stripe ────────────────────────────────────────────────────────────────
  | 'stripe-payments'
  | 'stripe-orders'
  | 'stripe-products'
  | 'stripe-subscriptions'
  | 'stripe-customers'
  | 'stripe-webhooks'
  | 'stripe-revenue'
  | 'stripe-invoices'
  | 'stripe-refunds'
  // ── PayPal ────────────────────────────────────────────────────────────────
  | 'paypal-transactions'
  // ── WooCommerce ───────────────────────────────────────────────────────────
  | 'woocommerce-orders'
  | 'woocommerce-sales-summary'
  | 'woocommerce-top-sellers'
  // ── Shopify ───────────────────────────────────────────────────────────────
  | 'shopify-orders'
  | 'shopify-products'
  // ── GitHub ────────────────────────────────────────────────────────────────
  | 'github-actions'
  // ── CircleCI ──────────────────────────────────────────────────────────────
  | 'circleci-pipelines'
  | 'circleci-insights'
  // ── Travis CI ─────────────────────────────────────────────────────────────
  | 'travis-builds'
  // ── Bitrise ───────────────────────────────────────────────────────────────
  | 'bitrise-builds'
  // ── SonarQube ─────────────────────────────────────────────────────────────
  | 'sonarqube-quality'
  | 'sonarqube-measures'
  | 'sonarqube-issues'
  // ── Azure DevOps ──────────────────────────────────────────────────────────
  | 'azuredevops-pipelines'
  | 'azuredevops-releases'
  | 'azuredevops-workitems'
  // ── Cloudflare ────────────────────────────────────────────────────────────
  | 'cloudflare-pages'
  | 'cloudflare-functions'
  // ── Vercel ────────────────────────────────────────────────────────────────
  | 'vercel-deployments'
  // ── Netlify ───────────────────────────────────────────────────────────────
  | 'netlify-deployments'
  // ── Docker Hub ────────────────────────────────────────────────────────────
  | 'dockerhub-repositories'
  | 'dockerhub-tags'
  // ── npm Registry ──────────────────────────────────────────────────────────
  | 'npm-downloads'
  | 'npm-metadata'
  // ── jsDelivr ──────────────────────────────────────────────────────────────
  | 'jsdelivr-hits'
  | 'jsdelivr-versions'
  // ── WakaTime ──────────────────────────────────────────────────────────────
  | 'wakatime-summary'
  | 'wakatime-languages'
  | 'wakatime-projects'
  // ── Clockify ──────────────────────────────────────────────────────────────
  | 'clockify-time-entries'
  | 'clockify-projects'
  // ── Linear ────────────────────────────────────────────────────────────────
  | 'linear-issues'
  | 'linear-cycles'
  | 'linear-teams'
  // ── Jira ──────────────────────────────────────────────────────────────────
  | 'jira-issues'
  | 'jira-sprint'
  | 'jira-projects'
  // ── Slack ─────────────────────────────────────────────────────────────────
  | 'slack-messages'
  | 'slack-workspace-stats'
  // ── Discord ───────────────────────────────────────────────────────────────
  | 'discord-server-stats'
  | 'discord-channels'
  // ── Mailchimp ─────────────────────────────────────────────────────────────
  | 'mailchimp-campaigns'
  | 'mailchimp-audience'
  // ── Google Analytics 4 ────────────────────────────────────────────────────
  | 'ga4-sessions-trend'
  | 'ga4-top-pages'
  | 'ga4-traffic-sources'
  // ── Instatus ──────────────────────────────────────────────────────────────
  | 'instatus-overview'
  | 'instatus-incidents'
  // ── HackerNews ────────────────────────────────────────────────────────────
  | 'hn-top-stories'
  | 'hn-mentions'
  // ── Alpha Vantage ─────────────────────────────────────────────────────────
  | 'alphavantage-quotes'
  | 'alphavantage-sparklines'
  | 'alphavantage-market-status'
  | 'alphavantage-market-movers'
  | 'alphavantage-news-sentiment'
  | 'alphavantage-earnings'
  | 'alphavantage-earnings-calendar'
  | 'alphavantage-fundamentals'
  | 'alphavantage-forex-rates'  | 'alphavantage-commodities'
  | 'alphavantage-economic-indicators'
  | 'alphavantage-insider-transactions'  // ── CoinGecko ─────────────────────────────────────────────────────────────────
  | 'coingecko-prices'
  | 'coingecko-global'
  | 'coingecko-markets'  | 'coingecko-trending'
  | 'coingecko-price-chart'
  | 'coingecko-defi-overview'
  | 'coingecko-categories'
  | 'coingecko-exchanges'
  | 'coingecko-coin-detail'  // ── Finnhub ───────────────────────────────────────────────────────────────
  | 'finnhub-quotes'
  | 'finnhub-news'
  | 'finnhub-company-news'
  | 'finnhub-market-news'
  | 'finnhub-earnings-calendar'
  | 'finnhub-earnings-surprises'
  | 'finnhub-analyst-consensus'
  | 'finnhub-fundamentals'
  | 'finnhub-market-status'
  | 'finnhub-insider-transactions'
  | 'finnhub-insider-sentiment'
  | 'finnhub-ipo-calendar'
  | 'finnhub-sec-filings'
  | 'finnhub-company-profile'
  // ── Plaid ─────────────────────────────────────────────────────────────────
  | 'plaid-balances'
  | 'plaid-transactions'
  | 'plaid-accounts'
  | 'plaid-investment-portfolio'
  | 'plaid-investment-transactions'
  | 'plaid-liabilities-overview'
  | 'plaid-credit-card-details'
  | 'plaid-mortgage-tracker'
  | 'plaid-statements'
  // ── HIBP ──────────────────────────────────────────────────────────────────
  | 'hibp-breach-status'
  | 'hibp-recent-breaches'
  | 'hibp-email-breaches'
  // ── VirusTotal ────────────────────────────────────────────────────────────
  | 'virustotal-domain-threats'
  | 'virustotal-url-scan'
  | 'virustotal-domain-scan'
  // ── Shodan ────────────────────────────────────────────────────────────────
  | 'shodan-exposed-services'
  | 'shodan-vuln-summary'
  | 'shodan-exposed-assets'
  // ── Reddit ────────────────────────────────────────────────────────────────
  | 'reddit-hot-posts'
  | 'reddit-keyword-monitor'
  | 'reddit-posts'
  // ── Product Hunt ──────────────────────────────────────────────────────────
  | 'producthunt-top-launches'
  // ── Generic ───────────────────────────────────────────────────────────────
  | 'rss-feed'
  | 'rest'
  | 'websocket'
  | 'custom-api'
  | 'graphql';

export interface RssTileConfig {
  url: string;
  maxItems?: number;
}

export interface RestTileConfig {
  url: string;
  headers?: Record<string, string>;
  refreshInterval?: number;
  displayMode?: 'table' | 'json' | 'text';
  /** Dot-path field to extract numeric values for chart visualisation, e.g. "price" */
  chartField?: string;
  chartType?: 'line' | 'bar' | 'candle';
}

export interface CustomApiTileConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  displayMode?: 'table' | 'json' | 'text' | 'key-value';
  /** Dot-path into the response to extract, e.g. "data.users" */
  dataPath?: string;
  refreshInterval?: number;
}

export interface GraphqlTileConfig {
  url: string;
  query: string;
  /** JSON string of GraphQL variables, e.g. `{"id": 42}` */
  variables?: string;
  /** Dot-path into the response to extract, e.g. "data.users" */
  dataPath?: string;
  headers?: Record<string, string>;
  refreshInterval?: number;
  displayMode?: 'table' | 'json' | 'text';
}

export interface WsTileConfig {
  url: string;
  maxMessages?: number;
  /**
   * Comma-separated dot-path field names to extract from each message and
   * display as table columns, e.g. `"s,p,q"` for Binance trade events.
   * When omitted the raw JSON is shown.
   */
  fields?: string;
  /**
   * Comma-separated column header labels matching the `fields` list.
   * Falls back to the raw path name when omitted.
   */
  fieldLabels?: string;
  /** Dot-path field to extract numeric values for chart visualisation, e.g. "p" */
  chartField?: string;
  chartType?: 'line' | 'bar' | 'candle';
  /** Maximum number of data points kept in the chart buffer (default 500). Persisted to sessionStorage. */
  chartBufferMaxPoints?: number;
}

export interface TileConfig {
  id: string;
  type: TileType;
  title?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  refreshInterval?: number;
  /**
   * Number of rows displayed per page in the pagination bar.
   * Defaults to PAGE_SIZE (10) when not set.
   */
  pageSize?: number;
  /**
   * Maximum total items made available for pagination.
   * The server may return more data than this; this caps what the user sees.
   * Useful to limit a 50-row server response to, say, 20 rows across 2 pages.
   * Defaults to all available items when not set.
   */
  fetchLimit?: number;
  /**
   * Whether to show an "Updated X ago" footer in the tile.
   * Defaults to true. Set to false to hide it.
   */
  showLastUpdated?: boolean;
  /**
   * Display density for the tile.
   * - 'compact'  — fewer columns, no row-click drawer, no pagination bar.
   * - 'detailed' — full columns, row-click drawer/actions, pagination (default).
   */
  displayMode?: 'compact' | 'detailed';
  /**
   * Environment variables that must be configured for this tile's data source
   * to function. Populated by the server's `env-status` SSE channel when the
   * corresponding poller was skipped due to missing configuration.
   * Not persisted — derived at runtime.
   */
  missingEnvVars?: string[];
  /** RSS feed config (type === 'rss-feed') */
  rss?: RssTileConfig;
  /** REST source config (type === 'rest') */
  rest?: RestTileConfig;
  /** WebSocket source config (type === 'websocket') */
  ws?: WsTileConfig;
  /** Custom API config (type === 'custom-api') */
  customApi?: CustomApiTileConfig;
  /** GraphQL config (type === 'graphql') */
  graphql?: GraphqlTileConfig;
  /**
   * Comma-separated keywords used by the reddit-keyword-monitor tile to
   * filter and highlight matching posts. Falls back to a prompt to configure
   * when empty.
   */
  keywords?: string;
  /**
   * Delivery mode for supported provider tiles.
   * - 'poll'    — server polls the provider API on a schedule (default).
   * - 'webhook' — server receives push events from the provider webhook;
   *               polling is suspended for this channel.
   * Only applicable to tile types listed in WEBHOOK_CAPABLE.
   */
  deliveryMode?: 'poll' | 'webhook';
}

export const TILE_DEFAULTS: Record<TileType, Partial<TileConfig>> = {
  // ── Stripe ────────────────────────────────────────────────────────────────
  'stripe-payments':           { w: 480, h: 320, title: 'Recent Payments' },
  'stripe-orders':             { w: 480, h: 280, title: 'Stripe Orders' },
  'stripe-products':           { w: 400, h: 360, title: 'Products' },
  'stripe-subscriptions':      { w: 400, h: 280, title: 'Subscriptions' },
  'stripe-customers':          { w: 480, h: 280, title: 'Stripe Customers' },
  'stripe-webhooks':           { w: 480, h: 300, title: 'Webhook Events' },
  'stripe-revenue':            { w: 480, h: 200, title: 'Revenue (30 days)' },
  'stripe-invoices':           { w: 480, h: 320, title: 'Invoices' },
  'stripe-refunds':            { w: 400, h: 280, title: 'Refunds' },
  // ── PayPal ────────────────────────────────────────────────────────────────
  'paypal-transactions':       { w: 480, h: 320, title: 'PayPal Transactions' },
  // ── WooCommerce ───────────────────────────────────────────────────────────
  'woocommerce-orders':        { w: 480, h: 320, title: 'WooCommerce Orders' },
  'woocommerce-sales-summary': { w: 400, h: 240, title: 'Sales Summary' },
  'woocommerce-top-sellers':   { w: 440, h: 300, title: 'Top Sellers' },
  // ── Shopify ───────────────────────────────────────────────────────────────
  'shopify-orders':            { w: 480, h: 320, title: 'Shopify Orders' },
  'shopify-products':          { w: 400, h: 320, title: 'Shopify Products' },
  // ── GitHub ────────────────────────────────────────────────────────────────
  'github-actions':            { w: 560, h: 320, title: 'Workflow Runs' },
  // ── CircleCI ──────────────────────────────────────────────────────────────
  'circleci-pipelines':        { w: 560, h: 320, title: 'CircleCI Pipelines' },
  'circleci-insights':         { w: 480, h: 280, title: 'CircleCI Insights' },
  // ── Travis CI ─────────────────────────────────────────────────────────────
  'travis-builds':             { w: 480, h: 300, title: 'Travis CI Builds' },
  // ── Bitrise ───────────────────────────────────────────────────────────────
  'bitrise-builds':            { w: 480, h: 300, title: 'Bitrise Builds' },
  // ── SonarQube ─────────────────────────────────────────────────────────────
  'sonarqube-quality':         { w: 400, h: 320, title: 'Code Quality Gates' },
  'sonarqube-measures':        { w: 480, h: 280, title: 'Code Measures' },
  'sonarqube-issues':          { w: 480, h: 320, title: 'SonarQube Issues' },
  // ── Azure DevOps ──────────────────────────────────────────────────────────
  'azuredevops-pipelines':     { w: 560, h: 320, title: 'Azure Pipelines' },
  'azuredevops-releases':      { w: 480, h: 300, title: 'Azure Releases' },
  'azuredevops-workitems':     { w: 480, h: 320, title: 'Work Items' },
  // ── Cloudflare ────────────────────────────────────────────────────────────
  'cloudflare-pages':          { w: 480, h: 300, title: 'Cloudflare Pages' },
  'cloudflare-functions':      { w: 400, h: 280, title: 'Cloudflare Workers' },
  // ── Vercel ────────────────────────────────────────────────────────────────
  'vercel-deployments':        { w: 400, h: 260, title: 'Vercel Deployments' },
  // ── Netlify ───────────────────────────────────────────────────────────────
  'netlify-deployments':       { w: 400, h: 260, title: 'Netlify Deployments' },
  // ── Docker Hub ────────────────────────────────────────────────────────────
  'dockerhub-repositories':    { w: 480, h: 320, title: 'Docker Repositories' },
  'dockerhub-tags':            { w: 400, h: 280, title: 'Docker Image Tags' },
  // ── npm Registry ──────────────────────────────────────────────────────────
  'npm-downloads':             { w: 480, h: 280, title: 'npm Downloads' },
  'npm-metadata':              { w: 400, h: 280, title: 'npm Packages' },
  // ── jsDelivr ──────────────────────────────────────────────────────────────
  'jsdelivr-hits':             { w: 480, h: 280, title: 'jsDelivr CDN Hits' },
  'jsdelivr-versions':         { w: 400, h: 260, title: 'jsDelivr Versions' },
  // ── WakaTime ──────────────────────────────────────────────────────────────
  'wakatime-summary':          { w: 400, h: 300, title: 'Coding Time' },
  'wakatime-languages':        { w: 480, h: 280, title: 'Languages Breakdown' },
  'wakatime-projects':         { w: 400, h: 280, title: 'Projects (WakaTime)' },
  // ── Clockify ──────────────────────────────────────────────────────────────
  'clockify-time-entries':     { w: 480, h: 320, title: 'Time Entries' },
  'clockify-projects':         { w: 400, h: 280, title: 'Clockify Projects' },
  // ── Linear ────────────────────────────────────────────────────────────────
  'linear-issues':             { w: 480, h: 320, title: 'Linear Issues' },
  'linear-cycles':             { w: 400, h: 240, title: 'Linear Cycles' },
  'linear-teams':              { w: 400, h: 240, title: 'Linear Teams' },
  // ── Jira ──────────────────────────────────────────────────────────────────
  'jira-issues':               { w: 560, h: 320, title: 'Jira Issues' },
  'jira-sprint':               { w: 480, h: 280, title: 'Sprint Board' },
  'jira-projects':             { w: 400, h: 280, title: 'Jira Projects' },
  // ── Slack ─────────────────────────────────────────────────────────────────
  'slack-messages':            { w: 480, h: 320, title: 'Slack Messages' },
  'slack-workspace-stats':     { w: 400, h: 240, title: 'Slack Workspace' },
  // ── Discord ───────────────────────────────────────────────────────────────
  'discord-server-stats':      { w: 400, h: 240, title: 'Discord Server' },
  'discord-channels':          { w: 400, h: 280, title: 'Discord Channels' },
  // ── Mailchimp ─────────────────────────────────────────────────────────────
  'mailchimp-campaigns':       { w: 480, h: 320, title: 'Mailchimp Campaigns' },
  'mailchimp-audience':        { w: 400, h: 240, title: 'Audience Overview' },
  // ── Google Analytics 4 ────────────────────────────────────────────────────
  'ga4-sessions-trend':        { w: 480, h: 300, title: 'Sessions Trend' },
  'ga4-top-pages':             { w: 480, h: 320, title: 'Top Pages' },
  'ga4-traffic-sources':       { w: 400, h: 280, title: 'Traffic Sources' },
  // ── Instatus ──────────────────────────────────────────────────────────────
  'instatus-overview':         { w: 400, h: 280, title: 'Instatus Overview' },
  'instatus-incidents':        { w: 480, h: 320, title: 'Incidents' },
  // ── HackerNews ────────────────────────────────────────────────────────────
  'hn-top-stories':            { w: 480, h: 360, title: 'HN Top Stories' },
  'hn-mentions':               { w: 480, h: 320, title: 'HN Mentions' },
  // ── Alpha Vantage ─────────────────────────────────────────────────────────
  'alphavantage-quotes':       { w: 400, h: 280, title: 'Stock Quotes' },
  'alphavantage-sparklines':   { w: 480, h: 280, title: 'Stock Sparklines' },
  'alphavantage-market-status':    { w: 560, h: 320, title: 'Market Status' },
  'alphavantage-market-movers':    { w: 480, h: 360, title: 'Market Movers' },
  'alphavantage-news-sentiment':   { w: 480, h: 360, title: 'Market Sentiment' },
  'alphavantage-earnings':         { w: 480, h: 320, title: 'EPS Earnings' },
  'alphavantage-earnings-calendar': { w: 560, h: 360, title: 'Earnings Calendar' },
  'alphavantage-fundamentals':     { w: 480, h: 360, title: 'Stock Fundamentals' },
  'alphavantage-forex-rates':      { w: 560, h: 280, title: 'Forex Rates' },  'alphavantage-commodities':      { w: 480, h: 320, title: 'Commodities' },
  'alphavantage-economic-indicators': { w: 560, h: 360, title: 'Economic Indicators' },
  'alphavantage-insider-transactions': { w: 480, h: 320, title: 'Insider Activity' },  // ── CoinGecko ─────────────────────────────────────────────────────────────────
  'coingecko-prices':          { w: 480, h: 320, title: 'Crypto Prices' },
  'coingecko-global':          { w: 400, h: 240, title: 'Crypto Market' },
  'coingecko-markets':         { w: 480, h: 360, title: 'Crypto Markets' },  'coingecko-trending':        { w: 480, h: 320, title: 'Trending Coins' },
  'coingecko-price-chart':     { w: 400, h: 280, title: 'Price Chart' },
  'coingecko-defi-overview':   { w: 480, h: 280, title: 'DeFi Overview' },
  'coingecko-categories':      { w: 480, h: 360, title: 'Coin Categories' },
  'coingecko-exchanges':       { w: 480, h: 360, title: 'Crypto Exchanges' },
  'coingecko-coin-detail':     { w: 400, h: 360, title: 'Coin Detail' },  // ── Finnhub ───────────────────────────────────────────────────────────────
  'finnhub-quotes':            { w: 400, h: 280, title: 'Market Quotes' },
  'finnhub-news':              { w: 480, h: 360, title: 'Financial News' },
  'finnhub-company-news':      { w: 480, h: 360, title: 'Company News' },
  'finnhub-market-news':       { w: 480, h: 360, title: 'Market News' },
  'finnhub-earnings-calendar': { w: 480, h: 360, title: 'Earnings Calendar' },
  'finnhub-earnings-surprises': { w: 480, h: 320, title: 'Earnings Surprises' },
  'finnhub-analyst-consensus': { w: 480, h: 320, title: 'Analyst Consensus' },
  'finnhub-fundamentals':      { w: 400, h: 360, title: 'Stock Fundamentals' },
  'finnhub-market-status':     { w: 480, h: 280, title: 'Market Status' },
  'finnhub-insider-transactions': { w: 480, h: 360, title: 'Insider Transactions' },
  'finnhub-insider-sentiment': { w: 400, h: 320, title: 'Insider Sentiment' },
  'finnhub-ipo-calendar':      { w: 560, h: 360, title: 'IPO Calendar' },
  'finnhub-sec-filings':       { w: 480, h: 320, title: 'SEC Filings' },
  'finnhub-company-profile':   { w: 400, h: 320, title: 'Company Profile' },
  // ── Plaid ─────────────────────────────────────────────────────────────────
  'plaid-balances':                    { w: 400, h: 280, title: 'Account Balances' },
  'plaid-transactions':                { w: 480, h: 360, title: 'Bank Transactions' },
  'plaid-accounts':                    { w: 400, h: 280, title: 'Bank Accounts' },
  'plaid-investment-portfolio':        { w: 560, h: 360, title: 'Investment Portfolio' },
  'plaid-investment-transactions':     { w: 480, h: 360, title: 'Investment Transactions' },
  'plaid-liabilities-overview':        { w: 480, h: 320, title: 'Liabilities Overview' },
  'plaid-credit-card-details':         { w: 480, h: 360, title: 'Credit Card Details' },
  'plaid-mortgage-tracker':            { w: 480, h: 360, title: 'Mortgage Tracker' },
  'plaid-statements':                  { w: 400, h: 320, title: 'Statements' },
  // ── HIBP ──────────────────────────────────────────────────────────────────
  'hibp-breach-status':        { w: 400, h: 280, title: 'Breach Status' },
  'hibp-recent-breaches':      { w: 480, h: 320, title: 'Recent Breaches' },
  'hibp-email-breaches':       { w: 480, h: 360, title: 'Email Breaches' },
  // ── VirusTotal ────────────────────────────────────────────────────────────
  'virustotal-domain-threats': { w: 480, h: 320, title: 'Domain Threats' },
  'virustotal-url-scan':       { w: 400, h: 280, title: 'URL Scanner' },
  'virustotal-domain-scan':    { w: 480, h: 360, title: 'Domain Scan' },
  // ── Shodan ────────────────────────────────────────────────────────────────
  'shodan-exposed-services':   { w: 480, h: 320, title: 'Exposed Services' },
  'shodan-vuln-summary':       { w: 400, h: 280, title: 'Vuln Summary' },
  'shodan-exposed-assets':     { w: 480, h: 360, title: 'Exposed Assets' },
  // ── Reddit ────────────────────────────────────────────────────────────────
  'reddit-hot-posts':          { w: 480, h: 360, title: 'Reddit Hot Posts' },
  'reddit-keyword-monitor':    { w: 480, h: 320, title: 'Keyword Monitor' },
  'reddit-posts':              { w: 480, h: 360, title: 'Reddit Posts' },
  // ── Product Hunt ──────────────────────────────────────────────────────────
  'producthunt-top-launches':  { w: 480, h: 360, title: 'PH Top Launches' },
  // ── Generic ───────────────────────────────────────────────────────────────
  'rss-feed':                  { w: 480, h: 360, title: 'RSS Feed' },
  'rest':                      { w: 400, h: 300, title: 'REST Source' },
  'websocket':                 { w: 400, h: 300, title: 'WebSocket Stream' },
  'custom-api':                { w: 480, h: 320, title: 'Custom API' },
  'graphql':                   { w: 480, h: 360, title: 'GraphQL' },
};

/**
 * Default server-side poll interval (ms) for each tile type.
 * Used by the titlebar countdown ring; tiles without an entry fall back to 60 000 ms.
 */
export const TILE_POLL_MS: Partial<Record<TileType, number>> = {
  // Stripe
  'stripe-payments':        30_000,
  'stripe-orders':          30_000,
  'stripe-refunds':         30_000,
  'stripe-webhooks':        30_000,
  'stripe-products':        60_000,
  'stripe-subscriptions':   60_000,
  'stripe-customers':       60_000,
  'stripe-invoices':        60_000,
  'stripe-revenue':         300_000,
  // PayPal
  'paypal-transactions':    60_000,
  // Deployments
  'vercel-deployments':     30_000,
  'netlify-deployments':    30_000,
  // CI / Build
  'github-actions':         30_000,
  'circleci-pipelines':     60_000,
  'circleci-insights':      60_000,
  'travis-builds':          60_000,
  'bitrise-builds':         60_000,
  'dockerhub-repositories': 300_000,
  'sonarqube-quality':      120_000,
  'sonarqube-measures':     120_000,
  'sonarqube-issues':       120_000,
  'azuredevops-pipelines':  60_000,
  'azuredevops-releases':   60_000,
  'azuredevops-workitems':  120_000,
  'cloudflare-pages':       60_000,
  'cloudflare-functions':   120_000,
  // Package / CDN
  'npm-downloads':          3_600_000,
  'npm-metadata':           3_600_000,
  'jsdelivr-hits':          3_600_000,
  'jsdelivr-versions':      3_600_000,
  // Productivity
  'wakatime-summary':       300_000,
  'wakatime-languages':     300_000,
  'wakatime-projects':      300_000,
  'clockify-time-entries':  300_000,
  'clockify-projects':      300_000,
  'linear-issues':          120_000,
  'linear-cycles':          300_000,
  'linear-teams':           300_000,
  'jira-issues':            120_000,
  'jira-sprint':            300_000,
  'jira-projects':          300_000,
  // Comms
  'slack-messages':         30_000,
  'slack-workspace-stats':  600_000,
  'discord-server-stats':   300_000,
  'discord-channels':       120_000,
  'mailchimp-campaigns':    300_000,
  'mailchimp-audience':     3_600_000,
  // Analytics
  'ga4-sessions-trend':     3_600_000,
  'ga4-top-pages':          300_000,
  'ga4-traffic-sources':    300_000,
  'instatus-overview':      120_000,
  'instatus-incidents':     120_000,
  'hn-top-stories':         300_000,
  'hn-mentions':            300_000,
  // Finance
  'alphavantage-quotes':    3_600_000,
  'alphavantage-sparklines': 3_600_000,
  'alphavantage-market-status': 900_000,
  'alphavantage-market-movers': 900_000,
  'alphavantage-news-sentiment': 3_600_000,
  'alphavantage-earnings': 21_600_000,
  'alphavantage-earnings-calendar': 86_400_000,
  'alphavantage-fundamentals': 21_600_000,
  'alphavantage-forex-rates': 3_600_000,
  'alphavantage-commodities': 21_600_000,
  'alphavantage-economic-indicators': 86_400_000,
  'alphavantage-insider-transactions': 86_400_000,
  'coingecko-prices':       300_000,
  'coingecko-global':       600_000,
  'coingecko-markets':      300_000,
  'coingecko-trending':     900_000,
  'coingecko-price-chart':  600_000,
  'coingecko-defi-overview': 600_000,
  'coingecko-categories':   1_800_000,
  'coingecko-exchanges':    1_800_000,
  'coingecko-coin-detail':  300_000,
  'finnhub-quotes':              60_000,
  'finnhub-news':               300_000,
  'finnhub-company-news':       300_000,
  'finnhub-market-news':        300_000,
  'finnhub-earnings-calendar': 3_600_000,
  'finnhub-earnings-surprises': 3_600_000,
  'finnhub-analyst-consensus':  3_600_000,
  'finnhub-fundamentals':       3_600_000,
  'finnhub-market-status':      300_000,
  'finnhub-insider-transactions': 3_600_000,
  'finnhub-insider-sentiment':  3_600_000,
  'finnhub-ipo-calendar':       3_600_000,
  'finnhub-sec-filings':        3_600_000,
  'finnhub-company-profile':    21_600_000,
  'plaid-accounts':                    300_000,
  'plaid-balances':                    300_000,
  'plaid-transactions':                300_000,
  'plaid-investment-portfolio':        600_000,
  'plaid-investment-transactions':     600_000,
  'plaid-liabilities-overview':        1_800_000,
  'plaid-credit-card-details':         1_800_000,
  'plaid-mortgage-tracker':            3_600_000,
  'plaid-statements':                  3_600_000,
  // Security
  'hibp-breach-status':     21_600_000,
  'hibp-recent-breaches':   86_400_000,
  'hibp-email-breaches':    86_400_000,
  'virustotal-domain-threats': 86_400_000,
  'virustotal-url-scan':    3_600_000,
  'virustotal-domain-scan': 3_600_000,
  'shodan-exposed-services': 3_600_000,
  'shodan-vuln-summary':    3_600_000,
  'shodan-exposed-assets':  3_600_000,
  // E-commerce
  'woocommerce-orders':        120_000,
  'woocommerce-sales-summary': 600_000,
  'woocommerce-top-sellers':   1_800_000,
  'shopify-orders':            120_000,
  'shopify-products':          600_000,
  // Social
  'reddit-hot-posts':        300_000,
  'reddit-keyword-monitor':  300_000,
  'reddit-posts':           300_000,
  'producthunt-top-launches': 3_600_000,
  // Generic
  'rss-feed':               300_000,
};

/** Snap a pixel value to the nearest grid unit */
export function snap(v: number, grid = 16): number {
  return Math.round(v / grid) * grid;
}

/**
 * Maps tile types to their SSE event/channel name.
 * Only lists the cases where they differ from the tile type string.
 * All other tile types use their own type string as the channel name.
 */
export const TILE_SSE_CHANNEL: Partial<Record<TileType, string>> = {
  'github-actions':          'github-runs',
  'cloudflare-pages':        'cf-pages',
  'cloudflare-functions':    'cf-workers',
  'stripe-orders':           'stripe-payments',
  'paypal-transactions':     'paypal-data',
  'coingecko-prices':        'coingecko-markets',
  // Both UI-facing Reddit tile types share the same 'reddit-posts' SSE feed.
  'reddit-hot-posts':        'reddit-posts',
  'reddit-keyword-monitor':  'reddit-posts',
};

/**
 * Tile types that support webhook-based push delivery as an alternative to
 * the default poll mode. When a tile's deliveryMode is 'webhook', polling is
 * suspended and the server instead receives events via POST /api/webhooks/<provider>.
 */
export const WEBHOOK_CAPABLE = new Set<TileType>([
  'stripe-payments',
  'stripe-orders',
  'stripe-subscriptions',
  'stripe-webhooks',
  'github-actions',
  'paypal-transactions',
  'vercel-deployments',
  'netlify-deployments',
]);

/**
 * Maps webhook-capable tile types to their provider identifier used in the
 * POST /api/webhooks/<provider> endpoint URL.
 */
export const WEBHOOK_PROVIDER: Partial<Record<TileType, string>> = {
  'stripe-payments':     'stripe',
  'stripe-orders':       'stripe',
  'stripe-subscriptions':'stripe',
  'stripe-webhooks':     'stripe',
  'github-actions':      'github',
  'paypal-transactions': 'paypal',
  'vercel-deployments':  'vercel',
  'netlify-deployments': 'netlify',
};

/** Create a new TileConfig with sensible defaults */
export function makeTile(type: TileType, overrides: Partial<TileConfig> = {}): TileConfig {
  const defaults = TILE_DEFAULTS[type] ?? {};
  return {
    id: crypto.randomUUID(),
    type,
    w: snap(overrides.w ?? defaults.w ?? 400),
    h: snap(overrides.h ?? defaults.h ?? 300),
    title: overrides.title ?? defaults.title,
    ...overrides,
    // snap is always applied last so x/y are grid-aligned regardless of override
    x: snap(overrides.x ?? 0),
    y: snap(overrides.y ?? 0),
  };
}
