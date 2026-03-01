import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from './TileConfig';
import { STRIPE_TILE_FACTORIES } from './stripe/index';
import { GITHUB_TILE_FACTORIES } from './github/index';
import { CF_TILE_FACTORIES } from './cloudflare/index';
import { PAYPAL_TILE_FACTORIES } from './paypal/index';
import { VERCEL_TILE_FACTORIES } from './vercel/index';
import { NETLIFY_TILE_FACTORIES } from './netlify/index';
import { CIRCLECI_TILE_FACTORIES } from './circleci/index';
import { TRAVIS_TILE_FACTORIES } from './travisci/index';
import { BITRISE_TILE_FACTORIES } from './bitrise/index';
import { DOCKERHUB_TILE_FACTORIES } from './dockerhub/index';
import { SONARQUBE_TILE_FACTORIES } from './sonarqube/index';
import { AZUREDEVOPS_TILE_FACTORIES } from './azuredevops/index';
import { NPM_TILE_FACTORIES } from './npm/index';
import { JSDELIVR_TILE_FACTORIES } from './jsdelivr/index';
import { WAKATIME_TILE_FACTORIES } from './wakatime/index';
import { CLOCKIFY_TILE_FACTORIES } from './clockify/index';
import { LINEAR_TILE_FACTORIES } from './linear/index';
import { JIRA_TILE_FACTORIES } from './jira/index';
import { SLACK_TILE_FACTORIES } from './slack/index';
import { DISCORD_TILE_FACTORIES } from './discord/index';
import { MAILCHIMP_TILE_FACTORIES } from './mailchimp/index';
import { GA4_TILE_FACTORIES } from './ga4/index';
import { INSTATUS_TILE_FACTORIES } from './instatus/index';
import { HACKERNEWS_TILE_FACTORIES } from './hackernews/index';
import { ALPHAVANTAGE_TILE_FACTORIES } from './alphavantage/index';
import { COINGECKO_TILE_FACTORIES } from './coingecko/index';
import { FINNHUB_TILE_FACTORIES } from './finnhub/index';
import { PLAID_TILE_FACTORIES } from './plaid/index';
import { HIBP_TILE_FACTORIES } from './hibp/index';
import { VIRUSTOTAL_TILE_FACTORIES } from './virustotal/index';
import { SHODAN_TILE_FACTORIES } from './shodan/index';
import { WOOCOMMERCE_TILE_FACTORIES } from './woocommerce/index';
import { SHOPIFY_TILE_FACTORIES } from './shopify/index';
import { REDDIT_TILE_FACTORIES } from './reddit/index';
import { PRODUCTHUNT_TILE_FACTORIES } from './producthunt/index';
import { RSS_TILE_FACTORIES } from './rss/index';
import { RestTile } from './sources/RestTile';
import { WsTile } from './sources/WsTile';
import { CustomApiTile } from './sources/CustomApiTile';
import { GraphqlTile } from './sources/GraphqlTile';

const ALL_FACTORIES = [
  STRIPE_TILE_FACTORIES,
  GITHUB_TILE_FACTORIES,
  CF_TILE_FACTORIES,
  PAYPAL_TILE_FACTORIES,
  VERCEL_TILE_FACTORIES,
  NETLIFY_TILE_FACTORIES,
  CIRCLECI_TILE_FACTORIES,
  TRAVIS_TILE_FACTORIES,
  BITRISE_TILE_FACTORIES,
  DOCKERHUB_TILE_FACTORIES,
  SONARQUBE_TILE_FACTORIES,
  AZUREDEVOPS_TILE_FACTORIES,
  NPM_TILE_FACTORIES,
  JSDELIVR_TILE_FACTORIES,
  WAKATIME_TILE_FACTORIES,
  CLOCKIFY_TILE_FACTORIES,
  LINEAR_TILE_FACTORIES,
  JIRA_TILE_FACTORIES,
  SLACK_TILE_FACTORIES,
  DISCORD_TILE_FACTORIES,
  MAILCHIMP_TILE_FACTORIES,
  GA4_TILE_FACTORIES,
  INSTATUS_TILE_FACTORIES,
  HACKERNEWS_TILE_FACTORIES,
  ALPHAVANTAGE_TILE_FACTORIES,
  COINGECKO_TILE_FACTORIES,
  FINNHUB_TILE_FACTORIES,
  PLAID_TILE_FACTORIES,
  HIBP_TILE_FACTORIES,
  VIRUSTOTAL_TILE_FACTORIES,
  SHODAN_TILE_FACTORIES,
  WOOCOMMERCE_TILE_FACTORIES,
  SHOPIFY_TILE_FACTORIES,
  REDDIT_TILE_FACTORIES,
  PRODUCTHUNT_TILE_FACTORIES,
  RSS_TILE_FACTORIES,
];

/** Render the right component for any TileConfig */
export function renderTile(tile: TileConfig): JSX.Element {
  for (const factories of ALL_FACTORIES) {
    if (tile.type in factories) {
      const factory = factories[tile.type as TileType];
      if (factory) return factory(tile);
    }
  }
  if (tile.type === 'rest' && tile.rest) {
    return <RestTile config={tile.rest} tileId={tile.id} />;
  }
  if (tile.type === 'websocket' && tile.ws) {
    return <WsTile config={tile.ws} tileId={tile.id} />;
  }
  if (tile.type === 'custom-api') {
    return <CustomApiTile config={tile.customApi ?? { url: '' }} tileId={tile.id} />;
  }
  if (tile.type === 'graphql') {
    return <GraphqlTile config={tile.graphql ?? { url: '', query: '' }} tileId={tile.id} />;
  }
  return <div class="tile-unknown">Unknown tile type: {tile.type}</div>;
}

