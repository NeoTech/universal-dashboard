# TWM Tile Types — Complete Reference

## Provider Tiles (134 types)

### Payments & E-Commerce
| Provider | Tile Types |
|---|---|
| **Stripe** | `stripe-payments`, `stripe-orders`, `stripe-products`, `stripe-subscriptions`, `stripe-customers`, `stripe-webhooks`, `stripe-revenue`, `stripe-invoices`, `stripe-refunds` |
| **PayPal** | `paypal-transactions` |
| **WooCommerce** | `woocommerce-orders`, `woocommerce-sales-summary`, `woocommerce-top-sellers` |
| **Shopify** | `shopify-orders`, `shopify-products` |

### CI/CD & DevOps
| Provider | Tile Types |
|---|---|
| **GitHub** | `github-actions` |
| **CircleCI** | `circleci-pipelines`, `circleci-insights` |
| **Travis CI** | `travis-builds` |
| **Bitrise** | `bitrise-builds` |
| **Azure DevOps** | `azuredevops-pipelines`, `azuredevops-releases`, `azuredevops-workitems` |
| **SonarQube** | `sonarqube-quality`, `sonarqube-measures`, `sonarqube-issues` |

### Hosting & Infrastructure
| Provider | Tile Types |
|---|---|
| **Cloudflare** | `cloudflare-pages`, `cloudflare-functions` |
| **Vercel** | `vercel-deployments` |
| **Netlify** | `netlify-deployments` |
| **Docker Hub** | `dockerhub-repositories`, `dockerhub-tags` |

### Package Registries
| Provider | Tile Types |
|---|---|
| **npm** | `npm-downloads`, `npm-metadata` |
| **jsDelivr** | `jsdelivr-hits`, `jsdelivr-versions` |

### Time Tracking & Project Management
| Provider | Tile Types |
|---|---|
| **WakaTime** | `wakatime-summary`, `wakatime-languages`, `wakatime-projects` |
| **Clockify** | `clockify-time-entries`, `clockify-projects` |
| **Linear** | `linear-issues`, `linear-cycles`, `linear-teams` |
| **Jira** | `jira-issues`, `jira-sprint`, `jira-projects` |

### Communication
| Provider | Tile Types |
|---|---|
| **Slack** | `slack-messages`, `slack-workspace-stats` |
| **Discord** | `discord-server-stats`, `discord-channels` |
| **Mailchimp** | `mailchimp-campaigns`, `mailchimp-audience` |

### Analytics & Monitoring
| Provider | Tile Types |
|---|---|
| **Google Analytics 4** | `ga4-sessions-trend`, `ga4-top-pages`, `ga4-traffic-sources` |
| **Instatus** | `instatus-overview`, `instatus-incidents` |

### News & Social
| Provider | Tile Types |
|---|---|
| **HackerNews** | `hn-top-stories`, `hn-mentions` |
| **Reddit** | `reddit-hot-posts`, `reddit-keyword-monitor`, `reddit-posts` |
| **Product Hunt** | `producthunt-top-launches` |

### Finance & Markets
| Provider | Tile Types |
|---|---|
| **Alpha Vantage** | `alphavantage-quotes`, `alphavantage-sparklines`, `alphavantage-market-status`, `alphavantage-market-movers`, `alphavantage-news-sentiment`, `alphavantage-earnings`, `alphavantage-earnings-calendar`, `alphavantage-fundamentals`, `alphavantage-forex-rates`, `alphavantage-commodities`, `alphavantage-economic-indicators`, `alphavantage-insider-transactions` |
| **CoinGecko** | `coingecko-prices`, `coingecko-global`, `coingecko-markets`, `coingecko-trending`, `coingecko-price-chart`, `coingecko-defi-overview`, `coingecko-categories`, `coingecko-exchanges`, `coingecko-coin-detail` |
| **Finnhub** | `finnhub-quotes`, `finnhub-news`, `finnhub-company-news`, `finnhub-market-news`, `finnhub-earnings-calendar`, `finnhub-earnings-surprises`, `finnhub-analyst-consensus`, `finnhub-fundamentals`, `finnhub-market-status`, `finnhub-insider-transactions`, `finnhub-insider-sentiment`, `finnhub-ipo-calendar`, `finnhub-sec-filings`, `finnhub-company-profile` |
| **Plaid** | `plaid-balances`, `plaid-transactions`, `plaid-accounts`, `plaid-investment-portfolio`, `plaid-investment-transactions`, `plaid-liabilities-overview`, `plaid-credit-card-details`, `plaid-mortgage-tracker`, `plaid-statements` |

### Security
| Provider | Tile Types |
|---|---|
| **HIBP** | `hibp-breach-status`, `hibp-recent-breaches`, `hibp-email-breaches` |
| **VirusTotal** | `virustotal-domain-threats`, `virustotal-url-scan`, `virustotal-domain-scan` |
| **Shodan** | `shodan-exposed-services`, `shodan-vuln-summary`, `shodan-exposed-assets` |

## Generic Tiles (5 types)

| Type | Sub-key | Use Case |
|---|---|---|
| `rest` | `tile.rest` | Poll any REST API endpoint |
| `websocket` | `tile.ws` | Live WebSocket stream |
| `custom-api` | `tile.customApi` | Custom HTTP method/body/headers |
| `graphql` | `tile.graphql` | GraphQL query endpoint |
| `rss-feed` | `tile.rss` | RSS/Atom feed reader |
