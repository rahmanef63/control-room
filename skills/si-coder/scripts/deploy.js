// deploy.js — SI Coder Auto Deploy
// Usage: node deploy.js <DOKPLOY_API_URL> <DOKPLOY_API_KEY> <PROJECT_NAME> <APP_NAME> <GITHUB_TOKEN> [DOMAIN]
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);

if (args.length < 5) {
  console.error("Usage: node deploy.js <API_URL> <API_KEY> <PROJECT_NAME> <APP_NAME> <GITHUB_TOKEN> [DOMAIN]");
  process.exit(1);
}

const [apiUrl, apiKey, projectName, appName, githubToken, domain] = args;
const baseUrl = apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;

async function fetchDokploy(endpoint, method = 'GET', body = null) {
  const url = `${baseUrl}${endpoint}`;
  const options = {
    method,
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch(e) {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`Dokploy API Error ${res.status}: ${typeof data === 'object' ? JSON.stringify(data) : data}`);
  }
  return data;
}

async function fetchGitHub(endpoint, method = 'GET', body = null) {
  const url = `https://api.github.com${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `token ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'SICoder-Auto-Deploy-Skill'
    }
  };
  if (body) {
      options.body = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch(e) {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`GitHub API Error ${res.status}: ${typeof data === 'object' ? JSON.stringify(data) : data}`);
  }
  return data;
}

const delay = ms => new Promise(res => setTimeout(res, ms));

const dns = require('dns');
const util = require('util');
const lookup = util.promisify(dns.lookup);

function parseEnvString(envString = '') {
  const env = {};

  for (const rawLine of envString.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1);
    if (!key) continue;
    env[key] = value;
  }

  return env;
}

function mergeEnvString(existingEnv = '', updates = {}) {
  const lines = existingEnv.split(/\r?\n/).filter(line => line.trim().length > 0);
  const env = parseEnvString(existingEnv);
  const order = [];

  for (const line of lines) {
    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    if (key && !order.includes(key)) {
      order.push(key);
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null) continue;
    if (!order.includes(key)) {
      order.push(key);
    }
    env[key] = String(value);
  }

  return order.map(key => `${key}=${env[key]}`).join('\n');
}

async function updateComposeEnv(composeId, updates) {
  const currentCompose = await fetchDokploy(`/compose.one?composeId=${composeId}`);
  const nextEnv = mergeEnvString(currentCompose.env || '', updates);

  await fetchDokploy('/compose.update', 'POST', {
    composeId,
    env: nextEnv
  });

  return parseEnvString(nextEnv);
}

async function deleteDomain(domainId) {
  return await fetchDokploy('/domain.delete', 'POST', { domainId });
}

function selectDomainsToDelete(domains = [], desiredHosts = []) {
  const desired = new Set(desiredHosts.filter(Boolean));
  const keptDesiredHosts = new Set();
  const deletions = [];

  for (const domain of domains) {
    const host = domain.host;
    const isDesired = desired.has(host);
    const isTraefik = typeof host === 'string' && host.endsWith('.traefik.me');

    if (isDesired) {
      if (keptDesiredHosts.has(host)) {
        deletions.push(domain);
      } else {
        keptDesiredHosts.add(host);
      }
      continue;
    }

    if (isTraefik || desired.size > 0) {
      deletions.push(domain);
    }
  }

  return deletions;
}

async function cleanupComposeDomains(composeId, desiredHosts = []) {
  const currentCompose = await fetchDokploy(`/compose.one?composeId=${composeId}`);
  const domains = currentCompose.domains || [];
  const deletions = selectDomainsToDelete(domains, desiredHosts);

  for (const domain of deletions) {
    try {
      await deleteDomain(domain.domainId);
      console.log(`🧹 Removed compose domain ${domain.host}`);
    } catch (error) {
      console.warn(`⚠️ Failed to remove compose domain ${domain.host}: ${error.message}`);
    }
  }
}

async function cleanupApplicationDomains(applicationId, desiredHosts = []) {
  const currentApplication = await fetchDokploy(`/application.one?applicationId=${applicationId}`);
  const domains = currentApplication.domains || [];
  const deletions = selectDomainsToDelete(domains, desiredHosts);

  for (const domain of deletions) {
    try {
      await deleteDomain(domain.domainId);
      console.log(`🧹 Removed application domain ${domain.host}`);
    } catch (error) {
      console.warn(`⚠️ Failed to remove application domain ${domain.host}: ${error.message}`);
    }
  }
}

async function getDokployGithubProvider() {
  const providers = await fetchDokploy('/github.githubProviders');
  if (!Array.isArray(providers) || providers.length === 0) {
    return null;
  }

  return providers[0];
}

async function configureApplicationGithubProvider({
  applicationId,
  githubId,
  owner,
  repository,
  branch,
  buildPath = '/',
  enableSubmodules = false
}) {
  await fetchDokploy('/application.saveGithubProvider', 'POST', {
    applicationId,
    githubId,
    owner,
    repository,
    branch,
    buildPath,
    enableSubmodules,
    triggerType: 'push'
  });
}

function extractAdminKey(output = '') {
  const lines = output
    .split(/\r?\n/)
    .map(line => line.replace(/^Admin key:\s*/, '').trim())
    .filter(Boolean);

  return lines.find(line => line.includes('|')) || lines[lines.length - 1] || '';
}

async function configureHostingerDNS(fullDomain, apiUrl) {
  const hostingerToken = process.env.HOSTINGER_API_TOKEN;
  if (!hostingerToken || !fullDomain) return;

  try {
    console.log(`\n🌍 Checking Hostinger DNS for ${fullDomain}...`);
    // Determine the IP address of the Dokploy server
    const apiHost = new URL(apiUrl).hostname;
    const { address: serverIp } = await lookup(apiHost);

    // Fetch user domains
    const portfolioRes = await fetch("https://developers.hostinger.com/api/domains/v1/portfolio", {
      headers: { 'Authorization': `Bearer ${hostingerToken}`, 'Accept': 'application/json' }
    });
    if(!portfolioRes.ok) return;
    const domains = await portfolioRes.json();

    // Find matching root domain
    let rootDomain = null;
    let subdomain = "@";
    for (const d of domains) {
      if (fullDomain === d.domain) {
        rootDomain = d.domain;
        subdomain = "@";
        break;
      } else if (fullDomain.endsWith(`.${d.domain}`)) {
        rootDomain = d.domain;
        subdomain = fullDomain.replace(`.${d.domain}`, '');
        break;
      }
    }

    if (!rootDomain) {
      console.log(`⚠️ Root domain for ${fullDomain} not found in Hostinger account. Skipping DNS automation.`);
      return;
    }

    // Fetch zone
    const zoneRes = await fetch(`https://developers.hostinger.com/api/dns/v1/zones/${rootDomain}`, {
      headers: { 'Authorization': `Bearer ${hostingerToken}`, 'Accept': 'application/json' }
    });
    if(!zoneRes.ok) return;
    const zoneRecords = await zoneRes.json();
    if(!Array.isArray(zoneRecords)) return;

    // Check if A record exists
    const exists = zoneRecords.some(r => r.name === subdomain && r.type === 'A');
    if (!exists) {
      console.log(`📝 Adding A record for '${subdomain}' -> ${serverIp} in zone ${rootDomain}...`);
      zoneRecords.push({
        name: subdomain,
        type: 'A',
        ttl: 14400,
        records: [{ content: serverIp, is_disabled: false }]
      });

      const putRes = await fetch(`https://developers.hostinger.com/api/dns/v1/zones/${rootDomain}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${hostingerToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone: zoneRecords })
      });

      if (putRes.ok) {
        console.log(`✅ Hostinger DNS updated successfully for ${fullDomain}.`);
        await new Promise(res => setTimeout(res, 5000));
      } else {
        console.warn(`⚠️ Failed to update Hostinger DNS: ${await putRes.text()}`);
      }
    } else {
      console.log(`✅ A record for ${fullDomain} already exists in Hostinger.`);
    }
  } catch(e) {
    console.warn(`⚠️ Hostinger DNS configuration skipped due to error: ${e.message}`);
  }
}

async function run() {
  try {
    console.log(`🚀 Starting full-stack zero-human deployment for ${appName} in project ${projectName}`);

    // --- 1. GITHUB REPOSITORY CREATION & PUSH ---
    console.log("🐙 Checking/Creating GitHub Repository...");
    const user = await fetchGitHub('/user');
    const githubUsername = user.login;
    let repoUrl = `git@github.com:${githubUsername}/${appName}.git`;
    const repoOwner = githubUsername;
    const repoName = appName;

    try {
        await fetchGitHub(`/repos/${githubUsername}/${appName}`);
        console.log(`✅ GitHub repository ${githubUsername}/${appName} already exists.`);
    } catch(e) {
        if(e.message.includes('404')) {
            console.log(`📁 Creating new private GitHub repository: ${appName}...`);
            await fetchGitHub('/user/repos', 'POST', {
                name: appName,
                private: true,
                description: `Auto-generated repository for ${appName}`
            });
            console.log(`✅ GitHub repository created successfully.`);
        } else {
            throw e;
        }
    }

    console.log("💻 Pushing local code to GitHub via SSH...");
    try {
        // Clear local build cache to avoid stale URLs
        if (fs.existsSync(path.join(process.cwd(), '.next'))) {
            console.log("🧹 Clearing local .next build cache...");
            execSync('rm -rf .next');
        }

        execSync(`git config --global init.defaultBranch main`);
        try { execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' }); } catch {
            execSync('git init');
        }

        try { execSync('git remote remove origin', { stdio: 'ignore' }); } catch(e) {}
        execSync(`git remote add origin ${repoUrl}`);

        execSync('git add .');
        try { execSync('git commit -m "Auto-deploy commit"', { stdio: 'ignore' }); } catch(e) {}

        const branchBuffer = execSync('git branch --show-current');
        let currentBranch = branchBuffer.toString().trim();
        if(!currentBranch) currentBranch = 'main';

        execSync(`git push -u origin ${currentBranch} --force`, { stdio: 'ignore' });
        console.log(`✅ Code pushed to ${repoUrl} on branch ${currentBranch}.`);

    } catch(error) {
        console.error("❌ Git push failed. Ensure your local SSH keys are configured for GitHub.");
        throw error;
    }

    const branch = execSync('git branch --show-current').toString().trim() || 'main';


    // --- 2. DOKPLOY PROJECT CREATION ---
    // API docs: $DOKPLOY_API_URL/swagger
    console.log("🔍 Fetching Dokploy projects...");
    const projects = await fetchDokploy('/project.all');
    let project = projects.find(p => p.name === projectName);

    if (!project) {
      console.log(`📁 Project '${projectName}' not found on Dokploy. Creating...`);
      await fetchDokploy('/project.create', 'POST', { name: projectName });
      const updatedProjects = await fetchDokploy('/project.all');
      project = updatedProjects.find(p => p.name === projectName);
      if (!project) throw new Error("Failed to retrieve created Dokploy project.");
    }

    const environment = project.environments?.[0];
    const envId = environment?.environmentId;
    if (!envId) {
      throw new Error(`No environments found for project ${projectName}`);
    }
    const secureGitUrl = `https://${githubUsername}:${githubToken}@github.com/${repoOwner}/${repoName}.git`;

    const hasDockerCompose = fs.existsSync(path.join(process.cwd(), 'docker-compose.yml'));
    const hasDockerfile = fs.existsSync(path.join(process.cwd(), 'Dockerfile'));

    // --- 3. DOKPLOY COMPOSE DEPLOYMENT (For Self-Hosted DB) ---
    if (hasDockerCompose) {
      const composeAppName = `${appName}-db`;
      console.log(`\n🐳 Docker Compose found. Setting up DB using Convex template: ${composeAppName}`);

      let composeApp = project.environments[0]?.compose?.find(c => c.name === composeAppName);

      if (!composeApp) {
        console.log(`📦 Compose App '${composeAppName}' not found. Deploying from Convex template...`);
        try {
            const deployTplRes = await fetchDokploy('/compose.deployTemplate', 'POST', {
              environmentId: envId,
              id: "convex"
            });

            if (deployTplRes && deployTplRes.composeId) {
                await fetchDokploy('/compose.update', 'POST', {
                    composeId: deployTplRes.composeId,
                    name: composeAppName
                });
                const updatedProjects2 = await fetchDokploy('/project.all');
                const p2 = updatedProjects2.find(p => p.name === projectName);
                composeApp = p2.environments[0]?.compose?.find(c => c.name === composeAppName);
            }
        } catch(e) {
            console.error("Failed to deploy Convex template.", e.message);
        }
      } else {
        console.log(`📦 Compose App '${composeAppName}' already exists (ID: ${composeApp.composeId}).`);
      }

      if (composeApp) {
          let apiDomain = null;
          let dashDomain = null;
          let siteDomain = null;

          const currentCompose = await fetchDokploy(`/compose.one?composeId=${composeApp.composeId}`);
          const currentComposeVars = parseEnvString(currentCompose.env || '');
          const instanceSecret = currentComposeVars.INSTANCE_SECRET || crypto.randomBytes(32).toString('hex');

          if (currentComposeVars.CONVEX_ADMIN_KEY) {
              project.tempAdminKey = currentComposeVars.CONVEX_ADMIN_KEY;
          }

          if (domain) {
              apiDomain = `api-${domain}`;
              dashDomain = `dash-${domain}`;
              siteDomain = `site-${domain}`;

              console.log(`\n🌐 Setting up backend domains: ${apiDomain}, ${dashDomain}, ${siteDomain}`);

              // 1. Hostinger DNS
              await configureHostingerDNS(apiDomain, apiUrl);
              await configureHostingerDNS(dashDomain, apiUrl);
              await configureHostingerDNS(siteDomain, apiUrl);

              // 2. Create Dokploy Domains
              const backendDomains = [
                { host: apiDomain, port: 3210, serviceName: "backend" },
                { host: siteDomain, port: 3211, serviceName: "backend" },
                { host: dashDomain, port: 6791, serviceName: "dashboard" }
              ];

              for (const backendDomain of backendDomains) {
                  try {
                      await fetchDokploy('/domain.create', 'POST', {
                        composeId: composeApp.composeId,
                        host: backendDomain.host,
                        port: backendDomain.port,
                        serviceName: backendDomain.serviceName,
                        https: true,
                        certificateType: "letsencrypt"
                      });
                  } catch (e) {
                      console.warn(`⚠️ Domain ${backendDomain.host} may already exist or Dokploy rejected it. Skipping.`);
                  }
              }

              await cleanupComposeDomains(composeApp.composeId, backendDomains.map((entry) => entry.host));

              console.log(`✅ Backend domain configuration checked in Dokploy.`);
              console.log(`\n🔑 To deploy Convex schema manually if needed, SSH into your server and run:`);
              console.log(`docker exec <compose_project>-backend-1 ./generate_admin_key.sh`);
              console.log(`Then: npx convex deploy --url https://${apiDomain || '<api-domain>'} --admin-key "<the_generated_key>"\n`);
          }

          const composeEnvUpdates = {
            INSTANCE_SECRET: instanceSecret,
            INSTANCE_NAME: appName
          };

          if (apiDomain) {
            composeEnvUpdates.NEXT_PUBLIC_DEPLOYMENT_URL = `https://${apiDomain}`;
            composeEnvUpdates.CONVEX_CLOUD_ORIGIN = `https://${apiDomain}`;
          }

          if (siteDomain) {
            composeEnvUpdates.CONVEX_SITE_ORIGIN = `https://${siteDomain}`;
          }

          // --- AUTO-GENERATE JWT KEYS FOR @convex-dev/auth ---
          if (fs.existsSync(path.join(process.cwd(), 'convex/auth.ts'))) {
            const existingJwt = currentComposeVars.JWT_PRIVATE_KEY;
            const existingJwks = currentComposeVars.JWKS;

            if (!existingJwt || !existingJwks) {
              console.log('🔐 Convex Auth detected (convex/auth.ts). Generating JWT keys...');
              const { generateKeyPairSync, createPublicKey } = crypto;
              const { privateKey, publicKey } = generateKeyPairSync('rsa', {
                modulusLength: 2048,
                publicKeyEncoding: { type: 'spki', format: 'pem' },
                privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
              });
              const jwk = createPublicKey(publicKey).export({ format: 'jwk' });
              jwk.alg = 'RS256';
              jwk.use = 'sig';
              jwk.kid = 'convex-self-hosted-1';

              composeEnvUpdates.JWT_PRIVATE_KEY = privateKey.trim();
              composeEnvUpdates.JWKS = JSON.stringify({ keys: [jwk] });
              console.log('✅ JWT_PRIVATE_KEY and JWKS generated and will be set in compose env.');
            } else {
              console.log('✅ JWT_PRIVATE_KEY and JWKS already exist in compose env. Skipping key generation.');
            }
          }

          await updateComposeEnv(composeApp.composeId, composeEnvUpdates);
          console.log(`✅ Compose environment synchronized without rotating existing Convex secrets.`);

          console.log("🚀 Triggering Compose deployment...");
          await fetchDokploy('/compose.deploy', 'POST', { composeId: composeApp.composeId });
          console.log(`⏳ Compose deployment started.`);

          // --- STEP 3: AUTOMATIC SCHEMA DEPLOYMENT ---
          if (fs.existsSync(path.join(process.cwd(), 'convex/schema.ts'))) {
              console.log("🔑 Convex detected. Waiting for backend to be healthy for admin-key generation...");
              await delay(15000);

              let adminKey = project.tempAdminKey;

              try {
                  const latestCompose = await fetchDokploy(`/compose.one?composeId=${composeApp.composeId}`);
                  const composeRuntimeName = latestCompose.appName || composeApp.appName;

                  if (!composeRuntimeName) {
                      throw new Error("Compose runtime name unavailable for admin key generation.");
                  }

                  const containerName = `${composeRuntimeName}-backend-1`;
                  const rawAdminKey = execSync(`sudo docker exec ${containerName} ./generate_admin_key.sh`, { stdio: 'pipe' }).toString();
                  adminKey = extractAdminKey(rawAdminKey);

                  if (!adminKey) {
                      throw new Error("Convex admin key generation returned an empty value.");
                  }

                  await updateComposeEnv(composeApp.composeId, { CONVEX_ADMIN_KEY: adminKey });
                  project.tempAdminKey = adminKey;
                  console.log("✅ Admin Key saved to Compose env.");
                  console.log(`\n🔑 CONVEX_ADMIN_KEY generated: ${adminKey}`);
              } catch (err) {
                  console.warn(`⚠️ Automatic admin-key generation failed: ${err.message}`);
              }

              if (adminKey && apiDomain) {
                  try {
                      console.log("📤 Pushing Convex schema automatically...");
                      execSync(`NODE_TLS_REJECT_UNAUTHORIZED=0 npx convex deploy --url https://${apiDomain} --admin-key "${adminKey}"`, { stdio: 'inherit' });
                      console.log("✅ Convex schema deployed successfully.");
                  } catch (err) {
                      console.warn(`⚠️ Automatic schema deployment failed: ${err.message}`);
                  }
              } else if (!apiDomain) {
                  console.log("ℹ️ Skipping automatic Convex schema deploy because no backend domain was provided.");
              } else if (!adminKey) {
                  console.log("ℹ️ Skipping automatic Convex schema deploy because admin-key generation did not complete.");
              }
          }
      }
    }

    // --- 4. DOKPLOY APPLICATION DEPLOYMENT (For Frontend) ---
    if (hasDockerfile) {
      console.log(`\n📄 Dockerfile found. Setting up standard Application: ${appName}`);
      let app = project.environments[0]?.applications?.find(a => a.name === appName);

      if (!app) {
        console.log(`📦 Application '${appName}' not found. Creating...`);
        try {
            await fetchDokploy('/application.create', 'POST', {
              name: appName,
              appName: appName,
              environmentId: envId
            });
            const updatedProjects3 = await fetchDokploy('/project.all');
            const p3 = updatedProjects3.find(p => p.name === projectName);
            app = p3.environments[0]?.applications?.find(a => a.name === appName);
        } catch(e) {
             console.error("Failed to create application.", e.message);
        }
      } else {
         console.log(`📦 Application '${appName}' already exists (ID: ${app.applicationId}). Updating...`);
      }

          if (app) {
          const appId = app.applicationId;

          console.log(`⚙️ Configuring Dokploy application source...`);
          try {
            let appEnv = "";
            if (domain) {
                const apiDomain = `api-${domain}`;
                appEnv = `NEXT_PUBLIC_CONVEX_URL=https://${apiDomain}`;
                if (project.tempAdminKey) {
                    appEnv += `\nCONVEX_ADMIN_KEY=${project.tempAdminKey}`;
                }
            }

            const githubProvider = await getDokployGithubProvider();

            if (githubProvider?.githubId) {
              console.log(`🔗 Binding Dokploy application to GitHub provider ${githubProvider.githubId}...`);
              await configureApplicationGithubProvider({
                applicationId: appId,
                githubId: githubProvider.githubId,
                owner: repoOwner,
                repository: repoName,
                branch
              });

              await fetchDokploy('/application.update', 'POST', {
                applicationId: appId,
                sourceType: "github",
                githubId: githubProvider.githubId,
                owner: repoOwner,
                repository: repoName,
                branch,
                buildPath: "/",
                buildType: "dockerfile",
                dockerfile: "Dockerfile",
                triggerType: "push",
                autoDeploy: true,
                customGitUrl: null,
                customGitBranch: null,
                customGitBuildPath: null,
                customGitSSHKeyId: null,
                env: appEnv,
                buildArgs: appEnv
              });
              console.log(`✅ Dokploy application updated successfully with GitHub provider.`);
            } else {
              console.log(`ℹ️ No Dokploy GitHub provider found. Falling back to raw Git source.`);
              await fetchDokploy('/application.update', 'POST', {
                applicationId: appId,
                customGitUrl: secureGitUrl,
                customGitBranch: branch,
                buildType: "dockerfile",
                dockerfile: "Dockerfile",
                triggerType: "push",
                autoDeploy: true,
                sourceType: "git",
                env: appEnv,
                buildArgs: appEnv
              });
              console.log(`✅ Dokploy application updated successfully with raw Git source.`);
            }
          } catch(e) {
            console.warn(`⚠️ Warning during application update: ${e.message}`);
          }

          if (domain) {
              console.log(`🌐 Setting up domain ${domain}...`);
              await configureHostingerDNS(domain, apiUrl);

              try {
                  await fetchDokploy('/domain.create', 'POST', {
                      applicationId: appId,
                      host: domain,
                      https: true,
                      certificateType: "letsencrypt"
                  });
                  console.log(`✅ Domain ${domain} created.`);
              } catch(e) {
                  console.warn(`⚠️ Note on domain creation: Domain may already exist or API rejected it. Skipping.`);
              }

              await cleanupApplicationDomains(appId, [domain]);
          }

          console.log("🚀 Triggering Application deployment...");
          await fetchDokploy('/application.deploy', 'POST', { applicationId: appId });
          console.log(`⏳ Waiting for Application deployment to finish... (this may take a minute)`);

          let isFinished = false;
          let status = 'running';
          let attempts = 0;
          const maxAttempts = 60; // 5 minutes max wait

          while (!isFinished && attempts < maxAttempts) {
              await delay(5000);
              attempts++;
              try {
                  const currentProjects = await fetchDokploy('/project.all');
                  const p = currentProjects.find(p => p.name === projectName);
                  const e = p.environments[0];
                  const a = e.applications.find(a => a.name === appName);
                  status = a.applicationStatus;

                  if (status === 'done' || status === 'error') {
                      isFinished = true;
                  } else {
                      process.stdout.write(".");
                  }
              } catch(e) {
                  // ignore network blips during polling
              }
          }

          console.log("");
          if (status === 'done') {
              console.log(`🎉 Deployment SUCCESSFUL! App should be live at https://${domain || appName}.`);
          } else {
              console.error(`❌ Deployment ended with status: ${status}.`);
              console.error(`\n⚠️  Check your Dokploy Dashboard → '${projectName}' project → '${appName}' → 'Deployments' for build logs.`);
          }
      }
    }

    console.log(`\n✅ All setup actions completed.`);
  } catch (error) {
    console.error("❌ Process failed:", error.message);
    process.exit(1);
  }
}

run();
