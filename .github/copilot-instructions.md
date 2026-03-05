> Lean routing document. Detailed procedures live in **skills** and **docs**.

## Agent Rules

- **Never open a new terminal** if there is already an agent-controlled terminal open. Reuse the existing terminal.
- **EADDRINUSE error**: Inform the user the server is already running. Do **not** kill the process.
- **Allowed commands** in agent-controlled terminal: `bun`, `bunx`, `bun run dev`, `bun run build`, `bun run test`, `bun run lint`, `bun run e2e`, `kill <pid>`, `bun kill-port <port>`, `ls`, `cat <file>`, `tail -f <file>`, `diff <file1> <file2>`, `echo <message>`, `exit`, `clear`, `cd <dir>`, `pwd`, `rm <file>`, `mkdir <dir>`, `mv <source> <destination>`, `cp <source> <destination>`, `bun install <package>`, `bun uninstall <package>`, `bun update <package>`
- **Forbidden commands**: `node`, `npm`, `yarn`, `pnpm`
- **Read Lessons**: Always check `.github/tasks/lessons.md` for relevant lessons before starting work on a task. Apply the rules from any relevant lessons to avoid repeating mistakes.
- **Document Lessons**: After any correction or feedback from the user, immediately update `.github/tasks/lessons.md` with a description of the mistake pattern and a rule to prevent it in the future. This creates a feedback loop for continuous improvement.
- **Check Todo before Done**: Before marking a task as complete, review the original todo description in `.github/tasks/todo.md` to ensure all requirements are met and the implementation aligns with the plan.
- **Read the tsconfig.json**: Before writing any TypeScript code, read the `tsconfig.json` file to understand the compiler options and project structure. This will help you write code that is compatible with the project's TypeScript configuration and avoid common pitfalls.
- **Read the package.json**: Before adding any dependencies or scripts, read the `package.json` file to understand the existing dependencies, scripts, and project metadata. This will help you maintain consistency and avoid conflicts with existing packages or scripts.
- **Never use Emojis in docs or titles**: Avoid using emojis in any documentation, commit messages, or titles. This maintains a professional tone and ensures clarity for all users, including those who may have difficulty interpreting emojis.
- **Never trust terminal exit codes to verify a service is running**: Terminal context shows stale exit codes and last commands — they do not reflect current process state. Always verify a service is alive by calling its actual endpoint or functionality (e.g. an MCP tool call, a `curl` to a health endpoint, or polling a known route). If the MCP server responds, the API is running. Do not assume a service is down because a terminal shows exit code 1 or 130.
- **Verify service health before debugging**: Before investigating why a feature is not working, confirm the relevant service is actually running by probing it directly. Only proceed to code-level debugging after confirming the service is up and reachable.

---

## Workflow orchestration

### 1. Plan Mode Default
- Enter plan mode for any non-trivial task (3+ steps, arhitectural changes, multiple files affected, etc.)
- If something goes sideways, STOP and re-plan immediatly - don't keep pushing.
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity and back-and-forth during implementation.

### 2. Subagent Strategy
- Use subagents liberally to keep main context window, clean.
- Offload research, exploration, and parallel analysis to subagents.
- For complex problems, throw more compute at it via subagents instead of trying to do it all in one agent.
- One task per subagent for focused execution

### 3. Self-improvement loop
- After ANY correction from the user: update `.github/tasks/lessons.md` with the pattern of the mistake.
- Write rules for yourself that prevent the same mistake.
- Ruthlessly iterate on these lessons until the same mistake rate drops.
- Review lessons at session start for relevant project.

### 4. Verification before done
- Never mark task complete without proving it works.
- Diff Behavior between main and your changes when relevant
- Ask yourself: "Would staff engineer approve this?"
- Rrun tests, check logs, demonstration correctness

### 5. Demand elegance (Balanced)
- For non-trivial changes: Paus and ask "is there a simpler or more elegant way?"
- If a fix feel hacky: "Knowing everything I know now, implement the elegant solution instead of the quick fix"
- Skip this for simple, obvious fixes - don't over-enggineer
- Challenge your own work before presenting it

### 6. Automatically bug fixing
- When given a bug report: Just fix it. Don't ask for hand-holding.
- Point at logs, errors, failing tests - then resolve them
- Zero context switching required from the user
- Go fix failing tests without being told how
- Go fix failing linting without being todl to

## Task management

1. **Plan first**: Write plan to `.github/tasks/todo.md` with checkable items.
2. **Verify Plan**: Check in before starting implementation
3. **Track progress*:: Mark items complete as you go
4. **Explain changes**: High level summary at each step
5. **Document results**: Add review section to `.github/tasks/todo.md`
6. **Cappture lessons**: Update `.github/tasks/lessons.md` after corrections

## Core principles

- **Simpplicity first**: Make very change as simple as possible. Impact minimal code.
- **No laziness**: Find root causes. No temporary fixes. Senior developer standard.
- **Minimat impact**: Changes should only touch waht's necessary. Avoid introducing bugs.

---

## API Resources

### Source for APIS
- https://github.com/public-apis/public-apis

### Already integrated
- [x] Stripe API: https://stripe.com/docs/api
- [x] GitHub API: https://docs.github.com/en/rest
- [x] Cloudflare API: https://api.cloudflare.com/
- [x] PayPal API: https://developer.paypal.com/docs/api/overview/
- [x] Vercel API: https://vercel.com/docs/rest-api
- [x] Netlify API: https://open-api.netlify.com/
- [x] CircleCI API: https://circleci.com/docs/api/v2/
- [x] Travis CI API: https://developer.travis-ci.com/
- [x] Bitrise API: https://devcenter.bitrise.io/api/v0.1/
- [x] Docker Hub API: https://docs.docker.com/docker-hub/api/latest/
- [x] SonarQube API: https://next.sonarqube.com/sonarqube/web_api
- [x] Azure DevOps API: https://learn.microsoft.com/en-us/rest/api/azure/devops/
- [x] npm Registry API: https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md
- [x] jsDelivr API: https://www.jsdelivr.com/statistics
- [x] WakaTime API: https://wakatime.com/developers
- [x] Clockify API: https://clockify.me/developers-api
- [x] Linear API: https://developers.linear.app/docs/
- [x] Jira API: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- [x] Slack API: https://api.slack.com/
- [x] Discord API: https://discord.com/developers/docs/
- [x] Mailchimp API: https://mailchimp.com/developer/
- [x] Google Analytics Data API (GA4): https://developers.google.com/analytics/devguides/reporting/data/v1
- [x] Instatus API: https://instatus.com/developers
- [x] HackerNews API: https://github.com/HackerNews/API
- [x] Alpha Vantage: https://www.alphavantage.co/documentation/
- [x] CoinGecko API: https://www.coingecko.com/en/api/documentation
- [x] Finnhub: https://finnhub.io/docs/api
- [x] Plaid: https://plaid.com/docs/api/
- [x] HaveIBeenPwned API: https://haveibeenpwned.com/API/v3
- [x] VirusTotal API: https://developers.virustotal.com/reference/
- [x] Shodan API: https://developer.shodan.io/api
- [x] WooCommerce REST API: https://woocommerce.github.io/woocommerce-rest-api-docs/
- [x] Shopify Admin API: https://shopify.dev/docs/api/admin-rest
- [x] Reddit API: https://www.reddit.com/dev/api/
- [x] Product Hunt API: https://api.producthunt.com/v2/docs

---